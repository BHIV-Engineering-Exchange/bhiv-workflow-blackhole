"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../hooks/use-toast";
import axios from "axios";

// Determine API URL with fallback logic
const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    console.log('🔧 Using VITE_API_URL from env:', import.meta.env.VITE_API_URL);
    return import.meta.env.VITE_API_URL;
  }
  
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    
    if (host === 'blackhole-workflow.vercel.app' || host.endsWith('.vercel.app')) {
      console.log('🎯 Using Render backend for production');
      return 'https://blackholeworkflow.onrender.com/api';
    } else if (host === 'localhost' || host === '127.0.0.1') {
      console.log('🏠 Using localhost backend API');
      return 'http://localhost:5001/api';
    } else {
      console.log('🏠 Using same-origin API');
      return `${window.location.origin}/api`;
    }
  }
  
  // Fallback for SSR or build time
  console.warn('⚠️ No API URL configured, using default localhost');
  return 'http://localhost:5001/api';
};

const API_URL = getApiUrl();
console.log('✅ Auth Context API_URL:', API_URL);

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  const axiosInstance = axios.create({
    baseURL: API_URL,
    headers: {
      "Content-Type": "application/json",
    },
  });

  // Add token to axiosInstance headers if available
  axiosInstance.interceptors.request.use((config) => {
    const token = localStorage.getItem("WorkflowToken");
    if (token) {
      config.headers["x-auth-token"] = token;
    }
    return config;
  });

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("WorkflowUser");
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } catch (error) {
        console.error("Error parsing stored user:", error);
        localStorage.removeItem("WorkflowUser");
      }
    }
    setLoading(false);
  }, []);

  const register = async (userData) => {
    setLoading(true);
  
    // Remove department field if not required
    const filteredUserData = { ...userData };
    if (filteredUserData.role === "Admin" || filteredUserData.role === "Manager") {
      delete filteredUserData.department;
    }
  
    try {
      console.log("userData while register", filteredUserData);
      const response = await axiosInstance.post("/auth/register", filteredUserData);
      const { token, user } = response.data;
  
      localStorage.setItem("WorkflowToken", token);
      localStorage.setItem("WorkflowUser", JSON.stringify(user));
      setUser(user);
  
      toast({
        title: "Registration successful",
        description: "Your account has been created successfully.",
        variant: "success",
      });
  
      navigate(user.role === "User" ? "/userdashboard" : "/dashboard");
    } catch (error) {
      toast({
        title: "Registration failed",
        description: error.response?.data?.error || error.message,
        variant: "destructive",
      });
      console.error("Registration error:", error);
    } finally {
      setLoading(false);
    }
  };
  

  const login = async (credentials) => {
    setLoading(true);
    try {
      const response = await axiosInstance.post("/auth/login", credentials);
      const { token, user } = response.data;

      console.log("user after login", user);
      // Store token and user in localStorage
      localStorage.setItem("WorkflowToken", token);
      localStorage.setItem("WorkflowUser", JSON.stringify(user));

      // Set user in state
      setUser(user);

      toast({
        title: "Login successful",
        description: "Welcome back!",
        variant: "success",
      });

      // Navigate based on role
      navigate(
        user.role === "User" ? "/userdashboard" :
        user.role === "Tester" ? "/tester-dashboard" :
        "/dashboard"
      );
    } catch (error) {
      toast({
        title: "Login failed",
        description: error.response?.data?.error || error.message,
        variant: "destructive",
      });
      console.error("Login error:", error);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("WorkflowToken"); // Fixed from "token" to "WorkflowToken"
    localStorage.removeItem("WorkflowUser");
    navigate("/login");
    toast({
      title: "Logged out",
      description: "You have been logged out successfully.",
    });
  };

  const getToken = () => localStorage.getItem("WorkflowToken");

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, getToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);