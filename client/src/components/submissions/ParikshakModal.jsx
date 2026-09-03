import React, { useState, useEffect } from 'react';
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { 
  Sparkles, 
  Cpu, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  ThumbsUp, 
  Lightbulb, 
  Rocket, 
  X, 
  ShieldCheck,
  RefreshCw,
  Edit3,
  Loader2
} from "lucide-react";

const ParikshakModal = ({ 
  isOpen, 
  onClose, 
  loading, 
  evaluationData, 
  onApproveAndAssign, 
  onReject 
}) => {
  const [nextTitle, setNextTitle] = useState("");
  const [nextDesc, setNextDesc] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (evaluationData?.nextTask) {
      setNextTitle(evaluationData.nextTask.title || "");
      setNextDesc(evaluationData.nextTask.description || "");
      setPriority(evaluationData.nextTask.priority || "Medium");
    }
  }, [evaluationData]);

  if (!isOpen) return null;

  const isOffline = evaluationData?.isOffline || evaluationData?.result === "OFFLINE";
  const isPass = !isOffline && (evaluationData?.result === "PASS" || evaluationData?.status === "PASS");
  const score = evaluationData?.score !== undefined && evaluationData?.score !== null ? evaluationData.score : null;

  const handleConfirmApproval = async () => {
    setSubmitting(true);
    try {
      await onApproveAndAssign({
        evaluationData,
        customNextTask: {
          title: nextTitle,
          description: nextDesc,
          priority: priority
        }
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 text-slate-100 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-indigo-500/30 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl shadow-md">
              <Cpu size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-white">Parikshak Evaluation & Next Task</h2>
                <Badge className={`text-[10px] uppercase font-bold ${isOffline ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'}`}>
                  {isOffline ? 'Service Offline' : 'AI Review'}
                </Badge>
              </div>
              <p className="text-xs text-slate-400">
                {isOffline ? 'Parikshak AI service is offline. Please review candidate submission manually.' : 'Evaluation results & proposed follow-up task assignment for candidate'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={loading || submitting}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">

          {/* Loading State */}
          {loading ? (
            <div className="py-14 text-center space-y-4">
              <div className="inline-flex items-center justify-center relative p-3 bg-indigo-950/40 rounded-full border border-indigo-500/30 shadow-inner">
                <Loader2 className="h-12 w-12 text-indigo-400 animate-spin animate-[spin_1s_linear_infinite]" />
                <Sparkles className="absolute inset-0 m-auto text-purple-300 animate-pulse" size={20} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-white">Running Parikshak Evaluation Engine...</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Parsing deliverables, running deterministic checks, and generating recommended Next Task for candidate...
                </p>
              </div>
            </div>
          ) : isOffline ? (
            /* Clean Offline State - ONLY Show Alert Warning */
            <div className="py-8 px-6 bg-slate-950/80 rounded-2xl border border-amber-500/30 text-center space-y-4 shadow-xl">
              <div className="inline-flex items-center justify-center p-3 bg-amber-500/15 rounded-2xl border border-amber-500/30 text-amber-400">
                <AlertTriangle size={32} />
              </div>
              <div className="space-y-2 max-w-md mx-auto">
                <h3 className="text-lg font-bold text-white">Parikshak AI Review Engine is Offline</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  The automated evaluation service is currently unreachable. AI scoring, failure reasons, recommendations, and next-task proposals are unavailable.
                </p>
                <div className="p-3 bg-amber-950/40 rounded-xl border border-amber-800/40 text-amber-200/90 text-xs font-medium">
                  Candidate: <strong className="text-white">{evaluationData?.assigneeName || "Employee"}</strong> • Manual admin review is required.
                </div>
              </div>
            </div>
          ) : evaluationData ? (
            /* Online State - Show All AI Evaluation Details */
            <>
              {/* Evaluation Header Stats */}
              <div className="flex items-center justify-between p-4 bg-slate-950/80 rounded-xl border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl border ${
                    isPass ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                    'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  }`}>
                    {isPass ? <CheckCircle size={22} /> : <AlertTriangle size={22} />}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Evaluation Verdict</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-black text-sm uppercase ${isPass ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {evaluationData.result || "PASS"}
                      </span>
                      <span className="text-xs text-slate-400">• Candidate: <strong className="text-slate-200">{evaluationData.assigneeName || "Employee"}</strong></span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Deterministic Score</span>
                  <span className={`text-xl font-black ${isPass ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {score !== null ? `${score}/100` : "N/A"}
                  </span>
                </div>
              </div>

              {/* What was done well */}
              {evaluationData.doneWell && (
                <div className="bg-emerald-950/30 rounded-xl p-3.5 border border-emerald-800/40">
                  <div className="flex items-center gap-2 mb-1.5 text-emerald-400 font-semibold text-xs">
                    <ThumbsUp className="h-4 w-4" />
                    <span>What was done well</span>
                  </div>
                  <p className="text-xs text-emerald-200/90 leading-relaxed whitespace-pre-wrap">
                    {evaluationData.doneWell}
                  </p>
                </div>
              )}

              {/* Missing work / Recommendations */}
              {evaluationData.missingWork && evaluationData.missingWork !== "None" && (
                <div className="bg-amber-950/30 rounded-xl p-3.5 border border-amber-800/40">
                  <div className="flex items-center gap-2 mb-1.5 text-amber-400 font-semibold text-xs">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Missing Work / Feedback</span>
                  </div>
                  <p className="text-xs text-amber-200/90 leading-relaxed whitespace-pre-wrap">
                    {evaluationData.missingWork}
                  </p>
                </div>
              )}

              {evaluationData.recommendations && (
                <div className="bg-indigo-950/30 rounded-xl p-3.5 border border-indigo-800/40">
                  <div className="flex items-center gap-2 mb-1.5 text-indigo-400 font-semibold text-xs">
                    <Lightbulb className="h-4 w-4" />
                    <span>Recommendations & Readiness</span>
                  </div>
                  <p className="text-xs text-indigo-200/90 leading-relaxed whitespace-pre-wrap">
                    {evaluationData.recommendations}
                  </p>
                </div>
              )}

              <hr className="border-slate-800 my-2" />

              {/* Proposed Next Task Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Rocket className="h-4 w-4 text-purple-400" />
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Proposed Next Task</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setIsEditingTask(!isEditingTask)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors"
                  >
                    <Edit3 size={13} />
                    {isEditingTask ? "Done Editing" : "Edit Next Task"}
                  </button>
                </div>

                <div className="p-4 bg-slate-950 rounded-xl border border-purple-500/30 space-y-3">
                  {isEditingTask ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">Task Title</label>
                        <input 
                          type="text" 
                          value={nextTitle}
                          onChange={(e) => setNextTitle(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">Description & Requirements</label>
                        <textarea 
                          rows={4}
                          value={nextDesc}
                          onChange={(e) => setNextDesc(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-400 block mb-1">Priority</label>
                        <select
                          value={priority}
                          onChange={(e) => setPriority(e.target.value)}
                          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                          <option value="Urgent">Urgent</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-start">
                        <div>
                          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px] uppercase font-bold mb-1">
                            Assignee: {evaluationData.assigneeName || "Employee"}
                          </Badge>
                          <h3 className="text-sm font-black text-white">{nextTitle || "Phase 2 Next Task"}</h3>
                        </div>
                        <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-300">
                          Priority: {priority}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
                        {nextDesc}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between gap-3">
          {isOffline ? (
            <div className="w-full flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="border-slate-700 text-slate-200 hover:bg-slate-800 text-xs font-semibold px-5 rounded-xl"
              >
                Close
              </Button>
            </div>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={onReject}
                disabled={loading || submitting || !evaluationData}
                className="border-slate-700 text-slate-300 hover:bg-rose-950/50 hover:text-rose-400 hover:border-rose-800 text-xs font-bold rounded-xl"
              >
                Reject Submission
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={loading || submitting}
                  className="border-slate-800 text-slate-400 hover:text-white text-xs font-medium rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmApproval}
                  disabled={loading || submitting || !evaluationData}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 px-5"
                >
                  {submitting ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <ShieldCheck size={16} />
                  )}
                  Approve & Confirm Next Task
                </Button>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
};

export default ParikshakModal;
