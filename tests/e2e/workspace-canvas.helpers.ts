import { expect, type Locator, type Page } from '@playwright/test'
export {
  beginDragMouse,
  dragLocatorTo,
  dragMouse,
  clickHeaderDragSurface,
  dragHeaderDragSurfaceTo,
  readLocatorClientRect,
} from './workspace-canvas.gestures'
export { launchApp } from './workspace-canvas.app'
export {
  buildEchoSequenceCommand,
  buildNodeEvalCommand,
  buildPaddedNumberSequenceCommand,
  createTestUserDataDir,
  removePathWithRetry,
} from './workspace-canvas.testUtils'
export {
  readCanvasViewport,
  readWorkspaceViewState,
  selectCoveOption,
} from './workspace-canvas.viewState'
export {
  clearAndSeedWorkspace,
  seedWorkspaceState,
  storageKey,
  seededWorkspaceId,
  testWorkspacePath,
  viewStateStorageKey,
} from './workspace-canvas.seed'
export type {
  SeedAgentData,
  SeedDocumentNodeData,
  SeedFolderNodeData,
  SeedNode,
  SeedNoteData,
  SeedTaskData,
  SeedWebsiteData,
  SeedWorkspace,
} from './workspace-canvas.seed'

export async function clickCreateSpaceFromSelectionContextMenu(
  window: Page,
  trigger: Locator,
  options?: {
    triggerPosition?: { x: number; y: number }
    targetMountId?: string
    visibleTimeoutMs?: number
  },
): Promise<void> {
  const createSpaceAction = window.locator('[data-testid="workspace-selection-create-space"]')
  const pickerWindow = window.locator('[data-testid="workspace-space-target-mount-window"]')
  const pickerConfirm = window.locator('[data-testid="workspace-space-target-mount-confirm"]')

  await trigger.click({
    button: 'right',
    ...(options?.triggerPosition ? { position: options.triggerPosition } : {}),
  })
  await expect(createSpaceAction).toBeVisible({ timeout: options?.visibleTimeoutMs ?? 10_000 })
  await createSpaceAction.click()

  const pickerVisible = await pickerWindow
    .waitFor({ state: 'visible', timeout: 1_000 })
    .then(() => true)
    .catch(() => false)

  if (!pickerVisible) {
    return
  }

  if (options?.targetMountId) {
    await window
      .locator(`[data-testid="workspace-space-target-mount-${options.targetMountId}"]`)
      .check()
  }

  await expect(pickerConfirm).toBeEnabled()
  await pickerConfirm.click()
  await expect(pickerWindow).toHaveCount(0)
}
