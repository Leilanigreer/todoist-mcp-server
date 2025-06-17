import 'dotenv/config';
import axios from 'axios';
export class TodoistMCPServer {
    apiToken;
    baseUrl = 'https://api.todoist.com/rest/v2';
    constructor() {
        this.apiToken = process.env.TODOIST_API_TOKEN || '';
        if (!this.apiToken) {
            console.error('TODOIST_API_TOKEN environment variable is required');
            process.exit(1);
        }
    }
    async makeRequest(method, endpoint, data) {
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
        }
        catch (error) {
            throw new Error(`Todoist API error: ${error.response?.data?.message || error.message}`);
        }
    }
    async findOrCreateProject(projectName) {
        const projects = await this.makeRequest('GET', '/projects');
        const existingProject = projects.find((p) => p.name.toLowerCase() === projectName.toLowerCase());
        if (existingProject) {
            return existingProject.id;
        }
        // Create new project
        const newProject = await this.makeRequest('POST', '/projects', {
            name: projectName,
        });
        return newProject.id;
    }
    async createTask(args) {
        try {
            const taskData = {
                content: args.content,
            };
            if (args.description)
                taskData.description = args.description;
            if (args.due_string)
                taskData.due_string = args.due_string;
            if (args.priority)
                taskData.priority = args.priority;
            if (args.labels)
                taskData.labels = args.labels;
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
        }
        catch (error) {
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
    async listTasks(args) {
        try {
            let endpoint = '/tasks';
            const params = [];
            if (args.project_name) {
                const projects = await this.makeRequest('GET', '/projects');
                const project = projects.find((p) => p.name.toLowerCase() === args.project_name.toLowerCase());
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
            const taskList = tasks.map((task) => `- ${task.content}${task.due ? ` (Due: ${task.due.string})` : ''} [ID: ${task.id}]`).join('\n');
            return {
                content: [
                    {
                        type: 'text',
                        text: `Found ${tasks.length} task(s):\n\n${taskList}`,
                    },
                ],
            };
        }
        catch (error) {
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
    async listProjects() {
        try {
            const projects = await this.makeRequest('GET', '/projects');
            const projectList = projects.map((project) => `- ${project.name} [ID: ${project.id}]`).join('\n');
            return {
                content: [
                    {
                        type: 'text',
                        text: `Your Todoist projects:\n\n${projectList}`,
                    },
                ],
            };
        }
        catch (error) {
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
    async completeTask(args) {
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
        }
        catch (error) {
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
    async updateTask(args) {
        try {
            const updateData = {};
            if (args.content)
                updateData.content = args.content;
            if (args.description)
                updateData.description = args.description;
            if (args.due_string)
                updateData.due_string = args.due_string;
            if (args.priority)
                updateData.priority = args.priority;
            const task = await this.makeRequest('POST', `/tasks/${args.task_id}`, updateData);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Task updated successfully: "${task.content}"`,
                    },
                ],
            };
        }
        catch (error) {
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
