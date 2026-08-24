"use client"

import { useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card"
import { formatDate } from "../../lib/dateFormat"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import {
  ThumbsUp,
  ThumbsDown,
  Github,
  ExternalLink,
  MessageSquare,
  Calendar,
  CheckCircle2,
  XCircle,
  Bot,
  ArrowRight,
} from "lucide-react"

export function SubmissionFeedbackCard({
  submission,
  onViewDetails,
  onSubmitRevision,
}) {
  const [expanded, setExpanded] = useState(false)
  const pr = submission.parikshakReview

  const getStatusIcon = () => {
    if (submission.status === "Approved") {
      return (
        <div className="p-2.5 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg">
          <ThumbsUp className="h-5 w-5 text-white" />
        </div>
      )
    } else if (submission.status === "Rejected") {
      return (
        <div className="p-2.5 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg">
          <ThumbsDown className="h-5 w-5 text-white" />
        </div>
      )
    }
    return null
  }

  const getStatusBadge = () => {
    if (submission.status === "Approved") {
      return (
        <Badge className="bg-green-500/90 hover:bg-green-600/90 text-white border-0 shadow-lg backdrop-blur-sm px-3 py-1.5 flex items-center gap-1.5 font-semibold">
          <CheckCircle2 className="h-3.5 w-3.5" /> Approved
        </Badge>
      )
    } else if (submission.status === "Rejected") {
      return (
        <Badge className="bg-red-500/90 hover:bg-red-600/90 text-white border-0 shadow-lg backdrop-blur-sm px-3 py-1.5 flex items-center gap-1.5 font-semibold">
          <XCircle className="h-3.5 w-3.5" /> Rejected
        </Badge>
      )
    }
    return null
  }

  const getCardStyle = () => {
    if (submission.status === "Approved") {
      return "bg-gradient-to-br from-green-50/80 via-white to-green-50/80 dark:from-green-900/10 dark:via-gray-800/50 dark:to-green-900/10 border-green-300/40 dark:border-green-700/30 hover:shadow-green-500/10"
    } else if (submission.status === "Rejected") {
      return "bg-gradient-to-br from-red-50/80 via-white to-red-50/80 dark:from-red-900/10 dark:via-gray-800/50 dark:to-red-900/10 border-red-300/40 dark:border-red-700/30 hover:shadow-red-500/10"
    }
    return "bg-gradient-to-br from-gray-50/80 via-white to-gray-50/80 dark:from-gray-800/50 dark:via-gray-800/50 dark:to-gray-800/50 border-gray-300/40 dark:border-gray-700/30"
  }

  const getScoreColor = (score) => {
    if (score >= 85) return "text-green-600 dark:text-green-400"
    if (score >= 60) return "text-amber-600 dark:text-amber-400"
    return "text-red-600 dark:text-red-400"
  }

  const getScoreBarColor = (score) => {
    if (score >= 85) return "bg-green-500"
    if (score >= 60) return "bg-amber-500"
    return "bg-red-500"
  }

  return (
    <Card className={`overflow-hidden transition-all duration-300 hover:shadow-xl backdrop-blur-sm border ${getCardStyle()} group`}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-4">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <CardTitle className="text-base font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {submission.task?.title || "Task Submission"}
              </CardTitle>
              <div className="flex items-center gap-1.5 mt-1">
                <Calendar className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                <CardDescription className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                  Reviewed on {formatDate(submission.updatedAt)}
                </CardDescription>
              </div>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">

        {/* AI Score Block */}
        {pr?.score != null && (
          <div className="rounded-xl border border-blue-200/60 dark:border-blue-800/40 bg-blue-50/60 dark:bg-blue-900/10 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">AI Score</span>
                <Badge className={`text-xs px-2 py-0.5 border-0 font-bold ${
                  pr.status === "PASS"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                    : pr.status === "PARTIAL"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                    : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                }`}>
                  {pr.status}
                </Badge>
              </div>
              <span className={`text-lg font-bold ${getScoreColor(pr.score)}`}>
                {pr.score}<span className="text-xs font-normal text-gray-500 dark:text-gray-400">/100</span>
              </span>
            </div>
            {/* Score bar */}
            <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${getScoreBarColor(pr.score)}`}
                style={{ width: `${pr.score}%` }}
              />
            </div>

          </div>
        )}

        {submission.feedback && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg">
                <MessageSquare className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Feedback</span>
            </div>
            <div className="relative bg-gradient-to-br from-gray-100/90 via-white/50 to-gray-100/90 dark:from-gray-700/50 dark:via-gray-800/50 dark:to-gray-700/50 backdrop-blur-sm rounded-xl p-4 border border-gray-200/50 dark:border-gray-600/30 shadow-sm">
              <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-2xl"></div>
              <p className="whitespace-pre-line break-words text-sm text-gray-800 dark:text-gray-200 leading-relaxed relative z-10">
                {expanded || submission.feedback.length <= 150
                  ? submission.feedback
                  : `${submission.feedback.slice(0, 150)}...`}
              </p>
              {submission.feedback.length > 150 && (
                <Button
                  variant="link"
                  className="p-0 h-auto text-xs mt-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? "Show less" : "Show more"}
                </Button>
              )}
            </div>
          </div>
        )}

        {submission.githubLink && (
          <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-gray-100/80 to-gray-50/80 dark:from-gray-700/40 dark:to-gray-800/40 rounded-lg border border-gray-200/50 dark:border-gray-600/30 backdrop-blur-sm">
            <div className="p-1.5 bg-gray-800 dark:bg-gray-700 rounded-lg">
              <Github className="h-3.5 w-3.5 text-white" />
            </div>
            <a
              href={submission.githubLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium truncate flex items-center gap-1 transition-colors"
            >
              {submission.githubLink.replace(/^https?:\/\/(www\.)?github\.com\//, "")}
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
            </a>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between border-t border-gray-200/50 dark:border-gray-700/30 pt-4 bg-gradient-to-r from-gray-50/50 to-transparent dark:from-gray-800/30 dark:to-transparent">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewDetails(submission)}
          className="border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-400 dark:hover:border-blue-500 transition-all font-semibold"
        >
          View Details
        </Button>
        {submission.status === "Rejected" && (
          <Button
            size="sm"
            onClick={() => onSubmitRevision(submission)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 dark:from-blue-500 dark:to-blue-600 dark:hover:from-blue-600 dark:hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all font-semibold"
          >
            Submit Revision
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
