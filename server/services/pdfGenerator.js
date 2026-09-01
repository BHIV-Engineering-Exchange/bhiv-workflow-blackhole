const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Streams a dynamic document-style PDF task brief directly to an HTTP response.
 * @param {Object} task Task object containing title, description, assignee, priority, department, etc.
 * @param {Object} assignee Candidate user object (optional)
 * @returns {PDFDocument} pdfkit document stream
 */
function generateTaskBriefPdfStream(task, assignee = null) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  const candidateName = assignee?.name || (task.assignee?.name ? task.assignee.name : 'Assigned Candidate');
  
  let departmentName = task.department?.name;
  if (!departmentName || departmentName === 'General') {
    if (assignee?.department?.name) {
      departmentName = assignee.department.name;
    }
  }
  if (!departmentName || departmentName === 'General') {
    departmentName = 'Web Development';
  }

  const priorityStr = task.priority || 'Medium';
  const targetDate = task.dueDate 
    ? new Date(task.dueDate).toISOString().split('T')[0] 
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  let taskTitle = task.title || 'Task Specification Brief';
  if (/^T-[A-Z]{3}-\d+$/i.test(taskTitle) || /^task-next/i.test(taskTitle)) {
    const objMatch = task.description?.match(/Objective:\s*([^\n\.]+)/i);
    if (objMatch && objMatch[1]) {
      taskTitle = objMatch[1].trim();
    } else {
      taskTitle = `Phase 2: Execution & Convergence Certification (${taskTitle})`;
    }
  }
  const taskDescription = task.description || `Complete the objectives for task '${taskTitle}' according to project standards.`;

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

  const drawDivider = () => {
    if (doc.y + 30 > 730) {
      doc.addPage();
      doc.y = 50;
    }
    const lineY = doc.y + 12;
    doc.lineWidth(1)
       .strokeColor('#000000')
       .moveTo(50, lineY)
       .lineTo(200, lineY)
       .stroke();
    doc.y = lineY + 16;
  };

  const ensurePageSpace = (needed = 40) => {
    if (doc.y + needed > 730) {
      doc.addPage();
      doc.y = 50;
    }
  };

  doc.font('Helvetica-Bold').fontSize(12).fillColor('#000000').text('Overview & Description', 50, y);
  doc.font('Helvetica').fontSize(10).fillColor('#000000').moveDown(0.5);

  doc.text(taskDescription, { width: 500, align: 'left', lineGap: 3 });

  drawDivider();

  doc.font('Helvetica-Bold').fontSize(12).fillColor('#000000').text('Mission');
  doc.font('Helvetica').fontSize(10).fillColor('#000000').moveDown(0.5);

  doc.text(`Execute and certify '${taskTitle}' by validating implementation deliverables, system contract boundaries, and quality requirements.`, { width: 500, align: 'left', lineGap: 3 });

  doc.moveDown(0.8);
  doc.text(`${candidateName} is responsible for ensuring all deliverables meet project specification guidelines and integration standards.`, { width: 500, align: 'left', lineGap: 3 });

  drawDivider();

  // Parse all explicit "Phase 1", "Phase 2", "Phase 3", "Phase 4", "Phase 5", "Phase 6", etc. blocks from task text
  const fullContent = `${taskDescription}\n\n${task.notes || ''}`;
  const phaseBlockRegex = /(Phase\s*\d+[\s\S]*?)(?=\n[ \t]*Phase\s*\d+|$)/gi;
  const parsedPhaseBlocks = fullContent.match(phaseBlockRegex);

  if (parsedPhaseBlocks && parsedPhaseBlocks.length > 0) {
    // Dynamically render ALL phases found in the task text
    parsedPhaseBlocks.forEach((block) => {
      ensurePageSpace(60);
      const lines = block.trim().split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) return;

      const titleLine = lines[0].replace(/^#+\s*/, '');
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000').text(titleLine);
      doc.font('Helvetica').fontSize(10).fillColor('#000000').moveDown(0.4);

      lines.slice(1).forEach(line => {
        ensurePageSpace(20);
        if (line.startsWith('*') || line.startsWith('-') || line.startsWith('•')) {
          doc.text(`* ${line.replace(/^[\*\-•\s]+/, '')}`, { indent: 10, lineGap: 2 });
        } else if (line.length > 0) {
          doc.text(line, { width: 500, align: 'left', lineGap: 2 });
        }
      });

      drawDivider();
    });
  } else {
    // Fallback: Extract action items and render dynamic Phase 1 and Phase 2
    let customDeliverables = [];
    if (taskDescription) {
      const rawLines = taskDescription
        .split(/\r?\n|;|\./)
        .map(line => line.replace(/^[\*\-•\d\.\s]+/, '').trim())
        .filter(line => line.length >= 10 && !line.toLowerCase().startsWith('http'));
      if (rawLines.length >= 2) {
        customDeliverables = Array.from(new Set(rawLines));
      }
    }

    ensurePageSpace(60);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000').text('Phase 1 – Core Implementation & Verification');
    doc.font('Helvetica').fontSize(10).fillColor('#000000').moveDown(0.5);

    const phase1Items = customDeliverables.length >= 3
      ? customDeliverables.slice(0, Math.ceil(customDeliverables.length / 2))
      : [
          `${taskTitle} - Core Implementation & Deliverables`,
          `${departmentName} API Integration & System Contracts`,
          `Database & State Storage Layer for ${taskTitle}`,
          `Observability, Logging & Error Handling (${priorityStr} Priority)`
        ];

    phase1Items.forEach(item => {
      ensurePageSpace(20);
      doc.text(`* ${item}`, { indent: 10 });
    });

    drawDivider();

    ensurePageSpace(60);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000').text('Phase 2 – Quality & Execution Certification');
    doc.font('Helvetica').fontSize(10).fillColor('#000000').moveDown(0.5);

    const phase2Items = customDeliverables.length >= 3
      ? customDeliverables.slice(Math.ceil(customDeliverables.length / 2))
      : [
          `${taskTitle} - Multi-Format Code Deliverables`,
          `Automated Metadata Extraction & Verification (${departmentName})`,
          `API Compatibility & Authentication Safety for ${taskTitle}`,
          'Traceability, Logging & Deterministic Execution Certification'
        ];

    phase2Items.forEach(item => {
      ensurePageSpace(20);
      doc.text(`* ${item}`, { indent: 10 });
    });

    drawDivider();
  }

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
  return doc;
}

