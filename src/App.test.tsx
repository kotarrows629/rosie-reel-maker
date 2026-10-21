import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'
import { movePhoto, photoAt, totalDuration, validDuration, type Photo } from './timeline'
vi.mock('./PhotoPreview', () => ({ default: ({editPhoto}: {editPhoto?: Photo}) => <div role="img" aria-label={editPhoto ? `位置調整：${editPhoto.name}` : '再生プレビュー'}/> }))
vi.mock('./ExportPanel', () => ({ default: () => null }))
const photos: Photo[] = [1, 2, 3].map(n => ({ id: String(n), name: `${n}.jpg`, url: `blob:${n}`, duration: n }))
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
describe('タイムライン', () => {
  it('秒数の境界で切り替わり、最後の写真を保持する', () => {
    expect(totalDuration(photos)).toBe(6)
    expect([0, .9, 1, 2.9, 3, 6].map(t => photoAt(photos, t))).toEqual([0, 0, 1, 1, 2, 2])
  })
  it('順番を入れ替え、端では変更しない', () => {
    expect(movePhoto(photos, 1, -1).map(p => p.id)).toEqual(['2', '1', '3'])
    expect(movePhoto(photos, 0, -1)).toBe(photos)
  })
  it('秒数の範囲と精度を検証する', () => {
    for (const v of ['', '0', '-1', '61', 'NaN', '1.23']) expect(validDuration(v)).toBe(false)
    for (const v of ['0.5', '3', '60', '2.1']) expect(validDuration(v)).toBe(true)
  })
})
describe('写真編集と再生', () => {
  beforeEach(() => {
    vi.stubGlobal('Image', class { onload?: () => void; set src(_: string) { queueMicrotask(() => this.onload?.()) } })
    URL.createObjectURL = vi.fn(file => `blob:${(file as File).name}`)
    URL.revokeObjectURL = vi.fn()
  })
  async function upload() {
    render(<App />)
    fireEvent.change(screen.getByLabelText('写真を追加する'), { target: { files: [new File(['a'], 'a.jpg', { type: 'image/jpeg' }), new File(['b'], 'b.jpg', { type: 'image/jpeg' })] } })
    await waitFor(() => expect(screen.getAllByLabelText('表示秒数').length).toBe(2))
  }
  it('複数写真を1.5秒で追加し、並べ替え・秒数変更・削除できる', async () => {
    await upload()
    expect((screen.getAllByLabelText('表示秒数')[0] as HTMLInputElement).value).toBe('1.5')
    fireEvent.click(screen.getByLabelText('写真2を前へ'))
    expect(screen.getAllByRole('listitem')[0].textContent).toContain('b.jpg')
    fireEvent.change(screen.getAllByLabelText('表示秒数')[0], { target: { value: '2' } })
    expect(screen.getByText('2枚 · 3.2秒')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('写真1を削除'))
    expect(screen.getByRole('img', {name:'位置調整：a.jpg'})).toBeTruthy()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:b.jpg')
  })
  it('経過時間で切り替わり、一時停止・再開・終了・先頭復帰できる', async () => {
    let callback: FrameRequestCallback = () => {}
    vi.stubGlobal('requestAnimationFrame', vi.fn(cb => { callback = cb; return 1 }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.spyOn(performance, 'now').mockReturnValue(0)
    await upload()
    fireEvent.click(screen.getByText('▶ 再生する'))
    act(() => callback(1500))
    expect(screen.getByText('1.5 / 2.7 秒')).toBeTruthy()
    fireEvent.click(screen.getByText('Ⅱ 一時停止'))
    expect(screen.getByText('▶ 再生する')).toBeTruthy()
    fireEvent.click(screen.getByText('▶ 再生する'))
    act(() => callback(1500))
    expect(screen.getByText('▶ 再生する')).toBeTruthy()
    expect(screen.getByText('2.7 / 2.7 秒')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('先頭に戻る'))
    expect(screen.getByText('0.0 / 2.7 秒')).toBeTruthy()
  })
  it('読み込めない画像を拒否しURLを解放する', async () => {
    vi.stubGlobal('Image', class { onerror?: () => void; set src(_: string) { queueMicrotask(() => this.onerror?.()) } })
    render(<App />)
    fireEvent.change(screen.getByLabelText('写真を追加する'), { target: { files: [new File(['bad'], 'bad.jpg', { type: 'image/jpeg' })] } })
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('読み込めない写真が1枚'))
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:bad.jpg')
  })
})
