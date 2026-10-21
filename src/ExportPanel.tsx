import { useEffect, useRef, useState } from 'react'
import { exportVideo, supportsExport, type Quality } from './exportVideo'
import { totalDuration, type Photo } from './timeline'

export default function ExportPanel({ photos, blocked, onBusy }: { photos: Photo[]; blocked: boolean; onBusy: (value: boolean) => void }) {
  const [quality, setQuality] = useState<Quality>('hd')
  const [supported, setSupported] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<{ file: File; url: string } | null>(null)
  const controller = useRef<AbortController | null>(null)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort() } }, [])
  useEffect(() => {
    let active = true
    setSupported(null)
    const timer = setTimeout(() => { if (active) setSupported(false) }, 10_000)
    void supportsExport(quality).then(value => { clearTimeout(timer); if (active) setSupported(value) })
    return () => { active = false; clearTimeout(timer) }
  }, [quality])
  useEffect(() => { setResult(null); setMessage('') }, [photos, quality])
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url) }, [result])
  useEffect(() => {
    const stop = () => { if (document.hidden) controller.current?.abort() }
    document.addEventListener('visibilitychange', stop)
    const leave = () => controller.current?.abort()
    window.addEventListener('pagehide', leave)
    return () => { document.removeEventListener('visibilitychange', stop); window.removeEventListener('pagehide', leave) }
  }, [])
  const overLimit = photos.length > 30 || totalDuration(photos) > 60
  async function start() {
    const abort = new AbortController()
    controller.current = abort
    setBusy(true); onBusy(true); setMessage(''); setProgress(0); setResult(null)
    try {
      const blob = await exportVideo(photos, quality, abort.signal, value => { if (alive.current) setProgress(value) })
      if (abort.signal.aborted || !alive.current) return
      const file = new File([blob], 'rosie-reel.mp4', { type: 'video/mp4' })
      setResult({ file, url: URL.createObjectURL(file) })
      setMessage('動画ができました。「共有」または「MP4をダウンロード」から保存できます。')
    } catch (error) {
      if (alive.current) setMessage(error instanceof Error && /[ぁ-んァ-ヶ一-龯]/.test(error.message) ? error.message : '書き出しに失敗しました。軽量画質・少ない写真で再試行してください。')
    } finally {
      controller.current = null
      if (alive.current) { setBusy(false); onBusy(false) }
    }
  }
  let canShare = false
  try { canShare = !!result && !!navigator.canShare?.({ files: [result.file] }) } catch { /* Download remains available. */ }
  async function share() {
    if (!result) return
    try { await navigator.share({ files: [result.file] }) }
    catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) setMessage('共有できませんでした。MP4をダウンロードして保存してください。') }
  }
  return <section className="export-panel" aria-label="動画の書き出し"><h2>動画を保存</h2><p>写真を端末内でMP4にします。音声なし・9:16・30fps。<br/>書き出し中はこの画面を開いたままにしてください。</p>
    <label htmlFor="quality">画質</label><select id="quality" disabled={busy} value={quality} onChange={e => setQuality(e.target.value as Quality)}><option value="hd">高画質 · 1080×1920</option><option value="light">軽量 · 720×1280</option></select>
    {supported === null && <p>この端末の対応状況を確認中…</p>}
    {supported === false && <p role="status">この画質のMP4書き出しは利用できません。軽量画質または最新のSafariをお試しください。対応しない場合も写真の編集・プレビューは使えます。</p>}
    {overLimit && <p role="status">書き出しは30枚・合計60秒以内でお試しください。</p>}
    <button className="primary" disabled={busy || blocked || !photos.length || supported !== true || overLimit} onClick={() => void start()}>動画を保存</button>
    {busy && <div><progress aria-label="動画書き出しの進捗" max={100} value={progress}/><p role="status">{progress < 99 ? `書き出し中 ${progress}%` : '動画を仕上げています…'}</p><button onClick={() => controller.current?.abort()}>書き出しを中止</button></div>}
    <p role="status">{message}</p>
    {result && <div className="export-result"><video aria-label="書き出した動画" src={result.url} controls playsInline preload="metadata"/>{canShare && <button className="primary" onClick={() => void share()}>共有・写真に保存</button>}<a className="download" href={result.url} download="rosie-reel.mp4">MP4をダウンロード</a><p>iPhoneでは共有メニューの「ビデオを保存」を選ぶと写真アプリに保存できます。表示されない場合は「ファイルに保存」、またはダウンロード後にファイルアプリから共有してください。</p></div>}
    <small>実験的な機能です。端末によっては失敗することがあります。失敗時は軽量画質・短い動画でお試しください。再読み込みすると生成した動画も消えます。</small>
  </section>
}
