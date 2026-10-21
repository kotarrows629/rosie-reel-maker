import { expect, it } from 'vitest'
import { composeFrame } from './renderFrame'
it('mixes full images with complementary weights without double darkening', () => {
  const draws: number[] = []
  const ctx = { globalAlpha: 1, globalCompositeOperation: 'source-over', fillStyle: '', fillRect() {}, drawImage(this: { globalAlpha: number }) { draws.push(this.globalAlpha) } } as unknown as CanvasRenderingContext2D
  const canvas = {} as HTMLCanvasElement
  composeFrame(ctx, [{canvas, opacity: 1, blend: 1}, {canvas, opacity: 1, blend: .5}], 900, 1600)
  expect(draws).toEqual([.5,.5])
  expect(ctx.globalAlpha).toBe(1);expect(ctx.globalCompositeOperation).toBe('source-over')
})
it('applies black fades to both images before dissolving', () => {
  const draws: number[] = []
  const ctx = { globalAlpha: 1, globalCompositeOperation: 'source-over', fillStyle: '', fillRect() {}, drawImage(this: { globalAlpha: number }) { draws.push(this.globalAlpha) } } as unknown as CanvasRenderingContext2D
  const canvas = {} as HTMLCanvasElement
  composeFrame(ctx, [{canvas, opacity: .25, blend: 1}, {canvas, opacity: .25, blend: .5}], 900, 1600)
  expect(draws).toEqual([.125,.125])
})
