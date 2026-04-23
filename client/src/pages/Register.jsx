
// "use client"

// import { useState, useEffect } from "react"
// import { Link } from "react-router-dom"

// import { Button } from "../components/ui/button"
// import { Input } from "../components/ui/input"
// import { Label } from "../components/ui/label"
// import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card"
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
// import { Loader2, Mail } from "lucide-react"
// import { api } from "../lib/api"
// import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert"
// import { useAuth } from "@/context/auth-context"

// export default function Register() {
//   const [formData, setFormData] = useState({
//     name: "",
//     email: "",
//     password: "",
//     confirmPassword: "",
//     department: "",
//     role: "User",
//   })

//   const [errors, setErrors] = useState({})
//   const [departments, setDepartments] = useState([])
//   const [success, setSuccess] = useState(false)
//   const { register, loading } = useAuth()

//   useEffect(() => {
//     const fetchDepartments = async () => {
//       try {
//         const data = await api.departments.getDepartments()
//         setDepartments(data)
//         if (data.length > 0 && !formData.department) {
//           setFormData((prev) => ({ ...prev, department: data[0].id }))
//         }
//       } catch (err) {
//         console.error("Error fetching departments:", err)
//       }
//     }

//     fetchDepartments()
//   }, [])

//   const handleChange = (e) => {
//     const { name, value } = e.target
//     setFormData({ ...formData, [name]: value })
//     if (errors[name]) setErrors({ ...errors, [name]: "" })
//   }

//   const handleDepartmentChange = (value) => {
//     setFormData({ ...formData, department: value })
//     if (errors.department) setErrors({ ...errors, department: "" })
//   }

//   const handleRoleChange = (value) => {
//     setFormData({ ...formData, role: value })
//     if (errors.role) setErrors({ ...errors, role: "" })

//     // Clear department if role is Admin/Manager
//     if (value === "Admin" || value === "Manager") {
//       setFormData((prev) => ({ ...prev, department: "" }))
//     } else if (departments.length > 0) {
//       setFormData((prev) => ({ ...prev, department: departments[0].id }))
//     }
//   }

//   const validateForm = () => {
//     const newErrors = {}

//     if (!formData.name.trim()) newErrors.name = "Name is required"
//     if (!formData.email) {
//       newErrors.email = "Email is required"
//     } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
//       newErrors.email = "Email is invalid"
//     }

//     if (!formData.password) {
//       newErrors.password = "Password is required"
//     } else if (formData.password.length < 3) {
//       newErrors.password = "Password must be at least 3 characters"
//     }

//     if (formData.password !== formData.confirmPassword) {
//       newErrors.confirmPassword = "Passwords do not match"
//     }

//     if (formData.role === "User" && !formData.department) newErrors.department = "Please select a department"

//     if (!formData.role) newErrors.role = "Please select a role"

//     setErrors(newErrors)
//     return Object.keys(newErrors).length === 0
//   }

//   const handleSubmit = async (e) => {
//     e.preventDefault()
//     if (validateForm()) {
//       const { confirmPassword, ...registerData } = formData
//       try {
//         await register(registerData)
//         setSuccess(true)
//       } catch (error) {
//         console.error("Registration error:", error)
//       }
//     }
//   }

//   const getRoleDescription = (role) => {
//     switch (role) {
//       case "Admin":
//         return "Access the organization dashboard, assign tasks, review progress, and generate reports."
//       case "Manager":
//         return "Manage department tasks, review team progress, and generate department reports."
//       case "User":
//         return "Receive tasks from admins and update your progress on a daily basis."
//       default:
//         return ""
//     }
//   }

