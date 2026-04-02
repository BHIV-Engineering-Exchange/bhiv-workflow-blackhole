import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Settings, Save, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { useSalary } from '../../hooks/use-salary';
import { formatDate } from '../../lib/dateFormat';

const WorkingDaysConfig = ({ isOpen, onClose, onSuccess }) => {
  const { setWorkingDays, loading } = useSalary();
  
  const [config, setConfig] = useState({
    workingDays: 22,
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    holidays: []
  });

  const [newHoliday, setNewHoliday] = useState({
    date: '',
    name: '',
    type: 'Public'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const success = await setWorkingDays(config);
      if (success) {
        onSuccess?.();
      }
    } catch (error) {
      console.error('Working days config error:', error);
    }
  };

  const handleChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const addHoliday = () => {
    if (newHoliday.date && newHoliday.name) {
      setConfig(prev => ({
        ...prev,
        holidays: [...prev.holidays, { ...newHoliday, id: Date.now() }]
      }));
      setNewHoliday({ date: '', name: '', type: 'Public' });
    }
  };

  const removeHoliday = (id) => {
    setConfig(prev => ({
      ...prev,
      holidays: prev.holidays.filter(h => h.id !== id)
    }));
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            Working Days Configuration
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="workingDays">Working Days</Label>
                  <Input
                    id="workingDays"
                    type="number"
                    min="1"
                    max="31"
                    value={config.workingDays}
                    onChange={(e) => handleChange('workingDays', parseInt(e.target.value) || 22)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="month">Month</Label>
                  <select
                    id="month"
                    value={config.month}
                    onChange={(e) => handleChange('month', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    {monthNames.map((month, index) => (
                      <option key={index} value={index + 1}>
                        {month}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="year">Year</Label>
                  <Input
                    id="year"
                    type="number"
                    min="2020"
                    max="2030"
                    value={config.year}
                    onChange={(e) => handleChange('year', parseInt(e.target.value) || new Date().getFullYear())}
                    required
                  />
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Configuration Summary</h4>
                <p className="text-sm text-blue-700">
                  Setting {config.workingDays} working days for {monthNames[config.month - 1]} {config.year}
                  {config.holidays.length > 0 && ` with ${config.holidays.length} holiday(s)`}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Holidays Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Holidays & Special Days
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add New Holiday */}
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4 space-y-2">
                  <Label htmlFor="holidayDate">Date</Label>
                  <Input
                    id="holidayDate"
                    type="date"
                    value={newHoliday.date}
                    onChange={(e) => setNewHoliday(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>

                <div className="col-span-5 space-y-2">
                  <Label htmlFor="holidayName">Holiday Name</Label>
                  <Input
                    id="holidayName"
                    placeholder="e.g., Christmas Day"
                    value={newHoliday.name}
                    onChange={(e) => setNewHoliday(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="col-span-2 space-y-2">
                  <Label htmlFor="holidayType">Type</Label>
                  <select
                    id="holidayType"
                    value={newHoliday.type}
                    onChange={(e) => setNewHoliday(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="Public">Public</option>
                    <option value="Company">Company</option>
                    <option value="Optional">Optional</option>
                  </select>
                </div>

                <div className="col-span-1">
                  <Button
                    type="button"
                    onClick={addHoliday}
                    size="sm"
                    className="w-full"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Holidays List */}
              {config.holidays.length > 0 && (
                <div className="space-y-2">
                  <Label>Configured Holidays</Label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {config.holidays.map((holiday, index) => (
                      <motion.div
                        key={holiday.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <div>
                            <span className="font-medium">{holiday.name}</span>
                            <span className="text-sm text-gray-600 ml-2">
                              {formatDate(holiday.date)}
                            </span>
                          </div>
                          <Badge variant="outline" className={
                            holiday.type === 'Public' ? 'border-green-300 text-green-700' :
                            holiday.type === 'Company' ? 'border-blue-300 text-blue-700' :
                            'border-orange-300 text-orange-700'
                          }>
                            {holiday.type}
                          </Badge>
                        </div>
                        
                        <Button
                          type="button"
                          onClick={() => removeHoliday(holiday.id)}
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {config.holidays.length === 0 && (
                <div className="text-center py-6 text-gray-500">
                  <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No holidays configured</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              disabled={loading}
            >
              Cancel
            </Button>
            
            <Button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
            >
              {loading ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"
                  />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Configuration
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default WorkingDaysConfig;
