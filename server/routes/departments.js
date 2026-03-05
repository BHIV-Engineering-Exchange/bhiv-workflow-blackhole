const express = require("express")
const router = express.Router()
const Department = require("../models/Department")
const Task = require("../models/Task")
const User = require("../models/User")
const auth = require("../middleware/auth")

// Helper to get branch filter from request
const getBranchQuery = (req) => {
  const selectedBranch = req.headers['x-branch'] || req.query.branch;
  if (selectedBranch && selectedBranch !== 'all') {
    return { branch: selectedBranch };
  }
  return {};
};

// Get all departments - FILTERED BY BRANCH
router.get("/", async (req, res) => {
  try {
    const branchQuery = getBranchQuery(req);
    
    // If branch filter is active, only show departments with members from that branch
    let matchFilter = {};
    if (branchQuery.branch) {
      // Get users from the selected branch
      const usersInBranch = await User.find({ ...branchQuery, stillExist: 1 }).select('_id');
      const userIds = usersInBranch.map(u => u._id);
      
      // Filter departments where lead or members are in the branch
      matchFilter = {
        $or: [
          { lead: { $in: userIds } },
          { members: { $in: userIds } }
        ]
      };
    }

    const departments = await Department.find(matchFilter)
      .populate({
        path: "lead",
        select: "name avatar stillExist email branch",
        match: branchQuery.branch ? { branch: branchQuery.branch } : {}
      })
      .populate({
        path: "members",
        select: "name avatar stillExist email branch",
        match: branchQuery.branch ? { branch: branchQuery.branch } : {}
      })
    
    // Filter out members that don't match branch (populate match only nullifies non-matching)
    const filteredDepartments = departments.map(dept => {
      const deptObj = dept.toObject();
      if (branchQuery.branch) {
        deptObj.members = deptObj.members.filter(m => m !== null);
      }
      return deptObj;
    });
    
    res.json({
      success: true,
      data: filteredDepartments
    })
  } catch (error) {
    console.error("Error fetching departments:", error)
    res.status(500).json({
      success: false,
      error: "Server error"
    })
  }
})

// Get department by ID - FILTERED BY BRANCH
router.get("/:id", auth, async (req, res) => {
  try {
    const branchQuery = getBranchQuery(req);
    
    const department = await Department.findById(req.params.id)
      .populate({
        path: "lead",
        select: "name avatar stillExist email branch",
        match: branchQuery.branch ? { branch: branchQuery.branch } : {}
      })
      .populate({
        path: "members",
        select: "name avatar stillExist email branch",
        match: branchQuery.branch ? { branch: branchQuery.branch } : {}
      })

    if (!department) {
      return res.status(404).json({ error: "Department not found" })
    }

    // Filter out members that don't match branch
    const deptObj = department.toObject();
    if (branchQuery.branch) {
      deptObj.members = deptObj.members.filter(m => m !== null);
    }

    res.json(deptObj)
  } catch (error) {
    console.error("Error fetching department:", error)
    res.status(500).json({ error: "Server error" })
  }
})

// Create new department - ONLY ALLOW ACTIVE BLACKHOLE USERS FOR NEW ASSIGNMENTS
router.post("/", auth, async (req, res) => {
  try {
    const { lead, members, ...departmentData } = req.body
    const branchQuery = getBranchQuery(req);

    // For NEW assignments, verify lead is active and has blackhole email and belongs to selected branch
    if (lead) {
      const leadFilter = { 
        _id: lead, 
        stillExist: 1,
        email: { $regex: /^blackhole/, $options: 'i' }
      };
      if (branchQuery.branch) leadFilter.branch = branchQuery.branch;
      
      const leadUser = await User.findOne(leadFilter)
      if (!leadUser) {
        return res.status(400).json({ error: "Lead user not found, not active, not authorized, or not in selected branch" })
      }
    }

    // For NEW assignments, verify all members are active, have blackhole emails, and belong to selected branch
    if (members && members.length > 0) {
      const memberFilter = { 
        _id: { $in: members }, 
        stillExist: 1,
        email: { $regex: /^blackhole/, $options: 'i' }
      };
      if (branchQuery.branch) memberFilter.branch = branchQuery.branch;
      
      const activeMembers = await User.find(memberFilter)
      if (activeMembers.length !== members.length) {
        return res.status(400).json({ error: "Some members are not active, not found, not authorized, or not in selected branch" })
      }
    }

    const newDepartment = new Department({
      ...departmentData,
      lead,
      members: members || []
    })
    const department = await newDepartment.save()

    // Populate fields for response - SHOW ALL USERS
    const populatedDepartment = await Department.findById(department._id)
      .populate({
        path: "lead",
        select: "name avatar stillExist email"
      })
      .populate({
        path: "members",
        select: "name avatar stillExist email"
      })

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.emit("department-created", populatedDepartment)
    }

    res.status(201).json(populatedDepartment)
  } catch (error) {
    console.error("Error creating department:", error)
    res.status(500).json({ error: "Server error" })
  }
})

