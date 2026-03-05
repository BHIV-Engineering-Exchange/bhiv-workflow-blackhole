const express = require('express');
const router = express.Router();
const Branch = require('../models/Branch');
const authMiddleware = require('../middleware/auth');

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

module.exports = router;
