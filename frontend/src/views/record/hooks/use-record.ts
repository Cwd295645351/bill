import { ref, watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import { getUserInfo } from '@/utils/common-info'
import { getRecordList, exportData } from '../api'
import dayjs from 'dayjs'

import type { InformationType } from '../type'
import type { UserInfo } from '@/types/user-info'
import type { Bill, User, CostType, IncomesType, PayMethod } from '@/types/bill'

export const useRecord = () => {
  const store = useBillStore()
  const { bill, costTypeId } = storeToRefs(store)

  const loadingMore = ref(false)
  const noMore = ref(false)

  /** 类型：1=支出；2=收入 */
  const type = ref<InformationType>(1)

  /** 类型名称标识，costTypeName | incomesTypeName */
  const typeName = ref('costTypeName')

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
  })
  /** 记账开始日期限制条件 */
  const beginDateOptions = {
    disabledDate(time: any) {
      if (searchOptions.value.endDate) {
        return time.getTime() > searchOptions.value.endDate
      } else {
        return false
      }
    },
  }
  /** 记账结束日期限制条件 */
  const endDateOptions = {
    disabledDate(time: any) {
      if (searchOptions.value.beginDate) {
        return time.getTime() < searchOptions.value.beginDate
      } else {
        return false
      }
    },
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
  /** 交易明细数据 */
  const listData = ref<any[]>([])
  /** 总数 */
  const totalCount = ref(0)
  /** 当前加载总数 */
  const currentCount = ref(0)
  /** 用户信息 */
  const userInfo = ref<UserInfo>({ accessToken: '', refreshToken: '', userId: '', expiresIn: 0, avatarUrl: '', nickName: '', expenses: 0, incomes: 0 })

  watch(bill, (val) => {
    listData.value = []
    initData(val as Bill)
  })

  watch(type, (val) => {
    typeName.value = val === 1 ? 'costTypeName' : 'incomesTypeName'
  })

  /** 初始化 */
  const initData = (bill: Bill) => {
    users.value = bill.users
    costTypes.value = bill.costTypes
    incomesTypes.value = bill.incomesTypes
    payMethods.value = bill.payMethods

    getList()
  }

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
      remark: options.remark,
      billId: (bill.value as Bill)._id,
    }
    const [err, res] = await getRecordList({ params })
    loadingMore.value = false
    if (err) return
    if (res.retCode === 0) {
      // 构造收支金额时间线
      totalCount.value = res.data.total
      currentCount.value += res.data.datas.length
      const currListData: any = setData(res.data.datas)
      // 获取收支金额数组最后一个日期内容
      const lastData: any = listData.value[listData.value.length - 1]
      if (currListData.length > 0 && lastData?.date === currListData[0]?.date) {
        mergeData(lastData, currListData[0])
        currListData.shift()
      }
      listData.value = listData.value.concat(currListData)
      listData.value.forEach((item: any) => {
        item.datas = item.datas.sort((a: any, b: any) => a.costTypeId - b.costTypeId)
      })
    } else {
      ElMessage.error('查询交易明细失败，' + res.message)
    }
  }

  // 导出交易明细
  const exportExcel = async () => {
    const data = {
      type: type.value,
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
  const load = () => {
    if (totalCount.value === currentCount.value) {
      noMore.value = true
      return
    }
    loadingMore.value = true
    pageContent.value.pageIndex++
    getList()
  }

  /** 统计每日各类型金额及总金额 */
  const setData = (data: any[]) => {
    const arr: any[] = []
    let currDate = '' // 当前正在记录的日期，若存在，则代表已有相关对象
    data.forEach((item) => {
      if (item.date === currDate) {
        // 已存在日期
        const obj = arr[arr.length - 1]
        // 判断是否无需报销且已存在该类型
        if (item.reimbursement === 0) {
          obj.money += item.money
          const type = obj.types.find((type: any) => type.name === item[typeName.value])
          if (type) {
            type.money += item.money
          } else {
            obj.types.push({ name: item[typeName.value], money: item.money })
          }
        }
        obj.datas.push(item)
      } else {
        // 新日期
        currDate = item.date
        const obj: any = {
          date: currDate,
          money: 0,
          types: [],
          datas: [item],
        }
        if (item.reimbursement === 0) {
          // 无需报销时才记录类型
          obj.money = item.money
          obj.types = [{ name: item[typeName.value], money: item.money }]
        }
        arr.push(obj)
      }
    })
    return arr
  }

  /** 合并同一日期的收支金额 */
  const mergeData = (firstData: any, secondData: any) => {
    firstData.money += secondData.money
    firstData.datas.push(...secondData.datas)
    secondData.types.forEach((item: any) => {
      const type = firstData.types.find((type: any) => type.name === item.name)
      if (type) {
        type.money += item.money
      } else {
        firstData.types.push({ name: item.name, money: item.money })
      }
    })
  }

  /** 切换收入/支出类型 */
  const changeAddType = (currType: InformationType) => {
    type.value = currType
    search()
  }

  const search = () => {
    listData.value = []
    pageContent.value.pageIndex = 1
    pageContent.value.pageSize = 60
    getList()
  }

  onMounted(() => {
    console.log(costTypeId.value, 'costType========')
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
    setTimeout(() => {
      listData.value = []
      initData(bill.value as Bill)
    }, 300)
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
  }
}
