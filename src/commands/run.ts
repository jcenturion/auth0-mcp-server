import { startServer } from '../server.js';
import { log, logError } from '../utils/logger.js';
import * as os from 'os';
import type { CliOptions } from '../utils/cli-args.js';

// Main function to start server
const run = async (options?: CliOptions) => {
  try {
    if (!process.env.HOME) {
      process.env.HOME = os.homedir();
      log(`Set HOME environment variable to ${process.env.HOME}`);
    }

    if (options?.tools) {
      log(`Starting server with selected tools: ${options.tools.join(', ')}`);
    }

    await startServer(options);
  } catch (error) {
    logError('Fatal error starting server:', error);
    process.exit(1);
  }
};

export default run;
