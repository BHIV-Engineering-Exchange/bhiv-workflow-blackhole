const PDFDocument = require('pdfkit');
const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const User = require('../models/User');
const Department = require('../models/Department');
const ScreenCapture = require('../models/ScreenCapture');
const EmployeeActivity = require('../models/EmployeeActivity');
const MonitoringAlert = require('../models/MonitoringAlert');

class ReportGenerator {
  constructor() {
    this.chartRenderer = new ChartJSNodeCanvas({ 
      width: 700, 
      height: 280,
      backgroundColour: 'white'
    });
    this.reportsDir = process.env.REPORTS_STORAGE_PATH || './uploads/reports';
    this.ensureReportsDirectory();
  }

  async ensureReportsDirectory() {
    try {
      await fsPromises.mkdir(this.reportsDir, { recursive: true });
    } catch (error) {
      console.error('Error creating reports directory:', error);
    }
  }

  /**
   * Generate comprehensive employee monitoring report in PDF format
   */
  async generateEmployeeReport(employeeId, startDate, endDate, options = {}) {
    try {
      const employee = await this.getEmployeeInfo(employeeId);
      const reportData = await this.gatherReportData(employeeId, startDate, endDate);
      
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 40,
        info: {
          Title: `Employee Monitoring Report - ${employee.name}`,
          Author: 'Niyantran Workflow Monitoring System',
          Subject: 'Employee Productivity and Activity Report',
          Keywords: 'monitoring, productivity, analytics, niyantran'
        }
      });

      const filename = `employee_report_${employeeId}_${Date.now()}.pdf`;
      const filepath = path.join(this.reportsDir, filename);

      const writeStream = fs.createWriteStream(filepath);
      doc.pipe(writeStream);

      // PAGE 1: Header, Executive KPI Summary, and Daily Breakdown Table
      await this.addReportHeader(doc, employee, startDate, endDate);
      await this.addExecutiveSummary(doc, reportData);
      await this.addDailyBreakdownTable(doc, reportData);

      // PAGE 2: Top Applications, Activity Timeline, and Policy Alerts
      doc.addPage();
      await this.addApplicationUsageSection(doc, reportData);
      await this.addViolationsSection(doc, reportData);
      await this.addActivityTimelineSection(doc, reportData);

      // PAGE 3: Visual Analytics Charts & Recommendations
      doc.addPage();
      await this.addChartsAndGraphs(doc, reportData);
      await this.addRecommendations(doc, reportData);

      doc.end();

