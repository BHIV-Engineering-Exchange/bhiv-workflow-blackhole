"use client"

import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import { Loader2 } from "lucide-react"
import { api } from "../../lib/api"
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

export function DependencySwimlane() {
  const svgRef = useRef(null)
  const containerRef = useRef(null)
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tasks, setTasks] = useState([])
  const [departments, setDepartments] = useState([])
  const isMobile = useIsMobile()

  // Fetch tasks and departments
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const [tasksData, departmentsResponse] = await Promise.all([
          api.tasks.getTasks({ page: 1, limit: 100 }),
          api.departments.getDepartments(),
        ])

        const departmentsData = departmentsResponse.success ? departmentsResponse.data : departmentsResponse

        setTasks(Array.isArray(tasksData) ? tasksData : (tasksData.tasks ?? []))
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

  // Responsive sizing for the SVG
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current && svgRef.current) {
        const containerWidth = containerRef.current.clientWidth
        const containerHeight = Math.max(600, window.innerHeight * 0.7)

        d3.select(svgRef.current).attr("width", containerWidth).attr("height", containerHeight)

        renderSwimlane()
      }
    }

    window.addEventListener("resize", updateSize)
    updateSize()

    return () => window.removeEventListener("resize", updateSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, svgRef, tasks, departments])

  // Render Swimlane Diagram
  const renderSwimlane = () => {
    if (!svgRef.current || !tasks.length || !departments.length) return

    d3.select(svgRef.current).selectAll("*").remove()

    const svg = d3.select(svgRef.current)
    const width = +svg.attr("width")
    const height = +svg.attr("height")
    const margin = isMobile
      ? { top: 60, right: 20, bottom: 20, left: 100 }
      : { top: 80, right: 40, bottom: 40, left: 150 }

    svg.style("background", "#f9fafb")

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`)

    // Group tasks by department
    const tasksByDept = new Map()
    departments.forEach((dept) => {
      tasksByDept.set(dept.name, [])
    })

    tasks.forEach((task) => {
      const deptName = task.department?.name || "Unknown"
      if (!tasksByDept.has(deptName)) {
        tasksByDept.set(deptName, [])
      }
      tasksByDept.get(deptName).push(task)
    })

    const deptNames = Array.from(tasksByDept.keys())
    const laneHeight = Math.max((height - margin.top - margin.bottom) / deptNames.length, 100)
    const boundedWidth = width - margin.left - margin.right
    const cardWidth = isMobile ? 100 : 140
    const cardHeight = isMobile ? 50 : 70
    const cardSpacing = isMobile ? 20 : 30

    // Create tooltip
    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "swimlane-tooltip")
      .style("position", "absolute")
      .style("background", "#fff")
      .style("padding", "10px 14px")
      .style("border", "1px solid #cbd5e1")
      .style("border-radius", "8px")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("z-index", 1000)
      .style("box-shadow", "0 4px 12px rgba(0,0,0,0.15)")

    // Draw department lanes
    deptNames.forEach((deptName, index) => {
      const laneY = index * laneHeight

      // Lane background
      g.append("rect")
        .attr("x", 0)
        .attr("y", laneY)
        .attr("width", boundedWidth)
        .attr("height", laneHeight)
        .attr("fill", index % 2 === 0 ? "#ffffff" : "#f8fafc")
        .attr("stroke", "#e2e8f0")
        .attr("stroke-width", 1)

      // Department label
      g.append("text")
        .attr("x", -10)
        .attr("y", laneY + laneHeight / 2)
        .attr("text-anchor", "end")
        .attr("alignment-baseline", "middle")
        .text(deptName)
        .style("font-size", isMobile ? "11px" : "14px")
        .style("font-weight", "600")
        .style("fill", "#475569")
    })

    // Position tasks in lanes
    const taskPositions = new Map()
    const tasksData = []

    deptNames.forEach((deptName, deptIndex) => {
      const depTasks = tasksByDept.get(deptName)
      const laneY = deptIndex * laneHeight

      depTasks.forEach((task, taskIndex) => {
        const x = taskIndex * (cardWidth + cardSpacing) + 40
        const y = laneY + laneHeight / 2 - cardHeight / 2

        taskPositions.set(task._id, { x: x + cardWidth / 2, y: y + cardHeight / 2 })

        tasksData.push({
          task,
          x,
          y,
          deptName,
        })
      })
    })

    // Draw dependency arrows FIRST (behind cards)
    const arrows = []
    tasks.forEach((task) => {
      if (task.dependencies && task.dependencies.length > 0) {
        task.dependencies.forEach((dep) => {
          const sourcePos = taskPositions.get(dep._id)
          const targetPos = taskPositions.get(task._id)

          if (sourcePos && targetPos) {
            arrows.push({ source: sourcePos, target: targetPos })
          }
        })
      }
    })

    // Arrow marker definition
    svg
      .append("defs")
      .append("marker")
      .attr("id", "arrow-swimlane")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 8)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#94a3b8")

    // Draw arrows
    g.append("g")
      .selectAll("path")
      .data(arrows)
      .enter()
      .append("path")
      .attr("d", (d) => {
        const dx = d.target.x - d.source.x
        const dy = d.target.y - d.source.y
        const dr = Math.sqrt(dx * dx + dy * dy)
        return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`
      })
      .attr("fill", "none")
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrow-swimlane)")
      .attr("opacity", 0.6)

    // Draw task cards
    const cards = g
      .append("g")
      .selectAll("g")
      .data(tasksData)
      .enter()
      .append("g")
      .attr("class", "task-card")
      .attr("transform", (d) => `translate(${d.x},${d.y})`)
      .style("cursor", "pointer")

    // Card rectangle with shadow
    cards
      .append("rect")
      .attr("width", cardWidth)
      .attr("height", cardHeight)
      .attr("rx", 8)
      .attr("ry", 8)
      .attr("fill", (d) => getStatusColor(d.task.status))
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .attr("filter", "drop-shadow(0 2px 4px rgba(0,0,0,0.1))")
      .on("mouseover", function (event, d) {
        d3.select(this).attr("stroke-width", 3).attr("filter", "drop-shadow(0 4px 8px rgba(0,0,0,0.2))")

        const deps = d.task.dependencies?.map((dep) => dep.title).join(", ") || "None"

        tooltip
          .style("opacity", 1)
          .html(
            `<div style="font-size: 13px;">
              <strong style="color: #1e293b;">${d.task.title}</strong><br/>
              <span style="color: #64748b;">Department: ${d.deptName}</span><br/>
              <span style="color: ${getStatusColor(d.task.status)};">Status: ${d.task.status}</span><br/>
              <span style="color: #64748b; font-size: 11px;">Dependencies: ${deps}</span>
            </div>`,
          )
          .style("left", `${event.pageX + 15}px`)
          .style("top", `${event.pageY - 15}px`)
      })
      .on("mouseout", function () {
        d3.select(this).attr("stroke-width", 2).attr("filter", "drop-shadow(0 2px 4px rgba(0,0,0,0.1))")
        tooltip.style("opacity", 0)
      })

    // Task title (truncated)
    cards
      .append("text")
      .attr("x", cardWidth / 2)
      .attr("y", cardHeight / 2 - 8)
      .attr("text-anchor", "middle")
      .attr("alignment-baseline", "middle")
      .text((d) => {
        const maxLen = isMobile ? 12 : 16
        return d.task.title.length > maxLen ? d.task.title.substring(0, maxLen) + "..." : d.task.title
      })
      .style("font-size", isMobile ? "9px" : "11px")
      .style("font-weight", "600")
      .style("fill", "#fff")
      .style("pointer-events", "none")

    // Status badge
    cards
      .append("text")
      .attr("x", cardWidth / 2)
      .attr("y", cardHeight / 2 + 10)
      .attr("text-anchor", "middle")
      .attr("alignment-baseline", "middle")
      .text((d) => d.task.status)
      .style("font-size", isMobile ? "7px" : "9px")
      .style("font-weight", "500")
      .style("fill", "#fff")
      .style("opacity", 0.9)
      .style("pointer-events", "none")

    // Add zoom and pan
    const zoom = d3
      .zoom()
      .scaleExtent([0.5, 2])
      .on("zoom", (event) => {
        g.attr("transform", `translate(${margin.left + event.transform.x},${margin.top + event.transform.y}) scale(${event.transform.k})`)
      })

    svg.call(zoom)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Swimlane Container */}
      <div ref={containerRef} className="w-full overflow-hidden rounded-lg border bg-white">
        <svg ref={svgRef} className="w-full"></svg>
      </div>

      {/* Instructions */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>💡 Hover over task cards to see full details</p>
        <p>🔗 Curved arrows show task dependencies between departments</p>
        <p>🖱️ Scroll to zoom • Drag to pan</p>
      </div>
    </div>
  )
}
