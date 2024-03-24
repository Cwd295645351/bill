import { computed, onMounted, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import { showFailToast, showLoadingToast, showConfirmDialog, showSuccessToast } from 'vant'
import { getRecordListApi } from '../../../api'
import type { Bill } from '@/types/bill'
import type { RecordItem } from '../../../type'

export const useSearch = () => {
  const store = useBillStore()
  const { billId, bill } = storeToRefs(store)

  const showSearchCondition = ref(false)

  /** 显示选择器 */
  const showSelectPicker = ref(false)
  /** 下拉选择器配置 */
  const currentPickerOptions = ref({
    type: '',
    options: [],
  })

  const weekMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

  /** 显示日期选择器 */
  const showDatePicker = ref(false)
  /** 日期选择器配置 */
  const datePickerType = ref<'beginDate' | 'endDate'>('beginDate')

  /** 查询条件 */
  const searchOptions: any = ref({
    beginDate: '', // 开始时间
    endDate: '', // 结束时间
    remark: '', // 内容
    type: 1, // 类型 1-支出 2-收入
    userId: '', // 记账人 id
    userName: '', // 记账人名称
    belongUserId: '', // 归属人 id
    belongUserName: '', // 归属人名称
    incomesTypeId: '', // 收入类型
    incomesTypeName: '', // 支出类型
    costTypeId: '', // 支出类型 id
    costTypeName: '', // 支出类型
    payMethodId: '', // 支付方式 id
    payMethodName: '', // 支付方式

    conditionId: 'gte',
    conditionName: '大于等于',
    rangeMoney: 0,
  })

  const pageIndex = ref(1)
  const pageSize = ref(20)
  const dateMap = ref(new Map())
  const total = ref(0)

  const searchList = computed(() => {
    const res = []
    for (const item of dateMap.value.values()) {
      res.push(item)
    }
    return res
  })

  watch(
    () => searchOptions.value.type,
    (type) => {
      if (type === 1) {
        searchOptions.value.costTypeId = ''
        searchOptions.value.costTypeName = ''
        searchOptions.value.payMethodId = ''
        searchOptions.value.payMethodName = ''
      } else {
        searchOptions.value.incomesTypeId = ''
        searchOptions.value.incomesTypeName = ''
      }
    },
  )

  const pickerOptionsMap: any = ref({
    /** 记账人配置项 */
    user: [],
    /** 支出类型配置项 */
    costType: [],
    /** 收入类型配置项 */
    incomeType: [],
    /** 支付方式配置项 */
    payMethod: [],
    /** 归属人配置项 */
    belongUser: [],
    /** 比较条件配置项 */
    condition: [
      { name: '大于等于', id: 'gte' },
      { name: '大于', id: 'gt' },
      { name: '小于等于', id: 'lte' },
      { name: '小于', id: 'lt' },
    ],
  })

  /** 初始化数据 */
  const init = () => {
    const billInfo = bill.value as Bill
    const options = pickerOptionsMap.value
    options.user = billInfo.users
    options.belongUser = [{ id: '', name: '全部' }].concat(billInfo.users)
    options.costType = billInfo.costTypes
    options.incomesType = billInfo.incomesTypes
    options.payMethod = billInfo.payMethods
    dateMap.value.clear()
  }

  const showPickerAction = (type: 'user' | 'costType' | 'incomeType' | 'payMethod' | 'belongUser' | 'condition') => {
    currentPickerOptions.value.options = pickerOptionsMap.value[type]
    currentPickerOptions.value.type = type
    showSelectPicker.value = true
  }

  /** 下拉选择器确认 */
  const onConfirmPicker = ({ selectedOptions }) => {
    const idKey = `${currentPickerOptions.value.type}Id`
    const nameKey = `${currentPickerOptions.value.type}Name`
    searchOptions.value[idKey] = selectedOptions[0].id
    searchOptions.value[nameKey] = selectedOptions[0].name
    showSelectPicker.value = false
  }

  /** 显示日期选择器 */
  const showDatePickerAction = (type: 'beginDate' | 'endDate') => {
    datePickerType.value = type
    showDatePicker.value = true
  }

  /** 日期选择器确认 */
  const onConfirmDatePicker = ({ selectedValues }) => {
    const value = selectedValues.join('-')
    if (datePickerType.value === 'beginDate') {
      searchOptions.value.beginDate = value
    } else {
      searchOptions.value.endDate = value
    }
    showDatePicker.value = false
  }

  const initSearch = () => {
    dateMap.value.clear()
    searchDatas()
  }

  /** 查询数据 */
  const searchDatas = async () => {
    const options = searchOptions.value
    const { beginDate, endDate, userId, belongUserId, type, payMethodId, incomesType, conditionId, rangeMoney, remark } = options
    const params = {
      beginDate,
      endDate,
      userId,
      belongUserId,
      type,
      payMethodId,
      incomesType,
      condition: conditionId,
      rangeMoney,
      remark,
      billId: billId.value,
      pageIndex: pageIndex.value,
      pageSize: pageSize.value,
    }
    const [err, res] = await getRecordListApi({ params })
    if (err) return
    if (res.retCode === 0) {
      const data = res.data.datas as RecordItem[]
      data.forEach((item) => {
        let dateMapItem = dateMap.value.get(item.date)
        if (!dateMapItem) {
          dateMapItem = {
            date: dayjs(item.date).format('YYYY年MM月DD日'),
            week: weekMap[new Date(item.date).getDay()],
            arr: [item],
            cost: 0,
            incomes: 0,
          }
        }
        dateMapItem.arr.push(item)
        if (item.type === 1) {
          dateMapItem.cost += item.money
        } else {
          dateMapItem.incomes += item.money
        }
        dateMap.value.set(item.date, dateMapItem)
      })
      console.log(dateMap)
      total.value = res.data.total
    } else {
      showFailToast('搜索账本数据失败，' + res.message)
    }
    showSearchCondition.value = false
  }

  onMounted(init)

  return {
    showSearchCondition,
    searchList,
    searchOptions,
    showSelectPicker,
    showDatePicker,
    currentPickerOptions,
    showPickerAction,
    onConfirmPicker,
    showDatePickerAction,
    onConfirmDatePicker,
    searchDatas,
    initSearch,
  }
}
