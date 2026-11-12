import { app, clipboard, ipcMain } from 'electron'
import { readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { IPC_CHANNELS } from '../../../../shared/contracts/ipc'
import type {
  TerminalClipboardSnapshot,
  WriteClipboardTextInput,
} from '../../../../shared/contracts/dto'
import type { IpcRegistrationDisposable } from '../../../../app/main/ipc/types'
import { registerHandledIpc } from '../../../../app/main/ipc/handle'
import { normalizeWriteClipboardTextPayload } from './validate'

const IMAGE_PASTE_FILE_PREFIX = 'opencove-image-paste-'
const IMAGE_PASTE_FILE_MAX_AGE_MS = 24 * 60 * 60 * 1000

// Best-effort: temp paste images are single-use scratch files; drop the ones
// older than a day so frequent pastes do not pile up in %TEMP%.
function pruneClipboardImageTempFiles(tempDir: string): void {
  try {
    const cutoff = Date.now() - IMAGE_PASTE_FILE_MAX_AGE_MS
    for (const name of readdirSync(tempDir)) {
      if (!name.startsWith(IMAGE_PASTE_FILE_PREFIX) || !name.endsWith('.png')) {
        continue
      }
      const filePath = join(tempDir, name)
      if (statSync(filePath).mtimeMs < cutoff) {
        unlinkSync(filePath)
      }
    }
  } catch {
    // Pruning must never break paste.
  }
}

function writeClipboardImageToTempFile(image: Electron.NativeImage): string | null {
  try {
    const tempDir = app.getPath('temp')
    pruneClipboardImageTempFiles(tempDir)
    const filePath = join(tempDir, `${IMAGE_PASTE_FILE_PREFIX}${Date.now()}.png`)
    writeFileSync(filePath, image.toPNG())
    return filePath
  } catch {
    return null
  }
}

export function registerClipboardIpcHandlers(): IpcRegistrationDisposable {
  registerHandledIpc(
    IPC_CHANNELS.clipboardReadTerminalPaste,
    async (): Promise<TerminalClipboardSnapshot> => {
      const image = clipboard.readImage()
      const hasImage = !image.isEmpty()
      return {
        text: clipboard.readText(),
        hasImage,
        imageFilePath: hasImage ? writeClipboardImageToTempFile(image) : null,
      }
    },
    { defaultErrorCode: 'common.unexpected' },
  )
  registerHandledIpc(
    IPC_CHANNELS.clipboardReadText,
    async (): Promise<string> => clipboard.readText(),
    { defaultErrorCode: 'common.unexpected' },
  )

  registerHandledIpc(
    IPC_CHANNELS.clipboardWriteText,
    async (_event, payload: WriteClipboardTextInput): Promise<void> => {
      const normalized = normalizeWriteClipboardTextPayload(payload)
      clipboard.writeText(normalized.text)
    },
    { defaultErrorCode: 'common.unexpected' },
  )

  return {
    dispose: () => {
      ipcMain.removeHandler(IPC_CHANNELS.clipboardReadTerminalPaste)
      ipcMain.removeHandler(IPC_CHANNELS.clipboardReadText)
      ipcMain.removeHandler(IPC_CHANNELS.clipboardWriteText)
    },
  }
}
