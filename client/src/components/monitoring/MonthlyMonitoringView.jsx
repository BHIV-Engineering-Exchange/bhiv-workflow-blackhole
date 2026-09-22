import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Calendar as CalendarIcon,
  Clock,
  Clock3,
  Keyboard,
  Mouse,
  TrendingUp,
  Zap,
  Users,
  Eye,
  Search,
  ChevronRight,
  X
} from 'lucide-react';
import axios from 'axios';
import { API_URL } from '@/lib/api';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export function MonthlyMonitoringView({ onSelectEmployee, departmentFilter = 'all' }) {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });

  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState({
    overallSummary: {
      totalActiveHours: '0h 0m',
      totalIdleHours: '0h 0m',
      avgProductivityScore: 0,
      totalKeystrokes: 0,
      totalMouseActivity: 0,
      overallProductivityEfficiency: 'Low Efficiency'
    },
    dayByDayBreakdown: [],
    employeePerformance: []
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmpForMonthlyDrilldown, setSelectedEmpForMonthlyDrilldown] = useState(null);
  const [empMonthlyBreakdown, setEmpMonthlyBreakdown] = useState([]);
  const [drilldownLoading, setDrilldownLoading] = useState(false);

  useEffect(() => {
    fetchMonthlySummary();
  }, [selectedMonth, departmentFilter]);

  const fetchMonthlySummary = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('WorkflowToken') || localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/monitoring/monthly-summary?month=${selectedMonth}&department=${departmentFilter}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setMonthlyData({
          overallSummary: response.data.overallSummary || {},
          dayByDayBreakdown: response.data.dayByDayBreakdown || [],
          employeePerformance: response.data.employeePerformance || []
        });
      }
    } catch (error) {
      console.error('Error fetching monthly summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEmployeeMonthlyDrilldown = async (emp) => {
    setSelectedEmpForMonthlyDrilldown(emp);
    setDrilldownLoading(true);
    try {
      const token = localStorage.getItem('WorkflowToken') || localStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/monitoring/monthly-employee-breakdown?employeeId=${emp.employeeId || emp._id}&month=${selectedMonth}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        setEmpMonthlyBreakdown(response.data.dailyBreakdown || []);
      }
    } catch (error) {
      console.error('Error fetching employee monthly breakdown:', error);
    } finally {
      setDrilldownLoading(false);
    }
  };

  const getEfficiencyBadge = (efficiency) => {
    if (efficiency === 'High Efficiency') {
      return <Badge className="bg-emerald-500 text-white font-semibold text-[11px]">⚡ High Efficiency</Badge>;
    } else if (efficiency === 'Moderate Efficiency') {
      return <Badge className="bg-amber-500 text-white font-semibold text-[11px]">⚖️ Moderate Efficiency</Badge>;
    }
    return <Badge className="bg-rose-500 text-white font-semibold text-[11px]">🔻 Low Efficiency</Badge>;
  };

  const filteredEmployees = monthlyData.employeePerformance.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Controls & Month Picker */}
      <Card className="border-l-4 border-l-purple-500 bg-card shadow-sm">
        <CardContent className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Monthly Performance Summary</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Overview for <span className="font-semibold text-foreground">{selectedMonth}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Month Selector */}
            <div className="flex items-center gap-2 bg-muted/50 p-1.5 rounded-xl border border-border">
              <label className="text-xs font-semibold text-muted-foreground px-2">Select Month:</label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-auto h-9 text-xs bg-background"
              />
            </div>

            {/* Search */}
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search employee..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly KPI Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card className="p-4 bg-gradient-to-br from-emerald-500/5 to-background border-emerald-500/20">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Active Hours</p>
          <h3 className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
            {monthlyData.overallSummary.totalActiveHours || '0h 0m'}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Monthly Total</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-amber-500/5 to-background border-amber-500/20">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Idle Hours</p>
          <h3 className="text-xl font-bold mt-1 text-amber-600 dark:text-amber-400">
            {monthlyData.overallSummary.totalIdleHours || '0h 0m'}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Monthly Total</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-blue-500/5 to-background border-blue-500/20">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Avg Productivity</p>
          <h3 className="text-xl font-bold mt-1 text-blue-600 dark:text-blue-400">
            {monthlyData.overallSummary.avgProductivityScore || 0}%
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Team Average</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-purple-500/5 to-background border-purple-500/20">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Keystrokes</p>
          <h3 className="text-xl font-bold mt-1 text-purple-600 dark:text-purple-400">
            {monthlyData.overallSummary.totalKeystrokes
              ? monthlyData.overallSummary.totalKeystrokes.toLocaleString()
              : 0}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Team Keystrokes</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-indigo-500/5 to-background border-indigo-500/20">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Mouse Score</p>
          <h3 className="text-xl font-bold mt-1 text-indigo-600 dark:text-indigo-400">
            {monthlyData.overallSummary.totalMouseActivity || 0}%
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Avg Mouse Activity</p>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-primary/5 to-background border-primary/20">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Overall Efficiency</p>
          <div className="mt-1">
            {getEfficiencyBadge(monthlyData.overallSummary.overallProductivityEfficiency)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Monthly Grade</p>
        </Card>
      </div>

      {/* Day-by-Day Activity Breakdown Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Day-by-Day Team Activity Breakdown ({selectedMonth})
          </CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {loading ? (
            <div className="h-full flex items-center justify-center text-muted-foreground animate-pulse">
              Loading monthly trend chart...
            </div>
          ) : monthlyData.dayByDayBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData.dayByDayBreakdown}>
                <defs>
                  <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="day" stroke="#888888" fontSize={12} tickFormatter={(val) => `Day ${val}`} />
                <YAxis stroke="#888888" fontSize={12} />
                <Tooltip />
                <Area type="monotone" dataKey="avgProductivityScore" name="Avg Productivity %" stroke="#10b981" fillOpacity={1} fill="url(#colorProd)" />
                <Area type="monotone" dataKey="activeHours" name="Active Hours" stroke="#3b82f6" fillOpacity={1} fill="url(#colorHours)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              No activity trend data recorded for this month.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Employee-Wise Monthly Performance Table */}
      <Card>
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Employee Performance Summary for {selectedMonth}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Loading employee monthly data...</div>
          ) : filteredEmployees.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No employee monthly performance records found.</div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs font-semibold uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="p-4">Employee</th>
                  <th className="p-4">Department</th>
                  <th className="p-4">Total Active Hours</th>
                  <th className="p-4">Total Idle Hours</th>
                  <th className="p-4">Avg Productivity</th>
                  <th className="p-4">Total Keystrokes</th>
                  <th className="p-4">Mouse Score</th>
                  <th className="p-4">Efficiency</th>
                  <th className="p-4 text-right">Day-by-Day Drilldown</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.employeeId} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-medium">
                      <div>
                        <p className="font-bold text-foreground">{emp.name}</p>
                        <p className="text-xs text-muted-foreground">{emp.email}</p>
                      </div>
                    </td>
                    <td className="p-4 text-xs font-medium text-muted-foreground">{emp.department || 'General'}</td>
                    <td className="p-4 font-semibold text-emerald-600 dark:text-emerald-400">{emp.totalActiveHours}</td>
                    <td className="p-4 font-semibold text-amber-600 dark:text-amber-400">{emp.totalIdleHours}</td>
                    <td className="p-4 font-bold">
                      <div className="flex items-center gap-2">
                        <span className="w-8">{emp.avgProductivityScore}%</span>
                        <Progress value={emp.avgProductivityScore} className="h-1.5 w-16" />
                      </div>
                    </td>
                    <td className="p-4">{emp.totalKeystrokes ? emp.totalKeystrokes.toLocaleString() : 0}</td>
                    <td className="p-4">{emp.avgMouseActivity}%</td>
                    <td className="p-4">{getEfficiencyBadge(emp.productivityEfficiency)}</td>
                    <td className="p-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEmployeeMonthlyDrilldown(emp)}
                        className="text-xs font-semibold hover:bg-primary hover:text-white"
                      >
                        Monthly Days
                        <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Employee Day-by-Day Drilldown Modal */}
      {selectedEmpForMonthlyDrilldown && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-background border border-border rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-primary/10 to-background border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">{selectedEmpForMonthlyDrilldown.name}</h3>
                <p className="text-xs text-muted-foreground">
                  Daily performance throughout {selectedMonth}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedEmpForMonthlyDrilldown(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {drilldownLoading ? (
                <div className="py-12 text-center text-muted-foreground animate-pulse">
                  Loading day-by-day records for employee...
                </div>
              ) : empMonthlyBreakdown.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  No daily records found for this month.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 font-semibold text-muted-foreground border-b border-border">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Active Hours</th>
                      <th className="p-3">Idle Time</th>
                      <th className="p-3">Productivity</th>
                      <th className="p-3">Keystrokes</th>
                      <th className="p-3">Mouse Score</th>
                      <th className="p-3">Efficiency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {empMonthlyBreakdown.map((dayItem, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="p-3 font-semibold">{dayItem.date}</td>
                        <td className="p-3 text-emerald-600 dark:text-emerald-400 font-medium">{dayItem.activeHours}</td>
                        <td className="p-3 text-amber-600 dark:text-amber-400 font-medium">{dayItem.idleTime}</td>
                        <td className="p-3 font-bold">{dayItem.productivityScore}%</td>
                        <td className="p-3">{dayItem.keystrokes ? dayItem.keystrokes.toLocaleString() : 0}</td>
                        <td className="p-3">{dayItem.mouseActivity}%</td>
                        <td className="p-3">{getEfficiencyBadge(dayItem.productivityEfficiency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-4 bg-muted/20 border-t border-border flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setSelectedEmpForMonthlyDrilldown(null)}>
                Close Breakdown
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
