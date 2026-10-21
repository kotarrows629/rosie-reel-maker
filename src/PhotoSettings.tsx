import { useEffect, useState } from 'react'
import { layoutOf } from './photoLayout'
import { timeline, type Photo } from './timeline'

function Seconds({ label, value, max, disabled, onChange }: { label: string; value: number; max: number; disabled?: boolean; onChange: (n: number) => void }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  const n = Number(draft)
  const valid = draft.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= max && Math.abs(n * 10 - Math.round(n * 10)) < 1e-6
  return <label className="seconds-field">{label}<span><input aria-label={label} type="number" inputMode="decimal" step="0.1" min="0" max={max} disabled={disabled} value={draft} aria-invalid={!valid} onChange={e => { setDraft(e.target.value); const next = Number(e.target.value); if (e.target.value.trim() && next >= 0 && next <= max && Math.abs(next*10-Math.round(next*10))<1e-6) onChange(next) }} onBlur={() => setDraft(String(value))}/> 秒</span>{!valid && <small>0〜{max.toFixed(1)}秒を0.1秒単位で入力</small>}</label>
}
export default function PhotoSettings({ photos, index, onChange, onSelect }: { photos: Photo[]; index: number; onChange: (photo: Photo) => void; onSelect: () => void }) {
  const photo = photos[index], layout = layoutOf(photo), segments = timeline(photos)
  const incoming = segments[index - 1]?.overlap ?? 0
  const maxTransition = Math.max(0, Math.min(photo.duration - incoming, photos[index + 1]?.duration ?? 0))
  const setLayout = (patch: Partial<typeof layout>) => onChange({ ...photo, layout: { ...layout, ...patch } })
  return <div className="photo-settings"><label>写真の表示方法<select aria-label={`写真${index+1}の表示方法`} value={layout.fit} onChange={e => setLayout({ fit: e.target.value as 'cover' | 'contain' })}><option value="cover">画面いっぱいに切り抜き</option><option value="contain">写真全体を表示</option></select></label>
    {layout.fit === 'cover' ? <><button onClick={onSelect}>この写真の位置を調整</button><p>上のプレビューを指でドラッグ・2本指で拡大縮小できます。</p><label>拡大率 {layout.zoom.toFixed(1)}倍<input aria-label={`写真${index+1}の拡大率`} type="range" min="1" max="4" step="0.1" value={layout.zoom} onChange={e => setLayout({ zoom: Number(e.target.value) })}/></label><button onClick={() => setLayout({ x: .5, y: .5, zoom: 1 })}>位置・拡大率をリセット</button></> : <label>余白の背景<select aria-label={`写真${index+1}の背景`} value={layout.background} onChange={e => setLayout({ background: e.target.value as typeof layout.background })}><option value="black">黒</option><option value="white">白</option><option value="blur">写真のぼかし背景</option></select></label>}
    <div className="fade-settings"><Seconds label={`写真${index+1}のフェードイン`} value={index === 0 ? 0 : photo.fadeIn ?? 0} max={Math.max(0, photo.duration - (photo.fadeOut ?? 0))} disabled={index===0} onChange={fadeIn => onChange({ ...photo, fadeIn })}/><Seconds label={`写真${index+1}のフェードアウト`} value={index === photos.length-1 ? 0 : photo.fadeOut ?? 0} max={Math.max(0, photo.duration-(photo.fadeIn??0))} disabled={index===photos.length-1} onChange={fadeOut => onChange({ ...photo, fadeOut })}/></div>
    {index===0 && <small>最初の写真のフェードインはなし</small>}{index===photos.length-1 && <small>最後の写真のフェードアウト・切り替えはなし</small>}
    {index < photos.length-1 && <Seconds label={`写真${index+1}から次へのクロスフェード`} value={segments[index].overlap} max={Math.floor((maxTransition+1e-7)*10)/10} onChange={transition => onChange({ ...photo, transition })}/>}
    <p>前後の切り替えが重なって3枚同時にならない範囲で設定できます。表示時間や順番を変えると上限に合わせて自動調整します。</p><p>個別フェードは黒へ変化します。切り替えと併用すると黒く暗くなる区間があります。</p>
  </div>
}
