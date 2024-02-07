import { onMounted, ref } from 'vue'
import { getUserInfo } from '@/utils/common-info'
export const useUserInfo = () => {
  /** 头像 */
  const avatarUrl = ref('')
  /** 昵称 */
  const nickName = ref('')
  /** 总收入 */
  const incomes = ref('0')
  /** 总支出 */
  const expenses = ref('0')

  const init = () => {
    const userInfo = getUserInfo()
    avatarUrl.value = userInfo.avatarUrl
    nickName.value = userInfo.nickName
    incomes.value = userInfo.incomes.toFixed(2)
    expenses.value = userInfo.expenses.toFixed(2)
  }

  onMounted(init)

  return { avatarUrl, nickName, incomes, expenses }
}
