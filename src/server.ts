import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import { TodoistMCPServer } from './index.js';

const app = express();
app.use(express.json());

const mcp = new TodoistMCPServer();

app.post('/create_task', async (req, res) => {
  const result = await mcp.createTask(req.body);
  res.json(result);
});

app.post('/list_tasks', async (req, res) => {
  const result = await mcp.listTasks(req.body);
  res.json(result);
});

app.get('/list_projects', async (req, res) => {
  const result = await mcp.listProjects();
  res.json(result);
});

app.post('/complete_task', async (req, res) => {
  const result = await mcp.completeTask(req.body);
  res.json(result);
});

app.post('/update_task', async (req, res) => {
  const result = await mcp.updateTask(req.body);
  res.json(result);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`HTTP server running on port ${PORT}`);
}); 