import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs
const api = {
  // Usage operations
  fetchUsage: (apiKey: string, baseUrl: string) =>
    ipcRenderer.invoke('fetch-usage', apiKey, baseUrl),
  fetchAccountUsage: (account: unknown) =>
    ipcRenderer.invoke('fetch-account-usage', account),
  listProviders: () => ipcRenderer.invoke('list-providers'),
  discoverLocalAccounts: () => ipcRenderer.invoke('discover-local-accounts'),

  // Store operations
  store: {
    get: (key: string, defaultValue?: unknown) =>
      ipcRenderer.invoke('store-get', key, defaultValue),
    set: (key: string, value: unknown) =>
      ipcRenderer.invoke('store-set', key, value),
    delete: (key: string) =>
      ipcRenderer.invoke('store-delete', key),
    clear: () =>
      ipcRenderer.invoke('store-clear'),
    getAll: () =>
      ipcRenderer.invoke('store-getAll'),
  },

  // Notifications
  showNotification: (title: string, body: string) =>
    ipcRenderer.invoke('show-notification', title, body),

  // Tray operations
  updateTray: (usage: any) =>
    ipcRenderer.invoke('update-tray', usage),
  minimizeToTray: () =>
    ipcRenderer.invoke('minimize-to-tray'),

  // App info
  getAppVersion: () =>
    ipcRenderer.invoke('get-app-version'),

  // Overlay mode operations
  setOverlayMode: (enabled: boolean) =>
    ipcRenderer.invoke('set-overlay-mode', enabled),
  setClickThrough: (enabled: boolean) =>
    ipcRenderer.invoke('set-click-through', enabled),
  setOverlayPosition: (position: string) =>
    ipcRenderer.invoke('set-overlay-position', position),
  setOverlayOpacity: (opacity: number) =>
    ipcRenderer.invoke('set-overlay-opacity', opacity),

  // Event listeners
  onRefreshUsage: (callback: () => void) => {
    ipcRenderer.on('refresh-usage', callback)
    return () => ipcRenderer.removeListener('refresh-usage', callback)
  },
}

// Use `contextBridge` APIs to expose Electron APIs to renderer
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
