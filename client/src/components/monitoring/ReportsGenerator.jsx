import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  FileText,
  Download,
  Calendar as CalendarIcon,
  TrendingUp,
  Activity,
  Clock,
  AlertTriangle,
  Camera,
  BarChart3,
  PieChart,
  FileSpreadsheet,
  Mail,
  User as UserIcon,
  Search,
  Check,
  RefreshCw,
  Printer
} from 'lucide-react';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export function ReportsGenerator({ employee: propEmployee, employees = [], onSelectEmployee }) {
  // Employee selection states
  const [internalEmployees, setInternalEmployees] = useState(employees);
  const [selectedEmp, setSelectedEmp] = useState(propEmployee || employees[0] || null);
  const [employeeSearch, setEmployeeSearch] = useState('');

  // Date and report config
  const [reportData, setReportData] = useState(null);
  const [startDate, setStartDate] = useState(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState(new Date());
  const [reportType, setReportType] = useState('summary');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  // Sync incoming employees prop
  useEffect(() => {
    if (employees && employees.length > 0) {
      setInternalEmployees(employees);
    } else {
      fetchFallbackEmployees();
    }
  }, [employees]);

  // Sync selected employee when propEmployee changes
  useEffect(() => {
    if (propEmployee) {
      setSelectedEmp(propEmployee);
    } else if (!selectedEmp && internalEmployees.length > 0) {
      setSelectedEmp(internalEmployees[0]);
    }
  }, [propEmployee, internalEmployees]);

  // Fallback fetch if employees prop was not provided
  const fetchFallbackEmployees = async () => {
    try {
      const token = localStorage.getItem('WorkflowToken') || localStorage.getItem('token');
      const branch = localStorage.getItem('selectedBranch') || localStorage.getItem('branch');
      const response = await axios.get(`${API_URL}/monitoring/team-summary?statusTab=all`, {
        headers: {
          'x-auth-token': token,
          Authorization: `Bearer ${token}`,
          ...(branch && branch !== 'all' ? { 'x-branch': branch } : {})
        }
      });
      if (response.data && response.data.employees) {
        setInternalEmployees(response.data.employees);
        if (!selectedEmp && response.data.employees.length > 0) {
          setSelectedEmp(response.data.employees[0]);
        }
      }
    } catch (err) {
      console.warn('Fallback employee list fetch failed:', err);
    }
  };

  const activeEmployee = selectedEmp || propEmployee || internalEmployees[0];
  const empId = activeEmployee?._id || activeEmployee?.employeeId;

  // Re-generate report data when active employee or dates change
  useEffect(() => {
    if (empId) {
      generateReport();
    }
  }, [empId, startDate, endDate]);

  const generateReport = async () => {
    if (!empId) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('WorkflowToken') || localStorage.getItem('token');
      const branch = localStorage.getItem('selectedBranch') || localStorage.getItem('branch');
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');

      const response = await axios.get(
        `${API_URL}/monitoring/reports/${empId}?startDate=${startStr}&endDate=${endStr}`,
        {
          headers: {
            'x-auth-token': token,
            Authorization: `Bearer ${token}`,
            ...(branch && branch !== 'all' ? { 'x-branch': branch } : {})
          }
        }
      );

      if (response.data) {
        setReportData(response.data);
      }
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: 'Error Fetching Report',
        description: 'Failed to retrieve telemetry report for selected employee.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEmployee = (emp) => {
    setSelectedEmp(emp);
    if (onSelectEmployee) {
      onSelectEmployee(emp);
    }
  };

  const setQuickDateRange = (range) => {
    const now = new Date();
    switch (range) {
      case 'today':
        setStartDate(now);
        setEndDate(now);
        break;
      case 'yesterday':
        const yesterday = subDays(now, 1);
        setStartDate(yesterday);
        setEndDate(yesterday);
        break;
      case 'week':
        setStartDate(startOfWeek(now, { weekStartsOn: 1 }));
        setEndDate(endOfWeek(now, { weekStartsOn: 1 }));
        break;
      case 'month':
        setStartDate(startOfMonth(now));
        setEndDate(endOfMonth(now));
        break;
      case 'last7days':
        setStartDate(subDays(now, 7));
        setEndDate(now);
        break;
      case 'last30days':
        setStartDate(subDays(now, 30));
        setEndDate(now);
        break;
    }
  };

  // Filtered employees for dropdown
  const filteredEmployees = useMemo(() => {
    if (!employeeSearch.trim()) return internalEmployees;
    const q = employeeSearch.toLowerCase().trim();
    return internalEmployees.filter(emp => {
      const name = (emp.name || '').toLowerCase();
      const email = (emp.email || '').toLowerCase();
      const dept = typeof emp.department === 'object' ? (emp.department?.name || '') : (emp.department || '');
      return name.includes(q) || email.includes(q) || dept.toLowerCase().includes(q);
    });
  }, [internalEmployees, employeeSearch]);

  // Calculate true average productivity based strictly on days where activities occurred
  const workedDaysList = useMemo(() => {
    return (reportData?.dailyMetrics || []).filter(d => (d.totalActivities > 0 || d.activeHours > 0) && d.avgProductivityScore > 0);
  }, [reportData?.dailyMetrics]);

  const avgProductivityWorkedDays = useMemo(() => {
    if (workedDaysList.length === 0) return 0;
    const sum = workedDaysList.reduce((acc, d) => acc + (d.avgProductivityScore || 0), 0);
    return Math.round(sum / workedDaysList.length);
  }, [workedDaysList]);

  // Export to proper Excel CSV with UTF-8 BOM
  const exportToExcelCSV = async () => {
    if (!activeEmployee) {
      toast({ title: 'Select Employee', description: 'Please select an employee to generate report', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    try {
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');
      const empName = activeEmployee.name || 'Employee';
      const deptName = typeof activeEmployee.department === 'object' ? (activeEmployee.department?.name || 'General') : (activeEmployee.department || 'General');

      let csv = '';
      csv += 'NIYANTRAN WORKFLOW - EMPLOYEE PERFORMANCE REPORT\n';
      csv += `Employee Name,${empName}\n`;
      csv += `Email,${activeEmployee.email || 'N/A'}\n`;
      csv += `Department,${deptName}\n`;
      csv += `Status,${activeEmployee.stillExist === 0 ? 'Exited' : 'Active'}\n`;
      csv += `Date Range,${startStr} to ${endStr}\n`;
      csv += `Report Type,${reportType.toUpperCase()}\n`;
      csv += `Generated On,${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}\n\n`;

      const totalActivities = reportData?.dailyMetrics?.reduce((sum, d) => sum + (d.totalActivities || 0), 0) || 0;
      const avgScore = avgProductivityWorkedDays;
      const totalScreenshots = reportData?.screenshots?.total || 0;
      const flaggedScreenshots = reportData?.screenshots?.flagged || 0;
      const totalAlerts = reportData?.alertStats?.reduce((sum, s) => sum + (s.totalCount || 0), 0) || 0;

      csv += 'EXECUTIVE KPI SUMMARY\n';
      csv += 'Total Activities,Average Productivity Score (%),Total Screenshots,Flagged Screenshots,Total Alerts Triggered\n';
      csv += `${totalActivities},${avgScore}%,${totalScreenshots},${flaggedScreenshots},${totalAlerts}\n\n`;

      csv += 'DAILY PERFORMANCE BREAKDOWN\n';
      csv += 'Date,Total Activities,Productivity Score (%),Active Hours (h),Total Keystrokes,Mouse Activity (%),Efficiency Rating\n';

      if (reportData?.dailyMetrics && reportData.dailyMetrics.length > 0) {
        reportData.dailyMetrics.forEach(day => {
          let eff = 'Low Efficiency';
          if (day.avgProductivityScore >= 75) eff = 'High Efficiency';
          else if (day.avgProductivityScore >= 50) eff = 'Moderate Efficiency';

          csv += `"${day.date}",${day.totalActivities},${day.avgProductivityScore}%,${day.activeHours}h,${day.totalKeystroke || 0},${day.avgMouseActivity || 0}%,${eff}\n`;
        });
      } else {
        csv += 'No daily activity logs recorded for this period\n';
      }

      if (reportData?.alertStats && reportData.alertStats.length > 0) {
        csv += '\nALERTS SUMMARY BY TYPE\n';
        csv += 'Alert Category,Occurrences\n';
        reportData.alertStats.forEach(stat => {
          csv += `"${stat._id}",${stat.totalCount}\n`;
        });
      }

      if (reportData?.screenshots?.byTrigger) {
        csv += '\nSCREENSHOT TRIGGER BREAKDOWN\n';
        csv += 'Trigger Type,Count\n';
        Object.entries(reportData.screenshots.byTrigger).forEach(([trigger, count]) => {
          csv += `"${trigger}",${count}\n`;
        });
      }

      // Create download blob with BOM for standard Excel compatibility
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Report_${empName.replace(/\s+/g, '_')}_${startStr}_to_${endStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Report Downloaded',
        description: `Exported Excel CSV report for ${empName} successfully.`
      });

      // Also trigger backend CSV export in background
      try {
        const token = localStorage.getItem('WorkflowToken') || localStorage.getItem('token');
        axios.post(`${API_URL}/monitoring/export/csv/${empId}`, {
          startDate: startStr,
          endDate: endStr
        }, {
          headers: { 'x-auth-token': token, Authorization: `Bearer ${token}` }
        }).catch(() => {});
      } catch (e) {}

    } catch (err) {
      console.error('Failed to export CSV report:', err);
      toast({ title: 'Export Failed', description: 'Could not export report as CSV', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  // Export to PDF
  const exportToPDF = async () => {
    if (!activeEmployee) {
      toast({ title: 'Select Employee', description: 'Please select an employee first', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    try {
      const token = localStorage.getItem('WorkflowToken') || localStorage.getItem('token');
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');

      // Attempt server PDF generation
      try {
        const response = await axios.post(
          `${API_URL}/monitoring/report/pdf/${empId}`,
          { startDate: startStr, endDate: endStr },
          { headers: { 'x-auth-token': token, Authorization: `Bearer ${token}` } }
        );

        const filename = response.data?.report?.filename;
        if (filename) {
          // Direct Blob Download: Bypasses PWA Service Worker navigation interception and React Router
          const downloadEndpoint = `${API_URL}/monitoring/download/${filename}`;
          const fileRes = await axios.get(downloadEndpoint, {
            headers: { 'x-auth-token': token, Authorization: `Bearer ${token}` },
            responseType: 'blob'
          });

          const blob = new Blob([fileRes.data], { type: 'application/pdf' });
          const blobUrl = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);

          toast({
            title: 'PDF Report Downloaded',
            description: `Exported ${filename} successfully.`
          });
          return;
        }
      } catch (srvErr) {
        console.warn('Server PDF service failed, falling back to print dialog:', srvErr.message);
      }

      // Print Dialog Fallback (Save as PDF)
      toast({
        title: 'Opening Print / PDF View',
        description: 'Choose "Save as PDF" in your print destination.'
      });
      window.print();
    } catch (err) {
      console.error('Failed to export PDF:', err);
      toast({ title: 'Export Failed', description: 'Failed to generate PDF', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  // Export to Email
  const exportToEmail = () => {
    if (!activeEmployee) return;
    const empName = activeEmployee.name || 'Employee';
    const startStr = format(startDate, 'yyyy-MM-dd');
    const endStr = format(endDate, 'yyyy-MM-dd');
    const totalActs = reportData?.dailyMetrics?.reduce((s, d) => s + (d.totalActivities || 0), 0) || 0;
    const daysCount = reportData?.dailyMetrics?.length || 1;
    const avgScore = Math.round((reportData?.dailyMetrics?.reduce((s, d) => s + (d.avgProductivityScore || 0), 0) || 0) / daysCount);
    const totalAlerts = reportData?.alertStats?.reduce((s, a) => s + (a.totalCount || 0), 0) || 0;

    const subject = encodeURIComponent(`Niyantran Performance Report - ${empName} (${startStr} to ${endStr})`);
    const body = encodeURIComponent(
      `Hello,\n\nHere is the summary performance report for ${empName} (${startStr} to ${endStr}):\n\n• Total Activities: ${totalActs}\n• Average Productivity Score: ${avgScore}%\n• Total Alerts Triggered: ${totalAlerts}\n\nGenerated via Niyantran Workflow Monitoring System.`
    );
    window.location.href = `mailto:${activeEmployee.email || ''}?subject=${subject}&body=${body}`;
  };

  const getProductivityColor = (score) => {
    if (score >= 75) return 'text-emerald-500';
    if (score >= 50) return 'text-amber-500';
    return 'text-rose-500';
  };

  return (
    <div className="space-y-6">
      {/* =========================================================================
          REPORT CONTROLS CARD WITH INTEGRATED EMPLOYEE SELECTOR
         ========================================================================= */}
      <Card className="border border-border shadow-sm bg-card">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="flex items-center justify-between gap-2 text-base font-bold">
            <span className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Employee Monitoring Report Generator
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={generateReport}
              disabled={loading}
              className="text-xs h-8 flex items-center gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Data
            </Button>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {/* SECTION 1: PROMINENT EMPLOYEE SELECTOR (SOLVES "NOTHING TO SELECT EMPLOYEE") */}
          <div className="p-4 rounded-2xl bg-muted/40 border border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-11 w-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center font-black text-primary text-lg shadow-inner flex-shrink-0">
                {activeEmployee?.name ? activeEmployee.name.charAt(0).toUpperCase() : 'E'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-base text-foreground truncate">
                    {activeEmployee?.name || 'Select An Employee'}
                  </h3>
                  {activeEmployee?.stillExist === 0 ? (
                    <Badge variant="outline" className="text-[10px] text-rose-400 border-rose-500/30 bg-rose-500/10">
                      Exited
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                      Active
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {activeEmployee?.email || 'Choose employee from selector'} • {typeof activeEmployee?.department === 'object' ? activeEmployee.department?.name : activeEmployee?.department || 'General'}
                </p>
              </div>
            </div>

            {/* Switch Employee Select Dropdown */}
            <div className="w-full md:w-80 flex-shrink-0">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                Select / Switch Employee
              </label>
              <Select
                value={empId || ''}
                onValueChange={(val) => {
                  const found = internalEmployees.find(e => (e._id || e.employeeId) === val);
                  if (found) handleSelectEmployee(found);
                }}
              >
                <SelectTrigger className="w-full h-10 bg-background border-border rounded-xl text-xs font-semibold">
                  <SelectValue placeholder="Choose an employee..." />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {internalEmployees.length === 0 ? (
                    <div className="p-3 text-xs text-muted-foreground text-center">Loading employee list...</div>
                  ) : (
                    internalEmployees.map((emp) => (
                      <SelectItem key={emp._id || emp.employeeId} value={emp._id || emp.employeeId}>
                        <div className="flex items-center justify-between gap-3 w-full pr-2">
                          <span className="font-semibold text-xs">{emp.name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {emp.stillExist === 0 ? 'Exited' : (emp.department?.name || emp.department || 'Active')}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* SECTION 2: DATE RANGE & REPORT TYPE CONTROLS */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Date Range:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-40 justify-start text-left font-normal text-xs h-9 rounded-xl">
                    <CalendarIcon className="mr-2 h-3.5 w-3.5 text-primary" />
                    {format(startDate, 'MMM dd, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(d) => d && setStartDate(d)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <span className="text-xs text-muted-foreground font-semibold">to</span>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-40 justify-start text-left font-normal text-xs h-9 rounded-xl">
                    <CalendarIcon className="mr-2 h-3.5 w-3.5 text-primary" />
                    {format(endDate, 'MMM dd, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(d) => d && setEndDate(d)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Type:</span>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="w-40 h-9 rounded-xl text-xs">
                  <SelectValue placeholder="Report Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">Executive Summary</SelectItem>
                  <SelectItem value="detailed">Detailed Breakdown</SelectItem>
                  <SelectItem value="productivity">Productivity Focus</SelectItem>
                  <SelectItem value="alerts">Alerts & Violations</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quick Date Presets */}
          <div className="flex flex-wrap gap-2 pt-1">
            {[
              { label: 'Today', value: 'today' },
              { label: 'Yesterday', value: 'yesterday' },
              { label: 'This Week', value: 'week' },
              { label: 'This Month', value: 'month' },
              { label: 'Last 7 Days', value: 'last7days' },
              { label: 'Last 30 Days', value: 'last30days' }
            ].map((range) => (
              <Button
                key={range.value}
                variant="outline"
                size="sm"
                onClick={() => setQuickDateRange(range.value)}
                className="text-xs h-7 px-3 rounded-lg bg-muted/40 hover:bg-muted"
              >
                {range.label}
              </Button>
            ))}
          </div>

          {/* SECTION 3: PROPER REPORT DOWNLOAD & EXPORT CONTROLS */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">Export Formats:</span>
              
              {/* CSV / Excel Download */}
              <Button
                variant="default"
                size="sm"
                onClick={exportToExcelCSV}
                disabled={generating || loading || !activeEmployee}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 rounded-xl shadow-sm"
              >
                <FileSpreadsheet className="h-4 w-4 mr-1.5" />
                {generating ? 'Exporting...' : 'Download Excel (CSV)'}
              </Button>

              {/* PDF Download */}
              <Button
                variant="outline"
                size="sm"
                onClick={exportToPDF}
                disabled={generating || loading || !activeEmployee}
                className="font-bold text-xs h-9 rounded-xl"
              >
                <FileText className="h-4 w-4 mr-1.5 text-rose-500" />
                Download PDF
              </Button>

              {/* Email Report */}
              <Button
                variant="outline"
                size="sm"
                onClick={exportToEmail}
                disabled={generating || loading || !activeEmployee}
                className="font-bold text-xs h-9 rounded-xl"
              >
                <Mail className="h-4 w-4 mr-1.5 text-blue-500" />
                Email Report
              </Button>
            </div>

            <div className="text-xs text-muted-foreground font-medium">
              Period: {format(startDate, 'dd MMM yyyy')} - {format(endDate, 'dd MMM yyyy')}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="space-y-6">
          <Card className="p-8 text-center bg-card border-border animate-pulse">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary mb-3" />
            <p className="text-sm font-semibold text-foreground">Generating telemetry report for {activeEmployee?.name}...</p>
            <p className="text-xs text-muted-foreground mt-1">Aggregating daily activities, keystrokes, and security alerts</p>
          </Card>
        </div>
      ) : reportData ? (
        <>
          {/* =========================================================================
              REPORT SUMMARY BANNER
             ========================================================================= */}
          <Card className="border-border shadow-sm bg-card">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="flex items-center justify-between gap-2 text-base font-bold">
                <span className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Report Summary: {activeEmployee?.name}
                </span>
                <Badge variant="outline" className="text-xs font-semibold border-primary/30 text-primary bg-primary/10">
                  {format(startDate, 'MMM dd')} - {format(endDate, 'MMM dd, yyyy')}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center p-3 rounded-2xl bg-primary/5 border border-primary/10">
                  <Activity className="h-7 w-7 text-primary mx-auto mb-1.5" />
                  <p className="text-2xl font-black text-foreground">
                    {reportData.dailyMetrics?.reduce((sum, day) => sum + (day.totalActivities || 0), 0) || 0}
                  </p>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">Total Activities</p>
                </div>

                <div className="text-center p-3 rounded-2xl bg-accent/5 border border-accent/10">
                  <TrendingUp className="h-7 w-7 text-accent mx-auto mb-1.5" />
                  <p className={`text-2xl font-black ${getProductivityColor(avgProductivityWorkedDays)}`}>
                    {avgProductivityWorkedDays}%
                  </p>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">Avg Productivity</p>
                </div>

                <div className="text-center p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                  <Camera className="h-7 w-7 text-emerald-500 mx-auto mb-1.5" />
                  <p className="text-2xl font-black text-foreground">
                    {reportData.screenshots?.total || 0}
                  </p>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">
                    Screenshots {reportData.screenshots?.flagged > 0 ? `(${reportData.screenshots.flagged} flagged)` : ''}
                  </p>
                </div>

                <div className="text-center p-3 rounded-2xl bg-rose-500/5 border border-rose-500/10">
                  <AlertTriangle className="h-7 w-7 text-rose-500 mx-auto mb-1.5" />
                  <p className="text-2xl font-black text-foreground">
                    {reportData.alertStats?.reduce((sum, stat) => sum + (stat.totalCount || 0), 0) || 0}
                  </p>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">Total Alerts</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* =========================================================================
              DAILY PRODUCTIVITY TRENDS CHART
             ========================================================================= */}
          {reportData.dailyMetrics && reportData.dailyMetrics.length > 0 && (
            <Card className="border-border shadow-sm bg-card">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Daily Productivity & Active Hours Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData.dailyMetrics}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '12px'
                        }}
                      />
                      <Bar dataKey="avgProductivityScore" fill="hsl(var(--primary))" name="Productivity Score %" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="activeHours" fill="#10b981" name="Active Hours (h)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* =========================================================================
              ALERTS & SCREENSHOT STATS
             ========================================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Alert Breakdown */}
            <Card className="border-border shadow-sm bg-card">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <AlertTriangle className="h-5 w-5 text-primary" />
                  Security & Activity Alert Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {reportData.alertStats && reportData.alertStats.length > 0 ? (
                  <div className="space-y-4">
                    {reportData.alertStats.map((stat) => (
                      <div key={stat._id} className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs font-semibold">
                          <span className="text-foreground capitalize">{String(stat._id).replace(/_/g, ' ')}</span>
                          <span className="text-muted-foreground">{stat.totalCount} incidents</span>
                        </div>
                        <Progress
                          value={Math.min(100, (stat.totalCount / (reportData.alertStats.reduce((s, a) => s + a.totalCount, 0) || 1)) * 100)}
                          className="h-2"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No alert violations logged for this employee in the selected period.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Screenshot Summary */}
            <Card className="border-border shadow-sm bg-card">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Camera className="h-5 w-5 text-primary" />
                  Screenshot Capture Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="p-3 rounded-xl bg-muted/40 border border-border">
                    <p className="text-2xl font-black text-foreground">{reportData.screenshots?.total || 0}</p>
                    <p className="text-xs text-muted-foreground font-semibold mt-0.5">Total Captured</p>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <p className="text-2xl font-black text-rose-500">{reportData.screenshots?.flagged || 0}</p>
                    <p className="text-xs text-rose-400 font-semibold mt-0.5">Flagged Violations</p>
                  </div>
                </div>

                {reportData.screenshots?.byTrigger && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <p className="text-xs font-bold text-foreground uppercase tracking-wider">By Trigger Type:</p>
                    {Object.entries(reportData.screenshots.byTrigger).map(([trigger, count]) => (
                      <div key={trigger} className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground capitalize">{trigger.replace(/_/g, ' ')}</span>
                        <Badge variant="secondary" className="text-[10px] font-bold">{count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* =========================================================================
              DETAILED DAILY BREAKDOWN TABLE
             ========================================================================= */}
          {reportData.dailyMetrics && reportData.dailyMetrics.length > 0 && (
            <Card className="border-border shadow-sm bg-card">
              <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Clock className="h-5 w-5 text-primary" />
                  Comprehensive Day-by-Day Activity Logs
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={exportToExcelCSV}
                  className="text-xs h-8 flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  Save CSV
                </Button>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 uppercase font-semibold text-muted-foreground border-b border-border">
                    <tr>
                      <th className="p-3.5">Date</th>
                      <th className="p-3.5 text-center">Activities Logged</th>
                      <th className="p-3.5 text-center">Productivity Score</th>
                      <th className="p-3.5 text-center">Active Hours</th>
                      <th className="p-3.5 text-center">Keystrokes</th>
                      <th className="p-3.5 text-center">Mouse Activity</th>
                      <th className="p-3.5 text-right">Efficiency Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {reportData.dailyMetrics.map((day) => {
                      let eff = 'Low Efficiency';
                      let effColor = 'text-rose-400 bg-rose-500/10 border-rose-500/30';
                      if (day.avgProductivityScore >= 75) {
                        eff = 'High Efficiency';
                        effColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
                      } else if (day.avgProductivityScore >= 50) {
                        eff = 'Moderate Efficiency';
                        effColor = 'text-amber-400 bg-amber-500/10 border-amber-500/30';
                      }

                      return (
                        <tr key={day.date} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3.5 font-bold text-foreground">{day.date}</td>
                          <td className="p-3.5 text-center text-muted-foreground font-semibold">{day.totalActivities}</td>
                          <td className={`p-3.5 text-center font-bold ${getProductivityColor(day.avgProductivityScore)}`}>
                            {day.avgProductivityScore}%
                          </td>
                          <td className="p-3.5 text-center text-foreground font-bold">{day.activeHours}h</td>
                          <td className="p-3.5 text-center text-muted-foreground font-medium">
                            {(day.totalKeystroke || 0).toLocaleString()}
                          </td>
                          <td className="p-3.5 text-center text-muted-foreground font-medium">{day.avgMouseActivity || 0}%</td>
                          <td className="p-3.5 text-right">
                            <Badge variant="outline" className={`text-[10px] font-bold ${effColor}`}>
                              {eff}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card className="p-12 text-center bg-card border-border">
          <p className="text-sm text-muted-foreground">Select an employee and date range above to generate performance report.</p>
        </Card>
      )}
    </div>
  );
}