/**
 * Generates a dynamic document-style PDF task brief and uploads it directly to Cloudinary CDN.
 * @param {Object} task Task object containing title, description, assignee, priority, department, etc.
 * @param {Object} assignee Candidate user object (optional)
 * @returns {Promise<string>} Cloudinary secure HTTPS URL or fallback local URL
 */
async function generateTaskBriefPdf(task, assignee = null) {
  return new Promise((resolve, reject) => {
    try {
      const { uploadToCloudinary } = require('../utils/cloudinary');
      const doc = generateTaskBriefPdfStream(task, assignee);
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', async () => {
        const pdfBuffer = Buffer.concat(chunks);
        const fileName = `task_brief_${task._id || Date.now()}.pdf`;

        // 1. Primary Cloudinary CDN Upload
        try {
          const cloudinaryUrl = await uploadToCloudinary(pdfBuffer, fileName);
          if (cloudinaryUrl) {
            console.log(`[PDF GENERATOR] Successfully uploaded PDF brief to Cloudinary CDN: ${cloudinaryUrl}`);
            return resolve(cloudinaryUrl);
          }
        } catch (cloudErr) {
          console.warn('[PDF GENERATOR] Cloudinary upload failed, using local fallback:', cloudErr.message);
        }

        // 2. Local File Storage Fallback
        try {
          const uploadsDir = path.join(__dirname, '..', 'uploads');
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }
          const filePath = path.join(uploadsDir, fileName);
          fs.writeFileSync(filePath, pdfBuffer);
          resolve(`/uploads/${fileName}`);
        } catch (localErr) {
          console.error('[PDF GENERATOR LOCAL FALLBACK ERROR]', localErr);
          resolve(null);
        }
      });

      doc.on('error', (err) => {
        console.error('[PDF GENERATOR STREAM ERROR]', err);
        resolve(null);
      });
    } catch (err) {
      console.error('[PDF GENERATOR EXCEPTION]', err);
      resolve(null);
    }
  });
}

module.exports = { generateTaskBriefPdf, generateTaskBriefPdfStream };
