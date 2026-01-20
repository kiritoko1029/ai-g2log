# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`g2log` (AI-Git 用户日报生成工具) is a Node.js CLI tool that retrieves Git commit records for specified users within a time range and automatically generates work summaries using AI. It can be run via `npx` without installation or installed globally.

## Common Commands

### Installation and Setup
```bash
# Global installation
npm install -g g2log

# Run via npx (no installation needed)
npx g2log [options]

# Direct execution
node git-user-log.js

# Local testing (before publishing)
npm pack && npx -p ./g2log-x.y.z.tgz g2log --help
```

### Configuration Management
```bash
# Start interactive configuration wizard
g2log --config

# Set API key for AI summarization
g2log --set-api-key="YOUR_API_KEY"

# Set AI model and provider
g2log --set-ai-model="deepseek-chat"
g2log --set-api-provider="deepseek"  # or "openai"
g2log --set-api-url="https://api.deepseek.com"

# Set default author name
g2log --set-default-author="作者名"

# Add repository configuration
g2log --add-repo="别名" --path="/path/to/repo"

# List/remove repositories
g2log --list-repos
g2log --remove-repo="别名"

# Fix configuration file format issues
g2log --fix-config

# Uninstall (remove config file)
g2log --uninstall
```

### Running the Tool
```bash
# Generate daily summary using defaults
g2log

# Specify time range
g2log --since="2023-01-01" --until="2023-12-31"

# Use local repository only
g2log --local

# Save output to file
g2log --output="today-summary.md"

# Query last N days
g2log --days=7
```

### Publishing
```bash
# Update version and publish
npm version patch  # or minor/major
npm publish

# Test locally before publishing
npm pack
npx -p ./g2log-x.y.z.tgz g2log --help
```

## Architecture

### Entry Point and Core Structure

- **`git-user-log.js`** - Single-file architecture (~2130 lines)
  - All functionality is inline in this executable script
  - Uses ES modules via dynamic `import()` for the `ora` spinner library
  - No build process, transpilation, or bundling required
  - Executable shebang: `#!/usr/bin/env node`

- **`install.js`** - Post-install script that displays setup instructions
  - Shows quick start guide after successful installation
  - Runs automatically via `postinstall` in package.json

### Key Architectural Components

#### 1. Configuration System (`CONFIG_PATH = ~/.git-user-log-config.json`)

**Core Functions:**
- `loadConfig()` - Merges user config with `DEFAULT_CONFIG`, handles migrations
- `saveConfig(config)` - Persists configuration to disk
- `checkConfig()` - Validates configuration completeness

**Migration Support:**
- Legacy field migrations (e.g., `deepseek_api_key` → `api_key`)
- Backward compatibility with old config formats

**Configuration Structure:**
```javascript
{
  api_key: "sk-...",
  default_author: "用户名",
  default_since: "today",
  default_until: "today",
  model: "deepseek-chat",
  api_base_url: "https://api.deepseek.com",
  api_provider: "deepseek",  // "deepseek" or "openai"
  repositories: {
    "别名": "/path/to/repo"
  },
  prompt_template: "自定义提示词模板..."
}
```

#### 2. CLI Argument Parsing

**Custom `parseArgs()` Function:**
- Handles `--key=value` and `--key value` formats
- Boolean flags: `--local`, `--no-color`, `--debug`
- Special aliases: `--save` → `--output`
- No external dependencies (custom implementation)

**NPX Detection:**
```javascript
const isRunningWithNpx = process.env.npm_lifecycle_event === 'npx' ||
                        process.env.npm_execpath?.includes('npx') ||
                        process.env.npm_command === 'exec';
```

#### 3. Git Log Retrieval

**Single Repository Mode:**
- Uses `git -C "{path}" log` with author/time filters
- Format: `alias | date | hash | message` or simple mode without hash

**Multi-Repository Mode:**
- `getLogsFromMultipleRepos()` aggregates from all configured repos
- Adds repository prefix to each log entry
- Combines all logs before sending to AI

