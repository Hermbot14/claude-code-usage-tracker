import { app, BrowserWindow, shell, screen } from 'electron'
import { join } from 'node:path'
import { registerIpcHandlers } from './ipc-handlers'
import { StoreService } from './store-service'
import { TrayManager } from './tray-manager'

let mainWindow: BrowserWindow | null = null
let trayManager: TrayManager | null = null
let storeService: StoreService | null = null

// Simple is.dev check
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// Calculate overlay window bounds based on position
function calculateOverlayBounds(position: string): { x: number; y: number } {
  const display = screen.getPrimaryDisplay()
  const workArea = display.workArea
  const overlayWidth = 200
  const overlayHeight = 200
  const margin = 20

  switch (position) {
    case 'top-left':
      return { x: margin, y: margin }
    case 'top-right':
      return { x: workArea.width - overlayWidth - margin, y: margin }
    case 'bottom-left':
      return { x: margin, y: workArea.height - overlayHeight - margin }
    case 'bottom-right':
      return { x: workArea.width - overlayWidth - margin, y: workArea.height - overlayHeight - margin }
    default:
      return { x: margin, y: margin }
  }
}

function createWindow(overlayMode: boolean = false): void {
  // Get stored settings for overlay configuration
  const overlayPosition = storeService?.get('overlayPosition', 'top-right') || 'top-right'
  const savedBounds = storeService?.get('windowBounds')
  const customOverlayBounds = storeService?.get('customOverlayBounds')

  if (overlayMode) {
    // Overlay window configuration
    // Use custom position if user dragged it, otherwise use preset position
    const bounds = customOverlayBounds || calculateOverlayBounds(overlayPosition)

    mainWindow = new BrowserWindow({
      width: 200,
      height: 200,
      x: bounds.x,
      y: bounds.y,
      show: false,
      autoHideMenuBar: true,
      resizable: false,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: false,
      backgroundColor: '#00000000',
      title: 'Usage Tracker',
      webPreferences: {
        preload: join(__dirname, '../preload/index.cjs'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    // Apply the saved overlay opacity so the window is genuinely semi-transparent.
    const storedSettings = storeService?.get('settings', null) as
      | { overlayMode?: { opacity?: number } }
      | null
    const opacityPct = storedSettings?.overlayMode?.opacity
    if (typeof opacityPct === 'number') {
      mainWindow.setOpacity(Math.max(0.3, Math.min(1, opacityPct / 100)))
    }

    // Track overlay window movements to save custom position
    mainWindow.on('moved', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const newBounds = mainWindow.getBounds()
        storeService?.set('customOverlayBounds', { x: newBounds.x, y: newBounds.y })
      }
    })
  } else {
    // Normal window configuration
    mainWindow = new BrowserWindow({
      width: savedBounds?.width || 500,
      height: savedBounds?.height || 700,
      x: savedBounds?.x,
      y: savedBounds?.y,
      show: false,
      autoHideMenuBar: true,
      resizable: true,
      backgroundColor: '#f9fafb',
      title: 'Usage Tracker',
      webPreferences: {
        preload: join(__dirname, '../preload/index.cjs'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false,
      },
    })
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Handle renderer process crashes
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('Renderer process crashed:', details)
    // Attempt to reload the web contents
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('Attempting to reload renderer...')
      mainWindow.webContents.reload()
    }
  })

  // Handle unresponsive renderer
  mainWindow.on('unresponsive', () => {
    console.error('Renderer became unresponsive')
  })

  mainWindow.on('responsive', () => {
    console.log('Renderer became responsive again')
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Handle window close - hide to tray instead of quitting
  mainWindow.on('close', (event) => {
    if (!(app as any).isQuitting && mainWindow) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Recreate window with different overlay mode configuration
function recreateWindow(overlayMode: boolean): void {
  const wasOverlay = storeService?.get('overlayMode', false) || false

  // Save current window bounds if exiting overlay mode
  if (wasOverlay && !overlayMode && mainWindow) {
    // Nothing to save, overlay uses calculated position
  } else if (!wasOverlay && overlayMode && mainWindow) {
    // Save normal window bounds before switching to overlay
    const bounds = mainWindow.getBounds()
    storeService?.set('windowBounds', bounds)
  }

  // Close current window
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy()
  }

  // Create new window with overlay mode
  createWindow(overlayMode)

  // Update tray manager with new window reference
  if (mainWindow && trayManager) {
    trayManager.updateMainWindow(mainWindow)
  }
}

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // When opening second instance, focus the main window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    app.setAppUserModelId('com.usage-tracker.app')

    // Initialize store service
    storeService = new StoreService()

    // Check if we should start in overlay mode
    const overlayMode = storeService.get('overlayMode', false)

    // Create window
    createWindow(overlayMode)

    // Initialize tray manager after window creation
    trayManager = new TrayManager(mainWindow!)

    // Register IPC handlers with all required callbacks
    registerIpcHandlers(
      storeService,
      () => trayManager,
      () => mainWindow,
      recreateWindow
    )

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      // Don't quit, just hide to tray
      // User must explicitly quit from tray menu
    }
  })

  app.on('before-quit', () => {
    ;(app as any).isQuitting = true
    trayManager?.destroy()
  })

  app.on('will-quit', () => {
    trayManager?.destroy()
  })
}
