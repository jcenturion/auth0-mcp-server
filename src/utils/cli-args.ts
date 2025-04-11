import { Tool } from './types.js';
import { log } from './logger.js';
import { Glob } from './glob.js';

/**
 * Options returned by CLI argument parser
 */
export interface CliOptions {
  /** Tool names or patterns to enable */
  tools?: string[];
}

/**
 * List of accepted command-line arguments
 */
export const ACCEPTED_ARGS = ['tools'] as const;

/**
 * Parse command-line arguments
 *
 * @param args - Command line arguments
 * @param availableTools - List of available tools
 * @returns Parsed options
 */
export function parseArgs(args: string[], availableTools: Tool[]): CliOptions {
  const options: CliOptions = {};
  const toolNames = availableTools.map((tool) => tool.name);

  for (const arg of args) {
    if (!arg.startsWith('--')) continue;

    if (!arg.includes('=')) {
      throw new Error(`Invalid argument format: ${arg}. Expected format: --option=value`);
    }

    const [key, value] = arg.slice(2).split('=');

    if (key === 'tools') {
      options.tools = value.split(',').map((item) => item.trim());
    } else {
      throw new Error(
        `Invalid argument: ${key}. Accepted arguments are: ${ACCEPTED_ARGS.join(', ')}`
      );
    }
  }

  // Validate tool patterns
  if (options.tools) {
    for (const pattern of options.tools) {
      // Create a new glob pattern
      const glob = new Glob(pattern);

      // Check if it matches any tool
      const matchesAnyTool = toolNames.some((name) => glob.matches(name));
      if (!matchesAnyTool) {
        const errorPrefix = pattern.includes('*') ? `No tools match the pattern` : `Invalid tool`;

        throw new Error(`${errorPrefix}: ${pattern}. Accepted tools are: ${toolNames.join(', ')}`);
      }
    }
  }

  return options;
}

/**
 * Filter available tools based on command line options
 *
 * @param allTools - All available tools
 * @param options - Command line options
 * @returns Filtered tools
 */
export function filterTools(allTools: Tool[], options?: CliOptions): Tool[] {
  // Return all tools if no filters specified
  if (!options?.tools?.length) {
    return allTools;
  }

  try {
    // Compile glob patterns once
    const globs = options.tools.map((pattern) => new Glob(pattern));

    // Find matching tools
    const enabledToolNames = new Set<string>();

    for (const glob of globs) {
      const matchingTools = allTools.filter((tool) => glob.matches(tool.name));
      matchingTools.forEach((tool) => enabledToolNames.add(tool.name));

      if (glob.toString().includes('*')) {
        log(`Glob pattern '${glob}' matched ${matchingTools.length} tools`);
      }
    }

    const filteredTools = allTools.filter((tool) => enabledToolNames.has(tool.name));
    log(`Filtered to ${filteredTools.length} available tools based on CLI options`);
    return filteredTools;
  } catch (error) {
    // Log error and return all tools as fallback
    log(`Error filtering tools: ${error instanceof Error ? error.message : String(error)}`);
    return allTools;
  }
}

/**
 * Check if a tool is allowed based on command line options
 *
 * @param toolName - Name of the tool to check
 * @param options - Command line options
 * @returns True if the tool is allowed
 */
export function isToolAllowed(toolName: string, options?: CliOptions): boolean {
  // Allow if no filters specified
  if (!options?.tools?.length) {
    return true;
  }

  try {
    // Compile globs once
    const globs = options.tools.map((pattern) => new Glob(pattern));

    // Check if any pattern matches
    return globs.some((glob) => glob.matches(toolName));
  } catch (error) {
    log(
      `Error checking tool "${toolName}": ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}
