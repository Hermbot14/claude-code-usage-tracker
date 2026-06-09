interface ElectronAPI {
  process: {
    platform: NodeJS.Platform
    versions: NodeJS.ProcessVersions
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      fetchUsage: (apiKey: string, baseUrl: string) => Promise<{
        success: boolean
        data?: any
        error?: string
        code?: string
      }>
      fetchAccountUsage: (account: any) => Promise<{
        success: boolean
        data?: any
        error?: string
        code?: string
      }>
      listProviders: () => Promise<any[]>
      discoverLocalAccounts: () => Promise<any[]>
      store: {
        get: (key: string, defaultValue?: any) => Promise<any>
        set: (key: string, value: any) => Promise<{ success: boolean }>
        delete: (key: string) => Promise<{ success: boolean }>
        clear: () => Promise<{ success: boolean }>
        getAll: () => Promise<any>
      }
      showNotification: (title: string, body: string) => Promise<{ success: boolean }>
      updateTray: (usage: any) => Promise<{ success: boolean }>
      minimizeToTray: () => Promise<{ success: boolean }>
      getAppVersion: () => Promise<string>
      setOverlayMode: (enabled: boolean) => Promise<{ success: boolean }>
      setClickThrough: (enabled: boolean) => Promise<{ success: boolean }>
      setOverlayPosition: (position: string) => Promise<{ success: boolean }>
      setOverlayOpacity: (opacity: number) => Promise<{ success: boolean; error?: string }>
      onRefreshUsage: (callback: () => void) => () => void
    }
  }
}

export {}
