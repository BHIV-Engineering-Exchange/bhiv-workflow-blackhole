"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { Progress } from "../components/ui/progress"
import { Input } from "../components/ui/input"
import {
  Loader2,
  CheckCircle,
  Clock,
  Calendar,
  Github,
  ExternalLink,
  FileText,
  Search,
  RefreshCw,
  Eye,
  ListTodo,
  CheckSquare,
  Timer,
} from "lucide-react"
import { useToast } from "../hooks/use-toast"
import { useAuth } from "../context/auth-context"
import { API_URL } from "@/lib/api"
import { formatDate } from "@/lib/dateFormat"
import axios from "axios"
import { TaskSubmissionDialog } from "../components/tasks/task-submission-dialog"

function MyTasks() {
  const navigate = useNavigate()
  const { toast } = useToast()
  useAuth()
  const [tasks, setTasks] = useState([])
  const [submissions, setSubmissions] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTask, setSelectedTask] = useState(null)
  const [isSubmissionDialogOpen, setIsSubmissionDialogOpen] = useState(false)

  useEffect(() => {
    fetchMyTasks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchMyTasks = async () => {
    const storedUser = JSON.parse(localStorage.getItem("WorkflowUser"))
    if (!storedUser?.id) {
      console.error("User ID is undefined")
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      const token = localStorage.getItem("WorkflowToken")

      // Fetch user's tasks
      const tasksResponse = await axios.get(`${API_URL}/users/${storedUser.id}/tasks`, {
        headers: { "x-auth-token": token },
      })

      const userTasks = tasksResponse.data || []
      setTasks(userTasks)

      // Fetch submissions for each task
      const submissionsMap = {}
      for (const task of userTasks) {
        try {
          const submissionResponse = await axios.get(`${API_URL}/submissions/task/${task._id}`, {
            headers: { "x-auth-token": token },
          })
          if (submissionResponse.data) {
            submissionsMap[task._id] = submissionResponse.data
          }
        } catch {
          // No submission for this task
        }
      }
      setSubmissions(submissionsMap)
    } catch (error) {
      console.error("Error fetching tasks:", error)
      toast({
        title: "Error",
        description: "Failed to load your tasks",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case "Completed":
        return "bg-green-500/10 text-green-500 border-green-500/20"
      case "In Progress":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20"
      case "Pending":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20"
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20"
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "High":
        return "bg-red-500/10 text-red-500 border-red-500/20"
      case "Medium":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20"
      case "Low":
        return "bg-green-500/10 text-green-500 border-green-500/20"
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20"
    }
  }

  const getDaysRemaining = (dueDate) => {
    const today = new Date()
    const due = new Date(dueDate)
    const diffTime = due - today
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const handleSubmitTask = async (submissionData) => {
    try {
      const token = localStorage.getItem("WorkflowToken")
      const config = {
        headers: {
          "x-auth-token": token,
          "Content-Type": "multipart/form-data",
        },
      }

      submissionData.append("task", selectedTask._id)

      const existingSubmission = submissions[selectedTask._id]
      
      if (existingSubmission) {
        await axios.put(`${API_URL}/submissions/${existingSubmission._id}`, submissionData, config)
        toast({
          title: "Success",
          description: "Your submission has been updated and resubmitted to admin for review",
        })
      } else {
        await axios.post(`${API_URL}/submissions`, submissionData, config)
        toast({
          title: "Success",
          description: "Your task has been submitted successfully",
        })
      }

      setIsSubmissionDialogOpen(false)
      fetchMyTasks()
    } catch (error) {
      console.error("Error submitting task:", error)
      toast({
        title: "Error",
        description: error?.response?.data?.error || "Failed to submit task",
        variant: "destructive",
      })
    }
  }

  const openSubmissionDialog = (task) => {
    setSelectedTask(task)
    setIsSubmissionDialogOpen(true)
  }

  // Filter tasks based on active tab
  const filteredTasks = tasks.filter((task) => {
    const hasSubmission = !!submissions[task._id]
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase())

    if (!matchesSearch) return false

    switch (activeTab) {
      case "submitted":
        return hasSubmission
      case "pending":
        return task.status === "Pending" && !hasSubmission
      case "inprogress":
        return task.status === "In Progress"
      case "completed":
        return task.status === "Completed"
      default:
        return true
    }
  })

  // Stats
  const stats = {
    total: tasks.length,
    submitted: tasks.filter(t => submissions[t._id]).length,
    pending: tasks.filter(t => t.status === "Pending" && !submissions[t._id]).length,
    inProgress: tasks.filter(t => t.status === "In Progress").length,
    completed: tasks.filter(t => t.status === "Completed").length,
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">My Tasks</h1>
          <p className="text-muted-foreground mt-1">Manage and track all your assigned tasks</p>
        </div>
        <Button 
          onClick={fetchMyTasks} 
          variant="outline" 
          size="sm"
          className="group border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all duration-300 rounded-xl px-4 py-2"
        >
          <RefreshCw className="h-4 w-4 mr-2 group-hover:rotate-180 transition-transform duration-500" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card 
          className={`cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 border-2 ${activeTab === 'all' ? 'border-primary bg-primary/5' : 'border-transparent hover:border-primary/30'}`}
          onClick={() => setActiveTab("all")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-inner">
                <ListTodo className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">{stats.total}</p>
                <p className="text-xs text-muted-foreground font-medium">Total Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/10 hover:-translate-y-1 border-2 ${activeTab === 'pending' ? 'border-amber-500 bg-amber-500/5' : 'border-transparent hover:border-amber-500/30'}`}
          onClick={() => setActiveTab("pending")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 shadow-inner">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.pending}</p>
                <p className="text-xs text-muted-foreground font-medium">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10 hover:-translate-y-1 border-2 ${activeTab === 'inprogress' ? 'border-blue-500 bg-blue-500/5' : 'border-transparent hover:border-blue-500/30'}`}
          onClick={() => setActiveTab("inprogress")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 shadow-inner">
                <Timer className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.inProgress}</p>
                <p className="text-xs text-muted-foreground font-medium">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10 hover:-translate-y-1 border-2 ${activeTab === 'submitted' ? 'border-purple-500 bg-purple-500/5' : 'border-transparent hover:border-purple-500/30'}`}
          onClick={() => setActiveTab("submitted")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 shadow-inner">
                <CheckSquare className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.submitted}</p>
                <p className="text-xs text-muted-foreground font-medium">Submitted</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-green-500/10 hover:-translate-y-1 border-2 ${activeTab === 'completed' ? 'border-green-500 bg-green-500/5' : 'border-transparent hover:border-green-500/30'}`}
          onClick={() => setActiveTab("completed")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5 shadow-inner">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.completed}</p>
                <p className="text-xs text-muted-foreground font-medium">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11 h-12 rounded-xl border-2 border-muted hover:border-primary/30 focus:border-primary transition-all duration-300 bg-background/50 backdrop-blur-sm"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 h-12 p-1 bg-muted/50 rounded-xl">
          <TabsTrigger value="all" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-300 font-medium">All ({stats.total})</TabsTrigger>
          <TabsTrigger value="pending" className="rounded-lg data-[state=active]:bg-amber-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 font-medium">Pending ({stats.pending})</TabsTrigger>
          <TabsTrigger value="inprogress" className="rounded-lg data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 font-medium">In Progress ({stats.inProgress})</TabsTrigger>
          <TabsTrigger value="submitted" className="rounded-lg data-[state=active]:bg-purple-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 font-medium">Submitted ({stats.submitted})</TabsTrigger>
          <TabsTrigger value="completed" className="rounded-lg data-[state=active]:bg-green-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300 font-medium">Completed ({stats.completed})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filteredTasks.length === 0 ? (
            <Card className="border-2 border-dashed border-muted-foreground/20">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="p-4 rounded-full bg-muted/50 mb-4">
                  <ListTodo className="h-12 w-12 text-muted-foreground/50" />
                </div>
                <p className="text-lg font-medium text-muted-foreground">No tasks found</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Tasks matching your filter will appear here</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredTasks.map((task) => {
                const submission = submissions[task._id]
                const daysRemaining = getDaysRemaining(task.dueDate)

                return (
                  <Card key={task._id} className="group hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 border-2 border-transparent hover:border-primary/20 rounded-xl overflow-hidden">
                    <CardContent className="p-6 bg-gradient-to-br from-background to-muted/20">
                      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                        {/* Task Info */}
                        <div className="flex-1 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-semibold text-lg">{task.title}</h3>
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                {task.description}
                              </p>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              <Badge className={getStatusColor(task.status)}>{task.status}</Badge>
                              <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                            </div>
                          </div>

                          {/* Progress */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Progress</span>
                              <span className="font-medium">{task.progress || 0}%</span>
                            </div>
                            <Progress value={task.progress || 0} className="h-2" />
                          </div>

                          {/* Meta Info */}
                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>Due: {formatDate(task.dueDate)}</span>
                              {daysRemaining <= 2 && daysRemaining >= 0 && (
                                <Badge variant="destructive" className="ml-1 text-xs">
                                  {daysRemaining === 0 ? "Due Today" : `${daysRemaining}d left`}
                                </Badge>
                              )}
                              {daysRemaining < 0 && (
                                <Badge variant="destructive" className="ml-1 text-xs">Overdue</Badge>
                              )}
                            </div>
                            {task.department && (
                              <div className="flex items-center gap-1">
                                <span>Dept: {task.department.name}</span>
                              </div>
                            )}
                          </div>

                          {/* Submission Info */}
                          {submission && (
                            <div className="mt-4 p-4 bg-gradient-to-r from-green-500/10 via-green-500/5 to-transparent rounded-xl border border-green-500/20">
                              <div className="flex items-center gap-2 mb-3">
                                <div className="p-1.5 rounded-lg bg-green-500/20">
                                  <CheckSquare className="h-4 w-4 text-green-500" />
                                </div>
                                <span className="text-sm font-semibold text-green-600 dark:text-green-400">Submitted</span>
                                {submission.status && (
                                  <Badge className={`ml-auto ${submission.status === "Approved" ? "bg-green-500 text-white" : submission.status === "Rejected" ? "bg-red-500 text-white" : "bg-amber-500 text-white"}`}>
                                    {submission.status}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-3 text-sm">
                                {submission.githubLink && (
                                  <a
                                    href={submission.githubLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors font-medium"
                                  >
                                    <Github className="h-3.5 w-3.5" />
                                    Repository
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                                {submission.documentLink && (
                                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground font-medium">
                                    <FileText className="h-3.5 w-3.5" />
                                    Document attached
                                  </span>
                                )}
                              </div>
                              {submission.feedback && (
                                <div className="mt-3 p-3 bg-background/80 rounded-lg border text-sm">
                                  <span className="font-semibold text-foreground">Feedback: </span>
                                  <span className="text-muted-foreground">{submission.feedback}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex lg:flex-col gap-3 lg:w-36">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-10 rounded-xl border-2 border-muted hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 font-medium group/btn"
                            onClick={() => navigate(`/tasks/${task._id}`)}
                          >
                            <Eye className="h-4 w-4 mr-2 group-hover/btn:scale-110 transition-transform" />
                            View Details
                          </Button>
                          <Button
                            size="sm"
                            className={`flex-1 h-10 rounded-xl font-semibold transition-all duration-300 shadow-md hover:shadow-lg group/btn ${submission ? 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white' : 'bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground'}`}
                            onClick={() => openSubmissionDialog(task)}
                          >
                            {submission ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 group-hover/btn:rotate-180 transition-transform duration-500" />
                                Update
                              </>
                            ) : (
                              <>
                                <CheckSquare className="h-4 w-4 mr-2 group-hover/btn:scale-110 transition-transform" />
                                Submit
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Submission Dialog */}
      {selectedTask && (
        <TaskSubmissionDialog
          open={isSubmissionDialogOpen}
          onOpenChange={setIsSubmissionDialogOpen}
          onSubmit={handleSubmitTask}
          existingSubmission={submissions[selectedTask._id]}
        />
      )}
    </div>
  )
}

export default MyTasks