//   return (
//     <div className="h-screen flex items-center justify-center overflow-y-auto bg-gray-50 dark:bg-gray-900 px-4 py-8 auth-container">
//       <Card className="w-full max-w-lg shadow-lg mx-auto">
//         <CardHeader className="space-y-1">
//           <CardTitle className="text-2xl font-bold text-center">Create an account</CardTitle>
//           <CardDescription className="text-center">Enter your information to create an account</CardDescription>
//         </CardHeader>
//         <form onSubmit={handleSubmit}>
//           <CardContent className="space-y-6">
//             {success && (
//               <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-900">
//                 <Mail className="h-4 w-4" />
//                 <AlertTitle>Registration successful!</AlertTitle>
//                 <AlertDescription>
//                   A welcome email has been sent to {formData.email} with details about your role and responsibilities.
//                 </AlertDescription>
//               </Alert>
//             )}

//             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//               <div className="space-y-2">
//                 <Label htmlFor="name">Full Name</Label>
//                 <Input
//                   id="name"
//                   name="name"
//                   placeholder="John Doe"
//                   value={formData.name}
//                   onChange={handleChange}
//                   disabled={loading || success}
//                   className={errors.name ? "border-red-500" : ""}
//                 />
//                 {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
//               </div>

//               <div className="space-y-2">
//                 <Label htmlFor="email">Email</Label>
//                 <Input
//                   id="email"
//                   name="email"
//                   type="email"
//                   placeholder="name@example.com"
//                   value={formData.email}
//                   onChange={handleChange}
//                   disabled={loading || success}
//                   className={errors.email ? "border-red-500" : ""}
//                 />
//                 {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
//               </div>
//             </div>

//             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//               <div className="space-y-2">
//                 <Label htmlFor="password">Password</Label>
//                 <Input
//                   id="password"
//                   name="password"
//                   type="password"
//                   placeholder="••••••••"
//                   value={formData.password}
//                   onChange={handleChange}
//                   disabled={loading || success}
//                   className={errors.password ? "border-red-500" : ""}
//                 />
//                 {errors.password && <p className="text-sm text-red-500">{errors.password}</p>}
//               </div>

//               <div className="space-y-2">
//                 <Label htmlFor="confirmPassword">Confirm Password</Label>
//                 <Input
//                   id="confirmPassword"
//                   name="confirmPassword"
//                   type="password"
//                   placeholder="••••••••"
//                   value={formData.confirmPassword}
//                   onChange={handleChange}
//                   disabled={loading || success}
//                   className={errors.confirmPassword ? "border-red-500" : ""}
//                 />
//                 {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword}</p>}
//               </div>
//             </div>

//             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//               <div className="space-y-2">
//                 <Label htmlFor="role">Role</Label>
//                 <Select value={formData.role} onValueChange={handleRoleChange} disabled={loading || success}>
//                   <SelectTrigger
//                     className={`bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:ring-2 focus:ring-primary focus:border-primary transition-colors ${errors.role ? "border-red-500" : ""}`}
//                   >
//                     <SelectValue placeholder="Select a role" />
//                   </SelectTrigger>
//                   <SelectContent className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
//                     <SelectItem
//                       value="Admin"
//                       className="hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 transition-colors"
//                     >
//                       Admin
//                     </SelectItem>
//                     <SelectItem
//                       value="Manager"
//                       className="hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 transition-colors"
//                     >
//                       Manager
//                     </SelectItem>
//                     <SelectItem
//                       value="User"
//                       className="hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 transition-colors"
//                     >
//                       User
//                     </SelectItem>
//                   </SelectContent>
//                 </Select>
//                 {errors.role && <p className="text-sm text-red-500">{errors.role}</p>}
//                 {formData.role && (
//                   <p className="text-xs text-muted-foreground mt-1">{getRoleDescription(formData.role)}</p>
//                 )}
//               </div>

