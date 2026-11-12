import type { Node } from '@xyflow/react'
import { fromFileUri } from '@contexts/filesystem/domain/fileUri'
import type { MountDto } from '@shared/contracts/dto'
import type { TerminalNodeData } from '../../types'
import { normalizeComparablePath } from './view/WorkspaceSpaceRegionsOverlay.helpers'

function parentDirectoryOf(path: string): string | null {
  const trimmed = path.replace(/[/\\]+$/, '')
  if (trimmed.length === 0) {
    return null
  }
  const lastSeparator = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  if (lastSeparator <= 0) {
    return null
  }
  return trimmed.slice(0, lastSeparator)
}

export function resolveSpaceDirectoryFromNode(node: Node<TerminalNodeData>): string | null {
  if (node.data.kind === 'folder') {
    return fromFileUri(node.data.folder?.uri ?? '')
  }
  if (node.data.kind === 'document') {
    const entryPath = fromFileUri(node.data.document?.uri ?? '')
    if (!entryPath) {
      return null
    }
    return parentDirectoryOf(entryPath)
  }
  return null
}

export function pickMountForDirectory(
  mounts: MountDto[],
  directoryPath: string,
  platform?: string,
): MountDto | null {
  const target = normalizeComparablePath(directoryPath, platform)
  if (target.length === 0) {
    return null
  }

  let best: MountDto | null = null
  let bestRootLength = -1
  for (const mount of mounts) {
    const root = normalizeComparablePath(mount.rootPath, platform)
    if (root.length === 0) {
      continue
    }
    if (target !== root && !target.startsWith(`${root}/`)) {
      continue
    }
    if (root.length > bestRootLength) {
      best = mount
      bestRootLength = root.length
    }
  }
  return best
}
