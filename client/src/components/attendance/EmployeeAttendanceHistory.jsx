import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  TrendingUp,
  CheckCircle,
  XCircle,
  MapPin,
  Target,
  Award,
  ChevronDown,
  ChevronUp,
  X,
  User,
  BarChart3,
  DollarSign
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import api from '../../lib/api';
import { useToast } from '../../hooks/use-toast';
import { formatDate } from '../../lib/dateFormat';

const EmployeeAttendanceHistory = ({ userId, userName, onClose }) => {
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedDay, setExpandedDay] = useState(null);
  const [dateRange, setDateRange] = useState('30'); // Last 30 days by default
  const { toast } = useToast();

  useEffect(() => {
    if (userId) {
      fetchEmployeeHistory();
    }
  }, [userId, dateRange]);

  const fetchEmployeeHistory = async () => {
    try {
      setLoading(true);
      
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - parseInt(dateRange));

      const response = await api.get(`/attendance-dashboard/employee-history/${userId}`, {
        params: {
          from: startDate.toISOString(),
          to: endDate.toISOString(),
          limit: parseInt(dateRange)
        }
      });

      if (response.data.success) {
        setHistoryData(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching employee history:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch employee attendance history',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (time) => {
    if (!time) return 'N/A';
    return new Date(time).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'present':
        return 'bg-green-500';
      case 'absent':
        return 'bg-red-500';
      case 'half day':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (isPresent) => {
    return isPresent ? (
      <CheckCircle className="w-4 h-4 text-green-500" />
    ) : (
      <XCircle className="w-4 h-4 text-red-500" />
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!historyData) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-500">No attendance history found</p>
      </div>
    );
  }

  const { user, history, summary } = historyData;

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback className="text-lg font-semibold">
              {user.name?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {user.name}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
              {user.employeeId && (
                <Badge variant="outline" className="text-xs">
                  ID: {user.employeeId}
                </Badge>
              )}
              {user.department && (
                <Badge 
                  className={`${user.department.color} text-white text-xs`}
                >
                  {user.department.name}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Date Range Selector */}
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="60">Last 60 days</option>
            <option value="90">Last 90 days</option>
          </select>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Attendance Rate</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {summary.attendancePercentage}%
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {summary.presentDays} / {summary.totalDays} days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Avg Hours/Day</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {summary.averageHoursPerDay}h
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Total: {summary.totalHoursWorked}h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">AIMS Completion</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {summary.daysWithAims}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                <Target className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Days with AIMS
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Earnings</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  ₹{summary.totalEarnings}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              For this period
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Day-wise History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Day-wise Attendance History
          </CardTitle>
          <CardDescription>
            Detailed breakdown of daily attendance from {summary.period.from} to {summary.period.to}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {history.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No attendance records found</p>
            ) : (
              history.map((day, index) => (
                <motion.div
                  key={day.date}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <Card className={`${
                    day.isPresent 
                      ? 'border-l-4 border-l-green-500' 
                      : 'border-l-4 border-l-red-500'
                  } cursor-pointer hover:shadow-md transition-shadow`}
                  onClick={() => setExpandedDay(expandedDay === day.date ? null : day.date)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="text-center min-w-[60px]">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {day.dayOfWeek}
                            </p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                              {new Date(day.date).getDate()}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {formatDate(day.date)}
                            </p>
                          </div>

                          <div className="flex-1 grid grid-cols-4 gap-4">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(day.isPresent)}
                              <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                                <Badge className={`${getStatusColor(day.status)} text-white text-xs`}>
                                  {day.status}
                                </Badge>
                              </div>
                            </div>

                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Start Time</p>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {formatTime(day.startTime)}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Hours Worked</p>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {day.totalHours.toFixed(2)}h
                              </p>
                              {day.overtimeHours > 0 && (
                                <p className="text-xs text-green-600">+{day.overtimeHours.toFixed(2)}h OT</p>
                              )}
                            </div>

                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Location</p>
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-gray-400" />
                                <p className="text-sm text-gray-900 dark:text-white">
                                  {day.workLocationType || 'N/A'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {day.hasAim && (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                              <Target className="w-3 h-3 mr-1" />
                              AIMS
                            </Badge>
                          )}
                          {expandedDay === day.date ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </div>

                      {/* Expanded Details */}
                      <AnimatePresence>
                        {expandedDay === day.date && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 pt-4 border-t space-y-3"
                          >
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                  Time Details
                                </p>
                                <div className="space-y-1">
                                  <p className="text-sm text-gray-700 dark:text-gray-300">
                                    <span className="font-medium">Start:</span> {formatTime(day.startTime)}
                                  </p>
                                  <p className="text-sm text-gray-700 dark:text-gray-300">
                                    <span className="font-medium">End:</span> {formatTime(day.endTime)}
                                  </p>
                                  <p className="text-sm text-gray-700 dark:text-gray-300">
                                    <span className="font-medium">Regular:</span> {day.regularHours.toFixed(2)}h
                                  </p>
                                  {day.overtimeHours > 0 && (
                                    <p className="text-sm text-green-600">
                                      <span className="font-medium">Overtime:</span> {day.overtimeHours.toFixed(2)}h
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                  Earnings
                                </p>
                                <p className="text-lg font-bold text-green-600">
                                  ₹{day.earnedAmount.toFixed(2)}
                                </p>
                              </div>
                            </div>

                            {day.location && (
                              <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                  Location
                                </p>
                                <div className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                                  <MapPin className="w-4 h-4 text-blue-500 mt-0.5" />
                                  <span>{day.location.address || 'Location tracked'}</span>
                                </div>
                              </div>
                            )}

                            {day.aimDetails && (
                              <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                  Daily AIMS
                                </p>
                                <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200">
                                  <CardContent className="p-3 space-y-2">
                                    <p className="text-sm text-gray-700 dark:text-gray-300">
                                      {day.aimDetails.aims}
                                    </p>
                                    <div className="flex items-center justify-between">
                                      <Badge className="bg-purple-600 text-white">
                                        {day.aimDetails.completionStatus}
                                      </Badge>
                                      <span className="text-xs text-gray-500">
                                        {day.aimDetails.progressPercentage}% Complete
                                      </span>
                                    </div>
                                    {day.aimDetails.completionComment && (
                                      <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                                        "{day.aimDetails.completionComment}"
                                      </p>
                                    )}
                                  </CardContent>
                                </Card>
                              </div>
                            )}

                            {day.notes && (
                              <div>
                                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                  Notes
                                </p>
                                <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                                  {day.notes}
                                </p>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeAttendanceHistory;
