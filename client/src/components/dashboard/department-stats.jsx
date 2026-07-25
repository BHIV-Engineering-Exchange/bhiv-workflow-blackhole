"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Loader2 } from "lucide-react"
import { api } from "../../lib/api"
import { useToast } from "../../hooks/use-toast"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

export function DepartmentStats({ onDepartmentSelect }) {
  const { toast } = useToast()
  const [departments, setDepartments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(null)

  // Vibrant color palette
  const COLORS = [
    '#10b981', // Green
    '#8b5cf6', // Purple
    '#f59e0b', // Orange
    '#3b82f6', // Blue
    '#14b8a6', // Teal
    '#eab308', // Yellow
    '#ef4444', // Red
    '#06b6d4', // Cyan
    '#a855f7', // Light purple
    '#f97316', // Deep orange
  ]

  useEffect(() => {
    const fetchDepartmentStats = async () => {
      try {
        setIsLoading(true)
        const data = await api.dashboard.getDepartmentStats()
        setDepartments(data)
      } catch (error) {
        console.error("Error fetching department stats:", error)
        toast({
          title: "Error",
          description: "Failed to load department statistics",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchDepartmentStats()
  }, [toast])

  const handlePieClick = (data, index) => {
    setActiveIndex(index)
    if (onDepartmentSelect && departments[index]) {
      onDepartmentSelect(departments[index])
    }
  }

  // Prepare data for pie chart
  const chartData = departments.map((dept, index) => ({
    name: dept.name,
    value: dept.total || 0,
    completed: dept.completed || 0,
    color: COLORS[index % COLORS.length],
  }))

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const percentage = data.value > 0 ? ((data.completed / data.value) * 100).toFixed(1) : 0
      
      return (
        <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-xl">
          <p className="font-heading font-semibold text-sm mb-1">{data.name}</p>
          <p className="text-xs text-muted-foreground">Total Tasks: {data.value}</p>
          <p className="text-xs text-muted-foreground">Completed: {data.completed}</p>
          <p className="text-xs text-primary font-semibold">Progress: {percentage}%</p>
        </div>
      )
    }
    return null
  }

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.05) return null // Don't show label if too small
    
    const RADIAN = Math.PI / 180
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5
    const x = cx + radius * Math.cos(-midAngle * RADIAN)
    const y = cy + radius * Math.sin(-midAngle * RADIAN)

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        className="text-xs font-bold pointer-events-none"
        style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    )
  }

  if (isLoading) {
    return (
      <Card className="col-span-1 border-l-4 border-l-transparent hover:border-l-primary transition-all duration-300 shadow-xl hover:shadow-glow-primary">
        <CardHeader>
          <CardTitle className="font-heading">Department Progress</CardTitle>
          <CardDescription>Task distribution by department</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-10">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading chart...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (departments.length === 0) {
    return (
      <Card className="col-span-1 border-l-4 border-l-transparent hover:border-l-primary transition-all duration-300 shadow-xl">
        <CardHeader>
          <CardTitle className="font-heading">Department Progress</CardTitle>
          <CardDescription>Task distribution by department</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <p>No department data available</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="col-span-1 border-l-4 border-l-transparent hover:border-l-primary transition-all duration-300 shadow-xl hover:shadow-glow-primary">
      <CardHeader>
        <CardTitle className="font-heading">Department Progress</CardTitle>
        <CardDescription>Click on a section to view department details</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <>
            <div className="w-full h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="45%"
                    labelLine={false}
                    label={renderCustomLabel}
                    outerRadius={90}
                    innerRadius={55}
                    dataKey="value"
                    onClick={handlePieClick}
                    className="cursor-pointer focus:outline-none"
                  >
                    {chartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color}
                        stroke={activeIndex === index ? '#ffffff' : '#e5e7eb'}
                        strokeWidth={activeIndex === index ? 3 : 1}
                        className="transition-all duration-300 hover:opacity-80"
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="bottom" 
                    height={45}
                    iconType="circle"
                    formatter={(value) => {
                      const dept = chartData.find(d => d.name === value)
                      const percentage = dept && dept.value > 0 
                        ? ((dept.completed / dept.value) * 100).toFixed(0) 
                        : 0
                      return `${value} (${percentage}%)`
                    }}
                    wrapperStyle={{
                      fontSize: '10px',
                      paddingTop: '5px',
                      paddingBottom: '5px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="text-center py-10 text-muted-foreground">
            <p>No data to display</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
