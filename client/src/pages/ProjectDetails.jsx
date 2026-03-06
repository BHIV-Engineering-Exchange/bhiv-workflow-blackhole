"use client"

import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  FolderKanban,
  ArrowLeft,
  Pencil,
  Users,
  Target,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Loader2,
  Building2,
  UserPlus,
  X,
  RefreshCw,
  BarChart3,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip"

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

const taskStatusColors = {
  Pending: "bg-yellow-100 text-yellow-700",
  "In Progress": "bg-blue-100 text-blue-700",
  Completed: "bg-green-100 text-green-700",
}

export default function ProjectDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [project, setProject] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [allTasks, setAllTasks] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [isAddTaskDialogOpen, setIsAddTaskDialogOpen] = useState(false)
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState("")
  const [selectedUserId, setSelectedUserId] = useState("")
  const [saving, setSaving] = useState(false)

  // Fetch project details
  const fetchProject = async () => {
    try {
      setLoading(true)
      const response = await api.projects.get(id)
      const data = response.success ? response.data : response
      setProject(data)
    } catch (error) {
      console.error("Error fetching project:", error)
      toast({
        title: "Error",
        description: "Failed to fetch project details",
        variant: "destructive",
      })
      navigate("/projects")
    } finally {
      setLoading(false)
    }
  }

  // Fetch project stats
  const fetchStats = async () => {
    try {
      const response = await api.projects.getStats(id)
      const data = response.success ? response.data : response
      setStats(data)
    } catch (error) {
      console.error("Error fetching stats:", error)
    }
  }

  // Fetch all tasks for adding
  const fetchAllTasks = async () => {
    try {
      const response = await api.tasks.getAll()
      const data = response.success ? response.data : response
      setAllTasks(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error fetching tasks:", error)
    }
  }

  // Fetch all users for adding
  const fetchAllUsers = async () => {
    try {
      const response = await api.users.getAll()
      const data = response.success ? response.data : response
      setAllUsers(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error fetching users:", error)
    }
  }

  useEffect(() => {
    fetchProject()
    fetchStats()
    fetchAllTasks()
    fetchAllUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Add task to project
  const handleAddTask = async () => {
    if (!selectedTaskId) {
      toast({
        title: "Error",
        description: "Please select a task",
        variant: "destructive",
      })
      return
    }

    try {
      setSaving(true)
      await api.projects.addTask(id, selectedTaskId)
      toast({
        title: "Success",
        description: "Task added to project",
      })
      setIsAddTaskDialogOpen(false)
      setSelectedTaskId("")
      fetchProject()
      fetchStats()
    } catch (error) {
      console.error("Error adding task:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to add task",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  // Remove task from project
  const handleRemoveTask = async (taskId) => {
    try {
      setSaving(true)
      await api.projects.removeTask(id, taskId)
      toast({
        title: "Success",
        description: "Task removed from project",
      })
      fetchProject()
      fetchStats()
    } catch (error) {
      console.error("Error removing task:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to remove task",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  // Add team member
  const handleAddMember = async () => {
    if (!selectedUserId) {
      toast({
        title: "Error",
        description: "Please select a user",
        variant: "destructive",
      })
      return
    }

    try {
      setSaving(true)
      await api.projects.addTeamMember(id, selectedUserId)
      toast({
        title: "Success",
        description: "Team member added",
      })
      setIsAddMemberDialogOpen(false)
      setSelectedUserId("")
      fetchProject()
      fetchStats()
    } catch (error) {
      console.error("Error adding member:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to add team member",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  // Remove team member
  const handleRemoveMember = async (userId) => {
    try {
      setSaving(true)
      await api.projects.removeTeamMember(id, userId)
      toast({
        title: "Success",
        description: "Team member removed",
      })
      fetchProject()
      fetchStats()
    } catch (error) {
      console.error("Error removing member:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to remove team member",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  // Recalculate progress
  const handleRecalculateProgress = async () => {
    try {
      setSaving(true)
      await api.projects.recalculateProgress(id)
      toast({
        title: "Success",
        description: "Progress recalculated",
      })
      fetchProject()
      fetchStats()
    } catch (error) {
      console.error("Error recalculating:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to recalculate progress",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  // Get available tasks (not already in project)
  const availableTasks = allTasks.filter(
    (task) => !project?.tasks?.some((pt) => pt._id === task._id)
  )

  // Get available users (not already in team)
  const availableUsers = allUsers.filter(
    (user) => !project?.teamMembers?.some((tm) => tm._id === user._id)
  )

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">Project not found</h3>
        <Button variant="outline" onClick={() => navigate("/projects")} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Projects
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/projects")}
            className="mt-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-lg ${project.color || "bg-blue-500"} flex items-center justify-center`}
              >
                <FolderKanban className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
                <div className="flex items-center gap-2 text-muted-foreground mt-1">
                  <Building2 className="h-4 w-4" />
                  <span>{project.department?.name || "No Department"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalculateProgress}
            disabled={saving}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${saving ? "animate-spin" : ""}`} />
            Recalculate
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/projects`)}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Progress</p>
                <p className="text-2xl font-bold">{project.progress || 0}%</p>
              </div>
              <BarChart3 className="h-8 w-8 text-primary opacity-50" />
            </div>
            <Progress value={project.progress || 0} className="h-2 mt-3" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Tasks</p>
                <p className="text-2xl font-bold">{stats?.totalTasks || 0}</p>
              </div>
              <Target className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats?.completedTasks || 0} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Team Size</p>
                <p className="text-2xl font-bold">{stats?.teamSize || 0}</p>
              </div>
              <Users className="h-8 w-8 text-green-500 opacity-50" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {project.lead ? "Including lead" : "No lead assigned"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge className={`mt-1 ${getStatusBadge(project.status)}`}>
                  {project.status}
                </Badge>
              </div>
              {project.status === "Completed" ? (
                <CheckCircle2 className="h-8 w-8 text-green-500 opacity-50" />
              ) : (
                <Clock className="h-8 w-8 text-orange-500 opacity-50" />
              )}
            </div>
            <Badge className={`mt-2 ${getPriorityBadge(project.priority)}`}>
              {project.priority} Priority
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      {project.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">
              {project.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tabs for Team and Tasks */}
      <Tabs defaultValue="team" className="space-y-4">
        <TabsList>
          <TabsTrigger value="team" className="gap-2">
            <Users className="h-4 w-4" />
            Team ({project.teamMembers?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2">
            <Target className="h-4 w-4" />
            Tasks ({project.tasks?.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* Team Tab */}
        <TabsContent value="team">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>
                  People working on this project
                </CardDescription>
              </div>
              <Button onClick={() => setIsAddMemberDialogOpen(true)} size="sm">
                <UserPlus className="h-4 w-4 mr-2" />
                Add Member
              </Button>
            </CardHeader>
            <CardContent>
              {/* Project Lead */}
              {project.lead && (
                <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Project Lead
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={project.lead.profileImage} />
                        <AvatarFallback>
                          {project.lead.name?.charAt(0)?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{project.lead.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {project.lead.email}
                        </p>
                      </div>
                    </div>
                    <Badge>Lead</Badge>
                  </div>
                </div>
              )}

              {/* Team Members */}
              {project.teamMembers?.length > 0 ? (
                <div className="space-y-3">
                  {project.teamMembers.map((member) => (
                    <div
                      key={member._id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={member.profileImage} />
                          <AvatarFallback>
                            {member.name?.charAt(0)?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {member.email}
                          </p>
                        </div>
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleRemoveMember(member._id)}
                              disabled={saving}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Remove from team</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No team members assigned yet</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setIsAddMemberDialogOpen(true)}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add First Member
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Project Tasks</CardTitle>
                <CardDescription>Tasks associated with this project</CardDescription>
              </div>
              <Button onClick={() => setIsAddTaskDialogOpen(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </CardHeader>
            <CardContent>
              {project.tasks?.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Assignee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {project.tasks.map((task) => (
                      <TableRow key={task._id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{task.title}</p>
                            {task.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {task.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {task.assignee ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={task.assignee.profileImage} />
                                <AvatarFallback className="text-xs">
                                  {task.assignee.name?.charAt(0)?.toUpperCase() ||
                                    "?"}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{task.assignee.name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              Unassigned
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={taskStatusColors[task.status] || ""}>
                            {task.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getPriorityBadge(task.priority)}>
                            {task.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {task.dueDate ? (
                            <span
                              className={
                                new Date(task.dueDate) < new Date() &&
                                task.status !== "Completed"
                                  ? "text-destructive"
                                  : ""
                              }
                            >
                              {new Date(task.dueDate).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleRemoveTask(task._id)}
                                  disabled={saving}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Remove from project</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No tasks associated with this project</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setIsAddTaskDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Task
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dates Info */}
      {(project.startDate || project.dueDate) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-6">
              {project.startDate && (
                <div>
                  <p className="text-sm text-muted-foreground">Start Date</p>
                  <p className="font-medium">
                    {new Date(project.startDate).toLocaleDateString()}
                  </p>
                </div>
              )}
              {project.dueDate && (
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p
                    className={`font-medium ${
                      new Date(project.dueDate) < new Date() &&
                      project.status !== "Completed"
                        ? "text-destructive"
                        : ""
                    }`}
                  >
                    {new Date(project.dueDate).toLocaleDateString()}
                  </p>
                </div>
              )}
              {project.completedDate && (
                <div>
                  <p className="text-sm text-muted-foreground">Completed Date</p>
                  <p className="font-medium text-green-600">
                    {new Date(project.completedDate).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Task Dialog */}
      <Dialog open={isAddTaskDialogOpen} onOpenChange={setIsAddTaskDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Add Task to Project
            </DialogTitle>
            <DialogDescription>
              Select an existing task to add to this project
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a task" />
              </SelectTrigger>
              <SelectContent>
                {availableTasks.length > 0 ? (
                  availableTasks.map((task) => (
                    <SelectItem key={task._id} value={task._id}>
                      <div className="flex items-center gap-2">
                        <span>{task.title}</span>
                        <Badge variant="outline" className="text-xs">
                          {task.status}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-2 text-center text-muted-foreground text-sm">
                    No available tasks
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddTaskDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAddTask} disabled={saving || !selectedTaskId}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Task
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Team Member Dialog */}
      <Dialog open={isAddMemberDialogOpen} onOpenChange={setIsAddMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Add Team Member
            </DialogTitle>
            <DialogDescription>
              Select a user to add to the project team
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.length > 0 ? (
                  availableUsers.map((user) => (
                    <SelectItem key={user._id} value={user._id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={user.profileImage} />
                          <AvatarFallback className="text-xs">
                            {user.name?.charAt(0)?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span>{user.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {user.role}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-2 text-center text-muted-foreground text-sm">
                    No available users
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddMemberDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAddMember} disabled={saving || !selectedUserId}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Adding...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Member
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
