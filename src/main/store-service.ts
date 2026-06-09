import { app } from 'electron'
import { readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const STORE_FILE_NAME = 'usage-tracker-store.json'

export class StoreService {
  private storePath: string
  private store: Record<string, unknown> = {}

  constructor() {
    this.storePath = join(app.getPath('userData'), STORE_FILE_NAME)
    // Load synchronously: createWindow() reads the store immediately on startup
    // (overlay mode, opacity, saved bounds), so it must be populated before then.
    this.load()
  }

  private load(): void {
    try {
      const data = readFileSync(this.storePath, 'utf-8')
      this.store = JSON.parse(data)
    } catch {
      // File doesn't exist yet, use defaults
      this.store = {}
    }
  }

  private async save(): Promise<void> {
    try {
      await writeFile(this.storePath, JSON.stringify(this.store, null, 2), 'utf-8')
    } catch (err) {
      console.error('Failed to save store:', err)
    }
  }

  get<T>(key: string, defaultValue: T): T {
    return (this.store[key] as T) ?? defaultValue
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.store[key] = value
    await this.save()
  }

  async delete(key: string): Promise<void> {
    delete this.store[key]
    await this.save()
  }

  async clear(): Promise<void> {
    this.store = {}
    await this.save()
  }

  getAll(): Record<string, unknown> {
    return { ...this.store }
  }

  getPath(): string {
    return this.storePath
  }
}
