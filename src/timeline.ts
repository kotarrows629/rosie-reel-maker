export type Photo = { id: string; name: string; url: string; duration: number }
export const totalDuration = (photos: Photo[]) => photos.reduce((sum, p) => sum + p.duration, 0)
export function photoAt(photos: Photo[], time: number) {
  let end = 0
  const index = photos.findIndex(p => { end += p.duration; return time < end })
  return index < 0 ? Math.max(0, photos.length - 1) : index
}
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
