import type { Layout } from './photoLayout'
export type Photo = { id: string; name: string; url: string; duration: number; layout?: Partial<Layout>; fadeIn?: number; fadeOut?: number; transition?: number }
export type Segment = { photo: Photo; index: number; start: number; end: number; overlap: number }
const ticks = (n: number) => Math.max(0, Math.round(n * 10))
export function timeline(photos: Photo[]): Segment[] {
  let start = 0, incoming = 0
  return photos.map((photo, index) => {
    const duration = ticks(photo.duration)
    const overlap = index === photos.length - 1 ? 0 : Math.min(ticks(photo.transition ?? 0), Math.max(0, duration - incoming), ticks(photos[index + 1].duration))
    const segment = { photo, index, start: start / 10, end: (start + duration) / 10, overlap: overlap / 10 }
    start += duration - overlap; incoming = overlap
    return segment
  })
}
export const totalDuration = (photos: Photo[]) => timeline(photos).at(-1)?.end ?? 0
export const rawDuration = (photos: Photo[]) => photos.reduce((sum, p) => sum + p.duration, 0)
export function normalizePhotos(photos: Photo[]) {
  return timeline(photos).map(({ photo, overlap }, index) => {
    const fadeIn = index === 0 ? 0 : Math.min(ticks(photo.fadeIn ?? 0), ticks(photo.duration)) / 10
    const fadeOut = index === photos.length - 1 ? 0 : Math.min(ticks(photo.fadeOut ?? 0), ticks(photo.duration - fadeIn)) / 10
    return { ...photo, transition: index === photos.length - 1 ? Math.min(ticks(photo.transition ?? 0), ticks(photo.duration)) / 10 : overlap, fadeIn, fadeOut }
  })
}
export function fadeOpacity(segment: Segment, time: number, count: number) {
  const local = Math.max(0, time - segment.start), duration = segment.photo.duration
  const fadeIn = segment.index === 0 ? 0 : Math.min(segment.photo.fadeIn ?? 0, duration)
  const fadeOut = segment.index === count - 1 ? 0 : Math.min(segment.photo.fadeOut ?? 0, Math.max(0, duration - fadeIn))
  return Math.max(0, Math.min(1, fadeIn ? local / fadeIn : 1, fadeOut ? (duration - local) / fadeOut : 1))
}
export function layersAt(photos: Photo[], time: number) {
  const segments = timeline(photos)
  if (!segments.length) return []
  const t = Math.max(0, Math.min(time, segments.at(-1)!.end - 1e-8))
  const active = segments.filter(s => t >= s.start && t < s.end)
  if (active.length === 2) {
    const blend = Math.min(1, Math.max(0, (t - active[1].start) / active[0].overlap))
    return active.map((segment, i) => ({ ...segment, opacity: fadeOpacity(segment, t, photos.length), blend: i === 0 ? 1 : blend }))
  }
  return active.map(segment => ({ ...segment, opacity: fadeOpacity(segment, t, photos.length), blend: 1 }))
}
export function photoAt(photos: Photo[], time: number) { return layersAt(photos, time).at(-1)?.index ?? 0 }
export function movePhoto(photos: Photo[], index: number, offset: number) {
  const next = index + offset
  if (next < 0 || next >= photos.length) return photos
  const result = [...photos]
  ;[result[index], result[next]] = [result[next], result[index]]
  return result
}
export function validDuration(value: string) {
  const n = Number(value)
  return value.trim() !== '' && Number.isFinite(n) && n >= 0.5 && n <= 60 && Math.abs(n * 10 - Math.round(n * 10)) < 0.00001
}
