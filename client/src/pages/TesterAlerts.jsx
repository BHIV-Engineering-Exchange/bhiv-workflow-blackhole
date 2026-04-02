"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import {
  Loader2, AlertTriangle, Clock, Bell, RefreshCw, AlertCircle, Calendar, CheckCircle
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useToast } from "../hooks/use-toast"
import { api } from "../lib/api"

const getStatusColor = (status) => {
  switch (status) {
    case "Completed":
      return "bg-green-500/10 text-green-500 dark:bg-green-500/20 dark:text-green-400"
    case "In Progress":
      return "bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 dark:text-blue-400"
    case "Pending":
      return "bg-amber-500/10 text-amber-500 dark:bg-amber-500/20 dark:text-amber-400"
    default:
      return "bg-gray-500/10 text-gray-500 dark:bg-gray-500/20 dark:text-gray-400"
  }
}

const getPriorityColor = (priority) => {
  switch (priority) {
    case "High":
      return "bg-red-500/10 text-red-500 dark:bg-red-500/20 dark:text-red-400"
    case "Medium":
      return "bg-amber-500/10 text-amber-500 dark:bg-amber-500/20 dark:text-amber-400"
    case "Low":
      return "bg-green-500/10 text-green-500 dark:bg-green-500/20 dark:text-green-400"
    default:
      return "bg-gray-500/10 text-gray-500 dark:bg-gray-500/20 dark:text-gray-400"
  }
}

const getOverdueDays = (dueDate) => {
  return Math.ceil((new Date() - new Date(dueDate)) / (1000 * 60 * 60 * 24))
}

const getDueSoonDays = (dueDate) => {
  return Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24))
}

const getTimeAgo = (date) => {
  const hours = Math.floor((new Date() - new Date(date)) / (1000 * 60 * 60))
  if (hours < 1) return "Less than an hour ago"
  if (hours === 1) return "1 hour ago"
  return `${hours} hours ago`
}

