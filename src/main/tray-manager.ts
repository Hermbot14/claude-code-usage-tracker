import { Tray, Menu, nativeImage, BrowserWindow, Notification, app } from 'electron'
import { join } from 'node:path'
import type { UsageData } from '../renderer/types'

export class TrayManager {
  private tray: Tray | null = null
  private mainWindow: BrowserWindow | null = null
  private currentUsage: UsageData | null = null
  /** Provided by main: reverts overlay → dashboard and shows the window. */
  private onShowDashboard?: () => void

  constructor(mainWindow: BrowserWindow, onShowDashboard?: () => void) {
    this.mainWindow = mainWindow
    this.onShowDashboard = onShowDashboard
    this.createTray()
  }

  private createTray(): void {
    // Use a simple colored icon for development
    // In production, load from resources
    const icon = this.createStatusIcon('healthy')
    this.tray = new Tray(icon)

    // Set initial tooltip so it doesn't show "Electron"
    this.tray.setToolTip('Usage Tracker\nLoading...')

    // Left-click (or double-click) the tray icon → show the dashboard.
    this.tray.on('click', () => this.showDashboard())
    this.tray.on('double-click', () => this.showDashboard())

    this.updateMenu()
  }

  private createStatusIcon(status: 'healthy' | 'warning' | 'critical'): ReturnType<typeof nativeImage.createFromBuffer> {
    // Create a simple colored square as icon
    const size = 16
    const canvas = {
      data: Buffer.alloc(size * size * 4),
      width: size,
      height: size,
    }

    let color = { r: 34, g: 197, b: 94 } // green
    if (status === 'warning') {
      color = { r: 234, g: 179, b: 8 } // yellow
    } else if (status === 'critical') {
      color = { r: 239, g: 68, b: 68 } // red
    }

    // Fill with color
    for (let i = 0; i < size * size; i++) {
      canvas.data[i * 4] = color.r
      canvas.data[i * 4 + 1] = color.g
      canvas.data[i * 4 + 2] = color.b
      canvas.data[i * 4 + 3] = 255 // alpha
    }

    return nativeImage.createFromBuffer(canvas.data, {
      width: canvas.width,
      height: canvas.height,
    })
  }

  updateUsage(usage: UsageData | null): void {
    this.currentUsage = usage

    if (!this.tray) return

    // Update icon based on usage
    let status: 'healthy' | 'warning' | 'critical' = 'healthy'
    if (usage) {
      if (usage.sessionPercent >= 80) status = 'critical'
      else if (usage.sessionPercent >= 50) status = 'warning'
    }

    const newIcon = this.createStatusIcon(status)
    this.tray.setImage(newIcon)

    this.updateMenu()
    this.updateTooltip()
    this.updateTaskbarOverlay()
    this.updateWindowTitle()
  }

  private updateMenu(): void {
    if (!this.tray) return

    const percentText = this.currentUsage
      ? `${this.currentUsage.sessionPercent}% (${Math.round(this.currentUsage.sessionUsage / 1000)}K/${Math.round(this.currentUsage.sessionLimit / 1000)}K)`
      : 'Loading...'

    const template = [
      {
        label: `Usage Tracker - ${percentText}`,
        enabled: false,
      },
      { type: 'separator' as const },
      {
        label: 'Show Dashboard',
        click: () => this.showDashboard(),
      },
      {
        label: 'Refresh',
        click: () => this.refreshUsage(),
      },
      { type: 'separator' as const },
      {
        label: 'Quit',
        click: () => this.quit(),
      },
    ]

    const contextMenu = Menu.buildFromTemplate(template)
    this.tray.setContextMenu(contextMenu)
  }

  private updateTooltip(): void {
    if (!this.tray || !this.currentUsage) {
      this.tray?.setToolTip('Usage Tracker\nLoading...')
      return
    }

    const usage = this.currentUsage
    const resetTime = new Date(usage.sessionResetTime)
    const timeUntilReset = this.formatTimeUntil(resetTime)

    this.tray.setToolTip(
      `Usage Tracker\n` +
      `Session: ${usage.sessionPercent}% (${Math.round(usage.sessionUsage / 1000)}K/${Math.round(usage.sessionLimit / 1000)}K tokens)\n` +
      `Weekly: ${usage.weeklyPercent}%\n` +
      `Resets in: ${timeUntilReset}`
    )
  }

