<template>
  <div class="page">
    <van-nav-bar title="我的" fixed placeholder />
    <div class="profile">
      <div class="avatar" @click="onPickAvatar">
        <img v-if="avatarUrl" :src="avatarUrl" alt="" />
        <van-icon v-else name="user-o" size="32" color="#8aa0c2" />
      </div>
      <div class="name">{{ nickName }}</div>
      <div class="muted">账号登录 · 与电脑端同一账号</div>
    </div>

    <van-cell-group inset>
      <van-cell title="总收入" :value="incomes" value-class="income" />
      <van-cell title="总支出" :value="expenses" value-class="cost" />
    </van-cell-group>

    <van-cell-group inset class="mt">
      <van-cell title="修改个人信息" is-link @click="openProfile" />
      <van-cell title="通过邀请码加入" is-link @click="goJoin" />
      <van-cell title="退出登录" is-link @click="onLogout" />
    </van-cell-group>

    <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/gif,image/webp" class="hidden-file" @change="onFileChange" />

    <van-popup v-model:show="profileVisible" position="bottom" round>
      <div class="sheet">
        <van-tabs v-model:active="profileTab">
          <van-tab title="个人资料" name="info">
            <div class="sheet-avatar" @click="onPickAvatar">
              <img v-if="sheetAvatarPreview" :src="sheetAvatarPreview" alt="" />
              <van-icon v-else name="user-o" size="36" color="#8aa0c2" />
            </div>
            <div class="sheet-avatar-tip">未上传时显示默认头像；点击可更换，点下方保存资料</div>
            <van-field v-model="editNick" label="昵称" maxlength="20" placeholder="1～20 位中文、英文、数字或下划线" />
            <div class="sheet-actions">
              <van-button size="small" @click="profileVisible = false">取消</van-button>
              <van-button size="small" type="primary" :loading="savingInfo" @click="saveProfileInfo">保存资料</van-button>
            </div>
          </van-tab>
          <van-tab title="修改密码" name="password">
            <van-field v-model="oldPassword" type="password" label="旧密码" placeholder="请输入当前密码" />
            <van-field v-model="newPassword" type="password" label="新密码" placeholder="至少8位，含大小写与数字" />
            <van-field v-model="confirmPassword" type="password" label="确认密码" placeholder="再次输入新密码" />
            <div class="sheet-actions">
              <van-button size="small" @click="profileVisible = false">取消</van-button>
              <van-button size="small" type="primary" :loading="savingPwd" @click="savePassword">保存密码</van-button>
            </div>
          </van-tab>
        </van-tabs>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import { logout, updateProfile, changePassword, uploadAvatar, getLoginConfig } from '@/api/common'
import { useSessionStore } from '@/stores/session'
import { useBillContextStore } from '@/stores/bill-context'
import { moneyText } from '@/utils/date'
import { encryptPassword } from '@/utils/rsa'

const router = useRouter()
const session = useSessionStore()
const billCtx = useBillContextStore()

const nickName = computed(() => session.userInfo?.nickName || '未命名')
const avatarUrl = computed(() => session.userInfo?.avatarUrl || '')
const incomes = computed(() => moneyText(session.userInfo?.incomes))
const expenses = computed(() => moneyText(session.userInfo?.expenses))

const profileVisible = ref(false)
const profileTab = ref('info')
const sheetAvatarPreview = ref('')
const pendingAvatarFile = ref<File | null>(null)
const editNick = ref('')
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const savingInfo = ref(false)
const savingPwd = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const publicKey = ref('')

function goJoin() {
  router.push({ name: 'join' })
}

function openProfile() {
  profileTab.value = 'info'
  editNick.value = session.userInfo?.nickName || ''
  sheetAvatarPreview.value = session.userInfo?.avatarUrl || ''
  pendingAvatarFile.value = null
  oldPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  profileVisible.value = true
}

function onPickAvatar() {
  fileInput.value?.click()
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files && input.files[0]
  input.value = ''
  if (!file) return
  if (file.size > 10 * 1024 * 1024) {
    showToast('单张照片不能超过 10MB')
    return
  }
  if (sheetAvatarPreview.value && sheetAvatarPreview.value.startsWith('blob:')) {
    try { URL.revokeObjectURL(sheetAvatarPreview.value) } catch { /* ignore */ }
  }
  pendingAvatarFile.value = file
  sheetAvatarPreview.value = URL.createObjectURL(file)
}

async function ensureKey() {
  if (publicKey.value) return publicKey.value
  const res = await getLoginConfig()
  if (res.retCode === 0 && res.data?.publicKey) {
    publicKey.value = res.data.publicKey
    return publicKey.value
  }
  showToast(res.message || '获取加密配置失败')
  return ''
}

