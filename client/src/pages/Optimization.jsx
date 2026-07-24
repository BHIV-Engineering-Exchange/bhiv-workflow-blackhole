import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { OptimizationActions } from "../components/optimization/optimization-actions";
import { InsightCard } from "../components/optimization/insight-card";
import { api } from "../lib/api";
import { useToast } from "../hooks/use-toast";
import { Sparkles, TrendingUp, Zap, Filter, LayoutGrid, AlertCircle } from "lucide-react";

export default function Optimization() {
  const [tasks, setTasks] = useState([]);
  const [insights, setInsights] = useState([]);
  const [activeTab, setActiveTab] = useState("all");
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tasksData, insightsData] = await Promise.all([
          api.tasks.getTasks({ page: 1, limit: 100 }),
          api.ai.getInsights(),
        ]);
        setTasks(Array.isArray(tasksData) ? tasksData : (tasksData.tasks ?? []));
        setInsights(insightsData);
      } catch (error) {
        console.error("Failed to fetch optimization data:", error);
      }
    };

    fetchData();
  }, []);

  // Calculate stats for header
  const highImpactCount = insights.filter((i) => i.impact === "High").length;

  // Categorize insights
  const categorizedInsights = {
    all: insights,
    resources: insights.filter((i) => i.category === "Resources"),
    dependencies: insights.filter((i) => i.category === "Dependencies"),
    deadlines: insights.filter((i) => i.category === "Deadlines"),
    workflow: insights.filter((i) => i.category === "Workflow"),
  };

  const handleApplyAction = async (action, insight) => {
    try {
      console.log("🔵 Button clicked:", { action, insight });
      
      // Extract task title from description - try multiple patterns
      let taskTitle = insight.description?.match(/Task '([^']+)'/)?.[1] ||
                      insight.description?.match(/task "([^"]+)"/)?.[1] ||
                      insight.description?.match(/task ([A-Za-z0-9\s]+)/i)?.[1] ||
                      insight.title?.match(/Task '([^']+)'/)?.[1];
      
      console.log("🔍 Extracted task title:", taskTitle);
      console.log("📋 Available tasks:", tasks.map(t => ({ id: t._id, title: t.title })));
      
      let task = null;
      
      // Try to find task by ID first (if insight has taskId)
      if (insight.taskId) {
        task = tasks.find((t) => t._id === insight.taskId || t._id.toString() === insight.taskId.toString());
        console.log("🔎 Found task by ID:", task ? task.title : "Not found");
      }

      // If not found by ID, try by title
      if (!task && taskTitle) {
        task = tasks.find((t) => 
          t.title === taskTitle || 
          t.title?.toLowerCase() === taskTitle?.toLowerCase() ||
          t._id === taskTitle ||
          t._id.toString() === taskTitle
        );
        console.log("🔎 Found task by title:", task ? task.title : "Not found");
      }
      
      // If still not found, try to fetch fresh tasks
      if (!task) {
        console.log("🔄 Task not found in local state, fetching fresh tasks...");
        const freshTasks = await api.tasks.getTasks({ page: 1, limit: 100 });
        task = (Array.isArray(freshTasks) ? freshTasks : (freshTasks.tasks ?? [])).find((t) => 
          (taskTitle && (t.title === taskTitle || t.title?.toLowerCase() === taskTitle?.toLowerCase())) ||
          (insight.taskId && (t._id === insight.taskId || t._id.toString() === insight.taskId.toString()))
        );
        if (task) {
          console.log("✅ Found task in fresh fetch:", task.title);
      }
      }
      
      if (!task) {
        throw new Error(`Task not found. Searched for: "${taskTitle || insight.taskId || 'unknown'}"`);
      }

      console.log("✅ Applying action to task:", task.title);
      await applyActionToTask(action, task);
    } catch (err) {
      console.error("❌ Error applying action:", err);
      toast({
        title: "Error",
        description: err.message || `Failed to apply action "${action}"`,
        variant: "destructive",
      });
    }
  };

  const applyActionToTask = async (action, task) => {
    console.log("⚙️ Applying action to task:", { action, taskId: task._id, taskTitle: task.title });
    
    let updates = {};
    const actionLower = action.toLowerCase();
    
    // Handle "Reschedule due date" action
    if (actionLower.includes("reschedule") || (actionLower.includes("due") && actionLower.includes("date"))) {
      if (!task.dueDate) {
        // If no due date, set one 7 days from now
        const newDueDate = new Date();
        newDueDate.setDate(newDueDate.getDate() + 7);
        updates.dueDate = newDueDate.toISOString();
        console.log("📅 Setting new due date (7 days from now):", updates.dueDate);
      } else {
        const newDueDate = new Date(task.dueDate);
        newDueDate.setDate(newDueDate.getDate() + 7); // Extend by 7 days
        updates.dueDate = newDueDate.toISOString();
        console.log("📅 Rescheduling due date (+7 days):", updates.dueDate);
      }
    }
    // Handle "Prioritize task completion" or "Prioritize" action
    else if (actionLower.includes("prioritize") || actionLower.includes("priority")) {
      updates.priority = "High";
      console.log("⭐ Setting priority to High");
    }
    // Handle "Investigate reason for delay" action
    else if (actionLower.includes("investigate") || actionLower.includes("delay")) {
      // Add a note or comment about investigation
      updates.status = task.status || "In Progress";
      const investigationNote = `[AI Action] Investigation requested: ${new Date().toLocaleString()}`;
      updates.notes = task.notes 
        ? `${task.notes}\n\n${investigationNote}`
        : investigationNote;
      console.log("🔍 Adding investigation note");
    }
    // Legacy handlers for backward compatibility
    else if (actionLower.includes("reassign")) {
      updates.assignee = null;
      console.log("👤 Reassigning task");
    } else if (actionLower.includes("adjust deadlines") || actionLower.includes("extend deadlines")) {
      if (task.dueDate) {
        const newDueDate = new Date(task.dueDate);
        newDueDate.setDate(newDueDate.getDate() + 7);
        updates.dueDate = newDueDate.toISOString();
        console.log("📅 Extending deadline");
      }
    } else {
      throw new Error(`Unknown action: "${action}"`);
    }

    if (Object.keys(updates).length === 0) {
      throw new Error("No updates to apply");
    }

    console.log("📤 Sending update request:", { taskId: task._id, taskIdType: typeof task._id, updates });
    
    // Ensure task ID is a string
    const taskId = task._id?.toString() || task._id;
    
    if (!taskId) {
      throw new Error("Task ID is missing");
    }
    
    // Update the task
    const updatedTask = await api.tasks.updateTask(taskId, updates);
    console.log("✅ Task updated successfully:", updatedTask);
    
    // Refresh tasks list
    const updatedTasks = await api.tasks.getTasks({ page: 1, limit: 100 });
    setTasks(Array.isArray(updatedTasks) ? updatedTasks : (updatedTasks.tasks ?? []));

    toast({
      title: "Success",
      description: `Action "${action}" applied to task "${task.title || task._id}"`,
    });
  };

  const renderInsightsList = (insightsList) => {
    if (!insightsList || insightsList.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-semibold text-lg mb-2">No Insights Available</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            {activeTab === "all" 
              ? "Generate AI insights by clicking 'Refresh Analysis' in the Actions panel."
              : "No insights found in this category."}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {insightsList.map((insight, index) => (
          <InsightCard
            key={insight.id || index}
            insight={insight}
            onApplyAction={handleApplyAction}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header Section - Separated */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AI Optimization</h1>
            <p className="text-muted-foreground">
              AI-driven insights and recommendations to optimize your workflow
            </p>
          </div>
        </div>

        {/* Stats Overview - Separated */}
        {insights.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2">
                
                <div>
                  <p className="text-sm text-muted-foreground">Total Insights</p>
                  <p className="text-2xl font-bold">{insights.length}</p>
                </div>
              </div>
            </div>
            
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2">
              
                <div>
                  <p className="text-sm text-muted-foreground">High Impact</p>
                  <p className="text-2xl font-bold">{highImpactCount}</p>
                </div>
              </div>
            </div>
            
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2">
              
                <div>
                  <p className="text-sm text-muted-foreground">Optimization Score</p>
                  <p className="text-2xl font-bold">
                    {Math.round(((insights.length - highImpactCount) / Math.max(insights.length, 1)) * 100)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs Navigation - Separated as individual buttons */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-wrap gap-3 mb-6">
          <TabsList className="h-auto p-0 bg-transparent">
            <TabsTrigger 
              value="all"
              className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl border-2 border-muted data-[state=active]:bg-green-500 data-[state=active]:border-green-500 data-[state=active]:text-white transition-all duration-200 hover:border-green-500/50"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="font-semibold">All Insights</span>
              <span className="ml-1 text-xs opacity-70">({insights.length})</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsList className="h-auto p-0 bg-transparent">
            <TabsTrigger 
              value="resources"
              className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl border-2 border-muted data-[state=active]:bg-green-500 data-[state=active]:border-green-500 data-[state=active]:text-white transition-all duration-200 hover:border-green-500/50"
            >
              <Filter className="h-4 w-4" />
              <span className="font-semibold">Resources</span>
              <span className="ml-1 text-xs opacity-70">({categorizedInsights.resources.length})</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsList className="h-auto p-0 bg-transparent">
            <TabsTrigger 
              value="dependencies"
              className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl border-2 border-muted data-[state=active]:bg-green-500 data-[state=active]:border-green-500 data-[state=active]:text-white transition-all duration-200 hover:border-green-500/50"
            >
              <Filter className="h-4 w-4" />
              <span className="font-semibold">Dependencies</span>
              <span className="ml-1 text-xs opacity-70">({categorizedInsights.dependencies.length})</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsList className="h-auto p-0 bg-transparent">
            <TabsTrigger 
              value="deadlines"
              className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl border-2 border-muted data-[state=active]:bg-green-500 data-[state=active]:border-green-500 data-[state=active]:text-white transition-all duration-200 hover:border-green-500/50"
            >
              <Filter className="h-4 w-4" />
              <span className="font-semibold">Deadlines</span>
              <span className="ml-1 text-xs opacity-70">({categorizedInsights.deadlines.length})</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsList className="h-auto p-0 bg-transparent">
            <TabsTrigger 
              value="workflow"
              className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl border-2 border-muted data-[state=active]:bg-green-500 data-[state=active]:border-green-500 data-[state=active]:text-white transition-all duration-200 hover:border-green-500/50"
            >
              <Filter className="h-4 w-4" />
              <span className="font-semibold">Workflow</span>
              <span className="ml-1 text-xs opacity-70">({categorizedInsights.workflow.length})</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Content Area - Separated with proper layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Insights Content Area */}
          <div className="lg:col-span-2">
            <TabsContent value="all" className="m-0">
              {renderInsightsList(categorizedInsights.all)}
            </TabsContent>
            
            <TabsContent value="resources" className="m-0">
              {renderInsightsList(categorizedInsights.resources)}
            </TabsContent>
            
            <TabsContent value="dependencies" className="m-0">
              {renderInsightsList(categorizedInsights.dependencies)}
            </TabsContent>
            
            <TabsContent value="deadlines" className="m-0">
              {renderInsightsList(categorizedInsights.deadlines)}
            </TabsContent>
            
            <TabsContent value="workflow" className="m-0">
              {renderInsightsList(categorizedInsights.workflow)}
            </TabsContent>
          </div>
          
          {/* Actions Sidebar - Sticky */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-6">
              <OptimizationActions 
                tasks={tasks} 
                setTasks={setTasks} 
                insights={insights} 
              />
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
