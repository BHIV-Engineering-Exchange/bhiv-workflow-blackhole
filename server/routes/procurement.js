const express = require('express');
const router = express.Router();
const procurementAgent = require('../services/procurementAgent');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const procurementAuth = require('../middleware/procurementAuth');

// Helper to get branch filter from request
const getBranchQuery = (req) => {
  const selectedBranch = req.headers['x-branch'] || req.query.branch;
  if (selectedBranch && selectedBranch !== 'all') {
    return { branch: selectedBranch };
  }
  return {};
};

// Run procurement analysis - FILTERED BY BRANCH
router.post('/run-analysis', auth, procurementAuth, async (req, res) => {
  try {
    const branchQuery = getBranchQuery(req);
    const analysis = await procurementAgent.analyzeEmployeeAvailability(req.user.id, branchQuery);

    // Calculate team workload percentage
    const totalEmployees = analysis.totalEmployees;
    const availableEmployees = analysis.availableEmployees.length;
    const teamWorkload = totalEmployees > 0 ? Math.round(((totalEmployees - availableEmployees) / totalEmployees) * 100) : 0;

    // Add team workload to analysis
    analysis.teamWorkload = teamWorkload;

    res.json({
      success: true,
      message: 'Procurement analysis completed successfully',
      data: analysis
    });
  } catch (error) {
    console.error('Error running procurement analysis:', error);
    res.status(500).json({
      error: 'Failed to run procurement analysis',
      message: error.message
    });
  }
});

// Generate full procurement report - FILTERED BY BRANCH
router.get('/report', auth, procurementAuth, async (req, res) => {
  try {
    const branchQuery = getBranchQuery(req);
    const report = await procurementAgent.generateProcurementReport(req.user.id, branchQuery);

    res.json({
      success: true,
      report
    });
  } catch (error) {
    console.error('Error generating procurement report:', error);
    res.status(500).json({
      error: 'Failed to generate procurement report',
      message: error.message
    });
  }
});

// Get available employees - FILTERED BY BRANCH
router.get('/available-employees', auth, procurementAuth, async (req, res) => {
  try {
    const { minScore = 50 } = req.query;
    const branchQuery = getBranchQuery(req);
    const availableEmployees = await procurementAgent.getAvailableEmployees(parseInt(minScore), branchQuery);

    res.json({
      success: true,
      availableEmployees,
      count: availableEmployees.length
    });
  } catch (error) {
    console.error('Error getting available employees:', error);
    res.status(500).json({
      error: 'Failed to get available employees',
      message: error.message
    });
  }
});

// Get top performers - FILTERED BY BRANCH
router.get('/top-performers', auth, procurementAuth, async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const branchQuery = getBranchQuery(req);
    const topPerformers = await procurementAgent.getTopPerformers(parseInt(limit), branchQuery);

    res.json({
      success: true,
      topPerformers
    });
  } catch (error) {
    console.error('Error getting top performers:', error);
    res.status(500).json({
      error: 'Failed to get top performers',
      message: error.message
    });
  }
});

// Get employee task statistics
router.get('/employee-stats/:employeeId', auth, procurementAuth, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const stats = await procurementAgent.getEmployeeTaskStats(employeeId);

    res.json({
      success: true,
      employeeId,
      stats
    });
  } catch (error) {
    console.error('Error getting employee stats:', error);
    res.status(500).json({
      error: 'Failed to get employee statistics',
      message: error.message
    });
  }
});

// Auto-run procurement analysis (for background job)
router.post('/auto-analysis', async (req, res) => {
  try {
    // Find all admin users to notify
    const User = require('../models/User');
    const admins = await User.find({ role: 'Admin' });
    
    const results = [];
    for (const admin of admins) {
      const analysis = await procurementAgent.analyzeEmployeeAvailability(admin._id);
      results.push({
        adminId: admin._id,
        adminName: admin.name,
        lowTaskCount: analysis.lowTaskEmployees.length
      });
    }

    res.json({
      success: true,
      message: 'Auto procurement analysis completed',
      results
    });
  } catch (error) {
    console.error('Error in auto procurement analysis:', error);
    res.status(500).json({
      error: 'Failed to run auto procurement analysis',
      message: error.message
    });
  }
});

module.exports = router;