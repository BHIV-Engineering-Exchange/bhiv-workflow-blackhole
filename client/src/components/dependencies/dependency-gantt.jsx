"use client"

import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import { Loader2 } from "lucide-react"
import { api } from "../../lib/api"
import { formatDate } from "../../lib/dateFormat"
import { useToast } from "../../hooks/use-toast"
import { useIsMobile } from "../../hooks/use-mobile"

// Utility function to map status to color
const getStatusColor = (status) => {
  const colorMap = {
    "Pending": "#f59e0b",
    "In Progress": "#3b82f6",
    "Completed": "#22c55e",
  }
  return colorMap[status] || "#64748b"
}

export function DependencyGantt() {
  const svgRef = useRef(null)
  const containerRef = useRef(null)
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tasks, setTasks] = useState([])
  const [departments, setDepartments] = useState([])
  const [selectedDepartment, setSelectedDepartment] = useState("All")
  const isMobile = useIsMobile()

  // Fetch tasks and departments
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const [tasksData, departmentsResponse] = await Promise.all([
          api.tasks.getTasks(),
          api.departments.getDepartments(),
        ])

        const departmentsData = departmentsResponse.success ? departmentsResponse.data : departmentsResponse

        setTasks(tasksData)
        setDepartments(Array.isArray(departmentsData) ? departmentsData : [])
        setError(null)
      } catch (err) {
        setError(err.message || "Failed to load data")
        toast({
          title: "Error",
          description: err.message || "Failed to load tasks and departments",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [toast])

  // Filter tasks by selected department
  const filteredTasks =
    selectedDepartment === "All" ? tasks : tasks.filter((task) => task.department?.name === selectedDepartment)

  // Responsive sizing for the SVG
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current && svgRef.current) {
        const containerWidth = containerRef.current.clientWidth
        const containerHeight = Math.max(500, filteredTasks.length * 50 + 100)

        d3.select(svgRef.current).attr("width", containerWidth).attr("height", containerHeight)

        renderGanttChart()
      }
    }

    window.addEventListener("resize", updateSize)
    updateSize()

    return () => window.removeEventListener("resize", updateSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, svgRef, filteredTasks, departments])

  // Render Gantt Chart
  const renderGanttChart = () => {
    if (!svgRef.current || !filteredTasks.length) return

    d3.select(svgRef.current).selectAll("*").remove()

    const svg = d3.select(svgRef.current)
    const width = +svg.attr("width")
    const height = +svg.attr("height")
    const margin = isMobile
      ? { top: 60, right: 20, bottom: 40, left: 120 }
      : { top: 80, right: 60, bottom: 60, left: 180 }

    const boundedWidth = width - margin.left - margin.right
    const boundedHeight = height - margin.top - margin.bottom

    svg.style("background", "#f9fafb")

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`)

    // Create tooltip
    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "gantt-tooltip")
      .style("position", "absolute")
      .style("background", "#fff")
      .style("padding", "12px 16px")
      .style("border", "1px solid #cbd5e1")
      .style("border-radius", "8px")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("z-index", 1000)
      .style("box-shadow", "0 4px 12px rgba(0,0,0,0.15)")

    // Parse dates or create default timeline
    const today = new Date()
    const tasksWithDates = filteredTasks.map((task, index) => {
      // If task has createdAt, use it; otherwise create sequential dates
      const startDate = task.createdAt ? new Date(task.createdAt) : new Date(today.getTime() + index * 86400000)
      // Default duration: Pending=7 days, In Progress=5 days, Completed=3 days
      const durationDays = task.status === "Completed" ? 3 : task.status === "In Progress" ? 5 : 7
      const endDate = new Date(startDate.getTime() + durationDays * 86400000)

      return {
        ...task,
        startDate,
        endDate,
        duration: durationDays,
      }
    })

    // Sort tasks by start date
    tasksWithDates.sort((a, b) => a.startDate - b.startDate)

    // Create scales
    const allDates = tasksWithDates.flatMap((t) => [t.startDate, t.endDate])
    const minDate = d3.min(allDates)
    const maxDate = d3.max(allDates)

    const xScale = d3.scaleTime().domain([minDate, maxDate]).range([0, boundedWidth])

    const yScale = d3
      .scaleBand()
      .domain(tasksWithDates.map((t) => t._id))
      .range([0, boundedHeight])
      .padding(0.3)

    // Draw grid lines
    const xAxis = d3.axisBottom(xScale).ticks(isMobile ? 5 : 10).tickFormat(d3.timeFormat("%b %d"))

    g.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${boundedHeight})`)
      .call(xAxis)
      .selectAll("text")
      .style("font-size", isMobile ? "10px" : "12px")
      .style("fill", "#64748b")

    // Draw horizontal grid lines
    tasksWithDates.forEach((task) => {
      g.append("line")
        .attr("x1", 0)
        .attr("x2", boundedWidth)
        .attr("y1", yScale(task._id) + yScale.bandwidth() / 2)
        .attr("y2", yScale(task._id) + yScale.bandwidth() / 2)
        .attr("stroke", "#e2e8f0")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "3,3")
    })

    // Draw vertical grid lines (date markers)
    xAxis.scale().ticks(isMobile ? 5 : 10).forEach((tick) => {
      g.append("line")
        .attr("x1", xScale(tick))
        .attr("x2", xScale(tick))
        .attr("y1", 0)
        .attr("y2", boundedHeight)
        .attr("stroke", "#e2e8f0")
        .attr("stroke-width", 1)
    })

    // Draw today marker
    const todayX = xScale(today)
    if (todayX >= 0 && todayX <= boundedWidth) {
      g.append("line")
        .attr("x1", todayX)
        .attr("x2", todayX)
        .attr("y1", -10)
        .attr("y2", boundedHeight)
        .attr("stroke", "#ef4444")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5,5")

      g.append("text")
        .attr("x", todayX)
        .attr("y", -15)
        .attr("text-anchor", "middle")
        .text("Today")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("fill", "#ef4444")
    }

    // Draw task bars
    const bars = g
      .selectAll(".task-bar")
      .data(tasksWithDates)
      .enter()
      .append("g")
      .attr("class", "task-bar")

    // Task bar background
    bars
      .append("rect")
      .attr("x", (d) => xScale(d.startDate))
      .attr("y", (d) => yScale(d._id))
      .attr("width", (d) => Math.max(xScale(d.endDate) - xScale(d.startDate), 2))
      .attr("height", yScale.bandwidth())
      .attr("fill", (d) => getStatusColor(d.status))
      .attr("rx", 6)
      .attr("opacity", 0.9)
      .style("cursor", "pointer")
      .on("mouseover", function (event, d) {
        d3.select(this).attr("opacity", 1).attr("stroke", "#1e293b").attr("stroke-width", 2)

        const deps = d.dependencies?.map((dep) => dep.title).join(", ") || "None"

        tooltip
          .style("opacity", 1)
          .html(
            `<div style="font-size: 13px;">
              <strong style="color: #1e293b;">${d.title}</strong><br/>
              <span style="color: #64748b;">Department: ${d.department?.name || "Unknown"}</span><br/>
              <span style="color: ${getStatusColor(d.status)};">Status: ${d.status}</span><br/>
              <span style="color: #64748b;">Duration: ${d.duration} days</span><br/>
              <span style="color: #64748b; font-size: 11px;">Start: ${formatDate(d.startDate)}</span><br/>
              <span style="color: #64748b; font-size: 11px;">End: ${formatDate(d.endDate)}</span><br/>
              <span style="color: #64748b; font-size: 11px;">Dependencies: ${deps}</span>
            </div>`,
          )
          .style("left", `${event.pageX + 15}px`)
          .style("top", `${event.pageY - 15}px`)
      })
      .on("mouseout", function () {
        d3.select(this).attr("opacity", 0.9).attr("stroke", "none")
        tooltip.style("opacity", 0)
      })

    // Add progress indicator (for in-progress tasks)
    bars
      .filter((d) => d.status === "In Progress")
      .append("rect")
      .attr("x", (d) => xScale(d.startDate))
      .attr("y", (d) => yScale(d._id))
      .attr("width", (d) => {
        const totalWidth = xScale(d.endDate) - xScale(d.startDate)
        return totalWidth * 0.5 // 50% progress for demo
      })
      .attr("height", yScale.bandwidth())
      .attr("fill", "#1e40af")
      .attr("rx", 6)
      .attr("opacity", 0.7)
      .style("pointer-events", "none")

    // Task labels (left side)
    bars
      .append("text")
      .attr("x", -10)
      .attr("y", (d) => yScale(d._id) + yScale.bandwidth() / 2)
      .attr("text-anchor", "end")
      .attr("alignment-baseline", "middle")
      .text((d) => {
        const maxLen = isMobile ? 15 : 20
        return d.title.length > maxLen ? d.title.substring(0, maxLen) + "..." : d.title
      })
      .style("font-size", isMobile ? "10px" : "12px")
      .style("font-weight", "500")
      .style("fill", "#1e293b")
      .style("cursor", "pointer")

    // Draw dependency arrows
    tasksWithDates.forEach((task) => {
      if (task.dependencies && task.dependencies.length > 0) {
        task.dependencies.forEach((dep) => {
          const sourceTask = tasksWithDates.find((t) => t._id === dep._id)
          if (sourceTask) {
            const x1 = xScale(sourceTask.endDate)
            const y1 = yScale(sourceTask._id) + yScale.bandwidth() / 2
            const x2 = xScale(task.startDate)
            const y2 = yScale(task._id) + yScale.bandwidth() / 2

            // Draw curved arrow
            g.append("path")
              .attr(
                "d",
                `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`,
              )
              .attr("fill", "none")
              .attr("stroke", "#94a3b8")
              .attr("stroke-width", 2)
              .attr("marker-end", "url(#arrow)")
              .attr("opacity", 0.6)
          }
        })
      }
    })

    // Arrow marker
    svg
      .append("defs")
      .append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 8)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#94a3b8")

    // Add legend
    const legend = svg.append("g").attr("transform", `translate(${margin.left},20)`)

    const statuses = ["Pending", "In Progress", "Completed"]
    statuses.forEach((status, i) => {
      const legendItem = legend.append("g").attr("transform", `translate(${i * (isMobile ? 80 : 120)},0)`)

      legendItem
        .append("rect")
        .attr("width", 12)
        .attr("height", 12)
        .attr("fill", getStatusColor(status))
        .attr("rx", 2)

      legendItem
        .append("text")
        .attr("x", 18)
        .attr("y", 10)
        .text(status)
        .style("font-size", isMobile ? "10px" : "12px")
        .style("fill", "#64748b")
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[500px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[500px]">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Department Filter */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium">Filter by Department:</label>
        <select
          value={selectedDepartment}
          onChange={(e) => setSelectedDepartment(e.target.value)}
          className="px-3 py-2 border rounded-md text-sm bg-background"
        >
          <option value="All">All Departments</option>
          {departments.map((dept) => (
            <option key={dept._id} value={dept.name}>
              {dept.name}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">({filteredTasks.length} tasks)</span>
      </div>

      {/* Gantt Chart Container */}
      <div ref={containerRef} className="w-full overflow-x-auto overflow-y-auto rounded-lg border bg-white">
        <svg ref={svgRef} className="w-full"></svg>
      </div>

      {/* Instructions */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>💡 Hover over bars to see task details and timeline</p>
        <p>📅 Red dashed line shows today's date</p>
        <p>🔗 Curved arrows show dependencies between tasks</p>
        <p>📊 Darker fill on In Progress tasks shows completion progress</p>
      </div>
    </div>
  )
}
