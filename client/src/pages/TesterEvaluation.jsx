"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Badge } from "../components/ui/badge"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Textarea } from "../components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { Checkbox } from "../components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "../components/ui/radio-group"
import {
  Loader2, ClipboardCheck, Plus, Trash2, ChevronDown, Eye, Save, RefreshCw, FileText, ListChecks
} from "lucide-react"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "../components/ui/dialog"
import { useAuth } from "../context/auth-context"
import { useToast } from "../hooks/use-toast"
import { api } from "../lib/api"

const INITIAL_FORM = {
  projectName: "",
  moduleName: "",
  task: "",
  submittedBy: "",
  testingLevel: "Task",
  testConductedBy: "",
  submissionVerification: {
    deliverablesDefinedClearly: false,
    allDeliverablesReceived: false,
    repositoryAccessible: false,
    executionInstructionsProvided: false,
    requiredDatasetsIncluded: false,
    notes: "",
  },
  functionalTesting: {
    performsRequiredFunction: "N/A",
    inputHandlingCorrect: "N/A",
    outputMatchesExpected: "N/A",
    result: "N/A",
    notes: "",
  },
  codeQuality: {
    codeClarity: "N/A",
    modularStructure: "N/A",
    architectureAlignment: "N/A",
    notes: "",
  },
  dataHandling: {
    inputValidation: "N/A",
    schemaConsistency: "N/A",
    errorHandling: "N/A",
    result: "N/A",
    notes: "",
  },
  integrationReadiness: {
    canIntegrate: "N/A",
    dependencyConflicts: "N/A",
    apiCompatibility: "N/A",
    notes: "",
  },
  securityCheck: {
    accessControlRespected: "N/A",
    sensitiveDataHandling: "N/A",
    boundaryEnforcement: "N/A",
    result: "N/A",
    notes: "",
  },
  performanceCheck: {
    runtimeStable: "N/A",
    resourceUsageAcceptable: "N/A",
    failureScenariosHandled: "N/A",
    result: "N/A",
    notes: "",
  },
  documentationQuality: {
    readmePresent: "N/A",
    codeCommentsSufficient: "N/A",
    setupInstructions: "N/A",
    result: "N/A",
    notes: "",
  },
  testingEvidence: {
    logsAttached: false,
    screenshotsAttached: false,
    executionOutputs: false,
    errorTraces: false,
    notes: "",
  },
  issuesIdentified: [{ description: "" }],
  finalVerdict: "PENDING",
  requiredActions: "",
}

const SECTION_COLORS = {
  1: "blue", 2: "indigo", 3: "green", 4: "purple", 5: "cyan",
  6: "teal", 7: "red", 8: "orange", 9: "yellow", 10: "pink",
  11: "rose", 12: "emerald", 13: "slate",
}

const getVerdictBadgeColor = (verdict) => {
  switch (verdict) {
    case "APPROVED": return "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
    case "APPROVED WITH MINOR FIXES": return "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
    case "REVISION REQUIRED": return "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300"
    case "REJECTED": return "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
    default: return "bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300"
  }
}

