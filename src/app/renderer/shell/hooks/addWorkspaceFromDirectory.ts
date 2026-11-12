import type { WorkspaceDirectory } from '@shared/contracts/dto'
import type { WorkspaceState } from '@contexts/workspace/presentation/renderer/types'
import { DEFAULT_WORKSPACE_MINIMAP_VISIBLE } from '@contexts/workspace/presentation/renderer/types'
import { createDefaultWorkspaceViewport } from '@contexts/workspace/presentation/renderer/utils/workspaceSpaces'
import { useAppStore } from '../store/useAppStore'

export function addWorkspaceFromDirectory(directory: WorkspaceDirectory): void {
  const store = useAppStore.getState()
  const existing = store.workspaces.find(workspace => workspace.path === directory.path)
  if (existing) {
    store.setActiveWorkspaceId(existing.id)
    return
  }

  const nextWorkspace: WorkspaceState = {
    ...directory,
    nodes: [],
    worktreesRoot: '',
    viewport: createDefaultWorkspaceViewport(),
    isMinimapVisible: DEFAULT_WORKSPACE_MINIMAP_VISIBLE,
    spaces: [],
    activeSpaceId: null,
    spaceArchiveRecords: [],
  }

  store.setWorkspaces(prev => [...prev, nextWorkspace])
  store.setActiveWorkspaceId(nextWorkspace.id)
  store.setFocusRequest(null)
}
