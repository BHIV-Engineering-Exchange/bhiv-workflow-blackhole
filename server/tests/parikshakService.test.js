/**
 * parikshakService.test.js
 *
 * Unit tests for server/services/parikshakService.js
 * Mocks axios, TaskSubmission, and Notification — no real HTTP or DB calls.
 */

"use strict";

process.env.PARIKSHAK_URL = "http://mock-parikshak:8000";
process.env.MONGODB_URI = "mongodb://localhost:27017/test";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.TANTRA_EXECUTION_KEY = "test-tantra-key";
process.env.BUCKET_BASE_URL = "http://test-bucket:8001";

// ── Mock axios ────────────────────────────────────────────────────────────────
const mockAxiosPost = jest.fn();
jest.mock("axios", () => ({ post: mockAxiosPost }));

// ── Subject under test ────────────────────────────────────────────────────────
const { triggerReview } = require("../services/parikshakService");

// ── Fixtures ──────────────────────────────────────────────────────────────────
const makeSubmission = (overrides = {}) => ({
  _id: "sub-abc123",
  task: "task-xyz",
  user: "user-001",
  githubLink: "https://github.com/test/repo",
  notes: "Implemented the full API layer",
  ...overrides,
});

const makeTask = (overrides = {}) => ({
  _id: "task-xyz",
  title: "Build REST API",
  description: "Create a REST API with authentication and CRUD endpoints",
  ...overrides,
});

const parikshakResponse = (status, score) => ({
  status,
  score,
  review: `Review text for ${status}`,
  next_task: "task-next-001",
  trace_id: "trace-bhiv-sub-abc123",
});

const makeMocks = () => ({
  TaskSubmission: { findByIdAndUpdate: jest.fn().mockResolvedValue({}) },
  Notification: { create: jest.fn().mockResolvedValue({}) },
});

// ── PASS ──────────────────────────────────────────────────────────────────────

describe("triggerReview — PASS", () => {
  beforeEach(() => jest.clearAllMocks());

  it("calls POST /parikshak/review with correct payload", async () => {
    mockAxiosPost.mockResolvedValueOnce({ data: parikshakResponse("PASS", 92) });
    const { TaskSubmission, Notification } = makeMocks();

    await triggerReview({ submission: makeSubmission(), task: makeTask(), userName: "Alice", io: null, Notification, TaskSubmission });

    expect(mockAxiosPost).toHaveBeenCalledWith(
      "http://mock-parikshak:8000/parikshak/review",
      expect.objectContaining({
        title: "Build REST API",
        submitted_by: "Alice",
        repo_url: "https://github.com/test/repo",
        trace_id: "trace-bhiv-sub-abc123",
      }),
      expect.objectContaining({ timeout: 30000 })
    );
  });

  it("sets submission status to Approved", async () => {
    mockAxiosPost.mockResolvedValueOnce({ data: parikshakResponse("PASS", 92) });
    const { TaskSubmission, Notification } = makeMocks();

    await triggerReview({ submission: makeSubmission(), task: makeTask(), userName: "Alice", io: null, Notification, TaskSubmission });

    expect(TaskSubmission.findByIdAndUpdate).toHaveBeenCalledWith(
      "sub-abc123",
      expect.objectContaining({ $set: expect.objectContaining({ status: "Approved" }) })
    );
  });

  it("stores full parikshakReview block", async () => {
    mockAxiosPost.mockResolvedValueOnce({ data: parikshakResponse("PASS", 92) });
    const { TaskSubmission, Notification } = makeMocks();

    await triggerReview({ submission: makeSubmission(), task: makeTask(), userName: "Alice", io: null, Notification, TaskSubmission });

    const setArg = TaskSubmission.findByIdAndUpdate.mock.calls[0][1].$set;
    expect(setArg.parikshakReview).toMatchObject({
      status: "PASS",
      score: 92,
      review: "Review text for PASS",
      nextTask: "task-next-001",
    });
    expect(setArg.parikshakReview.reviewedAt).toBeInstanceOf(Date);
  });

  it("creates notification for submitter", async () => {
    mockAxiosPost.mockResolvedValueOnce({ data: parikshakResponse("PASS", 92) });
    const { TaskSubmission, Notification } = makeMocks();

    await triggerReview({ submission: makeSubmission(), task: makeTask(), userName: "Alice", io: null, Notification, TaskSubmission });

    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: "user-001",
        type: "submission_reviewed",
        title: "AI Review: PASS (92/100)",
        task: "task-xyz",
      })
    );
  });

  it("emits parikshak:review-complete socket event", async () => {
    mockAxiosPost.mockResolvedValueOnce({ data: parikshakResponse("PASS", 92) });
    const { TaskSubmission, Notification } = makeMocks();
    const mockEmit = jest.fn();

    await triggerReview({ submission: makeSubmission(), task: makeTask(), userName: "Alice", io: { emit: mockEmit }, Notification, TaskSubmission });

    expect(mockEmit).toHaveBeenCalledWith(
      "parikshak:review-complete",
      expect.objectContaining({
        submissionId: "sub-abc123",
        taskId: "task-xyz",
        userId: "user-001",
        status: "PASS",
        score: 92,
        nextTask: "task-next-001",
      })
    );
  });
});

