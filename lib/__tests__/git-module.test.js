/**
 * Unit tests for git module
 */

const { describe, test, expect, beforeEach, afterEach } = require("@jest/globals");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execSync } = require("child_process");

describe("Git Module", () => {
  let tempDir;
  let gitModule;

  beforeEach(() => {
    // Create temp directory
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "git-test-"));
    
    // Load git module
    gitModule = require("../modules/git");
  });

  afterEach(() => {
    // Cleanup
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("commit-and-push", () => {
    test("should commit changes when in git repository", async () => {
      // Initialize git repo
      try {
        execSync("git init", { cwd: tempDir, stdio: "ignore" });
        execSync("git config user.name 'Test User'", { cwd: tempDir, stdio: "ignore" });
        execSync("git config user.email 'test@example.com'", { cwd: tempDir, stdio: "ignore" });
      } catch (e) {
        // Git might not be available, skip test
        return;
      }

      // Create a test file
      const testFile = path.join(tempDir, "test.txt");
      fs.writeFileSync(testFile, "test content");

      const result = await gitModule.actions["commit-and-push"]({
        paths: ["test.txt"],
        message: "Test commit",
        cwd: tempDir,
        push: false // Don't push in tests
      }, {
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn()
        }
      });

      expect(result.success).toBe(true);
      expect(result.committed).toBe(true);
      expect(result.pushed).toBe(false);
    });

    test("should return error when not in git repository", async () => {
      const result = await gitModule.actions["commit-and-push"]({
        paths: [],
        message: "Test commit",
        cwd: tempDir,
        push: false
      }, {
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn()
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Not a git repository");
    });

    test("should return success with no changes when nothing to commit", async () => {
      // Initialize git repo
      try {
        execSync("git init", { cwd: tempDir, stdio: "ignore" });
        execSync("git config user.name 'Test User'", { cwd: tempDir, stdio: "ignore" });
        execSync("git config user.email 'test@example.com'", { cwd: tempDir, stdio: "ignore" });
        // Make initial commit
        execSync("git commit --allow-empty -m 'Initial'", { cwd: tempDir, stdio: "ignore" });
      } catch (e) {
        // Git might not be available, skip test
        return;
      }

      const result = await gitModule.actions["commit-and-push"]({
        paths: [],
        message: "Test commit",
        cwd: tempDir,
        push: false
      }, {
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn()
        }
      });

      expect(result.success).toBe(true);
      expect(result.committed).toBe(false);
      expect(result.message).toContain("No changes to commit");
    });

    test("should require commit message", async () => {
      // Initialize git repo
      try {
        execSync("git init", { cwd: tempDir, stdio: "ignore" });
        execSync("git config user.name 'Test User'", { cwd: tempDir, stdio: "ignore" });
        execSync("git config user.email 'test@example.com'", { cwd: tempDir, stdio: "ignore" });
      } catch (e) {
        // Git might not be available, skip test
        return;
      }

      await expect(
        gitModule.actions["commit-and-push"]({
          paths: [],
          message: null,
          cwd: tempDir,
          push: false
        }, {
          logger: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn()
          }
        })
      ).rejects.toThrow("Commit message is required");
    });

    test("should stage specific paths when provided", async () => {
      // Initialize git repo
      try {
        execSync("git init", { cwd: tempDir, stdio: "ignore" });
        execSync("git config user.name 'Test User'", { cwd: tempDir, stdio: "ignore" });
        execSync("git config user.email 'test@example.com'", { cwd: tempDir, stdio: "ignore" });
      } catch (e) {
        // Git might not be available, skip test
        return;
      }

      // Create multiple files
      fs.writeFileSync(path.join(tempDir, "file1.txt"), "content 1");
      fs.writeFileSync(path.join(tempDir, "file2.txt"), "content 2");
      fs.writeFileSync(path.join(tempDir, "file3.txt"), "content 3");

      const result = await gitModule.actions["commit-and-push"]({
        paths: ["file1.txt", "file2.txt"],
        message: "Test commit specific files",
        cwd: tempDir,
        push: false
      }, {
        logger: {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn()
        }
      });

      expect(result.success).toBe(true);
      expect(result.committed).toBe(true);
      
      // Verify only specified files were committed
      const status = execSync("git status --porcelain", { cwd: tempDir, encoding: "utf8" });
      expect(status).toContain("file3.txt"); // file3 should still be untracked
    });
  });
});

