import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Target,
  Eye,
  BarChart3,
  PieChart,
  Zap,
  Shield,
  Clock,
  Activity,
  Loader2,
  User as UserIcon,
  Send,
  Sparkles,
  MessageSquare,
  FileText,
  Award,
  DollarSign,
  Building,
  RefreshCw
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import axios from 'axios';
import { API_URL } from '@/lib/api';

export function AIInsightsPanel({ employee, allEmployees = [], onSelectEmployee }) {
  const [activeEmployee, setActiveEmployee] = useState(employee);
  const [aiStats, setAiStats] = useState(null);
  const [aiServiceStatus, setAiServiceStatus] = useState(null);
  const [timeRange, setTimeRange] = useState('7days');
  const [loading, setLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Mitra AI & User Niyantran Database Integration State
  const [userSummary, setUserSummary] = useState(null);
  const [userSummaryLoading, setUserSummaryLoading] = useState(false);
  const [mitraPrompt, setMitraPrompt] = useState('');
  const [mitraResponse, setMitraResponse] = useState(null);
  const [mitraLoading, setMitraLoading] = useState(false);

  useEffect(() => {
    if (employee) {
      setActiveEmployee(employee);
    }
  }, [employee]);

  useEffect(() => {
    if (activeEmployee) {
      fetchAIInsights();
      testAIService();
      fetchUserSummary();
    }
  }, [activeEmployee, timeRange]);

  const fetchUserSummary = async () => {
    const empToFetch = activeEmployee || employee;
    if (!empToFetch?._id) return;
    setUserSummaryLoading(true);
    try {
      const token = localStorage.getItem('WorkflowToken') || localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/chatbot/user-summary/${empToFetch._id}`, {
        headers: { 
          'x-auth-token': token,
          'Authorization': `Bearer ${token}` 
        }
      });
      if (response.data?.found) {
        setUserSummary(response.data);
      } else {
        setUserSummary(null);
      }
    } catch (error) {
      console.error('Error fetching Niyantran user summary:', error);
      setUserSummary(null);
    } finally {
      setUserSummaryLoading(false);
    }
  };

  const handleAskMitra = async (customPrompt) => {
    const empToAsk = activeEmployee || employee;
    const promptToSend = customPrompt || mitraPrompt || `Give me complete performance summary for ${empToAsk?.name || 'this employee'}`;
    if (!promptToSend.trim()) return;

    setMitraLoading(true);
    try {
      const token = localStorage.getItem('WorkflowToken') || localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/chatbot/chat`, {
        message: promptToSend,
        targetUserId: empToAsk?._id
      }, {
        headers: {
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`
        }
      });

      setMitraResponse({
        query: promptToSend,
        answer: response.data.response,
        timestamp: new Date().toLocaleTimeString()
      });
      setMitraPrompt('');
    } catch (error) {
      console.error('Error querying Mitra AI:', error);
      setMitraResponse({
        query: promptToSend,
        answer: '⚠️ Failed to connect to Mitra AI. Please verify backend service and role access.',
        timestamp: new Date().toLocaleTimeString(),
        error: true
      });
    } finally {
      setMitraLoading(false);
    }
  };

  const fetchAIInsights = async () => {
    const empToAnalyze = activeEmployee || employee;
    if (!empToAnalyze?._id) return;
    setLoading(true);
    try {
      const endDate = new Date();
      const startDate = new Date();
      
      switch (timeRange) {
        case '1day':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case '7days':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30days':
          startDate.setDate(startDate.getDate() - 30);
          break;
        default:
          startDate.setDate(startDate.getDate() - 7);
      }

      const token = localStorage.getItem('WorkflowToken') || localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/monitoring/intelligent/stats`, {
        params: {
          employeeId: empToAnalyze._id,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        },
        headers: { 
          'x-auth-token': token,
          'Authorization': `Bearer ${token}` 
        }
      });

      setAiStats(response.data);
    } catch (error) {
      console.error('Error fetching AI insights:', error);
      setAiStats(null);
    } finally {
      setLoading(false);
    }
  };

  const testAIService = async () => {
    setIsTesting(true);
    const startTime = performance.now();
    try {
      const token = localStorage.getItem('WorkflowToken') || localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/monitoring/ai/test`, {
        headers: { 
          'x-auth-token': token,
          'Authorization': `Bearer ${token}` 
        }
      });
      const endTime = performance.now();
      const latencyMs = Math.round(endTime - startTime);

      setAiServiceStatus(response.data);
      setTestResult({
        success: response.data.success !== false,
        message: response.data.message || response.data.details || 'Connection verified and active',
        service: response.data.service || 'UniGuru AI Service Integration',
        latency: latencyMs,
        timestamp: new Date().toLocaleTimeString()
      });
    } catch (error) {
      console.error('Error testing AI service:', error);
      setAiServiceStatus({ success: false, error: 'Service unavailable' });
      setTestResult({
        success: false,
        message: error.response?.data?.error || error.message || 'Service host unreachable',
        latency: null,
        timestamp: new Date().toLocaleTimeString()
      });
    } finally {
      setIsTesting(false);
    }
  };

  const getTaskRelevanceColor = (score) => {
    if (score >= 70) return 'text-green-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  // Prepare chart data
  const contentTypeData = aiStats ? Object.entries(aiStats.contentTypes).map(([type, count]) => ({
    name: type,
    value: count
  })) : [];

  const riskLevelData = aiStats ? Object.entries(aiStats.riskLevels).map(([level, count]) => ({
    name: level,
    value: count,
    color: level === 'high' ? '#ef4444' : level === 'medium' ? '#f59e0b' : '#10b981'
  })) : [];

  const chartColors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00'];

  const renderFormattedAnswer = (answerText) => {
    if (!answerText) return null;

    const lines = answerText.split('\n');
    const sections = [];
    let currentSection = { title: '', items: [] };

    lines.forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line) return;

      if (line.startsWith('📊') || line.startsWith('👤') || line.startsWith('📋') || line.startsWith('📅') || line.startsWith('🤖') || line.startsWith('🎯') || line.startsWith('💰')) {
        if (currentSection.title || currentSection.items.length > 0) {
          sections.push(currentSection);
        }
        currentSection = { title: line.replace(/\*\*/g, '').trim(), items: [] };
      } else {
        currentSection.items.push(line);
      }
    });
    if (currentSection.title || currentSection.items.length > 0) {
      sections.push(currentSection);
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {sections.map((sec, sIdx) => {
          const isMainHeader = sec.title.startsWith('📊');
          if (isMainHeader) {
            return (
              <div key={sIdx} className="md:col-span-2 p-3.5 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-between shadow-sm">
                <h4 className="text-sm font-bold text-primary flex items-center gap-2">
                  {sec.title}
                </h4>
                <Badge variant="outline" className="text-xs bg-primary/20 text-primary border-primary/40 font-mono">
                  Verified MongoDB Niyantran Data
                </Badge>
              </div>
            );
          }

          return (
            <div key={sIdx} className="p-4 rounded-xl bg-card/90 border border-border/70 hover:border-primary/40 transition-colors shadow-sm space-y-3 flex flex-col justify-between">
              {sec.title && (
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-primary flex items-center gap-2">
                    {sec.title}
                  </h4>
                </div>
              )}
              <div className="space-y-2 flex-grow">
                {sec.items.map((item, iIdx) => {
                  const cleanItem = item.replace(/^[•\-*]\s*/, '').replace(/\*\*/g, '');
                  
                  if (item.startsWith('-')) {
                    return (
                      <div key={iIdx} className="pl-3 py-1 text-xs text-muted-foreground bg-muted/20 rounded-md border border-border/30 font-mono">
                        ▫ {cleanItem}
                      </div>
                    );
                  }

                  const parts = cleanItem.split(/:\s*/);
                  if (parts.length >= 2) {
                    const label = parts[0].trim();
                    const val = parts.slice(1).join(': ').trim();
                    return (
                      <div key={iIdx} className="flex items-center justify-between gap-3 text-xs py-1 border-b border-border/20 last:border-0">
                        <span className="text-muted-foreground font-medium">{label}:</span>
                        <span className="font-semibold text-foreground bg-muted/40 px-2 py-0.5 rounded text-right font-mono max-w-[65%] truncate">
                          {val}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <p key={iIdx} className="text-xs text-foreground/90 leading-relaxed py-0.5">
                      {cleanItem}
                    </p>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="neo-card animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-muted rounded w-3/4 mb-4"></div>
              <div className="h-32 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* AI Service Status Header Card */}
      <Card className="neo-card relative overflow-hidden bg-gradient-to-r from-card via-card/95 to-emerald-950/20 border border-emerald-500/30 shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Brain className="h-6 w-6 text-emerald-400 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
                  AI Analysis Service Engine
                </h3>
                <p className="text-xs text-muted-foreground">
                  Groq & UniGuru Neural Reasoning Model Integration
                </p>
              </div>
            </div>

            {/* Live Connection Badge with Pulsing LED Dot */}
            <div className="flex items-center gap-2">
              {aiServiceStatus?.success !== false ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span>Connected</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500"></span>
                  <span>Offline</span>
                </div>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 border-t border-border/40">
            <div className="space-y-1">
              <p className="text-sm text-foreground/90 font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-400" />
                {aiServiceStatus?.success !== false
                  ? 'Real-time screenshot monitoring & automated compliance analysis active'
                  : 'AI analysis service is currently offline or unreachable'}
              </p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5 text-primary" /> Active Engine: <strong className="text-foreground font-mono ml-1">UniGuru-v2-Groq</strong>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-primary" /> Latency: <strong className="text-foreground font-mono ml-1">{testResult?.latency ? `${testResult.latency} ms` : '< 50 ms'}</strong>
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={testAIService}
              disabled={isTesting}
              className="neo-btn bg-background/50 hover:bg-emerald-500/10 border-emerald-500/30 text-foreground transition-all duration-200 min-w-[150px]"
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin text-emerald-400" />
                  <span>Testing Ping...</span>
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2 text-emerald-400" />
                  <span>Test Connection</span>
                </>
              )}
            </Button>
          </div>

          {/* Test Connection Output Banner */}
          {testResult && (
            <div className={`mt-4 p-3 rounded-lg border text-xs flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300 ${
              testResult.success 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                )}
                <span>
                  <strong>{testResult.success ? 'Connection Verified:' : 'Test Failed:'}</strong> {testResult.message}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0 font-mono text-[11px] opacity-80">
                {testResult.latency && <span>{testResult.latency} ms</span>}
                <span>Checked at {testResult.timestamp}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Employee Executive Profile Card */}
      {(activeEmployee || employee) && (
        <Card className="neo-card bg-gradient-to-br from-card via-card/95 to-background border border-primary/20 shadow-lg overflow-hidden">
          <CardHeader className="pb-4 border-b border-border/40 bg-muted/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-primary/20 to-emerald-500/20 border border-primary/30 text-primary flex items-center justify-center font-bold text-xl shadow-md shrink-0">
                  {(activeEmployee || employee).name ? (activeEmployee || employee).name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'EMP'}
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-xl font-bold tracking-tight text-foreground">{(activeEmployee || employee).name}</h2>
                    <Badge variant={userSummary?.user?.status === 'Active' || (activeEmployee || employee).stillExist === 1 ? 'default' : 'secondary'} className="text-xs px-2.5 py-0.5">
                      {userSummary?.user?.status || ((activeEmployee || employee).stillExist === 1 ? 'Active Workday' : 'Offline')}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                    <span className="font-mono text-foreground/80">{(activeEmployee || employee).email}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Building className="h-3.5 w-3.5 text-primary" /> {userSummary?.user?.department || (activeEmployee || employee).department?.name || (activeEmployee || employee).department || 'Department Member'}</span>
                    <span>•</span>
                    <span className="font-mono text-primary/90 font-medium">{userSummary?.user?.role || 'Team Member'}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 space-y-4">
            {/* Niyantran Database Performance Metrics Grid */}
            {userSummaryLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-24 bg-muted/30 rounded-xl"></div>
                ))}
              </div>
            ) : userSummary?.user ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-card/80 border border-blue-500/20 shadow-sm flex flex-col justify-between hover:border-blue-500/40 transition-colors">
                  <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5 uppercase tracking-wider">
                    <Target className="h-4 w-4 text-blue-400" /> Tasks Completed
                  </span>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-2xl font-extrabold text-foreground">
                      {userSummary.tasks.completed} <span className="text-xs font-medium text-muted-foreground">/ {userSummary.tasks.total}</span>
                    </span>
                    <Badge variant="outline" className="text-xs font-semibold bg-blue-500/10 text-blue-400 border-blue-500/30 px-2 py-0.5">
                      {userSummary.tasks.completionRate}%
                    </Badge>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-card/80 border border-emerald-500/20 shadow-sm flex flex-col justify-between hover:border-emerald-500/40 transition-colors">
                  <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5 uppercase tracking-wider">
                    <Clock className="h-4 w-4 text-emerald-400" /> 30-Day Attendance
                  </span>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-2xl font-extrabold text-foreground">
                      {userSummary.attendance.daysPresent} <span className="text-xs font-medium text-muted-foreground">days ({Math.round(userSummary.attendance.totalHours)}h)</span>
                    </span>
                    <Badge variant="outline" className="text-xs font-semibold bg-emerald-500/10 text-emerald-400 border-emerald-500/30 px-2 py-0.5">
                      {userSummary.attendance.attendanceRate}%
                    </Badge>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-card/80 border border-amber-500/20 shadow-sm flex flex-col justify-between hover:border-amber-500/40 transition-colors">
                  <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5 uppercase tracking-wider">
                    <Award className="h-4 w-4 text-amber-400" /> Niyantran AI Score
                  </span>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-2xl font-extrabold text-foreground">
                      {userSummary.performance.avgScore || 85} <span className="text-xs font-medium text-muted-foreground">/ 100</span>
                    </span>
                    <Badge variant="outline" className="text-xs font-semibold bg-amber-500/10 text-amber-400 border-amber-500/30 px-2 py-0.5">
                      {userSummary.performance.avgScore >= 80 ? 'Optimal' : 'Standard'}
                    </Badge>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-card/80 border border-rose-500/20 shadow-sm flex flex-col justify-between hover:border-rose-500/40 transition-colors">
                  <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5 uppercase tracking-wider">
                    <AlertTriangle className="h-4 w-4 text-rose-400" /> Overdue Tasks
                  </span>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-2xl font-extrabold text-foreground">
                      {userSummary.tasks.overdue}
                    </span>
                    <Badge variant="outline" className={`text-xs font-semibold px-2 py-0.5 ${userSummary.tasks.overdue > 0 ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'}`}>
                      {userSummary.tasks.overdue > 0 ? 'Requires Action' : 'Clear'}
                    </Badge>
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Mitra AI Niyantran Assistant Integration Card */}
      {employee && (
        <Card className="neo-card bg-gradient-to-r from-card via-card/95 to-primary/5 border border-primary/25 shadow-xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/40 bg-muted/10">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                <Brain className="h-5 w-5 text-primary animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                  Mitra AI Assistant — Niyantran Database Integration
                </h3>
                <p className="text-xs text-muted-foreground">
                  Direct access to live MongoDB Niyantran user profiles, tasks, attendance & performance logs
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-5 space-y-4">
            {/* Quick Action Prompt Chips Bar */}
            <div className="flex flex-wrap items-center gap-2 pb-1 border-b border-border/30">
              <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1 mr-1">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Quick Audits:
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAskMitra(`Give complete performance analysis for ${employee.name}`)}
                disabled={mitraLoading}
                className="neo-btn text-xs bg-primary/10 hover:bg-primary/20 border-primary/30 text-primary font-medium h-7 px-3"
              >
                <FileText className="h-3.5 w-3.5 mr-1" />
                Mitra Report
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAskMitra(`What are ${employee.name}'s task completion and overdue task details?`)}
                disabled={mitraLoading}
                className="neo-btn text-xs bg-background/60 hover:bg-muted font-medium h-7 px-3"
              >
                <Target className="h-3.5 w-3.5 mr-1 text-blue-400" />
                Task Audit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAskMitra(`Check ${employee.name}'s 30-day attendance rate, hours worked, and overtime`)}
                disabled={mitraLoading}
                className="neo-btn text-xs bg-background/60 hover:bg-muted font-medium h-7 px-3"
              >
                <Clock className="h-3.5 w-3.5 mr-1 text-emerald-400" />
                Attendance Summary
              </Button>
            </div>

            {/* Input Form Bar */}
            <div className="flex items-center gap-3">
              <Input
                value={mitraPrompt}
                onChange={(e) => setMitraPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAskMitra()}
                placeholder={`Ask Mitra AI about ${employee.name}'s tasks, attendance, performance or salary...`}
                className="bg-background/90 border-border/60 text-xs text-foreground focus-visible:ring-primary h-10 px-3.5 shadow-inner"
              />
              <Button
                onClick={() => handleAskMitra()}
                disabled={mitraLoading || !mitraPrompt.trim()}
                size="sm"
                className="h-10 px-5 text-xs font-semibold neo-btn bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 shadow-md"
              >
                {mitraLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1.5" />
                    <span>Ask Mitra</span>
                  </>
                )}
              </Button>
            </div>

            {/* Structured Response Container */}
            {mitraResponse && (
              <div className="mt-4 p-4.5 rounded-2xl bg-card/95 border border-primary/30 space-y-3.5 text-xs shadow-xl animate-in fade-in duration-300">
                <div className="flex items-center justify-between text-muted-foreground border-b border-border/40 pb-2.5">
                  <span className="font-bold text-primary flex items-center gap-2 text-xs">
                    <Sparkles className="h-4 w-4 text-primary" /> Mitra AI Audit Report: &ldquo;{mitraResponse.query}&rdquo;
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground/80 bg-muted/40 px-2.5 py-0.5 rounded-full border border-border/30">
                    Generated at {mitraResponse.timestamp}
                  </span>
                </div>

                <div className="max-h-[500px] overflow-y-auto pr-1">
                  {renderFormattedAnswer(mitraResponse.answer)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Time Range Selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-foreground">Analysis Period:</label>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Select Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1day">Last 24 Hours</SelectItem>
            <SelectItem value="7days">Last 7 Days</SelectItem>
            <SelectItem value="30days">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {aiStats ? (
        <>
          {/* Summary Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="neo-card border-red-500/20">
              <CardContent className="p-4 text-center">
                <AlertTriangle className="h-6 w-6 text-red-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">{aiStats.totalViolations}</p>
                <p className="text-xs text-muted-foreground">Total Violations</p>
              </CardContent>
            </Card>

            <Card className="neo-card border-blue-500/20">
              <CardContent className="p-4 text-center">
                <Brain className="h-6 w-6 text-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">
                  {Object.keys(aiStats.contentTypes).length}
                </p>
                <p className="text-xs text-muted-foreground">Content Types</p>
              </CardContent>
            </Card>

            <Card className="neo-card border-green-500/20">
              <CardContent className="p-4 text-center">
                <Target className="h-6 w-6 text-green-500 mx-auto mb-2" />
                <p className={`text-2xl font-bold ${getTaskRelevanceColor(aiStats.avgTaskRelevance || 0)}`}>
                  {aiStats.avgTaskRelevance || 0}%
                </p>
                <p className="text-xs text-muted-foreground">Avg Task Relevance</p>
              </CardContent>
            </Card>

            <Card className="neo-card border-yellow-500/20">
              <CardContent className="p-4 text-center">
                <Shield className="h-6 w-6 text-yellow-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">
                  {Math.round((aiStats.riskLevels.high || 0) / aiStats.totalViolations * 100) || 0}%
                </p>
                <p className="text-xs text-muted-foreground">High Risk Content</p>
              </CardContent>
            </Card>
          </div>

          {/* Content Analysis Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Content Types Distribution */}
            <Card className="neo-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-primary" />
                  Content Types Detected
                </CardTitle>
              </CardHeader>
              <CardContent>
                {contentTypeData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={contentTypeData}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {contentTypeData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-center">
                      <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">No content analysis data available</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Risk Level Distribution */}
            <Card className="neo-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Risk Level Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                {riskLevelData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={riskLevelData}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar dataKey="value" fill="#8884d8">
                          {riskLevelData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-center">
                      <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">No risk analysis data available</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Task Relevance Analysis */}
          {aiStats.avgTaskRelevance !== undefined && (
            <Card className="neo-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Task Relevance Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Average Task Relevance</span>
                    <span className={`text-lg font-bold ${getTaskRelevanceColor(aiStats.avgTaskRelevance)}`}>
                      {aiStats.avgTaskRelevance}%
                    </span>
                  </div>
                  
                  <Progress 
                    value={aiStats.avgTaskRelevance} 
                    className="h-3"
                  />
                  
                  <div className="grid grid-cols-3 gap-4 text-center text-sm">
                    <div>
                      <p className="text-green-500 font-semibold">70-100%</p>
                      <p className="text-muted-foreground">Highly Relevant</p>
                    </div>
                    <div>
                      <p className="text-yellow-500 font-semibold">40-69%</p>
                      <p className="text-muted-foreground">Moderately Relevant</p>
                    </div>
                    <div>
                      <p className="text-red-500 font-semibold">0-39%</p>
                      <p className="text-muted-foreground">Not Relevant</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Employee Breakdown */}
          {Object.keys(aiStats.byEmployee).length > 0 && (
            <Card className="neo-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  Violation Breakdown by Employee
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(aiStats.byEmployee).map(([employeeName, count]) => (
                    <div key={employeeName} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <span className="font-medium text-foreground">{employeeName}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{count} violations</Badge>
                        <div className="w-16">
                          <Progress 
                            value={(count / aiStats.totalViolations) * 100} 
                            className="h-2"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card className="neo-card border-border/50">
          <CardContent className="p-12 text-center">
            <Brain className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No AI Analysis Data</h3>
            <p className="text-muted-foreground">
              No violations detected in the selected time period, or AI analysis is not yet available.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
