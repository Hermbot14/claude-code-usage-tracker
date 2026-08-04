import { app, safeStorage } from 'electron'
import { readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const STORE_FILE_NAME = 'usage-tracker-store.json'
const SECRETS_FILE_NAME = 'usage-tracker-secrets.enc.json'

export class StoreService {
  private storePath: string
  private store: Record<string, unknown> = {}
  private secretsPath: string
  private secrets: Record<string, string> = {}

  constructor() {
    this.storePath = join(app.getPath('userData'), STORE_FILE_NAME)
    this.secretsPath = join(app.getPath('userData'), SECRETS_FILE_NAME)
    this.load()
    this.loadSecrets()
  }

  private load(): void {
    try {
      const data = readFileSync(this.storePath, 'utf-8')
      this.store = JSON.parse(data)
    } catch {
      this.store = {}
    }
  }

  private loadSecrets(): void {
    try {
      const data = readFileSync(this.secretsPath, 'utf-8')
      this.secrets = JSON.parse(data)
    } catch {
      this.secrets = {}
    }
  }

  private async save(): Promise<void> {
    try {
      await writeFile(this.storePath, JSON.stringify(this.store, null, 2), 'utf-8')
    } catch (err) {
      console.error('Failed to save store:', err)
      throw err
    }
  }

  private async saveSecrets(): Promise<void> {
    try {
      await writeFile(this.secretsPath, JSON.stringify(this.secrets, null, 2), 'utf-8')
    } catch (err) {
      console.error('Failed to save secrets:', err)
      throw err
    }
  }

  get<T>(key: string, defaultValue: T): T
  get<T>(key: string): T | undefined
  get<T>(key: string, defaultValue?: T): T | undefined {
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

  // Encrypted secret storage via Electron safeStorage (OS credential store).
  // Falls back to plain base64 on platforms where encryption is unavailable
  // (logs a warning so the operator is aware).

  async setSecret(key: string, value: string): Promise<void> {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(value)
      this.secrets[key] = encrypted.toString('base64')
    } else {
      console.warn('[store] safeStorage unavailable — storing secret without OS encryption')
      this.secrets[key] = Buffer.from(value, 'utf-8').toString('base64')
    }
    await this.saveSecrets()
  }

  getSecret(key: string): string | null {
    const stored = this.secrets[key]
    if (!stored) return null
    try {
      const buf = Buffer.from(stored, 'base64')
      if (safeStorage.isEncryptionAvailable()) {
        return safeStorage.decryptString(buf)
      }
      return buf.toString('utf-8')
    } catch (err) {
      console.error('[store] Failed to decrypt secret:', err)
      return null
    }
  }

  async deleteSecret(key: string): Promise<void> {
    delete this.secrets[key]
    await this.saveSecrets()
  }
}
