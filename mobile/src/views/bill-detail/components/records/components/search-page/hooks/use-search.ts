import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import type { Bill, User, CostType, IncomesType, PayMethod } from '@/types/bill'

export const useSearch = () => {
  const store = useBillStore()
  const { billId, bill } = storeToRefs(store)

  /** 显示选择器 */
  const showPicker = ref(false)
  /** 当前选择器配置 */
  const currentPickerOptions = ref({
    type: '',
    options: [],
  })

  /** 查询条件 */
  const searchOptions: any = ref({
    beginDate: '', // 开始时间
    endDate: '', // 结束时间
    userId: '', // 记账人 id
    userName: '', // 记账人名称
    belongUserId: '', // 归属人 id
    belongUserName: '', // 归属人名称
    costTypeId: null, // 支出类型 id
    costTypeName: null, // 支出类型
    incomesTypeId: '', // 收入类型
    incomesTypeName: null, // 支出类型
    payMethodId: '', // 支付方式 id
    payMethodName: '', // 支付方式
    remark: '', // 内容
    conditionId: 'gte',
    conditionName: 'gte',
    rangeMoney: 0,
  })

  const pickerOptionsMap: any = ref({
    /** 记账人配置项 */
    user: [],
    /** 支出类型配置项 */
    costType: [],
    /** 收入类型配置项 */
    incomeType: [],
    /** 支付方式配置项 */
    payMethod: [],
    condition: [
      { name: '>=', id: 'gte' },
      { name: '>', id: 'gt' },
      { name: '<=', id: 'lte' },
      { name: '<', id: 'lt' },
    ],
  })

  /** 初始化数据 */
  const init = () => {
    const billInfo = bill.value as Bill
    const options = pickerOptionsMap.value
    options.user = billInfo.users
    options.costType = billInfo.costTypes
    options.incomesType = billInfo.incomesTypes
    options.payMethod = billInfo.payMethods
  }

  const showPickerAction = (type: 'user' | 'costType' | 'incomeType' | 'payMethod') => {
    currentPickerOptions.value.options = pickerOptionsMap.value[type]
    currentPickerOptions.value.type = type
    showPicker.value = true
  }

  const onConfirmPicker = ({ selectedOptions }) => {
    const idKey = `${currentPickerOptions.value.type}Id`
    const nameKey = `${currentPickerOptions.value.type}Name`
    searchOptions.value[idKey] = selectedOptions[0].id
    searchOptions.value[nameKey] = selectedOptions[0].name
    showPicker.value = false
  }
  onMounted(init)

  return { searchOptions, showPicker, currentPickerOptions, showPickerAction, onConfirmPicker }
}
