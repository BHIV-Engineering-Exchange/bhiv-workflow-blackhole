"use client"

import { createContext, useContext, useState, useEffect } from "react"
import { api } from "../lib/api"

const BranchContext = createContext(undefined)

export function BranchProvider({ children }) {
  const [selectedBranch, setSelectedBranch] = useState(() => {
    // Initialize from localStorage
    return localStorage.getItem("selectedBranch") || "blackhole_mumbai"
  })
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch branches from API
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        console.log("BranchContext - Fetching branches...")
        const response = await api.branches.getAll()
        console.log("BranchContext - API response:", response)
        const data = response.success ? response.data : response
        console.log("BranchContext - Branches data:", data)
        setBranches(Array.isArray(data) ? data : [])
      } catch (error) {
        console.error("Error fetching branches:", error)
        // Fallback to default branches if API fails
        setBranches([
          { _id: '1', name: 'Blackhole Mumbai', code: 'blackhole_mumbai' }
        ])
      } finally {
        setLoading(false)
      }
    }

    fetchBranches()
  }, [])

  // Persist selected branch to localStorage
  const changeBranch = (branchCode) => {
    setSelectedBranch(branchCode)
    localStorage.setItem("selectedBranch", branchCode)
  }

  // Get current branch object
  const currentBranch = branches.find(b => b.code === selectedBranch) || null

  return (
    <BranchContext.Provider
      value={{
        selectedBranch,
        setSelectedBranch: changeBranch,
        branches,
        currentBranch,
        loading
      }}
    >
      {children}
    </BranchContext.Provider>
  )
}

export function useBranch() {
  const context = useContext(BranchContext)
  if (context === undefined) {
    throw new Error("useBranch must be used within a BranchProvider")
  }
  return context
}