      return new Promise((resolve, reject) => {
        writeStream.on('finish', () => {
          resolve({
            filename,
            filepath,
            size: writeStream.bytesWritten,
            generatedAt: new Date()
          });
        });
        writeStream.on('error', reject);
      });

    } catch (error) {
      console.error('Error generating employee report:', error);
      throw error;
    }
  }

  /**
   * Fetch all necessary data for the report
   */
  async gatherReportData(employeeId, startDate, endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const [screenshots, activities, alerts] = await Promise.all([
      ScreenCapture.find({
        employee: employeeId,
        timestamp: { $gte: start, $lte: end }
      }).select('timestamp trigger_type is_violation').sort({ timestamp: -1 }).lean(),

      EmployeeActivity.find({
        employee: employeeId,
        timestamp: { $gte: start, $lte: end }
      }).select('timestamp keystroke_count mouse_activity_score idle_duration productivity_score active_application').sort({ timestamp: -1 }).lean(),

      MonitoringAlert.find({
        employee: employeeId,
        timestamp: { $gte: start, $lte: end }
      }).select('timestamp alert_type severity title description').sort({ timestamp: -1 }).lean()
    ]);

    return {
      screenshots: screenshots || [],
      activities: activities || [],
      alerts: alerts || [],
      period: { startDate, endDate }
    };
  }

  async getEmployeeInfo(employeeId) {
    const emp = await User.findById(employeeId).populate('department', 'name').lean();
    if (!emp) {
      return { name: 'Employee', email: '', department: 'General', stillExist: 1 };
    }
    return {
      name: emp.name || 'Employee',
      email: emp.email || '',
      department: emp.department?.name || emp.department || 'General',
      stillExist: emp.stillExist
    };
  }

  /**
   * PAGE 1: Header Banner with crisp typography (No overlap, proper branding)
   */
  async addReportHeader(doc, employee, startDate, endDate) {
    const pageWidth = doc.page.width; // 595 for A4

    // Header Background Banner
    doc.rect(0, 0, pageWidth, 95)
       .fill('#0f172a'); // Deep slate

    // Left Accent Bar
    doc.rect(0, 0, 6, 95)
       .fill('#3b82f6'); // Bright blue

    // Title
    doc.fillColor('#ffffff')
       .fontSize(18)
       .font('Helvetica-Bold')
       .text('NIYANTRAN WORKFLOW', 40, 22);

    doc.fillColor('#94a3b8')
       .fontSize(10)
       .font('Helvetica')
       .text('Employee Telemetry & Activity Monitoring Report', 40, 44);

    // Metadata Row
    const deptName = typeof employee.department === 'object' ? (employee.department?.name || 'General') : (employee.department || 'General');
    const startStr = new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const endStr = new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    doc.fontSize(9)
       .fillColor('#e2e8f0')
       .font('Helvetica-Bold')
       .text(`Employee: `, 40, 68, { continued: true })
       .font('Helvetica')
       .text(`${employee.name} (${employee.email || 'N/A'})`, { continued: true })
       .font('Helvetica-Bold')
       .text(`   •   Department: `, { continued: true })
       .font('Helvetica')
       .text(`${deptName}`);

    doc.fontSize(8.5)
       .fillColor('#94a3b8')
       .text(`Period: ${startStr} to ${endStr}   •   Status: ${employee.stillExist === 0 ? 'Exited Account' : 'Active Employee'}`, 40, 81);

    // Set document cursor below banner
    doc.y = 110;
  }

  /**
   * PAGE 1: Executive KPI Cards (Row of 4 perfectly aligned cards)
   */
  async addExecutiveSummary(doc, reportData) {
    const summary = this.calculateExecutiveSummary(reportData);

    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor('#0f172a')
       .text('EXECUTIVE KPI SUMMARY', 40, doc.y);

    const boxY = doc.y + 6;
    const boxWidth = 117;
    const boxHeight = 58;
    const gap = 15;
    const startX = 40;

    const summaryItems = [
      {
        label: 'Productivity Score',
        value: `${summary.productivityScore}%`,
        color: summary.productivityScore >= 75 ? '#10b981' : (summary.productivityScore >= 50 ? '#f59e0b' : '#ef4444')
      },
      {
        label: 'Active Work Hours',
        value: `${summary.activeHours}h`,
        color: '#0284c7'
      },
      {
        label: 'Total Keystrokes',
        value: summary.totalKeystrokes.toLocaleString(),
        color: '#8b5cf6'
      },
      {
        label: 'Security Violations',
        value: `${summary.violations}`,
        color: summary.violations > 0 ? '#ef4444' : '#10b981'
      }
    ];

    summaryItems.forEach((item, index) => {
      const currentX = startX + index * (boxWidth + gap);

      // Card Background with smooth rounded borders
      doc.roundedRect(currentX, boxY, boxWidth, boxHeight, 6)
         .fillAndStroke('#f8fafc', '#e2e8f0');

      // Value
      doc.fillColor(item.color)
         .fontSize(18)
         .font('Helvetica-Bold')
         .text(item.value, currentX, boxY + 12, { width: boxWidth, align: 'center' });

      // Label
      doc.fillColor('#64748b')
         .fontSize(8.5)
         .font('Helvetica')
         .text(item.label, currentX, boxY + 36, { width: boxWidth, align: 'center' });
    });

    // Advance cursor safely
    doc.y = boxY + boxHeight + 18;
  }

  /**
   * PAGE 1: Daily Breakdown Table
   */
  async addDailyBreakdownTable(doc, reportData) {
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor('#0f172a')
       .text('DAILY PERFORMANCE BREAKDOWN', 40, doc.y);

    doc.moveDown(0.5);

    // Group activities by date
    const dailyMap = {};
    const start = new Date(reportData.period.startDate);
    const end = new Date(reportData.period.endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dStr = d.toISOString().split('T')[0];
      dailyMap[dStr] = {
        date: dStr,
        activitiesCount: 0,
        keystrokes: 0,
        mouseSum: 0,
        activeSeconds: 0,
        prodSum: 0,
        topApps: {}
      };
    }

    reportData.activities.forEach(act => {
      const dStr = new Date(act.timestamp).toISOString().split('T')[0];
      if (dailyMap[dStr]) {
        dailyMap[dStr].activitiesCount++;
        dailyMap[dStr].keystrokes += (act.keystroke_count || 0);
        dailyMap[dStr].mouseSum += (act.mouse_activity_score || 0);
        
        const isActive = (act.keystroke_count || 0) > 0 || (act.mouse_activity_score || 0) >= 15;
        let idle = 0;
        if (!isActive) {
          let raw = act.idle_duration || 0;
          if (raw > 10000) raw = Math.round(raw / 1000);
          idle = Math.min(30, raw > 0 ? raw : 30);
        }
        dailyMap[dStr].activeSeconds += Math.max(0, 30 - idle);

        if (act.productivity_score > 0) {
          dailyMap[dStr].prodSum += act.productivity_score;
        }

        let appName = act.active_application?.name;
        if (!appName || appName === 'Unknown' || appName === 'null') {
          appName = isActive ? 'Desktop Workspace' : 'System Background';
        }
        dailyMap[dStr].topApps[appName] = (dailyMap[dStr].topApps[appName] || 0) + 1;
      }
    });

    const dailyRows = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    // Table Column Coordinates (Total width = 515)
    const tableX = 40;
    const tableWidth = 515;
    let currentY = doc.y;

    // Table Header
    doc.rect(tableX, currentY, tableWidth, 22)
       .fill('#1e293b');

    doc.fillColor('#ffffff')
       .fontSize(8.5)
       .font('Helvetica-Bold');

    doc.text('Date', tableX + 8, currentY + 6, { width: 75 });
    doc.text('Activities', tableX + 85, currentY + 6, { width: 60, align: 'center' });
    doc.text('Productivity', tableX + 150, currentY + 6, { width: 70, align: 'center' });
    doc.text('Active Hours', tableX + 225, currentY + 6, { width: 65, align: 'center' });
    doc.text('Keystrokes', tableX + 295, currentY + 6, { width: 65, align: 'center' });
    doc.text('Mouse Score', tableX + 365, currentY + 6, { width: 65, align: 'center' });
    doc.text('Efficiency', tableX + 435, currentY + 6, { width: 75, align: 'right' });

    currentY += 22;

    // Render table rows
    dailyRows.forEach((row, idx) => {
      const isZebra = idx % 2 === 1;
      const rowHeight = 20;

      // Background
      doc.rect(tableX, currentY, tableWidth, rowHeight)
         .fill(isZebra ? '#f8fafc' : '#ffffff');

      // Thin bottom border
      doc.rect(tableX, currentY + rowHeight - 1, tableWidth, 1)
         .fill('#e2e8f0');

      const count = row.activitiesCount;
      const avgProd = count > 0 ? Math.round(row.prodSum / count) : 0;
      const activeHours = (row.activeSeconds / 3600).toFixed(1);
      const avgMouse = count > 0 ? Math.round(row.mouseSum / count) : 0;

      let eff = 'No Activity';
      let effColor = '#94a3b8';
      if (count > 0) {
        if (avgProd >= 75) {
          eff = 'High Efficiency';
          effColor = '#10b981';
        } else if (avgProd >= 50) {
          eff = 'Moderate';
          effColor = '#f59e0b';
        } else {
          eff = 'Low Efficiency';
          effColor = '#ef4444';
        }
      }

      doc.fontSize(8).font('Helvetica');

      // Date
      doc.fillColor('#0f172a')
         .text(row.date, tableX + 8, currentY + 5);

      // Activities
      doc.fillColor('#475569')
         .text(count.toString(), tableX + 85, currentY + 5, { width: 60, align: 'center' });

      // Productivity %
      doc.fillColor(count > 0 ? effColor : '#94a3b8')
         .font(count > 0 ? 'Helvetica-Bold' : 'Helvetica')
         .text(count > 0 ? `${avgProd}%` : '-', tableX + 150, currentY + 5, { width: 70, align: 'center' });

      // Active Hours
      doc.fillColor('#0f172a')
         .font('Helvetica')
         .text(count > 0 ? `${activeHours}h` : '0h', tableX + 225, currentY + 5, { width: 65, align: 'center' });

      // Keystrokes
      doc.fillColor('#475569')
         .text(row.keystrokes > 0 ? row.keystrokes.toLocaleString() : '-', tableX + 295, currentY + 5, { width: 65, align: 'center' });

      // Mouse Score
      doc.fillColor('#475569')
         .text(count > 0 ? `${avgMouse}%` : '-', tableX + 365, currentY + 5, { width: 65, align: 'center' });

      // Efficiency Rating
      doc.fillColor(effColor)
         .font('Helvetica-Bold')
         .text(eff, tableX + 435, currentY + 5, { width: 75, align: 'right' });

      currentY += rowHeight;
    });

    doc.y = currentY + 15;
  }

  /**
   * PAGE 2: Top Application Usage & Distribution
   */
  async addApplicationUsageSection(doc, reportData) {
    const pageWidth = doc.page.width;

    // Header on Page 2
    doc.rect(0, 0, pageWidth, 45)
       .fill('#0f172a');

    doc.fillColor('#ffffff')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('NIYANTRAN WORKFLOW - WORKSPACE & SECURITY AUDIT', 40, 16);

    doc.y = 65;

    doc.fontSize(13)
       .font('Helvetica-Bold')
       .fillColor('#0f172a')
       .text('APPLICATION & WORKSPACE USAGE', 40, doc.y);

    doc.moveDown(0.6);

    const appStats = this.calculateActivityStats(reportData.activities);
    const sortedApps = Object.entries(appStats).sort((a, b) => b[1] - a[1]);
    const totalActs = reportData.activities.length || 1;

    if (sortedApps.length === 0) {
      doc.fontSize(9.5)
         .font('Helvetica')
         .fillColor('#64748b')
         .text('No active application usage recorded in this period.', 40, doc.y);
      doc.moveDown(1.5);
      return;
    }

    const startX = 40;
    let currentY = doc.y;

    sortedApps.slice(0, 6).forEach(([appName, count]) => {
      const pct = Math.round((count / totalActs) * 100);
      const estMinutes = Math.round((count * 30) / 60);

      doc.fontSize(9)
         .font('Helvetica-Bold')
         .fillColor('#1e293b')
         .text(appName, startX, currentY, { width: 200 });

      doc.font('Helvetica')
         .fillColor('#64748b')
         .text(`${count} sessions (~${estMinutes} mins)`, startX + 210, currentY, { width: 140 });

      // Progress bar background
      const barX = startX + 360;
      const barWidth = 150;
      doc.roundedRect(barX, currentY + 2, barWidth, 7, 3)
         .fill('#e2e8f0');

      // Filled progress
      const fillW = Math.max(3, Math.round((pct / 100) * barWidth));
      doc.roundedRect(barX, currentY + 2, fillW, 7, 3)
         .fill('#3b82f6');

      doc.fontSize(8)
         .fillColor('#1e293b')
         .font('Helvetica-Bold')
         .text(`${pct}%`, barX + barWidth + 8, currentY);

      currentY += 18;
    });

    doc.y = currentY + 15;
  }

  /**
   * PAGE 2: Policy Violations & Security Alerts (No black boxes, 100% visible text)
   */
  async addViolationsSection(doc, reportData) {
    doc.fontSize(13)
       .font('Helvetica-Bold')
       .fillColor('#0f172a')
       .text('POLICY VIOLATIONS & SECURITY ALERTS', 40, doc.y);

    doc.moveDown(0.6);

    const alerts = reportData.alerts || [];

    if (alerts.length === 0) {
      // Clean checkmark card
      const boxY = doc.y;
      doc.roundedRect(40, boxY, 515, 36, 6)
         .fillAndStroke('#f0fdf4', '#bbf7d0');

      doc.fillColor('#15803d')
         .fontSize(9.5)
         .font('Helvetica-Bold')
         .text('✓ No policy violations or security alerts detected during this period.', 55, boxY + 11);

      doc.y = boxY + 48;
      return;
    }

    const boxWidth = 515;
    const boxHeight = 50;

    alerts.slice(0, 4).forEach((alert) => {
      const boxY = doc.y;
      const isHigh = alert.severity === 'high';
      const isMed = alert.severity === 'medium';

      const bg = isHigh ? '#fef2f2' : (isMed ? '#fffbeb' : '#f8fafc');
      const border = isHigh ? '#fca5a5' : (isMed ? '#fde68a' : '#cbd5e1');
      const titleColor = isHigh ? '#b91c1c' : (isMed ? '#b45309' : '#1e40af');

      // Card Background (Light pastel with clean border)
      doc.roundedRect(40, boxY, boxWidth, boxHeight, 6)
         .fillAndStroke(bg, border);

      // Title
      doc.fillColor(titleColor)
         .fontSize(10)
         .font('Helvetica-Bold')
         .text(alert.title || 'Security Notification', 52, boxY + 8, { width: boxWidth - 24 });

      // Description (Crisp charcoal text)
      doc.fillColor('#1e293b')
         .fontSize(8.5)
         .font('Helvetica')
         .text(alert.description || 'Automated policy rule triggered', 52, boxY + 22, { width: boxWidth - 24, lineBreak: false });

      // Severity and Timestamp
      const tsStr = new Date(alert.timestamp).toLocaleString();
      doc.fillColor('#64748b')
         .fontSize(7.5)
         .text(`${tsStr}  •  Severity: ${String(alert.severity || 'low').toUpperCase()}`, 52, boxY + 35);

      doc.y = boxY + boxHeight + 8;
    });

    doc.moveDown(0.8);
  }

  /**
   * PAGE 2: Activity Timeline (Recent Sessions)
   */
  async addActivityTimelineSection(doc, reportData) {
    doc.fontSize(13)
       .font('Helvetica-Bold')
       .fillColor('#0f172a')
       .text('RECENT ACTIVITY TIMELINE', 40, doc.y);

    doc.moveDown(0.5);

    const timeline = this.createActivityTimeline(reportData.activities);

    if (timeline.length === 0) {
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor('#64748b')
         .text('No activity timeline recorded for this period.', 40, doc.y);
      return;
    }

    const startX = 40;
    let currentY = doc.y;

    timeline.slice(0, 10).forEach(entry => {
      // Timeline bullet
      doc.circle(startX + 4, currentY + 5, 2.5)
         .fill('#3b82f6');

      // Time
      doc.fontSize(8)
         .font('Helvetica-Bold')
         .fillColor('#0f172a')
         .text(entry.time, startX + 14, currentY, { width: 80 });

      // Activity Description
      doc.font('Helvetica')
         .fillColor('#334155')
         .text(entry.activity, startX + 100, currentY, { width: 400 });

      currentY += 16;
    });

    doc.y = currentY + 10;
  }

  /**
   * PAGE 3: Visual Analytics Charts
   */
  async addChartsAndGraphs(doc, reportData) {
    const pageWidth = doc.page.width;

    // Header on Page 3
    doc.rect(0, 0, pageWidth, 45)
       .fill('#0f172a');

    doc.fillColor('#ffffff')
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('NIYANTRAN WORKFLOW - VISUAL ANALYTICS & INSIGHTS', 40, 16);

    doc.y = 65;

    doc.fontSize(13)
       .font('Helvetica-Bold')
       .fillColor('#0f172a')
       .text('PRODUCTIVITY TREND ANALYSIS', 40, doc.y);

    doc.moveDown(0.5);

    try {
      const productivityChart = await this.generateProductivityChart(reportData);
      if (productivityChart) {
        const chartY = doc.y;
        doc.image(productivityChart, 40, chartY, { width: 515, height: 180 });
        doc.y = chartY + 200;
      }
    } catch (error) {
      console.warn('Chart render fallback:', error.message);
    }

    doc.moveDown(0.8);
  }

  /**
   * PAGE 3: Recommendations & Official Document Footer
   */
  async addRecommendations(doc, reportData) {
    doc.fontSize(13)
       .font('Helvetica-Bold')
       .fillColor('#0f172a')
       .text('PERFORMANCE RECOMMENDATIONS', 40, doc.y);

    doc.moveDown(0.6);

    const recommendations = this.generateRecommendations(reportData);

    recommendations.forEach((item, index) => {
      doc.fontSize(9.5)
         .font('Helvetica-Bold')
         .fillColor('#0f172a')
         .text(`${index + 1}. ${item.title}`, 45, doc.y);

      doc.fontSize(8.5)
         .font('Helvetica')
         .fillColor('#475569')
         .text(item.description, 60, doc.y, { width: 490 });

      doc.moveDown(0.6);
    });

    // Official Confidentiality Footer (Positioned within page bounds, preventing accidental extra page)
    const footerY = Math.min(doc.y + 25, 770);
    doc.rect(40, footerY, 515, 1)
       .fill('#e2e8f0');

    doc.fontSize(7.5)
       .font('Helvetica')
       .fillColor('#94a3b8')
       .text(`Generated on ${new Date().toLocaleString()}  •  Niyantran Workflow Monitoring System  •  Confidential`, 40, footerY + 8, { align: 'center', width: 515, lineBreak: false });
  }

  /**
   * Data calculation helpers
   */
  calculateExecutiveSummary(reportData) {
    const activities = reportData.activities || [];
    let totalKeys = 0;
    let totalMouse = 0;
    let totalActiveSec = 0;
    let totalProd = 0;
    let prodCount = 0;

    activities.forEach(act => {
      totalKeys += (act.keystroke_count || 0);
      totalMouse += (act.mouse_activity_score || 0);
      if (act.productivity_score > 0) {
        totalProd += act.productivity_score;
        prodCount++;
      }

      const isActive = (act.keystroke_count || 0) > 0 || (act.mouse_activity_score || 0) >= 15;
      let idle = 0;
      if (!isActive) {
        let raw = act.idle_duration || 0;
        if (raw > 10000) raw = Math.round(raw / 1000);
        idle = Math.min(30, raw > 0 ? raw : 30);
      }
      totalActiveSec += Math.max(0, 30 - idle);
    });

    const avgProd = prodCount > 0 ? Math.round(totalProd / prodCount) : 0;
    const activeHours = Math.round((totalActiveSec / 3600) * 10) / 10;
    const avgMouse = activities.length > 0 ? Math.round(totalMouse / activities.length) : 0;

    return {
      productivityScore: avgProd,
      activeHours,
      activeSeconds: totalActiveSec,
      totalKeystrokes: totalKeys,
      avgMouseActivity: avgMouse,
      violations: reportData.alerts?.length || 0,
      focusScore: avgProd > 0 ? Math.min(100, Math.round((avgProd * 0.7) + (avgMouse * 0.3))) : 0
    };
  }

  calculateActivityStats(activities) {
    const stats = {};
    (activities || []).forEach(act => {
      let appName = act.active_application?.name;
      if (!appName || appName === 'Unknown' || appName === 'null') {
        const isActive = (act.keystroke_count || 0) > 0 || (act.mouse_activity_score || 0) >= 15;
        appName = isActive ? 'Active Desktop Workspace' : 'System Background';
      }
      stats[appName] = (stats[appName] || 0) + 1;
    });
    return stats;
  }

  createActivityTimeline(activities) {
    return (activities || []).slice(0, 15).map(act => {
      let appName = act.active_application?.name;
      if (!appName || appName === 'Unknown' || appName === 'null') {
        const isActive = (act.keystroke_count || 0) > 0 || (act.mouse_activity_score || 0) >= 15;
        appName = isActive ? 'Active Desktop Workspace' : 'System Background';
      }
      const title = act.active_application?.title ? ` - ${act.active_application.title}` : '';
      const prod = act.productivity_score ? ` (Score: ${act.productivity_score}%)` : '';
      const timeStr = new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return {
        time: timeStr,
        activity: `${appName}${title}${prod}`
      };
    });
  }

  generateRecommendations(reportData) {
    const summary = this.calculateExecutiveSummary(reportData);
    const recs = [];

    if (summary.productivityScore < 60) {
      recs.push({
        title: 'Structured Work Blocks',
        description: 'Implement focused 45-minute working intervals with targeted deliverables to boost consistency.'
      });
    } else {
      recs.push({
        title: 'Maintain Productive Cadence',
        description: 'Activity rhythms demonstrate strong workflow discipline. Continue regular task execution habits.'
      });
    }

    if (summary.violations > 0) {
      recs.push({
        title: 'Review System Alerts & Idle Thresholds',
        description: 'Resolve recurring idle timeouts by ensuring work sessions are properly concluded prior to breaks.'
      });
    }

    recs.push({
      title: 'Ergonomic & Activity Balance',
      description: 'Maintain steady mouse and keyboard inputs while ensuring short screen breaks during intensive coding.'
    });

    return recs;
  }

  /**
   * Chart generation with actual telemetry
   */
  async generateProductivityChart(reportData) {
    try {
      const labels = this.getTimeLabels(reportData.period);
      const data = this.getProductivityData(reportData);

      const chartConfig = {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Daily Productivity Score (%)',
            data,
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            fill: true,
            tension: 0.3,
            borderWidth: 2,
            pointBackgroundColor: '#2563eb',
            pointRadius: 4
          }]
        },
        options: {
          responsive: false,
          animation: false,
          plugins: {
            legend: {
              display: true,
              labels: { font: { size: 10 } }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: { font: { size: 9 }, stepSize: 20 }
            },
            x: {
              ticks: { font: { size: 8 } }
            }
          }
        }
      };

      return await this.chartRenderer.renderToBuffer(chartConfig);
    } catch (error) {
      console.warn('Error generating productivity chart buffer:', error.message);
      return null;
    }
  }

  getTimeLabels(period) {
    const labels = [];
    const start = new Date(period.startDate);
    const end = new Date(period.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
    }
    return labels;
  }

  getProductivityData(reportData) {
    const dailyMap = {};
    (reportData.activities || []).forEach(act => {
      const dStr = new Date(act.timestamp).toISOString().split('T')[0];
      if (!dailyMap[dStr]) dailyMap[dStr] = { sum: 0, count: 0 };
      if (act.productivity_score > 0) {
        dailyMap[dStr].sum += act.productivity_score;
        dailyMap[dStr].count++;
      }
    });

    const start = new Date(reportData.period.startDate);
    const end = new Date(reportData.period.endDate);
    const scores = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dStr = d.toISOString().split('T')[0];
      const day = dailyMap[dStr];
      scores.push(day && day.count > 0 ? Math.round(day.sum / day.count) : 0);
    }

    return scores;
  }

  /**
   * Comprehensive CSV Export method
   */
  async exportToCSV(employeeId, startDate, endDate, dataType = 'all') {
    try {
      const employee = await this.getEmployeeInfo(employeeId);
      const reportData = await this.gatherReportData(employeeId, startDate, endDate);
      const summary = this.calculateExecutiveSummary(reportData);

      const startStr = new Date(startDate).toISOString().split('T')[0];
      const endStr = new Date(endDate).toISOString().split('T')[0];

      let csv = 'NIYANTRAN WORKFLOW - EMPLOYEE PERFORMANCE REPORT\n';
      csv += `Employee Name,${employee.name}\n`;
      csv += `Email,${employee.email}\n`;
      csv += `Department,${employee.department}\n`;
      csv += `Status,${employee.stillExist === 0 ? 'Exited' : 'Active'}\n`;
      csv += `Period,${startStr} to ${endStr}\n`;
      csv += `Generated At,${new Date().toISOString()}\n\n`;

      csv += 'EXECUTIVE KPI SUMMARY\n';
      csv += 'Total Activities,Average Productivity Score (%),Active Hours,Total Keystrokes,Total Alerts\n';
      csv += `${reportData.activities.length},${summary.productivityScore}%,${summary.activeHours}h,${summary.totalKeystrokes},${summary.violations}\n\n`;

      csv += 'DETAILED ACTIVITY LOGS\n';
      csv += 'Timestamp,Application,Window Title,Productivity Score (%),Idle Duration (s),Keystrokes,Mouse Score (%)\n';

      if (reportData.activities.length > 0) {
        reportData.activities.forEach(act => {
          const ts = act.timestamp ? new Date(act.timestamp).toISOString() : '';
          const app = (act.active_application?.name || 'Workspace').replace(/"/g, '""');
          const title = (act.active_application?.title || '').replace(/"/g, '""');
          csv += `"${ts}","${app}","${title}",${act.productivity_score || 0},${act.idle_duration || 0},${act.keystroke_count || 0},${act.mouse_activity_score || 0}\n`;
        });
      } else {
        csv += 'No activity logs recorded in this period\n';
      }

      const filename = `employee_export_${employeeId}_${Date.now()}.csv`;
      const filepath = path.join(this.reportsDir, filename);
      await fsPromises.writeFile(filepath, '\uFEFF' + csv, 'utf8');

      return {
        filename,
        filepath,
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Error in exportToCSV:', error);
      throw error;
    }
  }
}

module.exports = new ReportGenerator();
