import { findAndUpdateClaudeConfig } from '../clients/claude.js';
import { findAndUpdateWindsurfConfig } from '../clients/windsurf.js';
import { findAndUpdateCursorConfig } from '../clients/cursor.js';
import { log, logError } from '../utils/logger.js';
import { requestAuthorization } from '../auth/device-auth-flow.js';
import { promptForScopeSelection } from '../utils/cli-utility.js';
import { getAllScopes } from '../utils/scopes.js';
import { Glob } from '../utils/glob.js'; // Import the Glob class
import chalk from 'chalk';
import { TOOLS } from '../tools/index.js';
import { parseArgs } from '../utils/cli-args.js';

/**
 * Resolves scopes based on command line arguments
 *
 * @param {string[]} args - Command line arguments
 * @returns {Promise<string[]>} - The selected scopes
 */
async function resolveScopes(args: string[]): Promise<string[]> {
  const scopesFlagIndex = args.findIndex((arg) => arg === '--scopes');

  // If no --scopes flag or no value provided, prompt for selection
  if (
    scopesFlagIndex === -1 ||
    scopesFlagIndex + 1 >= args.length ||
    args[scopesFlagIndex + 1].startsWith('--')
  ) {
    return promptForScopeSelection();
  }

  // Parse scope patterns
  const scopesArg = args[scopesFlagIndex + 1];
  const scopePatterns = scopesArg
    .split(',')
    .map((pattern) => pattern.trim())
    .filter(Boolean);

  if (scopePatterns.length === 0) {
    return promptForScopeSelection();
  }

  // Match patterns against available scopes
  const allAvailableScopes = getAllScopes();
  const matchedScopes = new Set<string>();
  const invalidScopes = new Set<string>();

  for (const pattern of scopePatterns) {
    let foundMatch = false;
    const glob = new Glob(pattern);

    for (const scope of allAvailableScopes) {
      if (glob.matches(scope)) {
        matchedScopes.add(scope);
        foundMatch = true;
      }
    }

    // Track invalid scopes (non-wildcard patterns with no matches)
    if (!glob.hasWildcards() && !foundMatch) {
      invalidScopes.add(pattern);
    }
  }

  // Handle invalid scopes
  if (invalidScopes.size > 0) {
    const errorMessage = `Error: The following scopes are not valid: ${Array.from(invalidScopes).join(', ')}`;
    logError(errorMessage);
    logError(chalk.yellow(`Valid scopes are: ${allAvailableScopes.join(', ')}`));
    process.exit(1);
  }

  // Handle matched scopes
  const matchedScopesArray = Array.from(matchedScopes);
  if (matchedScopesArray.length === 0) {
    log(chalk.yellow('No scopes matched the provided patterns, proceeding to scope selection.'));
    return promptForScopeSelection();
  }

  return promptForScopeSelection(matchedScopesArray);
}

/**
 * Client configuration options supported by the application
 */
type ClientName = 'claude' | 'windsurf' | 'cursor';

/**
 * Resolves the client to use based on command line arguments
 *
 * @param {string[]} args - Command line arguments
 * @returns {ClientName} - The selected client name
 */
function resolveClient(args: string[]): ClientName {
  const clientFlagIndex = args.findIndex((arg) => arg === '--client');

  if (clientFlagIndex !== -1 && clientFlagIndex < args.length - 1) {
    const clientValue = args[clientFlagIndex + 1].toLowerCase();

    if (clientValue === 'windsurf' || clientValue === 'cursor' || clientValue === 'claude') {
      return clientValue;
    }
  }

  return 'claude'; // Default client
}

/**
 * Initializes the Auth0 MCP server by handling scope selection, authorization,
 * and client configuration.
 *
 * @param {string[]} args - Command line arguments passed to the application
 * @returns {Promise<void>}
 */
const init = async (args: string[]): Promise<void> => {
  try {
    log('Initializing Auth0 MCP server...');

    // Parse CLI options from arguments
    const cliArgs = args.filter((arg) => !arg.startsWith('--client'));

    // Check if --tools is explicitly provided
    const hasToolsArg = cliArgs.some((arg) => arg.startsWith('--tools='));
    if (!hasToolsArg) {
      logError("The --tools parameter is required. Example: --tools='auth0_list_*,auth0_get_*'");
      throw new Error('Missing required --tools parameter');
    }

    const options = parseArgs(cliArgs, TOOLS);
    // We know tools exists because we checked for the --tools argument
    if (options.tools && options.tools.length > 0) {
      log(`Configuring server with selected tools: ${options.tools.join(', ')}`);
    }

    // Handle scope resolution
    const selectedScopes = await resolveScopes(args);
    await requestAuthorization(selectedScopes);

    // Handle client configuration
    const clientName = resolveClient(args);

    // Pass options to client configuration functions
    if (clientName === 'windsurf') {
      log('Configuring Windsurf as client...');
      await findAndUpdateWindsurfConfig(options);
    } else if (clientName === 'cursor') {
      log('Configuring Cursor as client...');
      await findAndUpdateCursorConfig(options);
    } else {
      log('Configuring Claude as client...');
      await findAndUpdateClaudeConfig(options);
    }
  } catch (error) {
    logError('Error initializing server:', error);
  }
};

export default init;
