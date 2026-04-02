
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Badge } from "../ui/badge";
import { useSocket } from "../../context/socket-context";
import { formatDateTime } from "../../lib/dateFormat";

export function Alerts() {
  const { monitoringAlerts } = useSocket();
  const [readAlerts, setReadAlerts] = useState(new Set());

  const unreadCount = monitoringAlerts.filter((alert) => !readAlerts.has(alert.data._id)).length;

  const markAsRead = (alertId) => {
    setReadAlerts((prev) => new Set([...prev, alertId]));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative h-10 w-10 rounded-xl hover:bg-destructive/10 transition-all duration-300 hover:scale-110" 
          aria-label={`Alerts (${unreadCount} unread)`}
        >
          <AlertTriangle className="h-5 w-5 text-destructive transition-colors duration-300" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-destructive text-destructive-foreground text-xs font-bold shadow-lg animate-pulse">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 bg-card/95 dark:bg-card/98 backdrop-blur-xl border border-border shadow-2xl rounded-2xl p-0 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200" align="end" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-gradient-to-br from-destructive/5 to-transparent">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-destructive flex items-center justify-center shadow-lg">
              <AlertTriangle className="h-4 w-4 text-destructive-foreground" />
            </div>
            <h4 className="text-base font-heading font-semibold text-foreground">Monitoring Alerts</h4>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setReadAlerts(new Set(monitoringAlerts.map((a) => a.data._id)));
              }}
              className="text-xs font-medium text-destructive hover:text-destructive hover:bg-destructive/10 transition-all duration-200 h-7 px-2 rounded-lg"
            >
              Mark all read
            </Button>
          )}
        </div>

        {/* Alerts List */}
        <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-border/50 scrollbar-track-transparent hover:scrollbar-thumb-border">
          {monitoringAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                <AlertTriangle className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No alerts</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Everything is running smoothly!</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {monitoringAlerts.map((alert) => (
                <div
                  key={alert.data._id}
                  className={`group relative p-3 rounded-xl text-sm transition-all duration-200 cursor-pointer ${
                    readAlerts.has(alert.data._id)
                      ? "bg-muted/30 dark:bg-muted/20 hover:bg-muted/50 dark:hover:bg-muted/30"
                      : "bg-destructive/10 dark:bg-destructive/20 hover:bg-destructive/15 dark:hover:bg-destructive/25 border border-destructive/20"
                  }`}
                  onClick={() => markAsRead(alert.data._id)}
                >
                  {/* Unread Indicator */}
                  {!readAlerts.has(alert.data._id) && (
                    <div className="absolute left-1 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-destructive shadow-lg"></div>
                  )}
                  
                  <div className="flex gap-3 pl-2">
                    <div className="shrink-0 mt-0.5">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                        readAlerts.has(alert.data._id) 
                          ? 'bg-muted' 
                          : 'bg-destructive/20 dark:bg-destructive/30'
                      }`}>
                        <AlertTriangle className={`h-4 w-4 ${
                          readAlerts.has(alert.data._id) 
                            ? 'text-muted-foreground' 
                            : 'text-destructive'
                        }`} />
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold leading-snug mb-1 ${
                        !readAlerts.has(alert.data._id) ? 'text-foreground' : 'text-muted-foreground'
                      }`}>
                        {alert.data.title}
                      </p>
                      <p className={`text-xs leading-relaxed mb-2 ${
                        !readAlerts.has(alert.data._id) 
                          ? 'text-foreground/80 dark:text-foreground/70' 
                          : 'text-muted-foreground/80'
                      }`}>
                        {alert.data.description}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {formatDateTime(alert.timestamp)}
                      </p>
                    </div>
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