//               {/* <div className="space-y-2">
//                 <Label htmlFor="department">Department</Label>
//                 <Select
//                   value={formData.department}
//                   onValueChange={handleDepartmentChange}
//                   disabled={loading || success || formData.role !== "User"}
//                 >
//                   <SelectTrigger
//                     className={`bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:ring-2 focus:ring-primary focus:border-primary transition-colors ${errors.department ? "border-red-500" : ""}`}
//                   >
//                     <SelectValue placeholder="Select a department" />
//                   </SelectTrigger>
//                   <SelectContent className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
//                     {departments.map((dept) => (
//                       <SelectItem
//                         key={dept.id}
//                         value={dept.id}
//                         className="hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 transition-colors"
//                       >
//                         {dept.name}
//                       </SelectItem>
//                     ))}
//                   </SelectContent>
//                 </Select>
//                 {errors.department && <p className="text-sm text-red-500">{errors.department}</p>}
//                 {formData.role === "User" && (
//                   <p className="text-xs text-muted-foreground mt-1">
//                     You'll receive tasks from this department's manager.
//                   </p>
//                 )}
//               </div> */}
//               <div className="space-y-2">
//                 <Label htmlFor="department">Department</Label>
//                 <Select
//                   value={formData.department}
//                   onValueChange={handleDepartmentChange}
//                   disabled={loading || formData.role !== "User"}
//                 >
//                   <SelectTrigger
//                     className={`bg-white border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${errors.department ? "border-red-500" : ""}`}
//                   >
//                     <SelectValue placeholder="Select a department" />
//                   </SelectTrigger>
//                   <SelectContent className="bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
//                     {departments.map((dept) => (
//                       <SelectItem
//                         key={dept._id}
//                         value={dept._id}
//                         className="hover:bg-gray-100 focus:bg-gray-100 transition-colors"
//                       >
//                         {dept.name}
//                       </SelectItem>
//                     ))}
//                   </SelectContent>
//                 </Select>
//                 {errors.department && (
//                   <p className="text-sm text-red-500">{errors.department}</p>
//                 )}
//                 {formData.role === "User" && (
//                   <p className="text-xs text-muted-foreground mt-1">
//                     You'll receive tasks from this department's manager.
//                   </p>
//                 )}
//               </div>
//             </div>
//           </CardContent>
//           <CardFooter className="flex flex-col space-y-4">
//             {!success && (
//               <Button type="submit" className="w-full" disabled={loading}>
//                 {loading ? (
//                   <>
//                     <Loader2 className="mr-2 h-4 w-4 animate-spin" />
//                     Creating account...
//                   </>
//                 ) : (
//                   "Register"
//                 )}
//               </Button>
//             )}
//             {success && (
//               <Button asChild className="w-full">
//                 <Link to="/login">Continue to Login</Link>
//               </Button>
//             )}
//             <p className="text-center text-sm">
//               Already have an account?{" "}
//               <Link to="/login" className="text-primary hover:underline">
//                 Login
//               </Link>
//             </p>
//           </CardFooter>
//         </form>
//       </Card>
//     </div>
//   )
// }


"use client"

import { useEffect, useState } from "react"
import { Link } from "react-router-dom"

import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select"
import { Loader2, Mail, UserPlus, Eye, EyeOff, Sparkles, Lock, User, Briefcase, Building2 } from "lucide-react"
import { api } from "../lib/api"
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert"
import { useAuth } from "@/context/auth-context"
import { isValidOrgEmail } from "@/lib/orgEmail"