// ── FAIL ──────────────────────────────────────────────────────────────────────

describe("triggerReview — FAIL", () => {
  beforeEach(() => jest.clearAllMocks());

  it("sets submission status to Pending for manual review", async () => {
    mockAxiosPost.mockResolvedValueOnce({ data: parikshakResponse("FAIL", 30) });
    const { TaskSubmission, Notification } = makeMocks();

    await triggerReview({ submission: makeSubmission(), task: makeTask(), userName: "Bob", io: null, Notification, TaskSubmission });

    const setArg = TaskSubmission.findByIdAndUpdate.mock.calls[0][1].$set;
    expect(setArg.status).toBe("Pending");
    expect(setArg.parikshakReview.status).toBe("FAIL");
    expect(setArg.parikshakReview.score).toBe(30);
  });

  it("still notifies user on FAIL", async () => {
    mockAxiosPost.mockResolvedValueOnce({ data: parikshakResponse("FAIL", 30) });
    const { TaskSubmission, Notification } = makeMocks();

    await triggerReview({ submission: makeSubmission(), task: makeTask(), userName: "Bob", io: null, Notification, TaskSubmission });

    expect(Notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "AI Review: FAIL (30/100)" })
    );
  });
});

// ── PARTIAL ───────────────────────────────────────────────────────────────────

describe("triggerReview — PARTIAL", () => {
  beforeEach(() => jest.clearAllMocks());

  it("sets submission status to Pending", async () => {
    mockAxiosPost.mockResolvedValueOnce({ data: parikshakResponse("PARTIAL", 65) });
    const { TaskSubmission, Notification } = makeMocks();

    await triggerReview({ submission: makeSubmission(), task: makeTask(), userName: "Carol", io: null, Notification, TaskSubmission });

    const setArg = TaskSubmission.findByIdAndUpdate.mock.calls[0][1].$set;
    expect(setArg.status).toBe("Pending");
    expect(setArg.parikshakReview.status).toBe("PARTIAL");
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe("triggerReview — error handling", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns silently when Parikshak HTTP call fails — does not throw", async () => {
    mockAxiosPost.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const { TaskSubmission, Notification } = makeMocks();

    await expect(
      triggerReview({ submission: makeSubmission(), task: makeTask(), userName: "Dave", io: null, Notification, TaskSubmission })
    ).resolves.toBeUndefined();

    expect(TaskSubmission.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(Notification.create).not.toHaveBeenCalled();
  });

  it("still completes DB write even if Notification.create throws", async () => {
    mockAxiosPost.mockResolvedValueOnce({ data: parikshakResponse("PASS", 88) });
    const { TaskSubmission } = makeMocks();
    const Notification = { create: jest.fn().mockRejectedValueOnce(new Error("DB error")) };

    await expect(
      triggerReview({ submission: makeSubmission(), task: makeTask(), userName: "Eve", io: null, Notification, TaskSubmission })
    ).resolves.toBeUndefined();

    expect(TaskSubmission.findByIdAndUpdate).toHaveBeenCalledTimes(1);
  });

  it("does not throw when io is null", async () => {
    mockAxiosPost.mockResolvedValueOnce({ data: parikshakResponse("PASS", 90) });
    const { TaskSubmission, Notification } = makeMocks();

    await expect(
      triggerReview({ submission: makeSubmission(), task: makeTask(), userName: "Frank", io: null, Notification, TaskSubmission })
    ).resolves.toBeUndefined();
  });

  it("sends empty string for repo_url when githubLink is missing", async () => {
    mockAxiosPost.mockResolvedValueOnce({ data: parikshakResponse("FAIL", 20) });
    const { TaskSubmission, Notification } = makeMocks();

    await triggerReview({ submission: makeSubmission({ githubLink: undefined }), task: makeTask(), userName: "Grace", io: null, Notification, TaskSubmission });

    expect(mockAxiosPost.mock.calls[0][1].repo_url).toBe("");
  });

  it("handles timeout error from Parikshak gracefully", async () => {
    const timeoutErr = new Error("timeout of 30000ms exceeded");
    timeoutErr.code = "ECONNABORTED";
    mockAxiosPost.mockRejectedValueOnce(timeoutErr);
    const { TaskSubmission, Notification } = makeMocks();

    await expect(
      triggerReview({ submission: makeSubmission(), task: makeTask(), userName: "Hank", io: null, Notification, TaskSubmission })
    ).resolves.toBeUndefined();

    expect(TaskSubmission.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
