import { describe, expect, it } from 'vitest'
import type { Node } from '@xyflow/react'
import {
  pickMountForDirectory,
  resolveSpaceDirectoryFromNode,
} from '@contexts/workspace/presentation/renderer/components/workspaceCanvas/spaceDirectoryFromNode'
import { EMPTY_NODE_KIND_DATA } from '@contexts/workspace/presentation/renderer/components/workspaceCanvas/hooks/useNodesStore.nodeData'
import type { TerminalNodeData } from '@contexts/workspace/presentation/renderer/types'
import type { MountDto } from '@shared/contracts/dto'

function nodeData(overrides: Partial<TerminalNodeData>): TerminalNodeData {
  return {
    ...EMPTY_NODE_KIND_DATA,
    kind: 'terminal',
    sessionId: '',
    title: 'node',
    width: 480,
    height: 400,
    status: null,
    startedAt: null,
    endedAt: null,
    exitCode: null,
    lastError: null,
    scrollback: null,
    ...overrides,
  }
}

function asNode(data: TerminalNodeData): Node<TerminalNodeData> {
  return { id: 'node-1', position: { x: 0, y: 0 }, data }
}

function mount(mountId: string, rootPath: string): MountDto {
  return {
    mountId,
    projectId: 'project-1',
    name: mountId,
    sortOrder: 0,
    endpointId: 'local',
    targetId: 'target',
    rootPath,
    rootUri: '',
  }
}

describe('resolveSpaceDirectoryFromNode', () => {
  it('resolves a folder node to its own directory', () => {
    const node = asNode(
      nodeData({
        kind: 'folder',
        folder: {
          uri: 'file:///C:/repo/packages/app',
          rootUri: 'file:///C:/repo',
          viewMode: 'icons',
          expandedDirectoryUris: [],
        },
      }),
    )
    expect(resolveSpaceDirectoryFromNode(node)).toBe('C:\\repo\\packages\\app')
  })

  it('resolves a document node to its parent directory', () => {
    const node = asNode(
      nodeData({
        kind: 'document',
        document: { uri: 'file:///C:/repo/packages/app/src/index.ts' },
      }),
    )
    expect(resolveSpaceDirectoryFromNode(node)).toBe('C:\\repo\\packages\\app\\src')
  })

  it('returns null for non-filesystem nodes', () => {
    expect(resolveSpaceDirectoryFromNode(asNode(nodeData({ kind: 'terminal' })))).toBeNull()
    expect(resolveSpaceDirectoryFromNode(asNode(nodeData({ kind: 'note' })))).toBeNull()
  })

  it('returns null when the uri is missing or not a file uri', () => {
    expect(
      resolveSpaceDirectoryFromNode(
        asNode(
          nodeData({
            kind: 'folder',
            folder: { uri: '', rootUri: '', viewMode: 'icons', expandedDirectoryUris: [] },
          }),
        ),
      ),
    ).toBeNull()
    expect(
      resolveSpaceDirectoryFromNode(
        asNode(nodeData({ kind: 'document', document: { uri: 'https://example.com/a.ts' } })),
      ),
    ).toBeNull()
  })

  it('resolves posix paths for posix uris', () => {
    const node = asNode(
      nodeData({
        kind: 'folder',
        folder: {
          uri: 'file:///home/user/repo/docs',
          rootUri: 'file:///home/user/repo',
          viewMode: 'icons',
          expandedDirectoryUris: [],
        },
      }),
    )
    expect(resolveSpaceDirectoryFromNode(node)).toBe('/home/user/repo/docs')
  })
})

describe('pickMountForDirectory', () => {
  const mounts = [
    mount('workspace', 'C:\\work1\\opencove'),
    mount('packages', 'C:\\work1\\opencove\\packages'),
  ]

  it('prefers the most specific containing mount', () => {
    const picked = pickMountForDirectory(mounts, 'C:\\work1\\opencove\\packages\\app', 'win32')
    expect(picked?.mountId).toBe('packages')
  })

  it('falls back to a shallower mount when only it contains the directory', () => {
    const picked = pickMountForDirectory(mounts, 'C:\\work1\\opencove\\src\\main', 'win32')
    expect(picked?.mountId).toBe('workspace')
  })

  it('matches the mount root itself', () => {
    const picked = pickMountForDirectory(mounts, 'C:/work1/opencove/packages', 'win32')
    expect(picked?.mountId).toBe('packages')
  })

  it('is case-insensitive on win32', () => {
    const picked = pickMountForDirectory(mounts, 'c:\\WORK1\\OpenCove\\packages\\app', 'win32')
    expect(picked?.mountId).toBe('packages')
  })

  it('is case-sensitive on posix platforms', () => {
    const posixMounts = [mount('repo', '/home/user/repo')]
    expect(pickMountForDirectory(posixMounts, '/home/user/Repo/docs', 'darwin')).toBeNull()
    expect(pickMountForDirectory(posixMounts, '/home/user/repo/docs', 'darwin')?.mountId).toBe(
      'repo',
    )
  })

  it('returns null when no mount contains the directory', () => {
    expect(pickMountForDirectory(mounts, 'D:\\elsewhere\\project', 'win32')).toBeNull()
    expect(pickMountForDirectory(mounts, '', 'win32')).toBeNull()
  })

  it('does not treat a similarly-prefixed sibling directory as contained', () => {
    const tricky = [mount('app', '/repo/app')]
    expect(pickMountForDirectory(tricky, '/repo/application/src', 'linux')).toBeNull()
  })
})
