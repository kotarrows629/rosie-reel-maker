import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ frames: [] as number[], fail: false, canceled: 0, support: true, closed: 0 }))
vi.mock('mediabunny', () => ({
  canEncodeVideo: vi.fn(async () => state.support),
  BufferTarget: class { buffer = new ArrayBuffer(20) },
  Mp4OutputFormat: class {},
  CanvasSource: class {
    async add(t: number) { if (state.fail) throw new Error('encoder failed'); state.frames.push(t) }
    close() { state.closed++ }
  },
  Output: class {
    state = 'pending'
    addVideoTrack() {}
    async start() { this.state = 'started' }
    async finalize() { this.state = 'finalized' }
    async cancel() { state.canceled++; this.state = 'canceled' }
  },
}))
import { exportVideo, supportsExport } from './exportVideo'
import { timeline, type Photo } from './timeline'
const photos: Photo[] = [{ id: 'b', name: 'b.jpg', url: 'blob:b', duration: .5 }, { id: 'a', name: 'a.jpg', url: 'blob:a', duration: 1 }]
beforeEach(() => {
  state.frames = []; state.fail = false; state.canceled = 0; state.support = true; state.closed = 0
  vi.stubGlobal('isSecureContext', true); vi.stubGlobal('VideoEncoder', class {}); vi.stubGlobal('VideoFrame', class {})
  vi.stubGlobal('Image', class { src = ''; naturalWidth = 900; naturalHeight = 1600; async decode() {} })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ save: vi.fn(), restore: vi.fn(), fillRect: vi.fn(), drawImage: vi.fn() } as unknown as CanvasRenderingContext2D)
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
describe('MP4 export', () => {
  it('assigns all 45 frames and preserves the edited order', async () => {
    expect(timeline(photos).map(p => [p.photo.id, Math.round(p.start*30), Math.round(p.end*30)])).toEqual([['b', 0, 15], ['a', 15, 45]])
    const progress = vi.fn()
    const blob = await exportVideo(photos, 'hd', new AbortController().signal, progress)
    expect(blob.type).toBe('video/mp4'); expect(blob.size).toBe(20)
    expect(state.frames.length).toBe(45); expect(state.frames[44]).toBe(44 / 30)
    expect(progress).toHaveBeenLastCalledWith(100); expect(state.closed).toBe(1)
  })
  it('exports overlap duration rather than the sum of photo durations', async () => {
    const items = photos.map(photo => ({ ...photo, duration: 1.5, transition: .3 }))
    await exportVideo(items, 'light', new AbortController().signal, vi.fn())
    expect(state.frames).toHaveLength(81)
    expect(state.frames[80]).toBe(80 / 30)
  })
  it('does not attempt unsupported encoders or insecure contexts', async () => {
    state.support = false
    await expect(exportVideo(photos, 'hd', new AbortController().signal, vi.fn())).rejects.toThrow('対応していません')
    vi.stubGlobal('isSecureContext', false)
    expect(await supportsExport('light')).toBe(false)
    expect(state.frames).toHaveLength(0)
  })
  it('releases the encoder after failure', async () => {
    state.fail = true
    await expect(exportVideo(photos, 'hd', new AbortController().signal, vi.fn())).rejects.toThrow('encoder failed')
    expect(state.canceled).toBe(1)
  })
  it('cancels without creating a file', async () => {
    const controller = new AbortController()
    const progress = () => controller.abort()
    await expect(exportVideo(photos, 'light', controller.signal, progress)).rejects.toThrow('中止')
    expect(state.canceled).toBe(1)
    expect(state.frames).toHaveLength(1)
  })
  it('rejects excessive duration, count, and empty exports', async () => {
    for (const items of [[], Array(31).fill(photos[0]), [{ ...photos[0], duration: 61 }]]) {
      await expect(exportVideo(items, 'hd', new AbortController().signal, vi.fn())).rejects.toThrow('30枚')
    }
  })
})
