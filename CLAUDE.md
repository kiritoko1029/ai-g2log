# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`g2log` (AI-Git 用户日报生成工具) is a Node.js CLI tool that retrieves Git commit records for specified users within a time range and automatically generates work summaries using AI. It can be run via `npx` without installation or installed globally.

**Key Features:**
- Multi-repository support with automatic aggregation
- Multiple AI provider support (DeepSeek, OpenAI, Zhipu AI, Moonshot)
- JSONC configuration format with schema validation
- Streaming AI responses for real-time feedback
- Automatic configuration migration from legacy formats
- HTML report generation with browser preview

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

# Profile management (v1.7.0+)
g2log --set-profile="zhipu"              # Switch AI provider profile
g2log --list-profiles                     # List all configured profiles

# Set API key for current profile
g2log --set-api-key="YOUR_API_KEY"

# Set AI model and provider (legacy, use profiles instead)
g2log --set-ai-model="deepseek-chat"
g2log --set-api-url="https://api.deepseek.com"

# Zhipu AI specific settings
g2log --enable-thinking                   # Enable deep thinking mode (Zhipu only)
g2log --disable-thinking                  # Disable deep thinking mode

# Set default author name (optional, leave empty for all authors)
g2log --set-default-author="作者名"

# Repository management
g2log --add-repo="别名" --path="/path/to/repo"
g2log --remove-repo="别名"
g2log --list-repos
g2log --find                              # Auto-discover and add repositories

# Prompt template customization
g2log --set-prompt-template="template.txt"
g2log --reset-prompt-template

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

# Query last N days
g2log --days=7

# Use local repository only (skip configured repos)
g2log --local

# Save output to file
g2log --output="today-summary.md"

# Generate HTML report and open in browser
g2log --html                              # Save HTML file
g2log --open                              # Save and open in browser

# Debug and development
g2log --debug                             # Show debug information
g2log --show-prompt                       # Display full prompt sent to AI
g2log --no-color                          # Disable colored output
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

- **`git-user-log.js`** - Single-file architecture (~3086 lines)
  - All functionality is inline in this executable script
  - Uses ES modules via dynamic `import()` for the `ora` spinner library
  - No build process, transpilation, or bundling required
  - Executable shebang: `#!/usr/bin/env node`

- **`install.js`** - Post-install script that displays setup instructions
  - Shows quick start guide after successful installation
  - Runs automatically via `postinstall` in package.json

- **`config.jsonc.template`** - Configuration template with comprehensive comments
  - Demonstrates all available configuration options
  - Includes examples for all supported AI providers
  - Used as reference for new installations

- **`schema.json`** - JSON Schema for configuration validation
  - Provides VS Code IntelliSense support
  - Automatically copied to `~/.g2log/schema.json` on first run
  - Validates configuration structure and types

### Key Architectural Components

#### 1. Configuration System (v1.7.0+: `~/.g2log/config.jsonc`)

**Core Functions:**
- `loadConfig()` - Merges user config with `DEFAULT_CONFIG`, handles migrations
- `saveConfig(config)` - Persists configuration to disk with JSONC formatting
- `checkConfig()` - Validates configuration completeness
- `parseJSONC(content)` - Custom JSONC parser (supports comments and trailing commas)
- `stringifyJSONC(obj)` - Formats config as JSONC with proper indentation
- `migrateToJSONC(oldPath, newPath)` - Automatic migration from legacy formats
- `copySchemaFile()` - Copies schema.json to config directory for VS Code support

**Migration Support:**
- Automatic migration from `~/.git-user-log-config.json` to `~/.g2log/config.jsonc`
- Legacy field migrations (e.g., `deepseek_api_key` → profiles structure)
- Backward compatibility with old config formats
- Preserves user data during migration

**Configuration Structure (v1.7.0+):**
```javascript
{
  "$schema": "./schema.json",           // VS Code IntelliSense support
  default_author: "用户名",              // Optional, empty = all authors
  default_since: "7 days ago",
  default_until: "today",
  current_profile: "zhipu",             // Active AI provider profile
  profiles: {
    deepseek: {
      api_key: "sk-...",
      api_base_url: "https://api.deepseek.com",
      model: "deepseek-chat",
      temperature: 0.5,                 // Optional
      max_tokens: 20480,                // Optional
      enable_thinking: false
    },
    zhipu: {
      api_key: "...",
      api_base_url: "https://open.bigmodel.cn/api/paas/v4",
      model: "glm-4.7",
      stream: true,                     // Zhipu-specific
      enable_thinking: true             // Deep thinking mode
    },
    openai: { /* ... */ },
    moonshot: { /* ... */ }
  },
  repositories: {
    "别名": "/path/to/repo"
  },
  prompt_template: "自定义提示词模板..."
}
```

