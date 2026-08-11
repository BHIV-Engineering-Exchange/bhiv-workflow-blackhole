import React from 'react';
import { Badge } from "../ui/badge";
import { ThumbsUp, AlertTriangle, Lightbulb, Rocket, CheckCircle } from "lucide-react";
import { formatDateTime } from "@/lib/dateFormat";

const ParikshakReviewCard = ({ submission }) => {
  const details = submission?.aiReviewDetails;
  
  if (!details || (!details.doneWell && !details.score)) return null;

  return (
    <div className="mt-4 border border-indigo-500/20 rounded-lg overflow-hidden bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20 shadow-sm transition-all hover:shadow-md">
      <div className="bg-indigo-500/10 px-4 py-3 border-b border-indigo-500/20 flex justify-between items-center flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="bg-indigo-500 rounded-md p-1.5 flex items-center justify-center shadow-sm">
            <Rocket className="h-4 w-4 text-white" />
          </div>
          <h3 className="font-semibold text-indigo-900 dark:text-indigo-200">AI Automated Review</h3>
          {details.result && (
            <Badge className={`${
              details.result === 'PASS' ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300' :
              details.result === 'PARTIAL' ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/50 dark:text-amber-300' :
              'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300'
            }`}>
              {details.result}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 shadow-sm dark:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-800">
            Score: {details.score || 0}/100
          </Badge>
          <span className="text-xs font-medium text-muted-foreground">{formatDateTime(submission.updatedAt)}</span>
        </div>
      </div>
      
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* What was done well */}
        <div className="bg-white/60 dark:bg-black/20 rounded-lg p-3 border border-green-500/20 hover:bg-white/80 transition-colors">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-green-500/10">
            <ThumbsUp className="h-4 w-4 text-green-600" />
            <h4 className="font-semibold text-sm text-green-800 dark:text-green-400">What was done well</h4>
          </div>
          <p className="text-sm text-foreground/80 whitespace-pre-wrap">{details.doneWell || "N/A"}</p>
        </div>

        {/* Missing work */}
        <div className="bg-white/60 dark:bg-black/20 rounded-lg p-3 border border-red-500/20 hover:bg-white/80 transition-colors">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-red-500/10">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <h4 className="font-semibold text-sm text-red-800 dark:text-red-400">Missing work</h4>
          </div>
          <p className="text-sm text-foreground/80 whitespace-pre-wrap">{details.missingWork || "N/A"}</p>
        </div>

        {/* Recommendations */}
        <div className="bg-white/60 dark:bg-black/20 rounded-lg p-3 border border-amber-500/20 hover:bg-white/80 transition-colors">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-amber-500/10">
            <Lightbulb className="h-4 w-4 text-amber-600" />
            <h4 className="font-semibold text-sm text-amber-800 dark:text-amber-400">Recommendations</h4>
          </div>
          <p className="text-sm text-foreground/80 whitespace-pre-wrap">{details.recommendations || "N/A"}</p>
        </div>

        {/* Readiness */}
        <div className="bg-white/60 dark:bg-black/20 rounded-lg p-3 border border-blue-500/20 hover:bg-white/80 transition-colors">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-blue-500/10">
            <CheckCircle className="h-4 w-4 text-blue-600" />
            <h4 className="font-semibold text-sm text-blue-800 dark:text-blue-400">Readiness</h4>
          </div>
          <p className="text-sm text-foreground/80 whitespace-pre-wrap">{details.readiness || "N/A"}</p>
        </div>
      </div>
    </div>
  );
};

export default ParikshakReviewCard;
