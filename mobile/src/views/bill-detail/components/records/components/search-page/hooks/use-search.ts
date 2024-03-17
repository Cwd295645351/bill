import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import type { Bill, User, CostType, IncomesType, PayMethod } from '@/types/bill'

export const useSearch = () => {
  const store = useBillStore()
  const { billId, bill } = storeToRefs(store)
  /** 查询条件 */
  const searchOptions = ref({
    beginDate: '', // 开始时间
    endDate: '', // 结束时间
    userId: '', // 记账人id
    belongUserId: '', // 归属人id
    costTypeId: null, // 支出类型
    incomesTypeId: '', // 收入类型
    payMethodId: '', // 支付方式
    remark: '', // 内容
    condition: 'gte',
    rangeMoney: 0,
  })

  /** 记账人配置项 */
  const users = ref<User[]>([])
  /** 支出类型配置项 */
  const costTypes = ref<CostType[]>([])
  /** 收入类型配置项 */
  const incomesTypes = ref<IncomesType[]>([])
  /** 支付方式配置项 */
  const payMethods = ref<PayMethod[]>([])

  /** 查询金额条件 */
  const conditionOptions = ref([
    { name: '>=', id: 'gte' },
    { name: '>', id: 'gt' },
    { name: '<=', id: 'lte' },
    { name: '<', id: 'lt' },
  ])

  /** 初始化数据 */
  const init = () => {
    const billInfo = bill.value as Bill
    users.value = billInfo.users
    costTypes.value = billInfo.costTypes
    incomesTypes.value = billInfo.incomesTypes
    payMethods.value = billInfo.payMethods
  }

  /** 重置数据 */
  const resetData = () => {}

  onMounted(init)

  return { searchOptions, users, costTypes, incomesTypes, payMethods, conditionOptions }
}
