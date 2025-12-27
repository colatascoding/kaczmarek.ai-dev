/**
 * Tests for version file operations
 */

const {
  findVersionFolder,
  getStagePath,
  getWorkstreamPath,
  createVersionFolder,
  readVersionMetadata,
  writeVersionMetadata
} = require("../versions/file-operations");
const fs = require("fs");
const path = require("path");
const os = require("os");

describe("Version File Operations", () => {
  let testDir;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "kad-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("createVersionFolder", () => {
    it("should create version folder structure", () => {
      const versionPath = createVersionFolder("0-2", testDir);
      
      expect(versionPath).toBeTruthy();
      expect(fs.existsSync(versionPath)).toBe(true);
      expect(fs.existsSync(path.join(versionPath, "01_plan"))).toBe(true);
      expect(fs.existsSync(path.join(versionPath, "02_implement"))).toBe(true);
      expect(fs.existsSync(path.join(versionPath, "02_implement", "workstreams"))).toBe(true);
      expect(fs.existsSync(path.join(versionPath, "03_test"))).toBe(true);
      expect(fs.existsSync(path.join(versionPath, "04_review"))).toBe(true);
      expect(fs.existsSync(path.join(versionPath, "docs"))).toBe(true);
      expect(fs.existsSync(path.join(versionPath, "library", "workflows"))).toBe(true);
    });

    it("should create version folder with version prefix", () => {
      const versionPath = createVersionFolder("version0-2", testDir);
      
      expect(versionPath).toBeTruthy();
      expect(fs.existsSync(versionPath)).toBe(true);
    });
  });

  describe("findVersionFolder", () => {
    it("should find existing version folder", () => {
      createVersionFolder("0-2", testDir);
      const found = findVersionFolder("0-2", testDir);
      
      expect(found).toBeTruthy();
      expect(fs.existsSync(found)).toBe(true);
    });

    it("should return null for non-existent version", () => {
      const found = findVersionFolder("99-99", testDir);
      expect(found).toBeNull();
    });
  });

  describe("getStagePath", () => {
    it("should get stage path for existing version", () => {
      createVersionFolder("0-2", testDir);
      const stagePath = getStagePath("0-2", "01_plan", testDir);
      
      expect(stagePath).toBeTruthy();
      expect(fs.existsSync(stagePath)).toBe(true);
    });

    it("should return null for non-existent version", () => {
      const stagePath = getStagePath("99-99", "01_plan", testDir);
      expect(stagePath).toBeNull();
    });
  });

  describe("getWorkstreamPath", () => {
    it("should get workstream path", () => {
      createVersionFolder("0-2", testDir);
      const workstreamPath = getWorkstreamPath("0-2", "workstream-1", testDir);
      
      expect(workstreamPath).toBeTruthy();
      expect(workstreamPath).toContain("workstreams");
      expect(workstreamPath).toContain("workstream-1");
    });
  });

  describe("version metadata", () => {
    it("should write and read version metadata", () => {
      createVersionFolder("0-2", testDir);
      
      const metadata = {
        version: "0-2",
        major: 0,
        minor: 2,
        type: "minor",
        status: "in-progress",
        started: "2025-12-23"
      };
      
      writeVersionMetadata("0-2", metadata, testDir);
      const read = readVersionMetadata("0-2", testDir);
      
      expect(read).toEqual(metadata);
    });
  });
});

