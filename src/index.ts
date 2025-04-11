#!/usr/bin/env node
import init from './commands/init.js';
import run from './commands/run.js';
import help from './commands/help.js';
import logout from './commands/logout.js';
import session from './commands/session.js';
import { logError } from './utils/logger.js';
import { TOOLS } from './tools/index.js';
import { parseArgs } from './utils/cli-args.js';

// Enable all debug logs for this package by default
//process.env.DEBUG = (process.env.DEBUG || '') + ',auth0-mcp:*';

// Set process title
process.title = 'auth0-mcp-server';

// Handle process events
process.on('uncaughtException', (error) => {
  logError('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  logError('Unhandled rejection:', error);
  process.exit(1);
});

// Parse command line arguments
const command = process.argv[2];

// Wrap the main execution in an async function to handle top-level await properly
async function main() {
  try {
    if (command === 'run') {
      // Extract additional arguments for run command
      const runArgs = process.argv.slice(3);

      // Check if --tools is explicitly provided
      const hasToolsArg = runArgs.some((arg) => arg.startsWith('--tools='));
      if (!hasToolsArg) {
        logError("The --tools parameter is required. Example: --tools='auth0_list_*,auth0_get_*'");
        process.exit(1);
      }

      const options = parseArgs(runArgs, TOOLS);

      // Main function to start server
      await run(options);
    } else if (command === 'init') {
      const args = process.argv.slice(3);
      await init(args);
    } else if (command === 'help') {
      await help();
    } else if (command === 'logout') {
      await logout();
    } else if (command === 'session') {
      await session();
    } else {
      logError(
        `Usage: auth0-mcp <command>\nValid commands: 'init', 'run', 'logout', 'session', or 'help'`
      );
      logError(`Run 'auth0-mcp help' for more information.`);
      process.exit(1);
    }
  } catch (error) {
    logError('Error executing command:', error);
    process.exit(1);
  }
}

// Execute the main function
main().catch((error) => {
  logError('Unhandled error in main execution:', error);
  process.exit(1);
});

// Export for use in bin script
export { run };
