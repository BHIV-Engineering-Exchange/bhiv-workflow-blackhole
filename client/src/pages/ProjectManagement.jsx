"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  FolderKanban,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Users,
  Calendar,
  Target,
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Filter,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Badge } from "../components/ui/badge"
import { Progress } from "../components/ui/progress"
import { useToast } from "../hooks/use-toast"
import { api } from "../lib/api"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip"
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar"
import { Checkbox } from "../components/ui/checkbox"
import { ScrollArea } from "../components/ui/scroll-area"

const statusOptions = [
  { value: "Planning", label: "Planning", color: "bg-gray-100 text-gray-700" },
  { value: "In Progress", label: "In Progress", color: "bg-blue-100 text-blue-700" },
  { value: "On Hold", label: "On Hold", color: "bg-yellow-100 text-yellow-700" },
  { value: "Completed", label: "Completed", color: "bg-green-100 text-green-700" },
  { value: "Cancelled", label: "Cancelled", color: "bg-red-100 text-red-700" },
]

const priorityOptions = [
  { value: "Low", label: "Low", color: "bg-gray-100 text-gray-700" },
  { value: "Medium", label: "Medium", color: "bg-blue-100 text-blue-700" },
  { value: "High", label: "High", color: "bg-orange-100 text-orange-700" },
  { value: "Critical", label: "Critical", color: "bg-red-100 text-red-700" },
]

