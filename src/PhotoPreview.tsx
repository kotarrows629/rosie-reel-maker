import { useEffect, useRef, useState } from 'react'
import { clamp, dragLayout, layoutOf, type Layout } from './photoLayout'
import { composeFrame, frameLayers, makeLayer } from './renderFrame'
import { layersAt, type Photo } from './timeline'

type Cached = { photo?: Photo; image: HTMLImageElement; ready: Promise<void>; canvas?: HTMLCanvasElement }
type Props = { photos: Photo[]; time: number; editPhoto?: Photo; disabled: boolean; onLayout: (layout: Layout) => void }
export default function PhotoPreview({ photos, time, editPhoto, disabled, onLayout }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const cache = useRef(new Map<string, Cached>())
  const [error, setError] = useState('')
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const dimensions = useRef({ width: 1, height: 1 })
  const layoutRef = useRef(editPhoto ? layoutOf(editPhoto) : undefined)
  layoutRef.current = editPhoto ? layoutOf(editPhoto) : undefined
  useEffect(() => { pointers.current.clear() }, [editPhoto?.id, disabled])
  useEffect(() => {
    let active = true
    const relevant = editPhoto ? [editPhoto] : layersAt(photos, time).map(l => l.photo)
    const ids = new Set(relevant.map(p => p.id))
    for (const [id, item] of cache.current) if (!ids.has(id)) { item.image.src = ''; if (item.canvas) item.canvas.width = item.canvas.height = 1; cache.current.delete(id) }
    void (async () => {
      try {
        for (const photo of relevant) {
          let item = cache.current.get(photo.id)
          if (!item) {
            const image = new Image(); image.src = photo.url
            item = { image, ready: image.decode() }
            cache.current.set(photo.id, item)
          }
          await item.ready
          if (!active) return
          if (item.photo !== photo || !item.canvas) {
            if (item.canvas) item.canvas.width = item.canvas.height = 1
            item.canvas = makeLayer(item.image, photo, 540, 960); item.photo = photo
          }
        }
        if (!active || !canvas.current) return
        if (editPhoto) {
          const item = cache.current.get(editPhoto.id)!
          dimensions.current = { width: item.image.naturalWidth, height: item.image.naturalHeight }
          composeFrame(canvas.current.getContext('2d')!, [{ canvas: item.canvas!, opacity: 1, blend: 1 }], 540, 960)
        } else composeFrame(canvas.current.getContext('2d')!, frameLayers(photos, time, new Map([...cache.current].map(([id, item]) => [id, item.canvas!]))), 540, 960)
        setError('')
      } catch { if (active) setError('プレビューを読み込めませんでした。写真を選び直してください。') }
    })()
    return () => { active = false }
  }, [photos, time, editPhoto])
  useEffect(() => () => { cache.current.forEach(item => { item.image.src = ''; if (item.canvas) item.canvas.width = item.canvas.height = 1 }); cache.current.clear() }, [])
  function move(id: number, x: number, y: number) {
    const layout = layoutRef.current, previous = pointers.current.get(id)
    if (!layout || !previous || !canvas.current || disabled || layout.fit !== 'cover') return
    const before = [...pointers.current.values()]
    pointers.current.set(id, { x, y })
    const after = [...pointers.current.values()]
    const box = canvas.current.getBoundingClientRect()
    if (after.length === 2) {
      const distance = (v: {x:number;y:number}[]) => Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y)
      const old = distance(before)
      if (old > 1) { const next = { ...layout, zoom: clamp(layout.zoom * distance(after) / old, 1, 4) }; layoutRef.current = next; onLayout(next) }
    } else { const next = dragLayout(layout, dimensions.current.width, dimensions.current.height, box.width, box.height, x - previous.x, y - previous.y); layoutRef.current = next; onLayout(next) }
  }
  const interactive = !!editPhoto && layoutOf(editPhoto).fit === 'cover' && !disabled
  return <><canvas ref={canvas} width={540} height={960} className={interactive ? 'frame-canvas interactive' : 'frame-canvas'} role="img" aria-label={editPhoto ? `位置調整：${editPhoto.name}` : 'リールのプレビュー'} onPointerDown={e => { if (!interactive || pointers.current.size >= 2 || !cache.current.get(editPhoto!.id)?.canvas) return; pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); e.currentTarget.setPointerCapture(e.pointerId) }} onPointerMove={e => move(e.pointerId, e.clientX, e.clientY)} onPointerUp={e => pointers.current.delete(e.pointerId)} onPointerCancel={() => pointers.current.clear()} onLostPointerCapture={e => pointers.current.delete(e.pointerId)}/>{error && <p role="alert" className="preview-error">{error}</p>}</>
}
