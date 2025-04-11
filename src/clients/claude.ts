import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import { log, logError } from '../utils/logger.js';
import { cliOutput } from '../utils/cli-utility.js';
import type { CliOptions } from '../utils/cli-args.js';

interface ClaudeMCPServer {
  args: string[];
  capabilities?: string[];
  command: string;
  env?: Record<string, string>;
}

interface ClaudeDesktopConfig {
  mcpServers: Record<string, ClaudeMCPServer>;
}

export const findAndUpdateClaudeConfig = async (options?: CliOptions) => {
  const resolvedConfigPath = await getClaudeConfigPath();
  await updateClaudeConfig(resolvedConfigPath, options);
  cliOutput(
    `\n${chalk.green('✓')} Auth0 MCP server configured. ${chalk.yellow('Restart Claude Desktop')} to apply changes.\n`
  );
};

export async function getClaudeConfigPath(): Promise<string> {
  let configDir: string;

  switch (process.platform) {
    case 'darwin': // macOS
      configDir = path.join(os.homedir(), 'Library', 'Application Support', 'Claude');
      break;
    case 'win32': {
      // Windows
      const APPDATA = process.env.APPDATA;
      if (!APPDATA) {
        throw new Error('APPDATA environment variable not set');
      }
      configDir = path.join(APPDATA, 'Claude');
      break;
    }
    case 'linux': // Linux
      configDir = path.join(os.homedir(), '.config', 'Claude');
      break;
    default:
      throw new Error(`Unsupported operating system: ${process.platform}`);
  }

  try {
    await fs.promises.mkdir(configDir, { recursive: true });
  } catch (err) {
    throw new Error(`Failed to create config directory: ${(err as Error).message}`);
  }
  return path.join(configDir, 'claude_desktop_config.json');
}

async function updateClaudeConfig(configPath: string, options?: CliOptions) {
  let config: ClaudeDesktopConfig = { mcpServers: {} };
  if (fs.existsSync(configPath)) {
    try {
      const configData = fs.readFileSync(configPath, 'utf-8');
      config = JSON.parse(configData);
    } catch (error) {
      logError(`Error reading config file: ${(error as Error).message}`);
    }
  }

  const tools = options?.tools && options.tools.length > 0 ? options.tools.join(',') : '*';
  config.mcpServers['auth0'] = {
    command: 'npx',
    args: ['-y', '@auth0/auth0-mcp-server', 'run', `--tools=${tools}`],
    capabilities: ['tools'],
    env: {
      DEBUG: 'auth0-mcp',
    },
  };

  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    log(`Updated Claude Desktop config file at: ${configPath}`);
  } catch (error) {
    logError(`Error writing config file: ${(error as Error).message}`);
  }
}
