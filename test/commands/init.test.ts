import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import init from '../../src/commands/init.js';
import { requestAuthorization } from '../../src/auth/device-auth-flow';
import { findAndUpdateClaudeConfig } from '../../src/clients/claude';
import { findAndUpdateWindsurfConfig } from '../../src/clients/windsurf';
import { findAndUpdateCursorConfig } from '../../src/clients/cursor';
import { parseArgs } from '../../src/utils/cli-args';
import { log, logError } from '../../src/utils/logger';
import { promptForScopeSelection } from '../../src/utils/cli-utility';
import { TOOLS } from '../../src/tools/index';

// Mock all dependencies
vi.mock('../../src/auth/device-auth-flow');
vi.mock('../../src/clients/claude');
vi.mock('../../src/clients/windsurf');
vi.mock('../../src/clients/cursor');
vi.mock('../../src/utils/cli-args');
vi.mock('../../src/utils/logger');

vi.mock('../../src/utils/cli-utility', () => ({
  promptForScopeSelection: vi.fn().mockResolvedValue([]),
}));

// Mock the scope utilities
vi.mock('../../src/utils/scopes', () => ({
  getAllScopes: () => [
    'read:clients',
    'update:clients',
    'create:clients',
    'read:actions',
    'update:actions',
    'create:actions',
  ],
  DEFAULT_SCOPES: [],
}));

