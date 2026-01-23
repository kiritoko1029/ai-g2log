# Repository Guidelines

## Project Structure & Module Organization
This repo is a single-file Node.js CLI. `git-user-log.js` contains the full runtime (argument parsing, config, git log retrieval, AI calls). `install.js` is the postinstall helper. Configuration artifacts live in `schema.json` (JSON Schema) and `config.jsonc.template` (example config). Docs are in `README.md`, `CONFIG.md`, `MIGRATION.md`, and `PUBLISH.md`.

## Build, Test, and Development Commands
- `npm install` installs dependencies and runs the postinstall script (sets executable bit and prints setup tips).
- `node git-user-log.js --help` runs the CLI directly from the repo.
- `npm pack` builds the publishable tarball; pair with `npx -p ./g2log-x.y.z.tgz g2log --help` to validate packaging.
- `npm test` currently exits with an error; there is no automated test suite yet.

## Coding Style & Naming Conventions
Use Node.js (>=16) CommonJS style (`require`), 2-space indentation, semicolons, and single quotes. Functions are camelCase, constants are UPPER_SNAKE_CASE, and CLI flags use kebab-case (for example, `--set-api-key`). File names are kebab-case (for example, `git-user-log.js`).

## Testing Guidelines
There is no configured test framework or coverage tooling. If you introduce tests, add a test runner (prefer Node's `node:test` to avoid extra deps), update `npm test`, and name files `*.test.js`. Aim for at least 80% coverage on new or changed logic.

## Commit & Pull Request Guidelines
Commit messages follow Conventional Commits with scope, for example `feat(core): ...` or `fix(git-user-log): ...`. For PRs, keep changes focused, describe behavior changes, include test commands/run notes, and update docs when CLI or config behavior changes. Link related issues when available.

## Security & Configuration Tips
User API keys live in `~/.g2log/config.jsonc`; never commit real credentials. When changing config shape, update both `schema.json` and `config.jsonc.template`.
