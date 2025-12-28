# Test Fixes Required

## Issue
Jest is missing the `@jest/test-sequencer` dependency, which is required for Jest 29.7.0.

## Solution
Run the following command to install the missing dependency:

```bash
npm install
```

This will install `@jest/test-sequencer` which has been added to `devDependencies`.

## Alternative
If `npm install` fails due to permissions, you can install just the missing package:

```bash
npm install --save-dev @jest/test-sequencer@^29.7.0
```

## After Installation
Once installed, you can run:

```bash
npm run test:all:ci
```

This will:
1. Run Jest unit tests with CI-friendly settings
2. Run Playwright E2E tests with list reporter


