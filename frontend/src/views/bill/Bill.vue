<template>
  <div class="bills">
    <div class="bill" v-for="item in bills" :key="item.id">
      <div class="modal">
        <el-icon class="item" @click="showBillDetail(item)" title="进入"><View /></el-icon>
        <el-icon class="item" v-if="item.creator === userInfo.userId" @click="createShareBillCode(item)" title="分享"><Share /></el-icon>
        <el-icon class="item" v-if="item.creator === userInfo.userId" @click="showMembersDialog(item)" title="成员"><User /></el-icon>
        <el-icon class="item" v-if="item.creator === userInfo.userId" @click="showTypeManager(item)" title="管理类型"><Setting /></el-icon>
        <el-icon class="item" v-if="item.creator === userInfo.userId" @click="showDeleteDialog(item)" title="删除"><Delete /></el-icon>
        <el-icon class="item" v-if="item.creator !== userInfo.userId" @click="showQuitDialog(item)" title="退出账本"><SwitchButton /></el-icon>
      </div>
      {{ item.name }}
    </div>
    <div class="bill add-bill" @click="showBillDialog">+</div>
    <el-dialog title="新增账本" class="add-bill-dialog" v-model="addBillDialog">
      <el-form ref="$addForm" :model="form" :rules="rules">
        <el-form-item label="账本名称" label-width="100px" prop="name" style="margin-bottom: 0">
          <el-input v-model="form.name" autocomplete="off"></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="small" :loading="dialogLoading" type="primary" @click="addBill">确定</el-button>
          <el-button size="small" :disabled="dialogLoading" @click="addBillDialog = false">取消</el-button>
        </div>
      </template>
    </el-dialog>
    <el-dialog title="您确定要删除吗？" class="delete-bill-dialog" v-model="deleteBillDialog">
      <div style="color: #999">删除后账本相关数据将无法恢复</div>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="small" :loading="dialogLoading" type="primary" @click="delBill">确定</el-button>
          <el-button size="small" :disabled="dialogLoading" @click="deleteBillDialog = false">取消</el-button>
        </div>
      </template>
    </el-dialog>
    <TypeManager v-model:visible="typeManagerVisible" :bill-id="currentTypeBill" />
    <el-dialog title="分享码已生成，时长为30分钟" class="delete-bill-dialog" v-model="shareBillDialog">
      <div style="color: #999; word-wrap: break-word">分享码：{{ shareCode }}</div>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="small" type="primary" @click="shareBillDialog = false">确定</el-button>
        </div>
      </template>
    </el-dialog>
    <el-dialog title="退出账本" class="delete-bill-dialog" v-model="quitBillDialog">
      <div style="color: #999">退出后将无法再查看该账本，历史记账仍保留在账本中。</div>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="small" :loading="dialogLoading" type="primary" @click="doQuitBill">确定退出</el-button>
          <el-button size="small" :disabled="dialogLoading" @click="quitBillDialog = false">取消</el-button>
        </div>
      </template>
    </el-dialog>
    <el-dialog :title="'成员管理 - ' + currentOperateBill.name" class="members-bill-dialog" v-model="membersDialog">
      <div v-if="membersLoading" style="color: #999">加载中…</div>
      <div v-else-if="!members.length" style="color: #999">暂无成员</div>
      <div v-else class="member-list">
        <div class="member-row" v-for="m in members" :key="m.id">
          <span class="member-name"
            >{{ m.name }}<span v-if="m.id === currentOperateBill.creator" class="tag">创建者</span
            ><span v-else-if="m.id === userInfo.userId" class="tag">我</span></span
          >
          <el-button
            v-if="m.id !== currentOperateBill.creator && m.id !== userInfo.userId"
            size="small"
            type="danger"
            plain
            :loading="dialogLoading"
            @click="removeMember(m)"
            >移除</el-button
          >
        </div>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="small" @click="membersDialog = false">关闭</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { Share, View, Delete, Setting, SwitchButton, User } from '@element-plus/icons-vue'
import { useBill } from './hooks/use-bill'
import TypeManager from '../billtype/TypeManager.vue'

const {
  $addForm,
  addBillDialog,
  deleteBillDialog,
  shareBillDialog,
  quitBillDialog,
  membersDialog,
  members,
  membersLoading,
  typeManagerVisible,
  currentTypeBill,
  dialogLoading,
  bills,
  form,
  shareCode,
  userInfo,
  currentOperateBill,
  showBillDetail,
  showBillDialog,
  showDeleteDialog,
  showQuitDialog,
  doQuitBill,
  showMembersDialog,
  removeMember,
  showTypeManager,
  addBill,
  delBill,
  createShareBillCode,
} = useBill()

const rules = {
  name: [
    {
      validator: (rule: any, value: any, callback: Function) => {
        if (!value) {
          return callback(new Error('请输入账本名称'))
        }
        const reg = /^[\u4E00-\u9FA5A-Za-z0-9_]{3,10}$/
        if (reg.test(value)) {
          callback()
        } else {
          callback(new Error('账本只能包含中文、英文、数字以及下划线，长度在3-10之间'))
        }
      },
      trigger: 'blur',
    },
  ],
}
</script>

<style scoped lang="scss">
.bills {
  flex: 1;
  min-height: 0;
  width: 100%;
  padding: 20px 0 0 20px;
  display: flex;
  align-items: center;
  align-content: flex-start;
  flex-wrap: wrap;
  .bill {
    position: relative;
    width: 200px;
    height: 150px;
    color: #fff;
    padding: 10px;
    margin-right: 20px;
    margin-bottom: 20px;
    border: 1px solid #ddd;
    box-shadow: 2px 2px 2px #eee;
    font-size: 24px;
    background-color: #95c7df;
    border-radius: 4px;
    cursor: pointer;
    .modal {
      position: absolute;
      top: 0;
      left: 0;
      visibility: hidden;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      .item {
        &:hover {
          color: rgba(111, 197, 255, 0.5);
        }
        & + .item {
          margin-left: 10px;
        }
      }
    }
    &:hover {
      .modal {
        visibility: visible;
      }
    }
    &.add-bill {
      background: #fff;
      border-style: dashed;
      color: #999;
      font-size: 40px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }
}
</style>
<style lang="scss">
.add-bill-dialog {
  width: 380px;
}
.delete-bill-dialog {
  width: 380px;
}
.members-bill-dialog {
  width: 420px;
  .member-list {
    max-height: 360px;
    overflow: auto;
  }
  .member-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid #eee;
    .member-name {
      .tag {
        margin-left: 8px;
        font-size: 12px;
        color: #999;
      }
    }
  }
}
</style>
