import type { TerminalClipboardSnapshot } from '@shared/contracts/dto'
import {
  isLinuxTerminalPasteShortcut,
  isMacTerminalPasteShortcut,
  isWindowsTerminalPasteShortcut,
  pasteTextFromClipboard,
  readTextFromClipboard,
} from './inputBridge'

export function resolveTerminalImagePasteSequence(
  provider: string | null,
  platform: string,
): string {
  // Pi and Kimi bind Alt+V on Windows; older Kimi used Ctrl+V (0x16).
  return platform === 'win32' &&
    (provider === 'pi' || provider === 'kimi' || provider === 'claude-code')
    ? '\u001bv'
    : '\u0016'
}

// kimi on Windows only triggers its clipboard-image paste from genuine Win32
// console input records (classic conhost / Windows Terminal). Under ConPTY —
// every xterm.js-based terminal — the VT-translated Alt+V event reaches the
// process but kimi does not react to it (verified against kimi 0.15.0). For
// these providers, paste the clipboard image as a temp file path instead;
// the agent reads the image file itself when the message is submitted.
const WINDOWS_IMAGE_PATH_PASTE_PROVIDERS = ['kimi']

function shouldPasteImageAsFilePath(
  provider: string | null,
  platform: string,
  clipboard: TerminalClipboardSnapshot,
): clipboard is TerminalClipboardSnapshot & { imageFilePath: string } {
  return (
    platform === 'win32' &&
    provider !== null &&
    WINDOWS_IMAGE_PATH_PASTE_PROVIDERS.includes(provider) &&
    typeof clipboard.imageFilePath === 'string' &&
    clipboard.imageFilePath.length > 0
  )
}

export function createTerminalClipboardHandler(options: {
  provider: string | null
  getProvider?: () => string | null
  platform: string
  readClipboard?: () => Promise<TerminalClipboardSnapshot>
  write: (data: string) => void
  isBracketedPasteMode: () => boolean
  isDisposed: () => boolean
}): (event: KeyboardEvent) => boolean {
  let pending = Promise.resolve()
  const platformInfo = { platform: options.platform === 'darwin' ? 'MacIntel' : options.platform }
  const readClipboard =
    options.readClipboard ??
    (async () => {
      const clipboard = window.opencoveApi?.clipboard
      return typeof clipboard?.readTerminalPaste === 'function'
        ? await clipboard.readTerminalPaste()
        : { text: await readTextFromClipboard(), hasImage: false, imageFilePath: null }
    })

  return event => {
    if (event.type !== 'keydown') {
      return false
    }
    const provider = options.getProvider ? options.getProvider() : options.provider
    const isNativeAlias =
      options.platform === 'win32' &&
      provider !== null &&
      ['pi', 'kimi', 'codex', 'claude-code'].includes(provider) &&
      event.key.toLowerCase() === 'v' &&
      event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey
    if (
      !isNativeAlias &&
      !isWindowsTerminalPasteShortcut(event, platformInfo) &&
      !isMacTerminalPasteShortcut(event, platformInfo) &&
      !isLinuxTerminalPasteShortcut(event, platformInfo)
    ) {
      return false
    }

    event.preventDefault()
    event.stopPropagation()
    if (
      isNativeAlias &&
      (provider === null || !WINDOWS_IMAGE_PATH_PASTE_PROVIDERS.includes(provider))
    ) {
      if (!options.isDisposed()) {
        options.write(resolveTerminalImagePasteSequence(provider, options.platform))
      }
      return true
    }
    // Start reading at the gesture; serialize only delivery so repeated pastes keep order.
    const snapshot = Promise.resolve()
      .then(readClipboard)
      .catch(() => null)
    pending = pending
      .then(async () => {
        const clipboard = await snapshot
        if (!clipboard || options.isDisposed()) {
          return
        }
        if (options.getProvider && options.getProvider() !== provider) {
          return
        }
        if (shouldPasteImageAsFilePath(provider, options.platform, clipboard)) {
          await pasteTextFromClipboard({
            readClipboardText: () => clipboard.imageFilePath,
            writePastePayload: data => {
              if (!options.isDisposed()) {
                options.write(data)
              }
            },
            isBracketedPasteMode: options.isBracketedPasteMode,
          })
          return
        }
        if (clipboard.hasImage) {
          options.write(resolveTerminalImagePasteSequence(provider, options.platform))
          return
        }
        await pasteTextFromClipboard({
          readClipboardText: () => clipboard.text,
          writePastePayload: data => {
            if (!options.isDisposed()) {
              options.write(data)
            }
          },
          isBracketedPasteMode: options.isBracketedPasteMode,
        })
      })
      .catch(() => undefined)
    return true
  }
}