export default function Register() {
  // Get currently selected branch from localStorage, default to blackhole_mumbai
  const selectedBranch = localStorage.getItem('selectedBranch') || 'blackhole_mumbai'
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    department: "",
    role: "User",
    branch: selectedBranch, // Use currently selected branch as default
  })

  const [errors, setErrors] = useState({})
  const [departments, setDepartments] = useState([])
  const [branches, setBranches] = useState([])
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const { register, loading } = useAuth()

  useEffect(() => {
    const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    // Force theme detection (optional future use)
    const _ = isSystemDark ? "light" : "dark";
  }, []);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const response = await api.departments.getDepartments()
        console.log('Register - Departments response:', response)

        // Handle new API response format
        const data = response.success ? response.data : response
        const departmentsArray = Array.isArray(data) ? data : []

        setDepartments(departmentsArray)
        if (departmentsArray.length > 0 && !formData.department) {
          setFormData((prev) => ({ ...prev, department: departmentsArray[0]._id }))
        }
      } catch (err) {
        console.error("Error fetching departments:", err)
        setDepartments([])
      }
    }

    const fetchBranches = async () => {
      try {
        const response = await api.branches.getAll()
        const data = response.success ? response.data : response
        const branchesArray = Array.isArray(data) ? data : []
        setBranches(branchesArray)
        if (branchesArray.length > 0 && !formData.branch) {
          setFormData((prev) => ({ ...prev, branch: branchesArray[0].code }))
        }
      } catch (err) {
        console.error("Error fetching branches:", err)
        // Fallback branches
        setBranches([
          { _id: '1', name: 'Blackhole Mumbai', code: 'blackhole_mumbai' }
        ])
      }
    }

    fetchDepartments()
    fetchBranches()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
    if (errors[name]) setErrors({ ...errors, [name]: "" })
  }

  const handleDepartmentChange = (value) => {
    setFormData({ ...formData, department: value })
    if (errors.department) setErrors({ ...errors, department: "" })
  }

  const handleBranchChange = (value) => {
    setFormData({ ...formData, branch: value })
    if (errors.branch) setErrors({ ...errors, branch: "" })
  }

  const handleRoleChange = (value) => {
    setFormData({ ...formData, role: value })
    if (errors.role) setErrors({ ...errors, role: "" })

    // Clear department if role is Admin/Manager
    if (value === "Admin" || value === "Manager") {
      setFormData((prev) => ({ ...prev, department: "" }))
    } else if (departments.length > 0) {
      setFormData((prev) => ({ ...prev, department: departments[0]._id }))
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.name.trim()) newErrors.name = "Name is required"
    if (!formData.email) {
      newErrors.email = "Email is required"
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid"
    } else if (!isValidOrgEmail(formData.email)) {
      newErrors.email =
        "Use @gmail.com or @outlook.com; name must include bhiv or blackhole (e.g. blackholeinfiverse64@gmail.com)"
    }

    if (!formData.password) {
      newErrors.password = "Password is required"
    } else if (formData.password.length < 3) {
      newErrors.password = "Password must be at least 3 characters"
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match"
    }

    if (formData.role === "User" && !formData.department) newErrors.department = "Please select a department"

    if (!formData.role) newErrors.role = "Please select a role"

    if (!formData.branch) newErrors.branch = "Please select a branch"

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (validateForm()) {
      // eslint-disable-next-line no-unused-vars
      const { confirmPassword, ...registerData } = formData
      try {
        await register(registerData)
        setSuccess(true)
      } catch (error) {
        console.error("Registration error:", error)
      }
    }
  }

  const getRoleDescription = (role) => {
    switch (role) {
      case "Admin":
        return "Access the organization dashboard, assign tasks, review progress, and generate reports."
      case "Manager":
        return "Manage department tasks, review team progress, and generate department reports."
      case "User":
        return "Receive tasks from admins and update your progress on a daily basis."
      default:
        return ""
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 py-4 relative overflow-hidden bg-background">
      {/* Enhanced Cyber Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-background to-secondary/10"></div>
      <div className="absolute inset-0">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, hsl(var(--accent) / 0.15) 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}></div>
      </div>

      {/* Animated Floating Elements */}
      <div className="absolute top-10 right-10 w-32 h-32 bg-accent/20 rounded-full blur-3xl animate-float-cyber"></div>
      <div className="absolute bottom-10 left-10 w-40 h-40 bg-secondary/20 rounded-full blur-3xl animate-float-cyber" style={{animationDelay: '3s'}}></div>
      <div className="absolute top-1/3 right-1/4 w-24 h-24 bg-primary/15 rounded-full blur-3xl animate-float-cyber" style={{animationDelay: '1s'}}></div>
      <div className="absolute bottom-1/2 left-1/4 w-28 h-28 bg-info/15 rounded-full blur-3xl animate-float-cyber" style={{animationDelay: '5s'}}></div>

      <Card className="w-full max-w-2xl relative z-10 neo-card animate-scale-in shadow-2xl border-border/50 my-auto">
        <CardHeader className="space-y-1 text-center pb-6">
          {/* Logo with enhanced animation */}
          <div className="mx-auto w-20 h-20 gradient-accent rounded-2xl flex items-center justify-center mb-6 shadow-glow-accent animate-glow-pulse transform hover:scale-110 transition-all duration-300 relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-accent/50 to-transparent rounded-2xl animate-pulse-cyber"></div>
            <UserPlus className="w-10 h-10 text-accent-foreground relative z-10" />
          </div>
          
          <CardTitle className="text-4xl font-bold text-foreground mb-2 bg-gradient-to-r from-accent via-primary to-secondary bg-clip-text text-transparent">
            Join CyberFlow
          </CardTitle>
          <CardDescription className="text-muted-foreground text-base flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            Create your account to get started
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <CardContent className="space-y-6 px-8">
            {success && (
              <Alert className="neo-card border-success/30 bg-success/10 animate-slide-up">
                <Mail className="h-5 w-5 text-success" />
                <AlertTitle className="text-foreground font-semibold">Registration successful!</AlertTitle>
                <AlertDescription className="text-muted-foreground">
                  A welcome email has been sent to <span className="font-medium text-foreground">{formData.email}</span> with details about your role and responsibilities.
                </AlertDescription>
              </Alert>
            )}

            {/* Name and Email Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 group">
                <Label htmlFor="name" className="text-sm font-medium text-foreground flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  Full Name
                </Label>
                <div className="relative">
                  <Input
                    id="name"
                    name="name"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={handleChange}
                    disabled={loading || success}
                    className={`h-12 transition-all duration-300 bg-background/50 backdrop-blur-sm border-border hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 ${
                      errors.name ? "border-destructive focus:border-destructive focus:ring-destructive/20" : ""
                    }`}
                  />
                </div>
                {errors.name && (
                  <p className="text-sm text-destructive animate-slide-up flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.name}
                  </p>
                )}
              </div>

              <div className="space-y-2 group">
                <Label htmlFor="email" className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary" />
                  Email Address
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={loading || success}
                    className={`h-12 transition-all duration-300 bg-background/50 backdrop-blur-sm border-border hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 ${
                      errors.email ? "border-destructive focus:border-destructive focus:ring-destructive/20" : ""
                    }`}
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive animate-slide-up flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.email}
                  </p>
                )}
              </div>
            </div>

            {/* Password and Confirm Password Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 group">
                <Label htmlFor="password" className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary" />
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={loading || success}
                    className={`pr-12 h-12 transition-all duration-300 bg-background/50 backdrop-blur-sm border-border hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 ${
                      errors.password ? "border-destructive focus:border-destructive focus:ring-destructive/20" : ""
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    disabled={loading || success}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive animate-slide-up flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.password}
                  </p>
                )}
              </div>

              <div className="space-y-2 group">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary" />
                  Confirm Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••••"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    disabled={loading || success}
                    className={`pr-12 h-12 transition-all duration-300 bg-background/50 backdrop-blur-sm border-border hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 ${
                      errors.confirmPassword ? "border-destructive focus:border-destructive focus:ring-destructive/20" : ""
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    disabled={loading || success}
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive animate-slide-up flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.confirmPassword}
                  </p>
                )}
              </div>
            </div>

            {/* Role and Department Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="role" className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-primary" />
                  Role
                </Label>
                <Select value={formData.role} onValueChange={handleRoleChange} disabled={loading || success}>
                  <SelectTrigger
                    className={`h-12 bg-background/50 backdrop-blur-sm border-border hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all ${
                      errors.role ? "border-destructive" : ""
                    }`}
                  >
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="Admin" className="hover:bg-muted focus:bg-muted transition-colors">
                      Admin
                    </SelectItem>
                    <SelectItem value="Manager" className="hover:bg-muted focus:bg-muted transition-colors">
                      Manager
                    </SelectItem>
                    <SelectItem value="User" className="hover:bg-muted focus:bg-muted transition-colors">
                      User
                    </SelectItem>
                    <SelectItem value="Tester" className="hover:bg-muted focus:bg-muted transition-colors">
                      Tester
                    </SelectItem>
                  </SelectContent>
                </Select>
                {errors.role && (
                  <p className="text-sm text-destructive animate-slide-up flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.role}
                  </p>
                )}
                {formData.role && (
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {getRoleDescription(formData.role)}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="department" className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-primary" />
                  Department
                </Label>
                <Select
                  value={formData.department}
                  onValueChange={handleDepartmentChange}
                  disabled={loading || success || formData.role !== "User"}
                >
                  <SelectTrigger
                    className={`h-12 bg-background/50 backdrop-blur-sm border-border hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all ${
                      errors.department ? "border-destructive" : ""
                    }`}
                  >
                    <SelectValue placeholder="Select a department" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border max-h-60 overflow-y-auto">
                    {departments.map((dept) => (
                      <SelectItem
                        key={dept._id}
                        value={dept._id}
                        className="hover:bg-muted focus:bg-muted transition-colors"
                      >
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.department && (
                  <p className="text-sm text-destructive animate-slide-up flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {errors.department}
                  </p>
                )}
                {formData.role === "User" && (
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    You'll receive tasks from this department's manager.
                  </p>
                )}
              </div>
            </div>

            {/* Branch Selection */}
            <div className="space-y-2">
              <Label htmlFor="branch" className="text-sm font-medium text-foreground flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                Office Branch
              </Label>
              <Select
                value={formData.branch}
                onValueChange={handleBranchChange}
                disabled={loading || success}
              >
                <SelectTrigger
                  className={`h-12 bg-background/50 backdrop-blur-sm border-border hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all ${
                    errors.branch ? "border-destructive" : ""
                  }`}
                >
                  <SelectValue placeholder="Select your branch" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border max-h-60 overflow-y-auto">
                  {branches.map((branch) => (
                    <SelectItem
                      key={branch._id || branch.code}
                      value={branch.code}
                      className="hover:bg-muted focus:bg-muted transition-colors"
                    >
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.branch && (
                <p className="text-sm text-destructive animate-slide-up flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {errors.branch}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Select the office location where you work.
              </p>
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-col space-y-4 px-8 pb-8">
            {!success && (
              <>
                <Button 
                  type="submit" 
                  className="w-full h-12 relative overflow-hidden group gradient-accent hover:shadow-glow-accent transition-all duration-300 transform hover:scale-[1.02] text-accent-foreground font-semibold text-base" 
                  disabled={loading}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700"></div>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-5 w-5" />
                      Create Account
                    </>
                  )}
                </Button>

                {/* Google sign-in removed: using email/password only */}
              </>
            )}
            {success && (
              <Link to="/login" className="w-full">
                <Button className="w-full h-12 gradient-primary hover:shadow-glow-primary transition-all duration-300 transform hover:scale-[1.02] text-primary-foreground font-semibold text-base">
                  <Lock className="mr-2 h-5 w-5" />
                  Continue to Login
                </Button>
              </Link>
            )}
            
            <div className="text-center">
              <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200">
                Already registered?{" "}
                <span className="text-primary hover:text-primary/80 font-semibold underline-offset-4 hover:underline">
                  Sign in here
                </span>
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

