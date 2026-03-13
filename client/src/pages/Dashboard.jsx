"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip"
import { Plus, Loader2, Mail, FileText, Target, Bell, AlertCircle } from 'lucide-react'
import { CreateTaskDialog } from "../components/tasks/create-task-dialog"
import { DepartmentStats } from "../components/dashboard/department-stats"
import { DepartmentDetails } from "../components/departments/DepartmentDetails"
import { TasksOverview } from "../components/dashboard/tasks-overview"
import { AIInsights } from "../components/dashboard/ai-insights"
import { RecentActivity } from "../components/dashboard/recent-activity"
import { ProcurementAlerts } from "../components/dashboard/procurement-alerts"
import { api } from "../lib/api"
import { useToast } from "../hooks/use-toast"
import { useAuth } from "../context/auth-context"
import AdminChatbot from "../components/admin/admin-chatbot"
import { AdminReportDialog } from "../components/admin/AdminReportDialog"
import OverdueTasks from "../components/admin/OverdueTasks"



function Dashboard() {
  const { toast } = useToast()
  const { user } = useAuth()
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false)
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    pendingTasks: 0,
    totalTasksChange: 0,
    completedTasksChange: 0,
    inProgressTasksChange: 0,
    pendingTasksChange: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSendingReminders, setIsSendingReminders] = useState(false)
  const [isSendingAimReminders, setIsSendingAimReminders] = useState(false)
  const [selectedDepartment, setSelectedDepartment] = useState(null)
  const [showReportDialog, setShowReportDialog] = useState(false)
  const [showOverdueTasksDialog, setShowOverdueTasksDialog] = useState(false)

  const isAdmin = user && (user.role === "Admin" || user.role === "Manager")

  const handleDepartmentSelect = (department) => {
    setSelectedDepartment(department)
  }

  const handleBackToDashboard = () => {
    setSelectedDepartment(null)
  }

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true)
        const dashboardStats = await api.dashboard.getStats()
        setStats(dashboardStats)
      } catch (error) {
        console.error("Error fetching dashboard stats:", error)
        toast({
          title: "Error",
          description: "Failed to load dashboard statistics",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleBroadcastReminders = async () => {
    try {
      setIsSendingReminders(true)
      const result = await api.notifications.broadcastReminders()
      
      // Show detailed success message
      const alertCount = result.alertsCreated || 0
      const userCount = result.usersNotified || 0
      
      toast({
        title: "✅ Broadcast Alerts Sent Successfully!",
        description: `Sent ${alertCount} alert${alertCount !== 1 ? 's' : ''} to ${userCount} user${userCount !== 1 ? 's' : ''}. Users will see alerts in their header notification bell (🔺).`,
        variant: "success",
        duration: 5000,
      })
    } catch (error) {
      console.error("Error sending reminders:", error)
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to send reminder alerts",
        variant: "destructive",
      })
    } finally {
      setIsSendingReminders(false)
    }
  }

  const handleGenerateReports = () => {
    setShowReportDialog(true)
  }
  const handleBroadcastAimReminders = async () => {
    try {
      setIsSendingAimReminders(true)
      const result = await api.notifications.broadcastAimReminders()
      
      // Show detailed success message
      const alertCount = result.alertsCreated || 0
      const userCount = result.usersNotified || 0
      
      toast({
        title: "✅ Aim Reminder Alerts Sent Successfully!",
        description: `Sent ${alertCount} alert${alertCount !== 1 ? 's' : ''} to ${userCount} user${userCount !== 1 ? 's' : ''}. Users will see alerts in their header notification bell (🔺) to set their daily aims.`,
        variant: "success",
        duration: 5000,
      })
    } catch (error) {
      console.error("Error sending aim reminders:", error)
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to send aim reminder alerts",
        variant: "destructive",
      })
    } finally {
      setIsSendingAimReminders(false)
    }
  }
  

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // Show department details if a department is selected
  if (selectedDepartment) {
    return (
      <DepartmentDetails 
        department={selectedDepartment} 
        onBack={handleBackToDashboard} 
      />
    )
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Enhanced Header Section */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="text-lg text-muted-foreground">
            Welcome back! Here's an overview of your workflow.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button
            onClick={() => setIsCreateTaskOpen(true)}
            className="gradient-primary hover:glow-primary transition-cyber transform hover:scale-105 group hover-cyber"
          >
            <Plus className="mr-2 h-5 w-5 transition-cyber group-hover:rotate-90" />
            Create New Task
          </Button>
          
          {isAdmin && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
              <Button
                variant="outline"
                onClick={handleBroadcastReminders}
                disabled={isSendingReminders}
                className="neo-button hover:glow-accent transition-cyber"
              >
                {isSendingReminders ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                        <Bell className="mr-2 h-4 w-4" />
                )}
                Broadcast Task Reminders
              </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="font-semibold">Send Task Completion Alerts</p>
                    <p className="text-xs mt-1">Sends alerts to all users with incomplete tasks. Alerts appear in the header notification bell (🔺).</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Button
                variant="outline"
                onClick={handleGenerateReports}
                className="neo-button hover:glow-accent transition-cyber"
              >
                  <FileText className="mr-2 h-4 w-4" />
                Generate Reports
              </Button>

              {/* Button 5 - Overdue Tasks (Red Button) */}
              <Button
                onClick={() => setShowOverdueTasksDialog(true)}
                className="bg-red-500 hover:bg-red-600 text-white shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <AlertCircle className="mr-2 h-4 w-4" />
                Overdue Tasks
              </Button>
            </>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={handleBroadcastAimReminders}
                  disabled={isSendingAimReminders}
                  className="neo-button hover:glow-accent transition-cyber"
                >
                  {isSendingAimReminders ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Bell className="mr-2 h-4 w-4" />
                  )}
                  Broadcast Aim Reminders
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-semibold">Send Daily Aims Reminder Alerts</p>
                <p className="text-xs mt-1">Sends alerts to all users to set their daily aims. Alerts appear in the header notification bell (🔺).</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Enhanced Cyber Stats Cards */}
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
        <Card className="neo-card hover-neo group relative overflow-hidden border-primary/20">
          <div className="absolute inset-0 bg-cyber-grid opacity-20"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 relative z-10">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Total Tasks</CardTitle>
            <div className="p-3 gradient-primary rounded-2xl glow-primary group-hover:animate-glow-pulse transition-cyber transform group-hover:scale-110">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="h-6 w-6 text-primary-foreground"
              >
                <path d="M9 11H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-2M9 11V9a2 2 0 1 1 4 0v2M9 11h6" />
              </svg>
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-4xl font-bold text-foreground mb-2">{stats.totalTasks}</div>
            <div className={`flex items-center gap-2 text-sm font-medium ${
              stats.totalTasksChange >= 0 ? 'text-accent' : 'text-destructive'
            }`}>
              <div className={`p-1 rounded-full ${stats.totalTasksChange >= 0 ? 'bg-accent/20' : 'bg-destructive/20'}`}>
                {stats.totalTasksChange >= 0 ? (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M7 17l9.2-9.2M17 17V7H7" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 7l-9.2 9.2M7 7v10h10" />
                  </svg>
                )}
              </div>
              <span>{stats.totalTasksChange >= 0 ? "+" : ""}{stats.totalTasksChange}% vs last month</span>
            </div>
          </CardContent>
        </Card>

        <Card className="card-modern hover-lift group border-green-500/10 hover:border-green-500/20 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed Tasks</CardTitle>
            <div className="p-2 bg-gradient-to-br from-green-500/10 to-green-600/10 rounded-lg group-hover:from-green-500/20 group-hover:to-green-600/20 transition-all duration-300">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="h-5 w-5 text-accent"
              >
                <path d="M9 12l2 2 4-4" />
                <circle cx="12" cy="12" r="10" />
              </svg>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground mb-1">{stats.completedTasks}</div>
            <p className={`text-sm flex items-center gap-1 ${
              stats.completedTasksChange >= 0 ? 'text-accent' : 'text-destructive'
            }`}>
              {stats.completedTasksChange >= 0 ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l9.2-9.2M17 17V7H7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 7l-9.2 9.2M7 7v10h10" />
                </svg>
              )}
              {stats.completedTasksChange >= 0 ? "+" : ""}{stats.completedTasksChange}% from last month
            </p>
          </CardContent>
        </Card>

        <Card className="card-modern hover-lift group border-orange-500/10 hover:border-orange-500/20 transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
            <div className="p-2 bg-gradient-to-br from-orange-500/10 to-orange-600/10 rounded-lg group-hover:from-orange-500/20 group-hover:to-orange-600/20 transition-all duration-300">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="h-5 w-5 text-orange-600"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgressTasks}</div>
            <p className="text-xs text-muted-foreground">
              {stats.inProgressTasksChange > 0 ? "+" : ""}
              {stats.inProgressTasksChange} tasks since yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingTasks}</div>
            <p className="text-xs text-muted-foreground">
              {stats.pendingTasksChange > 0 ? "+" : ""}
              {stats.pendingTasksChange} tasks since yesterday
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Procurement Alerts for Admins */}
      {isAdmin && <ProcurementAlerts />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <DepartmentStats onDepartmentSelect={handleDepartmentSelect} />
        <TasksOverview />
        <AIInsights />
      </div>

      <CreateTaskDialog open={isCreateTaskOpen} onOpenChange={setIsCreateTaskOpen} />
      
      {/* Admin Report Dialog */}
      {isAdmin && (
        <AdminReportDialog 
          open={showReportDialog} 
          onOpenChange={setShowReportDialog} 
        />
      )}
      
      {/* Admin Chatbot - Available for all users */}
      {isAdmin && <AdminChatbot />}
      
      {/* Overdue Tasks Dialog */}
      {isAdmin && (
        <OverdueTasks 
          open={showOverdueTasksDialog} 
          onOpenChange={setShowOverdueTasksDialog} 
        />
      )}
    </div>
  )
}

export default Dashboard