function TesterAlerts() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [alerts, setAlerts] = useState({
    overdueTasks: [],
    dueSoonTasks: [],
    recentlyCreated: [],
  })

  const fetchAlerts = async () => {
    try {
      setIsLoading(true)
      const data = await api.tester.getAlerts()
      setAlerts(data)
    } catch (error) {
      console.error("Error fetching alerts:", error)
      toast({ title: "Error", description: "Failed to load alerts", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAlerts()
  }, [])

  const TaskCard = ({ task, type }) => {
    const borderColor =
      type === "overdue" ? "border-l-red-500" :
      type === "due-soon" ? "border-l-amber-500" :
      "border-l-blue-500"

    return (
      <Card
        className={`border-l-4 ${borderColor} hover:shadow-lg transition-all cursor-pointer`}
        onClick={() => navigate(`/tasks/${task._id}`)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base">{task.title}</h3>
                <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>
                  Department: <span className="font-medium text-foreground">{task.department?.name || "—"}</span>
                </span>
                <span>
                  Assignee: <span className="font-medium text-foreground">{task.assignee?.name || "—"}</span>
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                {task.dueDate && (
                  <span className="text-muted-foreground">
                    <Calendar className="inline h-3 w-3 mr-1" />
                    Due: {new Date(task.dueDate).toLocaleDateString()}
                  </span>
                )}
                {type === "overdue" && task.dueDate && (
                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {getOverdueDays(task.dueDate)} days overdue
                  </Badge>
                )}
                {type === "due-soon" && task.dueDate && (
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                    <Clock className="h-3 w-3 mr-1" />
                    Due in {getDueSoonDays(task.dueDate)} days
                  </Badge>
                )}
                {type === "new" && (
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                    <Bell className="h-3 w-3 mr-1" />
                    {getTimeAgo(task.createdAt)}
                  </Badge>
                )}
              </div>
            </div>
            <Badge className={getStatusColor(task.status)}>{task.status}</Badge>
          </div>
        </CardContent>
      </Card>
    )
  }

  const EmptyState = ({ icon: Icon, title, description }) => (
    <Card className="bg-muted/40">
      <CardContent className="flex flex-col items-center justify-center py-10">
        <Icon className="h-8 w-8 text-muted-foreground mb-3" />
        <h3 className="text-xl font-semibold">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Loading alerts...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="space-y-2 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Task Alerts</h1>
              <p className="text-muted-foreground">Track overdue tasks and upcoming deadlines</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAlerts}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <div className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 border-l-4 border-l-red-500 rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex flex-row items-center justify-between p-6 pb-2">
            <h3 className="text-sm font-medium text-muted-foreground">Overdue</h3>
            <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-red-500" />
            </div>
          </div>
          <div className="p-6 pt-0">
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">{alerts.overdueTasks.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Tasks past due date</p>
          </div>
        </div>

        <div className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 border-l-4 border-l-amber-500 rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex flex-row items-center justify-between p-6 pb-2">
            <h3 className="text-sm font-medium text-muted-foreground">Due Soon</h3>
            <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
          </div>
          <div className="p-6 pt-0">
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">{alerts.dueSoonTasks.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Due within 3 days</p>
          </div>
        </div>

        <div className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 border-l-4 border-l-blue-500 rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex flex-row items-center justify-between p-6 pb-2">
            <h3 className="text-sm font-medium text-muted-foreground">Recently Created</h3>
            <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Bell className="h-5 w-5 text-blue-500" />
            </div>
          </div>
          <div className="p-6 pt-0">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{alerts.recentlyCreated.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Created in last 24 hours</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overdue" className="w-full">
        <TabsList className="h-auto p-0 bg-transparent flex gap-1 mb-6">
          <TabsTrigger
            value="overdue"
            className="flex items-center gap-2 py-2 px-4 rounded-lg border-2 border-muted data-[state=active]:bg-red-500 data-[state=active]:border-red-500 data-[state=active]:text-white hover:bg-red-50 hover:border-red-300 dark:hover:bg-red-950 transition-all duration-200"
          >
            <AlertCircle className="h-4 w-4" />
            <span>Overdue ({alerts.overdueTasks.length})</span>
          </TabsTrigger>
          <TabsTrigger
            value="due-soon"
            className="flex items-center gap-2 py-2 px-4 rounded-lg border-2 border-muted data-[state=active]:bg-amber-500 data-[state=active]:border-amber-500 data-[state=active]:text-white hover:bg-amber-50 hover:border-amber-300 dark:hover:bg-amber-950 transition-all duration-200"
          >
            <Clock className="h-4 w-4" />
            <span>Due Soon ({alerts.dueSoonTasks.length})</span>
          </TabsTrigger>
          <TabsTrigger
            value="new"
            className="flex items-center gap-2 py-2 px-4 rounded-lg border-2 border-muted data-[state=active]:bg-blue-500 data-[state=active]:border-blue-500 data-[state=active]:text-white hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-950 transition-all duration-200"
          >
            <Bell className="h-4 w-4" />
            <span>New Today ({alerts.recentlyCreated.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overdue" className="mt-0 space-y-4">
          {alerts.overdueTasks.length > 0 ? (
            alerts.overdueTasks.map((task) => (
              <TaskCard key={task._id} task={task} type="overdue" />
            ))
          ) : (
            <EmptyState
              icon={CheckCircle}
              title="No overdue tasks"
              description="All tasks are on track!"
            />
          )}
        </TabsContent>

        <TabsContent value="due-soon" className="mt-0 space-y-4">
          {alerts.dueSoonTasks.length > 0 ? (
            alerts.dueSoonTasks.map((task) => (
              <TaskCard key={task._id} task={task} type="due-soon" />
            ))
          ) : (
            <EmptyState
              icon={CheckCircle}
              title="No tasks due soon"
              description="No tasks due in the next 3 days"
            />
          )}
        </TabsContent>

        <TabsContent value="new" className="mt-0 space-y-4">
          {alerts.recentlyCreated.length > 0 ? (
            alerts.recentlyCreated.map((task) => (
              <TaskCard key={task._id} task={task} type="new" />
            ))
          ) : (
            <EmptyState
              icon={Bell}
              title="No new tasks"
              description="No tasks created in the last 24 hours"
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default TesterAlerts
