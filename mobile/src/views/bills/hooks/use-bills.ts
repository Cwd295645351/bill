import { onMounted, ref } from 'vue'
import { showFailToast, showLoadingToast, showConfirmDialog, showSuccessToast } from 'vant'
import router from '@/router'
import { billListApi, shareBillApi, deleteBillApi } from '../api'

import type { Bill } from '../type'

export const useBills = () => {
  /** 账本列表 */
  const billList = ref<Bill[]>([])
  /** 加载 loading */
  const billListLoading = ref(false)

  const showEmpty = ref(false)

  const getBillList = async () => {
    const [err, res] = await billListApi()
    billListLoading.value = false
    if (err) {
      billList.value = []
      showEmpty.value = true
      return
    }
    if (res.retCode === 0) {
      billList.value = res.data
      showEmpty.value = billList.value.length === 0
    } else {
      billList.value = []
      showEmpty.value = true
      showFailToast('获取账本列表失败，' + res.message)
    }
  }

  // position 为关闭时点击的位置
  const billEvent: any = ({ name, position }) => {
    switch (position) {
      case 'left':
      case 'cell':
      case 'outside':
        return true
      case 'right':
        return new Promise((resolve) => {
          showDeleteBillDialog(name)
          resolve(true)
        })
    }
  }

  /** 账本点击，进入账本列表页 */
  const onBillClick = (item: Bill) => {
    sessionStorage.setItem('billId', item._id)
    router.push('/bill-detail')
  }

  /** 删除账本弹窗 */
  const showDeleteBillDialog = (id: string) => {
    showConfirmDialog({
      title: '确定删除吗？',
      message: '删除后账本相关数据将无法恢复',
    }).then(async () => {
      const params = { id }
      showLoadingToast({
        message: '删除中...',
        forbidClick: true,
      })
      const [err, res] = await deleteBillApi({ params })
      if (err) return
      if (res.retCode === 0) {
        showSuccessToast('删除成功！')
        getBillList()
      } else {
        showFailToast('删除失败，' + res.message)
      }
    })
  }

  onMounted(() => {
    sessionStorage.setItem('billId', '')
    getBillList()
  })

  return { billList, showEmpty, billListLoading, getBillList, billEvent, onBillClick }
}
