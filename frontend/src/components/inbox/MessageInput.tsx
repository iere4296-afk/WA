'use client'

import { useState } from 'react'

interface MessageInputProps {
  onSend: (message: string) => Promise<void>
  disabled?: boolean
  placeholder?: string
}

export function MessageInput({ onSend, disabled = false, placeholder }: MessageInputProps) {
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend() {
    const trimmed = value.trim()
    if (!trimmed || sending || disabled) return

    setSending(true)
    try {
      await onSend(trimmed)
      setValue('')
    } catch {
      // Parent surfaces the error toast.
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="border-t bg-white p-4">
      <div className="flex items-end gap-2">
        <textarea
          className="min-h-[44px] max-h-32 flex-1 resize-none rounded-2xl border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder={placeholder || 'Type a message...'}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void handleSend()
            }
          }}
          disabled={disabled || sending}
          rows={1}
        />

        <button
          onClick={() => void handleSend()}
          disabled={!value.trim() || disabled || sending}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