**Profile Management:**
- `getCurrentProfile()` - Returns active profile configuration
- `setCurrentProfile(name)` - Switches between AI providers
- `listProfiles()` - Lists all configured profiles
- `updateProfileSetting(key, value)` - Updates current profile settings

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
  - Loads current profile configuration
  - Builds prompt from template with variable substitution
  - Routes to appropriate provider function
  - Handles spinner state management

**API Providers (git-user-log.js:1489-2063):**
- `getOpenAIResponse()` - OpenAI-compatible API with streaming
  - Supports OpenAI and Moonshot providers
  - Standard OpenAI API format
  - Streaming via SSE (Server-Sent Events)

- `getZhipuResponse()` - Zhipu AI (智谱AI) with advanced features
  - Supports `stream: true` for real-time output
  - `enable_thinking: true` for deep reasoning mode
  - Special handling for thinking process display
  - Custom SSE parsing for Zhipu format

- `getDeepSeekResponse()` - DeepSeek API with streaming
  - Similar to OpenAI format
  - Optimized for DeepSeek models
  - SSE streaming support

**Streaming Implementation:**
All providers use Server-Sent Events (SSE) parsing:
```javascript
let buffer = '';
for (const chunk of response.body) {
  buffer += chunk.toString();
  const lines = buffer.split('\n\n');
  buffer = lines.pop(); // Keep incomplete message

  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') return;
      const parsed = JSON.parse(data);
      // Extract and display content
    }
  }
}
```

**Prompt Template System:**
Variable substitution supports multiple formats:
- `{{GIT_LOGS}}` and `{log_content}` for git logs
- `{{AUTHOR}}` and `{author}` for author name
- `{{SINCE}}`/`{{UNTIL}}` and `{since}`/`{until}` for dates
- Template stored in config, customizable via `--set-prompt-template`

**API URL Building:**
- `buildApiUrl(baseUrl, endpoint)` - Constructs full API endpoint
  - Handles trailing slashes
  - Supports custom endpoints
  - Default: `chat/completions`

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

**Markdown Formatting:**
- `formatMarkdown(text)` - Converts Markdown to colored terminal output
  - Headers: Different colors for #, ##, ###, ####
  - Lists: Converts `-`, `*`, `+` to bullet points
  - Bold/Italic: ANSI formatting
  - Code blocks: Syntax highlighting

#### 7. HTML Report Generation

**Core Functions:**
- `textToHtml(text, title)` - Converts plain text to styled HTML
  - Preserves line breaks and formatting
  - Adds CSS styling for readability
  - Responsive design

- `generateHtmlAndSave(content, title, author, since, until)` - Creates HTML file
  - Generates unique filename with timestamp
  - Saves to `~/.g2log/reports/` directory
  - Returns file path for opening

- `generateAndOpenHtml(content, title)` - Generate and open in browser
  - Cross-platform browser opening (macOS, Windows, Linux)
  - Uses `open`, `start`, or `xdg-open` commands

**Usage:**
- `--html` flag: Save HTML report
- `--open` flag: Save and open in browser automatically

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

The main entry point is `getGitLogs()` (git-user-log.js:2507):

1. **Parse CLI arguments** - `parseArgs()`
   - Custom parser handles `--key=value` and `--key value` formats
   - Boolean flags, aliases, and special handling

2. **Route to handler** based on flags
   - Help/version display
   - Configuration commands (--config, --set-*, --add-repo, etc.)
   - Uninstall/fix operations
   - Normal execution flow

3. **Configuration check and wizard**
   - `checkConfig()` validates completeness
   - Interactive wizard for first-time users or missing config
   - Automatic migration from legacy formats

4. **Load configuration** - `loadConfig()`
   - Merges user config with defaults
   - Handles profile selection
   - Validates repository paths

5. **Retrieve Git logs**
   - Local mode: Single repository from current directory
   - Multi-repo mode: `getLogsFromMultipleRepos()` aggregates all configured repos
   - Adds repository prefix to each log entry

6. **AI summarization** - `summarizeWithAI()`
   - Loads current profile (DeepSeek/OpenAI/Zhipu/Moonshot)
   - Builds prompt from template
   - Streams response in real-time
   - Handles thinking mode for Zhipu

