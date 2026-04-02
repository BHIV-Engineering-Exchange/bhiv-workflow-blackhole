import { useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { LayoutDashboard, CheckSquare, Network, Users, Sparkles, Settings, LogOut, CheckCircle, BarChart, Airplay, LayoutDashboardIcon, Target, Monitor, DollarSign, Calendar, Clock, UserCog, UserCheck, ShoppingCart, Mail, ChevronLeft, ChevronRight, Building2, FolderKanban, ClipboardCheck, AlertTriangle, FileText } from "lucide-react";
import { useAuth } from "../../context/auth-context";

export function DashboardSidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Unified navigation structure with sections
  const getNavigationSections = () => {
    const role = user?.role;

    if (role === "User") {
      return [
        {
          title: "Main",
          routes: [
            { title: "Dashboard", href: "/userdashboard", icon: LayoutDashboardIcon },
            { title: "My Tasks", href: "/my-tasks", icon: CheckSquare },
            { title: "Set Aims", href: "/aims", icon: Target },
            { title: "Progress", href: "/progress", icon: BarChart },
          ]
        },
        {
          title: "Performance",
          routes: [
            { title: "Leaderboard", href: "/leaderboard", icon: Sparkles },
          ]
        }
      ];
    }

    if (role === "Procurement Agent") {
      return [
        {
          title: "Main",
          routes: [
            { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
            { title: "Procurement", href: "/procurement-dashboard", icon: ShoppingCart },
          ]
        },
        {
          title: "Work",
          routes: [
            { title: "Tasks", href: "/tasks", icon: CheckSquare },
            { title: "All Aims", href: "/all-aims", icon: Target },
            { title: "Completed Tasks", href: "/completedtask", icon: CheckCircle },
            { title: "Test Tasks", href: "/tested-tasks", icon: FileText },
          ]
        },
        {
          title: "Performance",
          routes: [
            { title: "Leaderboard", href: "/leaderboard", icon: Sparkles },
          ]
        }
      ];
    }

    if (role === "Admin") {
      return [
        {
          title: "Main",
          routes: [
            { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
            { title: "AI Optimization", href: "/optimization", icon: Sparkles },
          ]
        },
        {
          title: "Work Management",
          routes: [
            { title: "Tasks", href: "/tasks", icon: CheckSquare },
            { title: "Projects", href: "/projects", icon: FolderKanban },
            { title: "Dependencies", href: "/dependencies", icon: Network },
            { title: "Departments", href: "/departments", icon: Users },
            { title: "All Aims", href: "/all-aims", icon: Target },
            { title: "Completed Tasks", href: "/completedtask", icon: CheckCircle },
          ]
        },
        {
          title: "Employee Management",
          routes: [
            { title: "User Management", href: "/user-management", icon: UserCog },
            { title: "Employee Monitoring", href: "/monitoring", icon: Monitor },
            { title: "Leaderboard", href: "/leaderboard", icon: Sparkles },
          ]
        },
        {
          title: "Attendance & Time",
          routes: [
            { title: "Live Attendance", href: "/attendance-dashboard", icon: UserCheck },
            { title: "Salary Management", href: "/new-salary-management", icon: DollarSign },
          ]
        },
        {
          title: "Operations",
          routes: [
            { title: "Procurement", href: "/procurement-dashboard", icon: ShoppingCart },
            { title: "EMS Dashboard", href: "/ems-dashboard", icon: Mail },
            { title: "Branch Management", href: "/branch-management", icon: Building2 },
          ]
        }
      ];
    }

    if (role === "Tester") {
      return [
        {
          title: "Main",
          routes: [
            { title: "Dashboard", href: "/tester-dashboard", icon: LayoutDashboard },
          ]
        },
        {
          title: "Testing",
          routes: [
            { title: "Tasks", href: "/tester-tasks", icon: CheckSquare },
            { title: "Task Evaluation", href: "/tester-evaluation", icon: ClipboardCheck },
            { title: "Test Tasks", href: "/tested-tasks", icon: FileText },
          ]
        },
        {
          title: "Monitoring",
          routes: [
            { title: "Alerts", href: "/tester-alerts", icon: AlertTriangle },
          ]
        }
      ];
    }

    // Default for other roles (Manager, etc.)
    return [
      {
        title: "Main",
        routes: [
          { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
          { title: "AI Optimization", href: "/optimization", icon: Sparkles },
        ]
      },
      {
        title: "Work",
        routes: [
          { title: "Tasks", href: "/tasks", icon: CheckSquare },
          { title: "Dependencies", href: "/dependencies", icon: Network },
          { title: "Departments", href: "/departments", icon: Users },
          { title: "All Aims", href: "/all-aims", icon: Target },
          { title: "Completed Tasks", href: "/completedtask", icon: CheckCircle },
          { title: "Test Tasks", href: "/tested-tasks", icon: FileText },
        ]
      },
      {
        title: "Performance",
        routes: [
          { title: "Leaderboard", href: "/leaderboard", icon: Sparkles },
        ]
      }
    ];
  };

  const navigationSections = getNavigationSections();

  return (
    <aside className={`h-screen flex flex-col bg-card/95 backdrop-blur-sm border-r border-border shadow-xl transition-all duration-300 ease-in-out ${isCollapsed ? 'w-16' : 'w-64'}`}>
      {/* Unified Scrollable Section - Header + Navigation + Footer */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-border/50 scrollbar-track-transparent hover:scrollbar-thumb-border">
        <div className={`${isCollapsed ? 'p-2' : 'p-4'} space-y-6`}>
          
          {/* Header - Logo & Brand (Acts as Collapse Button) */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full flex items-center justify-center focus:outline-none rounded-lg transition-all duration-300 group"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
              <div className="relative">
                <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shadow-glow-primary transition-all duration-300 group-hover:scale-110 group-hover:rotate-12 group-hover:shadow-lg cursor-pointer">
                  <Sparkles className="h-5 w-5 text-primary-foreground group-hover:animate-pulse" />
                </div>
              </div>
              {!isCollapsed && (
                <span className="text-xl font-heading font-bold tracking-tight bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent transition-all duration-300">
                  Infiverse
                </span>
              )}
            </div>
          </button>

          {/* Navigation Items */}
          <nav>
            <div className="space-y-1">
              {navigationSections.map((section) => (
                section.routes.map((route) => {
                  const isActive = location.pathname === route.href;
                  return (
                    <Link
                      key={route.href}
                      to={route.href}
                      className={`group flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-3'} py-3 rounded-lg text-sm font-medium transition-all duration-300 relative overflow-hidden ${
                        isActive
                          ? "gradient-primary text-primary-foreground shadow-glow-primary"
                          : "hover:bg-primary/5 hover:text-primary text-foreground/70"
                      }`}
                      title={isCollapsed ? route.title : undefined}
                    >
                      {/* Active indicator - Left edge */}
                      {isActive && !isCollapsed && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary-foreground rounded-r-full"></div>
                      )}

                      {/* Active indicator - Dot for collapsed */}
                      {isActive && isCollapsed && (
                        <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-primary rounded-full shadow-glow-primary"></div>
                      )}

                      {/* Icon Container */}
                      <div className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-300 flex-shrink-0 ${
                        isActive
                          ? 'bg-primary-foreground/20'
                          : 'bg-primary/10 group-hover:bg-primary/20 group-hover:scale-110'
                      }`}>
                        <route.icon className="h-4 w-4" />
                      </div>

                      {/* Text Label - Only visible when expanded */}
                      {!isCollapsed && (
                        <span className="flex-1 truncate transition-opacity duration-300">
                          {route.title}
                        </span>
                      )}

                      {/* Hover tooltip for collapsed state */}
                      {isCollapsed && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50 border border-border">
                          {route.title}
                        </div>
                      )}
                    </Link>
                  );
                })
              ))}
            </div>
          </nav>

          {/* Footer - Settings & User Profile */}
          <div className="pt-4 space-y-2">
            {/* Settings Link */}
            <Link
              to="/settings"
              className={`group flex items-center ${isCollapsed ? 'justify-center px-2' : 'gap-3 px-3'} py-2 rounded-lg text-sm font-medium hover:bg-primary/5 hover:text-primary text-foreground/70 transition-all duration-300`}
              title={isCollapsed ? "Settings" : undefined}
            >
              <div className="w-8 h-8 flex items-center justify-center">
                <Settings className="h-4 w-4" />
              </div>
              {!isCollapsed && <span className="flex-1">Settings</span>}
              
              {/* Tooltip for collapsed */}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50">
                  Settings
                </div>
              )}
            </Link>

            {/* User Profile Card */}
            <div className={`${isCollapsed ? 'p-2' : 'p-3'} rounded-xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 shadow-lg`}>
              {isCollapsed ? (
                /* Collapsed User Avatar */
                <div className="relative group">
                  <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center text-primary-foreground font-heading font-semibold shadow-glow-primary cursor-pointer">
                    {user?.name?.charAt(0) || "U"}
                  </div>
                  
                  {/* User Info Tooltip */}
                  <div className="absolute left-full ml-2 px-3 py-2 bg-popover text-popover-foreground text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50 bottom-0">
                    <div className="font-semibold">{user?.name || "User"}</div>
                    <div className="text-muted-foreground">{user?.role || "User"}</div>
                  </div>
                </div>
              ) : (
                /* Expanded User Profile */
                <>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center text-primary-foreground font-heading font-semibold shadow-glow-primary flex-shrink-0">
                      {user?.name?.charAt(0) || "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{user?.name || "User"}</div>
                      <div className="text-xs text-muted-foreground truncate">{user?.role || "User"}</div>
                    </div>
                  </div>
                  <button
                    onClick={logout}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white dark:text-red-400 dark:hover:text-white transition-all duration-300 hover:shadow-lg hover:shadow-red-500/20 hover:scale-105 border border-red-500/20 hover:border-red-500"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                </>
              )}
              
              {/* Collapsed Sign Out Button */}
              {isCollapsed && (
                <button
                  onClick={logout}
                  className="w-full flex items-center justify-center mt-2 p-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white dark:text-red-400 dark:hover:text-white transition-all duration-300 group relative border border-red-500/20 hover:border-red-500 hover:shadow-lg hover:shadow-red-500/20"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                  
                  {/* Tooltip */}
                  <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50">
                    Sign Out
                  </div>
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </aside>
  );
}