async function saveProfileInfo() {
  const nick = editNick.value.trim()
  const nickReg = /^[\u4E00-\u9FA5A-Za-z0-9_]{1,20}$/
  if (!nickReg.test(nick)) {
    showToast('昵称格式不正确')
    return
  }
  const nickChanged = nick !== (session.userInfo?.nickName || '')
  if (!pendingAvatarFile.value && !nickChanged) {
    showToast('没有需要保存的变更')
    return
  }

  savingInfo.value = true
  try {
    if (pendingAvatarFile.value) {
      const body = await uploadAvatar(pendingAvatarFile.value)
      if (body?.retCode !== 0 || !body.data) {
        showToast(body?.message || '头像上传失败')
        return
      }
      session.patchUserInfo({
        nickName: body.data.nickName ?? session.userInfo?.nickName,
        avatarUrl: body.data.avatarUrl ?? session.userInfo?.avatarUrl,
        incomes: body.data.incomes != null ? Number(body.data.incomes) : session.userInfo?.incomes,
        expenses: body.data.expenses != null ? Number(body.data.expenses) : session.userInfo?.expenses,
      })
      pendingAvatarFile.value = null
      sheetAvatarPreview.value = body.data.avatarUrl || sheetAvatarPreview.value
    }

    if (nickChanged) {
      const res = await updateProfile(nick)
      if (res.retCode !== 0) {
        showToast(res.message || '昵称更新失败')
        return
      }
      const data = res.data || {}
      session.patchUserInfo({
        nickName: data.nickName || nick,
        avatarUrl: data.avatarUrl != null ? data.avatarUrl : session.userInfo?.avatarUrl,
        incomes: data.incomes != null ? Number(data.incomes) : session.userInfo?.incomes,
        expenses: data.expenses != null ? Number(data.expenses) : session.userInfo?.expenses,
      })
    }

    showToast('个人资料已更新')
  } catch {
    showToast('保存失败')
  } finally {
    savingInfo.value = false
  }
}

async function savePassword() {
  const oldPwd = oldPassword.value.trim()
  const newPwd = newPassword.value.trim()
  const confirmPwd = confirmPassword.value.trim()
  if (!oldPwd || !newPwd) {
    showToast('请填写旧密码和新密码')
    return
  }
  if (newPwd !== confirmPwd) {
    showToast('两次新密码不一致')
    return
  }
  if (newPwd.length < 8 || !/[a-z]/.test(newPwd) || !/[A-Z]/.test(newPwd) || !/\d/.test(newPwd)) {
    showToast('新密码至少8位且含大小写与数字')
    return
  }

  savingPwd.value = true
  try {
    const key = await ensureKey()
    if (!key) return
    const resPwd = await changePassword(encryptPassword(oldPwd, key), encryptPassword(newPwd, key))
    if (resPwd.retCode !== 0) {
      showToast(resPwd.message || '修改密码失败')
      return
    }
    profileVisible.value = false
    showToast('密码已更新，请重新登录')
    try {
      await logout()
    } catch {
      /* ignore */
    }
    session.clearSession()
    billCtx.clearBillContext()
    router.replace({ name: 'login' })
  } finally {
    savingPwd.value = false
  }
}

async function onLogout() {
  try {
    await showConfirmDialog({ title: '退出登录', message: '退出后需要重新登录才能查看账本' })
  } catch {
    return
  }
  try {
    await logout()
  } catch {
    /* ignore */
  }
  session.clearSession()
  billCtx.clearBillContext()
  showToast('已退出')
  router.replace({ name: 'login' })
}
</script>

<style scoped>
.profile {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28px 16px 20px;
}
.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #e8eef7;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.name {
  margin-top: 12px;
  font-size: 18px;
  font-weight: 600;
}
.muted {
  margin-top: 4px;
  color: #999;
  font-size: 12px;
}
.mt {
  margin-top: 12px;
}
.hidden-file {
  display: none;
}
.sheet {
  padding: 8px 0 24px;
}
.sheet-avatar {
  width: 72px;
  height: 72px;
  margin: 12px auto 4px;
  border-radius: 50%;
  background: #e8eef7;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.sheet-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.sheet-avatar-tip {
  text-align: center;
  color: #999;
  font-size: 12px;
  margin-bottom: 8px;
  padding: 0 16px;
}
.sheet-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
  padding: 0 16px 8px;
}
:deep(.income) {
  color: #07c160;
}
:deep(.cost) {
  color: #f74f4f;
}
</style>
