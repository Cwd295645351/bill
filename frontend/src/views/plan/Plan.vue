<template>
  <div class="plan-module">
    <!-- 新增弹窗按钮 -->
    <div class="tool-container">
      <el-popover placement="right-start" :width="240" trigger="click" @before-enter="reset">
        <template #reference>
          <div class="item">新增</div>
        </template>
        <el-form :model="info" ref="$addForm" :rules="rules" class="form-container" labelPosition="top">
          <el-form-item prop="title" required size="small" label="标题">
            <el-input v-model="info.title" clearable placeholder="请输入"></el-input>
          </el-form-item>
          <el-form-item prop="context" required size="small" label="内容">
            <el-input v-model="info.context" clearable placeholder="请输入"></el-input>
          </el-form-item>
          <el-form-item prop="priority" required size="small" label="优先级">
            <el-select style="width: 100%" v-model="info.priority" placeholder="请选择">
              <el-option label="高" :value="1"></el-option>
              <el-option label="中" :value="2"></el-option>
              <el-option label="低" :value="3"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item class="form-item" size="small">
            <el-button type="primary" :disabled="btnLoading" @click="submitAdd">保存</el-button>
          </el-form-item>
        </el-form>
      </el-popover>
    </div>
    <!-- 计划列表 -->
    <div class="priority-box" v-for="(plans, index) in planList" :key="index">
      <div class="priority-text" :style="{ backgroundColor: priorityMap[index + 1].color }">{{ priorityMap[index + 1].text }}优先级</div>
      <div class="priority-list">
        <div class="plan-item" v-for="(item, index) in plans" :key="index">
          <div class="title">{{ item.title }}</div>
          <div class="context">{{ item.context }}</div>
          <div class="operate">
            <el-button size="small" type="primary" :icon="Edit" circle @click="showEdit(item)"></el-button>
            <el-button size="small" type="danger" :icon="Delete" circle @click="showDelete(item._id)"></el-button>
          </div>
        </div>
      </div>
    </div>
    <!-- 编辑预算弹窗 -->
    <el-dialog title="编辑预算" width="300px" class="edit-plan-dialog" v-model="editDialog">
      <el-form :model="editInfo" ref="$editForm" :rules="rules" class="form-container" labelPosition="top">
        <el-form-item prop="title" required size="small" label="标题">
          <el-input v-model="editInfo.title" clearable placeholder="请输入"></el-input>
        </el-form-item>
        <el-form-item prop="context" required size="small" label="内容">
          <el-input v-model="editInfo.context" clearable placeholder="请输入"></el-input>
        </el-form-item>
        <el-form-item prop="priority" required size="small" label="优先级">
          <el-select style="width: 100%" v-model="editInfo.priority" placeholder="请选择">
            <el-option label="高" :value="1"></el-option>
            <el-option label="中" :value="2"></el-option>
            <el-option label="低" :value="3"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item class="form-item" size="small">
          <el-button type="primary" :disabled="editLoading" @click="submitEdit">保存</el-button>
          <el-button size="small" :disabled="editLoading" @click="editDialog = false">取消</el-button>
        </el-form-item>
      </el-form>
    </el-dialog>
    <!-- 删除弹窗 -->
    <el-dialog title="您确定要删除吗？" width="380px" class="delete-budget-dialog" v-model="deleteDialog">
      <div style="color: #999">删除后数据将无法恢复</div>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="small" :loading="btnLoading" type="primary" @click="submitDelete">确定</el-button>
          <el-button size="small" :disabled="btnLoading" @click="deleteDialog = false">取消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { Delete, Edit } from '@element-plus/icons-vue'
import { useList } from './hooks/use-list'
import { useAddInfo } from './hooks/use-add-info'
import { useEditInfo } from './hooks/use-edit-info'
import { useDeleteInfo } from './hooks/use-delete-info'

const { getList, planList } = useList()
const { $addForm, info, btnLoading, reset, submitAdd } = useAddInfo(getList)
const { editDialog, $editForm, editInfo, btnLoading: editLoading, showEdit, submitEdit } = useEditInfo(getList)
const { deleteDialog, showDelete, submitDelete } = useDeleteInfo(getList)

const priorityMap: any = {
  1: { text: '高', color: '#ff000080' },
  2: { text: '中', color: '#ffa50080' },
  3: { text: '低', color: '#00800080' },
}

const rules = {
  title: [{ required: true, message: '请输入标题', trigger: 'change' }],
  context: [{ required: true, message: '请输入内容', trigger: 'change' }],
}
</script>

<style scoped lang="scss">
.plan-module {
  height: calc(100% - 60px);
  width: 100%;
  padding: 20px 10%;
  display: flex;
  .priority-box {
    flex: 1;
    min-width: 0;
    height: 100%;
    & + .priority-box {
      margin-left: 10px;
    }
    .priority-text {
      text-align: center;
      color: #fff;
      width: 80px;
      height: 30px;
      font-weight: bold;
      line-height: 30px;
      margin-left: 10px;
      border-radius: 4px;
    }
    .priority-list {
      display: flex;
      width: 100%;
      height: calc(100% - 30px);
      flex-wrap: wrap;
      align-content: flex-start;
      .plan-item {
        box-shadow: 1px 1px 5px #ddd;
        width: 145px;
        margin: 10px;
        height: 150px;
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 10px;
        display: flex;
        flex-direction: column;
        &:hover {
          transform: scale(1.05);
        }
        .title {
          width: 100%;
          font-weight: bold;
          color: #333;
          font-size: 16px;
          height: 20px;
          line-height: 20px;
        }
        .context {
          flex: 1;
          min-height: 0;
          font-size: 12px;
          line-height: 18px;
          color: #999;
          margin: 10px 0;
        }
        .priority {
          margin: 15px 0;
          height: 20px;
          line-height: 20px;
          .text {
            display: inline-block;
            width: 40px;
            height: 100%;
            font-weight: bold;
            text-align: center;
            color: #fff;
            border-radius: 4px;
          }
        }
        .operate {
          text-align: center;
        }
      }
    }
  }
  .tool-container {
    position: fixed;
    width: 50px;
    top: 80px;
    left: 5%;
    overflow: hidden;
    .item {
      width: 100%;
      font-weight: bold;
      height: 50px;
      padding: 5px;
      line-height: 40px;
      background-color: #fff;
      border-radius: 8px;
      text-align: center;
      border: 1px solid #ddd;
      cursor: pointer;
      box-shadow: 1px 1px 5px #ddd;
      &:hover {
        background-color: #6fc5ff;
        color: #fff;
      }
      & + .item {
        margin-top: 5px;
      }
    }
  }
}
</style>
<style lang="scss">
.edit-plan-dialog {
  .el-dialog__body {
    padding-top: 0;
    padding-bottom: 1px;
  }
}
</style>
