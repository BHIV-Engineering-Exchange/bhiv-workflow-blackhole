import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, UserCheck, UserX, Clock, Activity, MapPin, Upload, Download,
  Search, BarChart3, Timer, Building, Wifi, Target, FileDown, User, History
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useAuth } from '../context/auth-context';
import AttendanceGrid from '../components/attendance/AttendanceGrid';
import BiometricUpload from '../components/attendance/BiometricUpload';
import AttendanceStats from '../components/attendance/AttendanceStats';
import LiveAttendanceMap from '../components/attendance/LiveAttendanceMap';
import EmployeeAttendanceHistory from '../components/attendance/EmployeeAttendanceHistory';
import api from '../lib/api';

const AttendanceDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('live');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState('real-time');
  const [showUpload, setShowUpload] = useState(false);
  const [liveAttendance, setLiveAttendance] = useState([]);
  const [attendanceStats, setAttendanceStats] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [startTimeSummary, setStartTimeSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedUserAvg, setSelectedUserAvg] = useState(null);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedEmployeeForHistory, setSelectedEmployeeForHistory] = useState(null);

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/attendance-dashboard/departments');
      if (response.data.success) {
        setDepartments(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  };

  const refreshDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Always use locations endpoint for real-time AIMS-integrated data
      let endpoint = '/attendance-dashboard/locations';
      
      switch (viewMode) {
        case 'real-time':
        case 'locations':
        case 'present':
        case 'absent':
          endpoint = '/attendance-dashboard/locations';
          break;
        case 'start-time':
          endpoint = '/attendance-dashboard/start-time-summary';
          break;
        case 'department-wise':
          endpoint = '/attendance-dashboard/locations';
          break;
        default:
          endpoint = '/attendance-dashboard/locations';
      }

      const params = {};
      if (departmentFilter && departmentFilter !== 'all') {
        params.department = departmentFilter;
      }
      // Always honor the Status dropdown; if view mode is present/absent, it will match.
      if (statusFilter && statusFilter !== 'all') {
        params.status = statusFilter;
      }
      if (selectedDate) {
        params.date = selectedDate;
      }

      const response = await api.get(endpoint, { params });

      if (response.data && (response.data.employees || response.data.success)) {
        // Handle direct response format (no nested 'data' property)
        const data = response.data.data || response.data;
        
        if (viewMode === 'start-time' && data.tableData) {
          setStartTimeSummary(data);
          setAttendanceStats({
            totalEmployees: data.summary.totalStarted,
            presentToday: data.summary.totalStarted,
            absentToday: 0,
            earliestStart: data.summary.earliestStart,
            latestStart: data.summary.latestStart,
            byDepartment: data.byDepartment,
            byHour: data.byHour
          });
          setLiveAttendance(data.tableData.map(item => ({
            _id: item.employeeId,
            user: {
              name: item.name,
              email: item.email || 'N/A',
              department: { name: item.department, color: item.departmentColor }
            },
            startDayTime: item.startTime,
            workLocationType: item.workLocationType,
            startDayLocation: { address: item.location },
            status: 'Present'
          })));
        } else if (data && Array.isArray(data.employees)) {
          setLiveAttendance(data.employees.map(emp => ({
            _id: emp.userId,
            user: {
              _id: emp.userId,
              name: emp.name,
              email: emp.email,
              avatar: emp.avatar,
              department: emp.department
            },
            status: emp.status,
            startDayTime: emp.startTime,
            startTime: emp.startTime,
            endDayTime: emp.endTime,
            totalHoursWorked: emp.hoursWorked,
            workLocationType: emp.workLocationType,
            workStatus: emp.workStatus,
            startDayLocation: emp.location,
            location: emp.location,
            isPresent: emp.isPresent,
            hasLocation: emp.hasLocation,
            hasAim: emp.hasAim || false,
            aimDetails: emp.aimDetails || null
          })));
          
          setAttendanceStats({
            totalEmployees: data.stats.total,
            presentToday: data.stats.present,
            absentToday: data.stats.absent,
            working: data.stats.working,
            offline: data.stats.offline,
            withLocation: data.stats.withLocation,
            withAims: data.stats.withAims || 0,
            presentPercentage: data.stats.presentPercentage,
            absentPercentage: data.stats.absentPercentage,
            avgHoursToday: data.stats.avgHours,
            totalHoursToday: data.stats.totalHours,
            earliestStart: data.stats.earliestStart,
            latestStart: data.stats.latestStart,
            departmentStats: data.departmentStats
          });
        } else {
          setLiveAttendance([]);
          setAttendanceStats({
            totalEmployees: 0,
            presentToday: 0,
            absentToday: 0,
            presentPercentage: 0,
            absentPercentage: 0,
            avgHoursToday: 0,
            totalHoursToday: 0,
            withAims: 0
          });
        }
      } else {
        console.warn('No data in response');
        setLiveAttendance([]);
        setAttendanceStats({
          totalEmployees: 0,
          presentToday: 0,
          absentToday: 0,
          presentPercentage: 0,
          absentPercentage: 0,
          avgHoursToday: 0,
          totalHoursToday: 0,
          withAims: 0
        });
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message);
      setLiveAttendance([]);
      setAttendanceStats({
        totalEmployees: 0,
        presentToday: 0,
        absentToday: 0,
        presentPercentage: 0,
        absentPercentage: 0,
        avgHoursToday: 0,
        totalHoursToday: 0
      });
    } finally {
      setLoading(false);
    }
  }, [viewMode, departmentFilter, selectedDate, statusFilter]);

  const exportStartTimes = async () => {
    try {
      const params = {};
      if (departmentFilter && departmentFilter !== 'all') {
        params.department = departmentFilter;
      }
      
      const response = await api.get('/attendance-dashboard/export/start-times', {
        params,
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `start-times-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Error exporting data:', err);
    }
  };

  const uploadBiometricData = async (file) => {
    return { success: true, message: 'Upload functionality will be implemented' };
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    refreshDashboardData();
    const interval = setInterval(refreshDashboardData, 30000);
    return () => clearInterval(interval);
  }, [refreshDashboardData]);

  const isAdmin = user?.role === 'Admin' || user?.role === 'Manager';

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950/20 dark:to-indigo-950/20 p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="text-center p-8">
            <CardContent>
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserCheck className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Access Restricted</h2>
              <p className="text-muted-foreground">
                You need administrator privileges to access attendance dashboard.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const handleUploadSuccess = (result) => {
    refreshDashboardData();
    setShowUpload(false);
  };

  const filteredAttendance = liveAttendance?.filter(record => {
    const userName = record.user?.name || '';
    const userEmail = record.user?.email || '';
    const deptName = typeof record.user?.department === 'string' ? record.user.department : record.user?.department?.name || '';
    const matchesSearch = userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         userEmail.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || record.status?.toLowerCase() === statusFilter;
    const matchesDepartment = departmentFilter === 'all' || 
                              (typeof record.user?.department === 'object' && record.user?.department?._id === departmentFilter) ||
                              deptName === departmentFilter;
    
    return matchesSearch && matchesStatus && matchesDepartment;
  }) || [];

  const fetchUserAverage = async (userId) => {
    try {
      if (!userId) return;
      const today = new Date();
      const from = new Date();
      from.setDate(today.getDate() - 30); // last 30 days
      const response = await api.get('/attendance-dashboard/user-average', {
        params: { userId, from: from.toISOString(), to: today.toISOString() }
      });
      if (response.data.success) {
        setSelectedUserAvg(response.data.data);
      }
    } catch (e) {
      console.error('Failed to fetch user average:', e);
      setSelectedUserAvg(null);
    }
  };

  const handleShowEmployeeHistory = (employee) => {
    setSelectedEmployeeForHistory(employee);
    setShowHistoryDialog(true);
  };

  return (
    <div className="min-h-screen bg-background p-6 transition-colors duration-300">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-7xl mx-auto space-y-6 pb-8"
      >
        {/* Header */}
        <div className="space-y-2">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <motion.h1 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-3xl font-bold tracking-tight"
                >
                  Live Attendance Dashboard
                </motion.h1>
                <motion.p 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-muted-foreground"
                >
                  Real-time employee attendance monitoring and analytics
                </motion.p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 rounded-xl border-2 border-green-500/20"
              >
                <Upload className="w-4 h-4" />
                Upload Biometric Data
              </Button>
              
              <Button
                onClick={refreshDashboardData}
                variant="outline"
                className="flex items-center gap-2 border-2 rounded-xl hover:border-green-500/50 hover:bg-green-50 dark:hover:bg-green-900/20"
              >
                <Activity className="w-4 h-4" />
                Refresh
              </Button>

              {viewMode === 'start-time' && (
                <Button
                  onClick={exportStartTimes}
                  variant="outline"
                  className="flex items-center gap-2 border-2 rounded-xl hover:border-blue-500/50 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                >
                  <FileDown className="w-4 h-4" />
                  Export CSV
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* AIMS Integration Info Banner */}
        {attendanceStats && attendanceStats.withAims > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-900/10">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Target className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                      AIMS Integration Active
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      📋 {attendanceStats.withAims} employee{attendanceStats.withAims !== 1 ? 's' : ''} marked present via AIMS (Attendance & Integrated Management System). 
                      Employees are automatically marked present when they set their daily AIMS.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Quick Stats */}
        {attendanceStats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            <Card className="border-2 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.03] w-full">
              <CardContent className="p-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold text-green-600">Present Today</p>
                    <p className="text-4xl font-extrabold text-green-900 dark:text-green-100">
                      {attendanceStats.presentToday || 0}
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-400 mt-2">
                      {attendanceStats.presentPercentage?.toFixed(1)}% of total
                    </p>
                  </div>
                  <div className="h-14 w-14 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <UserCheck className="w-7 h-7 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.03] w-full">
              <CardContent className="p-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold text-red-600">Absent Today</p>
                    <p className="text-4xl font-extrabold text-red-900 dark:text-red-100">
                      {attendanceStats.absentToday || 0}
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-400 mt-2">
                      {attendanceStats.absentPercentage?.toFixed(1)}% of total
                    </p>
                  </div>
                  <div className="h-14 w-14 rounded-xl bg-red-500/10 flex items-center justify-center">
                    <UserX className="w-7 h-7 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.03] w-full">
              <CardContent className="p-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold text-blue-600">
                      {viewMode === 'locations' ? 'Working Now' : 'Avg Hours'}
                    </p>
                    <p className="text-4xl font-extrabold text-blue-900 dark:text-blue-100">
                      {viewMode === 'locations' ? 
                        (attendanceStats.working || 0) : 
                        `${attendanceStats.avgHoursToday?.toFixed(1) || 0}h`
                      }
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-400 mt-2">
                      {viewMode === 'locations' ? 'Active employees' : 'Per employee today'}
                    </p>
                  </div>
                  <div className="h-14 w-14 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    {viewMode === 'locations' ? 
                      <Wifi className="w-7 h-7 text-blue-600" /> :
                      <Clock className="w-7 h-7 text-blue-600" />
                    }
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.03] w-full">
              <CardContent className="p-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold text-purple-600">
                      {viewMode === 'start-time' ? 'Started Today' : 
                       viewMode === 'locations' ? 'With Location' : 'Total Hours'}
                    </p>
                    <p className="text-4xl font-extrabold text-purple-900 dark:text-purple-100">
                      {viewMode === 'start-time' ? (attendanceStats.totalEmployees || 0) :
                       viewMode === 'locations' ? (attendanceStats.withLocation || 0) :
                       `${attendanceStats.totalHoursToday?.toFixed(1) || 0}h`
                      }
                    </p>
                    <p className="text-sm text-purple-700 dark:text-purple-400 mt-2">
                      {viewMode === 'start-time' ? 'Employees clocked in' :
                       viewMode === 'locations' ? 'Tracked employees' : 'Total worked today'}
                    </p>
                  </div>
                  <div className="h-14 w-14 rounded-xl bg-purple-500/10 flex items-center justify-center">
                    {viewMode === 'start-time' ? <Target className="w-7 h-7 text-purple-600" /> :
                     viewMode === 'locations' ? <MapPin className="w-7 h-7 text-purple-600" /> :
                     <Timer className="w-7 h-7 text-purple-600" />
                    }
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Filters */}
        <Card className="border-2 rounded-2xl shadow-xl w-full max-w-7xl mx-auto">
          <CardContent className="p-8">
            <div className="flex flex-col gap-6">
              {/* Data View Dropdown */}
              <div className="w-full">
                <label className="text-sm font-semibold text-foreground mb-2 block">Data View</label>
                <Select value={viewMode} onValueChange={setViewMode}>
                  <SelectTrigger className="w-full border-2 rounded-xl text-base bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/10 dark:to-blue-900/10">
                    <SelectValue placeholder="Select view mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="real-time">🔴 Real-time Working Data</SelectItem>
                    <SelectItem value="present">✅ Present Employees</SelectItem>
                    <SelectItem value="absent">❌ Absent Employees</SelectItem>
                    <SelectItem value="department-wise">🏢 Department-wise Summary</SelectItem>
                    <SelectItem value="start-time">⏰ Start Time Summary</SelectItem>
                    <SelectItem value="locations">📍 Location Map View</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Picker */}
              <div className="w-full">
                <label className="text-sm font-semibold text-foreground mb-2 block">Date</label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full border-2 rounded-xl text-base"
                />
              </div>

              {/* Filters Row */}
              <div className="flex flex-col md:flex-row gap-6 items-center justify-between w-full">
                <div className="flex-1 w-full">
                  <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <Input
                      placeholder="Search employees..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-12 border-2 rounded-xl focus-visible:ring-green-500 w-full text-base py-3"
                    />
                  </div>
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-44 border-2 rounded-xl text-base">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="present">Present</SelectItem>
                      <SelectItem value="absent">Absent</SelectItem>
                      <SelectItem value="late">Late</SelectItem>
                      <SelectItem value="on-leave">On Leave</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger className="w-44 border-2 rounded-xl text-base">
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept._id} value={dept._id}>
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${dept.color}`}></div>
                            {dept.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:grid-cols-3 border-2 rounded-xl p-1 bg-muted/20">
            <TabsTrigger 
              value="live" 
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-green-500 data-[state=active]:text-white transition-all"
            >
              <Activity className="w-4 h-4" />
              Live View
            </TabsTrigger>
            <TabsTrigger 
              value="analytics" 
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-green-500 data-[state=active]:text-white transition-all"
            >
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger 
              value="map" 
              className="flex items-center gap-2 rounded-lg data-[state=active]:bg-green-500 data-[state=active]:text-white transition-all"
            >
              <MapPin className="w-4 h-4" />
              Location Map
            </TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="space-y-6">
            {/* Live Dashboard Summary Cards */}
            {!loading && liveAttendance.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6"
              >
                {/* Present Employees Card */}
                <Card className="border-2 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-green-600 mb-1">Present Employees</p>
                        <p className="text-3xl font-bold text-green-900 dark:text-green-100">
                          {liveAttendance.filter(emp => emp.status?.toLowerCase() === 'present').length}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Currently working
                        </p>
                      </div>
                      <div className="h-12 w-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <UserCheck className="w-6 h-6 text-green-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Absent Employees Card */}
                <Card className="border-2 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-red-600 mb-1">Absent Employees</p>
                        <p className="text-3xl font-bold text-red-900 dark:text-red-100">
                          {liveAttendance.filter(emp => emp.status?.toLowerCase() === 'absent').length}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Not checked in
                        </p>
                      </div>
                      <div className="h-12 w-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <UserX className="w-6 h-6 text-red-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Average Working Time Card */}
                <Card className="border-2 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-blue-600 mb-1">Avg Working Time</p>
                        <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                          {(() => {
                            const presentEmployees = liveAttendance.filter(emp => 
                              emp.status?.toLowerCase() === 'present' && emp.totalHoursWorked
                            );
                            if (presentEmployees.length === 0) return '0h';
                            const totalHours = presentEmployees.reduce((sum, emp) => {
                              const hours = parseFloat(emp.totalHoursWorked) || 0;
                              return sum + hours;
                            }, 0);
                            const avgHours = totalHours / presentEmployees.length;
                            return `${avgHours.toFixed(1)}h`;
                          })()}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Present employees today
                        </p>
                      </div>
                      <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <Clock className="w-6 h-6 text-blue-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            <AttendanceGrid 
              attendance={filteredAttendance}
              loading={loading}
              onRefresh={refreshDashboardData}
              onRowClick={(rec) => fetchUserAverage(rec.user?._id || rec._id)}
              onHistoryClick={(rec) => handleShowEmployeeHistory({
                userId: rec.user?._id || rec._id,
                userName: rec.user?.name || 'Unknown'
              })}
            />
            
            {/* Employee Names List - Filtered by Status */}
            {!loading && (statusFilter === 'present' || statusFilter === 'absent') && (
              <Card className="border-2 rounded-2xl shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      {statusFilter === 'present' ? (
                        <>
                          <UserCheck className="w-5 h-5 text-green-600" />
                          <span className="text-green-900 dark:text-green-100">Present Employees</span>
                        </>
                      ) : (
                        <>
                          <UserX className="w-5 h-5 text-red-600" />
                          <span className="text-red-900 dark:text-red-100">Absent Employees</span>
                        </>
                      )}
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      statusFilter === 'present' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' 
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                      {filteredAttendance.length} {filteredAttendance.length === 1 ? 'Employee' : 'Employees'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredAttendance.map((rec) => (
                      <div 
                        key={rec._id} 
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all hover:shadow-md ${
                          statusFilter === 'present'
                            ? 'bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800'
                            : 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800'
                        }`}
                      >
                        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${
                          statusFilter === 'present'
                            ? 'bg-green-200 dark:bg-green-800'
                            : 'bg-red-200 dark:bg-red-800'
                        }`}>
                          <User className={`h-4 w-4 ${
                            statusFilter === 'present'
                              ? 'text-green-700 dark:text-green-300'
                              : 'text-red-700 dark:text-red-300'
                          }`} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">{rec.user?.name || 'Unknown'}</p>
                            {rec.hasAim && statusFilter === 'present' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" title="Present via AIMS">
                                📋 AIMS
                              </span>
                            )}
                          </div>
                          {rec.user?.department?.name && (
                            <p className="text-xs text-muted-foreground truncate">{rec.user.department.name}</p>
                          )}
                          {rec.user?.email && (
                            <p className="text-xs text-muted-foreground truncate">{rec.user.email}</p>
                          )}
                          {rec.startTime && statusFilter === 'present' && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Started: {new Date(rec.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShowEmployeeHistory({
                              userId: rec.user?._id || rec._id,
                              userName: rec.user?.name || 'Unknown'
                            });
                          }}
                          className="ml-2"
                          title="View attendance history"
                        >
                          <History className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {!loading && filteredAttendance.length === 0 && (
              <Card className="border-2 rounded-2xl">
                <CardContent className="p-6">
                  <p className="text-sm text-muted-foreground">
                    No attendance records found for the selected filters.
                    Try switching Data View to Real-time or Start-time, clearing Status/Department, or changing Date.
                  </p>
                </CardContent>
              </Card>
            )}
            {selectedUserAvg && (
              <Card className="border-2 rounded-2xl">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Average working hours (30 days)</p>
                      <p className="text-2xl font-semibold">{selectedUserAvg.averageHours} h</p>
                      <p className="text-sm">Total: {selectedUserAvg.totalHours} h across {selectedUserAvg.daysCount} days</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{selectedUserAvg.user?.name}</p>
                      <p className="text-sm text-muted-foreground">{selectedUserAvg.user?.employeeId || '—'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <AttendanceStats data={attendanceStats} />
          </TabsContent>

          <TabsContent value="map" className="space-y-6">
            {viewMode !== 'locations' && (
              <Card className="mb-4 border-l-4 border-l-blue-500">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">
                    💡 Tip: Switch to "Location Map View" in the Data View dropdown above to see real-time employee locations
                  </p>
                </CardContent>
              </Card>
            )}
            <LiveAttendanceMap attendance={filteredAttendance.filter(a => a.hasLocation)} />
          </TabsContent>
        </Tabs>

        {/* Biometric Upload Modal */}
        <BiometricUpload
          isOpen={showUpload}
          onClose={() => setShowUpload(false)}
          onSuccess={handleUploadSuccess}
        />

        {/* Employee History Dialog */}
        <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Employee Attendance History
              </DialogTitle>
            </DialogHeader>
            {selectedEmployeeForHistory && (
              <EmployeeAttendanceHistory
                userId={selectedEmployeeForHistory.userId}
                userName={selectedEmployeeForHistory.userName}
                onClose={() => setShowHistoryDialog(false)}
              />
            )}
          </DialogContent>
        </Dialog>
      </motion.div>
    </div>
  );
};

export default AttendanceDashboard;
