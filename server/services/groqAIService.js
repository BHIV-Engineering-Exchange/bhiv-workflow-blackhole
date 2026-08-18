const uniguruAIService = require('./uniguruAIService');

class GroqAIService {
  constructor() {
    this.serviceName = 'UniGuru AI Service Integration';
  }

  /**
   * Analyze screenshot content using UniGuru AI
   */
  async analyzeScreenshot(screenshotPath, context = {}) {
    try {
      const prompt = this.buildAnalysisPrompt(context);
      const aiResult = await uniguruAIService.ask(prompt, {
        domain: 'Employee Activity & Screenshot Monitoring',
        context
      });

      if (aiResult && aiResult.answer) {
        return this.parseAnalysisResponseText(aiResult.answer, context);
      }

      return this.createFallbackAnalysis(context);
    } catch (error) {
      console.error('UniGuru AI screenshot analysis error:', error);
      return this.createFallbackAnalysis(context);
    }
  }

  /**
   * Build analysis prompt based on context
   */
  buildAnalysisPrompt(context) {
    const { currentTask, applicationData } = context;
    let prompt = `Analyze screenshot activity and assess appropriateness for work environment.`;
    if (currentTask) {
      prompt += ` Assigned Task: "${currentTask.title}" - ${currentTask.description}`;
    }
    if (applicationData?.url) {
      prompt += ` Active URL: ${applicationData.url}`;
    }
    if (applicationData?.name) {
      prompt += ` Application: ${applicationData.name}`;
    }
    return prompt;
  }

  parseAnalysisResponseText(text, context) {
    let contentType = 'General Activity';
    let riskLevel = 'low';

    const lower = text.toLowerCase();
    if (lower.includes('high risk') || lower.includes('inappropriate') || lower.includes('gaming')) {
      riskLevel = 'high';
      contentType = 'Non-work related';
    } else if (lower.includes('medium risk') || lower.includes('social media') || lower.includes('shopping')) {
      riskLevel = 'medium';
      contentType = 'Personal browsing';
    } else {
      contentType = 'Work document / Development';
    }

    return {
      contentType,
      activityDescription: text.substring(0, 300),
      workplaceAppropriateness: {
        isAppropriate: riskLevel !== 'high',
        category: contentType,
        explanation: text.substring(0, 200)
      },
      contentRisk: {
        level: riskLevel,
        factors: [contentType],
        explanation: 'Evaluated by UniGuru AI'
      },
      taskRelevance: {
        relevanceScore: riskLevel === 'low' ? 90 : 30,
        alignmentExplanation: 'Processed via UniGuru Reasoning Engine'
      },
      summary: text.substring(0, 250),
      analyzedAt: new Date(),
      aiModel: 'uniguru-reasoning-engine'
    };
  }

  createFallbackAnalysis(context) {
    return {
      contentType: 'Work Activity',
      activityDescription: 'General desktop usage',
      workplaceAppropriateness: {
        isAppropriate: true,
        category: 'Standard Work',
        explanation: 'Default fallback analysis'
      },
      contentRisk: {
        level: 'low',
        factors: [],
        explanation: 'Offline rule-based fallback'
      },
      taskRelevance: {
        relevanceScore: 75,
        alignmentExplanation: 'Assumed productive by default'
      },
      summary: 'Fallback activity record',
      analyzedAt: new Date(),
      aiModel: 'offline-fallback'
    };
  }

  /**
   * Analyze attendance patterns using UniGuru AI
   */
  async analyzeAttendancePatterns(attendanceData, userContext = {}) {
    try {
      const stats = this.calculateAttendanceStats(attendanceData);
      const prompt = `Analyze attendance data for ${userContext.role || 'Employee'}:
Total Days: ${stats.totalDays}, Present: ${stats.presentDays}, Absent: ${stats.absentDays}, Rate: ${stats.attendanceRate}%, Avg Hours: ${stats.avgHours}.
Identify patterns, risk factors, and actionable recommendations.`;

      const aiResult = await uniguruAIService.ask(prompt, {
        domain: 'Attendance Analytics',
        context: userContext
      });

      return {
        patterns: {
          attendanceTrend: stats.attendanceRate >= 80 ? 'stable' : 'declining',
          punctualityPattern: 'Regular hours recorded',
          workingHoursConsistency: stats.avgHours >= 7 ? 'high' : 'medium'
        },
        risks: {
          level: stats.attendanceRate < 75 ? 'high' : 'low',
          factors: stats.absentDays > 3 ? ['High absenteeism'] : [],
          probability: stats.attendanceRate < 75 ? '65%' : '15%'
        },
        insights: [aiResult.answer || 'Attendance rate within normal operating parameters.'],
        recommendations: ['Maintain regular schedule check-ins.'],
        predictions: {
          nextMonthAttendance: `${stats.attendanceRate}%`,
          potentialIssues: []
        },
        metadata: {
          analysisDate: new Date(),
          dataPoints: attendanceData.length,
          confidence: 0.85,
          aiModel: 'uniguru-reasoning-engine'
        },
        metrics: stats
      };
    } catch (error) {
      console.error('UniGuru Attendance pattern analysis error:', error);
      return this.createFallbackAttendanceAnalysis(attendanceData);
    }
  }

  calculateAttendanceStats(attendanceData) {
    const totalDays = attendanceData.length;
    const presentDays = attendanceData.filter(d => d.isPresent).length;
    const absentDays = totalDays - presentDays;
    const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;
    const totalHours = attendanceData.reduce((sum, d) => sum + (d.hoursWorked || 0), 0);
    const avgHours = presentDays > 0 ? Math.round((totalHours / presentDays) * 100) / 100 : 0;

    return {
      totalDays,
      presentDays,
      absentDays,
      attendanceRate,
      avgHours
    };
  }

  createFallbackAttendanceAnalysis(attendanceData) {
    const stats = this.calculateAttendanceStats(attendanceData);
    return {
      patterns: {
        attendanceTrend: 'stable',
        punctualityPattern: 'Standard operating hours',
        workingHoursConsistency: 'high'
      },
      risks: {
        level: 'low',
        factors: [],
        probability: '10%'
      },
      insights: ['Attendance tracking within regular range.'],
      recommendations: ['Continue routine monitoring.'],
      predictions: {
        nextMonthAttendance: `${stats.attendanceRate}%`,
        potentialIssues: []
      },
      metadata: {
        analysisDate: new Date(),
        dataPoints: attendanceData.length,
        confidence: 0.7,
        aiModel: 'offline-fallback'
      },
      metrics: stats
    };
  }

  detectConsistentActivity(screenshots) {
    if (screenshots.length < 2) return false;
    const activities = screenshots.map(s => s.activityDescription || '').filter(Boolean);
    const unique = new Set(activities);
    return unique.size <= 2;
  }

  calculateEscalationLevel(screenshots) {
    const highRisk = screenshots.filter(s => s.contentRisk?.level === 'high').length;
    if (highRisk > 1) return 'high';
    if (screenshots.some(s => s.contentRisk?.level === 'medium')) return 'medium';
    return 'low';
  }

  calculateTimeSpent(screenshots) {
    if (screenshots.length < 2) return 0;
    const first = new Date(screenshots[0].timestamp || Date.now());
    const last = new Date(screenshots[screenshots.length - 1].timestamp || Date.now());
    return Math.max(0, Math.round((last - first) / 60000));
  }
}

module.exports = new GroqAIService();
