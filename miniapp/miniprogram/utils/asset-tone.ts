/** 资产涨跌色。与移动端 H5 使用同一套色值。 */

export const TONE_UP = '#18a356'
export const TONE_DOWN = '#f74f4f'
export const TONE_FLAT = '#999999'

export type Tone = 'up' | 'down' | 'flat'

/** 不到半分钱视为没有变化。debt 为真时，金额增加用负向色。 */
export function toneOf(value: number | null | undefined, debt = false): Tone {
  if (value == null || Number.isNaN(Number(value)) || Math.abs(Number(value)) < 0.005) return 'flat'
  const positive = Number(value) > 0
  const good = debt ? !positive : positive
  return good ? 'up' : 'down'
}

export function toneColor(tone: Tone) {
  if (tone === 'up') return TONE_UP
  if (tone === 'down') return TONE_DOWN
  return TONE_FLAT
}
