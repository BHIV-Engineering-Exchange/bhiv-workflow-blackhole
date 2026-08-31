const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generates a dynamic document-style PDF task brief based on the actual task parameters.
 * @param {Object} task Task object containing title, description, assignee, priority, department, etc.
 * @param {Object} assignee Candidate user object (optional)
 * @returns {Promise<string>} Relative URL path to the generated PDF file (e.g. /uploads/task_brief_123.pdf)
 */
async function generateTaskBriefPdf(task, assignee = null) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const timestamp = Date.now();
      const fileName = `task_brief_${task._id || timestamp}.pdf`;
      const uploadsDir = path.join(__dirname, '..', 'uploads');

      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const filePath = path.join(uploadsDir, fileName);
      const writeStream = fs.createWriteStream(filePath);

      doc.pipe(writeStream);

      // --- DYNAMIC DATA ---
      const candidateName = assignee?.name || (task.assignee?.name ? task.assignee.name : 'Assigned Candidate');
      const departmentName = task.department?.name || 'General';
      const priorityStr = task.priority || 'Medium';
      const targetDate = task.dueDate 
        ? new Date(task.dueDate).toISOString().split('T')[0] 
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const taskTitle = task.title || 'Task Specification Brief';
      const taskDescription = task.description || `Complete the objectives for task '${taskTitle}' according to project standards.`;

      // --- 1. CLEAN TOP HEADER BLOCK ---
      let y = 50;

      doc.fillColor('#000000').font('Helvetica-Bold').fontSize(10);
      doc.text('Task Title: ', 50, y, { continued: true });
      doc.font('Helvetica').text(taskTitle);

      y = doc.y + 4;
      doc.font('Helvetica-Bold').text('Department: ', 50, y, { continued: true });
      doc.font('Helvetica').text(departmentName);

      y = doc.y + 4;
      doc.font('Helvetica-Bold').text('Assignee Candidate: ', 50, y, { continued: true });
      doc.font('Helvetica').text(candidateName);

      y = doc.y + 4;
      doc.font('Helvetica-Bold').text('Priority: ', 50, y, { continued: true });
      doc.font('Helvetica').text(priorityStr);

      y = doc.y + 4;
      doc.font('Helvetica-Bold').text('Target Date: ', 50, y, { continued: true });
      doc.font('Helvetica').text(targetDate);

      y = doc.y + 20;

      // Helper function to draw divider line
      const drawDivider = () => {
        const lineY = doc.y + 12;
        doc.lineWidth(1)
           .strokeColor('#000000')
           .moveTo(50, lineY)
           .lineTo(200, lineY)
           .stroke();
        doc.y = lineY + 16;
      };

      // --- 2. OVERVIEW & DESCRIPTION ---
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#000000').text('Overview & Description', 50, y);
      doc.font('Helvetica').fontSize(10).fillColor('#000000').moveDown(0.5);

      doc.text(taskDescription, { width: 500, align: 'left', lineGap: 3 });

      drawDivider();

      // --- 3. MISSION ---
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#000000').text('Mission');
      doc.font('Helvetica').fontSize(10).fillColor('#000000').moveDown(0.5);

      doc.text(`Execute and certify '${taskTitle}' by validating implementation deliverables, system contract boundaries, and quality requirements.`, { width: 500, align: 'left', lineGap: 3 });

      doc.moveDown(0.8);
      doc.text(`${candidateName} is responsible for ensuring all deliverables meet project specification guidelines and integration standards.`, { width: 500, align: 'left', lineGap: 3 });

      drawDivider();

      // --- 4. PHASE 1 – IMPLEMENTATION & CONVERGENCE ---
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000').text('Phase 1 – Core Implementation & Verification');
      doc.font('Helvetica').fontSize(10).fillColor('#000000').moveDown(0.5);

      doc.text('Validate implementation between:', { width: 500 });
      doc.moveDown(0.5);

      const phase1Items = [
        'Source Code & Deliverables',
        'API Integration & Contracts',
        'Database & Storage Layer',
        'Observability & Error Handling'
      ];

      phase1Items.forEach(item => {
        doc.text(`* ${item}`, { indent: 10 });
      });

      doc.moveDown(0.8);
      doc.text('Ensure every component operates through approved contracts and quality checks.', { width: 500 });

      drawDivider();

      // --- 5. PHASE 2 – QUALITY CERTIFICATION ---
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000').text('Phase 2 – Quality & Execution Certification');
      doc.font('Helvetica').fontSize(10).fillColor('#000000').moveDown(0.5);

      doc.text('Validate:', { width: 500 });
      doc.moveDown(0.5);

      const phase2Items = [
        'Multi-Format Deliverables & Code Repository',
        'Automated Metadata Extraction',
        'API Compatibility',
        'Authentication & Access Safety',
        'Traceability & Error Handling',
        'Deterministic Execution Verification'
      ];

      phase2Items.forEach(item => {
        doc.text(`* ${item}`, { indent: 10 });
      });

      doc.moveDown(0.8);
      doc.text('No feature may bypass published system contracts.', { width: 500 });

      drawDivider();

      // --- 6. FINAL DELIVERABLE ---
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000').text('Final Deliverable');
      doc.font('Helvetica').fontSize(10).fillColor('#000000').moveDown(0.5);

      doc.text(`The primary artifact is the completed deliverable report for '${taskTitle}', containing:`, { width: 500 });
      doc.moveDown(0.5);

      const finalDeliverables = [
        'Source Code Implementation & Commits',
        'System Verification Report',
        'Integration Contract Validation',
        'Production Readiness Certification'
      ];

      finalDeliverables.forEach(item => {
        doc.text(`* ${item}`, { indent: 10 });
      });

      doc.end();

      writeStream.on('finish', () => {
        resolve(`/uploads/${fileName}`);
      });

      writeStream.on('error', (err) => {
        console.error('[PDF GENERATOR ERROR]', err);
        resolve(null);
      });
    } catch (err) {
      console.error('[PDF GENERATOR EXCEPTION]', err);
      resolve(null);
    }
  });
}

module.exports = { generateTaskBriefPdf };
