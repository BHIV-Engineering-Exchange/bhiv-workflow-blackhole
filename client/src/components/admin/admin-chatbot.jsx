"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { ScrollArea } from "../ui/scroll-area"
import { Brain, Send, X, Minimize2, Maximize2, Trash2, Bot, User, Loader2, Sparkles, Zap, Maximize, RefreshCw } from "lucide-react"
import { useToast } from "../../hooks/use-toast"
import { API_URL } from "@/lib/api"
import axios from "axios"
import { useAuth } from "@/context/auth-context"

const AdminChatbot = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "👋 **Welcome to Infiverse AI Assistant!**\n\nI'm your intelligent admin helper with **real-time access** to your system data.\n\n**I can answer questions like:**\n\n📊 \"How many users are in the system?\"\n📋 \"What's the current task status?\"\n⚠️ \"Show me overdue tasks\"\n👥 \"What departments do we have?\"\n📈 \"Give me a system overview\"\n💡 \"How can I improve team productivity?\"\n\n**I use LIVE data** from your database, so all my answers are accurate and up-to-date!\n\n✨ **Try asking me anything about your system!**",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const messagesEndRef = useRef(null)
  const { toast } = useToast()
  const { getToken } = useAuth()

  // Get token from localStorage
  const token = getToken() || localStorage.getItem("WorkflowToken")

  // Configure axios with auth token - recreate on token change
  const api = axios.create({
    baseURL: `${API_URL}`,
    headers: {
      "Authorization": `Bearer ${token}`,
      "x-auth-token": token,
    },
  })

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && !isMinimized) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isMinimized])

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return

    // Check if user is logged in
    if (!token) {
      toast({
        title: "Authentication Required",
        description: "Please log in to use the chatbot",
        variant: "destructive",
      })
      return
    }

    const userMessage = {
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      console.log('🤖 Sending message to chatbot:', userMessage.content)
      
      const response = await api.post("/chatbot/chat", {
        message: userMessage.content,
        sessionId: sessionId,
      })

      console.log('✅ Chatbot response:', response.data)

      const aiMessage = {
        role: "assistant",
        content: response.data.response,
        timestamp: new Date(response.data.timestamp),
      }

      setMessages((prev) => [...prev, aiMessage])
      
      if (response.data.sessionId && !sessionId) {
        setSessionId(response.data.sessionId)
        console.log('📝 New session ID:', response.data.sessionId)
      }
    } catch (error) {
      console.error("Chat error:", error)
      
      let errorContent = "I apologize, but I'm having trouble connecting right now. Please try again in a moment."
      let errorTitle = "Connection Error"
      
      // Better error messages
      if (error.response?.status === 401) {
        errorContent = "⚠️ **Authentication expired.** Please refresh the page and log in again."
        errorTitle = "Session Expired"
      } else if (error.response?.status === 403) {
        errorContent = "⚠️ **Access Denied.** Only Admin users can use this chatbot."
        errorTitle = "Permission Denied"
      } else if (error.response?.data?.error) {
        errorContent = `❌ **Error:** ${error.response.data.error}`
      }
      
      const errorMessage = {
        role: "assistant",
        content: errorContent,
        timestamp: new Date(),
        isError: true,
      }
      
      setMessages((prev) => [...prev, errorMessage])
      
      toast({
        title: errorTitle,
        description: error.response?.data?.error || "Failed to send message",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 group">
        <button
          onClick={() => setIsOpen(true)}
          className="relative cursor-pointer transition-transform duration-200 hover:scale-110 active:scale-95"
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
          }}
        >
          {/* Clean brain emoji - no background, no glow, no animations */}
          <span className="text-5xl sm:text-6xl" style={{ 
            filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.2))'
          }}>
            🧠
          </span>
        </button>
        
        {/* Tooltip */}
        <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none shadow-lg">
          Ask AI Assistant
          <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
      </div>
    )
  }

  const handleRefresh = () => {
    setMessages([
      {
        role: "assistant",
        content: "👋 **Welcome back!**\n\nI've refreshed and I'm ready to help you with anything!\n\n**What would you like to know?**",
        timestamp: new Date(),
      },
    ])
    setSessionId(null)
    toast({
      title: "Chat Refreshed",
      description: "Starting fresh conversation",
    })
  }

  return (
    <div className={`fixed z-50 transition-all duration-300 ${
      isFullscreen 
        ? "inset-0 m-0" 
        : "inset-x-3 bottom-3 sm:inset-x-auto sm:bottom-6 sm:right-6"
    }`}>
      <Card 
        className={`border-none shadow-2xl transition-all duration-300 ${
          isFullscreen 
            ? "w-full h-full rounded-none" 
            : isMinimized 
              ? "w-full max-w-[450px] h-16 rounded-2xl" 
              : "w-full max-w-[450px] h-[calc(100dvh-1.5rem)] max-h-[700px] rounded-2xl"
        }`}
        style={{
          background: 'rgba(30, 30, 30, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
        }}
      >
        <CardHeader className="p-3 sm:p-5 flex flex-row items-center justify-between space-y-0 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-800 animate-pulse"></div>
            </div>
            <div>
              <CardTitle className="text-base font-bold text-white">Workflow Assistant</CardTitle>
              <p className="hidden sm:block text-xs text-gray-400 font-medium mt-0.5">
                Infiverse AI Solution
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              className="h-9 w-9 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-all duration-200"
              title="Refresh chat"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsFullscreen(!isFullscreen)
                if (isMinimized) setIsMinimized(false)
              }}
              className="h-9 w-9 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-all duration-200"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              <Maximize className="h-4 w-4" />
            </Button>
            {!isFullscreen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMinimized(!isMinimized)}
                className="h-9 w-9 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-all duration-200"
                title={isMinimized ? "Restore" : "Minimize"}
              >
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-9 w-9 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-all duration-200"
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        {!isMinimized && (
          <>
            <CardContent className={`p-0 ${
              isFullscreen ? "h-[calc(100dvh-180px)]" : "h-[calc(100dvh-170px)] sm:h-[calc(700px-180px)]"
            }`}
            style={{
              background: 'rgba(20, 20, 20, 0.6)'
            }}
            >
              <ScrollArea className="h-full p-3 sm:p-5">
                <div className="space-y-4">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex gap-3 animate-fade-in ${
                        message.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {message.role === "assistant" && (
                        <div className="relative flex-shrink-0">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                            <Brain className="h-5 w-5 text-white" />
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-800 animate-pulse"></div>
                        </div>
                      )}
                      
                      <div
                        className={`rounded-xl px-4 py-3 max-w-[85%] break-words transition-all duration-200 ${
                          message.role === "user"
                            ? "text-white shadow-lg"
                            : message.isError
                            ? "bg-red-500/20 text-red-300 border border-red-500/50"
                            : "text-gray-100 border border-white/10"
                        }`}
                        style={{
                          background: message.role === "user" 
                            ? 'linear-gradient(135deg, rgb(59, 130, 246) 0%, rgb(37, 99, 235) 100%)'
                            : message.isError 
                            ? 'rgba(239, 68, 68, 0.2)' 
                            : 'rgba(50, 50, 50, 0.8)',
                          backdropFilter: 'blur(10px)'
                        }}
                      >
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {message.content}
                        </p>
                        <p className="text-xs mt-2 flex items-center gap-1 opacity-60">
                          <span className="inline-block w-1 h-1 rounded-full bg-current"></span>
                          {message.timestamp.toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                      
                      {message.role === "user" && (
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center flex-shrink-0 shadow-lg">
                          <User className="h-5 w-5 text-white" />
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {isLoading && (
                    <div className="flex gap-3 justify-start animate-fade-in">
                      <div className="relative">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                          <Brain className="h-5 w-5 text-white animate-pulse" />
                        </div>
                      </div>
                      <div className="rounded-xl px-4 py-3 border border-white/10"
                        style={{
                          background: 'rgba(50, 50, 50, 0.8)',
                          backdropFilter: 'blur(10px)'
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <div className="flex gap-1">
                            <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }}></span>
                          </div>
                          <span className="text-sm text-gray-300">
                            Thinking...
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
            </CardContent>

            <div className="p-3 sm:p-5 border-t border-white/10"
              style={{
                background: 'rgba(20, 20, 20, 0.8)'
              }}
            >
              <div className="flex gap-2.5 mb-3">
                <div className="relative flex-1">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    disabled={isLoading}
                    className="h-12 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-gray-400 focus:border-primary/50 focus:bg-white/10 transition-all duration-200 pr-10"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                    <Sparkles className="h-4 w-4" />
                  </div>
                </div>
                <Button
                  onClick={handleSendMessage}
                  disabled={isLoading || !input.trim()}
                  className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-accent hover:opacity-90 shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  size="icon"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
              <div className="hidden sm:flex items-center justify-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <kbd className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-gray-400 font-mono text-[10px]">Enter</kbd>
                  <span>Send</span>
                </span>
                <span className="opacity-50">•</span>
                <span className="flex items-center gap-1.5">
                  <kbd className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-gray-400 font-mono text-[10px]">Shift+Enter</kbd>
                  <span>New line</span>
                </span>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

export default AdminChatbot

