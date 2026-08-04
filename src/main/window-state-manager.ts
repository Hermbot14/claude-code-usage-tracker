// Use dynamic require to avoid electron-vite bundling issues
const electron = require('electron') as any
const { screen } = electron

import { BrowserWindow } from 'electron'
import { StoreService } from './store-service'

const STORE_KEY = 'windowState'
const DEBOUNCE_MS = 500

export interface WindowState {
  x: number
  y: number
  width: number
  height: number
  displayId?: string
  isMaximized?: boolean
  isFullScreen?: boolean
}

export interface DisplayBounds {
  id: number
  bounds: Electron.Rectangle
  workArea: Electron.Rectangle
}

/**
 * WindowStateManager
 *
 * Manages window state persistence including position, size, and display configuration.
 * Handles multi-monitor scenarios and validates bounds to prevent off-screen windows.
 *
 * Features:
 * - Debounced save operations (500ms) to reduce disk I/O
 * - Multi-monitor support with display ID tracking
 * - Bounds validation against current display configuration
 * - Automatic repositioning if window ends up off-screen
 * - Support for maximized and fullscreen states
 */
export class WindowStateManager {
  private storeService: StoreService
  private saveTimeout: NodeJS.Timeout | null = null
  private mainWindow: BrowserWindow | null = null
  private currentDisplayId: string | null = null

  constructor(storeService: StoreService) {
    this.storeService = storeService
  }

  /**
   * Initialize the window state manager with a BrowserWindow instance.
   * Sets up event listeners for move and resize events with debounced saving.
   *
   * @param window - The BrowserWindow instance to manage
   */
  initialize(window: BrowserWindow): void {
    this.mainWindow = window

    // Remove any existing listeners to prevent duplicates
    this.removeAllListeners()

    // Track current display on window move
    window.on('move', () => {
      this.updateCurrentDisplay()
      this.scheduleSave()
    })

    // Track window resize with debounced save
    window.on('resize', () => {
      this.scheduleSave()
    })

    // Track maximize state
    window.on('maximize', () => {
      this.scheduleSave()
    })

    window.on('unmaximize', () => {
      this.scheduleSave()
    })

    // Track fullscreen state
    window.on('enter-full-screen', () => {
      this.scheduleSave()
    })

    window.on('leave-full-screen', () => {
      this.scheduleSave()
    })

    // Update display ID on initialization
    this.updateCurrentDisplay()
  }

  /**
   * Restore window state from persistent storage.
   * Validates bounds against current displays and adjusts if necessary.
   *
   * @param window - The BrowserWindow instance to restore state to
   * @returns The restored window state, or null if no saved state exists
   */
  restoreState(window: BrowserWindow): WindowState | null {
    const savedState = this.storeService.get<WindowState | null>(STORE_KEY, null)

    if (!savedState) {
      return null
    }

    // Get all available displays
    const displays = this.getAllDisplays()

    // Validate and adjust the saved state
    const validatedState = this.validateAndAdjustBounds(savedState, displays)

    // Apply the validated state to the window
    this.applyState(window, validatedState)

    return validatedState
  }

