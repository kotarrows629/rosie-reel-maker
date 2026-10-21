import type { Photo } from './timeline'

export type Layout = { fit: 'cover' | 'contain'; background: 'black' | 'white' | 'blur'; x: number; y: number; zoom: number }
export const defaultLayout: Layout = { fit: 'cover', background: 'black', x: 0.5, y: 0.5, zoom: 1 }
export const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value))
export function layoutOf(photo: Photo): Layout { return { ...defaultLayout, ...photo.layout } }
export function photoRect(iw: number, ih: number, w: number, h: number, layout: Layout) {
  const scale = (layout.fit === 'cover' ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih)) * (layout.fit === 'cover' ? clamp(layout.zoom, 1, 4) : 1)
  const width = iw * scale, height = ih * scale
  return { x: (w - width) * (layout.fit === 'cover' ? clamp(layout.x) : .5), y: (h - height) * (layout.fit === 'cover' ? clamp(layout.y) : .5), width, height }
}
export function dragLayout(layout: Layout, iw: number, ih: number, w: number, h: number, dx: number, dy: number): Layout {
  const rect = photoRect(iw, ih, w, h, layout)
  return { ...layout, x: rect.width > w ? clamp(layout.x - dx / (rect.width - w)) : .5, y: rect.height > h ? clamp(layout.y - dy / (rect.height - h)) : .5 }
}

// Deterministic blur shared by preview/export, including Safari without Canvas filter support.
const blurred = new WeakMap<HTMLImageElement, HTMLCanvasElement>()
function blurBackground(image: HTMLImageElement) {
  const cached = blurred.get(image)
  if (cached) return cached
  const canvas = document.createElement('canvas'); canvas.width = 36; canvas.height = 64
  const ctx = canvas.getContext('2d')!
  const rect = photoRect(image.naturalWidth, image.naturalHeight, 36, 64, defaultLayout)
  ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height)
  let pixels = ctx.getImageData(0, 0, 36, 64)
  for (let pass = 0; pass < 3; pass++) {
    const next = ctx.createImageData(36, 64)
    for (let y = 0; y < 64; y++) for (let x = 0; x < 36; x++) {
      const index = (y * 36 + x) * 4
      for (let c = 0; c < 3; c++) {
        let sum = 0
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) sum += pixels.data[(clamp(y + dy, 0, 63) * 36 + clamp(x + dx, 0, 35)) * 4 + c]
        next.data[index + c] = sum / 25
      }
      next.data[index + 3] = 255
    }
    pixels = next
  }
  ctx.putImageData(pixels, 0, 0); blurred.set(image, canvas)
  return canvas
}
export function renderPhoto(ctx: CanvasRenderingContext2D, image: HTMLImageElement, photo: Photo, w: number, h: number) {
  const layout = layoutOf(photo)
  ctx.save(); ctx.globalAlpha = 1
  ctx.fillStyle = layout.fit === 'contain' && layout.background === 'white' ? '#fff' : '#000'
  ctx.fillRect(0, 0, w, h)
  if (layout.fit === 'contain' && layout.background === 'blur') ctx.drawImage(blurBackground(image), 0, 0, w, h)
  const rect = photoRect(image.naturalWidth, image.naturalHeight, w, h, layout)
  ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height)
  ctx.restore()
}
