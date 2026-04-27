import { useEffect, useState } from 'react'

// Returns true when viewport is narrower than the given breakpoint (640px = sm).
// Used to (a) show a "this tool is built for desktop" notice in the welcome
// modal, and (b) hide non-essential toolbar items so the chrome doesn't wrap
// awkwardly. Not a touch detector — purely viewport width.
export function useIsMobile(breakpoint = 640): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.innerWidth < breakpoint
  )
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])
  return isMobile
}
