# Setup Instructions

## Quick Setup

### Option 1: Use npm link (Recommended for Development)

This creates a global symlink so you can use `kad` from anywhere:

```bash
cd kaczmarek.ai-dev
npm install
npm link
```

After this, you can use `kad` from any directory:
```bash
kad workflow list
kad init
```

### Option 2: Use Direct Path

Run commands directly with node:
```bash
node ./kaczmarek.ai-dev/bin/kad.js workflow list
node ./kaczmarek.ai-dev/bin/kad.js init
```

### Option 3: Add to PATH (Manual)

Add the bin directory to your PATH in `~/.zshrc` or `~/.bashrc`:

```bash
export PATH="$PATH:/path/to/kaczmarek.ai-dev/bin"
```

Then reload your shell:
```bash
source ~/.zshrc  # or source ~/.bashrc
```

## Install Dependencies

First, install the required dependencies:

```bash
cd kaczmarek.ai-dev
npm install
```

This installs:
- `better-sqlite3` - SQLite database
- `js-yaml` - YAML parser

## Verify Installation

Test that everything works:

```bash
# If using npm link:
kad workflow list

# If using direct path:
node bin/kad.js workflow list
```

You should see the list of available workflows.

## Troubleshooting

### "command not found: kad"

- Use `npm link` to create a symlink
- Or use `node bin/kad.js` directly
- Or add bin directory to PATH

### "Cannot find module 'better-sqlite3'"

Run `npm install` to install dependencies.

### Database errors

The database is created automatically at `.kaczmarek-ai/workflows.db`. Make sure you have write permissions in the project directory.