function TesterEvaluation() {
  const { toast } = useToast()
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [tasks, setTasks] = useState([])
  const [usersList, setUsersList] = useState([])
  const [evaluations, setEvaluations] = useState([])
  const [form, setForm] = useState({ ...INITIAL_FORM, testConductedBy: user?.name || "" })
  const [expanded, setExpanded] = useState({ 1: true })
  const [viewEvaluation, setViewEvaluation] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setIsLoading(true)
      const [tasksData, usersData, evalsData] = await Promise.all([
        api.tester.getTasks(),
        api.tester.getUsers(),
        api.tester.getEvaluations(),
      ])
      setTasks(tasksData || [])
      setUsersList(usersData || [])
      setEvaluations(evalsData || [])
    } catch (error) {
      console.error("Error fetching evaluation data:", error)
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const toggleSection = (num) => {
    setExpanded((prev) => ({ ...prev, [num]: !prev[num] }))
  }

  const expandAll = () => {
    const all = {}
    for (let i = 1; i <= 13; i++) all[i] = true
    setExpanded(all)
  }

  const collapseAll = () => setExpanded({})

  const updateForm = (section, field, value) => {
    if (section) {
      setForm((prev) => ({
        ...prev,
        [section]: { ...prev[section], [field]: value },
      }))
    } else {
      setForm((prev) => ({ ...prev, [field]: value }))
    }
  }

  const addIssue = () => {
    setForm((prev) => ({
      ...prev,
      issuesIdentified: [...prev.issuesIdentified, { description: "" }],
    }))
  }

  const removeIssue = (index) => {
    setForm((prev) => ({
      ...prev,
      issuesIdentified: prev.issuesIdentified.filter((_, i) => i !== index),
    }))
  }

  const updateIssue = (index, value) => {
    setForm((prev) => ({
      ...prev,
      issuesIdentified: prev.issuesIdentified.map((issue, i) =>
        i === index ? { description: value } : issue
      ),
    }))
  }

  const resetForm = () => {
    setForm({ ...INITIAL_FORM, testConductedBy: user?.name || "" })
    setExpanded({ 1: true })
  }

  const submitEvaluation = async () => {
    if (!form.projectName || !form.task || !form.testingLevel) {
      toast({
        title: "Validation Error",
        description: "Please fill in Project Name, Task, and Testing Level",
        variant: "destructive",
      })
      return
    }
    try {
      setIsSaving(true)
      await api.tester.createEvaluation(form)
      toast({ title: "Success", description: "Evaluation submitted successfully" })
      resetForm()
      fetchData()
    } catch (error) {
      console.error("Error submitting evaluation:", error)
      toast({ title: "Error", description: "Failed to submit evaluation", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const RadioRow = ({ label, section, field, options = ["Yes", "Partial", "No"] }) => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-muted/50 gap-2">
      <Label className="text-sm font-medium">{label}</Label>
      <RadioGroup
        value={form[section]?.[field] || "N/A"}
        onValueChange={(v) => updateForm(section, field, v)}
        className="flex gap-3"
      >
        {options.map((opt) => (
          <div key={opt} className="flex items-center space-x-1.5">
            <RadioGroupItem value={opt} id={`${section}-${field}-${opt}`} />
            <Label htmlFor={`${section}-${field}-${opt}`} className="text-sm cursor-pointer">{opt}</Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  )

  const ResultRow = ({ section, options }) => (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg bg-muted/30 border">
      <Label className="font-semibold text-sm">Result:</Label>
      <RadioGroup
        value={form[section]?.result || "N/A"}
        onValueChange={(v) => updateForm(section, "result", v)}
        className="flex flex-wrap gap-3"
      >
        {options.map((opt) => {
          const color = opt === "PASS" || opt === "STABLE" || opt === "COMPLETE"
            ? "text-green-600 font-semibold"
            : opt === "FAIL" || opt === "UNSTABLE" || opt === "MISSING" || opt === "RISK DETECTED"
            ? "text-red-600 font-semibold"
            : "text-amber-600 font-semibold"
          return (
            <div key={opt} className="flex items-center space-x-1.5">
              <RadioGroupItem value={opt} id={`${section}-result-${opt}`} />
              <Label htmlFor={`${section}-result-${opt}`} className={`text-sm cursor-pointer ${color}`}>{opt}</Label>
            </div>
          )
        })}
      </RadioGroup>
    </div>
  )

  const CheckboxRow = ({ label, section, field }) => (
    <div className="flex items-center space-x-3 p-2">
      <Checkbox
        id={`${section}-${field}`}
        checked={form[section]?.[field] || false}
        onCheckedChange={(v) => updateForm(section, field, v)}
      />
      <Label htmlFor={`${section}-${field}`} className="text-sm cursor-pointer">{label}</Label>
    </div>
  )

  const SectionCard = ({ num, title, children }) => {
    const color = SECTION_COLORS[num]
    return (
      <Card className={`border-l-4 border-l-${color}-500 overflow-hidden`}>
        <CardHeader
          className={`cursor-pointer bg-gradient-to-r from-${color}-500/5 to-transparent py-4`}
          onClick={() => toggleSection(num)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <div className={`h-8 w-8 rounded-lg bg-${color}-500/10 flex items-center justify-center`}>
                <span className={`text-sm font-bold text-${color}-600`}>{num}</span>
              </div>
              {title}
            </CardTitle>
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded[num] ? "rotate-180" : ""}`} />
          </div>
        </CardHeader>
        {expanded[num] && (
          <CardContent className="space-y-4 pt-4">
            {children}
          </CardContent>
        )}
      </Card>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Loading evaluation data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="space-y-2 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <ClipboardCheck className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Task Evaluation</h1>
              <p className="text-muted-foreground">Conduct structured task testing and evaluation</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={expandAll}>Expand All</Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>Collapse All</Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="new" className="w-full">
        <TabsList className="h-auto p-0 bg-transparent flex gap-1 mb-6">
          <TabsTrigger
            value="new"
            className="flex items-center gap-2 py-2 px-4 rounded-lg border-2 border-muted data-[state=active]:bg-purple-500 data-[state=active]:border-purple-500 data-[state=active]:text-white hover:bg-purple-50 hover:border-purple-300 dark:hover:bg-purple-950 transition-all duration-200"
          >
            <FileText className="h-4 w-4" />
            <span>New Evaluation</span>
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="flex items-center gap-2 py-2 px-4 rounded-lg border-2 border-muted data-[state=active]:bg-blue-500 data-[state=active]:border-blue-500 data-[state=active]:text-white hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-950 transition-all duration-200"
          >
            <ListChecks className="h-4 w-4" />
            <span>Past Evaluations ({evaluations.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="mt-0 space-y-4">
          {/* SECTION 1: Basic Information */}
          <SectionCard num={1} title="Basic Information">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Project Name *</Label>
                <Input value={form.projectName} onChange={(e) => updateForm(null, "projectName", e.target.value)} placeholder="Enter project name" />
              </div>
              <div className="space-y-2">
                <Label>Module / Task Name *</Label>
                <Input value={form.moduleName} onChange={(e) => updateForm(null, "moduleName", e.target.value)} placeholder="Enter module name" />
              </div>
              <div className="space-y-2">
                <Label>Select Task *</Label>
                <Select value={form.task} onValueChange={(v) => updateForm(null, "task", v)}>
                  <SelectTrigger><SelectValue placeholder="Select a task" /></SelectTrigger>
                  <SelectContent>
                    {tasks.map((t) => (
                      <SelectItem key={t._id} value={t._id}>{t.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Submitted By</Label>
                <Select value={form.submittedBy} onValueChange={(v) => updateForm(null, "submittedBy", v)}>
                  <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
                  <SelectContent>
                    {usersList.map((u) => (
                      <SelectItem key={u._id} value={u._id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Testing Level *</Label>
                <RadioGroup value={form.testingLevel} onValueChange={(v) => updateForm(null, "testingLevel", v)} className="flex flex-wrap gap-3 pt-1">
                  {["Candidate", "Task", "Integration", "DevOps", "Live"].map((level) => (
                    <div key={level} className="flex items-center space-x-1.5">
                      <RadioGroupItem value={level} id={`level-${level}`} />
                      <Label htmlFor={`level-${level}`} className="text-sm cursor-pointer">{level}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label>Test Conducted By</Label>
                <Input value={form.testConductedBy} onChange={(e) => updateForm(null, "testConductedBy", e.target.value)} placeholder="Tester name" />
              </div>
            </div>
          </SectionCard>

          {/* SECTION 2: Submission Verification */}
          <SectionCard num={2} title="Submission Verification">
            <CheckboxRow label="Deliverables were clearly defined" section="submissionVerification" field="deliverablesDefinedClearly" />
            <CheckboxRow label="All expected deliverables were received" section="submissionVerification" field="allDeliverablesReceived" />
            <CheckboxRow label="Repository / files accessible" section="submissionVerification" field="repositoryAccessible" />
            <CheckboxRow label="Execution instructions provided" section="submissionVerification" field="executionInstructionsProvided" />
            <CheckboxRow label="Required datasets included" section="submissionVerification" field="requiredDatasetsIncluded" />
            <Textarea placeholder="Notes..." value={form.submissionVerification.notes} onChange={(e) => updateForm("submissionVerification", "notes", e.target.value)} />
          </SectionCard>

          {/* SECTION 3: Functional Testing */}
          <SectionCard num={3} title="Functional Testing">
            <RadioRow label="Does the system perform the required function?" section="functionalTesting" field="performsRequiredFunction" />
            <RadioRow label="Input handling working correctly?" section="functionalTesting" field="inputHandlingCorrect" />
            <RadioRow label="Output matches expected results?" section="functionalTesting" field="outputMatchesExpected" />
            <ResultRow section="functionalTesting" options={["PASS", "PARTIAL", "FAIL"]} />
            <Textarea placeholder="Notes..." value={form.functionalTesting.notes} onChange={(e) => updateForm("functionalTesting", "notes", e.target.value)} />
          </SectionCard>

          {/* SECTION 4: Code / Architecture Quality */}
          <SectionCard num={4} title="Code / Architecture Quality">
            <RadioRow label="Code clarity" section="codeQuality" field="codeClarity" options={["Excellent", "Good", "Needs Improvement", "Poor"]} />
            <RadioRow label="Modular structure" section="codeQuality" field="modularStructure" />
            <RadioRow label="Alignment with BHIV architecture" section="codeQuality" field="architectureAlignment" />
            <Textarea placeholder="Notes..." value={form.codeQuality.notes} onChange={(e) => updateForm("codeQuality", "notes", e.target.value)} />
          </SectionCard>

          {/* SECTION 5: Data Handling Integrity */}
          <SectionCard num={5} title="Data Handling Integrity">
            <RadioRow label="Input validation present" section="dataHandling" field="inputValidation" />
            <RadioRow label="Schema consistency maintained" section="dataHandling" field="schemaConsistency" />
            <RadioRow label="Error handling implemented" section="dataHandling" field="errorHandling" />
            <ResultRow section="dataHandling" options={["PASS", "PARTIAL", "FAIL"]} />
            <Textarea placeholder="Notes..." value={form.dataHandling.notes} onChange={(e) => updateForm("dataHandling", "notes", e.target.value)} />
          </SectionCard>

          {/* SECTION 6: Integration Readiness */}
          <SectionCard num={6} title="Integration Readiness">
            <RadioRow label="Can this module integrate with BHIV systems?" section="integrationReadiness" field="canIntegrate" options={["Ready", "Minor Fixes Required", "Not Ready"]} />
            <RadioRow label="Dependency conflicts?" section="integrationReadiness" field="dependencyConflicts" options={["None", "Minor", "Major"]} />
            <RadioRow label="API / interface compatibility confirmed?" section="integrationReadiness" field="apiCompatibility" />
            <Textarea placeholder="Notes..." value={form.integrationReadiness.notes} onChange={(e) => updateForm("integrationReadiness", "notes", e.target.value)} />
          </SectionCard>

          {/* SECTION 7: Security & Governance Check */}
          <SectionCard num={7} title="Security & Governance Check">
            <RadioRow label="Access control respected?" section="securityCheck" field="accessControlRespected" options={["Yes", "No"]} />
            <RadioRow label="Sensitive data handling correct?" section="securityCheck" field="sensitiveDataHandling" />
            <RadioRow label="Boundary enforcement respected?" section="securityCheck" field="boundaryEnforcement" options={["Yes", "No"]} />
            <ResultRow section="securityCheck" options={["PASS", "RISK DETECTED"]} />
            <Textarea placeholder="Notes..." value={form.securityCheck.notes} onChange={(e) => updateForm("securityCheck", "notes", e.target.value)} />
          </SectionCard>

          {/* SECTION 8: Performance Check */}
          <SectionCard num={8} title="Performance Check">
            <RadioRow label="Runtime stable?" section="performanceCheck" field="runtimeStable" />
            <RadioRow label="Resource usage acceptable?" section="performanceCheck" field="resourceUsageAcceptable" options={["Yes", "No"]} />
            <RadioRow label="Failure scenarios handled?" section="performanceCheck" field="failureScenariosHandled" />
            <ResultRow section="performanceCheck" options={["STABLE", "MODERATE ISSUES", "UNSTABLE"]} />
            <Textarea placeholder="Notes..." value={form.performanceCheck.notes} onChange={(e) => updateForm("performanceCheck", "notes", e.target.value)} />
          </SectionCard>

          {/* SECTION 9: Documentation Quality */}
          <SectionCard num={9} title="Documentation Quality">
            <RadioRow label="README present?" section="documentationQuality" field="readmePresent" options={["Yes", "No"]} />
            <RadioRow label="Code comments sufficient?" section="documentationQuality" field="codeCommentsSufficient" />
            <RadioRow label="Setup / run instructions included?" section="documentationQuality" field="setupInstructions" />
            <ResultRow section="documentationQuality" options={["COMPLETE", "PARTIAL", "MISSING"]} />
            <Textarea placeholder="Notes..." value={form.documentationQuality.notes} onChange={(e) => updateForm("documentationQuality", "notes", e.target.value)} />
          </SectionCard>

          {/* SECTION 10: Testing Evidence */}
          <SectionCard num={10} title="Testing Evidence">
            <p className="text-sm text-muted-foreground mb-2">Confirm testing evidence attached:</p>
            <CheckboxRow label="Logs" section="testingEvidence" field="logsAttached" />
            <CheckboxRow label="Screenshots" section="testingEvidence" field="screenshotsAttached" />
            <CheckboxRow label="Execution outputs" section="testingEvidence" field="executionOutputs" />
            <CheckboxRow label="Error traces" section="testingEvidence" field="errorTraces" />
            <Textarea placeholder="Notes..." value={form.testingEvidence.notes} onChange={(e) => updateForm("testingEvidence", "notes", e.target.value)} />
          </SectionCard>

          {/* SECTION 11: Issues Identified */}
          <SectionCard num={11} title="Issues Identified">
            <div className="space-y-3">
              {form.issuesIdentified.map((issue, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground w-6">{i + 1}.</span>
                  <Input
                    value={issue.description}
                    onChange={(e) => updateIssue(i, e.target.value)}
                    className="flex-1"
                    placeholder={`Describe issue ${i + 1}`}
                  />
                  {form.issuesIdentified.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeIssue(i)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addIssue}>
                <Plus className="mr-2 h-4 w-4" /> Add Issue
              </Button>
            </div>
          </SectionCard>

          {/* SECTION 12: Final Verdict */}
          <SectionCard num={12} title="Final Verdict">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { value: "APPROVED", label: "Approved", bg: "bg-green-500/10 border-green-500", text: "text-green-700 dark:text-green-400", activeBg: "bg-green-500/20 border-green-500 shadow-lg shadow-green-500/20" },
                { value: "APPROVED WITH MINOR FIXES", label: "Minor Fixes", bg: "bg-amber-500/10 border-amber-500", text: "text-amber-700 dark:text-amber-400", activeBg: "bg-amber-500/20 border-amber-500 shadow-lg shadow-amber-500/20" },
                { value: "REVISION REQUIRED", label: "Revision Required", bg: "bg-orange-500/10 border-orange-500", text: "text-orange-700 dark:text-orange-400", activeBg: "bg-orange-500/20 border-orange-500 shadow-lg shadow-orange-500/20" },
                { value: "REJECTED", label: "Rejected", bg: "bg-red-500/10 border-red-500", text: "text-red-700 dark:text-red-400", activeBg: "bg-red-500/20 border-red-500 shadow-lg shadow-red-500/20" },
              ].map((v) => (
                <div
                  key={v.value}
                  onClick={() => updateForm(null, "finalVerdict", v.value)}
                  className={`p-6 rounded-xl border-2 cursor-pointer transition-all text-center hover:scale-105 ${
                    form.finalVerdict === v.value ? v.activeBg : "border-muted hover:border-muted-foreground/30"
                  }`}
                >
                  <div className={`text-lg font-bold ${form.finalVerdict === v.value ? v.text : "text-muted-foreground"}`}>
                    {v.label}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* SECTION 13: Required Actions */}
          <SectionCard num={13} title="Required Actions">
            <Textarea
              placeholder="Corrections / actions required before acceptance..."
              value={form.requiredActions}
              onChange={(e) => updateForm(null, "requiredActions", e.target.value)}
              className="min-h-[120px]"
            />
          </SectionCard>

          {/* Submit Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
            <Button onClick={submitEvaluation} disabled={isSaving} className="gradient-primary hover:glow-primary">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Submit Evaluation
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <Card>
            <CardHeader className="border-b bg-gradient-to-r from-blue-500/5 to-transparent">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-blue-500" /> Past Evaluations
                </CardTitle>
                <Button variant="outline" size="sm" onClick={fetchData}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {evaluations.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead>Testing Level</TableHead>
                      <TableHead>Verdict</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {evaluations.map((ev) => (
                      <TableRow key={ev._id}>
                        <TableCell className="font-medium">{ev.projectName}</TableCell>
                        <TableCell>{ev.task?.title || "—"}</TableCell>
                        <TableCell>{ev.testingLevel}</TableCell>
                        <TableCell>
                          <Badge className={getVerdictBadgeColor(ev.finalVerdict)}>{ev.finalVerdict}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(ev.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => setViewEvaluation(ev)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <ClipboardCheck className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
                  <p>No evaluations yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View Evaluation Dialog */}
      <Dialog open={!!viewEvaluation} onOpenChange={() => setViewEvaluation(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-purple-500" />
              Evaluation Details
            </DialogTitle>
            <DialogDescription>
              {viewEvaluation?.projectName} — {viewEvaluation?.moduleName}
            </DialogDescription>
          </DialogHeader>
          {viewEvaluation && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Project</Label>
                  <p className="font-medium">{viewEvaluation.projectName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Module</Label>
                  <p className="font-medium">{viewEvaluation.moduleName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Task</Label>
                  <p className="font-medium">{viewEvaluation.task?.title || "—"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Testing Level</Label>
                  <p className="font-medium">{viewEvaluation.testingLevel}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Conducted By</Label>
                  <p className="font-medium">{viewEvaluation.testConductedBy}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Date</Label>
                  <p className="font-medium">{new Date(viewEvaluation.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <Label className="text-muted-foreground text-xs">Results Summary</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="p-2 rounded bg-muted/50">
                    <span className="text-xs text-muted-foreground">Functional Testing:</span>
                    <p className="font-medium text-sm">{viewEvaluation.functionalTesting?.result || "N/A"}</p>
                  </div>
                  <div className="p-2 rounded bg-muted/50">
                    <span className="text-xs text-muted-foreground">Data Handling:</span>
                    <p className="font-medium text-sm">{viewEvaluation.dataHandling?.result || "N/A"}</p>
                  </div>
                  <div className="p-2 rounded bg-muted/50">
                    <span className="text-xs text-muted-foreground">Security:</span>
                    <p className="font-medium text-sm">{viewEvaluation.securityCheck?.result || "N/A"}</p>
                  </div>
                  <div className="p-2 rounded bg-muted/50">
                    <span className="text-xs text-muted-foreground">Performance:</span>
                    <p className="font-medium text-sm">{viewEvaluation.performanceCheck?.result || "N/A"}</p>
                  </div>
                  <div className="p-2 rounded bg-muted/50">
                    <span className="text-xs text-muted-foreground">Documentation:</span>
                    <p className="font-medium text-sm">{viewEvaluation.documentationQuality?.result || "N/A"}</p>
                  </div>
                  <div className="p-2 rounded bg-muted/50">
                    <span className="text-xs text-muted-foreground">Code Quality:</span>
                    <p className="font-medium text-sm">{viewEvaluation.codeQuality?.codeClarity || "N/A"}</p>
                  </div>
                </div>
              </div>

              {viewEvaluation.issuesIdentified?.length > 0 && viewEvaluation.issuesIdentified.some(i => i.description) && (
                <div className="border-t pt-4">
                  <Label className="text-muted-foreground text-xs">Issues Identified</Label>
                  <ul className="mt-2 space-y-1">
                    {viewEvaluation.issuesIdentified.filter(i => i.description).map((issue, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-muted-foreground">{i + 1}.</span>
                        <span>{issue.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="border-t pt-4">
                <Label className="text-muted-foreground text-xs">Final Verdict</Label>
                <div className="mt-2">
                  <Badge className={`text-base px-4 py-1 ${getVerdictBadgeColor(viewEvaluation.finalVerdict)}`}>
                    {viewEvaluation.finalVerdict}
                  </Badge>
                </div>
              </div>

              {viewEvaluation.requiredActions && (
                <div className="border-t pt-4">
                  <Label className="text-muted-foreground text-xs">Required Actions</Label>
                  <p className="mt-1 text-sm">{viewEvaluation.requiredActions}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default TesterEvaluation
