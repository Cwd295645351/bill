export type PlanPriority = 1 | 2 | 3

export interface PlanItem {
  id: string
  title: string
  context: string
  priority: PlanPriority
}

/**
 * 按优先级分桶；同档保持 details 遍历顺序，不重排。
 */
export function groupPlansByPriority(details: PlanItem[]): [PlanItem[], PlanItem[], PlanItem[]] {
  const groups: [PlanItem[], PlanItem[], PlanItem[]] = [[], [], []]
  for (const item of details || []) {
    const p = Number(item.priority) as PlanPriority
    if (p === 1 || p === 2 || p === 3) {
      groups[p - 1].push(item)
    }
  }
  return groups
}

export const PLAN_PRIORITY_META = [
  { priority: 1 as PlanPriority, label: '高优先级', color: '#f74f4f' },
  { priority: 2 as PlanPriority, label: '中优先级', color: '#e6a23c' },
  { priority: 3 as PlanPriority, label: '低优先级', color: '#18a356' }
]