7. **Output**
   - Console: Colored output with Markdown formatting
   - File: `--output` saves to specified path
   - HTML: `--html` or `--open` generates browser-viewable report

### Error Handling Patterns

- **Git command failures**: Caught and reported with context (repository path, command)
- **API errors**: Meaningful messages for common issues
  - Missing API key: Prompts user to run `--set-api-key`
  - Invalid profile: Lists available profiles
  - Network errors: Displays HTTP status and error message
- **Configuration issues**:
  - Corruption: `--fix-config` attempts automatic repair
  - Missing fields: Interactive wizard guides setup
  - Invalid JSONC: Parser provides line number and error details
- **Repository errors**:
  - Invalid path: Validates before adding to config
  - Not a Git repo: Checks for .git directory
  - Permission issues: Reports access errors
- **Spinner states**: Visual feedback for long operations
  - Start: Shows operation in progress
  - Success: Green checkmark with completion message
  - Failure: Red X with error details

## Version and Publishing

- **Version location:** `package.json` (currently 1.7.0)
- **Publishing workflow:** See `PUBLISH.md`
- **Postinstall script:** Sets executable permissions on `git-user-log.js` and runs `install.js`
- **NPX support:** First-class citizen - tool is optimized for npx usage
- **Version history:**
  - v1.7.0: Profile-based configuration, Zhipu AI support, thinking mode
  - v1.6.0: JSONC format, schema validation, configuration migration
  - v1.5.x: Legacy JSON format

## Dependencies

- **ora** - CLI spinner for loading states (dynamically imported)
- **No build tools** - Pure Node.js with standard library modules
- **Node.js requirement:** >=16.0.0

## Code Organization

The single-file architecture (~3086 lines) is organized into these sections:

1. **Imports and module loading** (lines 1-25)
   - Node.js built-in modules
   - Dynamic import for `ora` spinner

2. **NPX detection and color setup** (lines 27-70)
   - Environment variable checks
   - TTY detection for color output
   - ANSI color code definitions

3. **Helper functions** (lines 72-393)
   - `colorize()` - ANSI color wrapper
   - `formatMarkdown()` - Markdown to terminal formatting
   - `textToHtml()` - Plain text to HTML conversion
   - `generateHtmlAndSave()` - HTML report generation
   - `parseJSONC()` - JSONC parser
   - `stringifyJSONC()` - JSONC formatter
   - `copySchemaFile()` - Schema file management
   - `migrateToJSONC()` - Configuration migration

4. **Configuration constants and defaults** (lines 315-393)
   - `CONFIG_DIR`, `CONFIG_PATH`, `SCHEMA_PATH`
   - `DEFAULT_CONFIG` with all profiles

5. **Configuration management functions** (lines 523-1132)
   - `loadConfig()` - Load and merge configuration
   - `saveConfig()` - Persist configuration
   - `getCurrentProfile()` - Get active profile
   - `setCurrentProfile()` - Switch profiles
   - `listProfiles()` - List all profiles
   - `updateProfileSetting()` - Update profile settings
   - `setApiKey()`, `setAIModel()`, etc. - Individual setters
   - `addRepository()`, `removeRepository()` - Repository management
   - `fixConfigFile()` - Configuration repair

6. **Git repository discovery** (lines 811-986)
   - `findGitRepository()` - Search upward for .git
   - `findGitRepositories()` - Recursive discovery
   - `findAndAddRepositories()` - Auto-discovery workflow

7. **Interactive configuration wizard** (lines 987-1132)
   - `setupConfigInteractive()` - Step-by-step setup
   - Profile selection
   - Repository configuration
   - API key setup

8. **CLI utilities** (lines 987-1184)
   - `createSpinner()` - Spinner with fallback
   - `showHelp()` - Help text display
   - `showNpxInfo()` - NPX usage information

9. **CLI argument parsing** (lines 1185-1246)
   - `parseArgs()` - Custom argument parser
   - Handles multiple formats and aliases

10. **Git log retrieval** (lines 1248-2137)
    - `getCommitDetails()` - Detailed commit info
    - `getCommitSimpleDetails()` - Simple format
    - `getCommitStats()` - File statistics
    - `getCommitPatch()` - Diff content
    - `formatCommitLine()` - Format output
    - `colorizePatch()` - Colorize diffs
    - `getLogsFromMultipleRepos()` - Multi-repo aggregation

