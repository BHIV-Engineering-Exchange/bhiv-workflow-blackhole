"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { Sparkles, Loader2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { api } from "../../lib/api"

export function AIInsights() {
  const navigate = useNavigate()
  const [insights, setInsights] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchInsights = async () => {
    try {
      setIsLoading(true)
      const data = await api.ai.getInsights()
      setInsights(data.insights || [])
    } catch (error) {
      console.error("Error fetching AI insights:", error)
      setInsights([
        "Marketing team has 3 tasks at risk of delay",
        "Sales team is overloaded with high-priority tasks",
        "Task dependencies in Operations need review",
        "Resource reallocation recommended for Project X",
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="col-span-1">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Insights
          </CardTitle>
          <CardDescription>AI-powered workflow optimization</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {insights.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">Click to generate AI insights</p>
              <Button
                variant="outline"
                onClick={fetchInsights}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {isLoading ? "Generating..." : "Load AI Insights"}
              </Button>
            </div>
          ) : (
            <ul className="space-y-2">
              {insights.map((insight, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <div className="rounded-full bg-primary/10 p-1 mt-0.5">
                    <Sparkles className="h-3 w-3 text-primary" />
                  </div>
                  <span>{insight}</span>
                </li>
              ))}
            </ul>
          )}

          <Button
            className="w-full gradient-primary hover:glow-primary transition-cyber transform hover:scale-105 group hover-cyber"
            onClick={() => navigate("/optimization")}
          >
            <Sparkles className="mr-2 h-4 w-4 transition-cyber group-hover:rotate-12" />
            View All Insights
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
