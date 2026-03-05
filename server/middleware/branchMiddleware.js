const Branch = require('../models/Branch');

/**
 * Middleware to extract branch filter from X-Branch header
 * Adds req.branchFilter object that can be used in database queries
 */
const branchFilter = async (req, res, next) => {
  try {
    // Get branch from header or query parameter
    const selectedBranch = req.headers['x-branch'] || req.query.branch;
    
    // If admin and a branch is selected, apply filter
    if (req.user && req.user.role === 'Admin' && selectedBranch && selectedBranch !== 'all') {
      req.branchFilter = { branch: selectedBranch };
      req.selectedBranch = selectedBranch;
    } 
    // For non-admin users, always filter by their branch
    else if (req.user && req.user.role !== 'Admin' && req.user.branch) {
      req.branchFilter = { branch: req.user.branch };
      req.selectedBranch = req.user.branch;
    }
    // No filter if admin selects 'all' or no branch specified
    else {
      req.branchFilter = {};
      req.selectedBranch = null;
    }
    
    next();
  } catch (error) {
    console.error('Branch filter middleware error:', error);
    req.branchFilter = {};
    req.selectedBranch = null;
    next();
  }
};

/**
 * Get branch-specific office location based on user's branch
 * Adds req.officeLocation object with lat, lng, radius, address
 */
const getBranchLocation = async (req, res, next) => {
  try {
    const branchCode = req.user?.branch || 'mumbai';
    const branch = await Branch.findOne({ code: branchCode, isActive: true });
    
    if (branch) {
      req.officeLocation = {
        lat: branch.latitude,
        lng: branch.longitude,
        radius: branch.radius,
        address: branch.address,
        branchName: branch.name,
        branchCode: branch.code
      };
    } else {
      // Fallback to Mumbai office from env
      req.officeLocation = {
        lat: parseFloat(process.env.OFFICE_LAT) || 19.160122,
        lng: parseFloat(process.env.OFFICE_LNG) || 72.839720,
        radius: parseInt(process.env.OFFICE_RADIUS) || 1000,
        address: process.env.OFFICE_ADDRESS || 'Mumbai Office',
        branchName: 'Mumbai Branch',
        branchCode: 'mumbai'
      };
    }
    
    next();
  } catch (error) {
    console.error('Get branch location middleware error:', error);
    // Fallback to default values
    req.officeLocation = {
      lat: parseFloat(process.env.OFFICE_LAT) || 19.160122,
      lng: parseFloat(process.env.OFFICE_LNG) || 72.839720,
      radius: parseInt(process.env.OFFICE_RADIUS) || 1000,
      address: process.env.OFFICE_ADDRESS || 'Mumbai Office',
      branchName: 'Mumbai Branch',
      branchCode: 'mumbai'
    };
    next();
  }
};

module.exports = { branchFilter, getBranchLocation };
