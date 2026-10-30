const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Consent
  getConsentStatus: () => ipcRenderer.invoke('get-consent-status'),
  giveConsent: () => ipcRenderer.invoke('give-consent'),
  
  // Authentication
  login: (credentials) => ipcRenderer.invoke('login', credentials),
  logout: () => ipcRenderer.invoke('logout'),
  
  // Attendance
  startDay: () => ipcRenderer.invoke('start-day'),
  endDay: () => ipcRenderer.invoke('end-day'),
  
  // App state
  getAppState: () => ipcRenderer.invoke('get-app-state'),
  getTrackingStats: () => ipcRenderer.invoke('get-tracking-stats'),
  
  // Event listeners
  onShowConsent: (callback) => ipcRenderer.on('show-consent', callback),
  onShowLogin: (callback) => ipcRenderer.on('show-login', callback),
  onShowDashboard: (callback) => ipcRenderer.on('show-dashboard', callback),
  onDayStatusChanged: (callback) => ipcRenderer.on('day-status-changed', (event, data) => callback(data))
});
