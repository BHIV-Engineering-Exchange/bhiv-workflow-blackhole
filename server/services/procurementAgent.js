const User = require('../models/User');
const Task = require('../models/Task');
const { auditLogger } = require('./complianceAuditLogger');

class ProcurementAgent {
  async analyzeEmployeeAvailability(adminId, branchFilter = {}) {
    try {
      // Only fetch ACTIVE employees (exclude exited/terminated employees) - filtered by branch
      const employees = await User.find({ 
        role: 'User',
        stillExist: 1, // Only include active employees (0 = exited, 1 = active)
        ...branchFilter
      }).select('name email department stillExist branch');
      const analysis = [];
      const lowTaskEmployees = [];

      for (const employee of employees) {
        const employeeStats = await this.getEmployeeTaskStats(employee._id, branchFilter);
        const employeeData = {
          employeeId: employee._id,
          name: employee.name,
          email: employee.email,
          department: employee.department,
          branch: employee.branch,
          ...employeeStats
        };
        
        analysis.push(employeeData);
        
        // Check for employees with less than 1 active task
        if (employeeStats.activeTasks < 1) {
          lowTaskEmployees.push(employeeData);
        }
      }

      // Send notifications for employees with less than 1 task
      if (lowTaskEmployees.length > 0) {
        await this.sendLowTaskNotifications(adminId, lowTaskEmployees);
      }

      // Log procurement analysis
      await auditLogger.logEvent(
        adminId,
        'procurement_analysis',
        'employee_availability',
        {
          total_employees: employees.length,
          available_employees: analysis.filter(e => e.isAvailable).length,
          low_task_employees: lowTaskEmployees.length,
          branch: branchFilter.branch || 'all'
        }
      );

      return {
        totalEmployees: employees.length,
        availableEmployees: analysis.filter(e => e.isAvailable),
        busyEmployees: analysis.filter(e => !e.isAvailable),
        lowTaskEmployees,
        allEmployees: analysis
      };
    } catch (error) {
      console.error('Error analyzing employee availability:', error);
      throw error;
    }
  }

  async getEmployeeTaskStats(employeeId, branchFilter = {}) {
    const now = new Date();
    
    // Get all tasks for employee filtered by branch
    const taskQuery = { assignee: employeeId, ...branchFilter };
    const allTasks = await Task.find(taskQuery);
    
    // Categorize tasks
    const completedTasks = allTasks.filter(task => task.status === 'Completed');
    const activeTasks = allTasks.filter(task => task.status !== 'Completed');
    const overdueTasks = activeTasks.filter(task => task.dueDate && task.dueDate < now);
    const upcomingTasks = activeTasks.filter(task => task.dueDate && task.dueDate >= now);

    // Calculate completion rate
    const completionRate = allTasks.length > 0 ? (completedTasks.length / allTasks.length) * 100 : 0;

    // Determine availability (less than 2 active tasks)
    const isAvailable = activeTasks.length < 2;
    const hasLowTasks = activeTasks.length < 1;

    return {
      totalTasks: allTasks.length,
      completedTasks: completedTasks.length,
      activeTasks: activeTasks.length,
      overdueTasks: overdueTasks.length,
      upcomingTasks: upcomingTasks.length,
      completionRate: Math.round(completionRate),
      isAvailable,
      availabilityScore: this.calculateAvailabilityScore(activeTasks.length, overdueTasks.length, completionRate)
    };
  }

  calculateAvailabilityScore(activeTasks, overdueTasks, completionRate) {
    let score = 100;
    
    // Reduce score based on active tasks
    score -= activeTasks * 25;
    
    // Reduce score more for overdue tasks
    score -= overdueTasks * 40;
    
    // Boost score for high completion rate
    if (completionRate > 80) score += 10;
    
    return Math.max(0, Math.min(100, score));
  }

  async getTopPerformers(limit = 5, branchFilter = {}) {
    try {
      // Only fetch ACTIVE employees (exclude exited/terminated employees) - filtered by branch
      const employees = await User.find({ 
        role: 'User',
        stillExist: 1, // Only include active employees (0 = exited, 1 = active)
        ...branchFilter
      }).select('name email stillExist branch');
      const performers = [];

      for (const employee of employees) {
        const stats = await this.getEmployeeTaskStats(employee._id, branchFilter);
        performers.push({
          employeeId: employee._id,
          name: employee.name,
          email: employee.email,
          completionRate: stats.completionRate,
          availabilityScore: stats.availabilityScore,
          totalTasks: stats.totalTasks
        });
      }

      return performers
        .sort((a, b) => b.completionRate - a.completionRate)
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting top performers:', error);
      throw error;
    }
  }

