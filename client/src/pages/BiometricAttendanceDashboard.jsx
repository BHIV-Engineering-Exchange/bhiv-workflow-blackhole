import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  Upload,
  Download,
  Calendar,
  Users,
  Clock,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  FileText,
  Filter,
  RefreshCw,
  Plus,
  Trash2,
  Edit,
  Settings
} from 'lucide-react';
import axios from 'axios';
import { formatDate, formatDateTime } from '../lib/dateFormat';

const BiometricAttendanceDashboard = () => {
  // State management
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Filters
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedUser, setSelectedUser] = useState('all');
  const [selectedWorkType, setSelectedWorkType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Data
  const [kpis, setKpis] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [salaryData, setSalaryData] = useState(null);
  const [detailedLogs, setDetailedLogs] = useState([]);
  const [employeeAggregates, setEmployeeAggregates] = useState([]);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [uploadFile, setUploadFile] = useState(null);
  
  // New state for holidays, leaves, and hourly rates
  const [publicHolidays, setPublicHolidays] = useState([]);
  const [paidLeaves, setPaidLeaves] = useState([]);
  const [employeeRates, setEmployeeRates] = useState([]);
  const [holidayForm, setHolidayForm] = useState({ date: '', name: '', description: '', isPaidLeave: true });
  const [leaveForm, setLeaveForm] = useState({ userId: '', date: '', hours: 8, leaveType: 'Paid Leave', reason: '' });
  const [rateForm, setRateForm] = useState({ userId: '', hourlyRate: 0, monthlySalary: 0, salaryType: 'Monthly' });

  // API base URL - UPDATED to use new biometric endpoints
  const API_BASE = import.meta.env.VITE_API_URL 
    ? `${import.meta.env.VITE_API_URL}/biometric`
    : 'http://localhost:5001/api/biometric';
  const token = localStorage.getItem('WorkflowToken');

  const axiosConfig = {
    headers: {
      'x-auth-token': token,
      'Content-Type': 'application/json'
    }
  };

  // Fetch initial data
  useEffect(() => {
    fetchDepartments();
    fetchUsers();
    fetchKPIs();
    fetchUploadHistory();
    fetchPublicHolidays();
    fetchEmployeeRates();
  }, []);

  // Fetch data when filters change
  useEffect(() => {
    if (dateRange.startDate && dateRange.endDate) {
      fetchSalaryData();
      fetchDetailedLogs();
      fetchEmployeeAggregates();
      fetchPublicHolidays();
      fetchPaidLeaves();
    }
  }, [dateRange, selectedDepartment, selectedUser, selectedWorkType, selectedStatus]);

  // API Functions
  const fetchDepartments = async () => {
    try {
      const response = await axios.get(`${API_BASE}/departments`, axiosConfig);
      setDepartments(response.data.data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const params = selectedDepartment && selectedDepartment !== 'all' ? { departmentId: selectedDepartment } : {};
      const response = await axios.get(`${API_BASE}/users`, { ...axiosConfig, params });
      setUsers(response.data.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchKPIs = async () => {
    try {
      const params = {
        departmentId: selectedDepartment !== 'all' ? selectedDepartment : undefined,
        workType: selectedWorkType !== 'all' ? selectedWorkType : undefined
      };
      const response = await axios.get(`${API_BASE}/dashboard-kpis`, { ...axiosConfig, params });
      setKpis(response.data.data);
    } catch (error) {
      console.error('Error fetching KPIs:', error);
      setError('Failed to fetch dashboard KPIs');
    }
  };

  const fetchSalaryData = async () => {
    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE}/salary-calculation`, {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        userId: selectedUser !== 'all' ? selectedUser : undefined,
        departmentId: selectedDepartment !== 'all' ? selectedDepartment : undefined,
        workType: selectedWorkType !== 'all' ? selectedWorkType : undefined
      }, axiosConfig);
      setSalaryData(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching salary data:', error);
      setError('Failed to calculate salary');
      setLoading(false);
    }
  };

  const fetchDetailedLogs = async () => {
    try {
      // UPDATED: Use new /api/attendance/daily endpoint
      const params = {
        date: dateRange.startDate, // For single date queries
        userId: selectedUser !== 'all' ? selectedUser : undefined,
        departmentId: selectedDepartment !== 'all' ? selectedDepartment : undefined,
      };
      
      // Note: The new endpoint returns records per date, so we may need to query a range
      const response = await axios.get(`${API_BASE.replace('/biometric', '/attendance')}/daily`, { ...axiosConfig, params });
      
      if (response.data.success && response.data.data) {
        // Map new response structure to match expected format
        const mappedLogs = response.data.data.map(record => ({
          _id: record._id,
          date: record.date,
          user: {
            _id: record.employee._id,
            name: record.employee.name,
            email: record.employee.email,
            department: record.employee.department
          },
          // Map new fields to old structure for compatibility
          biometricTimeIn: record.times.final_in,
          biometricTimeOut: record.times.final_out,
          totalHoursWorked: record.times.worked_hours,
          status: record.status,
          isPresent: record.isPresent,
          // NEW FIELDS from merge logic
          mergeDetails: record.mergeDetails,
          source: record.verification?.method || 'Biometric',
          remarks: record.mergeDetails?.remarks || 'N/A',
          mergeCase: record.mergeDetails?.case || 'N/A',
          // Salary info
          basicSalaryForDay: record.salary?.basicForDay || 0,
          hourlyRate: record.salary?.hourlyRate || 0
        }));
        
        // Filter by status if needed (client-side)
        let filteredLogs = mappedLogs;
        if (selectedStatus !== 'all') {
          filteredLogs = mappedLogs.filter(log => log.status === selectedStatus);
        }
        
        setDetailedLogs(filteredLogs);
      } else {
        setDetailedLogs([]);
      }
    } catch (error) {
      console.error('Error fetching detailed logs:', error);
      setDetailedLogs([]);
    }
  };

  const fetchEmployeeAggregates = async () => {
    try {
      const params = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        departmentId: selectedDepartment !== 'all' ? selectedDepartment : undefined,
        workType: selectedWorkType !== 'all' ? selectedWorkType : undefined
      };
      const response = await axios.get(`${API_BASE}/employee-aggregates`, { ...axiosConfig, params });
      setEmployeeAggregates(response.data.data || []);
    } catch (error) {
      console.error('Error fetching employee aggregates:', error);
    }
  };

  const fetchUploadHistory = async () => {
    try {
      const response = await axios.get(`${API_BASE}/upload-history`, { ...axiosConfig, params: { limit: 10 } });
      setUploadHistory(response.data.data || []);
    } catch (error) {
      console.error('Error fetching upload history:', error);
    }
  };

  // NEW: Fetch public holidays
  const fetchPublicHolidays = async () => {
    try {
      const params = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        departmentId: selectedDepartment !== 'all' ? selectedDepartment : undefined
      };
      const response = await axios.get(`${API_BASE}/public-holidays`, { ...axiosConfig, params });
      setPublicHolidays(response.data.data || []);
    } catch (error) {
      console.error('Error fetching public holidays:', error);
    }
  };

  // NEW: Fetch paid leaves
  const fetchPaidLeaves = async () => {
    try {
      const params = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        userId: selectedUser !== 'all' ? selectedUser : undefined
      };
      const response = await axios.get(`${API_BASE}/paid-leaves`, { ...axiosConfig, params });
      setPaidLeaves(response.data.data || []);
    } catch (error) {
      console.error('Error fetching paid leaves:', error);
    }
  };

  // NEW: Fetch employee hourly rates
  const fetchEmployeeRates = async () => {
    try {
      const params = {
        departmentId: selectedDepartment !== 'all' ? selectedDepartment : undefined
      };
      const response = await axios.get(`${API_BASE}/employee-hourly-rates`, { ...axiosConfig, params });
      setEmployeeRates(response.data.data || []);
    } catch (error) {
      console.error('Error fetching employee rates:', error);
    }
  };

  // NEW: Add public holiday
  const handleAddHoliday = async () => {
    try {
      setLoading(true);
      await axios.post(`${API_BASE}/public-holidays`, holidayForm, axiosConfig);
      setSuccess('Public holiday added successfully');
      setHolidayForm({ date: '', name: '', description: '', isPaidLeave: true });
      fetchPublicHolidays();
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to add public holiday');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  // NEW: Delete public holiday
  const handleDeleteHoliday = async (id) => {
    if (!confirm('Are you sure you want to delete this holiday?')) return;
    try {
      await axios.delete(`${API_BASE}/public-holidays/${id}`, axiosConfig);
      setSuccess('Holiday deleted successfully');
      fetchPublicHolidays();
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to delete holiday');
      setTimeout(() => setError(null), 5000);
    }
  };

  // NEW: Add paid leave
  const handleAddPaidLeave = async () => {
    try {
      setLoading(true);
      await axios.post(`${API_BASE}/paid-leaves`, leaveForm, axiosConfig);
      setSuccess('Paid leave added successfully');
      setLeaveForm({ userId: '', date: '', hours: 8, leaveType: 'Paid Leave', reason: '' });
      fetchPaidLeaves();
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to add paid leave');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  // NEW: Delete paid leave
  const handleDeletePaidLeave = async (id) => {
    if (!confirm('Are you sure you want to delete this paid leave?')) return;
    try {
      await axios.delete(`${API_BASE}/paid-leaves/${id}`, axiosConfig);
      setSuccess('Paid leave deleted successfully');
      fetchPaidLeaves();
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to delete paid leave');
      setTimeout(() => setError(null), 5000);
    }
  };

  // NEW: Update employee hourly rate
  const handleUpdateHourlyRate = async () => {
    try {
      setLoading(true);
      await axios.put(`${API_BASE}/employee-hourly-rate/${rateForm.userId}`, rateForm, axiosConfig);
      setSuccess('Hourly rate updated successfully');
      setRateForm({ userId: '', hourlyRate: 0, monthlySalary: 0, salaryType: 'Monthly' });
      fetchEmployeeRates();
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to update hourly rate');
      setTimeout(() => setError(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async () => {
    if (!uploadFile) {
      setError('Please select a file to upload');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const formData = new FormData();
      formData.append('file', uploadFile);

      // UPDATED: Use new /api/biometric/upload endpoint
      const response = await axios.post(`${API_BASE}/upload`, formData, {
        headers: {
          'x-auth-token': localStorage.getItem('WorkflowToken'),
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        const result = response.data.data;
        setSuccess(
          `File uploaded successfully! ` +
          `Processed: ${result.processed || 0} records. ` +
          `Exact matches: ${result.identityMatches?.exact || 0}, ` +
          `Fuzzy matches: ${result.identityMatches?.fuzzy || 0}, ` +
          `Not found: ${result.identityMatches?.notFound || 0}.`
        );
        setUploadFile(null);
        fetchUploadHistory();
        
        // Show recommendations if any
        if (response.data.recommendations && response.data.recommendations.length > 0) {
          console.log('Recommendations:', response.data.recommendations);
        }
      } else {
        throw new Error(response.data.error || 'Upload failed');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error uploading file:', error);
      setError(error.response?.data?.error || error.message || 'Failed to upload file');
      setLoading(false);
    }
  };

  // Derive attendance from punches
  const handleDeriveAttendance = async () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      setError('Please select date range');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // UPDATED: Use new /api/biometric/derive-attendance endpoint
      const response = await axios.post(`${API_BASE}/derive-attendance`, {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      }, axiosConfig);

      if (response.data.success) {
        const result = response.data.data;
        const summary = response.data.summary;
        
        setSuccess(
          `Attendance derived successfully with 20-minute merge logic! ` +
          `Created: ${summary?.created || 0}, ` +
          `Updated: ${summary?.updated || 0}. ` +
          `Merge cases: ${JSON.stringify(summary?.mergeDetails?.byCase || {})}`
        );
        
        fetchDetailedLogs();
        fetchEmployeeAggregates();
        fetchKPIs();
      } else {
        throw new Error(response.data.error || 'Failed to derive attendance');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error deriving attendance:', error);
      setError(error.response?.data?.error || error.message || 'Failed to derive attendance');
      setLoading(false);
    }
  };

  // Export functions
  const handleExportSalary = () => {
    const params = new URLSearchParams({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      ...(selectedDepartment !== 'all' && { departmentId: selectedDepartment }),
      ...(selectedWorkType !== 'all' && { workType: selectedWorkType })
    });

    window.open(`${API_BASE}/export-salary?${params.toString()}`, '_blank');
  };

  const handleExportLogs = () => {
    const params = new URLSearchParams({
      ...(dateRange.startDate && { startDate: dateRange.startDate }),
      ...(dateRange.endDate && { endDate: dateRange.endDate }),
      ...(selectedDepartment !== 'all' && { departmentId: selectedDepartment }),
      ...(selectedWorkType !== 'all' && { workType: selectedWorkType }),
      ...(selectedStatus !== 'all' && { status: selectedStatus })
    });

    window.open(`${API_BASE}/export-detailed-logs?${params.toString()}`, '_blank');
  };

  // Helper function to get status badge
  const getStatusBadge = (status) => {
    const variants = {
      'Present': 'default',
      'Absent': 'destructive',
      'Half Day': 'secondary',
      'Late': 'outline',
      'On Leave': 'secondary'
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  // NEW: Helper function to get remarks badge with color coding
  const getRemarksBadge = (remarks) => {
    if (!remarks || remarks === 'N/A') return <Badge variant="outline">N/A</Badge>;
    
    const cleanRemarks = remarks.split('(')[0].trim(); // Extract main remark
    
    const variants = {
      'MATCHED': { variant: 'default', className: 'bg-green-500 text-white' },
      'BIO_MISSING': { variant: 'secondary', className: 'bg-yellow-500 text-white' },
      'WF_MISSING': { variant: 'outline', className: 'bg-blue-500 text-white' },
      'MISMATCH_20+': { variant: 'destructive', className: 'bg-red-500 text-white' },
      'NO_PUNCH_OUT': { variant: 'outline', className: 'bg-orange-500 text-white' },
      'INCOMPLETE_DATA': { variant: 'outline', className: 'bg-gray-500 text-white' }
    };
    
    const config = variants[cleanRemarks] || { variant: 'outline', className: '' };
    
    return (
      <Badge variant={config.variant} className={config.className}>
        {cleanRemarks}
      </Badge>
    );
  };

  // NEW: Helper function to get source badge
  const getSourceBadge = (source) => {
    if (!source) return <Badge variant="outline">N/A</Badge>;
    
    const variants = {
      'Biometric': { variant: 'default', className: 'bg-blue-600 text-white' },
      'StartDay': { variant: 'secondary', className: 'bg-purple-600 text-white' },
      'Both': { variant: 'default', className: 'bg-green-600 text-white' },
      'Manual': { variant: 'outline', className: 'bg-gray-600 text-white' }
    };
    
    const config = variants[source] || { variant: 'outline', className: '' };
    
    return (
      <Badge variant={config.variant} className={config.className}>
        {source}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Biometric Attendance & Salary Management</h1>
          <p className="text-muted-foreground mt-1">
            Live attendance tracking with enhanced 20-minute merge logic, biometric data processing, and salary calculations
          </p>
          <p className="text-xs text-blue-600 mt-1">
            ✨ New: Intelligent workflow + biometric merging with identity resolution and time tolerance
          </p>
        </div>
        <Button onClick={() => {
          fetchKPIs();
          fetchSalaryData();
          fetchDetailedLogs();
          fetchEmployeeAggregates();
        }}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* KPI Cards */}
      {kpis && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.totalEmployees}</div>
              <p className="text-xs text-muted-foreground">
                Present: {kpis.presentToday} | Absent: {kpis.absentToday}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Present Today</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{kpis.presentToday}</div>
              <p className="text-xs text-muted-foreground">
                Late: {kpis.lateToday} | WFH: {kpis.wfhToday}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Hours Today</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.averageHoursToday.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground">
                Total: {kpis.totalHoursToday.toFixed(1)} hrs | OT: {kpis.overtimeToday.toFixed(1)} hrs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estimated Payroll</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₹{salaryData?.grandTotal?.totalPayable?.toFixed(2) || '0.00'}
              </div>
              <p className="text-xs text-muted-foreground">
                For selected period
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Tabs */}
      <Tabs defaultValue="upload" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upload">
            <Upload className="w-4 h-4 mr-2" />
            Upload Data
          </TabsTrigger>
          <TabsTrigger value="salary">
            <DollarSign className="w-4 h-4 mr-2" />
            Salary Calculation
          </TabsTrigger>
          <TabsTrigger value="logs">
            <FileText className="w-4 h-4 mr-2" />
            Detailed Logs
          </TabsTrigger>
          <TabsTrigger value="aggregates">
            <TrendingUp className="w-4 h-4 mr-2" />
            Employee Summary
          </TabsTrigger>
          <TabsTrigger value="holidays">
            <Calendar className="w-4 h-4 mr-2" />
            Public Holidays
          </TabsTrigger>
          <TabsTrigger value="paidLeaves">
            <CheckCircle className="w-4 h-4 mr-2" />
            Paid Leaves
          </TabsTrigger>
          <TabsTrigger value="hourlyRates">
            <Settings className="w-4 h-4 mr-2" />
            Hourly Rates
          </TabsTrigger>
        </TabsList>

        {/* Upload Tab */}
        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upload Biometric Data</CardTitle>
              <CardDescription>
                Upload CSV or Excel files containing biometric punch data. The system will automatically parse and map employee records.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="file">Select File (CSV or Excel)</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                />
                <p className="text-xs text-muted-foreground">
                  Expected columns: Employee ID, Biometric ID, Punch Time, Device ID, Location
                </p>
              </div>

              <Button
                onClick={handleFileUpload}
                disabled={loading || !uploadFile}
                className="w-full"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload & Process
                  </>
                )}
              </Button>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Derive Daily Attendance</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  After uploading biometric punches, click here to process them with our enhanced merge logic:
                  <br/>
                  <span className="font-semibold text-blue-600">
                    • 20-minute tolerance for matching workflow & biometric times
                  </span>
                  <br/>
                  • Intelligent time source selection (Bio IN preferred, Workflow OUT)
                  <br/>
                  • Automatic handling of missing data scenarios
                </p>
                <Button
                  onClick={handleDeriveAttendance}
                  disabled={loading}
                  variant="outline"
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Derive Attendance from Punches
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Upload History */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Uploads</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Name</TableHead>
                    <TableHead>Upload Date</TableHead>
                    <TableHead>Records</TableHead>
                    <TableHead>Matches</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uploadHistory.length > 0 ? (
                    uploadHistory.map((upload) => (
                      <TableRow key={upload._id}>
                        <TableCell className="font-medium">{upload.originalFileName}</TableCell>
                        <TableCell>{formatDateTime(upload.uploadDate)}</TableCell>
                        <TableCell>{upload.totalRecords}</TableCell>
                        <TableCell>{upload.successfulMatches}</TableCell>
                        <TableCell>
                          <Badge variant={upload.status === 'Completed' ? 'default' : 'secondary'}>
                            {upload.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No uploads yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Salary Tab */}
        <TabsContent value="salary" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept._id} value={dept._id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Work Type</Label>
                  <Select value={selectedWorkType} onValueChange={setSelectedWorkType}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="Office">Office</SelectItem>
                      <SelectItem value="WFH">WFH</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={handleExportSalary} variant="outline" className="w-full">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Grand Total */}
          {salaryData && (
            <Card>
              <CardHeader>
                <CardTitle>Grand Total Summary</CardTitle>
                <CardDescription>
                  Period: {formatDate(dateRange.startDate)} - {formatDate(dateRange.endDate)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Employees</p>
                    <p className="text-2xl font-bold">{salaryData.grandTotal.totalEmployees}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Present Days</p>
                    <p className="text-2xl font-bold text-green-600">{salaryData.grandTotal.totalPresentDays}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Hours</p>
                    <p className="text-2xl font-bold">{salaryData.grandTotal.totalHours.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Overtime Hours</p>
                    <p className="text-2xl font-bold text-orange-600">{salaryData.grandTotal.totalOvertimeHours.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Payable</p>
                    <p className="text-2xl font-bold text-blue-600">₹{salaryData.grandTotal.totalPayable.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Employee-wise Salary */}
          <Card>
            <CardHeader>
              <CardTitle>Employee-wise Salary Details</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Present</TableHead>
                    <TableHead className="text-right">Absent</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">OT Hours</TableHead>
                    <TableHead className="text-right">Regular Pay</TableHead>
                    <TableHead className="text-right">OT Pay</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salaryData?.employees?.length > 0 ? (
                    salaryData.employees.map((emp) => (
                      <TableRow key={emp.user._id}>
                        <TableCell className="font-medium">{emp.user.name}</TableCell>
                        <TableCell>{emp.user.department?.name || 'N/A'}</TableCell>
                        <TableCell className="text-right">{emp.summary.presentDays}</TableCell>
                        <TableCell className="text-right">{emp.summary.absentDays}</TableCell>
                        <TableCell className="text-right">{emp.summary.totalHours.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{emp.summary.overtimeHours.toFixed(1)}</TableCell>
                        <TableCell className="text-right">₹{emp.summary.regularPay.toFixed(2)}</TableCell>
                        <TableCell className="text-right">₹{emp.summary.overtimePay.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-bold">₹{emp.summary.totalPayable.toFixed(2)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        {loading ? 'Loading...' : 'No data available for selected period'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Detailed Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept._id} value={dept._id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Work Type</Label>
                  <Select value={selectedWorkType} onValueChange={setSelectedWorkType}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="Office">Office</SelectItem>
                      <SelectItem value="WFH">WFH</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="Present">Present</SelectItem>
                      <SelectItem value="Absent">Absent</SelectItem>
                      <SelectItem value="Half Day">Half Day</SelectItem>
                      <SelectItem value="Late">Late</SelectItem>
                      <SelectItem value="On Leave">On Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={handleExportLogs} variant="outline" className="w-full">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Logs Table */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Attendance Logs</CardTitle>
              <CardDescription>
                Showing {detailedLogs.length} records
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[600px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Final In</TableHead>
                      <TableHead>Final Out</TableHead>
                      <TableHead className="text-right">Worked Hrs</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailedLogs.length > 0 ? (
                      detailedLogs.map((log) => (
                        <TableRow key={log._id}>
                          <TableCell>{formatDate(log.date)}</TableCell>
                          <TableCell className="font-medium">{log.user?.name}</TableCell>
                          <TableCell>
                            {typeof log.user?.department === 'object' 
                              ? log.user?.department?.name 
                              : log.user?.department || 'N/A'}
                          </TableCell>
                          <TableCell>
                            {log.biometricTimeIn
                              ? new Date(log.biometricTimeIn).toLocaleTimeString('en-IN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  timeZone: 'Asia/Kolkata'
                                })
                              : 'N/A'}
                          </TableCell>
                          <TableCell>
                            {log.biometricTimeOut
                              ? new Date(log.biometricTimeOut).toLocaleTimeString('en-IN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  timeZone: 'Asia/Kolkata'
                                })
                              : 'N/A'}
                          </TableCell>
                          <TableCell className="text-right">
                            {log.totalHoursWorked?.toFixed(2) || '0.00'}
                          </TableCell>
                          <TableCell>
                            {getRemarksBadge(log.remarks)}
                          </TableCell>
                          <TableCell>
                            {getSourceBadge(log.source)}
                          </TableCell>
                          <TableCell>{getStatusBadge(log.status)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground">
                          No logs available
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aggregates Tab */}
        <TabsContent value="aggregates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Employee Summary ({dateRange.startDate} to {dateRange.endDate})</CardTitle>
              <CardDescription>
                Aggregated attendance and salary data by employee
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Present</TableHead>
                    <TableHead className="text-right">Absent</TableHead>
                    <TableHead className="text-right">Half Day</TableHead>
                    <TableHead className="text-right">Leave</TableHead>
                    <TableHead className="text-right">Late</TableHead>
                    <TableHead className="text-right">Total Hrs</TableHead>
                    <TableHead className="text-right">OT Hrs</TableHead>
                    <TableHead className="text-right">Earned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeeAggregates.length > 0 ? (
                    employeeAggregates.map((agg) => (
                      <TableRow key={agg._id}>
                        <TableCell className="font-medium">{agg.userName}</TableCell>
                        <TableCell>{agg.departmentName || 'N/A'}</TableCell>
                        <TableCell className="text-right">{agg.presentDays}</TableCell>
                        <TableCell className="text-right">{agg.absentDays}</TableCell>
                        <TableCell className="text-right">{agg.halfDays}</TableCell>
                        <TableCell className="text-right">{agg.leaveDays}</TableCell>
                        <TableCell className="text-right">{agg.lateDays}</TableCell>
                        <TableCell className="text-right">{agg.totalHours}</TableCell>
                        <TableCell className="text-right">{agg.overtimeHours}</TableCell>
                        <TableCell className="text-right font-bold">
                          ₹{agg.totalEarned.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground">
                        No data available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Public Holidays Tab */}
        <TabsContent value="holidays" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Manage Public Holidays</CardTitle>
              <CardDescription>Add paid public holidays that count as working hours in salary calculation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={holidayForm.date}
                    onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Holiday Name</Label>
                  <Input
                    placeholder="e.g., Independence Day"
                    value={holidayForm.name}
                    onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    placeholder="Optional description"
                    value={holidayForm.description}
                    onChange={(e) => setHolidayForm({ ...holidayForm, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Paid Holiday</Label>
                  <Select
                    value={holidayForm.isPaidLeave ? 'yes' : 'no'}
                    onValueChange={(value) => setHolidayForm({ ...holidayForm, isPaidLeave: value === 'yes' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes (Count in Salary)</SelectItem>
                      <SelectItem value="no">No (Unpaid)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-4">
                  <Button onClick={handleAddHoliday} disabled={loading || !holidayForm.date || !holidayForm.name}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Public Holiday
                  </Button>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Holiday Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {publicHolidays.length > 0 ? (
                    publicHolidays.map((holiday) => (
                      <TableRow key={holiday._id}>
                        <TableCell>{formatDate(holiday.date)}</TableCell>
                        <TableCell className="font-medium">{holiday.name}</TableCell>
                        <TableCell>{holiday.description || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={holiday.isPaidLeave ? 'default' : 'secondary'}>
                            {holiday.isPaidLeave ? 'Paid' : 'Unpaid'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteHoliday(holiday._id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No public holidays configured
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Paid Leaves Tab */}
        <TabsContent value="paidLeaves" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Manage Paid Leaves</CardTitle>
              <CardDescription>Mark specific dates as paid leave for employees (counts as working hours)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-muted rounded-lg">
                <div className="space-y-2">
                  <Label>Employee</Label>
                  <Select
                    value={leaveForm.userId}
                    onValueChange={(value) => setLeaveForm({ ...leaveForm, userId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user._id} value={user._id}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={leaveForm.date}
                    onChange={(e) => setLeaveForm({ ...leaveForm, date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hours</Label>
                  <Input
                    type="number"
                    min="0"
                    max="24"
                    value={leaveForm.hours}
                    onChange={(e) => setLeaveForm({ ...leaveForm, hours: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Leave Type</Label>
                  <Select
                    value={leaveForm.leaveType}
                    onValueChange={(value) => setLeaveForm({ ...leaveForm, leaveType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Paid Leave">Paid Leave</SelectItem>
                      <SelectItem value="Sick Leave">Sick Leave</SelectItem>
                      <SelectItem value="Casual Leave">Casual Leave</SelectItem>
                      <SelectItem value="Compensatory Off">Compensatory Off</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Input
                    placeholder="Optional reason"
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  />
                </div>
                <div className="md:col-span-5">
                  <Button onClick={handleAddPaidLeave} disabled={loading || !leaveForm.userId || !leaveForm.date}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Paid Leave
                  </Button>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Leave Type</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paidLeaves.length > 0 ? (
                    paidLeaves.map((leave) => (
                      <TableRow key={leave._id}>
                        <TableCell className="font-medium">{leave.user?.name}</TableCell>
                        <TableCell>{formatDate(leave.date)}</TableCell>
                        <TableCell>{leave.hours}h</TableCell>
                        <TableCell>
                          <Badge>{leave.leaveType}</Badge>
                        </TableCell>
                        <TableCell>{leave.reason || '-'}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeletePaidLeave(leave._id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No paid leaves configured
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hourly Rates Tab */}
        <TabsContent value="hourlyRates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Employee Hourly Rates</CardTitle>
              <CardDescription>Manage per-employee hourly rates and salary configurations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                <div className="space-y-2">
                  <Label>Employee</Label>
                  <Select
                    value={rateForm.userId}
                    onValueChange={(value) => {
                      const emp = employeeRates.find(e => e.userId === value);
                      setRateForm({
                        userId: value,
                        hourlyRate: emp?.hourlyRate || 0,
                        monthlySalary: emp?.monthlySalary || 0,
                        salaryType: emp?.salaryType || 'Monthly'
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user._id} value={user._id}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Salary Type</Label>
                  <Select
                    value={rateForm.salaryType}
                    onValueChange={(value) => setRateForm({ ...rateForm, salaryType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                      <SelectItem value="Hourly">Hourly</SelectItem>
                      <SelectItem value="Daily">Daily</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Monthly Salary (₹)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={rateForm.monthlySalary}
                    onChange={(e) => setRateForm({ ...rateForm, monthlySalary: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hourly Rate (₹)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={rateForm.hourlyRate}
                    onChange={(e) => setRateForm({ ...rateForm, hourlyRate: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="md:col-span-4">
                  <Button onClick={handleUpdateHourlyRate} disabled={loading || !rateForm.userId}>
                    <Edit className="w-4 h-4 mr-2" />
                    Update Employee Rate
                  </Button>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Salary Type</TableHead>
                    <TableHead>Monthly Salary</TableHead>
                    <TableHead>Hourly Rate</TableHead>
                    <TableHead>Calculated Hourly</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeeRates.length > 0 ? (
                    employeeRates.map((emp) => (
                      <TableRow key={emp.userId}>
                        <TableCell>{emp.employeeId}</TableCell>
                        <TableCell className="font-medium">{emp.name}</TableCell>
                        <TableCell>{emp.department || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{emp.salaryType}</Badge>
                        </TableCell>
                        <TableCell>₹{emp.monthlySalary?.toLocaleString() || 0}</TableCell>
                        <TableCell>₹{emp.hourlyRate?.toFixed(2) || 0}</TableCell>
                        <TableCell className="font-semibold">₹{emp.calculatedHourlyRate?.toFixed(2) || 0}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No employee rate data available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BiometricAttendanceDashboard;
