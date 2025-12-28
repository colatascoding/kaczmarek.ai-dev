# Test Setup Instructions

## Issue
Jest requires `@jest/test-sequencer` as a dependency, but it's not currently installed in `node_modules`.

## Solution

Run the following command to install all missing dependencies:

```bash
npm install
```

This will install `@jest/test-sequencer@^29.7.0` which has been added to `package.json` devDependencies.

## After Installation

Once dependencies are installed, you can run:

```bash
# Run all tests (Jest + Playwright)
npm run test:all:ci

# Or individually:
npm run test          # Jest unit tests
npm run test:e2e     # Playwright E2E tests
```

## Note

If you encounter permission errors during `npm install`, you may need to:
1. Check file permissions on `node_modules/@jest/test-sequencer`
2. Try running: `sudo npm install` (if on macOS/Linux)
3. Or reinstall node_modules: `rm -rf node_modules && npm install`


