import { composeFrame, frameLayers, makeLayer } from './renderFrame'
import { BufferTarget, CanvasSource, canEncodeVideo, Mp4OutputFormat, Output } from 'mediabunny'
import { layersAt, totalDuration, type Photo } from './timeline'

export const FPS = 30
export const sizes = { hd: { width: 1080, height: 1920, bitrate: 6_000_000 }, light: { width: 720, height: 1280, bitrate: 3_000_000 } }
export type Quality = keyof typeof sizes
export async function supportsExport(quality: Quality) {
  if (!globalThis.isSecureContext || typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return false
  try { return await canEncodeVideo('avc', { ...sizes[quality], frameRate: FPS }) } catch { return false }
}
// Bounded waits also handle encoders or image decoders that stop responding.
function bounded<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => finish(() => reject(new Error('書き出しを中止しました。')))
    const timer = setTimeout(() => finish(() => reject(new Error('処理が応答しません。軽量画質・少ない写真で再試行してください。'))), 30_000)
    const finish = (fn: () => void) => { clearTimeout(timer); signal.removeEventListener('abort', abort); fn() }
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    promise.then(v => finish(() => resolve(v)), e => finish(() => reject(e)))
  })
}
export async function exportVideo(photos: Photo[], quality: Quality, signal: AbortSignal, progress: (value: number) => void): Promise<Blob> {
  if (!photos.length || photos.length > 30 || totalDuration(photos) > 60) throw new Error('書き出しは30枚・合計60秒以内でお試しください。')
  if (!await bounded(supportsExport(quality), signal)) throw new Error('この端末は選択した画質のMP4書き出しに対応していません。最新のSafari、または軽量画質でお試しください。')
  const { width, height, bitrate } = sizes[quality]
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('描画に必要なメモリを確保できません。')
  const target = new BufferTarget()
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target })
  const source = new CanvasSource(canvas, { codec: 'avc', bitrate, keyFrameInterval: 2 })
  let image: HTMLImageElement | undefined
  try {
    output.addVideoTrack(source, { frameRate: FPS })
    await bounded(output.start(), signal)
    const frames = Math.round(totalDuration(photos) * FPS)
    const cache = new Map<string, HTMLCanvasElement>()
    try {
      for (let frame = 0; frame < frames; frame++) {
        if (signal.aborted) throw new Error('書き出しを中止しました。')
        const time = frame / FPS
        const layers = layersAt(photos, time)
        const ids = new Set(layers.map(layer => layer.photo.id))
        for (const [id, layer] of cache) if (!ids.has(id)) { layer.width = layer.height = 1; cache.delete(id) }
        for (const { photo } of layers) if (!cache.has(photo.id)) {
          image = new Image(); image.src = photo.url
          await bounded(image.decode(), signal)
          cache.set(photo.id, makeLayer(image, photo, width, height))
          image.src = ''; image = undefined
        }
        composeFrame(context, frameLayers(photos, time, cache), width, height)
        await bounded(source.add(time, 1 / FPS), signal)
        progress(Math.min(99, Math.floor((frame + 1) / frames * 99)))
        if (frame % 10 === 0) await new Promise(resolve => setTimeout(resolve, 0))
      }
    } finally { cache.forEach(layer => { layer.width = layer.height = 1 }); cache.clear() }
    source.close()
    await bounded(output.finalize(), signal)
    if (!target.buffer?.byteLength) throw new Error('動画を生成できませんでした。')
    const blob = new Blob([target.buffer], { type: 'video/mp4' })
    progress(100)
    return blob
  } finally {
    if (image) image.src = ''
    if (output.state !== 'finalized') void output.cancel().catch(() => {})
    canvas.width = canvas.height = 1
  }
}
