<template>
  <div class="budget-container">
    <div class="budget-overview-container">
      <div class="total">
        年度预算：<span class="num">{{ totalBudget }}</span>
      </div>
      <div class="total">
        年度支出：<span class="num">{{ totalCost }}</span>
      </div>
      <div id="budgetStatistics" class="budget-overview"></div>
      <div class="add-data-container">
        <div class="title">新增预算</div>
        <el-form :model="addInformation" ref="$addForm" :rules="rules" class="form-container" labelPosition="top">
          <el-form-item prop="costTypeId" required size="small" label="支出类型">
            <el-select style="width: 100%" v-model="addInformation.costTypeId" filterable placeholder="请选择" clearable>
              <el-option v-for="(item, index) in costTypes" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item prop="money" required size="small" label="金额">
            <el-input v-model="addInformation.money" clearable placeholder="请输入"></el-input>
          </el-form-item>
          <el-form-item class="form-item" size="small">
            <el-button type="primary" :disabled="btnLoading" @click="addBudget">保存</el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
    <div class="budget-list-cards">
      <div class="budget-list-card-item" v-for="(item, index) in budgetDetails" :key="item.costTypeId + index" @click="jumpRecord(item)">
        <div class="type">{{ item.costTypeName }}</div>
        <div class="tips">预算：{{ item.budget }}</div>
        <div class="line budget"></div>
        <div class="tips">花费：{{ item.cost }}</div>
        <div class="line cost">
          <div
            :style="{
              height: '100%',
              width: `${(item.costPercent as number) * 100}%`,
              background: costColor(item),
            }"
          ></div>
        </div>
        <div class="operate">
          <el-button size="small" type="primary" :icon="Edit" circle @click="showEdit(item)"></el-button>
          <el-button size="small" type="danger" :icon="Delete" circle @click="showDelete(item)"></el-button>
        </div>
      </div>
      <!-- 编辑预算弹窗 -->
      <el-dialog title="编辑预算" class="edit-budget-dialog" v-model="editDialog">
        <el-form :model="editBudgetObj" ref="$editForm" :rules="rules" class="form-container" labelPosition="top">
          <el-form-item prop="costTypeId" required size="small" label="支出类型">
            <el-select style="width: 100%" disabled v-model="editBudgetObj.costTypeId" filterable placeholder="请选择" clearable>
              <el-option v-for="(item, index) in costTypes" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item prop="budget" required size="small" label="金额">
            <el-input v-model="editBudgetObj.budget" clearable placeholder="请输入"></el-input>
          </el-form-item>
          <el-form-item class="form-item" size="small">
            <el-button type="primary" :disabled="btnLoading" @click="submitEditBudget">保存</el-button>
            <el-button size="small" :disabled="btnLoading" @click="editDialog = false">取消</el-button>
          </el-form-item>
        </el-form>
      </el-dialog>
      <!-- 删除弹窗 -->
      <el-dialog title="您确定要删除吗？" class="delete-budget-dialog" v-model="deleteDialog">
        <div style="color: #999">删除后数据将无法恢复</div>
        <template #footer>
          <div class="dialog-footer">
            <el-button size="small" :loading="btnLoading" type="primary" @click="submitDeleteBudget">确定</el-button>
            <el-button size="small" :disabled="btnLoading" @click="deleteDialog = false">取消</el-button>
          </div>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useBudget } from './hooks/use-budget'
import { Delete, Edit } from '@element-plus/icons-vue'
import type { Emits } from './type'

const emits = defineEmits<Emits>()

const {
  $addForm,
  $editForm,
  editDialog,
  editBudgetObj,
  btnLoading,
  deleteDialog,
  totalBudget,
  totalCost,
  costTypes,
  addInformation,
  budgetDetails,
  costColor,
  addBudget,
  showEdit,
  submitEditBudget,
  showDelete,
  submitDeleteBudget,
  jumpRecord,
} = useBudget(emits)
const rules = {
  money: [
    { required: true, message: '请输入金额', trigger: 'change' },
    {
      validator: (rule: any, value: any, callback: any) => {
        const num = Number(value)
        if (isNaN(num)) {
          callback(new Error('请输入数字'))
        } else if (num <= 0) {
          callback(new Error('金额必须为正数'))
        } else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
  budget: [
    { required: true, message: '请输入金额', trigger: 'change' },
    {
      validator: (rule: any, value: any, callback: any) => {
        const num = Number(value)
        if (isNaN(num)) {
          callback(new Error('请输入数字'))
        } else if (num <= 0) {
          callback(new Error('金额必须为正数'))
        } else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
  costTypeId: [{ required: true, message: '请选择支出类型', trigger: 'change' }],
}
</script>

<style scoped lang="scss">
.budget-container {
  width: 100%;
  height: calc(100% - 60px);
  padding: 20px;
  display: flex;
  align-items: center;
  .budget-overview-container {
    width: 320px;
    height: 100%;
    margin-right: 20px;
    border-radius: 8px;
    box-shadow: 1px 1px 5px #ddd;
    display: flex;
    flex-direction: column;
    .total {
      height: 60px;
      width: calc(100% - 40px);
      padding-bottom: 10px;
      margin: 20px 20px 0;
      font-size: 20px;
      border-bottom: 1px solid #ddd;

      .num {
        font-size: 28px;
        color: #dd3914;
      }
    }
    .budget-overview {
      flex: 1;
      min-height: 0;
    }
    .add-data-container {
      width: 100%;
      height: 250px;
      border-top: 1px solid #ddd;
      padding: 10px;
      .title {
        text-align: center;
        font-weight: bold;
      }
      .form-item {
        :deep(.el-form-item__content) {
          justify-content: center;
        }
      }
    }
  }
  .budget-list-cards {
    flex: 1;
    height: 100%;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
    align-content: flex-start;
    .budget-list-card-item {
      width: 200px;
      height: 200px;
      border-radius: 4px;
      box-shadow: 1px 1px 5px #ddd;
      padding: 10px;
      margin-right: 20px;
      margin-bottom: 20px;
      cursor: pointer;
      &:hover {
        box-shadow: 1px 1px 10px #ddd;
        border: 1px solid #ddd;
      }
      .type {
        height: 30px;
        line-height: 30px;
        font-size: 16px;
        font-weight: 600;
        text-align: center;
      }
      .tips {
        margin-top: 10px;
      }
      .line {
        height: 10px;
        width: 100%;
        margin-top: 5px;
        margin-bottom: 10px;
        border-radius: 10px;
        background: red;
      }
      .cost {
        background-color: gray;
        overflow: hidden;
        margin-bottom: 20px;
      }
      .operate {
        text-align: center;
      }
    }
  }
}
</style>
<style lang="scss">
.delete-budget-dialog {
  width: 380px;
}
.edit-budget-dialog {
  width: 400px;
  .form-item {
    .el-form-item__content {
      justify-content: center;
    }
  }
}
</style>
