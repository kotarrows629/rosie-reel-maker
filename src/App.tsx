import ExportPanel from './ExportPanel'
import { useEffect, useRef, useState } from 'react'
import { movePhoto, photoAt, totalDuration, validDuration, type Photo } from './timeline'

function DurationField({ photo, onChange }: { photo: Photo; onChange: (n: number) => void }) {
  const [draft, setDraft] = useState(String(photo.duration))
  const valid = validDuration(draft)
  return <div className="duration"><label htmlFor={`seconds-${photo.id}`}>表示秒数</label><div><input id={`seconds-${photo.id}`} type="number" inputMode="decimal" min="0.5" max="60" step="0.1" value={draft} aria-invalid={!valid} aria-describedby={!valid ? `error-${photo.id}` : undefined} onChange={e => { setDraft(e.target.value); if (validDuration(e.target.value)) onChange(Number(e.target.value)) }} onBlur={() => setDraft(String(photo.duration))} /><span>秒</span></div>{!valid && <small id={`error-${photo.id}`}>0.5〜60秒（小数1桁）で入力してください</small>}</div>
}

export default function App() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const urls = useRef(new Set<string>())
  const mounted = useRef(true)
  const total = totalDuration(photos)
  const active = photoAt(photos, time)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current.clear() } }, [])
  useEffect(() => {
    if (!playing) return
    let frame = 0
    let previous = performance.now()
    const tick = (now: number) => {
      const delta = (now - previous) / 1000
      previous = now
      setTime(t => Math.min(total, t + delta))
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, total])
  useEffect(() => { if (time >= total) setPlaying(false) }, [time, total])
  useEffect(() => {
    const pause = () => { if (document.hidden) setPlaying(false) }
    document.addEventListener('visibilitychange', pause)
    return () => document.removeEventListener('visibilitychange', pause)
  }, [])
  const edit = (next: Photo[]) => { setPlaying(false); setTime(0); setPhotos(next) }
  async function addFiles(files: File[]) {
    setLoading(true); setPlaying(false); setMessage('')
    const added: Photo[] = []
    const failed: string[] = []
    // Decode sequentially to avoid decoding many large iPhone photos at once.
    for (const file of files) {
      if (!mounted.current) break
      if (!file.type.startsWith('image/')) { failed.push(file.name); continue }
      const url = URL.createObjectURL(file)
      urls.current.add(url)
      try {
        await new Promise<void>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(); image.onerror = () => reject(); image.src = url })
        if (!mounted.current) { URL.revokeObjectURL(url); urls.current.delete(url); break }
        added.push({ id: crypto.randomUUID(), name: file.name, url, duration: 1.5 })
      } catch { URL.revokeObjectURL(url); urls.current.delete(url); failed.push(file.name) }
    }
    if (!mounted.current) return
    setPhotos(current => [...current, ...added]); setTime(0); setLoading(false)
    setMessage(`${added.length}枚追加しました。${failed.length ? `読み込めない写真が${failed.length}枚あります。JPEG・PNGなどSafariで表示できる画像を選んでください。` : ''}`)
  }
  return <main>
    <header><a className="brand" href="./">rosie<span> ✳</span></a><span className="badge">REEL MAKER / 試作品</span></header>
    <section className="intro"><p className="eyebrow">YOUR PHOTOS, YOUR STORY</p><h1>日々のかけらを、<br/>ひとつのリールに。</h1><p>写真を選んで、順番と時間を整える。<br/>あなただけのストーリーをプレビュー。</p></section>
    <div className="workspace"><section className="preview-section" aria-label="リールのプレビュー"><div className="section-heading"><h2>プレビュー</h2><span>9:16</span></div>
      <div className="preview">{photos.length ? <img src={photos[active].url} alt={`プレビュー：${photos[active].name}`} /> : <div className="placeholder"><span>✳</span><strong>ここから、ストーリーを。</strong><p>写真を追加すると<br/>プレビューが表示されます</p></div>}<span className="preview-tag">ROSIE REEL</span>{photos.length > 0 && <span className="counter">{active + 1} / {photos.length}</span>}</div>
      <div className="playback"><button aria-label="先頭に戻る" disabled={!photos.length || loading || exporting} onClick={() => { setPlaying(false); setTime(0) }}>↶</button><button className="primary" disabled={!photos.length || loading || exporting} onClick={() => { if (time >= total) setTime(0); setPlaying(!playing) }}>{playing ? 'Ⅱ 一時停止' : '▶ 再生する'}</button><span className="clock">{time.toFixed(1)} / {total.toFixed(1)} 秒</span></div>
      <progress aria-label="再生の進み具合" max={total || 1} value={time}/><p className="hint">写真は画面いっぱいに中央で切り抜いて表示します。</p>
      <ExportPanel photos={photos} blocked={loading} onBusy={value => { setExporting(value); if (value) setPlaying(false) }}/>
    </section>
    <section className="editor" aria-label="写真の編集"><div className="section-heading"><h2>写真をならべる</h2><span>{photos.length}枚 · {total.toFixed(1)}秒</span></div><p className="editor-help">上から順に再生します。矢印で順番を変えられます。</p>
      <fieldset disabled={exporting} className="editing-fields"><label className={`upload ${loading ? 'busy' : ''}`}><span>＋</span><strong>{loading ? '写真を読み込み中…' : '写真を追加する'}</strong><small>複数枚まとめて選べます</small><input aria-label="写真を追加する" type="file" accept="image/*" multiple disabled={loading} onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ''; if (files.length) void addFiles(files) }}/></label>
      <p role="status" className="status">{message}</p>
      {!photos.length && <div className="empty"><span>01 — 02 — 03</span><p>お気に入りの写真を選びましょう。<br/>1枚あたり1.5秒から始められます。</p></div>}
      <ol className="photo-list">{photos.map((photo, index) => <li key={photo.id} className={index === active ? 'selected' : ''}><div className="photo-top"><span className="number">{String(index + 1).padStart(2, '0')}</span><img src={photo.url} alt={photo.name}/><div className="photo-info"><p title={photo.name}>{photo.name}</p><DurationField photo={photo} onChange={duration => edit(photos.map(p => p.id === photo.id ? { ...p, duration } : p))}/></div></div><div className="photo-actions"><button disabled={index === 0 || loading} aria-label={`写真${index + 1}を前へ`} onClick={() => edit(movePhoto(photos, index, -1))}>↑ 前へ</button><button disabled={index === photos.length - 1 || loading} aria-label={`写真${index + 1}を後へ`} onClick={() => edit(movePhoto(photos, index, 1))}>↓ 後へ</button><button className="remove" disabled={loading} aria-label={`写真${index + 1}を削除`} onClick={() => { edit(photos.filter(p => p.id !== photo.id)); URL.revokeObjectURL(photo.url); urls.current.delete(photo.url) }}>削除</button></div></li>)}</ol></fieldset>
      <div className="privacy"><strong>⌁ 写真は、この端末の中だけに。</strong><p>写真を外部へアップロードしません。ページを閉じる・再読み込みすると編集内容は消えます。</p></div>
    </section></div><footer>まずは、プレビューから。<span>対応する端末でMP4の保存・共有ができます。</span></footer>
  </main>
}
