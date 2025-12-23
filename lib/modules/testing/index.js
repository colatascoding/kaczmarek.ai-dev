/**
 * Testing module - Actions for running and managing tests
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

module.exports = {
  name: "testing",
  version: "1.0.0",
  description: "Actions for running tests and managing test suites",
  actions: {
    /**
     * Run test suite
     */
    "run-tests": async (inputs, context) => {
      const { cwd = process.cwd(), testCommand = null, timeout = 60000 } = inputs;
      const { logger } = context;

      logger.info("Running tests...");

      // Try to detect test command
      let command = testCommand;
      if (!command) {
        // Check package.json for test script
        const packageJsonPath = path.join(cwd, "package.json");
        if (fs.existsSync(packageJsonPath)) {
          try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
            if (packageJson.scripts && packageJson.scripts.test) {
              command = `npm test`;
            }
          } catch (e) {
            // Ignore
          }
        }

        // Fallback to common commands
        if (!command) {
          const commonCommands = ["npm test", "npm run test", "yarn test", "pnpm test"];
          for (const cmd of commonCommands) {
            try {
              execSync(`which ${cmd.split(" ")[0]}`, { stdio: "ignore" });
              command = cmd;
              break;
            } catch (e) {
              continue;
            }
          }
        }
      }

      if (!command) {
        return {
          success: false,
          error: "No test command found. Please specify testCommand or ensure package.json has a test script."
        };
      }

      try {
        const startTime = Date.now();
        const output = execSync(command, {
          cwd,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          timeout
        });

        const duration = Date.now() - startTime;

        return {
          success: true,
          passed: true,
          command,
          output,
          duration,
          exitCode: 0
        };
      } catch (error) {
        return {
          success: false,
          passed: false,
          command,
          output: error.stdout || error.stderr || error.message,
          exitCode: error.status || 1,
          error: error.message
        };
      }
    },

    /**
     * Check test coverage
     */
    "check-coverage": async (inputs, context) => {
      const { cwd = process.cwd(), threshold = 80 } = inputs;
      const { logger } = context;

      logger.info("Checking test coverage...");

      // Try coverage commands
      const coverageCommands = [
        "npm run test:coverage",
        "npm run coverage",
        "npm test -- --coverage",
        "yarn test:coverage"
      ];

      for (const cmd of coverageCommands) {
        try {
          const output = execSync(cmd, {
            cwd,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
            timeout: 120000
          });

          // Parse coverage (basic - would need actual coverage tool parsing)
          const coverageMatch = output.match(/(\d+(?:\.\d+)?)%/);
          const coverage = coverageMatch ? parseFloat(coverageMatch[1]) : null;

          return {
            success: true,
            command: cmd,
            output,
            coverage,
            meetsThreshold: coverage !== null && coverage >= threshold,
            threshold
          };
        } catch (e) {
          continue;
        }
      }

      return {
        success: false,
        error: "No coverage command found or coverage check failed"
      };
    },

    /**
     * Run tests in watch mode (for development)
     */
    "watch-tests": async (inputs, context) => {
      const { cwd = process.cwd() } = inputs;
      const { logger } = context;

      logger.info("Starting test watch mode...");

      // This would typically run in background
      // For now, just return instructions
      return {
        success: true,
        message: "Run 'npm test -- --watch' or similar command to start test watch mode",
        command: "npm test -- --watch"
      };
    }
  }
};


