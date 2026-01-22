# Git Hooks

This directory contains git hooks for SamSyn that run automatically during git operations.

## Setup

Enable the hooks by running this command once:

```bash
git config core.hooksPath .githooks
```

## Pre-Commit Hook

The `pre-commit` hook runs automatically before each commit and:

1. **Backend (Python files)**:
   - Runs `ruff check --fix` to check and auto-fix linting issues
   - Runs `ruff format` to format code
   - Auto-stages fixed files

2. **Frontend (JS/TS/CSS files)**:
   - Runs `npm run check` (Biome) to lint and format
   - Auto-stages fixed files

3. **Secret Scanning** (if Gitleaks installed):
   - Scans staged files for accidentally committed secrets
   - Blocks commit if secrets are detected