  private formatTimeUntil(date: Date): string {
    const now = new Date()
    const diff = date.getTime() - now.getTime()

    if (diff <= 0) return 'soon'

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  private updateTaskbarOverlay(): void {
    if (!this.mainWindow || !this.currentUsage) {
      this.mainWindow?.setOverlayIcon(null, '')
      return
    }

    const percent = this.currentUsage.sessionPercent
    const overlayIcon = this.createPercentageOverlay(percent)
    const timeUntilReset = this.formatTimeUntil(new Date(this.currentUsage.sessionResetTime))

    // Set overlay icon with tooltip
    this.mainWindow.setOverlayIcon(overlayIcon, `${percent}% usage · Resets in ${timeUntilReset}`)
  }

  // Simple 3x5 bitmap font for digits 0-9 (using 3-bit patterns)
  // Each row is a 3-bit number representing pixels: 1=pixel, 0=empty
  private readonly digitBitmaps: Record<string, number[]> = {
    '0': [3, 5, 5, 5, 3],  // ###  #.#  #.#  #.#  ###
    '1': [1, 3, 1, 1, 5],  //  #   ###   #    #   #.#
    '2': [3, 5, 2, 4, 7],  // ###  #.#   #    #   ####
    '3': [7, 2, 6, 5, 3],  // ####   #   ###  #.#  ###
    '4': [5, 5, 7, 1, 1],  // #.#  #.#  ####   #    #
    '5': [7, 4, 6, 5, 3],  // ####   #   ###  #.#  ###
    '6': [3, 4, 6, 5, 3],  // ###   #   ###  #.#  ###
    '7': [7, 5, 1, 2, 4],  // ####  #.#   #    #    #
    '8': [3, 5, 3, 5, 3],  // ###  #.#  ###  #.#  ###
    '9': [3, 5, 7, 1, 3],  // ###  #.#  ####   #   ###
    '%': [0, 0, 0, 0, 0],  // Skip % for now, too small
  }

  private createPercentageOverlay(percent: number): Electron.NativeImage {
    const size = 32
    const canvas = {
      data: Buffer.alloc(size * size * 4),
      width: size,
      height: size,
    }

    // Determine color based on usage level
    let color = { r: 34, g: 197, b: 94 } // green
    if (percent >= 80) color = { r: 239, g: 68, b: 68 } // red
    else if (percent >= 50) color = { r: 234, g: 179, b: 8 } // yellow

    // Clear buffer (transparent background)
    for (let i = 0; i < size * size * 4; i++) {
      canvas.data[i] = 0
    }

    // For simplicity, just show the percent as a colored badge with circle
    // Draw a circle background
    const centerX = Math.floor(size / 2)
    const centerY = Math.floor(size / 2)
    const radius = Math.floor(size / 2) - 2

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - centerX
        const dy = y - centerY
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance <= radius) {
          const i = (y * size + x) * 4
          canvas.data[i] = color.r
          canvas.data[i + 1] = color.g
          canvas.data[i + 2] = color.b
          canvas.data[i + 3] = 255 // alpha
        }
      }
    }

    // Draw text as white pixels in the center
    const text = percent.toString()
    const digitWidth = 3
    const digitHeight = 5
    const scale = 2
    const spacing = 1
    const totalWidth = text.length * (digitWidth * scale + spacing * scale)

    let startX = Math.floor((size - totalWidth) / 2)
    const startY = Math.floor((size - digitHeight * scale) / 2)

    for (let charIndex = 0; charIndex < text.length; charIndex++) {
      const char = text[charIndex]
      const bitmap = this.digitBitmaps[char]

      if (!bitmap) continue

      // Draw each digit with white pixels
      for (let row = 0; row < digitHeight; row++) {
        const rowData = bitmap[row]
        for (let col = 0; col < digitWidth; col++) {
          // Check if this pixel is set (bit 2-col for 3-bit patterns)
          if (rowData & (1 << (2 - col))) {
            // Draw scaled pixels in white
            for (let sy = 0; sy < scale; sy++) {
              for (let sx = 0; sx < scale; sx++) {
                const x = startX + col * scale + sx
                const y = startY + row * scale + sy

                if (x >= 0 && x < size && y >= 0 && y < size) {
                  const i = (y * size + x) * 4
                  canvas.data[i] = 255     // R - white
                  canvas.data[i + 1] = 255 // G - white
                  canvas.data[i + 2] = 255 // B - white
                  canvas.data[i + 3] = 255 // alpha
                }
              }
            }
          }
        }
      }

      startX += digitWidth * scale + spacing * scale
    }

    return nativeImage.createFromBuffer(canvas.data, {
      width: canvas.width,
      height: canvas.height,
    })
  }

  private updateWindowTitle(): void {
    if (!this.mainWindow || !this.currentUsage) {
      this.mainWindow?.setTitle('Usage Tracker')
      return
    }

    const usage = this.currentUsage
    const timeUntilReset = this.formatTimeUntil(new Date(usage.sessionResetTime))
    this.mainWindow.setTitle(`Usage Tracker · ${usage.sessionPercent}% · Resets in ${timeUntilReset}`)
  }

  showNotification(title: string, body: string): void {
    if (Notification.isSupported()) {
      new Notification({ title, body, silent: false }).show()
    }
  }

  /**
   * Show the dashboard. If main provided an onShowDashboard handler (which
   * reverts overlay mode → normal window), use it; otherwise just show.
   */
  private showDashboard(): void {
    if (this.onShowDashboard) {
      this.onShowDashboard()
      return
    }
    this.showWindow()
  }

  private showWindow(): void {
    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore()
      }
      this.mainWindow.show()
      this.mainWindow.focus()
    }
  }

  private refreshUsage(): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('refresh-usage')
    }
  }

  private quit(): void {
    // Mark quitting so the window's close handler doesn't intercept and hide to
    // tray, then quit the app (which fires before-quit → tray cleanup).
    ;(app as { isQuitting?: boolean }).isQuitting = true
    app.quit()
  }

  updateMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  destroy(): void {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
  }
}