11. **AI integration functions** (lines 1394-2063)
    - `buildApiUrl()` - Construct API endpoints
    - `summarizeWithAI()` - Main orchestrator
    - `getOpenAIResponse()` - OpenAI/Moonshot provider
    - `getZhipuResponse()` - Zhipu AI provider
    - `getDeepSeekResponse()` - DeepSeek provider

12. **Prompt template management** (lines 2139-2177)
    - `setPromptTemplate()` - Update template
    - `resetPromptTemplate()` - Restore default

13. **Configuration validation** (lines 2188-2505)
    - `checkConfig()` - Validate completeness
    - `removeConfigFile()` - Uninstall cleanup

14. **Main execution flow** (lines 2507-3086)
    - `getGitLogs()` - Entry point
    - Command routing
    - Configuration wizard trigger
    - Git log retrieval
    - AI summarization
    - Output handling

## Important Implementation Details

### JSONC Parser Implementation

The tool includes a custom JSONC parser to avoid external dependencies:

```javascript
function parseJSONC(content) {
  let jsonc = content.replace(/\/\/.*$/gm, '');        // Remove single-line comments
  jsonc = jsonc.replace(/\/\*[\s\S]*?\*\//g, '');     // Remove multi-line comments
  jsonc = jsonc.replace(/,\s*([}\]])/g, '$1');        // Remove trailing commas
  return JSON.parse(jsonc);
}
```

**Limitations:**
- Comments inside string values will also be removed
- Avoid using `//` or `/* */` in string values

### Profile-Based Configuration (v1.7.0+)

The configuration system uses profiles to support multiple AI providers:

- **Profile structure**: Each profile contains provider-specific settings
- **Current profile**: `current_profile` field determines active provider
- **Profile switching**: `--set-profile` command changes active provider
- **Backward compatibility**: Legacy configs are automatically migrated

### Multi-Repository Workflow

When multiple repositories are configured:

1. Tool iterates through all repositories in `config.repositories`
2. Executes `git log` for each repository
3. Prefixes each log entry with repository alias
4. Aggregates all logs into single output
5. Sends combined logs to AI for unified summary

**Example output format:**
```
[前端] 2024-01-20 | abc123 | feat: add login page
[后端] 2024-01-20 | def456 | fix: resolve API timeout
```

### Zhipu AI Thinking Mode

Zhipu AI supports a special "thinking mode" that displays reasoning process:

- **Enable**: `enable_thinking: true` in profile or `--enable-thinking` flag
- **Display**: Thinking process shown in dim color during streaming
- **Format**: Special handling for `<think>` tags in response
- **Use case**: Complex analysis requiring step-by-step reasoning

### HTML Report Generation

HTML reports are saved to `~/.g2log/reports/` with timestamp:

- **Filename format**: `git-summary-YYYYMMDD-HHMMSS.html`
- **Styling**: Embedded CSS for readability
- **Metadata**: Includes author, date range, generation time
- **Cross-platform**: Opens in default browser on macOS/Windows/Linux

## Testing and Development

### Local Testing Workflow

```bash
# Test changes without publishing
node git-user-log.js --help

# Test with local config
node git-user-log.js --config

# Test NPX behavior
npm pack
npx -p ./g2log-1.7.0.tgz g2log --help

# Test configuration migration
mv ~/.g2log ~/.g2log.backup
node git-user-log.js  # Should trigger wizard
```

### Common Development Tasks

**Adding a new AI provider:**
1. Add profile to `DEFAULT_CONFIG.profiles`
2. Create provider function (e.g., `getNewProviderResponse()`)
3. Add routing logic in `summarizeWithAI()`
4. Update `config.jsonc.template` with example
5. Update `schema.json` if needed

**Modifying configuration structure:**
1. Update `DEFAULT_CONFIG`
2. Add migration logic in `loadConfig()` if breaking change
3. Update `schema.json` for validation
4. Update `config.jsonc.template` documentation
5. Test migration from old format

**Adding new CLI flags:**
1. Add parsing logic in `parseArgs()`
2. Add handler in `getGitLogs()` main flow
3. Update `showHelp()` text
4. Add to README.md documentation

## Related Documentation

- **README.md** - User-facing documentation and usage guide
- **MIGRATION.md** - Configuration migration guide (v1.5.x → v1.6.0 → v1.7.0)
- **CONFIG.md** - Detailed configuration reference (legacy, see README.md)
- **PUBLISH.md** - Publishing workflow and npm release process
- **config.jsonc.template** - Configuration template with examples
- **schema.json** - JSON Schema for configuration validation
- **.claude/settings.local.json** - Claude Code permissions for this project
