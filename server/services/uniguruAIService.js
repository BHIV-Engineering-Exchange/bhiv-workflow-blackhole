const axios = require('axios');

class UniGuruAIService {
  constructor() {
    this.serviceUrl = (process.env.UNIGURU_SERVICE_URL || 'http://163.128.209.18:8007').replace(/\/+$/, '');
    this.apiToken = process.env.UNIGURU_API_TOKEN || process.env.UNIGURU_SERVICE_TOKEN || '';
    this.callerName = process.env.UNIGURU_CALLER_NAME || 'niyantran-workflow';
    this.timeout = parseInt(process.env.UNIGURU_TIMEOUT_MS || '15000', 10);
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'X-Caller-Name': this.callerName
    };
    if (this.apiToken) {
      headers['Authorization'] = `Bearer ${this.apiToken}`;
      headers['X-Service-Token'] = this.apiToken;
    }
    return headers;
  }

  /**
   * Main interface to send questions or prompts to UniGuru AI
   */
  async ask(query, options = {}) {
    if (!query || !query.trim()) {
      return {
        answer: 'Empty query provided.',
        decision: 'reject',
        confidence: 0.0,
        source: 'uniguru_client'
      };
    }

    const payload = {
      query: query.trim(),
      context: {
        caller: this.callerName,
        domain: options.domain || 'Niyantran Workflows',
        ...(options.context || {})
      },
      allow_web: Boolean(options.allowWeb),
      session_id: options.sessionId || null
    };

    try {
      // Try /ask primary endpoint
      const response = await axios.post(`${this.serviceUrl}/ask`, payload, {
        headers: this.getHeaders(),
        timeout: this.timeout
      });

      if (response.data) {
        return {
          answer: response.data.answer || response.data.response || 'No answer generated.',
          decision: response.data.decision || 'answer',
          confidence: response.data.confidence ?? response.data.reasoning_trace?.retrieval_confidence ?? 0.85,
          source: response.data.source || response.data.ontology_reference?.domain || 'uniguru',
          raw: response.data
        };
      }
    } catch (error) {
      console.warn(`⚠️ UniGuru /ask endpoint call failed (${error.message}). Trying /query/ask fallback...`);
      try {
        const fallbackResponse = await axios.post(`${this.serviceUrl}/query/ask`, { query: query.trim() }, {
          headers: this.getHeaders(),
          timeout: this.timeout
        });
        if (fallbackResponse.data) {
          return {
            answer: fallbackResponse.data.answer || fallbackResponse.data.response || 'No answer generated.',
            decision: fallbackResponse.data.decision || 'answer',
            confidence: fallbackResponse.data.confidence ?? 0.8,
            source: fallbackResponse.data.source || 'uniguru_fallback',
            raw: fallbackResponse.data
          };
        }
      } catch (fallbackError) {
        console.error(`❌ UniGuru service call failed: ${fallbackError.message}`);
      }
    }

    // Graceful fallback response when UniGuru is offline
    return {
      answer: `[UniGuru Service Unavailable] Managed fallback output for query: "${query.substring(0, 50)}..."`,
      decision: 'fallback',
      confidence: 0.0,
      source: 'offline_fallback'
    };
  }

  /**
   * Admin Chatbot Assistant interface
   */
  async chat(message, sessionId = null, extraContext = {}) {
    return await this.ask(message, {
      sessionId,
      domain: 'Admin Chatbot',
      context: extraContext
    });
  }

  /**
   * Submission and Code Analysis
   */
  async analyzeSubmission(taskTitle, taskDesc, submissionNotes, repoUrl = '') {
    const prompt = `Review submission for task: "${taskTitle}".
Description: ${taskDesc}.
Submission Notes: ${submissionNotes}.
Repository URL: ${repoUrl}.
Evaluate completion score (0-100), code quality score (0-100), key strengths, missing requirements, and recommendations.`;

    const result = await this.ask(prompt, { domain: 'Code & Task Evaluation' });
    return result.answer;
  }

  /**
   * OCR Analysis
   */
  async analyzeOCR(extractedText, metadata = {}) {
    const prompt = `Analyze and summarize OCR extracted text:
"${extractedText.substring(0, 2000)}"
Extract key metrics, anomalies, and structural details.`;

    const result = await this.ask(prompt, { domain: 'OCR Analytics', context: metadata });
    return result.answer;
  }

  /**
   * Screenshot & Activity Monitoring Analysis
   */
  async analyzeScreenshot(screenshotSummary = '', activityContext = {}) {
    const prompt = `Analyze employee desktop activity context:
Summary: ${screenshotSummary}
Context: ${JSON.stringify(activityContext)}
Determine activity level (Productive, Idle, Flagged) and summary.`;

    const result = await this.ask(prompt, { domain: 'Employee Activity Monitoring' });
    return result.answer;
  }

  /**
   * Workflow AI Insights
   */
  async generateInsights(insightType, dataPayload = {}) {
    const prompt = `Generate insights for ${insightType}.
Data context: ${JSON.stringify(dataPayload).substring(0, 1500)}`;

    const result = await this.ask(prompt, { domain: 'Workflow Analytics' });
    return result.answer;
  }
}

module.exports = new UniGuruAIService();
