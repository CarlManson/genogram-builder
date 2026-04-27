import { createContext, useContext } from 'react'

// When set, identifies the node currently in "move mode" — clicked twice while
// selected so its next drag will slide just that person horizontally instead
// of moving the whole family group. PersonNode reads this to render its own
// in-shape visual indicator (accent dashed outline + ↔ badge).
export const MoveModeContext = createContext<{ moveModeId: string | null }>({ moveModeId: null })
export const useMoveMode = () => useContext(MoveModeContext)
