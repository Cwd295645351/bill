import { computed, watch, Ref } from 'vue'
import type { InformationType } from '../type'

/** 下拉框里「全部」选项的值。不用空串：多选框会把空串当成「未选」 */
export const PUBLIC_OPTION = '__public__'

/** 接口名单 → 下拉框的值：空名单显示为「全部」 */
export const toSelectValue = (ids: string[] | undefined) => (ids && ids.length ? [...ids] : [PUBLIC_OPTION])

/**
 * 归属人选择：支出可选「全部」或多名成员，二者互斥；收入只能单选一名成员。
 * @param model 下拉框的值，「全部」为 [PUBLIC_OPTION]
 * @param type 收支类型
 * @param options.selfId 当前用户 id，收入兜底用
 * @param options.watchType 是否随收支切换修正名单（编辑弹窗的类型固定，不需要）
 * @param options.notify 切换收支时是否弹提示
 */
export const useBelongSelect = (
  model: Ref<string[]>,
  type: Ref<InformationType>,
  options: { selfId: () => string; watchType?: boolean; notify?: () => boolean },
) => {
  /** 支出多选：选「全部」清掉成员，选成员清掉「全部」，全部取消回到「全部」 */
  const onExpenseChange = (next: string[]) => {
    const prev = model.value
    if (next.includes(PUBLIC_OPTION) && !prev.includes(PUBLIC_OPTION)) {
      model.value = [PUBLIC_OPTION]
    } else if (next.length > 1 && next.includes(PUBLIC_OPTION)) {
      model.value = next.filter((id) => id !== PUBLIC_OPTION)
    } else if (!next.length) {
      model.value = [PUBLIC_OPTION]
    } else {
      model.value = next
    }
  }

  /** 收入单选 */
  const incomeValue = computed<string>({
    get: () => model.value.find((id) => id !== PUBLIC_OPTION) || '',
    set: (id) => {
      model.value = id ? [id] : []
    },
  })

  /** 提交给接口的名单：「全部」为空数组 */
  const toBelongUserIds = () => model.value.filter((id) => id !== PUBLIC_OPTION)

  if (options.watchType) {
    watch(type, (val, old) => {
      if (val !== 2 || old === 2) return
      const ids = toBelongUserIds()
      if (ids.length === 1) return
      model.value = [options.selfId()]
      if (!options.notify || options.notify()) ElMessage.warning('收入只能选一名归属人，已改为自己')
    })
  }

  return { onExpenseChange, incomeValue, toBelongUserIds }
}
