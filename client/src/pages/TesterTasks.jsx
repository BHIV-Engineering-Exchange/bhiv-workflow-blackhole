"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { Input } from "../components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert"
import {
  Loader2, CheckSquare, Search, Filter, Clock, Bell,
  ChevronDown, ChevronRight, RefreshCw, Users, AlertCircle, Calendar
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/auth-context"
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

function TesterTasks() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [departments, setDepartments] = useState([])
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [deptFilter, setDeptFilter] = useState("all")
  const [userFilter, setUserFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [expandedGroups, setExpandedGroups] = useState(new Set())

  const fetchData = async () => {
    try {
      setIsLoading(true)
      const [tasksData, deptsData, usersData] = await Promise.all([
        api.tester.getTasks({
          department: deptFilter !== "all" ? deptFilter : undefined,
          assignee: userFilter !== "all" ? userFilter : undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
        }),
        api.tester.getDepartments(),
        api.tester.getUsers(),
      ])
      setTasks(tasksData || [])
      setDepartments(deptsData || [])
      setUsers(usersData || [])
    } catch (error) {
      console.error("Error fetching tester tasks:", error)
      toast({ title: "Error", description: "Failed to load tasks", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [deptFilter, userFilter, statusFilter])

  const filteredTasks = useMemo(() => {
    if (!search) return tasks
    const s = search.toLowerCase()
    return tasks.filter(
      (t) =>
        t.title?.toLowerCase().includes(s) ||
        t.assignee?.name?.toLowerCase().includes(s) ||
        t.department?.name?.toLowerCase().includes(s)
    )
  }, [tasks, search])

  const groupedByDept = useMemo(() => {
    const groups = {}
    filteredTasks.forEach((t) => {
      const key = t.department?._id || "none"
      if (!groups[key]) groups[key] = { name: t.department?.name || "No Department", tasks: [] }
      groups[key].tasks.push(t)
    })
    return groups
  }, [filteredTasks])

  const groupedByUser = useMemo(() => {
    const groups = {}
    filteredTasks.forEach((t) => {
      const key = t.assignee?._id || "none"
      if (!groups[key]) groups[key] = { name: t.assignee?.name || "Unassigned", tasks: [] }
      groups[key].tasks.push(t)
    })
    return groups
  }, [filteredTasks])

  const newTasks = useMemo(() => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    return filteredTasks.filter((t) => new Date(t.createdAt) >= oneDayAgo)
  }, [filteredTasks])

  const toggleGroup = (key) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const TaskTable = ({ taskList }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Department</TableHead>
          <TableHead>Assignee</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Due Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {taskList.map((task) => (
          <TableRow
            key={task._id}
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => navigate(`/tasks/${task._id}`)}
          >
            <TableCell className="font-medium">{task.title}</TableCell>
            <TableCell>
              <Badge variant="outline">{task.department?.name || "—"}</Badge>
            </TableCell>
            <TableCell>{task.assignee?.name || "—"}</TableCell>
            <TableCell>
              <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
            </TableCell>
            <TableCell>
              <Badge className={getStatusColor(task.status)}>{task.status}</Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "—"}
            </TableCell>
          </TableRow>
        ))}
        {taskList.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
              No tasks found
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Loading tasks...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="space-y-2 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <CheckSquare className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">All Tasks</h1>
              <p className="text-muted-foreground">
                View tasks by department, user, and track new assignments
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      <Card className="mb-6 border-l-4 border-l-blue-500 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-500/5 to-transparent pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Filter className="h-4 w-4 text-blue-500" />
            </div>
            <CardTitle className="text-base">Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks, assignees, departments..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d._id} value={d._id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u._id} value={u._id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="h-auto p-0 bg-transparent flex gap-1 mb-6">
          <TabsTrigger
            value="all"
            className="flex items-center gap-2 py-2 px-4 rounded-lg border-2 border-muted data-[state=active]:bg-blue-500 data-[state=active]:border-blue-500 data-[state=active]:text-white hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-950 transition-all duration-200"
          >
            <CheckSquare className="h-4 w-4" />
            <span>All Tasks ({filteredTasks.length})</span>
          </TabsTrigger>
          <TabsTrigger
            value="by-department"
            className="flex items-center gap-2 py-2 px-4 rounded-lg border-2 border-muted data-[state=active]:bg-purple-500 data-[state=active]:border-purple-500 data-[state=active]:text-white hover:bg-purple-50 hover:border-purple-300 dark:hover:bg-purple-950 transition-all duration-200"
          >
            <Users className="h-4 w-4" />
            <span>By Department</span>
          </TabsTrigger>
          <TabsTrigger
            value="by-user"
            className="flex items-center gap-2 py-2 px-4 rounded-lg border-2 border-muted data-[state=active]:bg-teal-500 data-[state=active]:border-teal-500 data-[state=active]:text-white hover:bg-teal-50 hover:border-teal-300 dark:hover:bg-teal-950 transition-all duration-200"
          >
            <Users className="h-4 w-4" />
            <span>By User</span>
          </TabsTrigger>
          <TabsTrigger
            value="new"
            className="flex items-center gap-2 py-2 px-4 rounded-lg border-2 border-muted data-[state=active]:bg-green-500 data-[state=active]:border-green-500 data-[state=active]:text-white hover:bg-green-50 hover:border-green-300 dark:hover:bg-green-950 transition-all duration-200 relative"
          >
            <Bell className="h-4 w-4" />
            <span>New Tasks</span>
            {newTasks.length > 0 && (
              <span className="ml-1 h-5 min-w-[20px] rounded-full bg-red-500 text-white text-xs flex items-center justify-center px-1">
                {newTasks.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-0">
          <Card>
            <TaskTable taskList={filteredTasks} />
          </Card>
        </TabsContent>

        <TabsContent value="by-department" className="mt-0 space-y-4">
          {Object.entries(groupedByDept).map(([deptId, { name, tasks: deptTasks }]) => (
            <Card key={deptId} className="border-l-4 border-l-purple-500 overflow-hidden">
              <CardHeader
                className="cursor-pointer bg-gradient-to-r from-purple-500/5 to-transparent py-4"
                onClick={() => toggleGroup(`dept-${deptId}`)}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {expandedGroups.has(`dept-${deptId}`) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    {name}
                  </CardTitle>
                  <Badge variant="secondary">{deptTasks.length} tasks</Badge>
                </div>
              </CardHeader>
              {expandedGroups.has(`dept-${deptId}`) && (
                <CardContent className="p-0">
                  <TaskTable taskList={deptTasks} />
                </CardContent>
              )}
            </Card>
          ))}
          {Object.keys(groupedByDept).length === 0 && (
            <Card className="bg-muted/40">
              <CardContent className="flex flex-col items-center justify-center py-10">
                <Users className="h-8 w-8 text-muted-foreground mb-3" />
                <h3 className="text-xl font-semibold">No tasks found</h3>
                <p className="text-muted-foreground">Try adjusting your filters</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="by-user" className="mt-0 space-y-4">
          {Object.entries(groupedByUser).map(([userId, { name, tasks: userTasks }]) => (
            <Card key={userId} className="border-l-4 border-l-teal-500 overflow-hidden">
              <CardHeader
                className="cursor-pointer bg-gradient-to-r from-teal-500/5 to-transparent py-4"
                onClick={() => toggleGroup(`user-${userId}`)}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {expandedGroups.has(`user-${userId}`) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    {name}
                  </CardTitle>
                  <Badge variant="secondary">{userTasks.length} tasks</Badge>
                </div>
              </CardHeader>
              {expandedGroups.has(`user-${userId}`) && (
                <CardContent className="p-0">
                  <TaskTable taskList={userTasks} />
                </CardContent>
              )}
            </Card>
          ))}
          {Object.keys(groupedByUser).length === 0 && (
            <Card className="bg-muted/40">
              <CardContent className="flex flex-col items-center justify-center py-10">
                <Users className="h-8 w-8 text-muted-foreground mb-3" />
                <h3 className="text-xl font-semibold">No tasks found</h3>
                <p className="text-muted-foreground">Try adjusting your filters</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="new" className="mt-0">
          {newTasks.length > 0 && (
            <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 mb-4">
              <Bell className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertTitle className="text-blue-800 dark:text-blue-300">New Tasks</AlertTitle>
              <AlertDescription className="text-blue-700 dark:text-blue-400">
                {newTasks.length} new task{newTasks.length !== 1 ? "s" : ""} created in the last 24 hours
              </AlertDescription>
            </Alert>
          )}
          <div className="space-y-4">
            {newTasks.map((task) => (
              <Card
                key={task._id}
                className="border-l-4 border-l-green-500 hover:shadow-lg transition-all cursor-pointer"
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
                          Department:{" "}
                          <span className="font-medium text-foreground">{task.department?.name}</span>
                        </span>
                        <span>
                          Assignee:{" "}
                          <span className="font-medium text-foreground">{task.assignee?.name}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">
                          <Calendar className="inline h-3 w-3 mr-1" />
                          Created: {new Date(task.createdAt).toLocaleString()}
                        </span>
                        {task.dueDate && (
                          <span className="text-muted-foreground">
                            <Clock className="inline h-3 w-3 mr-1" />
                            Due: {new Date(task.dueDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge className={getStatusColor(task.status)}>{task.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
            {newTasks.length === 0 && (
              <Card className="bg-muted/40">
                <CardContent className="flex flex-col items-center justify-center py-10">
                  <Bell className="h-8 w-8 text-muted-foreground mb-3" />
                  <h3 className="text-xl font-semibold">No new tasks</h3>
                  <p className="text-muted-foreground">No tasks created in the last 24 hours</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default TesterTasks
