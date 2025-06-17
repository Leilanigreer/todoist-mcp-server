import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
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

export class TodoistMCPServer {
  private server: Server;
  private apiToken: string;
  private baseUrl = 'https://api.todoist.com/rest/v2';

  constructor() {
    this.server = new Server(
      {
        name: 'todoist-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.apiToken = process.env.TODOIST_API_TOKEN || '';
    if (!this.apiToken) {
      console.error('TODOIST_API_TOKEN environment variable is required');
      process.exit(1);
    }

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
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
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'create_task':
          return await this.createTask(request.params.arguments as any);
        case 'list_tasks':
          return await this.listTasks(request.params.arguments as any);
        case 'list_projects':
          return await this.listProjects();
        case 'complete_task':
          return await this.completeTask(request.params.arguments as any);
        case 'update_task':
          return await this.updateTask(request.params.arguments as any);
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    });
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

  public async createTask(args: any) {
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

  public async listTasks(args: any) {
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

  public async listProjects() {
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

  public async completeTask(args: any) {
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

  public async updateTask(args: any) {
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

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Todoist MCP server running on stdio');
  }
}

const server = new TodoistMCPServer();
server.run().catch(console.error);