// Update department - ONLY ALLOW ACTIVE BLACKHOLE USERS FOR NEW ASSIGNMENTS
router.put("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params
    const { lead, members, ...updates } = req.body
    const branchQuery = getBranchQuery(req);

    // For NEW assignments, verify lead is active, has blackhole email, and belongs to selected branch
    if (lead) {
      const leadFilter = { 
        _id: lead, 
        stillExist: 1,
        email: { $regex: /^blackhole/, $options: 'i' }
      };
      if (branchQuery.branch) leadFilter.branch = branchQuery.branch;
      
      const leadUser = await User.findOne(leadFilter)
      if (!leadUser) {
        return res.status(400).json({ error: "Lead user not found, not active, not authorized, or not in selected branch" })
      }
      updates.lead = lead
    }

    // For NEW assignments, verify all members are active, have blackhole emails, and belong to selected branch
    if (members && members.length > 0) {
      const memberFilter = { 
        _id: { $in: members }, 
        stillExist: 1,
        email: { $regex: /^blackhole/, $options: 'i' }
      };
      if (branchQuery.branch) memberFilter.branch = branchQuery.branch;
      
      const activeMembers = await User.find(memberFilter)
      if (activeMembers.length !== members.length) {
        return res.status(400).json({ error: "Some members are not active, not found, not authorized, or not in selected branch" })
      }
      updates.members = members
    }

    const department = await Department.findByIdAndUpdate(id, { $set: updates }, { new: true })
      .populate({
        path: "lead",
        select: "name avatar stillExist email branch",
        match: branchQuery.branch ? { branch: branchQuery.branch } : {}
      })
      .populate({
        path: "members",
        select: "name avatar stillExist email branch",
        match: branchQuery.branch ? { branch: branchQuery.branch } : {}
      })

    if (!department) {
      return res.status(404).json({ error: "Department not found" })
    }

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.emit("department-updated", department)
    }

    res.json(department)
  } catch (error) {
    console.error("Error updating department:", error)
    res.status(500).json({ error: "Server error" })
  }
})

// Delete department
router.delete("/:id", auth, async (req, res) => {
  try {
    // Check if there are tasks assigned to this department
    const tasksCount = await Task.countDocuments({ department: req.params.id })

    if (tasksCount > 0) {
      return res.status(400).json({
        error: "Cannot delete department with assigned tasks",
      })
    }

    const department = await Department.findByIdAndDelete(req.params.id)

    if (!department) {
      return res.status(404).json({ error: "Department not found" })
    }

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.emit("department-deleted", req.params.id)
    }

    res.json({ message: "Department deleted successfully" })
  } catch (error) {
    console.error("Error deleting department:", error)
    res.status(500).json({ error: "Server error" })
  }
})

// Get tasks by department - FILTERED BY BRANCH
router.get("/:id/tasks", auth, async (req, res) => {
  try {
    const { status } = req.query
    const branchQuery = getBranchQuery(req);

    // Build filter object - include branch filter for tasks
    const filter = { department: req.params.id }
    if (status) filter.status = status
    if (branchQuery.branch) filter.branch = branchQuery.branch

    const tasks = await Task.find(filter)
      .populate("dependencies", "title status")

    // Handle assignee population manually - SHOW ALL EXISTING ASSIGNEES
    const tasksWithAssignees = await Promise.all(tasks.map(async (task) => {
      const taskObj = task.toObject()
      
      if (!task.assignee) {
        taskObj.assignee = null
        return taskObj
      }

      // Get the actual user without filtering - SHOW EXISTING ASSIGNEES
      const actualUser = await User.findById(task.assignee).select("name avatar email stillExist")
      
      if (!actualUser) {
        taskObj.assignee = null
        return taskObj
      }

      // Always show the assignee, but with status indicators
      const isActive = actualUser.stillExist === 1
      const isBlackhole = actualUser.email.toLowerCase().startsWith('blackhole')

      taskObj.assignee = {
        _id: actualUser._id,
        name: actualUser.name,
        avatar: actualUser.avatar,
        email: actualUser.email,
        stillExist: actualUser.stillExist,
        isActive,
        isBlackhole,
        status: !isActive ? 'inactive' : !isBlackhole ? 'non-blackhole' : 'active'
      }

      return taskObj
    }))

    res.json(tasksWithAssignees)
  } catch (error) {
    console.error("Error fetching department tasks:", error)
    res.status(500).json({ error: "Server error" })
  }
})

module.exports = router