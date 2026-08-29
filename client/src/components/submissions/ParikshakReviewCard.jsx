import React, { useState, useEffect } from 'react';
import { Badge } from "../ui/badge";
import { ThumbsUp, AlertTriangle, Lightbulb, Rocket, CheckCircle, Code, ChevronDown, ChevronUp } from "lucide-react";
import { formatDateTime } from "@/lib/dateFormat";

const ParikshakReviewCard = ({ submission }) => {
  const [showDebug, setShowDebug] = useState(false);
  const details = submission?.aiReviewDetails;

  useEffect(() => {
    if (submission && details) {
      console.groupCollapsed(`🔍 [PARIKSHAK FRONTEND DEBUG] Submission ID: ${submission._id}`);
      console.log("Submission Status:", submission.status);
      console.log("AI Review Result:", details.result || "N/A");
      console.log("AI Score:", details.score !== undefined && details.score !== null ? `${details.score}/100` : "N/A");
      console.log("GitHub Repository:", submission.githubLink || "None");
      console.log("Done Well:", details.doneWell);
      console.log("Missing Work:", details.missingWork);
      console.log("Recommendations:", details.recommendations);
      console.log("Production Readiness:", details.readiness);
      console.log("Full Submission Data:", submission);
      console.groupEnd();
    }
  }, [submission, details]);

  if (!details || (!details.doneWell && details.score === undefined && !details.result)) return null;

  const resultColor =
    details.result === 'PASS'
      ? 'bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
      : details.result === 'PARTIAL'
        ? 'bg-amber-500/15 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
        : 'bg-rose-500/15 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800';

  return (
    <div className="mt-3 rounded-xl border border-indigo-200/80 dark:border-indigo-900/50 bg-gradient-to-b from-indigo-50/70 to-slate-50/70 dark:from-indigo-950/30 dark:to-slate-900/40 shadow-sm overflow-hidden transition-all">
      {/* Header */}
      <div className="bg-indigo-600/10 dark:bg-indigo-500/15 px-3 py-2 border-b border-indigo-200/60 dark:border-indigo-900/40 flex items-center justify-between flex-wrap gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="bg-indigo-600 rounded-md p-1 flex items-center justify-center flex-shrink-0">
            <Rocket className="h-3 w-3 text-white" />
          </div>
          <span className="font-bold text-xs text-indigo-950 dark:text-indigo-200 truncate">
            AI Review
          </span>
          {details.result && (
            <Badge variant="outline" className={`text-[10px] font-bold px-1.5 py-0 rounded ${resultColor}`}>
              {details.result}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {details.score !== undefined && details.score !== null && (
            <Badge className="bg-indigo-600 text-white dark:bg-indigo-500 text-[11px] font-bold px-2 py-0.5 border-0">
              Score: {details.score}/100
            </Badge>
          )}
          {submission?.updatedAt && (
            <span className="text-[10px] text-muted-foreground font-medium">
              {formatDateTime(submission.updatedAt)}
            </span>
          )}
        </div>
      </div>

      {/* Content - Single column for full card width readability */}
      <div className="p-2.5 space-y-2">
        {/* What was done well */}
        {details.doneWell && (
          <div className="bg-emerald-50/80 dark:bg-emerald-950/30 rounded-lg p-2 border border-emerald-200/70 dark:border-emerald-800/40">
            <div className="flex items-center gap-1.5 mb-1 text-emerald-800 dark:text-emerald-300 font-semibold text-xs">
              <ThumbsUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span>What was done well</span>
            </div>
            <p className="text-xs text-emerald-950/90 dark:text-emerald-200/90 leading-relaxed break-words whitespace-pre-wrap">
              {details.doneWell}
            </p>
          </div>
        )}

        {/* Missing work */}
        {details.missingWork && details.missingWork !== "None" && details.missingWork !== "N/A" && (
          <div className="bg-rose-50/80 dark:bg-rose-950/30 rounded-lg p-2 border border-rose-200/70 dark:border-rose-800/40">
            <div className="flex items-center gap-1.5 mb-1 text-rose-800 dark:text-rose-300 font-semibold text-xs">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
              <span>Missing work</span>
            </div>
            <p className="text-xs text-rose-950/90 dark:text-rose-200/90 leading-relaxed break-words whitespace-pre-wrap">
              {details.missingWork}
            </p>
          </div>
        )}

        {/* Recommendations */}
        {details.recommendations && details.recommendations !== "N/A" && (
          <div className="bg-amber-50/80 dark:bg-amber-950/30 rounded-lg p-2 border border-amber-200/70 dark:border-amber-800/40">
            <div className="flex items-center gap-1.5 mb-1 text-amber-800 dark:text-amber-300 font-semibold text-xs">
              <Lightbulb className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span>Recommendations</span>
            </div>
            <p className="text-xs text-amber-950/90 dark:text-amber-200/90 leading-relaxed break-words whitespace-pre-wrap">
              {details.recommendations}
            </p>
          </div>
        )}

        {/* Readiness */}
        {details.readiness && (
          <div className="bg-blue-50/80 dark:bg-blue-950/30 rounded-lg p-2 border border-blue-200/70 dark:border-blue-800/40">
            <div className="flex items-center gap-1.5 mb-1 text-blue-800 dark:text-blue-300 font-semibold text-xs">
              <CheckCircle className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <span>Production Readiness</span>
            </div>
            <p className="text-xs text-blue-950/90 dark:text-blue-200/90 leading-relaxed break-words whitespace-pre-wrap">
              {details.readiness}
            </p>
          </div>
        )}


      </div>
    </div>
  );
};

export default ParikshakReviewCard;
