/** 预算花费进度文案与色阶（对齐 FR-004 / 原型） */

export interface BudgetTone {
  color: string
  label: string
  /** 进度条宽度 0–100，封顶 100 */
  widthPercent: number
  /** 真实花费/预算比例，可 > 1 */
  rate: number
}

/**
 * 根据花费与预算计算状态。
 * @param cost 花费
 * @param budget 预算（须 > 0；为 0 时按较宽裕处理）
 */
export function budgetTone(cost: number, budget: number): BudgetTone {
  const rate = budget > 0 ? Number(cost) / Number(budget) : 0
  const widthPercent = Math.min(100, Math.round(rate * 100))
  let color = '#f74f4f'
  let label = '即将或已经超支'
  if (rate < 0.25) {
    color = '#18a356'
    label = '较宽裕'
  } else if (rate < 0.5) {
    color = '#8bc34a'
    label = '正常'
  } else if (rate < 0.75) {
    color = '#e6a23c'
    label = '注意节奏'
  } else if (rate < 0.9) {
    color = '#f08a24'
    label = '接近上限'
  }
  return { color, label, widthPercent, rate }
}
