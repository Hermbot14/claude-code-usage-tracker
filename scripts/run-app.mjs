import { spawn } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Apply the patch first
async function patchFile(filePath, electronExports) {
  let content = await readFile(filePath, 'utf-8')

  // Keep the original `electron` binding intact and ADD destructured names.
  // Replacing (rather than augmenting) it broke any `electron.X` member not in
  // the hardcoded list — e.g. `electron.nativeImage` in TrayManager — which threw
  // "electron is not defined" and aborted startup before IPC handlers registered.
  content = content.replace(
    /const electron = require\("electron"\);/g,
    `const electron = require("electron"); const { ${electronExports.join(', ')} } = electron;`
  )

  for (const exp of electronExports) {
    const regex = new RegExp(`electron\\.${exp}`, 'g')
    content = content.replace(regex, exp)
  }

  await writeFile(filePath, content, 'utf-8')
}

console.log('Patching Electron imports...')
await patchFile(
  join(__dirname, '../out/main/index.cjs'),
  ['app', 'BrowserWindow', 'shell', 'ipcMain', 'nativeTheme', 'Tray', 'Menu', 'MenuItem']
)
await patchFile(
  join(__dirname, '../out/preload/index.cjs'),
  ['ipcRenderer', 'contextBridge']
)
console.log('✓ Patched\n')

// Run electron with verbose output
console.log('Starting Electron app...\n')
const electronPath = join(__dirname, '../node_modules/electron/dist/electron.exe')
const electron = spawn(electronPath, [join(__dirname, '../out/main/index.cjs')], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1', ELECTRON_ENABLE_STACK_DUMPING: '1' }
})

electron.on('error', (err) => {
  console.error('Failed to start electron:', err)
})

electron.on('exit', (code) => {
  console.log(`\nElectron exited with code ${code}`)
})
