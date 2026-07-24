"use client"

import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import { Loader2 } from "lucide-react"
import { api } from "../../lib/api"
import { useToast } from "../../hooks/use-toast"
import { useIsMobile } from "../../hooks/use-mobile"

// Utility function to map Tailwind colors to hex
const getHexColor = (tailwindColor) => {
  const colorMap = {
    "bg-blue-500": "#3b82f6",
    "bg-green-500": "#22c55e",
    "bg-amber-500": "#f59e0b",
    "bg-red-500": "#ef4444",
    "bg-gray-500": "#64748b",
  }
  return colorMap[tailwindColor] || "#64748b"
}

export function DependencyGraph() {
  const svgRef = useRef(null)
  const containerRef = useRef(null)
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tasks, setTasks] = useState([])
  const [departments, setDepartments] = useState([])
  const [selectedDepartment, setSelectedDepartment] = useState("All")
  // Only graph view is supported now
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

  // Filter tasks by selected department
  const filteredTasks =
    selectedDepartment === "All" ? tasks : tasks.filter((task) => task.department?.name === selectedDepartment)

  // Responsive sizing for the SVG
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current && svgRef.current) {
        const containerWidth = containerRef.current.clientWidth
        const containerHeight = Math.max(400, window.innerHeight * 0.6)

        d3.select(svgRef.current).attr("width", containerWidth).attr("height", containerHeight)

        // Always render the graph view
        renderDependencyGraph()
      }
    }

    window.addEventListener("resize", updateSize)
    updateSize()

    return () => window.removeEventListener("resize", updateSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, svgRef, filteredTasks, departments])

  // Render Dependency Graph
  const renderDependencyGraph = () => {
    if (!svgRef.current || !filteredTasks.length || !departments.length) return

    const nodes = filteredTasks.map((task) => ({
      id: task._id,
      title: task.title,
      department: task.department?.name || "Unknown",
      status: task.status,
    }))

    const links = []
    filteredTasks.forEach((task) => {
      if (task.dependencies && task.dependencies.length > 0) {
        task.dependencies.forEach((dep) => {
          const depId = dep._id
          if (nodes.find((node) => node.id === depId)) {
            links.push({
              source: depId,
              target: task._id,
            })
          }
        })
      }
    })

    d3.select(svgRef.current).selectAll("*").remove()

    const svg = d3.select(svgRef.current)
    const width = +svg.attr("width")
    const height = +svg.attr("height")
    const margin = isMobile
      ? { top: 10, right: 10, bottom: 10, left: 10 }
      : { top: 20, right: 20, bottom: 20, left: 20 }
    const boundedWidth = width - margin.left - margin.right
    const boundedHeight = height - margin.top - margin.bottom

    svg.style("background", "#f9fafb")

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`)

    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("background", "#fff")
      .style("padding", "8px")
      .style("border", "1px solid #ccc")
      .style("border-radius", "4px")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("z-index", 1000)

    svg
      .append("defs")
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 25)
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#888")

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d) => d.id)
          .distance(isMobile ? 60 : 100),
      )
      .force("charge", d3.forceManyBody().strength(isMobile ? -100 : -200))
      .force("center", d3.forceCenter(boundedWidth / 2, boundedHeight / 2))
      .force("collide", d3.forceCollide(isMobile ? 30 : 40))
      .force("x", d3.forceX().strength(0.1))
      .force("y", d3.forceY().strength(0.1))

    const link = g
      .append("g")
      .attr("stroke", "#888")
      .attr("stroke-width", 2)
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("marker-end", "url(#arrowhead)")

    const node = g
      .append("g")
      .selectAll(".node")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .call(d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended))
      .on("mouseover", (event, d) => {
        const deps = filteredTasks.find((t) => t._id === d.id)?.dependencies?.map((dep) => dep._id) || []
        tooltip
          .style("opacity", 1)
          .html(
            `<strong>${d.title}</strong><br>Department: ${d.department}<br>Status: ${d.status}${deps.length ? `<br>Depends on: ${deps.join(", ")}` : ""}`,
          )
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY - 10}px`)
      })
      .on("mouseout", () => {
        tooltip.style("opacity", 0)
      })

    node
      .append("circle")
      .attr("r", isMobile ? 15 : 20)
      .attr("fill", (d) => {
        const dept = departments.find((dep) => dep.name === d.department)
        return dept ? getHexColor(dept.color) : "#64748b"
      })
      .attr("stroke", (d) => {
        switch (d.status) {
          case "Completed":
            return "#22c55e"
          case "In Progress":
            return "#3b82f6"
          case "Pending":
            return "#f59e0b"
          default:
            return "#000"
        }
      })
      .attr("stroke-width", 2)

    // Always add text labels but adjust size for mobile
    node
      .append("text")
      .attr("text-anchor", "middle")
      .attr("y", isMobile ? 25 : 30)
      .attr("font-size", isMobile ? "8px" : "10px")
      .each(function (d) {
        const words = d.title.split(/\s+/).reverse()
        let word
        let line = []
        let lineNumber = 0
        const lineHeight = 1.1
        const dy = -0.5
        let tspan = d3.select(this).append("tspan").attr("x", 0).attr("dy", `${dy}em`)

        // Adjust max length based on screen size
        const maxLength = isMobile ? 40 : 60
        const maxLines = isMobile ? 2 : 3

        while ((word = words.pop())) {
          line.push(word)
          tspan.text(line.join(" "))
          if (tspan.node().getComputedTextLength() > maxLength) {
            line.pop()
            tspan.text(line.join(" "))
            line = [word]

            // Limit number of lines based on screen size
            if (lineNumber >= maxLines - 1) {
              tspan.text(tspan.text() + "...")
              break
            }

            tspan = d3.select(this).append("tspan").attr("x", 0).attr("dy", `${lineHeight}em`).text(word)
            lineNumber++
          }
        }
      })

    // Always show legend but adjust size for mobile
    const legendX = isMobile ? width - 80 : width - 120
    const legendY = isMobile ? margin.top : margin.top
    const legend = svg.append("g").attr("transform", `translate(${legendX}, ${legendY})`)

    legend
      .append("text")
      .attr("x", 0)
      .attr("y", 0)
      .attr("font-size", isMobile ? "8px" : "10px")
      .attr("font-weight", "bold")
      .text("Departments")

    departments.forEach((dept, i) => {
      const g = legend.append("g").attr("transform", `translate(0, ${(isMobile ? 12 : 15) + i * (isMobile ? 12 : 15)})`)
      g.append("circle")
        .attr("r", isMobile ? 3 : 4)
        .attr("fill", getHexColor(dept.color))
      g.append("text")
        .attr("x", 8)
        .attr("y", 3)
        .attr("font-size", isMobile ? "6px" : "8px")
        .text(dept.name)
    })

    const statuses = [
      { name: "Completed", color: "#22c55e" },
      { name: "In Progress", color: "#3b82f6" },
      { name: "Pending", color: "#f59e0b" },
    ]

    legend
      .append("text")
      .attr("x", 0)
      .attr("y", (isMobile ? 12 : 15) + departments.length * (isMobile ? 12 : 15) + (isMobile ? 8 : 10))
      .attr("font-size", isMobile ? "8px" : "10px")
      .attr("font-weight", "bold")
      .text("Status")

    statuses.forEach((status, i) => {
      const g = legend
        .append("g")
        .attr(
          "transform",
          `translate(0, ${(isMobile ? 12 : 15) + departments.length * (isMobile ? 12 : 15) + (isMobile ? 20 : 25) + i * (isMobile ? 12 : 15)})`,
        )
      g.append("circle")
        .attr("r", isMobile ? 3 : 4)
        .attr("fill", "none")
        .attr("stroke", status.color)
        .attr("stroke-width", 2)
      g.append("text")
        .attr("x", 8)
        .attr("y", 3)
        .attr("font-size", isMobile ? "6px" : "8px")
        .text(status.name)
    })

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => Math.max(0, Math.min(boundedWidth, d.source.x)))
        .attr("y1", (d) => Math.max(0, Math.min(boundedHeight, d.source.y)))
        .attr("x2", (d) => Math.max(0, Math.min(boundedWidth, d.target.x)))
        .attr("y2", (d) => Math.max(0, Math.min(boundedHeight, d.target.y)))

      node.attr("transform", (d) => {
        const radius = isMobile ? 15 : 20
        d.x = Math.max(radius, Math.min(boundedWidth - radius, d.x))
        d.y = Math.max(radius, Math.min(boundedHeight - radius, d.y))
        return `translate(${d.x},${d.y})`
      })
    })

    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart()
      d.fx = d.x
      d.fy = d.y
    }

    function dragged(event, d) {
      d.fx = event.x
      d.fy = event.y
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0)
      d.fx = null
      d.fy = null
    }

    return { simulation, tooltip }
  }

  // Gantt view removed

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Loading dependency graph...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="text-center text-red-500">
          <p>Error loading dependency graph: {error}</p>
          <button className="mt-4 px-4 py-2 bg-primary text-white rounded-md" onClick={() => window.location.reload()}>
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-full sm:w-auto">
            <label htmlFor="department" className="block text-sm font-semibold mb-2 text-foreground">
              Department:
            </label>
            <select
              id="department"
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              style={{
                backgroundColor: typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? '#18181b' : '#fff',
                color: typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? '#fff' : 'inherit',
                borderRadius: '0.75rem',
                border: '1.5px solid #e5e7eb',
                padding: '0.625rem 1rem',
                fontSize: '0.95rem',
                fontWeight: 500,
                minWidth: '180px',
                outline: 'none',
                marginTop: '0.25rem',
              }}
            >
              <option value="All">All Departments</option>
              {departments.map((dept) => (
                <option key={dept._id} value={dept.name}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div ref={containerRef} className="w-full">
          <svg ref={svgRef} className="w-full h-[400px] md:h-[600px] border-2 border-muted rounded-xl shadow-inner bg-gradient-to-br from-background to-muted/20" />
        </div>
      </div>
    </div>
  )
}
