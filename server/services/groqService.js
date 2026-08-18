const uniguruAIService = require('./uniguruAIService');

class GroqService {
  constructor() {
    this.serviceName = 'UniGuru AI Workflow Integration';
  }

  isAvailable() {
    return true;
  }

  /**
   * Analyze tasks and generate workflow insights using UniGuru AI
   * @param {Array} tasks - Array of task objects from database
   * @param {Array} users - Array of user objects from database
   * @returns {Promise<Array>} - Array of AI-generated insights
   */
  async analyzeWorkflow(tasks, users) {
    try {
      const taskSummary = this.prepareTaskSummary(tasks, users);
      
      const prompt = `You are an expert workflow optimization AI assistant. Analyze the following task and team data, then generate actionable insights.

Task Data:
${JSON.stringify(taskSummary, null, 2)}

Instructions:
1. Identify specific workflow optimization opportunities
2. Focus on: resource allocation, deadline risks, dependencies, and workload balance
3. Provide 3-5 insights with HIGH impact priorities first
4. Suggest concrete, actionable steps`;

      const aiResult = await uniguruAIService.ask(prompt, {
        domain: 'Workflow Analytics',
        context: { taskCount: tasks.length, userCount: users.length }
      });

      if (aiResult && aiResult.answer) {
        // Try parsing JSON if answer returned structured array string
        try {
          const match = aiResult.answer.match(/\[[\s\S]*\]/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (Array.isArray(parsed) && parsed.length > 0) {
              return parsed.map((insight, index) => ({
                id: insight.id || `insight-${Date.now()}-${index}`,
                title: insight.title || 'Optimization Suggestion',
                category: this.validateCategory(insight.category),
                impact: this.validateImpact(insight.impact),
                description: insight.description || 'No description provided',
                actions: Array.isArray(insight.actions) ? insight.actions : [],
                createdAt: insight.createdAt || new Date().toISOString(),
              }));
            }
          }
        } catch (e) {
          // Fallthrough to summary format
        }

        // Return formatted single insight if response is natural language text
        return [
          {
            id: `insight-uniguru-${Date.now()}`,
            title: 'UniGuru Workflow Intelligence',
            category: 'Workflow',
            impact: 'High',
            description: aiResult.answer,
            actions: ['Review UniGuru recommendations', 'Adjust team assignments'],
            createdAt: new Date().toISOString()
          }
        ];
      }

      return this.generateFallbackInsights(tasks, users);
    } catch (error) {
      console.error('❌ UniGuru Workflow analysis error:', error.message);
      return this.generateFallbackInsights(tasks, users);
    }
  }

  prepareTaskSummary(tasks, users) {
    const now = new Date();
    const userWorkload = {};
    users.forEach(user => {
      userWorkload[user._id.toString()] = {
        name: user.name,
        email: user.email,
        role: user.role,
        taskCount: 0,
        highPriorityCount: 0,
        overdueTasks: 0,
      };
    });

    const taskStats = {
      total: tasks.length,
      completed: 0,
      inProgress: 0,
      notStarted: 0,
      overdue: 0,
      highPriority: 0,
    };

    const taskSummary = tasks.slice(0, 20).map(task => {
      const isOverdue = new Date(task.dueDate) < now && task.status !== 'completed';
      
      if (task.status === 'completed') taskStats.completed++;
      else if (task.status === 'in-progress') taskStats.inProgress++;
      else taskStats.notStarted++;
      
      if (isOverdue) taskStats.overdue++;
      if (task.priority === 'High') taskStats.highPriority++;

      if (task.assignee && userWorkload[task.assignee.toString()]) {
        userWorkload[task.assignee.toString()].taskCount++;
        if (task.priority === 'High') {
          userWorkload[task.assignee.toString()].highPriorityCount++;
        }
        if (isOverdue) {
          userWorkload[task.assignee.toString()].overdueTasks++;
        }
      }

      return {
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        assignee: task.assignee ? userWorkload[task.assignee.toString()]?.name : 'Unassigned',
        isOverdue,
      };
    });

    return {
      taskStats,
      taskSummary,
      userWorkload: Object.values(userWorkload),
      analysisDate: now.toISOString(),
    };
  }

  generateFallbackInsights(tasks, users) {
    const insights = [];
    const now = new Date();

    const overdueTasks = tasks.filter(
      task => new Date(task.dueDate) < now && task.status !== 'completed'
    );

    if (overdueTasks.length > 0) {
      insights.push({
        id: `insight-overdue-${Date.now()}`,
        title: 'Multiple Overdue Tasks Detected',
        category: 'Deadlines',
        impact: 'High',
        description: `${overdueTasks.length} task(s) are overdue. Immediate attention required to prevent project delays.`,
        actions: ['Review and reprioritize tasks', 'Extend deadlines if necessary'],
        createdAt: new Date().toISOString(),
      });
    }

    if (insights.length === 0) {
      insights.push({
        id: `insight-positive-${Date.now()}`,
        title: 'Workflow Running Smoothly',
        category: 'Workflow',
        impact: 'Low',
        description: 'No critical issues detected in current workflow. Team workload is balanced.',
        actions: ['Maintain current pace', 'Continue monitoring progress'],
        createdAt: new Date().toISOString(),
      });
    }

    return insights;
  }

  validateCategory(category) {
    const validCategories = ['Resources', 'Dependencies', 'Deadlines', 'Workflow'];
    return validCategories.includes(category) ? category : 'Workflow';
  }

  validateImpact(impact) {
    const validImpacts = ['High', 'Medium', 'Low'];
    return validImpacts.includes(impact) ? impact : 'Medium';
  }
}

module.exports = new GroqService();