**Repository Discovery:**
- `findGitRepository(startPath)` - Searches upward for .git directory
- `findGitRepositories(searchPath, maxDepth)` - Recursive repository discovery
- Validates Git repositories before adding to config

#### 4. AI Integration

**Main Orchestrator:**
- `summarizeWithAI()` - Entry point for AI summarization

**API Providers:**
- `getOpenAIResponse()` - OpenAI API with streaming support
- `getDeepSeekResponse()` - DeepSeek API with streaming support

**Streaming Implementation:**
Both providers use Server-Sent Events (SSE) parsing:
- Buffer incomplete messages
- Split by `\n\n` delimiter
- Parse `data: {json}` lines
- Handle `[DONE]` termination signal
- Real-time output to console

**Prompt Template System:**
Variable substitution supports multiple formats:
- `{{GIT_LOGS}}` and `{log_content}` for git logs
- `{{AUTHOR}}` and `{author}` for author name
- `{{SINCE}}`/`{{UNTIL}}` and `{since}`/`{until}` for dates

#### 5. Interactive Configuration Wizard

**`setupConfigInteractive()` Function:**
- Step-by-step CLI prompts using Node.js `readline` module
- Validates Git repository paths before adding
- Guides users through initial setup
- Supports auto-discovery of Git repositories

#### 6. Color Output System

**Custom ANSI Implementation:**
- Pre-checks for TTY and `--no-color` flag
- `colorize()` function wraps text with ANSI codes
- Supports pipe detection: forces color with `--color` flag
- Custom `createSpinner()` with fallback when `ora` fails to load

**Color Detection Logic:**
```javascript
const isPiped = !process.stdout.isTTY;
const shouldUseColor = (isPiped ? forceColor : true) && !disableColor;
```

## Development Notes

### Dynamic Import Pattern

The `ora` module is loaded dynamically to handle potential import failures:
```javascript
let ora;
import('ora').then(module => { ora = module.default; }).catch(err => {
  console.error('无法加载ora模块:', err);
});
```

The `createSpinner()` function checks if `ora` is loaded and provides a text-based fallback.

### Streaming Response Handling

**SSE Parsing Pattern:**
```javascript
let buffer = '';
for (const chunk of response.body) {
  buffer += chunk.toString();
  const lines = buffer.split('\n\n');
  buffer = lines.pop(); // Keep incomplete message in buffer

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') return;
      // Parse JSON and handle
    }
  }
}
```

### Main Execution Flow

1. **Parse CLI arguments** - `parseArgs()`
2. **Route to handler** based on flags (config, help, version, etc.)
3. **Load/validate configuration** - `checkConfig()` → `loadConfig()`
4. **Retrieve Git logs** - `getGitLogs()` → `getLogsFromMultipleRepos()`
5. **AI summarization** (optional) - `summarizeWithAI()`
6. **Output** - Console or file (`--output`)

### Error Handling Patterns

- Git command failures are caught and reported with context
- API errors display meaningful messages (e.g., missing API key)
- Configuration file corruption can be fixed with `--fix-config`
- Spinner states provide visual feedback for long operations

## Version and Publishing

- **Version location:** `package.json` (currently 1.6.0)
- **Publishing workflow:** See `PUBLISH.md`
- **Postinstall script:** Sets executable permissions on `git-user-log.js`
- **NPX support:** First-class citizen - tool is optimized for npx usage

## Dependencies

- **ora** - CLI spinner for loading states (dynamically imported)
- **No build tools** - Pure Node.js with standard library modules
- **Node.js requirement:** >=16.0.0

## Code Organization

The single-file architecture is organized into these sections (in order):
1. Imports and module loading
2. NPX detection and color setup
3. Configuration constants and defaults
4. Helper functions (colorize, spinner)
5. Configuration management functions
6. Git repository discovery functions
7. Git log retrieval functions
8. AI integration functions
9. Interactive configuration wizard
10. CLI argument parsing
11. Main execution flow (`getGitLogs()`)
12. Legacy/compatibility functions (some are duplicates, can be cleaned up)
