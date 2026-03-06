const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const Branch = require('../models/Branch');
const authMiddleware = require('../middleware/auth');

// Super admin email for branch password setup
const SUPER_ADMIN_EMAIL = 'blackholeadmin321@gmail.com';

// Create email transporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Get all branches (public - for registration dropdown)
router.get('/', async (req, res) => {
  try {
    const branches = await Branch.find({ isActive: true }).sort({ name: 1 });
    res.json({
      success: true,
      data: branches
    });
  } catch (error) {
    console.error('Error fetching branches:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get all branches including inactive (admin only)
router.get('/all', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Admin only.' 
      });
    }

    const branches = await Branch.find().sort({ name: 1 });
    res.json({
      success: true,
      data: branches
    });
  } catch (error) {
    console.error('Error fetching all branches:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get single branch by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({ 
        success: false, 
        error: 'Branch not found' 
      });
    }
    res.json({
      success: true,
      data: branch
    });
  } catch (error) {
    console.error('Error fetching branch:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Create new branch (admin only)
router.post('/', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Admin only.' 
      });
    }

    const { name, code, address, latitude, longitude, radius } = req.body;

    // Validate required fields
    if (!name || !code || !address || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide name, code, address, latitude, and longitude' 
      });
    }

    // Check if branch code already exists
    const existingBranch = await Branch.findOne({ code: code.toLowerCase() });
    if (existingBranch) {
      return res.status(400).json({ 
        success: false, 
        error: 'Branch code already exists' 
      });
    }

    const branch = await Branch.create({
      name,
      code: code.toLowerCase(),
      address,
      latitude,
      longitude,
      radius: radius || 1000
    });

    res.status(201).json({
      success: true,
      data: branch,
      message: 'Branch created successfully'
    });
  } catch (error) {
    console.error('Error creating branch:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Update branch (admin only)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Admin only.' 
      });
    }

    const { name, code, address, latitude, longitude, radius, isActive } = req.body;

    // Check if branch exists
    let branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({ 
        success: false, 
        error: 'Branch not found' 
      });
    }

    // Check if new code already exists (if code is being changed)
    if (code && code.toLowerCase() !== branch.code) {
      const existingBranch = await Branch.findOne({ code: code.toLowerCase() });
      if (existingBranch) {
        return res.status(400).json({ 
          success: false, 
          error: 'Branch code already exists' 
        });
      }
    }

    // Update branch
    branch = await Branch.findByIdAndUpdate(
      req.params.id,
      {
        name: name || branch.name,
        code: code ? code.toLowerCase() : branch.code,
        address: address || branch.address,
        latitude: latitude !== undefined ? latitude : branch.latitude,
        longitude: longitude !== undefined ? longitude : branch.longitude,
        radius: radius !== undefined ? radius : branch.radius,
        isActive: isActive !== undefined ? isActive : branch.isActive,
        updatedAt: Date.now()
      },
      { new: true }
    );

    res.json({
      success: true,
      data: branch,
      message: 'Branch updated successfully'
    });
  } catch (error) {
    console.error('Error updating branch:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Delete branch (admin only)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Admin only.' 
      });
    }

    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({ 
        success: false, 
        error: 'Branch not found' 
      });
    }

    await Branch.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Branch deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting branch:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Request branch password setup - sends email to super admin
router.post('/:id/request-password-setup', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Admin only.' 
      });
    }

    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({ 
        success: false, 
        error: 'Branch not found' 
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    // Save token to branch
    branch.passwordResetToken = resetToken;
    branch.passwordResetExpires = resetExpires;
    await branch.save();

    // Get frontend URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/set-branch-password/${branch._id}/${resetToken}`;

    // Try to send email, but don't fail if email service is not configured
    let emailSent = false;
    if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
      try {
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: SUPER_ADMIN_EMAIL,
          subject: `Set Password for Branch: ${branch.name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #3b82f6;">Branch Password Setup Request</h2>
              <p>A request has been made to set a password for branch switching.</p>
              
              <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Branch Name:</strong> ${branch.name}</p>
                <p><strong>Branch Code:</strong> ${branch.code}</p>
              </div>
              
              <p>Click the button below to set the password for this branch:</p>
              
              <a href="${resetLink}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
                Set Branch Password
              </a>
              
              <p style="color: #6b7280; font-size: 14px;">This link will expire in 24 hours.</p>
              
              <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
                If you did not expect this email, please ignore it.
              </p>
            </div>
          `
        };

        await transporter.sendMail(mailOptions);
        emailSent = true;
      } catch (emailError) {
        console.error('Email sending failed:', emailError.message);
      }
    }

    // Return success with link (useful if email fails or for testing)
    res.json({
      success: true,
      emailSent,
      message: emailSent 
        ? `Password setup email sent to super admin for branch: ${branch.name}`
        : `Email service not configured. Use the link below to set password.`,
      resetLink: emailSent ? undefined : resetLink // Only show link if email wasn't sent
    });
  } catch (error) {
    console.error('Error requesting password setup:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Verify password reset token (public - for the reset page)
router.get('/:id/verify-token/:token', async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id);
    
    if (!branch) {
      return res.status(404).json({ 
        success: false, 
        error: 'Branch not found' 
      });
    }

    if (branch.passwordResetToken !== req.params.token) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid token' 
      });
    }

    if (branch.passwordResetExpires < Date.now()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Token has expired' 
      });
    }

    res.json({
      success: true,
      branchName: branch.name,
      branchCode: branch.code
    });
  } catch (error) {
    console.error('Error verifying token:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Set branch password (public - via email link)
router.post('/:id/set-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Token and password are required' 
      });
    }

    if (password.length < 4) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 4 characters' 
      });
    }

    const branch = await Branch.findById(req.params.id);
    
    if (!branch) {
      return res.status(404).json({ 
        success: false, 
        error: 'Branch not found' 
      });
    }

    if (branch.passwordResetToken !== token) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid token' 
      });
    }

    if (branch.passwordResetExpires < Date.now()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Token has expired' 
      });
    }

    // Set the password (plain text as per existing pattern in this codebase)
    branch.switchPassword = password;
    branch.passwordResetToken = null;
    branch.passwordResetExpires = null;
    await branch.save();

    res.json({
      success: true,
      message: `Password set successfully for branch: ${branch.name}`
    });
  } catch (error) {
    console.error('Error setting password:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Verify branch switch password (for switching branches)
router.post('/verify-switch-password', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Admin only.' 
      });
    }

    const { branchCode, password } = req.body;

    if (!branchCode || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Branch code and password are required' 
      });
    }

    const branch = await Branch.findOne({ code: branchCode });
    
    if (!branch) {
      return res.status(404).json({ 
        success: false, 
        error: 'Branch not found' 
      });
    }

    if (!branch.switchPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'No password has been set for this branch. Please request password setup first.' 
      });
    }

    if (branch.switchPassword !== password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid password' 
      });
    }

    res.json({
      success: true,
      message: 'Password verified successfully'
    });
  } catch (error) {
    console.error('Error verifying switch password:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Check if branch has password set (for UI)
router.get('/:id/has-password', authMiddleware, async (req, res) => {
  try {
    const branch = await Branch.findById(req.params.id);
    
    if (!branch) {
      return res.status(404).json({ 
        success: false, 
        error: 'Branch not found' 
      });
    }

    res.json({
      success: true,
      hasPassword: !!branch.switchPassword
    });
  } catch (error) {
    console.error('Error checking password status:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;
