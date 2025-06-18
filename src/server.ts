import express from 'express';
import 'dotenv/config';
import axios from 'axios';

interface TodoistTask {
  id?: string;
  content: string;
  description?: string;
  project_id?: string;
  due_string?: string;
  priority?: number;
  labels?: string[];
}

interface TodoistProject {
  id: string;
  name: string;
}

// MCP Protocol types
interface MCPRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface MCPToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

class TodoistService {
  private apiToken: string;
  private baseUrl = 'https://api.todoist.com/rest/v2';

  constructor() {
    this.apiToken = process.env.TODOIST_API_TOKEN || '';
    if (!this.apiToken) {
      throw new Error('TODOIST_API_TOKEN environment variable is required');
    }
  }

  private async makeRequest(method: string, endpoint: string, data?: any) {
    try {
      const response = await axios({
        method,
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        data,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(`Todoist API error: ${error.response?.data?.message || error.message}`);
    }
  }

  private async findOrCreateProject(projectName: string): Promise<string> {
    const projects = await this.makeRequest('GET', '/projects');
    const existingProject = projects.find((p: TodoistProject) =>
      p.name.toLowerCase() === projectName.toLowerCase()
    );

    if (existingProject) {
      return existingProject.id;
    }

    // Create new project
    const newProject = await this.makeRequest('POST', '/projects', {
      name: projectName,
    });
    return newProject.id;
  }

  async createTask(args: any): Promise<MCPToolResult> {
    try {
      const taskData: any = {
        content: args.content,
      };

      if (args.description) taskData.description = args.description;
      if (args.due_string) taskData.due_string = args.due_string;
      if (args.priority) taskData.priority = args.priority;
      if (args.labels) taskData.labels = args.labels;

      if (args.project_name) {
        taskData.project_id = await this.findOrCreateProject(args.project_name);
      }

      const task = await this.makeRequest('POST', '/tasks', taskData);

      return {
        content: [
          {
            type: 'text',
            text: `Task created successfully: "${task.content}" (ID: ${task.id})`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error creating task: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async listTasks(args: any): Promise<MCPToolResult> {
    try {
      let endpoint = '/tasks';
      const params: string[] = [];

      if (args.project_name) {
        const projects = await this.makeRequest('GET', '/projects');
        const project = projects.find((p: TodoistProject) =>
          p.name.toLowerCase() === args.project_name.toLowerCase()
        );
        if (project) {
          params.push(`project_id=${project.id}`);
        }
      }

      if (args.filter) {
        params.push(`filter=${encodeURIComponent(args.filter)}`);
      }

      if (params.length > 0) {
        endpoint += '?' + params.join('&');
      }

      const tasks = await this.makeRequest('GET', endpoint);

      const taskList = tasks.map((task: any) =>
        `- ${task.content}${task.due ? ` (Due: ${task.due.string})` : ''} [ID: ${task.id}]`
      ).join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `Found ${tasks.length} task(s):\n\n${taskList}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error listing tasks: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async listProjects(): Promise<MCPToolResult> {
    try {
      const projects = await this.makeRequest('GET', '/projects');
      const projectList = projects.map((project: TodoistProject) =>
        `- ${project.name} [ID: ${project.id}]`
      ).join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `Your Todoist projects:\n\n${projectList}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error listing projects: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async completeTask(args: any): Promise<MCPToolResult> {
    try {
      await this.makeRequest('POST', `/tasks/${args.task_id}/close`);

      return {
        content: [
          {
            type: 'text',
            text: `Task ${args.task_id} marked as completed!`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error completing task: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async updateTask(args: any): Promise<MCPToolResult> {
    try {
      const updateData: any = {};
      if (args.content) updateData.content = args.content;
      if (args.description) updateData.description = args.description;
      if (args.due_string) updateData.due_string = args.due_string;
      if (args.priority) updateData.priority = args.priority;

      const task = await this.makeRequest('POST', `/tasks/${args.task_id}`, updateData);

      return {
        content: [
          {
            type: 'text',
            text: `Task updated successfully: "${task.content}"`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error updating task: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
}

const app = express();

// CORS middleware for Remote MCP
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, x-api-key');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

app.use(express.json());

const todoistService = new TodoistService();

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
    endpoint: '/mcp',
    usage: 'Claude-compatible MCP server for Todoist'
  });
});

// MCP protocol endpoint
app.post('/mcp', async (req, res) => {
  console.log('=== MCP REQUEST ===');
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('User-Agent:', req.headers['user-agent']);
  console.log('==================');

  try {
    const request: MCPRequest = req.body;
    const { method, params = {}, id } = request;

    // Handle notifications (no id field) separately
    if (!id && method === 'notifications/initialized') {
      console.log('NOTIFICATIONS/INITIALIZED from:', req.headers['user-agent']);
      console.log('NOTIFICATIONS/INITIALIZED acknowledged');
      res.status(200).end();
      return;
    }

    const response: MCPResponse = {
      jsonrpc: '2.0',
      id,
    };

    switch (method) {
      case 'initialize':
        console.log('INITIALIZE request from:', req.headers['user-agent']);
        response.result = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {
              listChanged: true
            },
            resources: {
              subscribe: false,
              listChanged: false
            },
            prompts: {
              listChanged: false
            }
          },
          serverInfo: {
            name: 'todoist-mcp-server',
            version: '0.1.0',
          },
        };
        console.log('INITIALIZE response:', JSON.stringify(response, null, 2));
        break;

      case 'tools/list':
        console.log('TOOLS/LIST request from:', req.headers['user-agent']);
        response.result = {
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
        };
        console.log('TOOLS/LIST response sent, tool count:', response.result.tools.length);
        break;

      case 'tools/call':
        const { name, arguments: args } = params;

        let toolResult: MCPToolResult | undefined = undefined;
        switch (name) {
          case 'create_task':
            toolResult = await todoistService.createTask(args);
            break;
          case 'list_tasks':
            toolResult = await todoistService.listTasks(args);
            break;
          case 'list_projects':
            toolResult = await todoistService.listProjects();
            break;
          case 'complete_task':
            toolResult = await todoistService.completeTask(args);
            break;
          case 'update_task':
            toolResult = await todoistService.updateTask(args);
            break;
          default:
            response.error = {
              code: -32601,
              message: `Unknown tool: ${name}`,
            };
            break;
        }

        if (toolResult) {
          response.result = toolResult;
        }
        break;

      case 'notifications/initialized':
        console.log('NOTIFICATIONS/INITIALIZED from:', req.headers['user-agent']);
        // This is a notification - don't send a response, just acknowledge
        console.log('NOTIFICATIONS/INITIALIZED acknowledged');
        res.status(200).end(); // Send empty 200 response
        return; // Important: return early, don't send JSON response
        break;

      default:
        console.log('UNKNOWN METHOD:', method, 'from:', req.headers['user-agent']);
        response.error = {
          code: -32601,
          message: `Method not found: ${method}`,
        };
        break;
    }

    console.log('=== MCP RESPONSE ===');
    console.log('Status:', res.statusCode);
    console.log('Method:', request.method);
    console.log('Response:', JSON.stringify(response, null, 2));
    console.log('===================');
    res.setHeader('Content-Type', 'application/json');
    res.json(response);

  } catch (error) {
    console.error('Error handling MCP request:', error);

    const errorResponse: MCPResponse = {
      jsonrpc: '2.0',
      id: req.body.id || null,
      error: {
        code: -32603,
        message: 'Internal server error',
        data: error instanceof Error ? error.message : 'Unknown error',
      },
    };

    res.status(500).json(errorResponse);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Todoist MCP Server listening on port ${PORT}`);
  console.log(`Health check available at: http://localhost:${PORT}/health`);
  console.log(`MCP endpoint available at: http://localhost:${PORT}/mcp`);
});