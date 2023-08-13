<template>
  <div class="bills">
    <div class="bill" v-for="item in bills" :key="item.id">
      <div class="modal">
        <el-icon class="item" @click="showBillDetail(item)"><View /></el-icon>
        <el-icon class="item" v-if="item.creator === userInfo.userId" @click="createShareBillCode(item)"><Share /></el-icon>
        <el-icon class="item" v-if="item.creator === userInfo.userId" @click="showDeleteDialog(item)"><Delete /></el-icon>
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
    <el-dialog title="分享码已生成，时长为30分钟" class="delete-bill-dialog" v-model="shareBillDialog">
      <div style="color: #999; word-wrap: break-word">分享码：{{ shareCode }}</div>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="small" type="primary" @click="shareBillDialog = false">确定</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { Share, View, Delete } from '@element-plus/icons-vue'
import { useBill } from './hooks/use-bill'

const {
  $addForm,
  addBillDialog,
  deleteBillDialog,
  shareBillDialog,
  dialogLoading,
  bills,
  form,
  shareCode,
  userInfo,
  showBillDetail,
  showBillDialog,
  showDeleteDialog,
  addBill,
  delBill,
  createShareBillCode,
} = useBill()

const rules = {
  name: [
    {
      validator: (rule, value, callback) => {
        console.log(value)
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
  height: calc(100% - 60px);
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
</style>
