<template>
  <div class="record">
    <div class="timeline-container">
      <el-scrollbar view-class="list-container" @end-reached="load" height="100%">
        <div class="list-item" v-for="(item, index) in listData" :key="item.date + index">
          <div class="decorate">
            <div class="line"></div>
            <div class="circle"></div>
          </div>
          <div class="date">{{ item.date }} {{ item.week }}</div>
          <div class="date-overview">
            <div class="types">
              <div class="type-item" v-for="typeData in item.types" :key="typeData.name">
                {{ typeData.name }}: <span>{{ typeData.money.toFixed(2) }}</span>
              </div>
            </div>
          </div>
          <div class="detail">
            <div class="detail-item" v-for="detail in item.arr" :class="{ 'gray-background': detail.reimbursement !== 0 }" :key="detail.id">
              <div class="top">
                <span>
                  <span class="belong-user">{{ detail.belongUserName }}</span>
                  <span class="tips">{{ detail[typeName] }}</span>
                  <span v-if="type === 1" class="tips">{{ detail.payMethodName }}</span>
                </span>
                <div class="money">{{ detail.money }}</div>
              </div>
              <div class="remark-container">
                <div class="remark">{{ detail.remark }}</div>
                <div class="operate" v-if="detail.userId === userInfo.userId">
                  <el-link type="info" @click="showEditDialog(detail)">编辑</el-link>
                  <el-link type="danger" @click="showDeleteDialog(detail)">删除</el-link>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-show="loadingMore" class="tips-label">正在加载数据...</div>
        <div v-show="noMore" class="tips-label">没有更多了</div>
      </el-scrollbar>
    </div>
    <div class="header">
      <div class="type-box">
        <ol class="item" :class="{ active: type === 1 }" @click="changeAddType(1)">
          支出
        </ol>
        <ol class="item" :class="{ active: type === 2 }" @click="changeAddType(2)">
          收入
        </ol>
      </div>
      <div class="content">
        <!-- 查询交易 -->
        <el-form v-show="!showAdd" labelPosition="top">
          <el-form-item class="form-item width-300" size="large" label="开始日期">
            <el-date-picker v-model="searchOptions.beginDate" :disabled-date="beginDateOptions" value-format="x" type="date" placeholder="请选择" clearable></el-date-picker>
          </el-form-item>
          <el-form-item class="form-item width-300" size="large" label="结束日期">
            <el-date-picker v-model="searchOptions.endDate" :disabled-date="endDateOptions" value-format="x" type="date" placeholder="请选择" clearable></el-date-picker>
          </el-form-item>
          <el-form-item class="form-item width-300" size="large" label="记账人">
            <el-select v-model="searchOptions.userId" filterable placeholder="请选择" automatic-dropdown clearable>
              <el-option v-for="(item, index) in users" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item class="form-item width-300" v-show="type === 1" size="large" label="支出类型">
            <el-select v-model="searchOptions.costTypeId" filterable placeholder="请选择" automatic-dropdown clearable>
              <template v-for="(item, index) in costTypes" :key="item + '_' + index">
                <el-option v-if="!item?.hidden" :label="item.name" :value="item.id"></el-option>
              </template>
            </el-select>
          </el-form-item>
          <el-form-item class="form-item width-300" size="large" label="归属人">
            <el-select v-model="searchOptions.belongUserId" filterable placeholder="请选择" :empty-values="[null, undefined]" :value-on-clear="null" automatic-dropdown clearable>
              <el-option label="全部" value=""></el-option>
              <el-option v-for="(item, index) in users" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item class="form-item width-300" v-show="type === 2" size="large" label="收入类型">
            <el-select v-model="searchOptions.incomesTypeId" filterable placeholder="请选择" automatic-dropdown clearable>
              <template v-for="(item, index) in incomesTypes" :key="item + '_' + index">
                <el-option v-if="!item?.hidden" :label="item.name" :value="item.id"></el-option>
              </template>
            </el-select>
          </el-form-item>
          <el-form-item class="form-item width-300" size="large" label="内容">
            <el-input v-model="searchOptions.remark" placeholder="请输入"></el-input>
          </el-form-item>
          <el-form-item class="form-item width-80" v-show="type === 1" size="large" label="金额范围">
            <el-select v-model="searchOptions.condition" placeholder="请选择">
              <el-option v-for="(item, index) in conditionOptions" :label="item.name" :value="item.id"></el-option>
            </el-select>
            <el-input v-model="searchOptions.rangeMoney" placeholder="请输入"></el-input>
          </el-form-item>
          <el-form-item class="form-item" size="large">
            <el-button @click="search">查询</el-button>
            <el-button @click="exportExcel">导出</el-button>
            <el-button v-show="!showAdd" @click="changeAddContainer">新增</el-button>
            <el-button v-show="type === 1" @click="batchDialog = true">批量解析</el-button>
          </el-form-item>
        </el-form>
        <!-- 新增交易 -->
        <div class="add-data" v-show="showAdd">
          <el-form class="form-container" labelPosition="top">
            <el-form-item class="form-item width-300" size="large" label="日期">
              <el-date-picker v-model="addInformation.date" value-format="x" type="date" placeholder="请选择" clearable></el-date-picker>
            </el-form-item>
            <el-form-item class="form-item width-300" v-show="type === 1" size="large" label="支出类型">
              <el-select filterable v-model="addInformation.costTypeId" placeholder="请选择" automatic-dropdown clearable>
                <template v-for="(item, index) in costTypes" :key="item + '_' + index">
                  <el-option v-if="!item?.hidden" :label="item.name" :value="item.id"></el-option>
                </template>
              </el-select>
            </el-form-item>
            <el-form-item class="form-item width-300" size="large" label="内容">
              <el-input v-model="addInformation.remark" clearable placeholder="请输入"></el-input>
              <el-button type="primary" @click="parseRemark" size="small" :loading="loading">解析</el-button>
            </el-form-item>
            <el-form-item class="form-item width-300" size="large" label="金额">
              <el-input v-model="addInformation.money" clearable placeholder="请输入"></el-input>
            </el-form-item>
            <el-form-item class="form-item width-300" size="large" label="归属人">
              <el-select v-model="addInformation.belongUserId" filterable placeholder="请选择" :empty-values="[null, undefined]" :value-on-clear="null" automatic-dropdown clearable>
                <el-option label="全部" value=""></el-option>
                <el-option v-for="(item, index) in users" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
              </el-select>
            </el-form-item>
            <el-form-item class="form-item" v-show="type === 1" size="large" label="报销进度">
              <el-radio-group v-model="addInformation.reimbursement">
                <el-radio :value="0">无需报销</el-radio>
                <el-radio :value="1">待报销</el-radio>
                <el-radio :value="2">已提交</el-radio>
                <el-radio :value="3">已报销</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item class="form-item width-300" v-show="type === 2" size="large" label="收入类型">
              <el-select v-model="addInformation.incomesTypeId" filterable placeholder="请选择" automatic-dropdown clearable>
                <template v-for="(item, index) in incomesTypes" :key="item + '_' + index">
                  <el-option v-if="!item?.hidden" :label="item.name" :value="item.id"></el-option>
                </template>
              </el-select>
            </el-form-item>
            <el-form-item class="form-item" size="large">
              <el-button :disabled="saveLoading" @click="addInfo">保存</el-button>
              <el-button @click="changeAddContainer">取消</el-button>
            </el-form-item>
          </el-form>
        </div>
      </div>
    </div>
    <el-dialog title="您确定要删除吗？" class="delete-transaction-dialog" v-model="deleteDialog">
      <div style="color: #999">删除后数据将无法恢复</div>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="large" :loading="btnLoading" type="primary" @click="submitDeleteTransaction">确定</el-button>
          <el-button size="large" :disabled="btnLoading" @click="deleteDialog = false">取消</el-button>
        </div>
      </template>
    </el-dialog>
    <el-dialog title="编辑明细" class="edit-transaction-dialog" v-model="editDialog">
      <el-form v-if="editDialog" class="form-container">
        <el-form-item class="form-item" size="large" label="日期">
          <el-date-picker v-model="operateData.date" value-format="x" type="date" placeholder="请选择" style="width: 100%" clearable></el-date-picker>
        </el-form-item>
        <el-form-item class="form-item" v-show="type === 1" size="large" label="支出类型">
          <el-select v-model="operateData.costTypeId" filterable placeholder="请选择" automatic-dropdown clearable>
            <template v-for="(item, index) in costTypes" :key="item + '_' + index">
              <el-option v-if="!item?.hidden" :label="item.name" :value="item.id"></el-option>
            </template>
          </el-select>
        </el-form-item>
        <el-form-item class="form-item" size="large" label="归属人">
          <el-select v-model="operateData.belongUserId" filterable placeholder="请选择" :empty-values="[null, undefined]" :value-on-clear="null" automatic-dropdown clearable>
            <el-option label="全部" value=""></el-option>
            <el-option v-for="(item, index) in users" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item class="form-item" size="large" label="金额">
          <el-input v-model="operateData.money" placeholder="请输入" style="width: 100%"></el-input>
        </el-form-item>
        <el-form-item class="form-item" v-show="type === 1" size="large" label="报销进度">
          <el-radio-group v-model="operateData.reimbursement">
            <el-radio :value="0">无需报销</el-radio>
            <el-radio :value="1">待报销</el-radio>
            <el-radio :value="2">已提交</el-radio>
            <el-radio :value="3">已报销</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item class="form-item" v-show="type === 2" size="large" label="收入类型">
          <el-select v-model="operateData.incomesTypeId" filterable placeholder="请选择" automatic-dropdown clearable>
            <template v-for="(item, index) in incomesTypes" :key="item + '_' + index">
              <el-option v-if="!item?.hidden" :label="item.name" :value="item.id"></el-option>
            </template>
          </el-select>
        </el-form-item>

        <el-form-item class="form-item" size="large" label="内容">
          <el-input v-model="operateData.remark" placeholder="请输入"></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="large" :loading="btnLoading" type="primary" @click="submitEditTransaction">确定</el-button>
          <el-button size="large" :disabled="btnLoading" @click="editDialog = false">取消</el-button>
        </div>
      </template>
    </el-dialog>
    <el-dialog title="批量解析" class="batch-parse-dialog" v-model="batchDialog" :close-on-click-modal="false">
      <div class="batch-input-area">
        <el-input v-model="batchText" type="textarea" :rows="6" placeholder="请输入内容，每行一条记录..." />
        <el-button type="primary" @click="handleBatchParse" :loading="loading" style="margin-top: 10px">解析</el-button>
      </div>
      <el-table v-if="batchResults.length" :data="batchResults" style="margin-top: 15px" border>
        <el-table-column label="内容" min-width="180">
          <template #default="{ row }">
            <el-input v-model="row.remark" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="支出类型" width="150">
          <template #default="{ row }">
            <el-select v-model="row.costTypeId" filterable size="small" placeholder="请选择">
              <template v-for="item in costTypes" :key="item.id">
                <el-option v-if="!item?.hidden" :label="item.name" :value="item.id" />
              </template>
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="金额" width="110">
          <template #default="{ row }">
            <el-input v-model="row.money" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="日期" width="180">
          <template #default="{ row }">
            <el-date-picker v-model="row.date" value-format="x" type="date" size="small" placeholder="请选择" style="width: 100%" />
          </template>
        </el-table-column>
        <el-table-column label="归属人" width="140">
          <template #default="{ row }">
            <el-select v-model="row.belongUserId" filterable size="small" placeholder="请选择" :empty-values="[null, undefined]" :value-on-clear="null" clearable>
              <el-option label="全部" value="" />
              <el-option v-for="item in users" :key="item.id" :label="item.name" :value="item.id" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="70" align="center">
          <template #default="{ $index }">
            <el-button type="danger" link size="small" @click="batchResults.splice($index, 1)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button type="primary" @click="handleBatchSave" :loading="batchSaving" :disabled="batchResults.length === 0">批量保存</el-button>
        <el-button @click="batchDialog = false">取消</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import dayjs from 'dayjs'