describe('Init Module', () => {
  // Type the mocks for better intellisense and type checking
  const mockedRequestAuth = vi.mocked(requestAuthorization);
  const mockedClaudeConfig = vi.mocked(findAndUpdateClaudeConfig);
  const mockedWindsurfConfig = vi.mocked(findAndUpdateWindsurfConfig);
  const mockedCursorConfig = vi.mocked(findAndUpdateCursorConfig);
  const mockedParseArgs = vi.mocked(parseArgs);
  const mockedLog = vi.mocked(log);
  const mockedLogError = vi.mocked(logError);
  const mockedPromptForScopeSelection = vi.mocked(promptForScopeSelection);

  beforeEach(() => {
    vi.resetAllMocks();

    // Set default mock return values
    mockedParseArgs.mockReturnValue({});
    mockedRequestAuth.mockResolvedValue(undefined);
    mockedClaudeConfig.mockResolvedValue(undefined);
    mockedWindsurfConfig.mockResolvedValue(undefined);
    mockedCursorConfig.mockResolvedValue(undefined);
    mockedPromptForScopeSelection.mockResolvedValue([]);
  });

  it('should report error when tools parameter is missing', async () => {
    // Arrange
    // (using default mocks)

    // Act
    await init([]).catch(() => {
      /* ignore error */
    });

    // Assert
    expect(mockedLog).toHaveBeenCalledWith('Initializing Auth0 MCP server...');
    expect(mockedLogError).toHaveBeenCalledWith(
      "The --tools parameter is required. Example: --tools='auth0_list_*,auth0_get_*'"
    );
  });

  it('should initialize server with default client (Claude) when tools parameter is provided', async () => {
    // Arrange
    const mockOptions = { tools: ['*'] };
    mockedParseArgs.mockReturnValue(mockOptions);

    // Act
    await init(['--tools=*']);

    // Assert
    expect(mockedLog).toHaveBeenCalledWith('Initializing Auth0 MCP server...');
    expect(mockedParseArgs).toHaveBeenCalled();
    expect(mockedPromptForScopeSelection).toHaveBeenCalled();
    expect(mockedRequestAuth).toHaveBeenCalled();
    expect(mockedClaudeConfig).toHaveBeenCalled();
  });

  it('should handle authorization errors', async () => {
    // Arrange
    const mockError = new Error('Authorization failed');
    mockedRequestAuth.mockRejectedValue(mockError);
    mockedParseArgs.mockReturnValue({ tools: ['*'] });

    // Act
    await init(['--tools=*']);

    // Assert
    expect(mockedLog).toHaveBeenCalledWith('Initializing Auth0 MCP server...');
    expect(mockedLogError).toHaveBeenCalledWith('Error initializing server:', mockError);
    expect(mockedRequestAuth).toHaveBeenCalled();
    expect(mockedClaudeConfig).not.toHaveBeenCalled();
  });

  it('should handle client config update errors', async () => {
    // Arrange
    const mockError = new Error('Claude config update failed');
    mockedClaudeConfig.mockRejectedValue(mockError);
    mockedParseArgs.mockReturnValue({ tools: ['*'] });

    // Act
    await init(['--tools=*']);

    // Assert
    expect(mockedLog).toHaveBeenCalledWith('Initializing Auth0 MCP server...');
    expect(mockedLogError).toHaveBeenCalledWith('Error initializing server:', mockError);
    expect(mockedRequestAuth).toHaveBeenCalled();
    expect(mockedClaudeConfig).toHaveBeenCalled();
  });

  it('should pass tool options to client config when specified', async () => {
    // Arrange
    const mockOptions = { tools: ['auth0_list_*', 'auth0_get_*'] };
    mockedParseArgs.mockReturnValue(mockOptions);

    // Act
    await init(['--tools=auth0_list_*,auth0_get_*']);

    // Assert
    expect(mockedLog).toHaveBeenCalledWith(
      'Configuring server with selected tools: auth0_list_*, auth0_get_*'
    );
    expect(mockedClaudeConfig).toHaveBeenCalledWith(mockOptions);
  });

  describe('Client selection', () => {
    it.each([
      ['windsurf', mockedWindsurfConfig],
      ['cursor', mockedCursorConfig],
    ])('should initialize %s client when specified', async (clientName, configMock) => {
      // Arrange
      mockedParseArgs.mockReturnValue({ tools: ['*'] });

      // Act
      await init(['--client', clientName, '--tools=*']);

      // Assert
      expect(configMock).toHaveBeenCalled();
      expect(mockedClaudeConfig).not.toHaveBeenCalled();

      // Verify other client configs weren't called
      const allClientMocks = [mockedClaudeConfig, mockedWindsurfConfig, mockedCursorConfig];
      const otherMocks = allClientMocks.filter((mock) => mock !== configMock);
      otherMocks.forEach((mock) => {
        expect(mock).not.toHaveBeenCalled();
      });
    });

    it('should handle tool filters with client flags', async () => {
      // Arrange
      const mockOptions = { tools: ['auth0_list_applications'] };
      mockedParseArgs.mockReturnValue(mockOptions);

      // Act
      await init(['--client', 'windsurf', '--tools=auth0_list_applications']);

      // Assert
      expect(mockedWindsurfConfig).toHaveBeenCalledWith(mockOptions);
    });
  });

  describe('Scope selection', () => {
    it('should use selected scopes from promptForScopeSelection', async () => {
      // Arrange
      const mockSelectedScopes = ['read:clients', 'read:actions'];
      mockedPromptForScopeSelection.mockResolvedValue(mockSelectedScopes);
      mockedParseArgs.mockReturnValue({ tools: ['*'] });

      // Act
      await init(['--tools=*']);

      // Assert
      expect(mockedPromptForScopeSelection).toHaveBeenCalled();
      expect(mockedRequestAuth).toHaveBeenCalledWith(mockSelectedScopes);
    });

    it('should use provided scopes with --scopes flag and comma separation', async () => {
      // Arrange
      const mockScopes = ['read:clients', 'create:clients'];
      mockedPromptForScopeSelection.mockResolvedValue(mockScopes);
      mockedParseArgs.mockReturnValue({ tools: ['*'] });

      // Act
      await init(['--scopes', 'read:clients,create:clients', '--tools=*']);

      // Assert
      expect(mockedPromptForScopeSelection).toHaveBeenCalled();
      expect(mockedRequestAuth).toHaveBeenCalledWith(mockScopes);
    });

    it('should handle glob patterns with --scopes flag', async () => {
      // Arrange
      mockedPromptForScopeSelection.mockResolvedValue(['read:clients', 'read:actions']);
      mockedParseArgs.mockReturnValue({ tools: ['*'] });

      // Act
      await init(['--scopes', 'read:*', '--tools=*']);

      // Assert
      expect(mockedPromptForScopeSelection).toHaveBeenCalled();
      expect(mockedRequestAuth).toHaveBeenCalledWith(['read:clients', 'read:actions']);
    });
  });
});
