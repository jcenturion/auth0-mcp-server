import { describe, it, expect, vi, assert } from 'vitest';
import { parseArgs, filterTools, isToolAllowed } from '../../src/utils/cli-args';
import { Tool } from '../../src/utils/types.js';

// Mock external dependencies
vi.mock('../../src/utils/logger.js', () => ({
  log: vi.fn(),
  logError: vi.fn(),
}));

describe('CLI Argument Utilities', () => {
  // Common test fixtures
  const testTools: Tool[] = [
    { name: 'auth0_list_applications', description: 'List all applications' },
    { name: 'auth0_get_application', description: 'Get application details' },
    { name: 'auth0_create_application', description: 'Create application' },
    { name: 'auth0_update_application', description: 'Update application' },
    { name: 'auth0_list_resource_servers', description: 'List resource servers' },
    { name: 'auth0_get_resource_server', description: 'Get resource server details' },
  ];

  describe('parseArgs function', () => {
    describe('Basic argument parsing', () => {
      it('should return an empty options object when no arguments are provided', () => {
        const result = parseArgs([], testTools);
        expect(result).toEqual({});
      });

      it("should ignore arguments that don't start with --", () => {
        const result = parseArgs(['not-an-option', 'another-non-option'], testTools);
        expect(result).toEqual({});
      });

      it('should extract tools from a single command line argument', () => {
        const result = parseArgs(['--tools=auth0_list_applications'], testTools);

        expect(result).toHaveProperty('tools');
        expect(result.tools).toContain('auth0_list_applications');
        expect(result.tools?.length).toBe(1);
      });

      it('should split comma-separated tool names into an array', () => {
        const result = parseArgs(
          ['--tools=auth0_list_applications,auth0_get_application'],
          testTools
        );

        expect(result.tools).toContain('auth0_list_applications');
        expect(result.tools).toContain('auth0_get_application');
        expect(result.tools?.length).toBe(2);
      });

      it('should reject empty tool string values', () => {
        expect(() => parseArgs(['--tools='], testTools)).toThrow(/Invalid tool:/);
      });

      it('should trim whitespace from tool names in arguments', () => {
        const result = parseArgs(
          ['--tools= auth0_list_applications , auth0_get_application '],
          testTools
        );

        // Verify whitespace is properly trimmed
        expect(result.tools).toEqual(['auth0_list_applications', 'auth0_get_application']);
      });
    });

    describe('Argument validation', () => {
      it('should reject unknown arguments with a specific error message', () => {
        expect(() => parseArgs(['--unknown=value'], testTools)).toThrow(
          /Invalid argument: unknown/
        );

        // Verify error message includes guidance about accepted arguments
        expect(() => parseArgs(['--unknown=value'], testTools)).toThrow(/Accepted arguments are/);
      });

      it("should throw an error if a tool name doesn't exist", () => {
        expect(() => parseArgs(['--tools=nonexistent_tool'], testTools)).toThrow(
          /Invalid tool: nonexistent_tool/
        );
      });

      it('should list valid tools in the error message for invalid tool names', () => {
        try {
          parseArgs(['--tools=nonexistent_tool'], testTools);
          assert.fail('Expected an error to be thrown');
        } catch (error: any) {
          // Error should include available tool names for user guidance
          expect(error.message).toContain('auth0_list_applications');
          expect(error.message).toContain('auth0_get_application');
        }
      });

      it('should handle missing value in argument', () => {
        expect(() => parseArgs(['--tools'], testTools)).toThrow(/Invalid argument format/);
      });

      it('should handle multiple CLI arguments appropriately', () => {
        // Currently the parser only supports --tools, so other options should error
        expect(() =>
          parseArgs(['--tools=auth0_list_applications', '--future-option=y'], testTools)
        ).toThrow(/Invalid argument/);
      });
    });

    describe('Special values handling', () => {
      it('should accept "*" as a valid tool selector', () => {
        const result = parseArgs(['--tools=*'], testTools);

        expect(result).toHaveProperty('tools');
        expect(result.tools).toContain('*');
      });

      it('should allow "*" combined with other tool names', () => {
        const result = parseArgs(['--tools=*,auth0_get_application'], testTools);

        expect(result.tools).toContain('*');
        expect(result.tools).toContain('auth0_get_application');
      });
    });

    describe('Glob pattern handling', () => {
      it('should accept glob patterns matching at least one tool', () => {
        const result = parseArgs(['--tools=auth0_*_application'], testTools);
        expect(result.tools?.[0]).toBe('auth0_*_application');
      });

      it("should reject glob patterns that don't match any tools", () => {
        expect(() => parseArgs(['--tools=xyz_*_tool'], testTools)).toThrow(
          /No tools match the pattern/
        );
      });

      it('should handle asterisk wildcard in patterns', () => {
        const result = parseArgs(['--tools=auth0_*'], testTools);
        expect(result.tools?.[0]).toBe('auth0_*');
      });

      it('should handle question mark wildcard in patterns', () => {
        const result = parseArgs(['--tools=auth0_?et_application'], testTools);
        expect(result.tools?.[0]).toBe('auth0_?et_application');
      });

      it('should handle longer tool names correctly', () => {
        // Test with a longer but valid tool name
        const longName = 'auth0_long_name_application';
        const longTool = { name: longName, description: 'Longer name' };
        const tools = [...testTools, longTool];

        const result = parseArgs([`--tools=${longName}`], tools);
        expect(result.tools).toContain(longName);
      });
    });

    describe('Case sensitivity handling', () => {
      it('should treat tool names as case sensitive', () => {
        expect(() => parseArgs(['--tools=AUTH0_LIST_APPLICATIONS'], testTools)).toThrow(
          /Invalid tool/
        );
      });
    });
  });

  describe('filterTools function', () => {
    it('should return all tools when no filtering options are provided', () => {
      const result = filterTools(testTools);
      expect(result).toEqual(testTools);
    });

    it('should return all tools when options.tools is undefined', () => {
      const result = filterTools(testTools, {});
      expect(result).toEqual(testTools);
    });

    it('should return all tools when options.tools is empty', () => {
      const result = filterTools(testTools, { tools: [] });
      expect(result).toEqual(testTools);
    });

    it('should return all tools when the special "*" selector is specified', () => {
      const result = filterTools(testTools, { tools: ['*'] });
      expect(result).toEqual(testTools);
    });

    it('should filter tools by exact name match', () => {
      const result = filterTools(testTools, { tools: ['auth0_list_applications'] });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('auth0_list_applications');
    });

    it('should filter tools by multiple specific names', () => {
      const result = filterTools(testTools, {
        tools: ['auth0_list_applications', 'auth0_get_application'],
      });

      expect(result).toHaveLength(2);
      expect(result.map((t) => t.name)).toContain('auth0_list_applications');
      expect(result.map((t) => t.name)).toContain('auth0_get_application');
    });

    it('should filter tools by glob pattern', () => {
      const result = filterTools(testTools, { tools: ['auth0_*_application'] });

      expect(result.length).toBeGreaterThan(0);
      expect(
        result.every((t) => t.name.startsWith('auth0_') && t.name.endsWith('_application'))
      ).toBe(true);
    });

    it('should handle multiple glob patterns correctly', () => {
      const result = filterTools(testTools, {
        tools: ['auth0_get_*', '*_resource_*'],
      });

      // Verify results contain matches for both patterns
      const hasGetTools = result.some((t) => t.name.startsWith('auth0_get_'));
      const hasResourceTools = result.some((t) => t.name.includes('_resource_'));

      expect(hasGetTools).toBe(true);
      expect(hasResourceTools).toBe(true);
    });

    it('should handle tools with whitespace in names', () => {
      const toolWithSpace = {
        name: 'tool with space',
        description: 'Test tool',
      };

      const result = filterTools([toolWithSpace], { tools: ['tool with space'] });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('tool with space');
    });

    it('should perform case-sensitive filtering', () => {
      const result = filterTools(testTools, { tools: ['AUTH0_LIST_APPLICATIONS'] });
      expect(result).toHaveLength(0); // Should not match due to case difference
    });
  });

  describe('isToolAllowed function', () => {
    it('should allow all tools when no options are provided', () => {
      expect(isToolAllowed('auth0_list_applications')).toBe(true);
    });

    it('should allow all tools when options.tools is undefined', () => {
      expect(isToolAllowed('auth0_list_applications', {})).toBe(true);
    });

    it('should allow all tools when options.tools is empty', () => {
      expect(isToolAllowed('auth0_list_applications', { tools: [] })).toBe(true);
    });

    it('should allow any tool when the special "*" selector is specified', () => {
      expect(
        isToolAllowed('auth0_list_applications', {
          tools: ['*'],
        })
      ).toBe(true);
    });

    it('should return true for exact name matches', () => {
      expect(
        isToolAllowed('auth0_list_applications', {
          tools: ['auth0_list_applications'],
        })
      ).toBe(true);
    });

    it('should return false for non-matching names', () => {
      expect(
        isToolAllowed('auth0_list_applications', {
          tools: ['auth0_get_application'],
        })
      ).toBe(false);
    });

    it('should return true if tool matches a glob pattern', () => {
      expect(
        isToolAllowed('auth0_list_applications', {
          tools: ['auth0_*_applications'],
        })
      ).toBe(true);
    });

    it('should return true if tool matches any pattern in the array', () => {
      expect(
        isToolAllowed('auth0_list_applications', {
          tools: ['something_else', 'auth0_list_*'],
        })
      ).toBe(true);
    });

    it('should handle malformed glob patterns gracefully without throwing', () => {
      // Should not throw with an invalid pattern
      expect(() => {
        isToolAllowed('auth0_list_applications', {
          tools: ['auth0_['], // Invalid regex character in pattern
        });
      }).not.toThrow();

      // Should not match with an invalid pattern
      expect(
        isToolAllowed('auth0_list_applications', {
          tools: ['auth0_['],
        })
      ).toBe(false);
    });

    it('should perform case-sensitive matching', () => {
      expect(
        isToolAllowed('AUTH0_LIST_APPLICATIONS', {
          tools: ['auth0_list_applications'],
        })
      ).toBe(false);
    });

    it('should handle whitespace in tool names and patterns', () => {
      expect(
        isToolAllowed('tool with spaces', {
          tools: ['tool with spaces'],
        })
      ).toBe(true);
    });
  });
});
