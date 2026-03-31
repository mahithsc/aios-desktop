import { useCallback, useEffect, useRef, useState, type DragEventHandler } from 'react'

type UseFileDropTargetOptions = {
  disabled?: boolean
  onFilesDropped: (files: File[]) => Promise<void> | void
}

type UseFileDropTargetResult = {
  isDragActive: boolean
  onDragEnter: DragEventHandler<HTMLElement>
  onDragLeave: DragEventHandler<HTMLElement>
  onDragOver: DragEventHandler<HTMLElement>
  onDrop: DragEventHandler<HTMLElement>
}

const hasFiles = (types: DataTransfer['types'] | undefined): boolean =>
  Array.from(types ?? []).includes('Files')

export const useFileDropTarget = ({
  disabled = false,
  onFilesDropped
}: UseFileDropTargetOptions): UseFileDropTargetResult => {
  const dragDepthRef = useRef(0)
  const [isDragActive, setIsDragActive] = useState(false)

  useEffect(() => {
    if (!disabled) {
      return
    }

    dragDepthRef.current = 0
    setIsDragActive(false)
  }, [disabled])

  const onDragEnter = useCallback<DragEventHandler<HTMLElement>>(
    (event) => {
      if (disabled || !hasFiles(event.dataTransfer?.types)) {
        return
      }

      event.preventDefault()
      dragDepthRef.current += 1
      setIsDragActive(true)
    },
    [disabled]
  )

  const onDragOver = useCallback<DragEventHandler<HTMLElement>>(
    (event) => {
      if (disabled || !hasFiles(event.dataTransfer?.types)) {
        return
      }

      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    },
    [disabled]
  )

  const onDragLeave = useCallback<DragEventHandler<HTMLElement>>(
    (event) => {
      if (disabled || !hasFiles(event.dataTransfer?.types)) {
        return
      }

      event.preventDefault()
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
      if (dragDepthRef.current === 0) {
        setIsDragActive(false)
      }
    },
    [disabled]
  )

  const onDrop = useCallback<DragEventHandler<HTMLElement>>(
    async (event) => {
      if (disabled || !hasFiles(event.dataTransfer?.types)) {
        return
      }

      event.preventDefault()
      dragDepthRef.current = 0
      setIsDragActive(false)

      const files = Array.from(event.dataTransfer.files ?? [])
      if (files.length === 0) {
        return
      }

      await onFilesDropped(files)
    },
    [disabled, onFilesDropped]
  )

  return {
    isDragActive,
    onDragEnter,
    onDragLeave,
    onDragOver,
    onDrop
  }
}
