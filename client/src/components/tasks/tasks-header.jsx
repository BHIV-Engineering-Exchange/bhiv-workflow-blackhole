"use client"

import { useState } from "react"
import { Button } from "../ui/button"
import { Plus, CheckSquare } from "lucide-react"
import { CreateTaskDialog } from "./create-task-dialog"

export function TasksHeader({ onTaskCreated }) {
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <CheckSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
            <p className="text-muted-foreground">Manage and track tasks across all departments</p>
          </div>
        </div>
        <Button 
          onClick={() => setIsCreateTaskOpen(true)}
          className="bg-green-500 hover:bg-green-600 text-white"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Task
        </Button>
      </div>

      <CreateTaskDialog
        open={isCreateTaskOpen}
        onOpenChange={setIsCreateTaskOpen}
        onTaskCreated={onTaskCreated}
      />
    </div>
  )
}
