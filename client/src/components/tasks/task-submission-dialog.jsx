



import { toast } from "react-toastify";

"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Textarea } from "../ui/textarea"
import { Badge } from "../ui/badge"
import { Github, Link2, FileText, RefreshCw, Sparkles, AlertTriangle, CheckCircle } from "lucide-react"
import { SimpleModeToggle } from "../simple-mode-toggle"
import { ToastContainer } from "react-toastify"
import "react-toastify/dist/ReactToastify.css"

export function TaskSubmissionDialog({ open, onOpenChange, onSubmit, existingSubmission }) {

  const [formData, setFormData] = useState({
    githubLink: existingSubmission?.githubLink || "",
    notes: existingSubmission?.notes || "",
  })

  // Reset form data when existingSubmission changes or dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
        githubLink: existingSubmission?.githubLink || "",
        notes: existingSubmission?.notes || "",
      })
      setDocumentFile(null)
      setErrors({})
    }
  }, [existingSubmission, open])
  const [documentFile, setDocumentFile] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState({})

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }))
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      const validTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "image/png",
        "image/jpeg",
      ]
      if (!validTypes.includes(file.type)) {
        toast.error("Only PDF, DOC, DOCX, PNG, and JPEG files are allowed.")
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB.")
        return
      }
      setDocumentFile(file)
    }
  }

  const wordCount = formData.notes.trim() ? formData.notes.trim().split(/\s+/).filter(Boolean).length : 0

  const validateForm = () => {
    const newErrors = {}
    if (formData.githubLink && !isValidGithubUrl(formData.githubLink)) {
      newErrors.githubLink = "Please enter a valid GitHub repository URL (e.g. https://github.com/org/repo)"
    }
    if (!formData.githubLink && !documentFile && wordCount < 50) {
      newErrors.notes = `Please enter a valid GitHub repository URL or write at least 50 words of implementation notes (current: ${wordCount} / 50 words).`
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const isValidGithubUrl = (string) => {
    try {
      const url = new URL(string)
      return url.hostname === "github.com" && url.pathname.split("/").filter(Boolean).length >= 2
    } catch {
      return false
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) {
      return
    }

    try {
      const userId = JSON.parse(localStorage.getItem("WorkflowUser")).id
      setIsSubmitting(true)
      const submissionData = new FormData()
      submissionData.append("githubLink", formData.githubLink)
      submissionData.append("notes", formData.notes)
      submissionData.append("userId", userId)
      if (documentFile) {
        submissionData.append("document", documentFile)
      }

      await onSubmit(submissionData);
      toast.success(existingSubmission ? "Task updated and resubmitted to admin for review" : "Task submitted successfully");
    } catch (error) {
      console.error("Error submitting task:", error)
      toast.error("Failed to submit task")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-hidden bg-white dark:bg-gray-950 border-2 border-gray-200 dark:border-gray-800 shadow-2xl rounded-3xl p-0">
        {/* Hidden title for accessibility */}
        <DialogTitle className="sr-only">Submit Task</DialogTitle>

        <div className="px-6 pt-6 pb-5 overflow-y-auto max-h-[calc(90vh-120px)] bg-white dark:bg-gray-950 scrollbar-thin scrollbar-thumb-primary/20 dark:scrollbar-thumb-primary/10 scrollbar-track-transparent hover:scrollbar-thumb-primary/30 dark:hover:scrollbar-thumb-primary/20">
          <form onSubmit={handleSubmit} className="grid gap-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-md bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                <Github className="h-5 w-5 text-blue-600 dark:text-blue-300" />
              </div>
              <div className="flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{existingSubmission ? "Edit Submission" : "Submit Task"}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{existingSubmission ? "Update your submission details below." : "Provide your submission details. All fields are optional."}</p>
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <SimpleModeToggle />
                    </div>
                  </div>
                </div>
            </div>
          <div className="space-y-2">
            <Label htmlFor="githubLink" className="flex items-center gap-1 text-gray-900 dark:text-white">
              <Github className="h-4 w-4 text-gray-700 dark:text-gray-300" />
              Repository Link
            </Label>
            <Input
              id="githubLink"
              name="githubLink"
              placeholder="https://github.com/username/repository or other repository URL"
              value={formData.githubLink}
              onChange={handleChange}
              className={`h-12 px-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-700 hover:border-primary/40 focus:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 rounded-xl transition-all duration-300 text-base font-medium placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-gray-100 ${errors.githubLink ? "border-destructive" : ""}`}
            />
            {errors.githubLink && <p className="text-xs text-red-500">{errors.githubLink}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="document" className="flex items-center gap-1 text-gray-900 dark:text-white">
              <FileText className="h-4 w-4 text-gray-700 dark:text-gray-300" />
              Document or Photo
            </Label>
            <div className="space-y-2">
              {/* Show existing document when updating */}
              {existingSubmission?.documentLink && !documentFile && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2.5 font-medium">
                    <FileText className="h-5 w-5 flex-shrink-0" />
                    <span className="truncate">Current file attached</span>
                    <span className="text-xs bg-blue-200 dark:bg-blue-800 px-2 py-0.5 rounded-full ml-auto">Existing</span>
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Upload a new file below to replace it</p>
                </div>
              )}
              <Input
                id="document"
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                className="h-12 px-4 bg-gray-50 dark:bg-gray-900 border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-accent/40 focus:border-accent focus-visible:ring-4 focus-visible:ring-accent/10 rounded-xl transition-all duration-300 cursor-pointer text-gray-900 dark:text-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-accent file:to-accent/80 file:text-accent-foreground hover:file:from-accent/90 hover:file:to-accent/70 file:transition-all file:duration-300"
              />
              {documentFile && (
                <div className="mt-1 p-3 bg-accent/10 dark:bg-accent/5 border border-accent/20 rounded-lg">
                  <p className="text-sm text-gray-900 dark:text-gray-100 flex items-center gap-2.5 font-medium">
                    <FileText className="h-5 w-5 text-accent flex-shrink-0" />
                    <span className="truncate">{documentFile.name}</span>
                    <span className="text-xs text-accent bg-accent/20 px-2 py-0.5 rounded-full ml-auto">New File</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="notes" className="text-gray-900 dark:text-white">Notes</Label>
              <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded transition-colors ${
                wordCount >= 50 
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800' 
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}>
                {wordCount} / 50 words
              </span>
            </div>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Describe your technical implementation, architecture, and completed features..."
              value={formData.notes}
              onChange={handleChange}
              rows={4}
              className={`min-h-[110px] px-4 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-700 hover:border-secondary/40 focus:border-secondary focus-visible:ring-4 focus-visible:ring-secondary/10 rounded-xl resize-none transition-all duration-300 text-base placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-gray-100 ${errors.notes ? "border-destructive" : ""}`}
            />
            {errors.notes && <p className="text-xs text-red-500 mt-1 font-medium">{errors.notes}</p>}
          </div>

          </form>
        </div>

        <DialogFooter className="px-6 py-4 border-t-2 border-gray-200 dark:border-gray-800 bg-gradient-to-t from-gray-50/50 dark:from-gray-900/50 to-transparent backdrop-blur-sm">
          <div className="flex items-center gap-3 w-full sm:w-auto sm:ml-auto">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 sm:flex-none h-12 px-6 rounded-xl border-2 border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-300 font-semibold text-gray-900 dark:text-gray-100"
            >
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </Button>
            <Button
              type="submit"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 sm:flex-none h-12 px-8 rounded-xl gradient-primary text-primary-foreground hover:shadow-xl hover:shadow-primary/30 dark:hover:shadow-primary/20 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none font-bold"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2.5">
                  <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                  {existingSubmission ? "Resubmitting..." : "Submitting..."}
                </span>
              ) : (
                <span className="flex items-center gap-2.5">
                  {existingSubmission ? (
                    <RefreshCw className="h-5 w-5" />
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                  )}
                  {existingSubmission ? "Update & Resubmit" : "Submit Task"}
                </span>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


















