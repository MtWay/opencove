import { beforeEach, describe, expect, it, vi } from 'vitest'

const { handlers, clipboard, removeHandler, writeFileSync, readdirSync } = vi.hoisted(() => ({
  handlers: new Map<string, () => unknown>(),
  clipboard: { readText: vi.fn(), readImage: vi.fn(), writeText: vi.fn() },
  removeHandler: vi.fn(),
  writeFileSync: vi.fn(),
  readdirSync: vi.fn(() => [] as string[]),
}))

vi.mock('electron', () => ({
  clipboard,
  ipcMain: { removeHandler },
  app: { getPath: () => 'C:\\Temp' },
}))
vi.mock('node:fs', () => ({
  writeFileSync,
  readdirSync,
  statSync: vi.fn(),
  unlinkSync: vi.fn(),
  default: { writeFileSync, readdirSync },
}))
vi.mock('../../../src/app/main/ipc/handle', () => ({
  registerHandledIpc: (channel: string, handler: () => unknown) => handlers.set(channel, handler),
}))

import { registerClipboardIpcHandlers } from '../../../src/contexts/clipboard/presentation/main-ipc/register'

describe('terminal clipboard snapshot', () => {
  beforeEach(() => {
    handlers.clear()
    vi.clearAllMocks()
  })

  it.each([true, false])('reports native image presence %s alongside text', async hasImage => {
    clipboard.readText.mockReturnValue('clipboard text')
    clipboard.readImage.mockReturnValue({
      isEmpty: () => !hasImage,
      toPNG: () => Buffer.from('png-bytes'),
    })
    const registration = registerClipboardIpcHandlers()
    const handler = handlers.get('clipboard:read-terminal-paste')
    expect(handler).toBeDefined()
    const result = await handler?.()
    if (hasImage) {
      expect(result).toEqual({
        text: 'clipboard text',
        hasImage: true,
        imageFilePath: expect.stringMatching(/^C:\\Temp\\opencove-image-paste-\d+\.png$/),
      })
      expect(writeFileSync).toHaveBeenCalledTimes(1)
    } else {
      expect(result).toEqual({ text: 'clipboard text', hasImage: false, imageFilePath: null })
      expect(writeFileSync).not.toHaveBeenCalled()
    }
    registration.dispose()
    expect(removeHandler).toHaveBeenCalledWith('clipboard:read-terminal-paste')
  })
})
