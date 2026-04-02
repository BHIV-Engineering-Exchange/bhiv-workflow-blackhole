const mongoose = require("mongoose")

const EvaluationCheckSchema = {
  type: String,
  enum: ["Yes", "Partial", "No", "N/A"],
  default: "N/A",
}

const QualityRatingSchema = {
  type: String,
  enum: ["Excellent", "Good", "Needs Improvement", "Poor", "N/A"],
  default: "N/A",
}

const TaskEvaluationSchema = new mongoose.Schema({
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Task",
    required: true,
  },
  submission: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "TaskSubmission",
  },
  evaluatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  projectName: { type: String, required: true },
  moduleName: { type: String, required: true },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  testingLevel: {
    type: String,
    enum: ["Candidate", "Task", "Integration", "DevOps", "Live"],
    required: true,
  },
  testDate: { type: Date, default: Date.now },
  testConductedBy: { type: String, required: true },

  submissionVerification: {
    deliverablesDefinedClearly: { type: Boolean, default: false },
    allDeliverablesReceived: { type: Boolean, default: false },
    repositoryAccessible: { type: Boolean, default: false },
    executionInstructionsProvided: { type: Boolean, default: false },
    requiredDatasetsIncluded: { type: Boolean, default: false },
    notes: { type: String, default: "" },
  },

  functionalTesting: {
    performsRequiredFunction: EvaluationCheckSchema,
    inputHandlingCorrect: EvaluationCheckSchema,
    outputMatchesExpected: EvaluationCheckSchema,
    result: { type: String, enum: ["PASS", "PARTIAL", "FAIL", "N/A"], default: "N/A" },
    notes: { type: String, default: "" },
  },

  codeQuality: {
    codeClarity: QualityRatingSchema,
    modularStructure: EvaluationCheckSchema,
    architectureAlignment: EvaluationCheckSchema,
    notes: { type: String, default: "" },
  },

  dataHandling: {
    inputValidation: EvaluationCheckSchema,
    schemaConsistency: EvaluationCheckSchema,
    errorHandling: EvaluationCheckSchema,
    result: { type: String, enum: ["PASS", "PARTIAL", "FAIL", "N/A"], default: "N/A" },
    notes: { type: String, default: "" },
  },

  integrationReadiness: {
    canIntegrate: { type: String, enum: ["Ready", "Minor Fixes Required", "Not Ready", "N/A"], default: "N/A" },
    dependencyConflicts: { type: String, enum: ["None", "Minor", "Major", "N/A"], default: "N/A" },
    apiCompatibility: EvaluationCheckSchema,
    notes: { type: String, default: "" },
  },

  securityCheck: {
    accessControlRespected: EvaluationCheckSchema,
    sensitiveDataHandling: EvaluationCheckSchema,
    boundaryEnforcement: EvaluationCheckSchema,
    result: { type: String, enum: ["PASS", "RISK DETECTED", "N/A"], default: "N/A" },
    notes: { type: String, default: "" },
  },

  performanceCheck: {
    runtimeStable: EvaluationCheckSchema,
    resourceUsageAcceptable: EvaluationCheckSchema,
    failureScenariosHandled: EvaluationCheckSchema,
    result: { type: String, enum: ["STABLE", "MODERATE ISSUES", "UNSTABLE", "N/A"], default: "N/A" },
    notes: { type: String, default: "" },
  },

  documentationQuality: {
    readmePresent: EvaluationCheckSchema,
    codeCommentsSufficient: EvaluationCheckSchema,
    setupInstructions: EvaluationCheckSchema,
    result: { type: String, enum: ["COMPLETE", "PARTIAL", "MISSING", "N/A"], default: "N/A" },
    notes: { type: String, default: "" },
  },

  testingEvidence: {
    logsAttached: { type: Boolean, default: false },
    screenshotsAttached: { type: Boolean, default: false },
    executionOutputs: { type: Boolean, default: false },
    errorTraces: { type: Boolean, default: false },
    notes: { type: String, default: "" },
  },

  issuesIdentified: [{ description: { type: String } }],

  finalVerdict: {
    type: String,
    enum: ["APPROVED", "APPROVED WITH MINOR FIXES", "REVISION REQUIRED", "REJECTED", "PENDING"],
    default: "PENDING",
  },

  requiredActions: { type: String, default: "" },

  branch: { type: String, default: "blackhole_mumbai", index: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

TaskEvaluationSchema.pre("save", function (next) {
  this.updatedAt = Date.now()
  next()
})

TaskEvaluationSchema.index({ task: 1, evaluatedBy: 1 })
TaskEvaluationSchema.index({ finalVerdict: 1, branch: 1 })

module.exports = mongoose.model("TaskEvaluation", TaskEvaluationSchema)
