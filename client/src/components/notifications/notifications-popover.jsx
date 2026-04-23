
// "use client";

// import { useState } from "react";
// import { Bell } from "lucide-react";
// import { Button } from "../ui/button";
// import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
// import { Badge } from "../ui/badge";
// import { useDashboard } from "../../context/DashboardContext";
// import { useNavigate } from "react-router-dom";

// export function NotificationsPopover() {
//   const dashboardContext = useDashboard();
//   const { recentReviews = [], hasNewReviews = false, markReviewsAsSeen = () => {} } = dashboardContext || {};
//   const [readReviews, setReadReviews] = useState(new Set());
//   const navigate = useNavigate();

//   // Debug log to inspect recentReviews
//   console.log("recentReviews:", recentReviews);

//   // Ensure recentReviews is an array before filtering
//   const safeReviews = Array.isArray(recentReviews) ? recentReviews : [];
//   const unreadCount = safeReviews.filter((review) => !readReviews.has(review._id)).length;

//   const markAsRead = (reviewId) => {
//     setReadReviews((prev) => new Set([...prev, reviewId]));
//   };

//   return (
//     <Popover>
//       <PopoverTrigger asChild>
//         <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications (${unreadCount} unread)`}>
//           <Bell className="h-5 w-5" />
//           {unreadCount > 0 && (
//             <Badge className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs">
//               {unreadCount}
//             </Badge>
//           )}
//         </Button>
//       </PopoverTrigger>
//       <PopoverContent className="w-80 bg-white border shadow-xl rounded-xl p-4" align="end">
//         <div className="flex items-center justify-between mb-3">
//           <h4 className="text-sm font-medium">Notifications</h4>
//           {unreadCount > 0 && (
//             <Button
//               variant="link"
//               size="sm"
//               onClick={() => {
//                 markReviewsAsSeen();
//                 setReadReviews(new Set(safeReviews.map((r) => r._id)));
//               }}
//               className="text-blue-600 text-xs"
//             >
//               Mark all as read
//             </Button>
//           )}
//         </div>
//         <div className="space-y-2 max-h-64 overflow-y-auto">
//           {safeReviews.length === 0 ? (
//             <p className="text-sm text-muted-foreground text-center py-4">No new notifications</p>
//           ) : (
//             safeReviews.map((review) => (
//               <div
//                 key={review._id}
//                 className={`p-2 rounded-md text-sm ${
//                   readReviews.has(review._id) ? "bg-muted/50" : "bg-blue-50 dark:bg-blue-900/20"
//                 } cursor-pointer hover:bg-muted`}
//                 onClick={() => {
//                   markAsRead(review._id);
//                   navigate(`/tasks/${review.task._id}`);
//                 }}
//               >
//                 <p className="font-medium">
//                   Submission for "{review.task?.title || "Unknown Task"}" was {review.status}
//                 </p>
//                 <p className="text-xs text-muted-foreground">
//                   {new Date(review.updatedAt).toLocaleString()}
//                 </p>
//               </div>
//             ))
//           )}
//         </div>
//       </PopoverContent>
//     </Popover>
//   );
// }



import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Badge } from "../ui/badge";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_URL } from "@/lib/api";
import { formatDateTime } from "@/lib/dateFormat";

export function NotificationsPopover() {
  const [notifications, setNotifications] = useState([]);
  const [hasUnread, setHasUnread] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const storedUser = localStorage.getItem("WorkflowUser");
        const userId = storedUser ? JSON.parse(storedUser).id : null;
        if (!userId) return;

        const response = await axios.get(
          `${API_URL}/user-notifications/${userId}`
        );
        const notificationsData = Array.isArray(response.data) ? response.data : [];
        setNotifications(notificationsData);
        setHasUnread(notificationsData.some((notification) => !notification.read));
      } catch (error) {
        console.error("Error fetching notifications:", error);
      }
    };

    fetchNotifications();
    const intervalId = setInterval(fetchNotifications, 60 * 1000);
    return () => clearInterval(intervalId);
  }, []);

  const markNotificationAsRead = async (notificationId) => {
    try {
      const storedUser = localStorage.getItem("WorkflowUser");
      const userId = storedUser ? JSON.parse(storedUser).id : null;
      if (!userId) return;

      await axios.put(
        `${API_URL}/user-notifications/${notificationId}/read?userId=${userId}`
      );
      setNotifications(
        notifications.map((notification) =>
          notification._id === notificationId ? { ...notification, read: true } : notification
        )
      );
      setHasUnread(notifications.some((notification) => notification._id !== notificationId && !notification.read));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const storedUser = localStorage.getItem("WorkflowUser");
      const userId = storedUser ? JSON.parse(storedUser).id : null;
      if (!userId) return;

      await axios.put(
        `${API_URL}/user-notifications/read-all?userId=${userId}`
      );
      setNotifications(notifications.map((notification) => ({ ...notification, read: true })));
      setHasUnread(false);
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      const storedUser = localStorage.getItem("WorkflowUser");
      const userId = storedUser ? JSON.parse(storedUser).id : null;
      if (!userId) return;
  
      await axios.delete(`${API_URL}/user-notifications/${notificationId}?userId=${userId}`);
      setNotifications(notifications.filter((notification) => notification._id !== notificationId));
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative h-10 w-10 rounded-xl hover:bg-primary/10 transition-all duration-300 hover:scale-110" 
          aria-label={`Notifications (${notifications.length} unread)`}
        >
          <Bell className="h-5 w-5 transition-colors duration-300" />
          {hasUnread && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center gradient-primary text-primary-foreground text-xs font-bold shadow-glow-primary animate-pulse">
              {notifications.filter((notification) => !notification.read).length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 bg-card/95 dark:bg-card/98 backdrop-blur-xl border border-border shadow-2xl rounded-2xl p-0 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200" align="end" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center shadow-glow-primary">
              <Bell className="h-4 w-4 text-primary-foreground" />
            </div>
            <h4 className="text-base font-heading font-semibold text-foreground">Notifications</h4>
          </div>
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs font-medium text-primary hover:text-primary hover:bg-primary/10 transition-all duration-200 h-7 px-2 rounded-lg"
            >
              Mark all read
            </Button>
          )}
        </div>

        {/* Notifications List */}
        <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-border/50 scrollbar-track-transparent hover:scrollbar-thumb-border">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <Bell className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">You're all caught up!</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {notifications.map((notification) => (
                <div
                  key={notification._id}
                  className={`group relative p-3 rounded-xl text-sm transition-all duration-200 cursor-pointer ${
                    notification.read 
                      ? "bg-muted/30 dark:bg-muted/20 hover:bg-muted/50 dark:hover:bg-muted/30" 
                      : "bg-primary/10 dark:bg-primary/20 hover:bg-primary/15 dark:hover:bg-primary/25 border border-primary/20"
                  }`}
                  onClick={() => {
                    markNotificationAsRead(notification._id);
                    navigate(`/tasks/${notification.task}`);
                  }}
                >
                  {/* Unread Indicator */}
                  {!notification.read && (
                    <div className="absolute left-1 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full gradient-primary shadow-glow-primary"></div>
                  )}
                  
                  <div className="flex justify-between items-start gap-2 pl-2">
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium leading-snug mb-1 ${!notification.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {formatDateTime(notification.createdAt)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification._id);
                      }}
                      className="h-7 w-7 p-0 rounded-lg opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10 transition-all duration-200 shrink-0"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
