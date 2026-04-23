"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import {
  Loader2, CheckCircle, Clock, AlertCircle, ClipboardCheck,
  RefreshCw, AlertTriangle, BarChart3
} from "lucide-react"
import { useAuth } from "../context/auth-context"
import { useToast } from "../hooks/use-toast"
import { api } from "../lib/api"
import { formatDate } from "../lib/dateFormat"
import { useNavigate } from "react-router-dom"
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend
} from "recharts"

const VERDICT_COLORS = {
  APPROVED: "#22c55e",
  "APPROVED WITH MINOR FIXES": "#f59e0b",
  "REVISION REQUIRED": "#f97316",
  REJECTED: "#ef4444",
  PENDING: "#6b7280",
}

const getVerdictBadgeColor = (verdict) => {
  switch (verdict) {
    case "APPROVED":
      return "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
    case "APPROVED WITH MINOR FIXES":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
    case "REVISION REQUIRED":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300"
    case "REJECTED":
      return "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300"
  }
}

function TesterDashboard() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({
    totalTasks: 0,
    pendingTasks: 0,
    completedTasks: 0,
    totalEvaluations: 0,
    overdueTasks: 0,
    recentEvaluations: [],
    verdictStats: [],
  })
  const [testBucketRows, setTestBucketRows] = useState([])

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true)
      const [data, feedRows] = await Promise.all([
        api.tester.getDashboardStats(),
        api.tester.getTestedTasksFeed(),
      ])
      setStats(data)
      setTestBucketRows((feedRows || []).filter((row) => !row.evaluation))
    } catch (error) {
      console.error("Error fetching tester dashboard:", error)
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const verdictChartData = (stats.verdictStats || []).map((v) => ({
    name: v._id || "PENDING",
    count: v.count,
  }))

  const openEvaluationFromBucket = (row) => {
    const submission = row?.submission
    const taskId = submission?.task?._id || submission?.task
    const submissionId = submission?._id
    const submittedBy = submission?.user?._id || ""
    const taskTitle = submission?.task?.title || ""
    const params = new URLSearchParams()
    if (taskId) params.set("taskId", taskId)
    if (submissionId) params.set("submissionId", submissionId)
    if (submittedBy) params.set("submittedBy", submittedBy)
    if (taskTitle) params.set("taskTitle", taskTitle)
    navigate(`/tester-evaluation?${params.toString()}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Loading testing dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="relative overflow-hidden rounded-lg p-6">
        <div className="relative flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight text-foreground">
              Testing Dashboard
            </h1>
            <p className="text-muted-foreground text-lg">
              Welcome back, <span className="font-semibold text-foreground">{user?.name || "Tester"}</span>! Here's your testing overview.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={fetchDashboardData}
            className="relative overflow-hidden group hover:border-primary/50 transition-all"
          >
            <RefreshCw className="mr-2 h-4 w-4 group-hover:rotate-180 transition-transform duration-500" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 border-l-4 border-l-blue-500 rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
            <h3 className="text-sm font-medium text-muted-foreground">Total Tasks</h3>
            <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ClipboardCheck className="h-5 w-5 text-blue-500" />
            </div>
          </div>
          <div className="p-6 pt-0">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.totalTasks}</div>
            <p className="text-xs text-muted-foreground mt-1">All tasks in system</p>
          </div>
        </div>

        <div className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 border-l-4 border-l-amber-500 rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
            <h3 className="text-sm font-medium text-muted-foreground">Pending</h3>
            <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
          </div>
          <div className="p-6 pt-0">
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">{stats.pendingTasks}</div>
            <p className="text-xs text-muted-foreground mt-1">Tasks awaiting action</p>
          </div>
        </div>

        <div className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 border-l-4 border-l-green-500 rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
            <h3 className="text-sm font-medium text-muted-foreground">Completed</h3>
            <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
          </div>
          <div className="p-6 pt-0">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.completedTasks}</div>
            <p className="text-xs text-muted-foreground mt-1">Tasks completed</p>
          </div>
        </div>

        <div className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 border-l-4 border-l-purple-500 rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
            <h3 className="text-sm font-medium text-muted-foreground">Evaluations</h3>
            <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ClipboardCheck className="h-5 w-5 text-purple-500" />
            </div>
          </div>
          <div className="p-6 pt-0">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{stats.totalEvaluations}</div>
            <p className="text-xs text-muted-foreground mt-1">Evaluations completed</p>
          </div>
        </div>

        <div className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 border-l-4 border-l-red-500 rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
            <h3 className="text-sm font-medium text-muted-foreground">Overdue</h3>
            <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
          </div>
          <div className="p-6 pt-0">
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">{stats.overdueTasks}</div>
            <p className="text-xs text-muted-foreground mt-1">Tasks past due date</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="neo-card shadow-lg border-l-4 border-l-purple-500">
          <CardHeader className="border-b bg-gradient-to-r from-purple-500/5 to-transparent">
            <CardTitle className="text-xl flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-purple-500" />
              </div>
              Evaluation Verdicts
            </CardTitle>
            <CardDescription>Distribution of your evaluation outcomes</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {verdictChartData.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={verdictChartData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="count"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {verdictChartData.map((entry, i) => (
                        <Cell key={i} fill={VERDICT_COLORS[entry.name] || "#6b7280"} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        padding: "12px",
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardCheck className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
                <p>No evaluations yet. Start evaluating tasks!</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="neo-card shadow-lg border-l-4 border-l-blue-500">
          <CardHeader className="border-b bg-gradient-to-r from-blue-500/5 to-transparent">
            <CardTitle className="text-xl flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <ClipboardCheck className="h-4 w-4 text-blue-500" />
              </div>
              Recent Evaluations
            </CardTitle>
            <CardDescription>Your latest task evaluations</CardDescription>
          </CardHeader>
          <CardContent>
            {(stats.recentEvaluations || []).length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Verdict</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recentEvaluations.map((ev) => (
                    <TableRow key={ev._id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium">{ev.task?.title || "Unknown"}</TableCell>
                      <TableCell>
                        <Badge className={getVerdictBadgeColor(ev.finalVerdict)}>
                          {ev.finalVerdict}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(ev.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardCheck className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
                <p>No evaluations yet</p>
              </div>
            )}
            <div className="pt-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate("/tester-evaluation")}
              >
                View All Evaluations
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="neo-card shadow-lg border-l-4 border-l-amber-500">
        <CardHeader className="border-b bg-gradient-to-r from-amber-500/5 to-transparent">
          <CardTitle className="text-xl flex items-center justify-between gap-2">
            <span>Test Bucket ({testBucketRows.length})</span>
            <Button variant="outline" size="sm" onClick={() => navigate("/tested-tasks")}>
              Open Test Tasks
            </Button>
          </CardTitle>
          <CardDescription>
            Newly submitted repo tasks waiting for tester evaluation
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {testBucketRows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submitted Date</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>Submitted By</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {testBucketRows.slice(0, 8).map((row) => (
                  <TableRow key={row.submission?._id}>
                    <TableCell>{formatDate(row.submission?.createdAt)}</TableCell>
                    <TableCell className="font-medium">{row.submission?.task?.title || "—"}</TableCell>
                    <TableCell>{row.submission?.user?.name || "—"}</TableCell>
                    <TableCell>
                      <Button size="sm" onClick={() => openEvaluationFromBucket(row)}>
                        Evaluate
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              No tasks in test bucket
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default TesterDashboard
