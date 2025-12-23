/**
 * Static file route handlers
 */

const path = require("path");
const fs = require("fs");

/**
 * Create static routes handler
 */
function createStaticRoutes(server) {
  return {
    /**
     * Serve static files
     */
    serveStaticFile(req, res, pathname) {
      const filePath = path.join(__dirname, "..", "..", "..", "frontend", pathname.replace("/static/", ""));
      
      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const ext = path.extname(filePath);
      const contentTypes = {
        ".html": "text/html",
        ".css": "text/css",
        ".js": "application/javascript",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".svg": "image/svg+xml"
      };

      res.writeHead(200, { "Content-Type": contentTypes[ext] || "text/plain" });
      fs.createReadStream(filePath).pipe(res);
    },

    /**
     * Serve index.html
     */
    async serveIndex(req, res) {
      const indexPath = path.join(__dirname, "..", "..", "..", "frontend", "index.html");
      
      if (!fs.existsSync(indexPath)) {
        res.writeHead(404);
        res.end("Frontend not found. Run 'npm run build-frontend' first.");
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      fs.createReadStream(indexPath).pipe(res);
    }
  };
}

module.exports = createStaticRoutes;

