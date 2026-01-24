import { ref, watch, onMounted, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import { getUserInfo } from '@/utils/common-info'
import { getRecordList, exportData } from '../api'
import dayjs from 'dayjs'

import type { InformationType } from '../type'
import type { UserInfo } from '@/types/user-info'
import type { Bill, User, CostType, IncomesType, PayMethod, RecordItem } from '@/types/bill'

export const useRecord = () => {
  const store = useBillStore()
  const { bill, costTypeId } = storeToRefs(store)

  const loadingMore = ref(false)
  const noMore = ref(false)
  const dateMap = ref(new Map())
  const weekMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

  /** 类型：1=支出；2=收入 */
  const type = ref<InformationType>(1)

  /** 类型名称标识，costTypeName | incomesTypeName */
  const typeName = ref<'costTypeName' | 'incomesTypeName'>('costTypeName')

  /** 查询条件 */
  const searchOptions = ref<any>({
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

  /** 查询金额条件 */
  const conditionOptions = ref([
    { name: '>=', id: 'gte' },
    { name: '>', id: 'gt' },
    { name: '<=', id: 'lte' },
    { name: '<', id: 'lt' },
  ])

  /** 交易明细数据 */
  const listData = computed(() => {
    const res = []
    for (const item of dateMap.value.values()) {
      item.arr = item.arr.sort((a: any, b: any) => {
        if (a.costTypeId - b.costTypeId < 0) return -1
        else if (a.costTypeId - b.costTypeId > 0) return 1
        else return b.money - a.money
      })
      res.push(item)
    }
    return res
  })

  /** 记账开始日期限制条件 */
  const beginDateOptions = (time: Date) => {
    if (searchOptions.value.endDate) {
      return time.getTime() > new Date(searchOptions.value.endDate).getTime()
    } else {
      return false
    }
  }
  /** 记账结束日期限制条件 */
  const endDateOptions = (time: Date) => {
    if (searchOptions.value.beginDate) {
      return time.getTime() < new Date(searchOptions.value.beginDate).getTime()
    } else {
      return false
    }
  }
  const pageContent = ref({ pageIndex: 1, pageSize: 60 })
  /** 记账人配置项 */
  const users = ref<User[]>([])
  /** 支出类型配置项 */
  const costTypes = ref<CostType[]>([])
  /** 收入类型配置项 */
  const incomesTypes = ref<IncomesType[]>([])
  /** 支付方式配置项 */
  const payMethods = ref<PayMethod[]>([])
  /** 总数 */
  const totalCount = ref(0)
  /** 当前加载总数 */
  const currentCount = ref(0)
  /** 用户信息 */
  const userInfo = ref<UserInfo>({ accessToken: '', refreshToken: '', userId: '', expiresIn: 0, avatarUrl: '', nickName: '', expenses: 0, incomes: 0 })

  /** 查询明细列表 */
  const getList = async () => {
    const options = searchOptions.value
    const params = {
      beginDate: options.beginDate,
      endDate: options.endDate,
      userId: options.userId,
      belongUserId: options.belongUserId,
      pageIndex: pageContent.value.pageIndex,
      pageSize: pageContent.value.pageSize,
      type: type.value,
      costTypeId: options.costTypeId,
      payMethodId: options.payMethodId,
      incomesTypeId: options.incomesTypeId,
      condition: options.condition,
      rangeMoney: options.rangeMoney,
      remark: options.remark,
      billId: (bill.value as Bill)._id,
    }
    const [err, res] = await getRecordList({ params })
    loadingMore.value = false
    if (err) return
    if (res.retCode === 0) {
      // 构造收支金额时间线
      totalCount.value = res.data.total
      const data = res.data.datas as RecordItem[]
      data.forEach((item) => {
        let dateMapItem = dateMap.value.get(item.date)
        if (!dateMapItem) {
          dateMapItem = {
            date: item.date,
            week: weekMap[new Date(item.date).getDay()],
            arr: [],
            types: [] as { name: 'costTypeName' | 'incomesTypeName'; money: number }[],
          }
        }
        dateMapItem.arr.push(item)
        const itemTypeName = item[typeName.value]
        const type = dateMapItem.types.find((type: { name: string; money: number }) => type.name === itemTypeName)
        if (type) {
          type.money += item.money
        } else {
          dateMapItem.types.push({ name: itemTypeName, money: item.money })
        }
        dateMap.value.set(item.date, dateMapItem)
      })
    } else {
      ElMessage.error('查询交易明细失败，' + res.message)
    }
  }

  /** 初始化 */
  const initData = async (bill: Bill) => {
    users.value = bill.users
    costTypes.value = bill.costTypes
    incomesTypes.value = bill.incomesTypes
    payMethods.value = bill.payMethods
    dateMap.value.clear()

    await getList()
  }

  watch(
    bill,
    async (val) => {
      if (!val) return
      await initData(val)
    },
    { immediate: true },
  )

  watch(type, (val) => {
    typeName.value = val === 1 ? 'costTypeName' : 'incomesTypeName'
  })

  // 导出交易明细
  const exportExcel = async () => {
    const options = searchOptions.value
    const data = {
      beginDate: options.beginDate,
      endDate: options.endDate,
      userId: options.userId,
      belongUserId: options.belongUserId,
      type: type.value,
      costTypeId: options.costTypeId,
      payMethodId: options.payMethodId,
      incomesTypeId: options.incomesTypeId,
      condition: options.condition,
      rangeMoney: options.rangeMoney,
      remark: options.remark,
      billId: (bill.value as Bill)._id,
    }
    const [err, res] = await exportData({ data })
    if (err) return
    // 使用Blob处理文件流
    const blob = new Blob([res])
    // 通过a标签进行下载
    let downloadElement = document.createElement('a')
    let href = window.URL.createObjectURL(blob)
    downloadElement.href = href
    downloadElement.download = `记账信息${Date.now()}.xlsx`
    document.body.appendChild(downloadElement)
    downloadElement.click()
    document.body.removeChild(downloadElement)
    window.URL.revokeObjectURL(href)
  }

  /** 加载更多数据 */
  const load = async () => {
    if (totalCount.value === currentCount.value) {
      noMore.value = true
      return
    }
    loadingMore.value = true
    pageContent.value.pageIndex++
    await getList()
  }

  /** 切换收入/支出类型 */
  const changeAddType = (currType: InformationType) => {
    type.value = currType
    search()
  }

  const search = () => {
    dateMap.value.clear()
    pageContent.value.pageIndex = 1
    pageContent.value.pageSize = 60
    getList()
  }

  onMounted(() => {
    userInfo.value = getUserInfo()
    if (costTypeId.value !== 0) {
      searchOptions.value.costTypeId = costTypeId.value
      const currDate = new Date()
      /** 获取当前年度的开始日期和结束日期 */
      const currentYear_firstDay = dayjs(currDate).startOf('year').format('YYYY-MM-DD')
      const currentYear_lastDay = dayjs(currDate).endOf('year').format('YYYY-MM-DD')
      searchOptions.value.beginDate = currentYear_firstDay
      searchOptions.value.endDate = currentYear_lastDay
      store.updateState({ key: 'costTypeId', value: 0 })
    }
  })

  return {
    loadingMore,
    noMore,
    type,
    typeName,
    searchOptions,
    beginDateOptions,
    endDateOptions,
    users,
    costTypes,
    incomesTypes,
    payMethods,
    listData,
    userInfo,
    exportExcel,
    load,
    changeAddType,
    search,
    conditionOptions,
  }
}