import { useAddEdit } from './hooks/use-add-edit'
import { useRecord } from './hooks/use-record'
import { useParse } from './hooks/use-parse'

const {
  loadingMore,
  noMore,
  type,
  typeName,
  searchOptions,
  conditionOptions,
  beginDateOptions,
  endDateOptions,
  users,
  costTypes,
  incomesTypes,
  payMethods,
  listData,
  userInfo,
  exportExcel,
  load,
  changeAddType,
  search,
} = useRecord()
const {
  showAdd,
  saveLoading,
  batchSaving,
  deleteDialog,
  editDialog,
  btnLoading,
  addInformation,
  operateData,
  showDeleteDialog,
  showEditDialog,
  submitDeleteTransaction,
  submitEditTransaction,
  addInfo,
  batchAdd,
  changeAddContainer,
} = useAddEdit({ search, type })

const { parse, parseBatch, loading } = useParse(costTypes)

const parseRemark = async () => {
  const { info, error } = await parse(addInformation.value.remark)
  if (error) {
    ElMessage.error('解析失败')
    return
  }
  addInformation.value.costTypeId = info.costTypeId
  addInformation.value.money = info.money
  addInformation.value.date = info.date ? dayjs(info.date).startOf('day').valueOf() : ''
}

/** 批量解析相关 */
const batchDialog = ref(false)
const batchText = ref('')
const batchResults = ref<Array<{ remark: string; costTypeId: string; money: number; date: string; belongUserId: string }>>([])

