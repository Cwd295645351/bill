<template>
  <div class="bill-layout-container">
    <header class="header">
      <div class="title" @click="backToBills">记亿由薪</div>
      <div class="top-menus">
        <div class="menu" :class="{ active: currentMenu === item.value }" v-for="item in menus" :key="item.value" @click="changeMenu(item)">
          {{ item.label }}
        </div>
      </div>
      <el-popover placement="bottom-end" width="240" popper-class="bill-information" trigger="click">
        <div class="name-line">
          <div class="avatar avatar-shell">
            <img v-if="avatarSrc" :src="avatarSrc" alt="" />
            <el-icon v-else class="avatar-fallback" :size="28"><UserFilled /></el-icon>
          </div>
          <div class="nick-name">{{ userInfo.nickName }}</div>
        </div>
        <div class="num-line">
          <div class="item">
            <div class="num">{{ userInfo.expenses.toFixed(2) }}</div>
            <div class="label">总支出</div>
          </div>
          <div class="item">
            <div class="num">{{ userInfo.incomes.toFixed(2) }}</div>
            <div class="label">总收入</div>
          </div>
        </div>
        <div class="updateInfo" @click="showProfileDialog">修改个人信息</div>
        <div class="updateInfo" @click="showJoinBillDialog">加入账本</div>
        <div class="logout" @click="logout">退出登录</div>
        <template #reference>
          <div class="avatar avatar-shell header-avatar">
            <img v-if="avatarSrc" :src="avatarSrc" alt="" />
            <el-icon v-else class="avatar-fallback" :size="26"><UserFilled /></el-icon>
          </div>
        </template>
      </el-popover>
    </header>
    <router-view @changeValue="changeTabValue"></router-view>
    <el-dialog title="加入账本" class="join-bill-dialog" v-model="joinBillDialog">
      <el-form ref="$joinForm" :model="form" :rules="rules">
        <el-form-item label="分享码" label-width="80px" prop="name" style="margin-bottom: 0">
          <el-input v-model="form.name" autocomplete="off"></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="small" :loading="dialogLoading" type="primary" @click="join">确定</el-button>
          <el-button size="small" :disabled="dialogLoading" @click="joinBillDialog = false">取消</el-button>
        </div>
      </template>
    </el-dialog>
    <el-dialog title="修改个人信息" class="profile-dialog" v-model="profileDialog" width="440px" @closed="onProfileDialogClosed">
      <el-tabs v-model="profileTab">
        <el-tab-pane label="个人资料" name="info">
          <el-form :model="profileForm" label-width="88px">
            <el-form-item label="头像">
              <div class="profile-avatar-row">
                <div class="profile-avatar-preview" @click="triggerAvatarPick" title="点击也可选择图片">
                  <img v-if="profileAvatarPreview" :src="profileAvatarPreview" alt="头像预览" />
                  <el-icon v-else class="avatar-fallback" :size="32"><UserFilled /></el-icon>
                </div>
                <div class="profile-avatar-actions">
                  <el-button size="small" @click="triggerAvatarPick">选择图片</el-button>
                  <div class="profile-avatar-hint">未上传时显示默认头像；选图后可预览，点下方保存生效</div>
                </div>
                <input ref="$avatarInput" type="file" accept="image/jpeg,image/png,image/gif,image/webp" style="display: none" @change="onAvatarPicked" />
              </div>
            </el-form-item>
            <el-form-item label="昵称">
              <el-input v-model="profileForm.nickName" maxlength="20" autocomplete="off" placeholder="1～20 位中文、英文、数字或下划线"></el-input>
            </el-form-item>
          </el-form>
          <div class="tab-footer">
            <el-button size="small" :loading="dialogLoading" type="primary" @click="saveProfileInfo">保存资料</el-button>
            <el-button size="small" :disabled="dialogLoading" @click="profileDialog = false">取消</el-button>
          </div>
        </el-tab-pane>
        <el-tab-pane label="修改密码" name="password">
          <el-form :model="passwordForm" label-width="88px">
            <el-form-item label="旧密码">
              <el-input v-model="passwordForm.oldPassword" type="password" show-password autocomplete="off" placeholder="请输入当前密码"></el-input>
            </el-form-item>
            <el-form-item label="新密码">
              <el-input v-model="passwordForm.newPassword" type="password" show-password autocomplete="off" placeholder="至少8位，含大小写与数字"></el-input>
            </el-form-item>
            <el-form-item label="确认密码">
              <el-input v-model="passwordForm.confirmPassword" type="password" show-password autocomplete="off" placeholder="再次输入新密码"></el-input>
            </el-form-item>
          </el-form>
          <div class="tab-footer">
            <el-button size="small" :loading="dialogLoading" type="primary" @click="savePassword">保存密码</el-button>
            <el-button size="small" :disabled="dialogLoading" @click="profileDialog = false">取消</el-button>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { UserFilled } from '@element-plus/icons-vue'
