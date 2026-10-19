import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, XCircle, Calendar, Filter, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { sortBySurname } from '@/utils/nameSorting';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

const SpamUsers = () => {
  const { user } = useAuth();
  const [spamUsers, setSpamUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState('validate'); // 'validate' or 'spam'
  const [reason, setReason] = useState('');
  const { toast } = useToast();

  // Set default date range (last 30 days)
  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    setToDate(format(today, 'yyyy-MM-dd'));
    setFromDate(format(thirtyDaysAgo, 'yyyy-MM-dd'));
  }, []);

  // Fetch spam users data
  useEffect(() => {
    if (fromDate && toDate) {
      fetchSpamUsers();
    }
  }, [fromDate, toDate]);

  const fetchSpamUsers = async () => {
    if (!fromDate || !toDate) return;

    setLoading(true);
    try {
      const response = await api.get('/new-salary/spam-users', {
        params: {
          fromDate: fromDate,
          toDate: toDate
        }
      });

      if (response.success) {
        setSpamUsers(sortBySurname(response.data?.spamUsers || []));
        
        if (response.data?.spamUsers?.length === 0) {
          toast({
            title: 'No Spam Records Found',
            description: `No auto-ended attendance records found for ${fromDate} to ${toDate}.`,
            variant: 'default'
          });
        }
      } else {
        throw new Error(response.error || 'Failed to fetch spam users');
      }
    } catch (error) {
      console.error('Error fetching spam users:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to fetch spam users data';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
      setSpamUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleValidateRecord = async (recordId, action) => {
    try {
      const response = await api.post('/new-salary/spam-users/validate', {
        recordId: recordId,
        action: action,
        reason: reason || (action === 'validate' ? 'Validated by admin' : 'Marked as spam by admin')
      });

      if (response.success) {
        toast({
          title: 'Success',
          description: response.message,
          variant: 'success'
        });
        
        // Refresh data after a short delay to ensure backend has processed
        setTimeout(() => {
          fetchSpamUsers();
        }, 500);
        
        setActionDialogOpen(false);
        setReason('');
        setSelectedRecord(null);
      } else {
        throw new Error(response.error || 'Failed to validate record');
      }
    } catch (error) {
      console.error('Error validating record:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.error || error.message || 'Failed to validate record',
        variant: 'destructive'
      });
    }
  };

  const handleBulkAction = async (recordIds, action) => {
    if (!recordIds || recordIds.length === 0) {
      toast({
        title: 'No Records Selected',
        description: 'Please select at least one record to perform bulk action.',
        variant: 'default'
      });
      return;
    }

    try {
      const response = await api.post('/new-salary/spam-users/bulk-validate', {
        recordIds: recordIds,
        action: action,
        reason: reason || (action === 'validate' ? 'Bulk validated by admin' : 'Bulk marked as spam by admin')
      });

      if (response.success) {
        toast({
          title: 'Success',
          description: response.message,
          variant: 'success'
        });
        
        // Refresh data after a short delay to ensure backend has processed
        setTimeout(() => {
          fetchSpamUsers();
        }, 500);
        
        setReason('');
      } else {
        throw new Error(response.error || 'Failed to perform bulk action');
      }
    } catch (error) {
      console.error('Error performing bulk action:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.error || error.message || 'Failed to perform bulk action',
        variant: 'destructive'
      });
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'Valid': { variant: 'default', className: 'bg-green-100 text-green-800', icon: CheckCircle },
      'Spam': { variant: 'destructive', className: 'bg-red-100 text-red-800', icon: XCircle },
      'Pending Review': { variant: 'default', className: 'bg-orange-100 text-orange-800', icon: AlertTriangle },
      'Suspicious': { variant: 'default', className: 'bg-yellow-100 text-yellow-800', icon: AlertCircle }
    };

    const config = statusConfig[status] || statusConfig['Pending Review'];
    const Icon = config.icon;

    return (
      <Badge className={config.className}>
        <Icon className="h-3 w-3 mr-1" />
        {status}
      </Badge>
    );
  };

  const formatTime = (dateString) => {
    if (!dateString) return 'N/A';
    return format(new Date(dateString), 'HH:mm:ss');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return format(new Date(dateString), 'dd MMM yyyy');
  };

  return (
    <Card className="neo-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Spam Users Management
        </CardTitle>
        <CardDescription>
          Review and manage auto-ended attendance records
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date Range Filter */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fromDate">From Date</Label>
            <Input
              id="fromDate"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="toDate">To Date</Label>
            <Input
              id="toDate"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button 
              onClick={fetchSpamUsers} 
              disabled={loading || !fromDate || !toDate}
              className="w-full"
            >
              <Filter className="h-4 w-4 mr-2" />
              Apply Filter
            </Button>
          </div>
        </div>

        {/* Summary */}
        {spamUsers.length > 0 && (
          <Card className="bg-orange-50 border-orange-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Spam Users</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {spamUsers.length}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                  <p className="text-2xl font-semibold text-orange-600 mt-1">
                    {spamUsers.reduce((sum, user) => sum + user.pendingReview, 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Spam Users Table */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading spam users data...
          </div>
        ) : spamUsers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p className="text-lg font-medium">No Auto-Ended Records Found</p>
            <p className="text-sm">All attendance records are valid for the selected date range.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {spamUsers.map((spamUser) => (
              <Card key={spamUser.userId} className="border-orange-200">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{spamUser.userName}</CardTitle>
                      <CardDescription>
                        {spamUser.userEmail} • {spamUser.department}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Total Spam Hours</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {spamUser.totalSpamHours.toFixed(2)} hrs
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {spamUser.totalSpamDays} days
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Status Summary */}
                    <div className="flex gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Pending: </span>
                        <span className="font-semibold text-orange-600">{spamUser.pendingReview}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Validated: </span>
                        <span className="font-semibold text-green-600">{spamUser.validated}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Marked as Spam: </span>
                        <span className="font-semibold text-red-600">{spamUser.markedAsSpam}</span>
                      </div>
                    </div>

                    {/* Records Table */}
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Start Time</TableHead>
                            <TableHead>End Time</TableHead>
                            <TableHead className="text-right">Hours</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {spamUser.records.map((record) => (
                            <TableRow key={record._id}>
                              <TableCell className="font-medium">
                                {formatDate(record.date)}
                              </TableCell>
                              <TableCell>
                                {formatTime(record.startDayTime)}
                              </TableCell>
                              <TableCell>
                                {formatTime(record.endDayTime)}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {record.totalHoursWorked.toFixed(2)} hrs
                              </TableCell>
                              <TableCell>
                                {getStatusBadge(record.spamStatus)}
                              </TableCell>
                              <TableCell className="text-right">
                                {(!record.spamStatus || record.spamStatus === 'Pending Review' || record.spamStatus === 'Suspicious') && (
                                  <div className="flex gap-2 justify-end">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-green-600 border-green-600 hover:bg-green-50"
                                      onClick={() => {
                                        setSelectedRecord(record);
                                        setActionType('validate');
                                        setActionDialogOpen(true);
                                      }}
                                    >
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Validate
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-red-600 border-red-600 hover:bg-red-50"
                                      onClick={() => {
                                        setSelectedRecord(record);
                                        setActionType('spam');
                                        setActionDialogOpen(true);
                                      }}
                                    >
                                      <XCircle className="h-3 w-3 mr-1" />
                                      Mark Spam
                                    </Button>
                                  </div>
                                )}
                                {record.spamStatus === 'Valid' && (
                                  <div className="flex items-center gap-2 justify-end">
                                    <Badge className="bg-green-100 text-green-800">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Validated
                                    </Badge>
                                    <p className="text-xs text-muted-foreground">
                                      (Hours included)
                                    </p>
                                  </div>
                                )}
                                {record.spamStatus === 'Spam' && (
                                  <Badge className="bg-red-100 text-red-800">
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Marked as Spam
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Bulk Actions */}
                    {spamUser.records.filter(r => !r.spamStatus || r.spamStatus === 'Pending Review' || r.spamStatus === 'Suspicious').length > 0 && (
                      <div className="flex gap-2 pt-2 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 border-green-600 hover:bg-green-50"
                          onClick={() => {
                            const pendingIds = spamUser.records
                              .filter(r => !r.spamStatus || r.spamStatus === 'Pending Review' || r.spamStatus === 'Suspicious')
                              .map(r => r._id);
                            setActionType('validate');
                            setActionDialogOpen(true);
                            setSelectedRecord({ _id: pendingIds, isBulk: true });
                          }}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Validate All Pending
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-600 hover:bg-red-50"
                          onClick={() => {
                            const pendingIds = spamUser.records
                              .filter(r => !r.spamStatus || r.spamStatus === 'Pending Review' || r.spamStatus === 'Suspicious')
                              .map(r => r._id);
                            setActionType('spam');
                            setActionDialogOpen(true);
                            setSelectedRecord({ _id: pendingIds, isBulk: true });
                          }}
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Mark All as Spam
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Action Dialog */}
        <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionType === 'validate' ? 'Validate Attendance Record' : 'Mark as Spam'}
              </DialogTitle>
              <DialogDescription>
                {selectedRecord?.isBulk 
                  ? `This will ${actionType === 'validate' ? 'validate' : 'mark as spam'} ${selectedRecord._id.length} record(s).`
                  : `Are you sure you want to ${actionType === 'validate' ? 'validate' : 'mark as spam'} this attendance record?`
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reason">Reason (Optional)</Label>
                <Textarea
                  id="reason"
                  placeholder={`Enter reason for ${actionType === 'validate' ? 'validation' : 'marking as spam'}...`}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setActionDialogOpen(false);
                  setReason('');
                  setSelectedRecord(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedRecord?.isBulk) {
                    handleBulkAction(selectedRecord._id, actionType);
                  } else {
                    handleValidateRecord(selectedRecord._id, actionType);
                  }
                }}
                className={actionType === 'validate' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
              >
                {actionType === 'validate' ? 'Validate' : 'Mark as Spam'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default SpamUsers;

