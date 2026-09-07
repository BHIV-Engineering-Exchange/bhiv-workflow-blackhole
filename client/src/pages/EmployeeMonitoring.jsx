import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Monitor,
  Activity,
  AlertTriangle,
  Users,
  Eye,
  Clock,
  TrendingUp,
  Shield,
  Camera,
  Globe,
  Play,
  Square,
  Search,
  Filter,
  Download,
  Brain,
  Zap,
  LayoutDashboard
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import axios from 'axios';
import { api, API_URL } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';

// Import monitoring components
import { MonitoringDashboard } from '@/components/monitoring/MonitoringDashboard';
import { EmployeeSelector } from '@/components/monitoring/EmployeeSelector';
import { ActivityChart } from '@/components/monitoring/ActivityChart';
import { ScreenshotGallery } from '@/components/monitoring/ScreenshotGallery';
import { AlertsPanel } from '@/components/monitoring/AlertsPanel';
import { ReportsGenerator } from '@/components/monitoring/ReportsGenerator';
import { BulkMonitoringControls } from '@/components/monitoring/BulkMonitoringControls';
import { AIInsightsPanel } from '@/components/monitoring/AIInsightsPanel';
import { WhitelistManager } from '@/components/monitoring/WhitelistManager';
import { ProductionDashboard } from '@/components/monitoring/ProductionDashboard';

