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
  Loader2
} from 'lucide-react';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import axios from 'axios';
import { API_URL } from '@/lib/api';

export function AIInsightsPanel({ employee }) {
  const [aiStats, setAiStats] = useState(null);
  const [aiServiceStatus, setAiServiceStatus] = useState(null);
  const [timeRange, setTimeRange] = useState('7days');
  const [loading, setLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (employee) {
      fetchAIInsights();
      testAIService();
    }
  }, [employee, timeRange]);

  const fetchAIInsights = async () => {
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
          employeeId: employee._id,
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
