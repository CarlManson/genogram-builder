import { useEffect } from 'react'

interface Options {
  onClose?: () => void
  onEnter?: () => void
  // When true, the hook does nothing — useful while a child confirm dialog is
  // stacked on top so its Esc/Enter doesn't double-fire on the parent too.
  disabled?: boolean
}

// Document-level Esc / Enter handling for a modal. Esc calls onClose. Enter
// calls onEnter unless the focused element is a textarea or contenteditable
// (so multiline notes still accept newlines) or an IME composition is in
// progress.
export function useModalShortcuts({ onClose, onEnter, disabled }: Options) {
  useEffect(() => {
    if (disabled) return
    function handler(e: KeyboardEvent) {
      if (e.isComposing || e.keyCode === 229) return
      if (e.key === 'Escape' && onClose) {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'Enter' && onEnter) {
        const target = e.target as HTMLElement | null
        const tag = target?.tagName?.toLowerCase()
        // Skip when:
        //   • textarea / contenteditable — Enter inserts a newline
        //   • button / a — let the focused control fire its own click so the
        //     user can keyboard-activate Cancel/Delete/etc. without it being
        //     hijacked into a Save
        if (tag === 'textarea' || tag === 'button' || tag === 'a') return
        if (target?.isContentEditable) return
        e.preventDefault()
        e.stopPropagation()
        onEnter()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, onEnter, disabled])
}
