"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Badge } from "../components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { Loader2, Link as LinkIcon, RefreshCw, FileText, Calendar } from "lucide-react"
import { api } from "../lib/api"
import { useToast } from "../hooks/use-toast"
import { formatDate, formatDateTime } from "../lib/dateFormat"

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

function TestedTasks() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [submissions, setSubmissions] = useState([])
  const [evaluations, setEvaluations] = useState([])
  const [search, setSearch] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [verdictFilter, setVerdictFilter] = useState("all")

  const fetchData = async () => {
    try {
      setIsLoading(true)
      const [subs, evals] = await Promise.all([
        api.get("/submissions"),
        api.tester.getEvaluations(),
      ])
      setSubmissions(subs || [])
      setEvaluations(evals || [])
    } catch (error) {
      console.error("Error loading tested tasks:", error)
      toast({
        title: "Error",
        description: "Failed to load test submissions and evaluations",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const latestEvalByTask = useMemo(() => {
    const map = new Map()
    for (const e of evaluations) {
      if (!e?.task?._id && !e?.task) continue
      const taskId = e.task?._id || e.task
      const prev = map.get(taskId)
      if (!prev || new Date(e.createdAt) > new Date(prev.createdAt)) {
        map.set(taskId, e)
      }
    }
    return map
  }, [evaluations])

  const rows = useMemo(() => {
    const filtered = submissions
      .map((s) => {
        const taskId = s.task?._id || s.task
        const evaluation = latestEvalByTask.get(taskId)
        return { submission: s, evaluation }
      })
      .filter(({ submission, evaluation }) => {
        const q = search.trim().toLowerCase()
        const taskTitle = submission.task?.title?.toLowerCase() || ""
        const userName = submission.user?.name?.toLowerCase() || ""
        const repoLink = (submission.githubLink || "").toLowerCase()
        const textMatch = !q || taskTitle.includes(q) || userName.includes(q) || repoLink.includes(q)

        const created = new Date(submission.createdAt)
        const fromOk = !fromDate || created >= new Date(`${fromDate}T00:00:00`)
        const toOk = !toDate || created <= new Date(`${toDate}T23:59:59`)

        const verdict = evaluation?.finalVerdict || "NOT_EVALUATED"
        const verdictOk = verdictFilter === "all" || verdict === verdictFilter

        return textMatch && fromOk && toOk && verdictOk
      })
      .sort((a, b) => new Date(b.submission.createdAt) - new Date(a.submission.createdAt))

    return filtered
  }, [submissions, latestEvalByTask, search, fromDate, toDate, verdictFilter])

  const evaluatedRows = rows.filter((r) => r.evaluation)
  const pendingRows = rows.filter((r) => !r.evaluation)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Loading tested tasks...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Test Tasks</h1>
          <p className="text-muted-foreground">
            Date-wise user submissions with repository links and evaluation status
          </p>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-500" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input
            placeholder="Search task/user/repo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          <Select value={verdictFilter} onValueChange={setVerdictFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Evaluation verdict" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Verdicts</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="APPROVED WITH MINOR FIXES">Approved With Minor Fixes</SelectItem>
              <SelectItem value="REVISION REQUIRED">Revision Required</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="NOT_EVALUATED">Not Evaluated</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="h-auto p-0 bg-transparent flex gap-1 mb-4">
          <TabsTrigger value="all">All ({rows.length})</TabsTrigger>
          <TabsTrigger value="evaluated">Evaluated ({evaluatedRows.length})</TabsTrigger>
          <TabsTrigger value="pending">Pending Evaluation ({pendingRows.length})</TabsTrigger>
        </TabsList>

        {[
          { key: "all", data: rows },
          { key: "evaluated", data: evaluatedRows },
          { key: "pending", data: pendingRows },
        ].map((tab) => (
          <TabsContent key={tab.key} value={tab.key}>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Submitted Date</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead>Submitted By</TableHead>
                      <TableHead>Repo</TableHead>
                      <TableHead>Document</TableHead>
                      <TableHead>Evaluation</TableHead>
                      <TableHead>Evaluated Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tab.data.map(({ submission, evaluation }) => (
                      <TableRow key={submission._id}>
                        <TableCell>{formatDate(submission.createdAt)}</TableCell>
                        <TableCell className="font-medium">{submission.task?.title || "—"}</TableCell>
                        <TableCell>{submission.user?.name || "—"}</TableCell>
                        <TableCell>
                          {submission.githubLink ? (
                            <a
                              href={submission.githubLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                            >
                              <LinkIcon className="h-3 w-3" />
                              Repo
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {submission.documentLink ? (
                            <a
                              href={submission.documentLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                            >
                              <FileText className="h-3 w-3" />
                              File
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {evaluation ? (
                            <Badge className={getVerdictBadgeColor(evaluation.finalVerdict)}>
                              {evaluation.finalVerdict}
                            </Badge>
                          ) : (
                            <Badge variant="outline">Not Evaluated</Badge>
                          )}
                        </TableCell>
                        <TableCell>{evaluation ? formatDate(evaluation.createdAt) : "—"}</TableCell>
                      </TableRow>
                    ))}
                    {tab.data.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                          No submissions found for selected filters
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

export default TestedTasks

