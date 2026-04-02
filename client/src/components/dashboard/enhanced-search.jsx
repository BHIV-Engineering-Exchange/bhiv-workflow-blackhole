import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, User, Clock, CheckCircle, Calendar, X, TrendingUp, Briefcase, Mail, Phone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { searchUsers } from '@/lib/user-api';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/dateFormat';

export function EnhancedSearch({ onUserSelect }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [hasSearched, setHasSearched] = useState(false);
  const searchRef = useRef(null);
  const suggestionsRef = useRef(null);
  const itemRefs = useRef([]);

  // Search users function
  const handleSearchUsers = async (query) => {
    if (!query.trim()) {
      setSuggestions([]);
      setHasSearched(false);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    setHasSearched(false);
    try {
      const results = await searchUsers(query);
      setSuggestions(results);
      setHasSearched(true);
      setSelectedIndex(-1);
      setIsOpen(true); // Always open when results come back
    } catch (error) {
      console.error('Error searching users:', error);
      setSuggestions([]);
      setHasSearched(true);
      setIsOpen(true); // Keep open to show "no results"
    } finally {
      setLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearchUsers(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle input change
  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (value.length > 0) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
      setSuggestions([]);
      setHasSearched(false);
    }
  };

  // Handle user selection
  const handleUserSelect = useCallback((user) => {
    setSearchQuery('');
    setIsOpen(false);
    setSuggestions([]);
    setSelectedIndex(-1);
    setHasSearched(false);
    onUserSelect(user);
  }, [onUserSelect]);

  // Clear search
  const handleClearSearch = () => {
    setSearchQuery('');
    setIsOpen(false);
    setSuggestions([]);
    setSelectedIndex(-1);
    setHasSearched(false);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen || suggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < suggestions.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && suggestions[selectedIndex]) {
            handleUserSelect(suggestions[selectedIndex]);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          setSelectedIndex(-1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, suggestions, selectedIndex, handleUserSelect]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex].scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [selectedIndex]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate completion rate color
  const getCompletionRateColor = (rate) => {
    if (rate >= 90) return 'text-emerald-500 dark:text-emerald-400';
    if (rate >= 75) return 'text-amber-500 dark:text-amber-400';
    return 'text-rose-500 dark:text-rose-400';
  };

  // Highlight matching text
  const highlightMatch = (text, query) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-primary/20 text-primary font-semibold rounded px-0.5">
          {part}
        </mark>
      ) : part
    );
  };

  return (
    <div className="search-container relative w-full flex-1 hidden md:flex group" ref={searchRef}>
      {/* Search Icon */}
      <Search className={cn(
        "absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 transition-all duration-300 z-10",
        searchQuery 
          ? "text-primary scale-110" 
          : "text-muted-foreground group-focus-within:text-primary group-focus-within:scale-110"
      )} />
      
      {/* Search Input */}
      <Input
        type="search"
        placeholder="Search users, tasks, departments..."
        className={cn(
          "w-full pl-12 h-12 rounded-2xl transition-all duration-300 text-sm font-medium placeholder:text-muted-foreground/60",
          "bg-gradient-to-r from-card/60 via-card/40 to-card/60 backdrop-blur-md",
          "border-2 border-border/30 hover:border-primary/30 focus-visible:border-primary/50",
          "shadow-lg hover:shadow-xl hover:shadow-primary/10 dark:hover:shadow-primary/5",
          "focus-visible:ring-4 focus-visible:ring-primary/15 focus-visible:ring-offset-0",
          "focus-visible:scale-[1.02]",
          searchQuery ? "pr-10 border-primary/40 shadow-xl shadow-primary/10" : "pr-4"
        )}
        value={searchQuery}
        onChange={handleInputChange}
        onFocus={() => searchQuery && setIsOpen(true)}
      />

      {/* Clear Button */}
      {searchQuery && (
        <button
          onClick={handleClearSearch}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all duration-200 z-10 group/clear"
        >
          <X className="h-4 w-4 group-hover/clear:rotate-90 transition-transform duration-200" />
        </button>
      )}

      {/* Search Suggestions Dropdown */}
      {isOpen && (
        <Card
          ref={suggestionsRef}
          className={cn(
            "absolute top-full left-0 right-0 mt-3 z-50",
            "min-w-full w-auto",
            "bg-gradient-to-br from-card/98 via-card/95 to-card/98",
            "dark:bg-gradient-to-br dark:from-card/98 dark:via-card/90 dark:to-card/95",
            "backdrop-blur-3xl",
            "border-2 border-primary/40 dark:border-primary/30",
            "shadow-[0_25px_60px_-12px_rgba(0,0,0,0.25)] dark:shadow-[0_30px_70px_-12px_rgba(0,0,0,0.7)]",
            "rounded-3xl overflow-hidden",
            "animate-in fade-in slide-in-from-top-2 duration-300",
            "ring-2 ring-primary/20 dark:ring-primary/15",
            "before:absolute before:inset-0 before:bg-gradient-to-br before:from-primary/5 before:via-transparent before:to-primary/5 before:pointer-events-none"
          )}
        >
          {/* Loading State */}
          {loading && (
            <div className="p-10 text-center">
              <div className="flex flex-col items-center justify-center gap-5">
                <div className="relative">
                  {/* Outer Ring */}
                  <div className="h-16 w-16 border-4 border-primary/10 rounded-full"></div>
                  {/* Spinning Ring */}
                  <div className="absolute inset-0 h-16 w-16 border-4 border-transparent border-t-primary border-r-primary/60 rounded-full animate-spin"></div>
                  {/* Inner Glow */}
                  <div className="absolute inset-2 bg-primary/10 rounded-full blur-xl"></div>
                  {/* Icon */}
                  <Search className="absolute inset-0 m-auto h-6 w-6 text-primary animate-pulse" />
                </div>
                <div className="space-y-2">
                  <p className="text-base font-bold text-foreground">Searching...</p>
                  <p className="text-xs text-muted-foreground">Finding the best matches for you</p>
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          {!loading && suggestions.length > 0 && (
            <div className="max-h-[32rem] overflow-y-auto custom-scrollbar">
              {/* Header */}
              <div className="sticky top-0 z-10 backdrop-blur-xl bg-gradient-to-r from-card/95 via-card/80 to-card/95 border-b border-primary/20 shadow-sm">
                <div className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-primary/10 ring-1 ring-primary/20">
                      <User className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-xs font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent uppercase tracking-wider">
                      Users Found
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-xs font-semibold px-3 py-1 bg-primary/10 border border-primary/20 shadow-sm">
                    {suggestions.length} {suggestions.length === 1 ? 'result' : 'results'}
                  </Badge>
                </div>
              </div>

              {/* User List */}
              <div className="p-3.5 space-y-2.5">
                {suggestions.map((user, index) => {
                  if (!user || !user.name) return null;

                  const isSelected = index === selectedIndex;

                  return (
                    <div
                      key={user._id || user.id}
                      ref={el => itemRefs.current[index] = el}
                      onClick={() => handleUserSelect(user)}
                      className={cn(
                        "flex items-start gap-4 p-4 rounded-2xl cursor-pointer transition-all duration-300",
                        "border-2 border-transparent hover:border-primary/40",
                        "group/item relative overflow-hidden",
                        "backdrop-blur-sm",
                        isSelected 
                          ? "bg-gradient-to-r from-primary/25 via-primary/15 to-primary/10 border-primary/50 shadow-xl shadow-primary/10 scale-[1.02]" 
                          : "bg-gradient-to-r from-muted/30 to-transparent hover:from-primary/15 hover:to-primary/5 hover:scale-[1.01] hover:shadow-lg"
                      )}
                    >
                      {/* Animated Background */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent -translate-x-full group-hover/item:translate-x-full transition-transform duration-1000 ease-in-out" />
                      
                      {/* Glow Effect */}
                      <div className={cn(
                        "absolute inset-0 rounded-2xl opacity-0 group-hover/item:opacity-100 transition-opacity duration-300",
                        "bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 blur-xl"
                      )} />

                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                      <Avatar className={cn(
                          "h-14 w-14 ring-2 transition-all duration-300 shadow-lg flex-shrink-0 relative z-10",
                        isSelected 
                            ? "ring-primary/70 ring-4 shadow-2xl shadow-primary/30 scale-110" 
                            : "ring-primary/30 group-hover/item:ring-primary/60 group-hover/item:ring-4 group-hover/item:shadow-2xl group-hover/item:shadow-primary/25 group-hover/item:scale-105"
                      )}>
                        <AvatarImage src={user.avatar} alt={user.name} />
                        <AvatarFallback className="gradient-primary text-primary-foreground font-bold text-sm">
                          {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                        {/* Avatar Glow */}
                        <div className={cn(
                          "absolute inset-0 rounded-full blur-lg transition-opacity duration-300",
                          isSelected ? "opacity-40 bg-primary/40" : "opacity-0 group-hover/item:opacity-30 group-hover/item:bg-primary/30"
                        )} />
                      </div>

                      {/* User Info */}
                      <div className="flex-1 min-w-0 space-y-2.5">
                        {/* Name and Role */}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <h4 className={cn(
                              "font-bold text-base transition-colors duration-200 truncate",
                              isSelected ? "text-primary" : "text-foreground group-hover/item:text-primary"
                            )}>
                              {highlightMatch(user.name, searchQuery)}
                            </h4>
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-xs shrink-0 transition-all duration-300 px-2.5 py-0.5 font-semibold shadow-sm backdrop-blur-sm",
                                isSelected 
                                  ? "border-primary/60 bg-gradient-to-r from-primary/20 to-primary/10 text-primary shadow-md" 
                                  : "border-primary/40 bg-gradient-to-r from-primary/10 to-primary/5 group-hover/item:border-primary/60 group-hover/item:from-primary/20 group-hover/item:to-primary/10 group-hover/item:shadow-md"
                              )}
                            >
                              {user.role}
                            </Badge>
                          </div>
                          
                          {/* Department Badge */}
                          <Badge variant="secondary" className="shrink-0 text-xs px-3 py-1 bg-gradient-to-r from-secondary/80 to-secondary/60 border border-border/40 shadow-sm backdrop-blur-sm">
                            <Briefcase className="h-3 w-3 mr-1.5" />
                            <span className="font-semibold">{user.department?.name || user.department || 'No Dept'}</span>
                          </Badge>
                        </div>

                        {/* Email */}
                        {user.email && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{user.email}</span>
                          </div>
                        )}

                        {/* Stats Row - Better Horizontal Layout */}
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-3">
                            {/* Completion Rate */}
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-muted/60 to-muted/40 border border-border/40 backdrop-blur-sm shadow-sm">
                              <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
                              <span className="text-muted-foreground font-medium">Completion:</span>
                              <span className={cn("font-bold", getCompletionRateColor(user.completionRate))}>
                                {user.completionRate}%
                              </span>
                            </div>
                            
                            {/* Active Tasks */}
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-500/15 to-blue-500/5 border border-blue-500/20 backdrop-blur-sm shadow-sm">
                              <Clock className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                              <span className="font-bold text-blue-600 dark:text-blue-400">
                                {user.activeTasks} active
                              </span>
                            </div>
                          </div>

                          {/* Join Date */}
                          <div className="flex items-center gap-1.5 text-muted-foreground px-2 py-1 rounded-lg bg-muted/20">
                            <Calendar className="h-3 w-3 flex-shrink-0" />
                            <span className="font-medium">Joined {formatDate(user.joinDate)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Keyboard Indicator */}
                      {isSelected && (
                        <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-primary/20 to-primary/10 text-primary text-xs font-semibold border border-primary/30 shadow-lg backdrop-blur-sm animate-pulse">
                          <span>Press</span>
                          <kbd className="px-2 py-1 bg-primary/30 rounded-lg border border-primary/40 shadow-sm font-bold">↵</kbd>
                        </div>
                      )}
                    </div>
                  );
                }).filter(Boolean)}
              </div>

              {/* Footer Hint */}
              <div className="sticky bottom-0 backdrop-blur-xl bg-gradient-to-r from-card/95 via-card/80 to-card/95 border-t border-primary/20 shadow-lg px-5 py-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2.5">
                    <kbd className="px-2 py-1 bg-gradient-to-b from-muted to-muted/80 rounded-lg text-[10px] font-bold border border-border/60 shadow-sm">↑</kbd>
                    <kbd className="px-2 py-1 bg-gradient-to-b from-muted to-muted/80 rounded-lg text-[10px] font-bold border border-border/60 shadow-sm">↓</kbd>
                    <span className="font-medium">Navigate</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <kbd className="px-2 py-1 bg-gradient-to-b from-primary/20 to-primary/10 rounded-lg text-[10px] font-bold border border-primary/30 shadow-sm text-primary">↵</kbd>
                    <span className="font-medium">Select</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <kbd className="px-2 py-1 bg-gradient-to-b from-muted to-muted/80 rounded-lg text-[10px] font-bold border border-border/60 shadow-sm">Esc</kbd>
                    <span className="font-medium">Close</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && hasSearched && suggestions.length === 0 && (
            <div className="p-10 text-center">
              <div className="flex flex-col items-center justify-center gap-5">
                <div className="relative">
                  <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-muted/60 to-muted/40 flex items-center justify-center border border-border/40 shadow-lg backdrop-blur-sm">
                    <Search className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 h-8 w-8 rounded-xl bg-gradient-to-br from-destructive/20 to-destructive/10 border-2 border-destructive/30 flex items-center justify-center shadow-lg backdrop-blur-sm">
                    <X className="h-4 w-4 text-destructive" />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-base font-bold text-foreground">No results found</p>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    We couldn't find any users matching "<span className="font-bold text-foreground px-2 py-0.5 bg-primary/10 rounded">{searchQuery}</span>"
                  </p>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  <p className="font-semibold mb-3">Try searching by:</p>
                  <div className="flex flex-wrap justify-center gap-2.5">
                    <Badge variant="outline" className="text-xs px-3 py-1 bg-muted/30 hover:bg-muted/50 transition-colors border-border/60">Name</Badge>
                    <Badge variant="outline" className="text-xs px-3 py-1 bg-muted/30 hover:bg-muted/50 transition-colors border-border/60">Email</Badge>
                    <Badge variant="outline" className="text-xs px-3 py-1 bg-muted/30 hover:bg-muted/50 transition-colors border-border/60">Department</Badge>
                    <Badge variant="outline" className="text-xs px-3 py-1 bg-muted/30 hover:bg-muted/50 transition-colors border-border/60">Role</Badge>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
