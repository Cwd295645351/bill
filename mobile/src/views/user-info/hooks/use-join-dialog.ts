import { ref } from 'vue'
import { showFailToast, showLoadingToast, showSuccessToast } from 'vant'
import { joinBill } from '../api'

export const useJoinDialog = () => {
  /** 加入弹窗 */
  const joinDialogVisible = ref(false)
  /** 分享码 */
  const shareCode = ref('')
  /** loading */
  const joinLoading = ref(false)

  const showJoinDialog = () => {
    shareCode.value = ''
    joinDialogVisible.value = true
  }

  const confirmJoin = async () => {
    const data = { code: shareCode.value }
    joinLoading.value = true
    showLoadingToast({
      message: '加入中...',
      forbidClick: true,
    })
    const [err, res] = await joinBill({ data })
    joinLoading.value = false
    if (err) return
    if (res.retCode === 0) {
      showSuccessToast('加入成功！')
    } else {
      showFailToast('加入失败，' + res.message)
    }
  }

  const cancelJoin = () => {
    joinDialogVisible.value = false
  }

  return { joinDialogVisible, shareCode, showJoinDialog, cancelJoin, confirmJoin }
}