  async getAvailableEmployees(minAvailabilityScore = 50, branchFilter = {}) {
    try {
      // Only fetch ACTIVE employees (exclude exited/terminated employees) - filtered by branch
      const employees = await User.find({ 
        role: 'User',
        stillExist: 1, // Only include active employees (0 = exited, 1 = active)
        ...branchFilter
      }).select('name email department stillExist branch');
      const available = [];

      for (const employee of employees) {
        const stats = await this.getEmployeeTaskStats(employee._id, branchFilter);
        
        if (stats.isAvailable && stats.availabilityScore >= minAvailabilityScore) {
          available.push({
            employeeId: employee._id,
            name: employee.name,
            email: employee.email,
            department: employee.department,
            availabilityScore: stats.availabilityScore,
            activeTasks: stats.activeTasks,
            completionRate: stats.completionRate
          });
        }
      }

      return available.sort((a, b) => b.availabilityScore - a.availabilityScore);
    } catch (error) {
      console.error('Error getting available employees:', error);
      throw error;
    }
  }

  async generateProcurementReport(adminId, branchFilter = {}) {
    try {
      const analysis = await this.analyzeEmployeeAvailability(adminId, branchFilter);
      const topPerformers = await this.getTopPerformers(5, branchFilter);
      const availableEmployees = await this.getAvailableEmployees(50, branchFilter);

      const report = {
        timestamp: new Date().toISOString(),
        summary: {
          totalEmployees: analysis.totalEmployees,
          availableEmployees: analysis.availableEmployees.length,
          busyEmployees: analysis.busyEmployees.length,
          availabilityRate: Math.round((analysis.availableEmployees.length / analysis.totalEmployees) * 100)
        },
        topPerformers,
        availableEmployees,
        recommendations: this.generateRecommendations(analysis, availableEmployees)
      };

      // Log report generation
      await auditLogger.logEvent(
        adminId,
        'procurement_report_generated',
        'employee_analysis',
        {
          total_employees: report.summary.totalEmployees,
          available_count: report.summary.availableEmployees,
          availability_rate: report.summary.availabilityRate
        }
      );

      return report;
    } catch (error) {
      console.error('Error generating procurement report:', error);
      throw error;
    }
  }

  async sendLowTaskNotifications(adminId, lowTaskEmployees) {
    try {
      const Notification = require('../models/Notification');
      
      // Create notification for admin
      const notification = new Notification({
        recipient: adminId,
        title: 'Low Task Alert',
        message: `${lowTaskEmployees.length} employees have less than 1 active task: ${lowTaskEmployees.map(e => e.name).join(', ')}`,
        type: 'procurement_alert',
        priority: 'high',
        data: {
          employeeCount: lowTaskEmployees.length,
          employees: lowTaskEmployees.map(e => ({
            id: e.employeeId,
            name: e.name,
            email: e.email,
            activeTasks: e.activeTasks
          }))
        }
      });
      
      await notification.save();
      console.log(`📢 Procurement alert sent: ${lowTaskEmployees.length} employees with low task count`);
      
    } catch (error) {
      console.error('Error sending low task notifications:', error);
    }
  }

  generateRecommendations(analysis, availableEmployees) {
    const recommendations = [];

    // Check for employees with no tasks
    if (analysis.lowTaskEmployees && analysis.lowTaskEmployees.length > 0) {
      recommendations.push({
        type: 'urgent_assignment',
        message: `${analysis.lowTaskEmployees.length} employees have less than 1 active task and need immediate assignment`,
        priority: 'critical',
        employees: analysis.lowTaskEmployees.map(e => e.name)
      });
    }

    if (availableEmployees.length > 0) {
      recommendations.push({
        type: 'task_assignment',
        message: `${availableEmployees.length} employees are available for new task assignments`,
        priority: 'high',
        employees: availableEmployees.slice(0, 3).map(e => e.name)
      });
    }

    const highPerformers = analysis.allEmployees.filter(e => e.completionRate > 90 && e.isAvailable);
    if (highPerformers.length > 0) {
      recommendations.push({
        type: 'priority_assignment',
        message: `${highPerformers.length} high-performing employees available for priority tasks`,
        priority: 'medium',
        employees: highPerformers.map(e => e.name)
      });
    }

    const overloadedEmployees = analysis.allEmployees.filter(e => e.activeTasks > 3);
    if (overloadedEmployees.length > 0) {
      recommendations.push({
        type: 'workload_balance',
        message: `${overloadedEmployees.length} employees may be overloaded`,
        priority: 'high',
        employees: overloadedEmployees.map(e => e.name)
      });
    }

    return recommendations;
  }
}

module.exports = new ProcurementAgent();