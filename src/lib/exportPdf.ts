import jsPDF from 'jspdf'
import { svg2pdf } from 'svg2pdf.js'
import { GenogramData, Settings, DEFAULT_SETTINGS } from './types'
import { exportToSvg } from './exportSvg'
import type { ExportOptions } from '../components/ExportSvgModal'

// A4 in mm — what jsPDF speaks natively.
const A4_PORTRAIT_MM = { w: 210, h: 297 }
const A4_LANDSCAPE_MM = { w: 297, h: 210 }

// The svg viewBox uses px (96 DPI). 1 mm = 96/25.4 px ≈ 3.7795275591 px.
const MM_PER_PX = 25.4 / 96

export async function exportToPdf(
  data: GenogramData,
  settings: Settings = DEFAULT_SETTINGS,
  options: ExportOptions
): Promise<Blob> {
  const svgString = exportToSvg(data, settings, options)

  // Parse the SVG so svg2pdf can walk it.
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgString, 'image/svg+xml')
  const svgEl = doc.documentElement as unknown as SVGSVGElement

  // svg2pdf reads computed styles; the element must be in a real document.
  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.left = '-99999px'
  host.style.top = '0'
  host.appendChild(svgEl)
  document.body.appendChild(host)

  try {
    const viewBox = (svgEl.getAttribute('viewBox') || '').split(/\s+/).map(Number)
    const vbW = viewBox[2] || svgEl.clientWidth || 794
    const vbH = viewBox[3] || svgEl.clientHeight || 1123

    let pdfW: number
    let pdfH: number
    let orientation: 'portrait' | 'landscape'

    if (options.mode === 'fit') {
      // SVG viewBox is exactly one A4 page in px.
      const useLandscape = vbW > vbH
      orientation = useLandscape ? 'landscape' : 'portrait'
      pdfW = useLandscape ? A4_LANDSCAPE_MM.w : A4_PORTRAIT_MM.w
      pdfH = useLandscape ? A4_LANDSCAPE_MM.h : A4_PORTRAIT_MM.h
    } else {
      // Native: viewBox may exceed one A4. Convert px → mm so the PDF page
      // grows with the genogram (single oversized page rather than tiling).
      const widthMm = vbW * MM_PER_PX
      const heightMm = vbH * MM_PER_PX
      orientation = widthMm > heightMm ? 'landscape' : 'portrait'
      pdfW = widthMm
      pdfH = heightMm
    }

    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: [pdfW, pdfH],
      compress: true,
    })

    await svg2pdf(svgEl, pdf, { x: 0, y: 0, width: pdfW, height: pdfH })

    return pdf.output('blob')
  } finally {
    host.remove()
  }
}
