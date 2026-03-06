"use client"

import { useState } from "react"
import { Building2, ChevronDown, Lock, Eye, EyeOff, Loader2 } from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog"
import { useBranch } from "../context/branch-context"
import { useAuth } from "../context/auth-context"
import { api } from "../lib/api"
import { useToast } from "../hooks/use-toast"

export function BranchSwitcher() {
  const { user } = useAuth()
  const { selectedBranch, setSelectedBranch, branches, loading } = useBranch()
  const { toast } = useToast()

  // Password dialog state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [pendingBranch, setPendingBranch] = useState(null)
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState("")

  // Only show for admin users
  if (user?.role !== "Admin") {
    return null
  }

  // Get display name for current branch
  const getCurrentBranchName = () => {
    const branch = branches.find(b => b.code === selectedBranch)
    return branch?.name || selectedBranch?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  // Handle branch selection - show password dialog
  const handleBranchSelect = (branch) => {
    // If already on this branch, do nothing
    if (selectedBranch === branch.code) {
      return
    }
    setPendingBranch(branch)
    setPassword("")
    setError("")
    setShowPasswordDialog(true)
  }

  // Handle password verification and branch switch
  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    
    if (!password.trim()) {
      setError("Password is required")
      return
    }

    setIsVerifying(true)
    setError("")

    try {
      const response = await api.auth.verifyPassword(password)
      
      if (response.success) {
        // Password verified - switch branch
        setSelectedBranch(pendingBranch.code)
        setShowPasswordDialog(false)
        setPendingBranch(null)
        setPassword("")
        
        toast({
          title: "Branch Switched",
          description: `Successfully switched to ${pendingBranch.name}`,
        })
      } else {
        setError(response.error || "Invalid password")
      }
    } catch (err) {
      console.error("Password verification error:", err)
      setError(err.message || "Invalid password")
    } finally {
      setIsVerifying(false)
    }
  }

  // Handle dialog close
  const handleDialogClose = () => {
    setShowPasswordDialog(false)
    setPendingBranch(null)
    setPassword("")
    setError("")
  }

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-card/50 backdrop-blur-sm border border-border rounded-md">
        <Building2 className="h-4 w-4 text-primary animate-pulse" />
        <span className="hidden sm:inline font-medium text-sm">Loading...</span>
      </div>
    )
  }

  // Show static badge when only one branch exists
  if (branches.length <= 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-card/50 backdrop-blur-sm border border-border rounded-md">
        <Building2 className="h-4 w-4 text-primary" />
        <span className="hidden sm:inline font-medium text-sm">
          {getCurrentBranchName()}
        </span>
      </div>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className="gap-2 min-w-[140px] justify-between bg-card/50 backdrop-blur-sm border-border hover:bg-primary/10 hover:border-primary/50 transition-all duration-300"
            disabled={loading}
          >
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="hidden sm:inline font-medium">
                {loading ? "Loading..." : getCurrentBranchName()}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          className="w-56 bg-card/95 backdrop-blur-xl border border-border shadow-xl rounded-xl animate-scale-in"
        >
          <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
            Select Branch
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {/* Individual Branches */}
          {branches.map((branch) => (
            <DropdownMenuItem
              key={branch._id || branch.code}
              onSelect={() => handleBranchSelect(branch)}
              className={`cursor-pointer transition-colors ${
                selectedBranch === branch.code 
                  ? "bg-primary/10 text-primary font-medium" 
                  : "hover:bg-primary/5"
              }`}
            >
              <Building2 className="mr-2 h-4 w-4" />
              {branch.name}
              {selectedBranch === branch.code && (
                <span className="ml-auto text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Password Verification Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Verify Password to Switch Branch
            </DialogTitle>
            <DialogDescription>
              Enter your password to switch to <strong>{pendingBranch?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handlePasswordSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setError("")
                    }}
                    placeholder="Enter your password"
                    className={error ? "border-red-500" : ""}
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                {error && (
                  <p className="text-sm text-red-500">{error}</p>
                )}
              </div>
            </div>
            
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={handleDialogClose}
                disabled={isVerifying}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isVerifying || !password.trim()}
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Switch Branch
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