const handleBatchParse = async () => {
  if (!batchText.value.trim()) {
    ElMessage.warning('请输入内容')
    return
  }
  const results = await parseBatch(batchText.value)
  batchResults.value = results
}

const handleBatchSave = async () => {
  const success = await batchAdd(batchResults.value)
  if (success) {
    batchDialog.value = false
    batchText.value = ''
    batchResults.value = []
  }
}
</script>

<style scoped lang="scss">
.record {
  flex: 1;
  min-height: 0;
  width: 100%;
  background-color: #8cb3bf;
  padding: 20px;
  display: flex;

  .timeline-container {
    flex: 1;
    min-width: 0;
    height: 100%;
    background-color: #fff;
    box-shadow: 1px 1px 5px #999;
    border-radius: 8px;
    :deep(.list-container) {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      padding-top: 40px;
    }
    .list-item {
      width: 50%;
      padding: 40px 20px 30px;
      height: fit-content;
      position: relative;
      .decorate {
        position: absolute;
        left: -5px;
        top: 0;
        height: 100%;
        width: fit-content;
        .circle {
          width: 30px;
          height: 30px;
          position: absolute;
          top: -15px;
          left: -10px;
          border-radius: 50%;
          background-color: rgb(152, 182, 247);
        }
        .line {
          height: 100%;
          width: 10px;
          background-color: #9cdef7;
          position: relative;
          border-radius: 5px;
        }
      }
      .date {
        position: absolute;
        left: -160px;
        top: -12px;
        width: fit-content;
        font-size: 18px;
        font-weight: bold;
      }
      .types {
        display: flex;
        align-items: center;
        position: absolute;
        top: -15px;
        .type-item {
          width: fit-content;
          padding: 5px;
          font-size: 16px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: #9cdef7;
          color: #fff;
          &.type-item {
            margin-left: 10px;
          }
        }
      }
      .detail {
        height: 70%;
        font-size: 16px;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        .detail-item {
          border: 1px solid #ddd;
          border-radius: 8px;
          box-shadow: 0 0 2px #ddd;
          width: 500px;
          padding: 10px;
          &.gray-background {
            background-color: #eee;
          }
          .top {
            display: flex;
            font-size: 16px;
            font-weight: bold;
            justify-content: space-between;
            .belong-user {
              color: #f9a100;
            }
            .tips {
              color: #999;
              margin-left: 20px;
              font-size: 16px;
            }
            .money {
              color: #dd3914;
            }
          }

          .remark-container {
            font-size: 16px;
            color: #999;
            margin-top: 10px;
            display: flex;
            justify-content: space-between;
            .remark {
              flex: 1;
              min-width: 0;
              word-break: break-all;
            }
            .operate {
              margin-left: 40px;
              .el-link + .el-link {
                margin-left: 5px;
              }
            }
          }
          & + .detail-item {
            margin-top: 10px;
          }
        }
      }
      &:nth-child(2n) {
        align-self: flex-start;
        .decorate {
          left: unset;
          right: -5px;
        }
        .date {
          left: unset;
          right: -160px;
        }
        .types {
          right: 20px;
        }
        .detail {
          align-items: flex-end;
        }
      }
    }
    .tips-label {
      flex: 1;
      align-self: center;
      margin-top: 20px;
      width: 100%;
      text-align: center;
      background: #eee;
      height: 60px;
      line-height: 60px;
    }
  }
  .header {
    width: 320px;
    padding: 10px;
    overflow: auto;
    margin-left: 20px;
    background-color: #fafafa;
    box-shadow: 0px 0px 10px #999;
    border-radius: 10px;
    .type-box {
      width: 100%;
      height: 30px;
      margin-bottom: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      display: flex;
      .item {
        flex: 1;
        min-width: 0;
        height: 100%;
        cursor: pointer;
        text-align: center;
        font-size: 16px;
        line-height: 30px;
        &.active {
          background: rgb(135, 180, 248);
          color: #fff;
        }
      }
    }
    .content {
      flex: 1;
      .form-item {
        margin-bottom: 10px;
      }
    }
  }
}
</style>
<style lang="scss">
.record {
  .el-form-item__label {
    font-size: 14px;
  }
  .el-form--inline .el-form-item {
    margin-right: 10px;
  }
  .width-300 {
    .el-date-editor,
    .el-input,
    .el-input__wrapper {
      width: 300px;
      font-size: 16px;
    }
  }
  .width-80 {
    .el-input {
      width: 140px;
      font-size: 16px;
      margin-right: 5px;
    }
  }
  .el-radio {
    margin-right: 10px;
  }
}
.delete-transaction-dialog {
  width: 380px;
}
.edit-transaction-dialog {
  width: 430px;
  .form-item {
    .el-form-item__label {
      width: 70px;
    }
    .el-date-editor,
    .el-input,
    .el-input__wrapper {
      width: 310px;
    }
  }
}
.batch-parse-dialog {
  width: 960px;
  .batch-input-area {
    display: flex;
    flex-direction: column;
  }
  .el-table {
    font-size: 14px;
  }
}
</style>
