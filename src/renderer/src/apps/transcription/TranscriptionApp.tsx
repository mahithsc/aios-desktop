import type { JSX } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

type RecordingStatus =
  | 'idle'
  | 'starting'
  | 'recording'
  | 'stopping'
  | 'transcribing'
  | 'saved'
  | 'error'

const getSupportedRecordingMimeType = (): string | undefined => {
  const preferredMimeTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg'
  ]

  return preferredMimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType))
}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Microphone recording failed.'

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds)
  })

const getStatusLabel = (status: RecordingStatus): string => {
  if (status === 'transcribing') {
    return 'Transcribing'
  }

  if (status === 'error') {
    return 'Error'
  }

  return 'Listening'
}

const getStatusTone = (status: RecordingStatus): 'listening' | 'transcribing' | 'error' => {
  if (status === 'transcribing') {
    return 'transcribing'
  }

  if (status === 'error') {
    return 'error'
  }

  return 'listening'
}

const shimmerStatusLabelClassName =
  'animate-transcription-shimmer bg-[linear-gradient(100deg,rgba(255,255,255,0.54)_0%,rgba(255,255,255,0.96)_48%,rgba(255,255,255,0.54)_100%)] bg-[length:210%_100%] bg-clip-text text-transparent motion-reduce:animate-none'

const stopStream = (stream: MediaStream | null): void => {
  stream?.getTracks().forEach((track) => {
    track.stop()
  })
}

const TranscriptionApp = (): JSX.Element => {
  const [status, setStatus] = useState<RecordingStatus>('idle')
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const isStartingRef = useRef(false)
  const pendingStopRef = useRef(false)

  const reportRecordingError = useCallback((message: string): void => {
    setStatus('error')
    window.api.reportTranscriptionRecordingError({ message })
  }, [])

  const resetRecordingRefs = useCallback((): void => {
    stopStream(mediaStreamRef.current)
    mediaStreamRef.current = null
    mediaRecorderRef.current = null
    chunksRef.current = []
    isStartingRef.current = false
    pendingStopRef.current = false
  }, [])

  const finishRecording = useCallback(
    async (recorder: MediaRecorder, stream: MediaStream, startedAt: number): Promise<void> => {
      const endedAt = Date.now()
      const mimeType = recorder.mimeType || chunksRef.current[0]?.type || 'audio/webm'
      const recordingBlob = new Blob(chunksRef.current, { type: mimeType })

      try {
        setStatus('transcribing')
        const bytes = await recordingBlob.arrayBuffer()
        const savedRecording = await window.api.completeTranscriptionRecording({
          startedAt,
          endedAt,
          mimeType,
          bytes
        })

        window.api.logToConsole('info', 'Transcription recording saved.', savedRecording)
        setStatus('saved')
        await wait(220)
        window.api.hideTranscriptionWindow()
      } catch (error) {
        reportRecordingError(getErrorMessage(error))
      } finally {
        stopStream(stream)
        resetRecordingRefs()
      }
    },
    [reportRecordingError, resetRecordingRefs]
  )

  const stopRecording = useCallback((): void => {
    const mediaRecorder = mediaRecorderRef.current

    if (!mediaRecorder) {
      if (isStartingRef.current) {
        pendingStopRef.current = true
        setStatus('stopping')
      }

      return
    }

    if (mediaRecorder.state === 'inactive') {
      return
    }

    pendingStopRef.current = false
    setStatus('stopping')
    mediaRecorder.stop()
  }, [])

  const startRecording = useCallback(async (): Promise<void> => {
    if (isStartingRef.current || mediaRecorderRef.current?.state === 'recording') {
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      reportRecordingError('Microphone recording is not available in this renderer.')
      return
    }

    isStartingRef.current = true
    pendingStopRef.current = false
    chunksRef.current = []
    setStatus('starting')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = getSupportedRecordingMimeType()
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      const startedAt = Date.now()

      mediaStreamRef.current = stream
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onerror = () => {
        reportRecordingError('MediaRecorder reported an audio recording error.')
      }

      mediaRecorder.onstop = () => {
        void finishRecording(mediaRecorder, stream, startedAt)
      }

      mediaRecorder.start()
      isStartingRef.current = false
      setStatus('recording')

      if (pendingStopRef.current) {
        stopRecording()
      }
    } catch (error) {
      reportRecordingError(getErrorMessage(error))
      resetRecordingRefs()
    }
  }, [finishRecording, reportRecordingError, resetRecordingRefs, stopRecording])

  useEffect(() => {
    const unsubscribeStart = window.api.onTranscriptionStartRecording(() => {
      void startRecording()
    })
    const unsubscribeStop = window.api.onTranscriptionStopRecording(stopRecording)

    return () => {
      unsubscribeStart()
      unsubscribeStop()
      resetRecordingRefs()
    }
  }, [resetRecordingRefs, startRecording, stopRecording])

  useEffect(() => {
    const resetHiddenTranscriptionState = (): void => {
      if (document.visibilityState !== 'hidden') {
        return
      }

      setStatus('idle')
      resetRecordingRefs()
    }

    document.addEventListener('visibilitychange', resetHiddenTranscriptionState)

    return () => {
      document.removeEventListener('visibilitychange', resetHiddenTranscriptionState)
    }
  }, [resetRecordingRefs])

  const isVisible = status !== 'idle' && status !== 'saved'
  const statusLabel = getStatusLabel(status)
  const statusTone = getStatusTone(status)

  return (
    <main className="flex h-screen w-screen items-start justify-center overflow-hidden bg-transparent">
      <motion.section
        initial={false}
        animate={{
          height: isVisible ? 62 : 0,
          opacity: isVisible ? 1 : 0,
          y: isVisible ? 0 : -10
        }}
        transition={{
          type: 'spring',
          stiffness: 430,
          damping: 34,
          mass: 0.9
        }}
        className="flex w-[188px] origin-top items-end justify-center overflow-hidden rounded-b-[14px] border-x border-b border-white/8 bg-black/92 px-4 pb-3 shadow-[0_18px_34px_rgba(0,0,0,0.42)] backdrop-blur-xl"
      >
        <AnimatePresence mode="wait">
          {isVisible && (
            <motion.div
              key={statusTone}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className="flex min-w-0 items-center gap-2 text-[12px] font-medium leading-none tracking-normal text-white/88"
            >
              <span className={statusTone !== 'error' ? shimmerStatusLabelClassName : undefined}>
                {statusLabel}
              </span>
              {statusTone === 'transcribing' && (
                <span
                  className="h-2.5 w-2.5 flex-none animate-spin rounded-full border-[1.5px] border-white/25 border-t-white/90 motion-reduce:animate-none"
                  aria-hidden="true"
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </main>
  )
}

export default TranscriptionApp
