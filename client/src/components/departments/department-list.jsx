"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { Progress } from "../ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { MoreHorizontal, Users, CheckSquare, Loader2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"
import { useToast } from "../../hooks/use-toast"
import { api } from "../../lib/api"
import { useSocketContext } from "../../context/socket-context"
import { getDeptColor } from "@/lib/departmentUtils"

export function DepartmentList({ onDepartmentSelect }) {
  const { toast } = useToast()
  const { events } = useSocketContext()
  const [departments, setDepartments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [departmentTasks, setDepartmentTasks] = useState({})

  // Helper function to count active members
  const getActiveMemberCount = (members) => {
    if (!Array.isArray(members)) return 0;
    // Filter out null/undefined members (these are inactive users that didn't populate)
    return members.filter(member => member && member._id).length;
  }

  // Fetch departments
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        setIsLoading(true)
        const response = await api.departments.getDepartments()
        console.log('DepartmentList - Departments response:', response)

        // Handle new API response format
        const data = response.success ? response.data : response
        setDepartments(Array.isArray(data) ? data : [])
        
        // Fetch tasks for each department
        const tasksPromises = data.map(async (dept) => {
          try {
            const departmentId = dept._id || dept.id;
            if (!departmentId) {
              console.warn('Department missing ID:', dept);
              return {
                departmentId: dept.name || 'unknown',
                tasks: { total: 0, completed: 0 }
              };
            }

            const tasks = await api.departments.getDepartmentTasks(departmentId)
            // Filter tasks that have active assignees (tasks with null assignees are filtered out by backend)
            const activeTasks = tasks.filter(task => task.assignee && task.assignee._id);
            const completed = activeTasks.filter(task => task.status === "Completed").length
            
            return {
              departmentId: departmentId,
              tasks: {
                total: activeTasks.length,
                completed: completed
              }
            }
          } catch (error) {
            console.error(`Error fetching tasks for department ${dept.name}:`, error)
            return {
              departmentId: dept._id || dept.id || dept.name,
              tasks: { total: 0, completed: 0 }
            }
          }
        })
        
        const tasksResults = await Promise.all(tasksPromises)
        const tasksMap = {}
        tasksResults.forEach(result => {
          tasksMap[result.departmentId] = result.tasks
        })
        
        setDepartmentTasks(tasksMap)
        setError(null)
      } catch (err) {
        setError(err.message || "Failed to load departments")
        toast({
          title: "Error",
          description: err.message || "Failed to load departments",
          variant: "destructive"
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchDepartments()
  }, [toast])

  // Listen for socket events to update departments
  useEffect(() => {
    if (events.length > 0) {
      const latestEvent = events[events.length - 1]
      
      if (latestEvent.type === 'department-created') {
        setDepartments(prev => [...prev, latestEvent.data])
        setDepartmentTasks(prev => ({
          ...prev,
          [latestEvent.data._id || latestEvent.data.id]: { total: 0, completed: 0 }
        }))
      } 
      else if (latestEvent.type === 'department-updated') {
        setDepartments(prev => prev.map(dept => 
          (dept._id || dept.id) === (latestEvent.data._id || latestEvent.data.id) ? latestEvent.data : dept
        ))
      }
      else if (latestEvent.type === 'department-deleted') {
        setDepartments(prev => prev.filter(dept => (dept._id || dept.id) !== (latestEvent.data._id || latestEvent.data.id)))
        setDepartmentTasks(prev => {
          const newMap = {...prev}
          delete newMap[latestEvent.data._id || latestEvent.data.id]
          return newMap
        })
      }
    }
  }, [events])

  const handleDeleteDepartment = async (deptId) => {
    if (confirm("Are you sure you want to delete this department?")) {
      try {
        setIsDeleting(true)
        await api.departments.deleteDepartment(deptId)
        setDepartments(departments.filter(dept => (dept._id || dept.id) !== deptId))
        toast({
          title: "Success",
          description: "Department deleted successfully"
        })
      } catch (error) {
        console.error("Error deleting department:", error)
        toast({
          title: "Error",
          description: error.message || "Failed to delete department",
          variant: "destructive"
        })
      } finally {
        setIsDeleting(false)
      }
    }
  }

  if (isLoading) {
    return (
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <CardTitle>All Departments</CardTitle>
          <CardDescription>Manage and view all departments</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading departments...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-l-4 border-l-destructive">
        <CardHeader className="pb-3">
          <CardTitle>All Departments</CardTitle>
          <CardDescription>Manage and view all departments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-4">
              <svg className="h-6 w-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-destructive font-medium mb-4">Error loading departments: {error}</p>
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Tabs defaultValue="grid" className="w-full">
      <div className="flex gap-4 mb-6">
        <TabsList className="h-auto p-0 bg-transparent">
          <TabsTrigger 
            value="grid"
            className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl border-2 border-muted data-[state=active]:bg-green-500 data-[state=active]:border-green-500 data-[state=active]:text-white transition-all duration-200 hover:border-green-500/50"
          >
            <span className="font-semibold">Grid View</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsList className="h-auto p-0 bg-transparent">
          <TabsTrigger 
            value="list"
            className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl border-2 border-muted data-[state=active]:bg-green-500 data-[state=active]:border-green-500 data-[state=active]:text-white transition-all duration-200 hover:border-green-500/50"
          >
            <span className="font-semibold">List View</span>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="grid" className="mt-0">
        {departments.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">No departments found</h3>
              <p className="text-muted-foreground text-center max-w-sm mb-6">
                Create a new department to get started with organizing your team.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-h-[75vh] overflow-y-auto pr-2 pb-4">
            {departments.map((department) => {
              const departmentId = department._id || department.id;
              const tasks = departmentTasks[departmentId] || { total: 0, completed: 0 }
              const completionPercentage = tasks.total > 0 
                ? Math.round((tasks.completed / tasks.total) * 100) 
                : 0
              
              // Count only active members (backend filters inactive users to null)
              const activeMemberCount = getActiveMemberCount(department.members);
              const deptColorInfo = getDeptColor(department.color);
              
              return (
                <Card 
                  key={departmentId} 
                  className="group cursor-pointer hover:shadow-xl transition-all duration-300 border-l-4 hover:scale-[1.02] overflow-hidden bg-gradient-to-br from-card to-card/50 backdrop-blur-sm"
                  style={deptColorInfo.borderLeftStyle}
                  onClick={() => onDepartmentSelect && onDepartmentSelect(department)}
                >
                  {/* Color Accent Bar at Top */}
                  <div 
                    className="h-1 w-full" 
                    style={deptColorInfo.style}
                  />
                  
                  <CardHeader className="pb-3 relative">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2 flex-1">
                        <CardTitle className="flex items-center gap-2.5 text-lg group-hover:text-primary transition-colors">
                          <div 
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shadow-lg group-hover:scale-110 transition-transform text-white ${deptColorInfo.bgClass}`}
                            style={deptColorInfo.style}
                          >
                            {department.name.charAt(0)}
                          </div>
                          <span>{department.name}</span>
                        </CardTitle>
                        <CardDescription className="text-sm line-clamp-2">{department.description}</CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="hover:bg-accent/50"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => onDepartmentSelect && onDepartmentSelect(department)}>
                            View Department
                          </DropdownMenuItem>
                          <DropdownMenuItem>Edit Department</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteDepartment(departmentId);
                            }}
                            disabled={isDeleting}
                          >
                            Delete Department
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* Department Lead Section */}
                    <div className={`p-3 rounded-lg border ${
                      department.lead 
                        ? 'bg-green-500/10 border-green-500/30' 
                        : 'bg-red-500/10 border-red-500/30'
                    }`}>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-semibold truncate ${
                          department.lead ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                        }`}>
                          {department.lead?.name || "No lead assigned"}
                          {department.lead && !department.lead.stillExist && (
                            <Badge variant="destructive" className="ml-2 text-xs">Inactive</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">Department Lead</div>
                      </div>
                    </div>

                    {/* Stats Section */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-primary/5 border border-primary/10">
                        <div className="flex items-center gap-1.5 text-primary mb-1">
                          <Users className="h-4 w-4" />
                          <span className="text-xl font-bold">{activeMemberCount}</span>
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">Members</span>
                      </div>
                      <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                        <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 mb-1">
                          <CheckSquare className="h-4 w-4" />
                          <span className="text-xl font-bold">{tasks.completed}/{tasks.total}</span>
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">Tasks</span>
                      </div>
                    </div>

                    {/* Progress Section */}
                    <div className="space-y-2 p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Completion Rate</span>
                        <Badge 
                          variant="outline" 
                          className="font-bold"
                          style={{ 
                            backgroundColor: `${deptColorInfo.hexColor}15`,
                            borderColor: deptColorInfo.hexColor,
                            color: deptColorInfo.hexColor
                          }}
                        >
                          {completionPercentage}%
                        </Badge>
                      </div>
                      <Progress 
                        value={completionPercentage} 
                        className="h-2.5"
                        style={{
                          backgroundColor: `${deptColorInfo.hexColor}20`
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </TabsContent>

      <TabsContent value="list" className="mt-0">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-3 border-b bg-gradient-to-r from-primary/5 to-accent/5">
            <CardTitle>All Departments</CardTitle>
            <CardDescription>Manage and view all departments</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {departments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">No departments found</h3>
                <p className="text-muted-foreground text-center max-w-sm">
                  Create a new department to get started with organizing your team.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {departments.map((department) => {
                  const departmentId = department._id || department.id;
                  const tasks = departmentTasks[departmentId] || { total: 0, completed: 0 }
                  const completionPercentage = tasks.total > 0 
                    ? Math.round((tasks.completed / tasks.total) * 100) 
                    : 0
                  
                  // Count only active members (backend filters inactive users to null)
                  const activeMemberCount = getActiveMemberCount(department.members);
                    
                  return (
                    <div 
                      key={departmentId} 
                      className="flex items-center justify-between p-4 border border-l-4 rounded-lg cursor-pointer hover:shadow-md hover:bg-accent/5 transition-all duration-200"
                      style={{ borderLeftColor: department.color }}
                      onClick={() => onDepartmentSelect && onDepartmentSelect(department)}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold shadow-sm text-white bg-green-500`}
                        >
                          {department.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-semibold">{department.name}</h3>
                          <p className="text-sm text-muted-foreground">{department.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{activeMemberCount}</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg">
                          <CheckSquare className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {tasks.completed}/{tasks.total}
                          </span>
                        </div>
                        <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                          {completionPercentage}%
                        </Badge>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => onDepartmentSelect && onDepartmentSelect(department)}>
                              View Department
                            </DropdownMenuItem>
                            <DropdownMenuItem>Edit Department</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteDepartment(departmentId);
                              }}
                              disabled={isDeleting}
                            >
                              Delete Department
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}