export function EmployeeMonitoring() {
  const { user } = useAuth();
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [monitoringStatus, setMonitoringStatus] = useState({});
  const [activeTab, setActiveTab] = useState('dashboard');
  const [statusTab, setStatusTab] = useState('active');
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [departments, setDepartments] = useState([]);
  const [intelligentMode, setIntelligentMode] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Fetch data on component mount
    fetchEmployees();
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      fetchMonitoringStatus();
      // Set up real-time status updates
      const interval = setInterval(fetchMonitoringStatus, 30000); // Update every 30 seconds
      return () => clearInterval(interval);
    }
  }, [selectedEmployee]);

  const fetchEmployees = async () => {
    try {
      let resData = await api.admin.getUsers(true).catch(() => null);
      if (!Array.isArray(resData)) {
        resData = await api.admin.getAllUsers().catch(() => null);
      }
      if (!Array.isArray(resData)) {
        resData = await api.users?.getUsers?.().catch(() => []);
      }

      const usersList = Array.isArray(resData) ? resData : [];
      const nonAdminEmployees = usersList.filter(emp => emp.role !== 'admin' && emp.role !== 'Admin');
      setEmployees(nonAdminEmployees);

      // Auto-select first active employee on initial page load
      if (nonAdminEmployees.length > 0) {
        setSelectedEmployee(prev => prev || nonAdminEmployees.find(emp => emp.stillExist === 1) || nonAdminEmployees[0]);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch employees',
        type: 'destructive'
      });
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await axios.get(`${API_URL}/departments`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      console.log('Departments response in EmployeeMonitoring:', response.data);

      // Handle both old and new response formats
      if (response.data.success && response.data.data) {
        setDepartments(response.data.data);
      } else if (Array.isArray(response.data)) {
        setDepartments(response.data);
      } else {
        console.error('Unexpected departments response format:', response.data);
        setDepartments([]);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
      setDepartments([]);
    }
  };

  const fetchMonitoringStatus = async () => {
    if (!selectedEmployee) return;

    try {
      // Fetch real Electron agent activity data
      const response = await axios.get(`${API_URL}/agent/activity/summary/${selectedEmployee._id}`, {
        headers: { 'x-auth-token': localStorage.getItem('token') }
      });
      
      // Transform the response to match expected format
      const agentData = response.data.summary || {};
      const latestLog = agentData.recentLogs?.[0] || {};
      const hasLogs = (agentData.totalLogs || 0) > 0;
      
      setMonitoringStatus({
        isActive: hasLogs || selectedEmployee.stillExist === 1,
        currentActivity: agentData.avgProductivityScore || 0,
        screenCaptureEnabled: true,
        mode: 'ELECTRON_NATIVE',
        stats: {
          totalLogs: agentData.totalLogs || 0,
          keystrokes: agentData.totalKeystrokes || 0,
          mouseActivity: agentData.totalMouseActivity || 0,
          idleTime: agentData.totalIdleSeconds || 0,
          productivity: agentData.avgProductivityScore || 0
        },
        recentActivity: agentData.recentLogs || [],
        activity: {
          active: hasLogs || selectedEmployee.stillExist === 1,
          isIdle: (agentData.totalIdleSeconds || 0) > 300,
          currentApplication: {
            name: latestLog.appName || latestLog.applicationName || (selectedEmployee.stillExist === 1 ? 'Active Workspace' : 'System Offline'),
            title: latestLog.windowTitle || 'Active Session',
            url: latestLog.url || ''
          },
          sessionDuration: (agentData.totalLogs || 0) * 10,
          timeSinceLastActivity: agentData.totalIdleSeconds || 0
        }
      });
    } catch (error) {
      console.error('Error fetching monitoring status:', error);
      // Set default state matching employee active status
      const isActiveUser = selectedEmployee?.stillExist === 1;
      setMonitoringStatus({
        isActive: isActiveUser,
        currentActivity: 0,
        stats: { totalLogs: 0, keystrokes: 0, mouseActivity: 0, idleTime: 0, productivity: 0 },
        activity: {
          active: isActiveUser,
          isIdle: false,
          currentApplication: {
            name: isActiveUser ? 'Active Workspace' : 'System Offline',
            title: 'Active Session'
          },
          sessionDuration: 0,
          timeSinceLastActivity: 0
        }
      });
    }
  };

  const startMonitoring = async () => {
    if (!selectedEmployee) return;

    setLoading(true);
    try {
      await axios.post(`${API_URL}/monitoring/start/${selectedEmployee._id}`, {
        workHours: {
          start: new Date().toISOString(),
          end: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() // 8 hours from now
        },
        intelligentMode
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      toast({
        title: 'Success',
        description: `${intelligentMode ? 'Intelligent' : 'Legacy'} monitoring started for ${selectedEmployee.name}`,
      });

      fetchMonitoringStatus();
    } catch (error) {
      console.error('Error starting monitoring:', error);
      toast({
        title: 'Error',
        description: 'Failed to start monitoring',
        type: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const stopMonitoring = async () => {
    if (!selectedEmployee) return;

    setLoading(true);
    try {
      await axios.post(`${API_URL}/monitoring/stop/${selectedEmployee._id}`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      toast({
        title: 'Success',
        description: `Monitoring stopped for ${selectedEmployee.name}`,
      });

      fetchMonitoringStatus();
    } catch (error) {
      console.error('Error stopping monitoring:', error);
      toast({
        title: 'Error',
        description: 'Failed to stop monitoring',
        type: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const activeEmployees = employees.filter(emp => emp.stillExist === 1);
  const exitedEmployees = employees.filter(emp => emp.stillExist === 0);

  const filteredEmployees = employees.filter(emp => {
    const matchesStatus = statusTab === 'all' ||
      (statusTab === 'active' && emp.stillExist === 1) ||
      (statusTab === 'exited' && emp.stillExist === 0);
    const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         emp.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDepartment = filterDepartment === 'all' || 
                             emp.department?._id === filterDepartment;
    return matchesStatus && matchesSearch && matchesDepartment;
  });

  return (
    <div className="min-h-screen bg-background p-6">
      {/* ========== CLEAN HEADER ========== */}
      <div className="space-y-2 mb-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Monitor className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Employee Monitoring</h1>
            <p className="text-muted-foreground">
              Real-time activity tracking and productivity insights
            </p>
          </div>
        </div>
      </div>

      {/* ========== TAB NAVIGATION ========== */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="h-auto p-0 bg-transparent flex gap-1 flex-wrap">
            <TabsTrigger
              value="dashboard"
              className="flex items-center gap-2 py-2 px-4 rounded-lg border-2 border-muted data-[state=active]:bg-green-500 data-[state=active]:border-green-500 data-[state=active]:text-white hover:bg-green-50 hover:border-green-300 transition-all duration-200"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </TabsTrigger>

            <TabsTrigger
              value="screenshots"
              className="flex items-center gap-2 py-2 px-4 rounded-lg border-2 border-muted data-[state=active]:bg-green-500 data-[state=active]:border-green-500 data-[state=active]:text-white hover:bg-green-50 hover:border-green-300 transition-all duration-200"
            >
              <Camera className="h-4 w-4" />
              <span>Screenshots</span>
            </TabsTrigger>

            <TabsTrigger
              value="alerts"
              className="flex items-center gap-2 py-2 px-4 rounded-lg border-2 border-muted data-[state=active]:bg-green-500 data-[state=active]:border-green-500 data-[state=active]:text-white hover:bg-green-50 hover:border-green-300 transition-all duration-200"
            >
              <AlertTriangle className="h-4 w-4" />
              <span>Alerts</span>
            </TabsTrigger>

            <TabsTrigger
              value="activity"
              className="flex items-center gap-2 py-2 px-4 rounded-lg border-2 border-muted data-[state=active]:bg-green-500 data-[state=active]:border-green-500 data-[state=active]:text-white hover:bg-green-50 hover:border-green-300 transition-all duration-200"
            >
              <Activity className="h-4 w-4" />
              <span>Activity</span>
            </TabsTrigger>

            <TabsTrigger
              value="ai-insights"
              className="flex items-center gap-2 py-2 px-4 rounded-lg border-2 border-muted data-[state=active]:bg-green-500 data-[state=active]:border-green-500 data-[state=active]:text-white hover:bg-green-50 hover:border-green-300 transition-all duration-200"
            >
              <Brain className="h-4 w-4" />
              <span>AI Insights</span>
            </TabsTrigger>

            <TabsTrigger
              value="production"
              className="flex items-center gap-2 py-2 px-4 rounded-lg border-2 border-muted data-[state=active]:bg-green-500 data-[state=active]:border-green-500 data-[state=active]:text-white hover:bg-green-50 hover:border-green-300 transition-all duration-200"
            >
              <Zap className="h-4 w-4" />
              <span>Production</span>
            </TabsTrigger>

            <TabsTrigger
              value="reports"
              className="flex items-center gap-2 py-2 px-4 rounded-lg border-2 border-muted data-[state=active]:bg-green-500 data-[state=active]:border-green-500 data-[state=active]:text-white hover:bg-green-50 hover:border-green-300 transition-all duration-200"
            >
              <Download className="h-4 w-4" />
              <span>Reports</span>
            </TabsTrigger>

            <TabsTrigger
              value="whitelist"
              className="flex items-center gap-2 py-2 px-4 rounded-lg border-2 border-muted data-[state=active]:bg-green-500 data-[state=active]:border-green-500 data-[state=active]:text-white hover:bg-green-50 hover:border-green-300 transition-all duration-200"
            >
              <Globe className="h-4 w-4" />
              <span>Whitelist</span>
            </TabsTrigger>

            <TabsTrigger
              value="bulk"
              className="flex items-center gap-2 py-2 px-4 rounded-lg border-2 border-muted data-[state=active]:bg-green-500 data-[state=active]:border-green-500 data-[state=active]:text-white hover:bg-green-50 hover:border-green-300 transition-all duration-200"
            >
              <Users className="h-4 w-4" />
              <span>Bulk</span>
            </TabsTrigger>
          </TabsList>

          {/* ========== LAYOUT ========== */}
          <div className="flex flex-col lg:flex-row gap-6 mt-6 w-full items-start">
            {/* LEFT SIDEBAR - CONTROLS */}
            <div className="w-full lg:w-80 xl:w-96 flex-shrink-0 space-y-4">
              {/* Employee Selection Card */}
              <Card className="border-l-4 border-l-primary overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent pb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <CardTitle className="text-base">Select Employee</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-4 sm:p-5">
                  {/* Status Tabs (Active, Exited, All) */}
                  <Tabs value={statusTab} onValueChange={setStatusTab} className="w-full">
                    <TabsList className="grid grid-cols-3 w-full h-auto p-1.5 bg-muted/80 border-2 border-border/60 text-xs rounded-xl gap-1 items-stretch justify-stretch shadow-sm">
                      <TabsTrigger
                        value="active"
                        className="w-full px-1 py-2 text-xs font-semibold transition-all text-center whitespace-nowrap rounded-lg data-[state=active]:bg-emerald-600 data-[state=active]:text-white dark:data-[state=active]:bg-emerald-500 dark:data-[state=active]:text-zinc-950 shadow-sm"
                      >
                        Active ({activeEmployees.length})
                      </TabsTrigger>
                      <TabsTrigger
                        value="exited"
                        className="w-full px-1 py-2 text-xs font-semibold transition-all text-center whitespace-nowrap rounded-lg data-[state=active]:bg-red-600 data-[state=active]:text-white dark:data-[state=active]:bg-red-500 dark:data-[state=active]:text-zinc-950 shadow-sm"
                      >
                        Exited ({exitedEmployees.length})
                      </TabsTrigger>
                      <TabsTrigger
                        value="all"
                        className="w-full px-1 py-2 text-xs font-semibold transition-all text-center whitespace-nowrap rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white dark:data-[state=active]:bg-blue-500 dark:data-[state=active]:text-zinc-950 shadow-sm"
                      >
                        All ({employees.length})
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* Department Filter */}
                  <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {Array.isArray(departments) && departments.map(dept => (
                        <SelectItem key={dept._id} value={dept._id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Employee List */}
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 dark:[color-scheme:dark]">
                    {filteredEmployees.length > 0 ? (
                      filteredEmployees.map(emp => (
                        <button
                          key={emp._id}
                          onClick={() => setSelectedEmployee(emp)}
                          className={`w-full text-left p-3 rounded-lg transition-all ${
                            selectedEmployee?._id === emp._id
                              ? 'bg-primary/10 border border-primary'
                              : 'bg-muted/50 hover:bg-muted border border-transparent'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm truncate">{emp.name}</p>
                            {emp.stillExist === 0 && (
                              <Badge variant="outline" className="text-[10px] px-1 py-0 bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400">
                                Exited
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{emp.email}</p>
                        </button>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No employees found
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Monitoring Status Card */}
              <Card className="border-l-4 border-l-green-500 overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-green-500/5 to-transparent pb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <Activity className="h-4 w-4 text-green-500" />
                    </div>
                    <CardTitle className="text-base">Status</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pt-4">
                  {selectedEmployee ? (
                    <>
                      <div className="flex items-center justify-between p-2 rounded text-sm">
                        <span className="text-muted-foreground">Employee:</span>
                        <span className="font-medium">{selectedEmployee.name}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded text-sm">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge 
                          variant={monitoringStatus.monitoring?.active ? 'default' : 'secondary'}
                          className={monitoringStatus.monitoring?.active ? 'bg-green-500 hover:bg-green-600' : ''}
                        >
                          {monitoringStatus.monitoring?.active ? '● Active' : '○ Inactive'}
                        </Badge>
                      </div>
                      {monitoringStatus.activity?.lastActivity && (
                        <div className="flex items-center justify-between p-2 rounded text-sm">
                          <span className="text-muted-foreground">Last Activity:</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(monitoringStatus.activity.lastActivity).toLocaleTimeString()}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Select an employee to view status
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Controls Card */}
              <Card className="border-l-4 border-l-accent overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-accent/5 to-transparent pb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Eye className="h-4 w-4 text-accent" />
                    </div>
                    <CardTitle className="text-base">Controls</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  {selectedEmployee ? (
                    <>
                      {/* Intelligent Mode Toggle */}
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                        <div className="flex items-center gap-2 flex-1">
                          {intelligentMode ? (
                            <Brain className="h-4 w-4 text-primary" />
                          ) : (
                            <Camera className="h-4 w-4 text-accent" />
                          )}
                          <Label className="text-sm font-medium cursor-pointer">
                            {intelligentMode ? 'Intelligent' : 'Legacy'}
                          </Label>
                        </div>
                        <Switch
                          checked={intelligentMode}
                          onCheckedChange={setIntelligentMode}
                          disabled={monitoringStatus.monitoring?.active}
                        />
                      </div>

                      <p className="text-xs text-muted-foreground px-2">
                        {intelligentMode
                          ? 'Event-driven with AI analysis'
                          : 'Every 5 minutes'
                        }
                      </p>

                      {/* Start/Stop Button */}
                      {monitoringStatus.monitoring?.active ? (
                        <Button
                          onClick={stopMonitoring}
                          disabled={loading}
                          className="w-full bg-green-500 hover:bg-green-600 text-white"
                        >
                          <Square className="h-4 w-4 mr-2" />
                          Stop Monitoring
                        </Button>
                      ) : (
                        <Button
                          onClick={startMonitoring}
                          disabled={loading}
                          className="w-full hover:bg-green-500 hover:text-white transition-colors"
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Start Monitoring
                        </Button>
                      )}

                      <Button variant="outline" className="w-full hover:bg-primary hover:text-primary-foreground transition-colors">
                        <Download className="h-4 w-4 mr-2" />
                        Export Report
                      </Button>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Select an employee to control
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* RIGHT CONTENT AREA */}
            <div className="flex-1 min-w-0">
              {selectedEmployee ? (
                <TabsContent value="dashboard">
                  <MonitoringDashboard
                    employee={selectedEmployee}
                    monitoringStatus={monitoringStatus}
                  />
                </TabsContent>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Activity className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="font-semibold text-lg mb-2">No Employee Selected</h3>
                    <p className="text-sm text-muted-foreground text-center max-w-sm">
                      Select an employee from the left panel to view monitoring data and analytics
                    </p>
                  </CardContent>
                </Card>
              )}

              {selectedEmployee && activeTab !== 'dashboard' && (
                <>
                  <TabsContent value="screenshots">
                    <ScreenshotGallery employee={selectedEmployee} />
                  </TabsContent>

                  <TabsContent value="alerts">
                    <AlertsPanel employee={selectedEmployee} />
                  </TabsContent>

                  <TabsContent value="activity">
                    <ActivityChart employee={selectedEmployee} />
                  </TabsContent>

                  <TabsContent value="ai-insights">
                    <AIInsightsPanel employee={selectedEmployee} />
                  </TabsContent>

                  <TabsContent value="production">
                    <ProductionDashboard employee={selectedEmployee} />
                  </TabsContent>

                  <TabsContent value="reports">
                    <ReportsGenerator employee={selectedEmployee} />
                  </TabsContent>

                  <TabsContent value="whitelist">
                    <WhitelistManager />
                  </TabsContent>

                  <TabsContent value="bulk">
                    <BulkMonitoringControls />
                  </TabsContent>
                </>
              )}
            </div>
          </div>
        </Tabs>
      </div>

      <Toaster />
    </div>
  );
}
