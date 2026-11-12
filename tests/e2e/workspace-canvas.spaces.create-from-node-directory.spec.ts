import { expect, test } from '@playwright/test'
import path from 'path'
import { pathToFileURL } from 'url'
import {
  clearAndSeedWorkspace,
  launchApp,
  seededWorkspaceId,
  testWorkspacePath,
} from './workspace-canvas.helpers'

async function readWorkspaceSnapshot(window: {
  evaluate: <T>(fn: () => T | Promise<T>) => Promise<T>
}) {
  return await window.evaluate(async () => {
    const raw = await window.opencoveApi.persistence.readWorkspaceStateRaw()
    if (!raw) {
      return null
    }

    return JSON.parse(raw) as {
      workspaces?: Array<{
        spaces?: Array<{
          id?: string
          name?: string
          directoryPath?: string
          targetMountId?: string | null
          nodeIds?: string[]
        }>
      }>
    }
  })
}

test.describe('Workspace Canvas - Create Space from Node Directory', () => {
  test('creates a top-level space bound to the right-clicked folder directory', async () => {
    const { electronApp, window } = await launchApp()

    try {
      const folderDirectory = path.join(testWorkspacePath, 'src')
      await clearAndSeedWorkspace(
        window,
        [
          {
            id: 'folder-node-src',
            title: 'src',
            kind: 'folder',
            position: { x: 360, y: 280 },
            width: 360,
            height: 260,
            task: {
              uri: pathToFileURL(folderDirectory).href,
              rootUri: pathToFileURL(testWorkspacePath).href,
              viewMode: 'icons',
              expandedDirectoryUris: [],
            },
          },
        ],
        { spaces: [], activeSpaceId: null },
      )

      const folderNode = window.locator('[data-testid="folder-node-folder-node-src"]')
      await expect(folderNode).toBeVisible()

      await folderNode.locator('.document-node__header').click({ button: 'right' })

      const createFromNode = window.locator(
        '[data-testid="workspace-selection-create-space-from-node"]',
      )
      await expect(createFromNode).toBeVisible()
      await expect(window.locator('[data-testid="workspace-selection-create-space"]')).toBeVisible()
      await createFromNode.click()

      await expect
        .poll(async () => {
          const snapshot = await readWorkspaceSnapshot(window)
          const spaces = snapshot?.workspaces?.[0]?.spaces ?? []
          const created = spaces.find(space => space.nodeIds?.includes('folder-node-src')) ?? null
          if (!created) {
            return null
          }

          const mountIds = await window.evaluate(async projectId => {
            const result = await window.opencoveApi.controlSurface.invoke<{
              mounts: Array<{ mountId: string; rootPath: string }>
            }>({
              kind: 'query',
              id: 'mount.list',
              payload: { projectId },
            })
            return result.mounts.map(mount => mount.mountId)
          }, seededWorkspaceId)

          return {
            directoryPath: created.directoryPath ?? null,
            nodeIds: created.nodeIds ?? [],
            targetMountIdKnown: mountIds.includes(created.targetMountId ?? ''),
          }
        })
        .toEqual({
          directoryPath: folderDirectory,
          nodeIds: ['folder-node-src'],
          targetMountIdKnown: true,
        })
    } finally {
      await electronApp.close()
    }
  })
})