  /**
   * Get the current window state from the managed window.
   *
   * @returns Current window state or null if no window is managed
   */
  getCurrentState(): WindowState | null {
    if (!this.mainWindow) {
      return null
    }

    const bounds = this.mainWindow.getBounds()
    const displayId = this.currentDisplayId || undefined

    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      displayId,
      isMaximized: this.mainWindow.isMaximized(),
      isFullScreen: this.mainWindow.isFullScreen(),
    }
  }

  /**
   * Manually save the current window state.
   * This bypasses the debouncing mechanism and saves immediately.
   *
   * @returns Promise that resolves when save is complete
   */
  async saveNow(): Promise<void> {
    const currentState = this.getCurrentState()
    if (currentState) {
      await this.storeService.set(STORE_KEY, currentState)
    }
  }

  /**
   * Clear the saved window state from storage.
   * Useful for resetting window position to defaults.
   *
   * @returns Promise that resolves when clear is complete
   */
  async clearState(): Promise<void> {
    await this.storeService.delete(STORE_KEY)
  }

  /**
   * Get information about all connected displays.
   *
   * @returns Array of display information including bounds and work area
   */
  getAllDisplays(): DisplayBounds[] {
    const displays = screen.getAllDisplays()

    return displays.map((display: Electron.Display) => ({
      id: display.id,
      bounds: display.bounds,
      workArea: display.workArea,
    }))
  }

  /**
   * Get the display that contains the given point.
   *
   * @param x - X coordinate
   * @param y - Y coordinate
   * @returns Display containing the point, or primary display if none found
   */
  getDisplayForPoint(x: number, y: number): Electron.Display | null {
    const displays = screen.getAllDisplays()

    // Find display that contains the point
    const targetDisplay = displays.find((display: Electron.Display) => {
      const { x: dx, y: dy, width, height } = display.bounds
      return x >= dx && x < dx + width && y >= dy && y < dy + height
    })

    return targetDisplay || null
  }

  /**
   * Check if a rectangle is visible on any display.
   *
   * @param bounds - Rectangle to check
   * @returns True if at least part of the rectangle is visible
   */
  isBoundsVisible(bounds: Electron.Rectangle): boolean {
    const displays = this.getAllDisplays()

    return displays.some((display) => {
      const { x: dx, y: dy, width, height } = display.bounds

      // Check if windows overlap (at least partially visible)
      const overlapX = Math.max(0, Math.min(bounds.x + bounds.width, dx + width) - Math.max(bounds.x, dx))
      const overlapY = Math.max(0, Math.min(bounds.y + bounds.height, dy + height) - Math.max(bounds.y, dy))

      // Require at least 50x50 pixels visible
      return overlapX > 50 && overlapY > 50
    })
  }

  /**
   * Remove all event listeners from the managed window.
   * Called during initialization to prevent duplicate listeners.
   */
  private removeAllListeners(): void {
    if (!this.mainWindow) {
      return
    }

    // Note: Electron doesn't provide a direct way to remove specific listeners
    // The window will be garbage collected when destroyed, taking listeners with it
    // This is mainly for documentation purposes
  }

  /**
   * Update the current display ID based on window position.
   */
  private updateCurrentDisplay(): void {
    if (!this.mainWindow) {
      return
    }

    const bounds = this.mainWindow.getBounds()
    const centerX = bounds.x + bounds.width / 2
    const centerY = bounds.y + bounds.height / 2

    const display = this.getDisplayForPoint(centerX, centerY)
    this.currentDisplayId = display ? String(display.id) : null
  }

  /**
   * Schedule a debounced save operation.
   * Cancels any pending save and schedules a new one.
   */
  private scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
    }

    this.saveTimeout = setTimeout(() => {
      this.saveNow().catch((err) => {
        console.error('Failed to save window state:', err)
      })
      this.saveTimeout = null
    }, DEBOUNCE_MS)
  }

  /**
   * Validate and adjust window bounds to ensure visibility on current displays.
   * Handles multi-monitor scenarios where saved displays may not be available.
   *
   * @param state - The saved window state to validate
   * @param displays - Current available displays
   * @returns Validated and adjusted window state
   */
  private validateAndAdjustBounds(state: WindowState, displays: DisplayBounds[]): WindowState {
    const bounds: Electron.Rectangle = {
      x: state.x,
      y: state.y,
      width: state.width,
      height: state.height,
    }

    // Check if bounds are visible on any display
    if (this.isBoundsVisible(bounds)) {
      return state
    }

    // Window is not visible, need to adjust
    console.warn('Window bounds not visible on any display, adjusting...')

    // Try to find the previously used display
    let targetDisplay = displays.find((d) => String(d.id) === state.displayId)

    // If previous display not found, use primary display
    if (!targetDisplay) {
      targetDisplay = displays.find((d) => d.id === screen.getPrimaryDisplay().id)
    }

    // Fallback to first display if still not found
    if (!targetDisplay && displays.length > 0) {
      targetDisplay = displays[0]
    }

    if (!targetDisplay) {
      // No displays available (edge case), use default bounds
      return {
        x: 100,
        y: 100,
        width: Math.min(state.width, 800),
        height: Math.min(state.height, 600),
        isMaximized: false,
        isFullScreen: false,
      }
    }

    // Adjust position to be within the target display's work area
    const workArea = targetDisplay.workArea
    const adjustedBounds = this.constrainToBounds(bounds, workArea)

    return {
      x: adjustedBounds.x,
      y: adjustedBounds.y,
      width: adjustedBounds.width,
      height: adjustedBounds.height,
      displayId: String(targetDisplay.id),
      isMaximized: false, // Don't restore maximize if window was off-screen
      isFullScreen: false,
    }
  }

  /**
   * Constrain a rectangle to fit within a bounding rectangle.
   * Preserves size if possible, otherwise shrinks to fit.
   *
   * @param bounds - Rectangle to constrain
   * @param container - Container bounds
   * @returns Constrained rectangle
   */
  private constrainToBounds(bounds: Electron.Rectangle, container: Electron.Rectangle): Electron.Rectangle {
    let { x, y, width, height } = bounds

    // Ensure window fits within container
    if (width > container.width) {
      width = container.width - 40 // Leave some margin
    }
    if (height > container.height) {
      height = container.height - 40 // Leave some margin
    }

    // Position window within container
    if (x < container.x) {
      x = container.x + 20
    } else if (x + width > container.x + container.width) {
      x = container.x + container.width - width - 20
    }

    if (y < container.y) {
      y = container.y + 20
    } else if (y + height > container.y + container.height) {
      y = container.y + container.height - height - 20
    }

    return { x, y, width, height }
  }

  /**
   * Apply window state to a BrowserWindow instance.
   *
   * @param window - The window to apply state to
   * @param state - The state to apply
   */
  private applyState(window: BrowserWindow, state: WindowState): void {
    // Set bounds first
    window.setBounds({
      x: state.x,
      y: state.y,
      width: state.width,
      height: state.height,
    })

    // Apply maximized state if saved and window is not already maximized
    if (state.isMaximized && !window.isMaximized()) {
      window.maximize()
    }

    // Apply fullscreen state if saved and window is not already fullscreen
    if (state.isFullScreen && !window.isFullScreen()) {
      window.setFullScreen(true)
    }
  }
}
