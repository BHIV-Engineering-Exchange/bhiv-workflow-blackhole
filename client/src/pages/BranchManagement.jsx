"use client"

import { useState, useEffect } from "react"
import { Building2, Plus, Pencil, Trash2, MapPin, Loader2, Save, X, Mail, KeyRound } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Switch } from "../components/ui/switch"
import { useToast } from "../hooks/use-toast"
import { api } from "../lib/api"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip"

export default function BranchManagement() {
  const { toast } = useToast()
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(null) // branchId of branch being sent email
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    address: "",
    latitude: "",
    longitude: "",
    radius: "1000",
    isActive: true
  })

  // Fetch branches
  const fetchBranches = async () => {
    try {
      setLoading(true)
      const response = await api.branches.getAllAdmin()
      const data = response.success ? response.data : response
      setBranches(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Error fetching branches:", error)
      toast({
        title: "Error",
        description: "Failed to fetch branches",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBranches()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      code: "",
      address: "",
      latitude: "",
      longitude: "",
      radius: "1000",
      isActive: true
    })
    setSelectedBranch(null)
  }

  // Open dialog for create
  const handleCreate = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  // Open dialog for edit
  const handleEdit = (branch) => {
    setSelectedBranch(branch)
    setFormData({
      name: branch.name,
      code: branch.code,
      address: branch.address,
      latitude: branch.latitude.toString(),
      longitude: branch.longitude.toString(),
      radius: branch.radius.toString(),
      isActive: branch.isActive
    })
    setIsDialogOpen(true)
  }

  // Open delete confirmation
  const handleDeleteClick = (branch) => {
    setSelectedBranch(branch)
    setIsDeleteDialogOpen(true)
  }

  // Handle form change
  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Handle switch change
  const handleSwitchChange = (checked) => {
    setFormData(prev => ({ ...prev, isActive: checked }))
  }

  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate
    if (!formData.name || !formData.code || !formData.address || !formData.latitude || !formData.longitude) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      })
      return
    }

    try {
      setSaving(true)
      
      const payload = {
        name: formData.name,
        code: formData.code.toLowerCase(),
        address: formData.address,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        radius: parseInt(formData.radius) || 1000,
        isActive: formData.isActive
      }

      if (selectedBranch) {
        // Update
        await api.branches.update(selectedBranch._id, payload)
        toast({
          title: "Success",
          description: "Branch updated successfully"
        })
      } else {
        // Create
        await api.branches.create(payload)
        toast({
          title: "Success",
          description: "Branch created successfully"
        })
      }

      setIsDialogOpen(false)
      resetForm()
      fetchBranches()
    } catch (error) {
      console.error("Error saving branch:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to save branch",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  // Delete branch
  const handleDelete = async () => {
    if (!selectedBranch) return

    try {
      setSaving(true)
      await api.branches.delete(selectedBranch._id)
      toast({
        title: "Success",
        description: "Branch deleted successfully"
      })
      setIsDeleteDialogOpen(false)
      setSelectedBranch(null)
      fetchBranches()
    } catch (error) {
      console.error("Error deleting branch:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete branch",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  // Request password setup email for a branch
  const handleRequestPasswordSetup = async (branch) => {
    try {
      setSendingEmail(branch._id)
      const response = await api.branches.requestPasswordSetup(branch._id)
      
      if (response.success) {
        toast({
          title: "Email Sent",
          description: `Password setup link sent to super admin for ${branch.name}`,
        })
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to send email",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Error requesting password setup:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to send password setup email",
        variant: "destructive"
      })
    } finally {
      setSendingEmail(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary" />
            Branch Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Create and manage office branches
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Branch
        </Button>
      </div>

      {/* Branches Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Branches</CardTitle>
          <CardDescription>
            Manage your organization's office locations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : branches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No branches found. Create your first branch.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="hidden md:table-cell">Address</TableHead>
                    <TableHead className="hidden sm:table-cell">Coordinates</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.map((branch) => (
                    <TableRow key={branch._id}>
                      <TableCell className="font-medium">{branch.name}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {branch.code}
                        </code>
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-[200px] truncate" title={branch.address}>
                        {branch.address}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {branch.latitude?.toFixed(4)}, {branch.longitude?.toFixed(4)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          branch.isActive 
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        }`}>
                          {branch.isActive ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <TooltipProvider>
                          <div className="flex justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRequestPasswordSetup(branch)}
                                  disabled={sendingEmail === branch._id}
                                  className="text-primary hover:text-primary"
                                >
                                  {sendingEmail === branch._id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <KeyRound className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Send password setup email</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(branch)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Edit branch</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteClick(branch)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Delete branch</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {selectedBranch ? "Edit Branch" : "Create Branch"}
            </DialogTitle>
            <DialogDescription>
              {selectedBranch ? "Update branch details" : "Add a new office branch"}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Branch Name *</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Mumbai Branch"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Branch Code *</Label>
                <Input
                  id="code"
                  name="code"
                  placeholder="mumbai"
                  value={formData.code}
                  onChange={handleChange}
                  required
                  disabled={!!selectedBranch}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                name="address"
                placeholder="Full office address"
                value={formData.address}
                onChange={handleChange}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="latitude">Latitude *</Label>
                <Input
                  id="latitude"
                  name="latitude"
                  type="number"
                  step="any"
                  placeholder="19.160122"
                  value={formData.latitude}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="longitude">Longitude *</Label>
                <Input
                  id="longitude"
                  name="longitude"
                  type="number"
                  step="any"
                  placeholder="72.839720"
                  value={formData.longitude}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="radius">Radius (m)</Label>
                <Input
                  id="radius"
                  name="radius"
                  type="number"
                  placeholder="1000"
                  value={formData.radius}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={handleSwitchChange}
              />
              <Label htmlFor="isActive">Branch is active</Label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {selectedBranch ? "Update" : "Create"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Branch
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{selectedBranch?.name}</strong>? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
