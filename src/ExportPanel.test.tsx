import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ExportPanel from './ExportPanel'
import { exportVideo, supportsExport } from './exportVideo'
vi.mock('./exportVideo', () => ({ exportVideo: vi.fn(), supportsExport: vi.fn() }))
const photos = [{ id: '1', name: 'a.jpg', url: 'blob:a', duration: 1.5 }]
beforeEach(() => {
  vi.mocked(supportsExport).mockResolvedValue(true)
  vi.mocked(exportVideo).mockResolvedValue(new Blob(['mp4'], { type: 'video/mp4' }))
  URL.createObjectURL = vi.fn(() => 'blob:result')
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
it('shows unsupported guidance and disables export', async () => {
  vi.mocked(supportsExport).mockResolvedValue(false)
  render(<ExportPanel photos={photos} blocked={false} onBusy={vi.fn()}/> )
  await screen.findByText(/この画質のMP4書き出しは利用できません/)
  expect((screen.getByRole('button', { name: '動画を保存' }) as HTMLButtonElement).disabled).toBe(true)
})
it('offers MP4 download and invalidates it when editing changes', async () => {
  const busy = vi.fn()
  const view = render(<ExportPanel photos={photos} blocked={false} onBusy={busy}/> )
  await waitFor(() => expect((screen.getByRole('button', { name: '動画を保存' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: '動画を保存' }))
  const link = await screen.findByText('MP4をダウンロード')
  expect(link.getAttribute('download')).toBe('rosie-reel.mp4')
  expect(busy.mock.calls).toEqual([[true], [false]])
  view.rerender(<ExportPanel photos={[{ ...photos[0], duration: 2 }]} blocked={false} onBusy={busy}/> )
  expect(screen.queryByText('MP4をダウンロード')).toBeNull()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:result')
})
it('aborts export when the page is hidden', async () => {
  let signal: AbortSignal | undefined
  vi.mocked(exportVideo).mockImplementation(async (_p, _q, value) => { signal = value; return await new Promise<Blob>(() => {}) })
  render(<ExportPanel photos={photos} blocked={false} onBusy={vi.fn()}/> )
  await waitFor(() => expect((screen.getByRole('button', { name: '動画を保存' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: '動画を保存' }))
  await act(async () => { window.dispatchEvent(new Event('pagehide')) })
  expect(signal?.aborted).toBe(true)
})
it('shares the generated MP4 from a separate user gesture', async () => {
  const share = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: vi.fn(() => true) })
  Object.defineProperty(navigator, 'share', { configurable: true, value: share })
  render(<ExportPanel photos={photos} blocked={false} onBusy={vi.fn()}/> )
  await waitFor(() => expect((screen.getByRole('button', { name: '動画を保存' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: '動画を保存' }))
  fireEvent.click(await screen.findByRole('button', { name: '共有・写真に保存' }))
  expect(share).toHaveBeenCalledWith({ files: [expect.objectContaining({ name: 'rosie-reel.mp4', type: 'video/mp4' })] })
  delete (navigator as Partial<Navigator>).canShare
  delete (navigator as Partial<Navigator>).share
})