import { useLayout } from './hooks/use-layout'

const {
  $joinForm,
  $avatarInput,
  joinBillDialog,
  profileDialog,
  profileTab,
  dialogLoading,
  form,
  profileForm,
  passwordForm,
  profileAvatarPreview,
  avatarSrc,
  currentMenu,
  menus,
  userInfo,
  changeMenu,
  backToBills,
  logout,
  showJoinBillDialog,
  showProfileDialog,
  saveProfileInfo,
  savePassword,
  triggerAvatarPick,
  onAvatarPicked,
  onProfileDialogClosed,
  join,
  changeTabValue,
} = useLayout()

const rules = {
  name: [
    {
      validator: (rule: any, value: any, callback: any) => {
        if (!value) {
          return callback(new Error('请输入分享码'))
        }
        const reg = /^[A-Za-z0-9]{128}$/
        if (reg.test(value)) {
          callback()
        } else {
          callback(new Error('分享码只包括英文、数字，长度为128位'))
        }
      },
      trigger: 'blur',
    },
  ],
}
</script>

<style scoped lang="scss">
.bill-layout-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  .header {
    height: 60px;
    width: 100%;
    display: flex;
    align-items: center;
    font-size: 20px;
    background-color: #f7f7f7;
    box-shadow: 0px 1px 5px 0 #b9b9b9;
    position: relative;
    .title {
      margin-left: 20px;
      font-size: 24px;
      font-weight: bold;
      cursor: pointer;
      &:hover {
        color: rgb(111, 197, 255);
      }
    }
    .top-menus {
      display: flex;
      align-items: center;
      margin-left: 60px;
      height: 100%;
      .menu {
        height: 100%;
        line-height: 60px;
        cursor: pointer;
        &:hover {
          border-bottom: 5px solid rgba(111, 197, 255, 0.5);
        }
        &.active {
          color: rgb(111, 197, 255);
        }
        & + .menu {
          margin-left: 40px;
        }
      }
    }
    .header-avatar {
      position: absolute;
      right: 20px;
    }
  }
}
</style>
<style lang="scss">
.bill-information {
  width: 200px !important;
  height: 290px;
  color: #333;
  .name-line {
    display: flex;
    align-items: center;
    .avatar {
      width: 55px;
      height: 55px;
    }
    .nick-name {
      flex: 1;
      margin-left: 10px;
      font-size: 16px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
  .num-line {
    display: flex;
    align-items: center;
    padding: 20px 0;
    border-bottom: 1px solid #dddddd80;
    .item {
      flex: 1;
      text-align: center;
      .num {
        font-size: 16px;
      }
      .label {
        margin-top: 5px;
        color: #999;
        font-size: 12px;
      }
    }
  }
  .updateInfo,
  .logout {
    cursor: pointer;
    padding: 10px 0;
    text-align: center;
    &:hover {
      background: #eee;
    }
  }
  .updateInfo {
    border-bottom: 1px solid #dddddd80;
  }
}

.avatar-shell {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: #e8eef7;
  box-shadow: 0 0 5px #ddd;
  overflow: hidden;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .avatar-fallback {
    color: #8aa0c2;
  }
}

.join-bill-dialog {
  width: 380px;
}

.profile-dialog .profile-avatar-row {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
}
.profile-dialog .profile-avatar-preview {
  flex: 0 0 auto;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #e8eef7;
  border: 1px solid #dcdfe6;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.profile-dialog .profile-avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.profile-dialog .profile-avatar-preview .avatar-fallback {
  color: #8aa0c2;
}
.profile-dialog .profile-avatar-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}
.profile-dialog .profile-avatar-hint {
  color: #909399;
  font-size: 12px;
  line-height: 1.4;
}
.profile-dialog .tab-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
}
</style>