export default function ProjectManagement() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [departments, setDepartments] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterDepartment, setFilterDepartment] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    department: "",
    lead: "",
    teamMembers: [],
    status: "Planning",
    priority: "Medium",
    startDate: "",
    dueDate: "",
  })

  // Filter users by selected department
  const departmentUsers = formData.department
    ? users.filter((user) => user.department?._id === formData.department || user.department === formData.department)
    : users

  // Fetch projects
  const fetchProjects = async () => {
    try {
      setLoading(true)
      const response = await api.projects.getAll()
      const data = response.success ? response.data : response
      setProjects(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error fetching projects:", error)
      toast({
        title: "Error",
        description: "Failed to fetch projects",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Fetch departments
  const fetchDepartments = async () => {
    try {
      const response = await api.departments.getDepartments()
      const data = response.success ? response.data : response
      setDepartments(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error fetching departments:", error)
    }
  }

  // Fetch users
  const fetchUsers = async () => {
    try {
      const response = await api.users.getUsers()
      const data = response.success ? response.data : response
      setUsers(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error fetching users:", error)
    }
  }

  useEffect(() => {
    fetchProjects()
    fetchDepartments()
    fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      department: "",
      lead: "",
      teamMembers: [],
      status: "Planning",
      priority: "Medium",
      startDate: "",
      dueDate: "",
    })
    setSelectedProject(null)
  }

  // Handle team member toggle
  const handleTeamMemberToggle = (userId) => {
    setFormData((prev) => ({
      ...prev,
      teamMembers: prev.teamMembers.includes(userId)
        ? prev.teamMembers.filter((id) => id !== userId)
        : [...prev.teamMembers, userId],
    }))
  }

  // Handle select all team members
  const handleSelectAllTeamMembers = () => {
    if (formData.teamMembers.length === departmentUsers.length) {
      setFormData((prev) => ({ ...prev, teamMembers: [] }))
    } else {
      setFormData((prev) => ({
        ...prev,
        teamMembers: departmentUsers.map((u) => u._id),
      }))
    }
  }

  // Open dialog for create
  const handleCreate = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  // Open dialog for edit
  const handleEdit = (project) => {
    setSelectedProject(project)
    setFormData({
      name: project.name || "",
      description: project.description || "",
      department: project.department?._id || "",
      lead: project.lead?._id || "",
      teamMembers: project.teamMembers?.map((m) => m._id) || [],
      status: project.status || "Planning",
      priority: project.priority || "Medium",
      startDate: project.startDate ? project.startDate.split("T")[0] : "",
      dueDate: project.dueDate ? project.dueDate.split("T")[0] : "",
    })
    setIsDialogOpen(true)
  }

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Project name is required",
        variant: "destructive",
      })
      return
    }

    if (!formData.department) {
      toast({
        title: "Validation Error",
        description: "Department is required",
        variant: "destructive",
      })
      return
    }

    try {
      setSaving(true)
      const payload = {
        ...formData,
        lead: formData.lead === "none" ? null : formData.lead || null,
        startDate: formData.startDate || undefined,
        dueDate: formData.dueDate || undefined,
      }

      if (selectedProject) {
        await api.projects.update(selectedProject._id, payload)
        toast({
          title: "Success",
          description: "Project updated successfully",
        })
      } else {
        await api.projects.create(payload)
        toast({
          title: "Success",
          description: "Project created successfully",
        })
      }

      setIsDialogOpen(false)
      resetForm()
      fetchProjects()
    } catch (error) {
      console.error("Error saving project:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to save project",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  // Delete project
  const handleDelete = async () => {
    if (!selectedProject) return

    try {
      setSaving(true)
      await api.projects.delete(selectedProject._id)
      toast({
        title: "Success",
        description: "Project deleted successfully",
      })
      setIsDeleteDialogOpen(false)
      setSelectedProject(null)
      fetchProjects()
    } catch (error) {
      console.error("Error deleting project:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete project",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  // Filter projects
  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesDepartment =
      filterDepartment === "all" || project.department?._id === filterDepartment
    const matchesStatus = filterStatus === "all" || project.status === filterStatus
    return matchesSearch && matchesDepartment && matchesStatus
  })

  // Get status badge style
  const getStatusBadge = (status) => {
    const option = statusOptions.find((o) => o.value === status)
    return option?.color || "bg-gray-100 text-gray-700"
  }

  // Get priority badge style
  const getPriorityBadge = (priority) => {
    const option = priorityOptions.find((o) => o.value === priority)
    return option?.color || "bg-gray-100 text-gray-700"
  }

  // Navigate to project details
  const handleProjectClick = (project) => {
    navigate(`/projects/${project._id}`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <FolderKanban className="h-8 w-8 text-primary" />
            Project Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Create and manage department-wise projects
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Project
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterDepartment} onValueChange={setFilterDepartment}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <Building2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept._id} value={dept._id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {statusOptions.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Projects Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderKanban className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No projects found</h3>
            <p className="text-muted-foreground mt-1">
              {searchTerm || filterDepartment !== "all" || filterStatus !== "all"
                ? "Try adjusting your filters"
                : "Create your first project to get started"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <Card
              key={project._id}
              className="hover:shadow-lg transition-all duration-200 cursor-pointer group"
              onClick={() => handleProjectClick(project)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FolderKanban className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate group-hover:text-primary transition-colors">
                        {project.name}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-1 mt-0.5">
                        <Building2 className="h-3 w-3" />
                        {project.department?.name || "No Department"}
                      </CardDescription>
                    </div>
                  </div>
                  <div
                    className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(project)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              setSelectedProject(project)
                              setIsDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {project.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {project.description}
                  </p>
                )}

                {/* Progress */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{project.progress || 0}%</span>
                  </div>
                  <Progress value={project.progress || 0} className="h-2" />
                </div>

                {/* Status & Priority */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={getStatusBadge(project.status)}>
                    {project.status}
                  </Badge>
                  <Badge className={getPriorityBadge(project.priority)}>
                    {project.priority}
                  </Badge>
                </div>

                {/* Project Lead */}
                {project.lead && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Lead:</span>
                    <div className="flex items-center gap-1.5">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={project.lead.profileImage} alt={project.lead.name} />
                        <AvatarFallback className="text-xs">
                          {project.lead.name?.charAt(0)?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{project.lead.name}</span>
                    </div>
                  </div>
                )}

                {/* Meta info */}
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{project.teamMembers?.length || 0} members</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Target className="h-4 w-4" />
                    <span>{project.tasks?.length || 0} tasks</span>
                  </div>
                </div>

                {/* Due date */}
                {project.dueDate && (
                  <div className="flex items-center gap-1 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span
                      className={
                        new Date(project.dueDate) < new Date() &&
                        project.status !== "Completed"
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }
                    >
                      Due: {new Date(project.dueDate).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {/* Team avatars */}
                {project.teamMembers?.length > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="flex -space-x-2">
                      {project.teamMembers.slice(0, 4).map((member) => (
                        <Avatar key={member._id} className="h-7 w-7 border-2 border-background">
                          <AvatarImage src={member.profileImage} alt={member.name} />
                          <AvatarFallback className="text-xs">
                            {member.name?.charAt(0)?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {project.teamMembers.length > 4 && (
                        <div className="h-7 w-7 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium">
                          +{project.teamMembers.length - 4}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-primary" />
              {selectedProject ? "Edit Project" : "Create Project"}
            </DialogTitle>
            <DialogDescription>
              {selectedProject
                ? "Update project details"
                : "Create a new department-wise project"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-2">
                <Label htmlFor="name">
                  Project Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter project name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">
                  Department <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.department}
                  onValueChange={(value) =>
                    setFormData({ ...formData, department: value, lead: "", teamMembers: [] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept._id} value={dept._id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lead">Project Lead</Label>
                <Select
                  value={formData.lead}
                  onValueChange={(value) => setFormData({ ...formData, lead: value })}
                  disabled={!formData.department}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.department ? "Select lead" : "Select department first"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Lead</SelectItem>
                    {departmentUsers.map((user) => (
                      <SelectItem key={user._id} value={user._id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={user.profileImage} alt={user.name} />
                            <AvatarFallback className="text-xs">
                              {user.name?.charAt(0)?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {user.name} {user.employeeId ? `(${user.employeeId})` : ""}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2 space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="teamMembers">
                    Team Members {formData.teamMembers.length > 0 && `(${formData.teamMembers.length} selected)`}
                  </Label>
                  {formData.department && departmentUsers.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={handleSelectAllTeamMembers}
                    >
                      {formData.teamMembers.length === departmentUsers.length ? "Deselect All" : "Select All"}
                    </Button>
                  )}
                </div>
                {!formData.department ? (
                  <div className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/50">
                    Select a department first to choose team members
                  </div>
                ) : departmentUsers.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/50">
                    No employees found in this department
                  </div>
                ) : (
                  <ScrollArea className="h-[150px] border rounded-md p-3">
                    <div className="space-y-2">
                      {departmentUsers.map((user) => (
                        <div
                          key={user._id}
                          className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                          onClick={() => handleTeamMemberToggle(user._id)}
                        >
                          <Checkbox
                            checked={formData.teamMembers.includes(user._id)}
                            onCheckedChange={() => handleTeamMemberToggle(user._id)}
                          />
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={user.profileImage} alt={user.name} />
                            <AvatarFallback className="text-xs">
                              {user.name?.charAt(0)?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{user.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {user.employeeId || user.email}
                            </p>
                          </div>
                          {formData.lead === user._id && (
                            <Badge variant="secondary" className="text-xs">Lead</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData({ ...formData, startDate: e.target.value })
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : selectedProject ? (
                  "Update Project"
                ) : (
                  "Create Project"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Delete Project
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedProject?.name}"? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
