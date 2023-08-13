import { ref, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import * as echarts from 'echarts'
import { getBudgetList, budgetAdd, budgetEdit, budgetDelete } from '../api'

import type { Bill, CostType, BudgetDetail } from '@/types/bill'

export const useBudget = () => {
  const store = useBillStore()
  const { bill, billId } = storeToRefs(store)

  const $editForm = ref()
  const $addForm = ref()

  const editDialog = ref(false)
  const editBudgetObj = ref<BudgetDetail>({ costTypeId: '', costTypeName: '', budget: 0, cost: 0, _id: '' })
  const btnLoading = ref(false)
  const deleteDialog = ref(false)
  const deleteObj = ref<BudgetDetail>({ costTypeId: '', costTypeName: '', budget: 0, cost: 0, _id: '' })
  /** 总预算 */
  const totalBudget = ref('0')
  /** 总支出 */
  const totalCost = ref('0')
  /** 当前年度 */
  const year = ref(0)
  /** 支出类型配置项 */
  const costTypes = ref<CostType[]>([])
  const addInformation = ref({ costTypeId: '', money: 0 })
  /** 预算明细列表 */
  const budgetDetails = ref<BudgetDetail[]>([])
  const chart = ref<any>(null)
  const options = ref<any>({
    title: {
      text: '各支出类型预算占比',
      left: 'center',
      top: 100,
      textStyle: {
        fontSize: 24,
      },
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}({d}%)',
    },
    legend: {
      orient: 'horizontal',
      type: 'scroll',
      bottom: 100,
    },
    series: [
      {
        name: '各支出类型占比',
        type: 'pie',
        radius: '50%',
        data: [],
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
      },
    ],
  })

  watch(
    bill,
    (val) => {
      costTypes.value = (val as Bill).costTypes
    },
    { immediate: true },
  )

  /** 预算背景颜色 */
  const costColor = (item: BudgetDetail) => {
    const costPercent = item.costPercent as number
    if (costPercent < 0.25) return '#33e392'
    else if (costPercent < 0.5) return '#f5d746'
    else if (costPercent < 0.75) return '#ff9800'
    else if (costPercent < 0.9) return '#ff5722'
    else return 'red'
  }

  /** 获取当前年度预算详情 */
  const getDetail = async () => {
    const params = { date: year.value, billId: billId.value }
    const [err, res] = await getBudgetList({ params })
    options.value.series[0].data = []
    const seriesData = options.value.series[0].data
    if (err) return
    if (res.retCode === 0) {
      console.log(res)
      const data = res.data
      totalBudget.value = data.totalBudget.toFixed(2)
      totalCost.value = data.currCost.toFixed(2)
      budgetDetails.value = data.details.map((item: BudgetDetail) => {
        seriesData.push({ value: item.budget, name: item.costTypeName })
        const costPercent = item.cost / item.budget
        item.costPercent = costPercent > 1 ? 1 : costPercent
        item.cost = Number(item.cost.toFixed(2))
        item.budget = Number(item.budget.toFixed(2))
        return item
      })
      chart.value.setOption(options.value, true)
    } else {
      ElMessage.error('获取当前年度预算失败，' + res.message)
    }
  }

  /** 新增预算 */
  const addBudget = () => {
    $addForm.value.validate(async (valid: boolean) => {
      if (valid) {
        const data = { date: year.value, billId: billId.value, costTypeId: addInformation.value.costTypeId, money: addInformation.value.money }

        btnLoading.value = true
        const [err, res] = await budgetAdd({ data })
        btnLoading.value = false
        if (err) return
        if (res.retCode === 0) {
          ElMessage.success('新增预算成功')
          getDetail()
        } else {
          ElMessage.error('新增预算失败，' + res.message)
        }
      } else {
        return false
      }
    })
  }

  /** 显示编辑弹窗 */
  const showEdit = (item: BudgetDetail) => {
    editBudgetObj.value = JSON.parse(JSON.stringify(item))
    editDialog.value = true
  }

  /** 编辑预算 */
  const submitEditBudget = () => {
    $editForm.value.validate(async (valid: boolean) => {
      if (valid) {
        const data = { date: year.value, billId: billId.value, id: editBudgetObj.value._id, money: editBudgetObj.value.budget }
        btnLoading.value = true
        const [err, res] = await budgetEdit({ data })
        btnLoading.value = false
        editDialog.value = false
        if (err) return
        if (res.retCode === 0) {
          ElMessage.success('编辑预算成功')
          getDetail()
        } else {
          ElMessage.error('编辑预算失败，' + res.message)
        }
      } else {
        return false
      }
    })
  }

  /** 显示删除弹窗 */
  const showDelete = (item: BudgetDetail) => {
    deleteObj.value = item
    deleteDialog.value = true
  }

  /** 删除预算 */
  const submitDeleteBudget = async () => {
    const params = { date: year.value, billId: billId.value, id: deleteObj.value._id }
    btnLoading.value = true
    const [err, res] = await budgetDelete({ params })
    btnLoading.value = false
    if (err) return
    deleteDialog.value = false
    if (res.retCode === 0) {
      ElMessage.success('删除预算成功')
      getDetail()
    } else {
      ElMessage.error('删除预算失败，' + res.message)
    }
  }

  onMounted(() => {
    chart.value = echarts.init(document.getElementById('budgetStatistics') as HTMLElement)
    year.value = new Date().getFullYear()
    getDetail()
  })

  return {
    $addForm,
    $editForm,
    editDialog,
    editBudgetObj,
    btnLoading,
    deleteDialog,
    deleteObj,
    totalBudget,
    totalCost,
    year,
    costTypes,
    addInformation,
    budgetDetails,
    costColor,
    getDetail,
    addBudget,
    showEdit,
    submitEditBudget,
    showDelete,
    submitDeleteBudget,
  }
}
