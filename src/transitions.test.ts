import { describe, expect, it } from 'vitest'
import { fadeOpacity, layersAt, normalizePhotos, timeline, totalDuration, type Photo } from './timeline'
import { defaultLayout, dragLayout, photoRect } from './photoLayout'
const photo = (id: string, duration = 1.5, transition = .3): Photo => ({id, name:id, url:`blob:${id}`,duration,transition})
describe('overlap timeline', () => {
  it('subtracts overlap and blends exactly at boundary/midpoint', () => {
    const photos = [photo('a'), photo('b')]
    expect(totalDuration(photos)).toBe(2.7)
    expect(timeline(photos).map(s=>[s.start,s.end,s.overlap])).toEqual([[0,1.5,.3],[1.2,2.7,0]])
    expect(layersAt(photos,1.2).map(l=>l.blend)).toEqual([1,0])
    expect(layersAt(photos,1.35)[1].blend).toBeCloseTo(.5)
    expect(layersAt(photos,1.5).map(l=>l.photo.id)).toEqual(['b'])
    expect(layersAt(photos,2.7)[0].photo.id).toBe('b')
  })
  it('zero overlap switches instantly', () => {
    const photos = [photo('a',1.5,0),photo('b')]
    expect(totalDuration(photos)).toBe(3)
    expect(layersAt(photos,1.5).map(l=>l.photo.id)).toEqual(['b'])
  })
  it('bounds adjacent overlaps so no three images overlap', () => {
    const photos = normalizePhotos([photo('a',.5,20),photo('b',.5,20),photo('c',.5,20)])
    expect(timeline(photos).map(s=>s.overlap)).toEqual([.5,0,0])
    for(let t=0;t<1;t+=.01) expect(layersAt(photos,t).length).toBeLessThanOrEqual(2)
  })
  it('reclamps fades and transitions after duration changes', () => {
    const result=normalizePhotos([photo('a'),{...photo('b',.5),fadeIn:4,fadeOut:4},photo('c')])
    expect(result[1].fadeIn).toBe(.5);expect(result[1].fadeOut).toBe(0)
    expect(result[1].transition).toBe(.2)
  })
  it('disables first fade in and last fade out, preserves internal black fades', () => {
    const photos=[{...photo('a',1,0),fadeIn:1,fadeOut:.5},{...photo('b',1,0),fadeIn:.5,fadeOut:1}]
    const segments=timeline(photos)
    expect(fadeOpacity(segments[0],0,2)).toBe(1)
    expect(fadeOpacity(segments[0],.75,2)).toBeCloseTo(.5)
    expect(fadeOpacity(segments[1],1.25,2)).toBeCloseTo(.5)
    expect(fadeOpacity(segments[1],2,2)).toBe(1)
  })
})
describe('photo positioning', () => {
  it('contains all pixels and keeps contain independent from crop zoom', () => {
    const rect=photoRect(1600,900,900,1600,{...defaultLayout,fit:'contain',zoom:4,x:0})
    expect(rect.width).toBe(900);expect(rect.height).toBe(506.25);expect(rect.y).toBe(546.875)
  })
  it('clamps drag to covered edges and scales the remaining crop correctly', () => {
    const moved=dragLayout(defaultLayout,1600,900,900,1600,100000,100000)
    expect(moved.x).toBe(0);expect(moved.y).toBe(.5)
    const rect=photoRect(900,1600,900,1600,{...defaultLayout,zoom:2,x:1,y:1})
    expect(rect).toEqual({x:-900,y:-1600,width:1800,height:3200})
  })
})
