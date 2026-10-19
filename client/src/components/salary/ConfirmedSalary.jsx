import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, Edit2, Trash2, RefreshCw, IndianRupee, Download, FolderPlus } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { sortBySurname } from '@/utils/nameSorting';

const ConfirmedSalary = () => {
  const [confirmedRecords, setConfirmedRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [editRate, setEditRate] = useState('');
  const [editSalary, setEditSalary] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [creatingBucket, setCreatingBucket] = useState(false);
  const { toast } = useToast();

  const fetchConfirmedSalaries = async () => {
    setLoading(true);
    try {
      const response = await api.get('/new-salary/confirmed');
      if (response.success) {
        setConfirmedRecords(sortBySurname(response.data || []));
      }
    } catch (error) {
      console.error('Error fetching confirmed salaries:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch confirmed salaries',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfirmedSalaries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEdit = (record) => {
    setSelectedRecord(record);
    setEditRate(record.perHourRate?.toString() || '');
    setEditSalary(record.confirmedSalary?.toString() || record.calculatedSalary?.toString() || '');
    setEditNotes(record.confirmationNotes || '');
    setEditDialogOpen(true);
  };

  // Auto-calculate salary when rate changes
  const handleRateChange = (newRate) => {
    setEditRate(newRate);
    if (selectedRecord && newRate) {
      const rate = parseFloat(newRate);
      const totalHours = selectedRecord.totalCumulativeHours || 0;
      if (rate > 0 && totalHours > 0) {
        const newSalary = (rate * totalHours).toFixed(2);
        setEditSalary(newSalary);
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedRecord) return;

    setSaving(true);
    try {
      const response = await api.put(`/new-salary/confirmed/${selectedRecord._id}`, {
        perHourRate: parseFloat(editRate),
        confirmedSalary: parseFloat(editSalary),
        confirmationNotes: editNotes
      });

      if (response.success) {
        toast({
          title: 'Success',
          description: 'Confirmed salary updated successfully'
        });
        setEditDialogOpen(false);
        fetchConfirmedSalaries();
      }
    } catch (error) {
      console.error('Error updating confirmed salary:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to update confirmed salary',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveConfirmation = async (recordId) => {
    if (!confirm('Are you sure you want to remove this salary confirmation?')) return;

    try {
      const response = await api.delete(`/new-salary/confirmed/${recordId}`);
      if (response.success) {
        toast({
          title: 'Success',
          description: 'Salary confirmation removed successfully'
        });
        fetchConfirmedSalaries();
      }
    } catch (error) {
      console.error('Error removing confirmation:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove confirmation',
        variant: 'destructive'
      });
    }
  };

  const getTotalConfirmedSalary = () => {
    return confirmedRecords.reduce((sum, record) => sum + (record.confirmedSalary || 0), 0);
  };

  // Create bucket - move all confirmed salaries to history
  const handleCreateBucket = async () => {
    if (confirmedRecords.length === 0) {
      toast({
        title: 'No Records',
        description: 'No confirmed salaries to create bucket',
        variant: 'destructive'
      });
      return;
    }

    if (!confirm(`Are you sure you want to create a bucket with ${confirmedRecords.length} salary record(s)?\n\nThis will move all confirmed salaries to History and clear this list.`)) {
      return;
    }

    setCreatingBucket(true);
    try {
      const response = await api.post('/new-salary/history/create-bucket', {
        recordIds: confirmedRecords.map(r => r._id)
      });

      if (response.success) {
        toast({
          title: 'Bucket Created',
          description: `Successfully created bucket with ${confirmedRecords.length} salary record(s). View in History tab.`,
        });
        // Clear the confirmed records list
        setConfirmedRecords([]);
      }
    } catch (error) {
      console.error('Error creating bucket:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to create bucket',
        variant: 'destructive'
      });
    } finally {
      setCreatingBucket(false);
    }
  };

  // Download PDF function
  const handleDownloadPDF = () => {
    if (confirmedRecords.length === 0) {
      toast({
        title: 'No Data',
        description: 'No confirmed salaries to download',
        variant: 'destructive'
      });
      return;
    }

    // Create PDF content
    const printWindow = window.open('', '_blank');
    const totalSalary = getTotalConfirmedSalary();
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Confirmed Salaries Report</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            color: #333;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #16a34a;
            padding-bottom: 20px;
          }
          .header h1 {
            color: #16a34a;
            margin: 0;
            font-size: 24px;
          }
          .header p {
            color: #666;
            margin: 5px 0 0;
            font-size: 14px;
          }
          .summary {
            display: flex;
            justify-content: space-between;
            background: #f0fdf4;
            padding: 15px 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            border: 1px solid #16a34a;
          }
          .summary-item {
            text-align: center;
          }
          .summary-label {
            font-size: 12px;
            color: #666;
          }
          .summary-value {
            font-size: 20px;
            font-weight: bold;
            color: #16a34a;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            font-size: 12px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 10px 8px;
            text-align: left;
          }
          th {
            background-color: #16a34a;
            color: white;
            font-weight: 600;
          }
          tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          tr:hover {
            background-color: #f0fdf4;
          }
          .text-right {
            text-align: right;
          }
          .text-center {
            text-align: center;
          }
          .confirmed-amount {
            font-weight: bold;
            color: #16a34a;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 11px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 15px;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>✓ Confirmed Salaries Report</h1>
          <p>Generated on ${format(new Date(), 'dd MMMM yyyy, h:mm a')}</p>
        </div>
        
        <div class="summary">
          <div class="summary-item">
            <div class="summary-label">Total Employees</div>
            <div class="summary-value">${confirmedRecords.length}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Total Confirmed Salary</div>
            <div class="summary-value">₹${totalSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Employee Name</th>
              <th>Period</th>
              <th class="text-right">Working Hrs</th>
              <th class="text-right">Holiday Hrs</th>
              <th class="text-right">Total Hrs</th>
              <th class="text-right">Rate (₹/hr)</th>
              <th class="text-right">Calculated</th>
              <th class="text-right">Confirmed</th>
              <th>Confirmed By</th>
            </tr>
          </thead>
          <tbody>
            ${confirmedRecords.map((record, index) => `
              <tr>
                <td class="text-center">${index + 1}</td>
                <td>${record.user?.name || 'Unknown'}</td>
                <td>${format(new Date(record.startDate), 'dd MMM')} - ${format(new Date(record.endDate), 'dd MMM yyyy')}</td>
                <td class="text-right">${record.workingHours?.toFixed(2) || 0}</td>
                <td class="text-right">${record.holidayHours || 0}</td>
                <td class="text-right">${record.totalCumulativeHours?.toFixed(2) || 0}</td>
                <td class="text-right">₹${record.perHourRate || 0}</td>
                <td class="text-right">₹${record.calculatedSalary?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}</td>
                <td class="text-right confirmed-amount">₹${record.confirmedSalary?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}</td>
                <td>${record.confirmedBy?.name || 'Admin'}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background-color: #16a34a; color: white; font-weight: bold;">
              <td colspan="8" class="text-right">Grand Total:</td>
              <td class="text-right">₹${totalSalary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        
        <div class="footer">
          <p>This is a system generated report.</p>
        </div>
        
        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <Card className="neo-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Confirmed Salaries
            </CardTitle>
            <CardDescription>
              View and manage all confirmed salary records
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleCreateBucket}
              disabled={confirmedRecords.length === 0 || creatingBucket}
              className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 border-blue-500/30"
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              {creatingBucket ? 'Creating...' : 'Create Bucket'}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDownloadPDF}
              disabled={confirmedRecords.length === 0}
              className="bg-green-500/10 hover:bg-green-500/20 text-green-600 border-green-500/30"
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button variant="outline" size="sm" onClick={fetchConfirmedSalaries} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Card */}
        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Confirmed Salary</p>
                <p className="text-2xl font-bold text-green-600">
                  ₹{getTotalConfirmedSalary().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total Records</p>
                <p className="text-2xl font-bold">{confirmedRecords.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Confirmed Salaries Table */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading confirmed salaries...
          </div>
        ) : confirmedRecords.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No confirmed salaries yet</p>
            <p className="text-sm mt-2">Confirm salaries from the Salary Calculation section</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <div className="flex items-center gap-1.5">
                      <span>Employee</span>
                      <Badge variant="outline" className="text-[10px] font-normal py-0 px-1.5 text-muted-foreground border-muted-foreground/30">
                        Surname A-Z
                      </Badge>
                    </div>
                  </TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Working Hours</TableHead>
                  <TableHead className="text-right">Holiday Hours</TableHead>
                  <TableHead className="text-right">Total Hours</TableHead>
                  <TableHead className="text-right">Rate (₹/hr)</TableHead>
                  <TableHead className="text-right">Calculated</TableHead>
                  <TableHead className="text-right">Confirmed</TableHead>
                  <TableHead>Confirmed By</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {confirmedRecords.map((record) => (
                  <TableRow key={record._id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{record.user?.name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{record.user?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{format(new Date(record.startDate), 'dd MMM yyyy')}</p>
                        <p className="text-muted-foreground">to {format(new Date(record.endDate), 'dd MMM yyyy')}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{record.workingHours?.toFixed(2)} hrs</TableCell>
                    <TableCell className="text-right">{record.holidayHours || 0} hrs</TableCell>
                    <TableCell className="text-right font-medium">{record.totalCumulativeHours?.toFixed(2)} hrs</TableCell>
                    <TableCell className="text-right">₹{record.perHourRate}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      ₹{record.calculatedSalary?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-bold text-green-600">
                        ₹{record.confirmedSalary?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                      {record.confirmedSalary !== record.calculatedSalary && (
                        <Badge variant="outline" className="ml-2 text-xs">Adjusted</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{record.confirmedBy?.name || 'Admin'}</p>
                        <p className="text-xs text-muted-foreground">
                          {record.confirmedAt && format(new Date(record.confirmedAt), 'dd MMM yyyy, h:mm a')}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(record)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleRemoveConfirmation(record._id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Confirmed Salary</DialogTitle>
              <DialogDescription>
                Update the hourly rate and salary for {selectedRecord?.user?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Hours Summary */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-muted/50 rounded-lg">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Working Hours</p>
                  <p className="font-semibold">{selectedRecord?.workingHours?.toFixed(2) || 0}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Holiday Hours</p>
                  <p className="font-semibold">{selectedRecord?.holidayHours || 0}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Total Hours</p>
                  <p className="font-semibold text-primary">{selectedRecord?.totalCumulativeHours?.toFixed(2) || 0}</p>
                </div>
              </div>

              {/* Original Values */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Original Rate</p>
                  <p className="font-medium">₹{selectedRecord?.perHourRate || 0}/hr</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Calculated Salary</p>
                  <p className="font-medium">₹{selectedRecord?.calculatedSalary?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>

              {/* Edit Per Hour Rate */}
              <div className="space-y-2">
                <Label htmlFor="editRate">Per Hour Rate (₹)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">₹</span>
                  <Input
                    id="editRate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editRate}
                    onChange={(e) => handleRateChange(e.target.value)}
                    className="pl-8"
                    placeholder="Enter hourly rate"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Changing rate will auto-calculate: {selectedRecord?.totalCumulativeHours?.toFixed(2) || 0} hrs × ₹{editRate || 0} = ₹{editRate && selectedRecord?.totalCumulativeHours ? (parseFloat(editRate) * selectedRecord.totalCumulativeHours).toFixed(2) : '0.00'}
                </p>
              </div>

              {/* Edit Confirmed Salary */}
              <div className="space-y-2">
                <Label htmlFor="editSalary">Confirmed Salary (₹)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground">₹</span>
                  <Input
                    id="editSalary"
                    type="number"
                    step="0.01"
                    min="0"
                    value={editSalary}
                    onChange={(e) => setEditSalary(e.target.value)}
                    className="pl-8 text-lg font-semibold"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  You can manually adjust the final salary if needed
                </p>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="editNotes">Notes (Optional)</Label>
                <Textarea
                  id="editNotes"
                  placeholder="Add any notes about this salary update..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={saving || !editSalary || !editRate}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default ConfirmedSalary;
