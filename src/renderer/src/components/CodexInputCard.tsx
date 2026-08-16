import { useMemo, useState, type JSX } from 'react'
import type { CodexInputRequest } from 'src/shared/ws'
import { useCodexInputStore } from '../store/useCodexInputStore'

const CodexInputForm = ({
  request,
  chatId,
  darkMode
}: {
  request: CodexInputRequest
  chatId: string
  darkMode: boolean
}): JSX.Element => {
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const complete = useMemo(
    () =>
      Boolean(request.questions.length) &&
      request.questions.every((question) => answers[question.id]?.trim()),
    [answers, request]
  )

  const submit = (): void => {
    if (!complete) return
    window.api.sendSocketMessage({
      type: 'codex.input.submit',
      data: {
        jobId: request.jobId,
        chatId,
        answers: Object.fromEntries(
          request.questions.map((question) => [question.id, [answers[question.id]!.trim()]])
        )
      }
    })
  }

  const shell = darkMode
    ? 'border-white/15 bg-white/8 text-white/90'
    : 'border-stone-200 bg-white text-stone-800'
  const muted = darkMode ? 'text-white/55' : 'text-stone-500'
  const control = darkMode
    ? 'border-white/15 bg-black/20 text-white placeholder:text-white/35'
    : 'border-stone-200 bg-stone-50 text-stone-800 placeholder:text-stone-400'

  return (
    <div className={`w-full max-w-184 rounded-2xl border p-4 shadow-sm ${shell}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-500">
        Codex is waiting
      </div>
      <div className={`mt-1 text-sm ${muted}`}>Answer to let the coding task continue.</div>

      <div className="mt-4 space-y-5">
        {request.questions.map((question) => (
          <fieldset key={question.id} className="space-y-2">
            <legend className="text-sm font-medium">
              {question.header ? `${question.header}: ` : ''}
              {question.question}
            </legend>
            {question.options?.length ? (
              <div className="space-y-2">
                {question.options.map((option) => (
                  <label
                    key={option.label}
                    className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 ${control}`}
                  >
                    <input
                      type="radio"
                      name={`${request.jobId}-${question.id}`}
                      checked={answers[question.id] === option.label}
                      onChange={() =>
                        setAnswers((state) => ({ ...state, [question.id]: option.label }))
                      }
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block text-sm font-medium">{option.label}</span>
                      {option.description ? (
                        <span className={`block text-xs ${muted}`}>{option.description}</span>
                      ) : null}
                    </span>
                  </label>
                ))}
                {question.isOther ? (
                  <input
                    type={question.isSecret ? 'password' : 'text'}
                    value={
                      question.options.some((option) => option.label === answers[question.id])
                        ? ''
                        : (answers[question.id] ?? '')
                    }
                    onChange={(event) =>
                      setAnswers((state) => ({ ...state, [question.id]: event.target.value }))
                    }
                    placeholder="Other answer"
                    className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400/40 ${control}`}
                  />
                ) : null}
              </div>
            ) : (
              <input
                type={question.isSecret ? 'password' : 'text'}
                value={answers[question.id] ?? ''}
                onChange={(event) =>
                  setAnswers((state) => ({ ...state, [question.id]: event.target.value }))
                }
                className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400/40 ${control}`}
              />
            )}
          </fieldset>
        ))}
      </div>

      {request.error ? <div className="mt-3 text-sm text-red-500">{request.error}</div> : null}
      <button
        type="button"
        disabled={!complete}
        onClick={submit}
        className="mt-4 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Continue Codex
      </button>
    </div>
  )
}

const CodexInputCard = ({
  chatId,
  darkMode
}: {
  chatId: string
  darkMode: boolean
}): JSX.Element | null => {
  const requests = useCodexInputStore((state) => state.requestsByChatId[chatId])

  if (!requests) return null
  return (
    <>
      {Object.values(requests).map((request) => (
        <CodexInputForm key={request.jobId} request={request} chatId={chatId} darkMode={darkMode} />
      ))}
    </>
  )
}

export default CodexInputCard
