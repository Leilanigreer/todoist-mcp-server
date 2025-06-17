import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import { TodoistMCPServer } from './index.js';
const app = express();
app.use(express.json());
const mcp = new TodoistMCPServer();
// Health check endpoint for Railway
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', service: 'todoist-mcp-server' });
});
// Root endpoint with API info
app.get('/', (req, res) => {
    res.json({
        name: 'Todoist MCP Server',
        version: '0.1.0',
        endpoints: {
            'POST /create_task': 'Create a new task',
            'POST /list_tasks': 'List tasks (optionally filtered)',
            'GET /list_projects': 'List all projects',
            'POST /complete_task': 'Mark a task as completed',
            'POST /update_task': 'Update an existing task'
        }
    });
});
app.post('/create_task', async (req, res) => {
    try {
        const result = await mcp.createTask(req.body);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/list_tasks', async (req, res) => {
    try {
        const result = await mcp.listTasks(req.body);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/list_projects', async (req, res) => {
    try {
        const result = await mcp.listProjects();
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/complete_task', async (req, res) => {
    try {
        const result = await mcp.completeTask(req.body);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.post('/update_task', async (req, res) => {
    try {
        const result = await mcp.updateTask(req.body);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Todoist MCP HTTP server running on port ${PORT}`);
});
