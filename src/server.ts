import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import { TodoistMCPServer } from './index.js';

const app = express();
app.use(express.json());
const mcp = new TodoistMCPServer();

// Health check for Railway
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'todoist-mcp-server' });
});

// Root endpoint with info
app.get('/', (req, res) => {
  res.json({
    name: 'Todoist MCP Server',
    version: '0.1.0',
    protocol: 'MCP over HTTP',
    endpoints: {
      'POST /mcp/tools/list': 'List available tools',
      'POST /mcp/tools/call': 'Call a specific tool'
    }
  });
});

// MCP Tools List
app.post('/mcp/tools/list', (req, res) => {
  res.json({
    tools: [
      {
        name: 'create_task',
        description: 'Create a new task in Todoist',
        inputSchema: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'The task content/title',
            },
            description: {
              type: 'string',
              description: 'Optional task description',
            },
            project_name: {
              type: 'string',
              description: 'Optional project name (will find or create)',
            },
            due_string: {
              type: 'string',
              description: 'Due date in natural language (e.g., "tomorrow", "next Friday")',
            },
            priority: {
              type: 'number',
              description: 'Priority level (1-4, where 4 is urgent)',
            },
            labels: {
              type: 'array',
              items: { type: 'string' },
              description: 'Array of label names',
            },
          },
          required: ['content'],
        },
      },
      {
        name: 'list_tasks',
        description: 'List tasks from Todoist',
        inputSchema: {
          type: 'object',
          properties: {
            project_name: {
              type: 'string',
              description: 'Optional project name to filter by',
            },
            filter: {
              type: 'string',
              description: 'Todoist filter query (e.g., "today", "overdue")',
            },
          },
        },
      },
      {
        name: 'list_projects',
        description: 'List all Todoist projects',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'complete_task',
        description: 'Mark a task as completed',
        inputSchema: {
          type: 'object',
          properties: {
            task_id: {
              type: 'string',
              description: 'The task ID to complete',
            },
          },
          required: ['task_id'],
        },
      },
      {
        name: 'update_task',
        description: 'Update an existing task',
        inputSchema: {
          type: 'object',
          properties: {
            task_id: {
              type: 'string',
              description: 'The task ID to update',
            },
            content: {
              type: 'string',
              description: 'New task content',
            },
            description: {
              type: 'string',
              description: 'New task description',
            },
            due_string: {
              type: 'string',
              description: 'New due date in natural language',
            },
            priority: {
              type: 'number',
              description: 'New priority level (1-4)',
            },
          },
          required: ['task_id'],
        },
      },
    ],
  });
});

// MCP Tool Call
app.post('/mcp/tools/call', (req, res) => {
  const toolName = req.body.name;
  const toolArgs = req.body.arguments || {};

  const executeAsyncCall = async () => {
    try {
      let result;

      if (toolName === 'create_task') {
        result = await mcp.createTask(toolArgs);
      } else if (toolName === 'list_tasks') {
        result = await mcp.listTasks(toolArgs);
      } else if (toolName === 'list_projects') {
        result = await mcp.listProjects();
      } else if (toolName === 'complete_task') {
        result = await mcp.completeTask(toolArgs);
      } else if (toolName === 'update_task') {
        result = await mcp.updateTask(toolArgs);
      } else {
        return res.status(400).json({
          error: `Unknown tool: ${toolName}`,
          available_tools: ['create_task', 'list_tasks', 'list_projects', 'complete_task', 'update_task']
        });
      }

      res.json(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage });
    }
  };

  executeAsyncCall();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Todoist MCP server running on port ${PORT}`);
});