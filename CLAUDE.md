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
```

### Configuration Management
```bash
# Start interactive configuration wizard
g2log --config

# Set API key for AI summarization
g2log --set-api-key="YOUR_API_KEY"

# Set default author name
g2log --set-default-author="作者名"

# Add repository configuration
g2log --add-repo="别名" --path="/path/to/repo"

# List configured repositories
g2log --list-repos

# Fix configuration file format issues
g2log --fix-config
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
```

## Architecture

### Entry Point and Core Structure

- **`git-user-log.js`** - Main CLI entry point (executable, ~1940 lines)
  - Single-file architecture with all functionality inline
  - Uses ES modules via dynamic `import()` for the `ora` spinner library
  - No build process or transpilation required

### Key Components

1. **Configuration System** (`CONFIG_PATH = ~/.git-user-log-config.json`)
   - `loadConfig()` - Merges user config with `DEFAULT_CONFIG`
   - `saveConfig()` - Persists configuration
   - Handles legacy field migrations (e.g., `deepseek_api_key` → `api_key`)
   - Supports prompt template customization with variable substitution

2. **Git Log Retrieval**
   - Single repository: Uses `git -C "{path}" log` with author/time filters
   - Multi-repository: `getLogsFromMultipleRepos()` aggregates from all configured repos
   - Format: `alias | date | hash | message` or simple mode without hash

3. **AI Integration**
   - `summarizeWithAI()` - Main orchestrator
   - `getOpenAIResponse()` - OpenAI API with streaming support
   - `getDeepSeekResponse()` - DeepSeek API with streaming support
   - Both use Server-Sent Events (SSE) for real-time output streaming

4. **Interactive Configuration Wizard**
   - `setupConfigInteractive()` - Step-by-step CLI prompts
   - Uses Node.js `readline` module for user input
   - Validates Git repository paths before adding

### Configuration File Structure

```json
{
  "api_key": "sk-...",
  "default_author": "用户名",
  "default_since": "today",
  "default_until": "today",
  "model": "deepseek-chat",
  "api_base_url": "https://api.deepseek.com",
  "api_provider": "deepseek",
  "repositories": {
    "别名": "/path/to/repo"
  },
  "prompt_template": "自定义提示词模板，支持 {{GIT_LOGS}} 等变量"
}
```

### CLI Argument Parsing

Custom `parseArgs()` function handles:
- `--key=value` format
- `--key value` format
- Boolean flags like `--local`, `--no-color`
- Special handling for `--save` as alias for `--output`

### Color Output System

Custom ANSI color implementation:
- Pre-checks for TTY and `--no-color` flag
- `colorize()` function wraps text with ANSI codes
- Custom `createSpinner()` with fallback when `ora` fails to load

## Development Notes

### Dynamic Import Pattern

The `ora` module is loaded dynamically to handle potential import failures:
```javascript
let ora;
import('ora').then(module => { ora = module.default; }).catch(...);
```
The spinner function checks if `ora` is loaded and provides a fallback.

### Streaming Response Handling

Both `getOpenAIResponse()` and `getDeepSeekResponse()` implement SSE parsing:
- Buffer incomplete messages
- Split by `\n\n` delimiter
- Parse `data: {json}` lines
- Handle `[DONE]` termination signal

### Variable Substitution in Prompts

The `prompt_template` supports multiple variable formats for compatibility:
- `{{GIT_LOGS}}` and `{log_content}` for git logs
- `{{AUTHOR}}` and `{author}` for author name
- `{{SINCE}}`/`{{UNTIL}}` and `{since}`/`{until}` for dates

### NPX Detection

The tool detects NPX execution via environment variables:
```javascript
const isRunningWithNpx = process.env.npm_lifecycle_event === 'npx' ||
                        process.env.npm_execpath?.includes('npx') ||
                        process.env.npm_command === 'exec';
```

## Version and Publishing

- Version is defined in `package.json` (currently 1.4.4)
- See `PUBLISH.md` for publishing workflow to npm
- Postinstall script sets executable permissions on `git-user-log.js`

## Dependencies

- **ora** - CLI spinner for loading states (dynamically imported)
- **No build tools** - Pure Node.js with standard library modules
