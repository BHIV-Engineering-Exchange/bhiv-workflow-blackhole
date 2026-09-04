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

  const candidateName = assignee?.name || (task.assignee?.name ? task.assignee.name : 'N/A');
  const departmentName = task.department?.name || (assignee?.department?.name ? assignee.department.name : '');
  const priorityStr = task.priority || 'Medium';
  const targetDate = task.dueDate 
    ? new Date(task.dueDate).toISOString().split('T')[0] 
    : '';

  const sanitizeText = (str) => {
    if (!str) return '';
    return str
      // Remove 4-byte UTF-8 emojis & non-WinAnsi multi-byte characters that cause garbled symbols in PDFKit
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
      .trim();
  };

  const taskTitle = sanitizeText(task.title) || 'Task Specification Brief';
  const taskDescription = sanitizeText(task.description) || '';

  let y = 50;

  doc.fillColor('#000000').font('Helvetica-Bold').fontSize(10);
  doc.text('Task Title: ', 50, y, { continued: true });
  doc.font('Helvetica').text(taskTitle);

  if (departmentName) {
    y = doc.y + 4;
    doc.font('Helvetica-Bold').text('Department: ', 50, y, { continued: true });
    doc.font('Helvetica').text(departmentName);
  }

  y = doc.y + 4;
  doc.font('Helvetica-Bold').text('Assignee Candidate: ', 50, y, { continued: true });
  doc.font('Helvetica').text(candidateName);

  y = doc.y + 4;
  doc.font('Helvetica-Bold').text('Priority: ', 50, y, { continued: true });
  doc.font('Helvetica').text(priorityStr);

  if (targetDate) {
    y = doc.y + 4;
    doc.font('Helvetica-Bold').text('Target Date: ', 50, y, { continued: true });
    doc.font('Helvetica').text(targetDate);
  }

  y = doc.y + 16;

  const ensurePageSpace = (needed = 40) => {
    if (doc.y + needed > 730) {
      doc.addPage();
      doc.y = 50;
    }
  };

  const drawDivider = () => {
    ensurePageSpace(30);
    const lineY = doc.y + 10;
    doc.lineWidth(1)
       .strokeColor('#000000')
       .moveTo(50, lineY)
       .lineTo(200, lineY)
       .stroke();
    doc.y = lineY + 14;
  };

  // Render Description if provided by Parikshak / Task
  if (taskDescription) {
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#000000').text('Overview & Description', 50, doc.y);
    doc.font('Helvetica').fontSize(10).fillColor('#000000').moveDown(0.5);
    doc.text(taskDescription, { width: 500, align: 'left', lineGap: 3 });
    drawDivider();
  }

  // Render Notes / Deliverables if provided by Parikshak / Task
  let additionalContent = '';
  if (typeof task.notes === 'string' && !task.notes.startsWith('http') && !task.notes.startsWith('/uploads')) {
    additionalContent = task.notes;
  } else if (task.masterPrompt) {
    additionalContent = task.masterPrompt;
  }

  if (additionalContent && additionalContent.trim() !== taskDescription.trim()) {
    ensurePageSpace(40);
    const lines = String(additionalContent).split('\n').map(l => l.trim()).filter(Boolean);
    lines.forEach(line => {
      ensurePageSpace(20);
      const cleaned = sanitizeText(line);
      if (!cleaned) return;

      if (line.startsWith('#')) {
        const cleanHeading = cleaned.replace(/^#+\s*/, '');
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000').text(cleanHeading);
        doc.font('Helvetica').fontSize(10).moveDown(0.3);
      } else if (line.startsWith('*') || line.startsWith('-') || line.startsWith('•')) {
        const bulletText = cleaned.replace(/^[\*\-•\s]+/, '');
        doc.font('Helvetica').fontSize(10).fillColor('#000000').text(`• ${bulletText}`, { indent: 10, lineGap: 2 });
      } else {
        doc.font('Helvetica').fontSize(10).fillColor('#000000').text(cleaned, { width: 500, align: 'left', lineGap: 2 });
      }
    });
  }

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
