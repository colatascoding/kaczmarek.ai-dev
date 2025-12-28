/**
 * Unit tests for workstream API routes
 */

const { describe, test, expect, beforeEach, afterEach } = require("@jest/globals");
const { createTempDir, cleanupTempDir, createMockServer } = require("./helpers/test-utils");

describe("Workstream Routes", () => {
  let tempDir;
  let server;
  let workstreamRoutes;

  beforeEach(() => {
    tempDir = createTempDir();
    server = createMockServer(tempDir);
    
    // Load workstream routes
    const createWorkstreamRoutes = require("../api/routes/workstreams");
    workstreamRoutes = createWorkstreamRoutes(server);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    cleanupTempDir(tempDir);
  });

  describe("handleListWorkstreams", () => {
    test("should return 400 if version tag is missing", async () => {
      const req = {
        url: "/api/workstreams",
        headers: { host: "localhost:3000" }
      };
      const res = {
        writeHead: jest.fn(),
        end: jest.fn()
      };

      await workstreamRoutes.handleListWorkstreams(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
      const responseData = JSON.parse(res.end.mock.calls[0][0]);
      expect(responseData.error).toBe("Version tag required");
    });

    test("should return empty array if no workstreams exist", async () => {
      const req = {
        url: "/api/workstreams?versionTag=0-1",
        headers: { host: "localhost:3000" }
      };
      const res = {
        writeHead: jest.fn(),
        end: jest.fn()
      };

      // Mock workstreamOps
      const workstreamOps = require("../modules/implementation/workstream-operations");
      jest.spyOn(workstreamOps, "listWorkstreams").mockResolvedValue({ workstreams: [] });

      await workstreamRoutes.handleListWorkstreams(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
      const responseData = JSON.parse(res.end.mock.calls[0][0]);
      expect(responseData.workstreams).toEqual([]);
    });
  });
});

