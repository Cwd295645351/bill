import { ref, watch, onMounted, computed, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import { getUserInfo } from '@/utils/common-info'
import { getRecordList, exportData } from '../api'
import dayjs from 'dayjs'
import { formatDate, dayStartTs, dayEndTs } from '@/utils/dateUtil'

import type { InformationType } from '../type'
import type { UserInfo } from '@/types/user-info'
import type { Bill, User, CostType, IncomesType, PayMethod, RecordItem } from '@/types/bill'

/** 列表加载方式：最新一页、向更早、向更新、定位到某日 */
type LoadKind = 'latest' | 'older' | 'newer' | 'anchor'

interface LoadMode {
  kind: LoadKind
  cursorDate?: number
  cursorId?: string
  anchorDate?: number | string
  withMonthSummary?: boolean
}

interface DateCursor {
  date: number
  id: string
}

interface MonthSummary {
  month: string
  count: number
  money: number
}

/** 搜索框的归属人单选值 → 接口筛选名单。「全部」或清空为空数组，表示不限归属人 */
const toBelongFilter = (belongUserId: string | null | undefined) => (belongUserId ? [belongUserId] : [])

/** 同一天内 id 更大者在 date DESC, id DESC 中更靠前 */
const isNewerCursor = (a: DateCursor, b: DateCursor) => {
  if (a.date !== b.date) return a.date > b.date
  return a.id > b.id
}

export const useRecord = () => {
  const store = useBillStore()
  const { bill, costTypeId } = storeToRefs(store)

  const loadingMore = ref(false)
  /** 当前正在加载的方向，用于区分顶部/底部提示 */
  const loadingDirection = ref<'older' | 'newer' | ''>('')
  const hasOlder = ref(false)
  const hasNewer = ref(false)
  const dateMap = ref(new Map())
  const weekMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const pageSize = 60
  /** 已加载窗口两端，用于向上/向下继续请求 */
  const newestCursor = ref<DateCursor | null>(null)
  const oldestCursor = ref<DateCursor | null>(null)
  /** 各月合计，随查询条件变化，不随翻页变少 */
  const monthSummaries = ref<MonthSummary[]>([])
  /** 已收起的月份，key 为 YYYY-MM */
  const collapsedMonths = ref<Set<string>>(new Set())
  /** 定位日期（时间戳） */
  const locateDate = ref<number | string>('')
  const scrollbarRef = ref<any>()
  /** 列表会话号，查询或定位后丢弃过期响应 */
  let listToken = 0
  /** 向前插入后短暂忽略滚动，避免还原位置时连环加载 */
  let ignoreScroll = false

  /** 类型：1=支出；2=收入 */
  const type = ref<InformationType>(1)

  /** 类型名称标识，costTypeName | incomesTypeName */
  const typeName = ref<'costTypeName' | 'incomesTypeName'>('costTypeName')

  /** 查询条件 */
  const searchOptions = ref<any>({
    beginDate: '' as number | '', // 开始时间（时间戳）
    endDate: '' as number | '', // 结束时间（时间戳）
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
    { name: '=', id: 'eq' },
    { name: '<=', id: 'lte' },
    { name: '<', id: 'lt' },
  ])

  /** 交易明细数据（禁止在 computed 内就地修改 dateMap，否则会触发递归更新） */
  const listData = computed(() => {
    const res = []
    for (const item of dateMap.value.values()) {
      const sortedArr = [...item.arr].sort((a: any, b: any) => {
        if (a.costTypeId - b.costTypeId < 0) return -1
        else if (a.costTypeId - b.costTypeId > 0) return 1
        else return b.money - a.money
      })
      res.push({ ...item, arr: sortedArr })
    }
    res.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    return res
  })

  /** 按月分组。日期仍从新到旧，收起某月只隐藏该月明细 */
  const monthGroups = computed(() => {
    const groups: {
      month: string
      label: string
      count: number
      money: number
      days: Array<(typeof listData.value)[number] & { reverse: boolean }>
    }[] = []
    let dayIndex = 0
    for (const day of listData.value) {
      const month = day.date.slice(0, 7)
      let group = groups[groups.length - 1]
      if (!group || group.month !== month) {
        const summary = monthSummaries.value.find((item) => item.month === month)
        group = {
          month,
          label: dayjs(month).format('YYYY年MM月'),
          count: summary?.count ?? 0,
          money: summary?.money ?? 0,
          days: [],
        }
        groups.push(group)
      }
      group.days.push({ ...day, reverse: dayIndex % 2 === 1 })
      dayIndex++
      if (!monthSummaries.value.some((item) => item.month === month)) {
        group.count += day.arr.length
        group.money += day.arr.reduce((sum: number, row: RecordItem) => sum + Number(row.money), 0)
      }
    }
    return groups
  })

  /** 记账开始日期限制条件 */
  const beginDateOptions = (time: Date) => {
    if (searchOptions.value.endDate) {
      return time.getTime() > Number(searchOptions.value.endDate)
    }
    return false
  }
  /** 记账结束日期限制条件 */
  const endDateOptions = (time: Date) => {
    if (searchOptions.value.beginDate) {
      return time.getTime() < Number(searchOptions.value.beginDate)
    }
    return false
  }
  /** 记账人配置项 */
  const users = ref<User[]>([])
  /** 支出类型配置项 */
  const costTypes = ref<CostType[]>([])
  /** 收入类型配置项 */
  const incomesTypes = ref<IncomesType[]>([])
  /** 支付方式配置项 */
  const payMethods = ref<PayMethod[]>([])
  /** 是否已完成至少一次列表请求（避免首次请求前误显示「没有更多」） */
  const listFetchedOnce = ref(false)
  /** 用户信息 */
  const userInfo = ref<UserInfo>({ accessToken: '', refreshToken: '', userId: '', expiresIn: 0, avatarUrl: '', nickName: '', expenses: 0, incomes: 0 })

  /** 记录窗口两端游标 */
  const rememberCursor = (item: RecordItem) => {
    const point = { date: Number(item.date), id: item.id }
    if (!newestCursor.value || isNewerCursor(point, newestCursor.value)) newestCursor.value = point
    if (!oldestCursor.value || isNewerCursor(oldestCursor.value, point)) oldestCursor.value = point
  }

  /** 合并一页记录。同一 id 不重复计入类型合计 */
  const appendRecords = (records: RecordItem[]) => {
    records.forEach((item) => {
      const dateKey = formatDate(item.date)
      let dateMapItem = dateMap.value.get(dateKey)
      if (!dateMapItem) {
        dateMapItem = {
          date: dateKey,
          week: weekMap[dayjs(item.date).day()],
          arr: [],
          types: [] as { name: string; money: number }[],
        }
        dateMap.value.set(dateKey, dateMapItem)
      }
      if (dateMapItem.arr.some((row: RecordItem) => row.id === item.id)) return
      dateMapItem.arr.push(item)
      const itemTypeName = item[typeName.value]
      const typeItem = dateMapItem.types.find((row: { name: string; money: number }) => row.name === itemTypeName)
      if (typeItem) {
        typeItem.money += item.money
      } else {
        dateMapItem.types.push({ name: itemTypeName, money: item.money })
      }
      rememberCursor(item)
    })
  }

  /** 清空当前窗口并开启新的列表会话 */
  const beginListSession = () => {
    listToken++
    dateMap.value = new Map()
    newestCursor.value = null
    oldestCursor.value = null
    hasOlder.value = false
    hasNewer.value = false
    listFetchedOnce.value = false
    loadingMore.value = false
    loadingDirection.value = ''
    return listToken
  }

  /** 查询明细列表 */
  const getList = async (mode: LoadMode) => {
    const token = listToken
    const options = searchOptions.value
    const params: Record<string, unknown> = {
      beginDate: options.beginDate ? dayStartTs(options.beginDate) : '',
      endDate: options.endDate ? dayEndTs(options.endDate) : '',
      userId: options.userId,
      belongUserIds: toBelongFilter(options.belongUserId),
      pageSize,
      type: type.value,
      costTypeId: options.costTypeId,
      payMethodId: options.payMethodId,
      incomesTypeId: options.incomesTypeId,
      condition: options.condition,
      rangeMoney: options.rangeMoney,
      remark: options.remark,
      billId: (bill.value as Bill).id,
      withMonthSummary: !!mode.withMonthSummary,
    }
    if (mode.kind === 'anchor' && mode.anchorDate) {
      params.anchorDate = dayEndTs(mode.anchorDate)
    } else {
      params.direction = mode.kind
    }
    if (mode.cursorDate != null) params.cursorDate = mode.cursorDate
    if (mode.cursorId) params.cursorId = mode.cursorId

    const [err, res] = await getRecordList({ data: params })
    if (token !== listToken) return
    loadingMore.value = false
    loadingDirection.value = ''
    if (err) return
    if (res.retCode === 0) {
      listFetchedOnce.value = true
      appendRecords((res.data.datas || []) as RecordItem[])
      if (mode.kind === 'older') {
        hasOlder.value = !!res.data.hasOlder
      } else if (mode.kind === 'newer') {
        hasNewer.value = !!res.data.hasNewer
      } else {
        hasOlder.value = !!res.data.hasOlder
        hasNewer.value = !!res.data.hasNewer
      }
      if (mode.withMonthSummary) {
        monthSummaries.value = res.data.monthSummaries || []
      }
    } else {
      ElMessage.error('查询交易明细失败，' + res.message)
    }
  }

  /** 滚动容器。兼容不同版本 Element Plus 的暴露字段 */
  const getWrap = () => {
    const bar = scrollbarRef.value
    return (bar?.wrapRef || bar?.wrap$) as HTMLElement | undefined
  }

  /** 内容高度不足以滚动时，继续把更早的月份拉出来 */
  const ensureFill = async () => {
    await nextTick()
    const wrap = getWrap()
    if (!wrap || wrap.clientHeight <= 0 || loadingMore.value || !hasOlder.value || !oldestCursor.value) return
    if (wrap.scrollHeight > wrap.clientHeight + 40) return
    const prev = oldestCursor.value
    await loadOlder()
    if (oldestCursor.value?.date === prev.date && oldestCursor.value?.id === prev.id) return
    await ensureFill()
  }

  /** 初始化 */
  const initData = async (billInfo: Bill) => {
    users.value = billInfo.users
    costTypes.value = billInfo.costTypes || []
    incomesTypes.value = billInfo.incomesTypes || []
    payMethods.value = billInfo.payMethods || []
    collapsedMonths.value = new Set()
    beginListSession()
    await getList({ kind: 'latest', withMonthSummary: true })
    await ensureFill()
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
      beginDate: options.beginDate ? dayStartTs(options.beginDate) : '',
      endDate: options.endDate ? dayEndTs(options.endDate) : '',
      userId: options.userId,
      belongUserIds: toBelongFilter(options.belongUserId),
      type: type.value,
      costTypeId: options.costTypeId,
      payMethodId: options.payMethodId,
      incomesTypeId: options.incomesTypeId,
      condition: options.condition,
      rangeMoney: options.rangeMoney,
      remark: options.remark,
      billId: (bill.value as Bill).id,
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

  /** 向下加载更早记录 */
  const loadOlder = async () => {
    if (!listFetchedOnce.value || loadingMore.value || !hasOlder.value || !oldestCursor.value) return
    loadingMore.value = true
    loadingDirection.value = 'older'
    await getList({
      kind: 'older',
      cursorDate: oldestCursor.value.date,
      cursorId: oldestCursor.value.id,
    })
  }

  /** 向上加载更新记录，并保持当前视口不跳动 */
  const loadNewer = async () => {
    if (!listFetchedOnce.value || loadingMore.value || !hasNewer.value || !newestCursor.value) return
    const wrap = getWrap()
    const prevHeight = wrap?.scrollHeight ?? 0
    const prevTop = wrap?.scrollTop ?? 0
    loadingMore.value = true
    loadingDirection.value = 'newer'
    await getList({
      kind: 'newer',
      cursorDate: newestCursor.value.date,
      cursorId: newestCursor.value.id,
    })
    await nextTick()
    if (wrap) {
      ignoreScroll = true
      wrap.scrollTop = prevTop + (wrap.scrollHeight - prevHeight)
      requestAnimationFrame(() => {
        ignoreScroll = false
      })
    }
  }

  /** 滚动到两端时继续加载 */
  const onScroll = async (payload?: { scrollTop?: number }) => {
    if (ignoreScroll || loadingMore.value) return
    const wrap = getWrap()
    if (!wrap) return
    const scrollTop = typeof payload?.scrollTop === 'number' ? payload.scrollTop : wrap.scrollTop
    const distanceToBottom = wrap.scrollHeight - scrollTop - wrap.clientHeight
    if (scrollTop < 80 && hasNewer.value) {
      await loadNewer()
    } else if (distanceToBottom < 120 && hasOlder.value) {
      await loadOlder()
    }
  }

  /** 把指定日期滚到可视区域靠上位置 */
  const scrollToDate = (date: string) => {
    const wrap = getWrap()
    const el = wrap?.querySelector(`[data-date="${date}"]`) as HTMLElement | null
    if (!wrap || !el) return false
    const top = el.getBoundingClientRect().top - wrap.getBoundingClientRect().top + wrap.scrollTop
    ignoreScroll = true
    scrollbarRef.value.setScrollTop(Math.max(top - 12, 0))
    requestAnimationFrame(() => {
      ignoreScroll = false
    })
    return true
  }

  /** 定位到所选日期，并展开所在月份 */
  const locateToDate = async () => {
    if (!locateDate.value) {
      ElMessage.warning('请选择日期')
      return
    }
    const month = dayjs(Number(locateDate.value)).format('YYYY-MM')
    const nextCollapsed = new Set(collapsedMonths.value)
    nextCollapsed.delete(month)
    collapsedMonths.value = nextCollapsed
    beginListSession()
    await getList({ kind: 'anchor', anchorDate: locateDate.value, withMonthSummary: true })
    await nextTick()
    const target = formatDate(locateDate.value)
    if (!scrollToDate(target)) {
      const nearest = listData.value.find((day) => day.date <= target) || listData.value[listData.value.length - 1]
      if (nearest && scrollToDate(nearest.date)) {
        ElMessage.info('该日期暂无明细，已定位到最近记录')
      } else if (!listData.value.length) {
        ElMessage.info('该日期暂无明细')
      }
    }
    await ensureFill()
  }

  /** 收起或展开某月。收起后若视口空出，继续加载更早月份 */
  const toggleMonth = async (month: string) => {
    const next = new Set(collapsedMonths.value)
    const willCollapse = !next.has(month)
    if (willCollapse) next.add(month)
    else next.delete(month)
    collapsedMonths.value = next
    if (willCollapse) await ensureFill()
  }

  /** 切换收入/支出类型 */
  const changeAddType = (currType: InformationType) => {
    type.value = currType
    search()
  }

  const search = async () => {
    collapsedMonths.value = new Set()
    beginListSession()
    await getList({ kind: 'latest', withMonthSummary: true })
    await ensureFill()
  }

  onMounted(() => {
    userInfo.value = getUserInfo()
    if (costTypeId.value !== 0) {
      searchOptions.value.costTypeId = costTypeId.value
      const currDate = new Date()
      /** 获取当前年度的开始日期和结束日期 */
      searchOptions.value.beginDate = dayjs(currDate).startOf('year').valueOf()
      searchOptions.value.endDate = dayjs(currDate).endOf('year').valueOf()
      store.updateState({ key: 'costTypeId', value: 0 })
    }
  })

  return {
    loadingMore,
    loadingDirection,
    hasOlder,
    hasNewer,
    listFetchedOnce,
    type,
    typeName,
    searchOptions,
    beginDateOptions,
    endDateOptions,
    users,
    costTypes,
    incomesTypes,
    payMethods,
    monthGroups,
    collapsedMonths,
    locateDate,
    scrollbarRef,
    userInfo,
    exportExcel,
    onScroll,
    locateToDate,
    toggleMonth,
    changeAddType,
    search,
    conditionOptions,
  }
}
