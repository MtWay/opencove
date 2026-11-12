import { useCallback, useEffect, useRef, useState } from 'react'
import { addWorkspaceFromDirectory } from './addWorkspaceFromDirectory'

interface UseProjectFolderDropImportOptions {
  enabled: boolean
  importFailedMessage: string
  onShowMessage: (message: string) => void
}

function dragLikelyContainsFiles(transfer: DataTransfer | null): boolean {
  if (!transfer) {
    return false
  }

  // Chromium's mid-drag metadata is unreliable across contexts: `items` are restricted (empty in
  // packaged file:// builds) and `types` does not always surface 'Files'. This matters because
  // Chromium only fires the `drop` event when `dragover` first called preventDefault() — a false
  // negative here silently kills BOTH the drop-zone highlight and the drop itself (the reported
  // "no reaction, no highlight" bug). We therefore accept the drag whenever the metadata is empty
  // (unknown -> assume an external file drag) and only reject drags that positively identify as
  // non-file payloads (e.g. internal text/HTML drags, which populate `types`).
  const types = Array.from(transfer.types ?? [])
  if (types.length === 0) {
    return true
  }
  if (types.includes('Files')) {
    return true
  }

  return Array.from(transfer.items ?? []).some(item => item.kind === 'file')
}

export function useProjectFolderDropImport({
  enabled,
  importFailedMessage,
  onShowMessage,
}: UseProjectFolderDropImportOptions): { isDropActive: boolean } {
  const [isDropActive, setIsDropActive] = useState(false)
  const dragDepthRef = useRef(0)
  const onShowMessageRef = useRef(onShowMessage)
  const importFailedMessageRef = useRef(importFailedMessage)

  useEffect(() => {
    onShowMessageRef.current = onShowMessage
  }, [onShowMessage])

  useEffect(() => {
    importFailedMessageRef.current = importFailedMessage
  }, [importFailedMessage])

  const importDroppedFolders = useCallback(async (files: File[]): Promise<void> => {
    const getPathForFile = window.opencoveApi?.filesystem?.getPathForFile
    const importDirectory = window.opencoveApi?.workspace?.importDirectory
    if (typeof getPathForFile !== 'function' || typeof importDirectory !== 'function') {
      return
    }

    if (files.length === 0) {
      return
    }

    const paths = files
      .map(file => getPathForFile(file))
      .filter((path): path is string => typeof path === 'string' && path.length > 0)

    const results = await Promise.allSettled(paths.map(path => importDirectory({ path })))

    let importedCount = 0
    let failedCount = 0

    for (const result of results) {
      if (result.status === 'fulfilled') {
        addWorkspaceFromDirectory(result.value)
        importedCount += 1
      } else {
        failedCount += 1
      }
    }

    if (importedCount === 0 && failedCount > 0) {
      onShowMessageRef.current(importFailedMessageRef.current)
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setIsDropActive(false)
      dragDepthRef.current = 0
      return
    }

    const handleDragEnter = (event: DragEvent): void => {
      if (!dragLikelyContainsFiles(event.dataTransfer)) {
        return
      }
      // preventDefault() on dragenter/dragover is what makes Chromium accept the drop and show a
      // "copy" cursor instead of the forbidden icon; it must run regardless of highlight state.
      event.preventDefault()
      dragDepthRef.current += 1
      setIsDropActive(true)
    }

    const handleDragOver = (event: DragEvent): void => {
      if (!dragLikelyContainsFiles(event.dataTransfer)) {
        return
      }
      event.preventDefault()
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy'
      }
    }

    const handleDragLeave = (event: DragEvent): void => {
      if (!dragLikelyContainsFiles(event.dataTransfer)) {
        return
      }
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
      if (dragDepthRef.current === 0) {
        setIsDropActive(false)
      }
    }

    const handleDrop = (event: DragEvent): void => {
      const files = Array.from(event.dataTransfer?.files ?? [])
      dragDepthRef.current = 0
      setIsDropActive(false)
      if (files.length === 0) {
        return
      }
      event.preventDefault()
      void importDroppedFolders(files)
    }

    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('drop', handleDrop)

    return () => {
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('drop', handleDrop)
    }
  }, [enabled, importDroppedFolders])

  return { isDropActive }
}
