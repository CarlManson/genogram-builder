// Google Analytics (GA4). Hostname-gated so tracking only fires on the live
// production site — local dev, forks, clones, and the carlmanson.github.io
// default URL all stay clean. Same property/stream as the rest of carlmanson.au;
// filter by `hostname` in GA4 to slice this subdomain's traffic.

const GA_MEASUREMENT_ID = 'G-4D64BX6X5R'
const PRODUCTION_HOSTNAME = 'genogram-builder.carlmanson.au'

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag: (...args: unknown[]) => void
  }
}

export function initAnalytics() {
  if (typeof window === 'undefined') return
  if (window.location.hostname !== PRODUCTION_HOSTNAME) return

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag(...args: unknown[]) { window.dataLayer.push(args) }
  window.gtag('js', new Date())
  window.gtag('config', GA_MEASUREMENT_ID)
}
