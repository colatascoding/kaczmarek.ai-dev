# Frontend Guide

## Overview

kaczmarek.ai-dev includes a web-based frontend dashboard for monitoring workflows, agents, executions, and versions.

## Starting the Frontend

### Option 1: Using kad CLI

```bash
./kad api start [port]
```

Default port is 3000. Example:
```bash
./kad api start 3000
```

### Option 2: Using npm

```bash
npm run api
# or
npm run dev
```

## Accessing the Dashboard

Once the server is running, open your browser to:
```
http://localhost:3000
```

## Features

### Dashboard
- Overview statistics (workflows, agents, executions, versions)
- Recent executions
- Active agent tasks

### Workflows
- List all workflows
- View workflow details
- See execution history per workflow

### Agents
- Monitor agent task queue
- View task status (queued, processing, ready, completed, failed)
- See task details and execution results

### Executions
- View workflow execution history
- See step-by-step execution details
- Monitor execution status

### Versions
- List all version files (review/progress pairs)
- See which versions have review and progress files

## API Endpoints

The frontend uses a REST API. All endpoints are under `/api/`:

- `GET /api/workflows` - List all workflows
- `GET /api/workflows/:id` - Get workflow details
- `POST /api/workflows/:id/run` - Run a workflow
- `GET /api/executions` - List all executions
- `GET /api/executions/:id` - Get execution details
- `GET /api/agents` - List all agent tasks
- `GET /api/agents/:id` - Get agent task details
- `GET /api/versions` - List all versions

## Architecture

### Frontend Structure
```
frontend/
├── index.html      # Main HTML
├── app.js          # JavaScript application
└── styles.css      # Styling
```

### Backend Structure
```
lib/api/
└── server.js       # HTTP API server
```

The API server:
- Serves static frontend files
- Exposes workflow engine via HTTP
- Reads agent queue files
- Queries SQLite database for executions

## Development

### Adding New Views

1. Add HTML structure in `index.html`:
```html
<div id="my-view" class="view">
  <h2>My View</h2>
  <div id="my-content"></div>
</div>
```

2. Add navigation button:
```html
<button class="nav-btn" data-view="my">My View</button>
```

3. Add JavaScript handler in `app.js`:
```javascript
case "my":
  loadMyView();
  break;
```

### Adding New API Endpoints

Edit `lib/api/server.js` and add a new handler:

```javascript
else if (pathname === "/api/my-endpoint" && method === "GET") {
  await this.handleMyEndpoint(req, res);
}
```

Then implement the handler method.

## Future Enhancements

- [ ] Visual workflow editor (React Flow)
- [ ] Real-time updates (WebSocket)
- [ ] Workflow creation/editing UI
- [ ] Agent task management (start/stop/complete)
- [ ] Execution logs viewer
- [ ] Version file viewer/editor
- [ ] Dark mode
- [ ] Responsive design improvements

## Integration with Electron

The frontend can be integrated into an Electron app:

1. Load `index.html` in an Electron BrowserWindow
2. Use Electron's IPC to communicate with the API server
3. Or embed the API server directly in the Electron main process

See `docs/VISUAL_WORKFLOW_EDITOR_DESIGN.md` for more details on Electron integration.



