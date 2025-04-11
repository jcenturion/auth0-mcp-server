# Changelog

All notable changes to the Auth0 MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Added `--tools` CLI option to filter available tools when starting the server
- Added required `--tools` CLI option to both `init` and `run` commands to ensure explicit tool specification
- Support for selective tool enabling using comma-separated list of tools or glob pattern(s)
- Support for glob patterns like `auth0_*_applications` to enable groups of related tools

## [0.1.0-beta.1] - 2025-04-04

### Added

- Beta release of Auth0 MCP Server
- MCP server implementation for Auth0 management operations
- Support for Claude Desktop and other MCP clients integration
- Auth0 management operations through natural language
- Device authorization flow for secure authentication
- Tools for managing applications, resource servers, actions, logs, and forms

[Unreleased]: https://github.com/auth0/auth0-mcp-server/compare/v0.1.0-beta.1...HEAD
[0.1.0-beta.1]: https://github.com/auth0/auth0-mcp-server/releases/tag/v0.1.0-beta.1
