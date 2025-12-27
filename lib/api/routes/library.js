/**
 * Library route handlers
 */

const { loadConfig } = require("../../../bin/utils");
const libraryOps = require("../../library/file-operations");
const workflowDiscovery = require("../../library/workflow-discovery");
const dashboardLoader = require("../../dashboard/loader");
const widgetRenderer = require("../../dashboard/widget-renderer");

/**
 * Create library routes handler
 */
function createLibraryRoutes(server) {
  return {
    /**
     * List library items by category
     */
    async handleListLibraryItems(req, res) {
      const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
      const category = parsedUrl.searchParams.get("category") || null;
      const subcategory = parsedUrl.searchParams.get("subcategory") || null;
      
      const config = loadConfig(server.cwd);
      const libraryDir = config?.library?.libraryDir || "library";
      
      let items = [];
      
      if (category) {
        items = libraryOps.listLibraryItems(category, subcategory, server.cwd, libraryDir);
      } else {
        // List all categories
        const categories = ["workflows", "dashboards", "templates"];
        for (const cat of categories) {
          items.push(...libraryOps.listLibraryItems(cat, null, server.cwd, libraryDir));
        }
      }
      
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ items }));
    },

    /**
     * Get library item details
     */
    async handleGetLibraryItem(req, res) {
      const urlParts = req.url.split("/");
      const itemPath = urlParts.slice(urlParts.indexOf("library") + 1).join("/");
      
      const config = loadConfig(server.cwd);
      const libraryDir = config?.library?.libraryDir || "library";
      
      const itemFullPath = libraryOps.findLibraryItem(itemPath, server.cwd, libraryDir);
      if (!itemFullPath) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Library item not found" }));
        return;
      }

      const metadata = libraryOps.readLibraryMetadata(itemPath, server.cwd, libraryDir);
      const files = libraryOps.getLibraryItemFiles(itemPath, server.cwd, libraryDir);
      
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        path: itemPath,
        metadata: metadata || {},
        files
      }));
    },

    /**
     * List discovered workflows
     */
    async handleListDiscoveredWorkflows(req, res) {
      const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
      const versionTag = parsedUrl.searchParams.get("versionTag") || null;
      
      const workflows = workflowDiscovery.discoverWorkflows(server.cwd, { versionTag });
      
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ workflows }));
    },

    /**
     * Get workflow by ID (from all sources)
     */
    async handleGetWorkflowById(req, res) {
      const urlParts = req.url.split("/");
      const workflowId = urlParts[urlParts.length - 1];
      const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
      const versionTag = parsedUrl.searchParams.get("versionTag") || null;
      
      const workflow = workflowDiscovery.getWorkflowById(workflowId, server.cwd, { versionTag });
      
      if (!workflow) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Workflow not found" }));
        return;
      }
      
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ workflow }));
    },

    /**
     * List dashboards
     */
    async handleListDashboards(req, res) {
      const dashboards = dashboardLoader.listDashboards(server.cwd);
      
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ dashboards }));
    },

    /**
     * Get dashboard
     */
    async handleGetDashboard(req, res) {
      const urlParts = req.url.split("/");
      const dashboardId = urlParts[urlParts.length - 1];
      
      const dashboard = dashboardLoader.loadDashboard(dashboardId, server.cwd);
      
      if (!dashboard) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Dashboard not found" }));
        return;
      }
      
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ dashboard }));
    },

    /**
     * Render dashboard
     */
    async handleRenderDashboard(req, res) {
      const urlParts = req.url.split("/");
      const dashboardId = urlParts[urlParts.length - 2]; // Before "render"
      
      const dashboard = dashboardLoader.loadDashboard(dashboardId, server.cwd);
      
      if (!dashboard) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Dashboard not found" }));
        return;
      }
      
      // Validate dashboard
      const validation = dashboardLoader.validateDashboard(dashboard);
      if (!validation.valid) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid dashboard", details: validation.errors }));
        return;
      }
      
      // Render all widgets
      const renderedWidgets = [];
      for (const widget of dashboard.widgets || []) {
        try {
          const rendered = await widgetRenderer.renderWidget(widget, {
            server: server,
            cwd: server.cwd
          });
          renderedWidgets.push({
            id: widget.id,
            type: widget.type,
            ...rendered
          });
        } catch (e) {
          renderedWidgets.push({
            id: widget.id,
            type: widget.type,
            error: e.message
          });
        }
      }
      
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        dashboard: {
          id: dashboard.id || dashboardId,
          name: dashboard.name,
          description: dashboard.description
        },
        widgets: renderedWidgets
      }));
    }
  };
}

module.exports = createLibraryRoutes;

