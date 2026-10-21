import { renderPhoto } from './photoLayout'
import { layersAt, type Photo } from './timeline'

export function makeLayer(image: HTMLImageElement, photo: Photo, width: number, height: number) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
  renderPhoto(canvas.getContext('2d', { alpha: false })!, image, photo, width, height)
  return canvas
}
// Each photo first fades against black; the complete images then dissolve together.
export function composeFrame(ctx: CanvasRenderingContext2D, layers: { canvas: HTMLCanvasElement; opacity: number; blend: number }[], width: number, height: number) {
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height)
  // Weighted addition avoids darkening the outgoing image twice during a dissolve.
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i]
    const weight = layers.length === 2 && i === 0 ? 1 - layers[1].blend : layer.blend
    ctx.globalAlpha = weight * layer.opacity
    ctx.drawImage(layer.canvas, 0, 0, width, height)
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'

}
export function frameLayers(photos: Photo[], time: number, cache: Map<string, HTMLCanvasElement>) {
  return layersAt(photos, time).map(layer => ({ canvas: cache.get(layer.photo.id)!, opacity: layer.opacity, blend: layer.blend }))
}
