import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  History, 
  RefreshCw, 
  Calendar, 
  Users, 
  IndianRupee, 
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Download,
  FolderOpen,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { sortBySurname } from '@/utils/nameSorting';

const SalaryHistory = () => {
  const [buckets, setBuckets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedBuckets, setExpandedBuckets] = useState(new Set());
  const [bucketDetailsMap, setBucketDetailsMap] = useState({});
  const [detailsLoadingMap, setDetailsLoadingMap] = useState({});
  const [deletingBucket, setDeletingBucket] = useState(null);
  const { toast } = useToast();

  const fetchSalaryBuckets = async () => {
    setLoading(true);
    try {
      const response = await api.get('/new-salary/history/buckets');
      if (response.success) {
        setBuckets(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching salary buckets:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch salary history',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalaryBuckets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleBucket = async (bucket) => {
    const bucketKey = `${bucket.startDate}_${bucket.endDate}`;
    const isExpanded = expandedBuckets.has(bucketKey);

    if (isExpanded) {
      // Collapse bucket
      const newExpanded = new Set(expandedBuckets);
      newExpanded.delete(bucketKey);
      setExpandedBuckets(newExpanded);
    } else {
      // Expand bucket
      const newExpanded = new Set(expandedBuckets);
      newExpanded.add(bucketKey);
      setExpandedBuckets(newExpanded);

      // Fetch details if not already loaded
      if (!bucketDetailsMap[bucketKey]) {
        setDetailsLoadingMap(prev => ({ ...prev, [bucketKey]: true }));
        try {
          const response = await api.get('/new-salary/history/bucket-details', {
            params: {
              startDate: bucket.startDate,
              endDate: bucket.endDate
            }
          });
          if (response.success) {
            setBucketDetailsMap(prev => ({
              ...prev,
              [bucketKey]: sortBySurname(response.data || [])
            }));
          }
        } catch (error) {
          console.error('Error fetching bucket details:', error);
          toast({
            title: 'Error',
            description: 'Failed to fetch bucket details',
            variant: 'destructive'
          });
        } finally {
          setDetailsLoadingMap(prev => ({ ...prev, [bucketKey]: false }));
        }
      }
    }
  };

  const getTotalSalary = () => {
    return buckets.reduce((sum, bucket) => sum + (bucket.totalSalary || 0), 0);
  };

  const getTotalEmployees = () => {
    return buckets.reduce((sum, bucket) => sum + (bucket.employeeCount || 0), 0);
  };

  // Delete bucket
  const handleDeleteBucket = async (e, bucket) => {
    e.stopPropagation(); // Prevent opening details dialog
    
    if (!confirm(`Are you sure you want to delete this bucket?\n\nPeriod: ${format(new Date(bucket.startDate), 'dd MMM yyyy')} - ${format(new Date(bucket.endDate), 'dd MMM yyyy')}\nEmployees: ${bucket.employeeCount}\nTotal Salary: ₹${bucket.totalSalary?.toLocaleString('en-IN')}\n\nThis will permanently delete all salary records in this bucket.`)) {
      return;
    }

    setDeletingBucket(bucket);
    try {
      const response = await api.delete('/new-salary/history/delete-bucket', {
        params: {
          startDate: bucket.startDate,
          endDate: bucket.endDate
        }
      });

      if (response.success) {
        toast({
          title: 'Bucket Deleted',
          description: `Successfully deleted ${response.data?.deletedCount || bucket.employeeCount} salary record(s)`,
        });
        fetchSalaryBuckets();
      }
    } catch (error) {
      console.error('Error deleting bucket:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to delete bucket',
        variant: 'destructive'
      });
    } finally {
      setDeletingBucket(null);
    }
  };

  // Download bucket as PDF
  const handleDownloadBucketPDF = (bucket, records) => {
    const printWindow = window.open('', '_blank');
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Salary Report - ${format(new Date(bucket.startDate), 'MMM yyyy')}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            color: #333;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #3b82f6;
            padding-bottom: 20px;
          }
          .header h1 {
            color: #3b82f6;
            margin: 0;
            font-size: 24px;
          }
          .header p {
            color: #666;
            margin: 5px 0 0;
            font-size: 14px;
          }
          .period {
            background: #eff6ff;
            padding: 15px 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            border: 1px solid #3b82f6;
            text-align: center;
          }
          .period-label {
            font-size: 12px;
            color: #666;
          }
          .period-value {
            font-size: 18px;
            font-weight: bold;
            color: #3b82f6;
          }
          .summary {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
          }
          .summary-item {
            text-align: center;
            padding: 15px;
            background: #f9fafb;
            border-radius: 8px;
            flex: 1;
            margin: 0 5px;
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
            background-color: #3b82f6;
            color: white;
            font-weight: 600;
          }
          tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          .text-right {
            text-align: right;
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
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📁 Monthly Salary Report</h1>
          <p>Generated on ${format(new Date(), 'dd MMMM yyyy, h:mm a')}</p>
        </div>
        
        <div class="period">
          <div class="period-label">Salary Period</div>
          <div class="period-value">${format(new Date(bucket.startDate), 'dd MMM yyyy')} - ${format(new Date(bucket.endDate), 'dd MMM yyyy')}</div>
        </div>
        
        <div class="summary">
          <div class="summary-item">
            <div class="summary-label">Total Employees</div>
            <div class="summary-value">${records.length}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Total Hours</div>
            <div class="summary-value">${records.reduce((sum, r) => sum + (r.totalCumulativeHours || 0), 0).toFixed(2)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Total Salary</div>
            <div class="summary-value">₹${records.reduce((sum, r) => sum + (r.confirmedSalary || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Employee Name</th>
              <th>Department</th>
              <th class="text-right">Working Hrs</th>
              <th class="text-right">Holiday Hrs</th>
              <th class="text-right">Total Hrs</th>
              <th class="text-right">Rate (₹/hr)</th>
              <th class="text-right">Confirmed Salary</th>
            </tr>
          </thead>
          <tbody>
            ${records.map((record, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${record.user?.name || 'Unknown'}</td>
                <td>${record.user?.department?.name || '-'}</td>
                <td class="text-right">${record.workingHours?.toFixed(2) || 0}</td>
                <td class="text-right">${record.holidayHours || 0}</td>
                <td class="text-right">${record.totalCumulativeHours?.toFixed(2) || 0}</td>
                <td class="text-right">₹${record.perHourRate || 0}</td>
                <td class="text-right confirmed-amount">₹${record.confirmedSalary?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background-color: #3b82f6; color: white; font-weight: bold;">
              <td colspan="7" class="text-right">Grand Total:</td>
              <td class="text-right">₹${records.reduce((sum, r) => sum + (r.confirmedSalary || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
          </tfoot>
        </table>
        
        <div class="footer">
          <p>This is a system generated salary report.</p>
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
              <History className="h-5 w-5 text-blue-500" />
              Salary History
            </CardTitle>
            <CardDescription>
              View salary records organized by monthly periods
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchSalaryBuckets} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-blue-500/10 border-blue-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <FolderOpen className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Periods</p>
                  <p className="text-2xl font-bold">{buckets.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-green-500/10 border-green-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <IndianRupee className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Disbursed</p>
                  <p className="text-2xl font-bold text-green-600">
                    ₹{getTotalSalary().toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-purple-500/10 border-purple-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Records</p>
                  <p className="text-2xl font-bold">{getTotalEmployees()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Buckets List */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading salary history...
          </div>
        ) : buckets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No salary history found</p>
            <p className="text-sm mt-2">Confirmed salaries will appear here organized by period</p>
          </div>
        ) : (
          <div className="space-y-3">
            {buckets.map((bucket, index) => {
              const bucketKey = `${bucket.startDate}_${bucket.endDate}`;
              const isExpanded = expandedBuckets.has(bucketKey);
              const bucketDetails = bucketDetailsMap[bucketKey] || [];
              const isLoading = detailsLoadingMap[bucketKey];

              return (
                <Card 
                  key={index} 
                  className="border-l-4 border-l-blue-500"
                >
                  <CardContent className="p-0">
                    <div 
                      className="py-4 px-4 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => toggleBucket(bucket)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-blue-500/10 rounded-lg">
                            <Calendar className="h-6 w-6 text-blue-500" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">
                              {format(new Date(bucket.startDate), 'dd MMM')} - {format(new Date(bucket.endDate), 'dd MMM yyyy')}
                            </h3>
                            <div className="flex items-center gap-4 mt-1">
                              <Badge variant="secondary" className="gap-1">
                                <Users className="h-3 w-3" />
                                {bucket.employeeCount} employees
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {bucket.totalHours?.toFixed(2)} total hours
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Total Salary</p>
                            <p className="text-xl font-bold text-green-600">
                              ₹{bucket.totalSalary?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteBucket(e, bucket);
                            }}
                            disabled={deletingBucket === bucket}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="border-t p-4 space-y-4 bg-muted/30">
                        {isLoading ? (
                          <div className="text-center py-8 text-muted-foreground">
                            Loading details...
                          </div>
                        ) : (
                          <>
                            {/* Summary */}
                            <div className="grid grid-cols-3 gap-4 p-4 bg-background rounded-lg">
                              <div className="text-center">
                                <p className="text-sm text-muted-foreground">Employees</p>
                                <p className="text-xl font-bold">{bucketDetails.length}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-sm text-muted-foreground">Total Hours</p>
                                <p className="text-xl font-bold">
                                  {bucketDetails.reduce((sum, r) => sum + (r.totalCumulativeHours || 0), 0).toFixed(2)}
                                </p>
                              </div>
                              <div className="text-center">
                                <p className="text-sm text-muted-foreground">Total Salary</p>
                                <p className="text-xl font-bold text-green-600">
                                  ₹{bucketDetails.reduce((sum, r) => sum + (r.confirmedSalary || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteBucket(null, bucket);
                                }}
                                disabled={deletingBucket === bucket}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Bucket
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadBucketPDF(bucket, bucketDetails);
                                }}
                                className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 border-blue-500/30"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download PDF
                              </Button>
                            </div>

                            {/* Employee List */}
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>#</TableHead>
                                    <TableHead>
                                      <div className="flex items-center gap-1.5">
                                        <span>Employee</span>
                                        <Badge variant="outline" className="text-[10px] font-normal py-0 px-1.5 text-muted-foreground border-muted-foreground/30">
                                          Surname A-Z
                                        </Badge>
                                      </div>
                                    </TableHead>
                                    <TableHead className="text-right">Working Hrs</TableHead>
                                    <TableHead className="text-right">Holiday Hrs</TableHead>
                                    <TableHead className="text-right">Total Hrs</TableHead>
                                    <TableHead className="text-right">Rate</TableHead>
                                    <TableHead className="text-right">Salary</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {bucketDetails.map((record, idx) => (
                                    <TableRow key={record._id}>
                                      <TableCell>{idx + 1}</TableCell>
                                      <TableCell>
                                        <div>
                                          <p className="font-medium">{record.user?.name || 'Unknown'}</p>
                                          <p className="text-xs text-muted-foreground">{record.user?.department?.name || '-'}</p>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-right">{record.workingHours?.toFixed(2)} hrs</TableCell>
                                      <TableCell className="text-right">{record.holidayHours || 0} hrs</TableCell>
                                      <TableCell className="text-right font-medium">{record.totalCumulativeHours?.toFixed(2)} hrs</TableCell>
                                      <TableCell className="text-right">₹{record.perHourRate}</TableCell>
                                      <TableCell className="text-right">
                                        <span className="font-bold text-green-600">
                                          ₹{record.confirmedSalary?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </span>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

      </CardContent>
    </Card>
  );
};

export default SalaryHistory;
