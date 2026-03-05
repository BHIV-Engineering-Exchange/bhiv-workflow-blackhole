"use client"

import { Building2, ChevronDown } from "lucide-react"
import { Button } from "./ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { useBranch } from "../context/branch-context"
import { useAuth } from "../context/auth-context"

export function BranchSwitcher() {
  const { user } = useAuth()
  const { selectedBranch, setSelectedBranch, branches, loading } = useBranch()

  // Only show for admin users
  if (user?.role !== "Admin") {
    return null
  }

  // Get display name for current branch
  const getCurrentBranchName = () => {
    const branch = branches.find(b => b.code === selectedBranch)
    return branch?.name || selectedBranch?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  // Show static badge when only one branch exists
  if (!loading && branches.length <= 1) {
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
            onSelect={() => setSelectedBranch(branch.code)}
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
  )
}
