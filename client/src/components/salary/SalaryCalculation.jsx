import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Calculator, CalendarIcon, X, Users, CheckCircle, CheckCheck } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth-context';

const SalaryCalculation = ({ userId, onConfirmSalary, persistedState, onStateChange }) => {
  const { user } = useAuth();
  
  // Use persisted state if available, otherwise use default values
  const [startDate, setStartDate] = useState(persistedState?.startDate || null);
  const [endDate, setEndDate] = useState(persistedState?.endDate || null);
  const [holidays, setHolidays] = useState(persistedState?.holidays || []);
  const [usersData, setUsersData] = useState(persistedState?.usersData || []);
  const [userRates, setUserRates] = useState(persistedState?.userRates || {}); // userId -> perHourRate
  const [holidayHours, setHolidayHours] = useState((persistedState?.holidays?.length || 0) * 8);
  const [statusTab, setStatusTab] = useState('active');
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedUserForConfirm, setSelectedUserForConfirm] = useState(null);
  const [confirmSalaryValue, setConfirmSalaryValue] = useState('');
  const [confirmNotes, setConfirmNotes] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const { toast } = useToast();

  // Persist state changes to parent component
  const persistState = useCallback(() => {
    if (onStateChange) {
      onStateChange({
        startDate,
        endDate,
        holidays,
        userRates,
        usersData
      });
    }
  }, [startDate, endDate, holidays, userRates, usersData, onStateChange]);

  // Save state whenever it changes
  useEffect(() => {
    persistState();
  }, [startDate, endDate, holidays, userRates, persistState]);

  // Fetch all users with their hours when date range changes
  useEffect(() => {
    if (startDate && endDate && user?.role === 'Admin') {
      // Only fetch if we don't have data or dates changed
      if (usersData.length === 0 || 
          persistedState?.startDate?.getTime?.() !== startDate?.getTime?.() ||
          persistedState?.endDate?.getTime?.() !== endDate?.getTime?.()) {
        fetchAllUsersHours();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, user?.role]);

  // Calculate holiday hours when holidays change
  useEffect(() => {
    setHolidayHours(holidays.length * 8);
  }, [holidays]);

  // Calculate salary for each user when rates or hours change
  useEffect(() => {
    const updatedUsers = usersData.map(userData => {
      const perHourRate = parseFloat(userRates[userData.userId] || 0);
      const totalCumulativeHours = (userData.cumulativeHours || 0) + holidayHours;
      const calculatedSalary = perHourRate > 0 && totalCumulativeHours > 0 
        ? perHourRate * totalCumulativeHours 
        : 0;
      
      return {
        ...userData,
        perHourRate,
        totalCumulativeHours,
        calculatedSalary
      };
    });
    setUsersData(updatedUsers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRates, holidayHours]);

  const activeUsersCount = usersData.filter(u => u.stillExist === undefined || u.stillExist === 1).length;
  const exitedUsersCount = usersData.filter(u => u.stillExist === 0).length;
  const filteredUsersData = usersData.filter(u => {
    if (statusTab === 'active') return u.stillExist === undefined || u.stillExist === 1;
    if (statusTab === 'exited') return u.stillExist === 0;
    return true;
  });

  const fetchAllUsersHours = async () => {
    if (!startDate || !endDate) return;

    setLoading(true);
    try {
      const response = await api.get('/new-salary/hours/all', {
        params: {
          fromDate: format(startDate, 'yyyy-MM-dd'),
          toDate: format(endDate, 'yyyy-MM-dd')
        }
      });

      if (response.success) {
        const users = response.data.users || [];
        setUsersData(users);
        
        // Initialize rates object with empty values
        const initialRates = {};
        users.forEach(u => {
          initialRates[u.userId] = userRates[u.userId] || '';
        });
        setUserRates(initialRates);
      }
    } catch (error) {
      console.error('Error fetching users hours:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch users hours',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddHoliday = (date) => {
    if (!date) return;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    if (!holidays.includes(dateStr)) {
      setHolidays([...holidays, dateStr]);
    }
  };

  const handleRemoveHoliday = (dateStr) => {
    setHolidays(holidays.filter(h => h !== dateStr));
  };

  const handleRateChange = (userId, value) => {
    setUserRates(prev => ({
      ...prev,
      [userId]: value
    }));
  };

  const handleCalculateAllSalaries = async () => {
    if (!startDate || !endDate) {
      toast({
        title: 'Validation Error',
        description: 'Please select date range',
        variant: 'destructive'
      });
      return;
    }

    // Validate that all users with hours have rates
    const usersWithHours = usersData.filter(u => u.cumulativeHours > 0);
    const usersWithoutRates = usersWithHours.filter(u => !userRates[u.userId] || parseFloat(userRates[u.userId]) <= 0);

    if (usersWithoutRates.length > 0) {
      toast({
        title: 'Validation Error',
        description: `Please enter per hour rate for: ${usersWithoutRates.map(u => u.name).join(', ')}`,
        variant: 'destructive'
      });
      return;
    }

    setCalculating(true);
    try {
      // Calculate salary for each user
      const calculations = usersWithHours.map(userData => {
        const perHourRate = parseFloat(userRates[userData.userId]);
        const totalCumulativeHours = (userData.cumulativeHours || 0) + holidayHours;
        const calculatedSalary = perHourRate * totalCumulativeHours;

        return {
          userId: userData.userId,
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: format(endDate, 'yyyy-MM-dd'),
          holidays: holidays,
          perHourRate: perHourRate,
          workingHours: userData.cumulativeHours || 0,
          holidayHours: holidayHours,
          totalCumulativeHours: totalCumulativeHours,
          calculatedSalary: calculatedSalary
        };
      });

      // Save all calculations
      const savePromises = calculations.map(calc => 
        api.post('/new-salary/calculate', calc)
      );

      await Promise.all(savePromises);

      toast({
        title: 'Success',
        description: `Salary calculated and saved for ${calculations.length} employees`,
      });
      
      // Refresh data
      setTimeout(() => {
        fetchAllUsersHours();
      }, 1000);
    } catch (error) {
      console.error('Error calculating salaries:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to calculate salaries',
        variant: 'destructive'
      });
    } finally {
      setCalculating(false);
    }
  };

  // Open confirm dialog for a specific user
  const handleOpenConfirmDialog = (userData) => {
    if (!userData.calculatedSalary || userData.calculatedSalary <= 0) {
      toast({
        title: 'Cannot Confirm',
        description: 'Please enter rate and calculate salary first',
        variant: 'destructive'
      });
      return;
    }

    // First save the calculation, then open confirm dialog
    handleSaveAndConfirm(userData);
  };

  // Save calculation and then confirm
  const handleSaveAndConfirm = async (userData) => {
    if (!startDate || !endDate) {
      toast({
        title: 'Validation Error',
        description: 'Please select date range',
        variant: 'destructive'
      });
      return;
    }

    const perHourRate = parseFloat(userRates[userData.userId]);
    if (!perHourRate || perHourRate <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid per hour rate',
        variant: 'destructive'
      });
      return;
    }

    setCalculating(true);
    try {
      const totalCumulativeHours = (userData.cumulativeHours || 0) + holidayHours;
      const calculatedSalary = perHourRate * totalCumulativeHours;

      // Save the calculation first
      const calcResponse = await api.post('/new-salary/calculate', {
        userId: userData.userId,
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        holidays: holidays,
        perHourRate: perHourRate,
        workingHours: userData.cumulativeHours || 0,
        holidayHours: holidayHours,
        totalCumulativeHours: totalCumulativeHours,
        calculatedSalary: calculatedSalary
      });

      if (calcResponse.success) {
        // Now open confirm dialog with the record ID
        setSelectedUserForConfirm({
          ...userData,
          recordId: calcResponse.data.salaryRecord._id,
          calculatedSalary: calculatedSalary,
          perHourRate: perHourRate,
          totalCumulativeHours: totalCumulativeHours
        });
        setConfirmSalaryValue(calculatedSalary.toFixed(2));
        setConfirmNotes('');
        setConfirmDialogOpen(true);
      }
    } catch (error) {
      console.error('Error saving calculation:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to save calculation',
        variant: 'destructive'
      });
    } finally {
      setCalculating(false);
    }
  };

  // Confirm the salary
  const handleConfirmSalary = async () => {
    if (!selectedUserForConfirm || !selectedUserForConfirm.recordId) {
      toast({
        title: 'Error',
        description: 'No salary record to confirm',
        variant: 'destructive'
      });
      return;
    }

    setConfirming(true);
    try {
      const response = await api.put(`/new-salary/confirm/${selectedUserForConfirm.recordId}`, {
        confirmedSalary: parseFloat(confirmSalaryValue),
        confirmationNotes: confirmNotes
      });

      if (response.success) {
        toast({
          title: 'Salary Confirmed',
          description: `Salary confirmed for ${selectedUserForConfirm.name}`,
        });
        
        // Remove the confirmed user from the list
        const confirmedUserId = selectedUserForConfirm.userId;
        setUsersData(prevUsers => prevUsers.filter(u => u.userId !== confirmedUserId));
        
        // Also remove from userRates
        setUserRates(prevRates => {
          const newRates = { ...prevRates };
          delete newRates[confirmedUserId];
          return newRates;
        });
        
        setConfirmDialogOpen(false);
        setSelectedUserForConfirm(null);
        
        // Navigate to confirm tab
        if (onConfirmSalary) {
          onConfirmSalary();
        }
      }
    } catch (error) {
      console.error('Error confirming salary:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to confirm salary',
        variant: 'destructive'
      });
    } finally {
      setConfirming(false);
    }
  };

  // Confirm all users with rates entered
  const handleConfirmAll = async () => {
    if (!startDate || !endDate) {
      toast({
        title: 'Validation Error',
        description: 'Please select date range',
        variant: 'destructive'
      });
      return;
    }

    // Get users who have rates entered and have working hours
    const usersToConfirm = usersData.filter(u => {
      const rate = parseFloat(userRates[u.userId] || 0);
      return rate > 0 && u.cumulativeHours > 0;
    });

    if (usersToConfirm.length === 0) {
      toast({
        title: 'No Users to Confirm',
        description: 'Please enter rates for users first',
        variant: 'destructive'
      });
      return;
    }

    setConfirmingAll(true);
    let confirmedCount = 0;
    const confirmedUserIds = [];

    try {
      for (const userData of usersToConfirm) {
        const perHourRate = parseFloat(userRates[userData.userId]);
        const totalCumulativeHours = (userData.cumulativeHours || 0) + holidayHours;
        const calculatedSalary = perHourRate * totalCumulativeHours;

        // First save the calculation
        const calcResponse = await api.post('/new-salary/calculate', {
          userId: userData.userId,
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: format(endDate, 'yyyy-MM-dd'),
          holidays: holidays,
          perHourRate: perHourRate,
          workingHours: userData.cumulativeHours || 0,
          holidayHours: holidayHours,
          totalCumulativeHours: totalCumulativeHours,
          calculatedSalary: calculatedSalary
        });

        if (calcResponse.success) {
          // Then confirm the salary
          const confirmResponse = await api.put(`/new-salary/confirm/${calcResponse.data.salaryRecord._id}`, {
            confirmedSalary: calculatedSalary,
            confirmationNotes: 'Bulk confirmed'
          });

          if (confirmResponse.success) {
            confirmedCount++;
            confirmedUserIds.push(userData.userId);
          }
        }
      }

      if (confirmedCount > 0) {
        toast({
          title: 'Success',
          description: `Successfully confirmed salary for ${confirmedCount} employee(s)`,
        });

        // Remove confirmed users from the list
        setUsersData(prevUsers => prevUsers.filter(u => !confirmedUserIds.includes(u.userId)));
        
        // Also remove from userRates
        setUserRates(prevRates => {
          const newRates = { ...prevRates };
          confirmedUserIds.forEach(id => delete newRates[id]);
          return newRates;
        });

        // Navigate to confirm tab
        if (onConfirmSalary) {
          onConfirmSalary();
        }
      }
    } catch (error) {
      console.error('Error confirming salaries:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to confirm some salaries',
        variant: 'destructive'
      });
    } finally {
      setConfirmingAll(false);
    }
  };

  // Get count of users ready to confirm (have rate entered)
  const usersReadyToConfirm = usersData.filter(u => {
    const rate = parseFloat(userRates[u.userId] || 0);
    return rate > 0 && u.cumulativeHours > 0;
  });

  return (
    <Card className="neo-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          Salary Calculation
        </CardTitle>
        <CardDescription>
          Calculate salary based on working hours, holidays, and hourly rate
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Date Range Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">Start Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="startDate"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">End Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="endDate"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Holiday Selection */}
        <div className="space-y-2">
          <Label>Holidays (Each = 8 hours)</Label>
          <div className="flex gap-2 flex-wrap">
            {holidays.map((holiday, index) => (
              <Badge key={index} variant="secondary" className="px-3 py-1">
                {format(new Date(holiday), 'dd MMM yyyy')}
                <button
                  onClick={() => handleRemoveHoliday(holiday)}
                  className="ml-2 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Add Holiday
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  onSelect={handleAddHoliday}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <p className="text-xs text-muted-foreground">
            Selected holidays: {holidays.length} ({holidays.length * 8} hours)
          </p>
        </div>

        {/* Holiday Hours Summary */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Holiday Hours (All Users):</span>
              <span className="font-semibold">{holidayHours} hrs</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Selected holidays: {holidays.length} (Each = 8 hours)
            </p>
          </CardContent>
        </Card>

        {/* Users Table with Per Hour Rate */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading users data...
          </div>
        ) : usersData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No users found for the selected date range</p>
          </div>
        ) : (
          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Employees Salary Calculation</CardTitle>
                <CardDescription>
                  Enter per hour rate for each employee to calculate their salary
                </CardDescription>
              </div>
              <Tabs value={statusTab} onValueChange={setStatusTab}>
                <TabsList className="p-1 border border-border/40 text-xs">
                  <TabsTrigger
                    value="active"
                    className="px-2 py-1 text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white dark:data-[state=active]:bg-emerald-500 dark:data-[state=active]:text-zinc-950 font-semibold transition-colors"
                  >
                    Active ({activeUsersCount})
                  </TabsTrigger>
                  <TabsTrigger
                    value="exited"
                    className="px-2 py-1 text-xs data-[state=active]:bg-red-600 data-[state=active]:text-white dark:data-[state=active]:bg-red-500 dark:data-[state=active]:text-zinc-950 font-semibold transition-colors"
                  >
                    Exited ({exitedUsersCount})
                  </TabsTrigger>
                  <TabsTrigger
                    value="all"
                    className="px-2 py-1 text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white dark:data-[state=active]:bg-blue-500 dark:data-[state=active]:text-zinc-950 font-semibold transition-colors"
                  >
                    All ({usersData.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[280px]">Employee Name & Per Hour Rate</TableHead>
                          <TableHead className="min-w-[150px]">Department</TableHead>
                          <TableHead className="text-right min-w-[120px]">Working Hours</TableHead>
                          <TableHead className="text-right min-w-[120px]">Holiday Hours</TableHead>
                          <TableHead className="text-right min-w-[120px]">Total Hours</TableHead>
                          <TableHead className="text-right min-w-[150px]">Calculated Salary</TableHead>
                          <TableHead className="text-center min-w-[130px]">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsersData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                              No employees found matching this status tab.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredUsersData.map((userData) => {
                            const totalHours = (userData.cumulativeHours || 0) + holidayHours;
                            const salary = userData.calculatedSalary || 0;
                            
                            return (
                              <TableRow key={userData.userId}>
                                <TableCell className="align-middle">
                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 min-w-[140px]">
                                      <span className="font-medium">{userData.name}</span>
                                      {userData.stillExist === 0 && (
                                        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400">
                                          Exited
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="relative flex-1 max-w-[140px]">
                                      <span className="absolute left-2 top-2.5 text-muted-foreground font-medium">₹</span>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="Rate"
                                        value={userRates[userData.userId] || ''}
                                        onChange={(e) => handleRateChange(userData.userId, e.target.value)}
                                        className="pl-7 h-9"
                                      />
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground align-middle">
                                  {userData.department || '-'}
                                </TableCell>
                                <TableCell className="text-right align-middle">
                                  {userData.cumulativeHours.toFixed(2)} hrs
                                </TableCell>
                                <TableCell className="text-right align-middle">
                                  {holidayHours} hrs
                                </TableCell>
                                <TableCell className="text-right font-semibold align-middle">
                                  {totalHours.toFixed(2)} hrs
                                </TableCell>
                                <TableCell className="text-right align-middle">
                                  {salary > 0 ? (
                                    <span className="font-bold text-primary">
                                      ₹{salary.toFixed(2)}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground text-sm">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center align-middle">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenConfirmDialog(userData)}
                                    disabled={!salary || salary <= 0 || calculating}
                                    className="bg-green-500/10 hover:bg-green-500/20 text-green-600 border-green-500/30"
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Confirm
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

        {/* Action Buttons */}
        {usersData.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleCalculateAllSalaries}
              disabled={calculating || confirmingAll || !startDate || !endDate || usersData.filter(u => u.cumulativeHours > 0).length === 0}
              className="flex-1"
              size="lg"
            >
              <Calculator className="h-4 w-4 mr-2" />
              {calculating ? 'Calculating & Saving...' : `Calculate & Save All (${usersData.filter(u => u.cumulativeHours > 0).length})`}
            </Button>
            
            {/* Confirm All Button */}
            <Button
              onClick={handleConfirmAll}
              disabled={confirmingAll || calculating || usersReadyToConfirm.length === 0}
              className="flex-1 bg-green-600 hover:bg-green-700"
              size="lg"
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              {confirmingAll ? 'Confirming All...' : `Confirm All (${usersReadyToConfirm.length})`}
            </Button>
          </div>
        )}

        {/* Confirm Salary Dialog */}
        <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Confirm Salary
              </DialogTitle>
              <DialogDescription>
                Review and confirm the salary for {selectedUserForConfirm?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Summary Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Working Hours</p>
                  <p className="font-semibold">{selectedUserForConfirm?.cumulativeHours?.toFixed(2) || 0} hrs</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Holiday Hours</p>
                  <p className="font-semibold">{holidayHours} hrs</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Hours</p>
                  <p className="font-semibold">{selectedUserForConfirm?.totalCumulativeHours?.toFixed(2) || 0} hrs</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Rate (₹/hr)</p>
                  <p className="font-semibold">₹{selectedUserForConfirm?.perHourRate || 0}</p>
                </div>
              </div>

              {/* Calculated Salary */}
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-sm text-muted-foreground">Calculated Salary</p>
                <p className="text-2xl font-bold text-blue-600">
                  ₹{selectedUserForConfirm?.calculatedSalary?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                </p>
              </div>

              {/* Confirm Salary Input */}
              <div className="space-y-2">
                <Label htmlFor="confirmSalary">Confirm Salary (You can adjust if needed)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground font-medium">₹</span>
                  <Input
                    id="confirmSalary"
                    type="number"
                    step="0.01"
                    min="0"
                    value={confirmSalaryValue}
                    onChange={(e) => setConfirmSalaryValue(e.target.value)}
                    className="pl-8 text-lg font-semibold"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="confirmNotes">Notes (Optional)</Label>
                <Textarea
                  id="confirmNotes"
                  placeholder="Add any notes about this salary confirmation..."
                  value={confirmNotes}
                  onChange={(e) => setConfirmNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmSalary} 
                disabled={confirming || !confirmSalaryValue}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {confirming ? 'Confirming...' : 'Confirm Salary'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default SalaryCalculation;

