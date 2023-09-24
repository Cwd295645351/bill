<template>
  <div class="record">
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
        <el-form :inline="true">
          <el-form-item class="form-item width-150" size="small" label="日期">
            <el-date-picker v-model="searchOptions.beginDate" :disabled-date="beginDateOptions" value-format="YYYY-MM-DD" type="date" placeholder="请选择" clearable></el-date-picker>~
            <el-date-picker v-model="searchOptions.endDate" :disabled-date="endDateOptions" value-format="YYYY-MM-DD" type="date" placeholder="请选择" clearable></el-date-picker>
          </el-form-item>
          <el-form-item class="form-item width-100" size="small" label="记账人">
            <el-select v-model="searchOptions.userId" filterable placeholder="请选择" clearable>
              <el-option v-for="(item, index) in users" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item class="form-item width-100" v-show="type === 1" size="small" label="支出类型">
            <el-select v-model="searchOptions.costTypeId" filterable placeholder="请选择" clearable>
              <el-option v-for="(item, index) in costTypes" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item class="form-item width-100" v-show="type === 1" size="small" label="支付方式">
            <el-select v-model="searchOptions.payMethodId" filterable placeholder="请选择" clearable>
              <el-option v-for="(item, index) in payMethods" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item class="form-item width-100" size="small" label="归属人">
            <el-select v-model="searchOptions.belongUserId" filterable placeholder="请选择" clearable>
              <el-option label="全部" value=""></el-option>
              <el-option v-for="(item, index) in users" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item class="form-item width-100" v-show="type === 2" size="small" label="收入类型">
            <el-select v-model="searchOptions.incomesTypeId" filterable placeholder="请选择" clearable>
              <el-option v-for="(item, index) in incomesTypes" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item class="form-item width-100" size="small" label="内容">
            <el-input v-model="searchOptions.remark" placeholder="请输入"></el-input>
          </el-form-item>
          <el-form-item class="form-item width-80" v-show="type === 1" size="small" label="金额范围">
            <el-select v-model="searchOptions.condition" placeholder="请选择">
              <el-option v-for="(item, index) in conditionOptions" :label="item.name" :value="item.id"></el-option>
            </el-select>
            <el-input v-model="searchOptions.rangeMoney" placeholder="请输入"></el-input>
          </el-form-item>
          <el-form-item class="form-item" size="small">
            <el-button @click="serachAll">查询</el-button>
            <el-button @click="exportExcel">导出</el-button>
            <el-button v-show="!showAdd" @click="changeAddContainer">新增</el-button>
          </el-form-item>
        </el-form>
        <!-- 新增交易 -->
        <div class="add-data" v-show="showAdd">
          <el-form class="form-container" :inline="true">
            <el-form-item class="form-item width-125" size="small" label="日期">
              <el-date-picker v-model="addInformation.date" type="date" placeholder="请选择" clearable></el-date-picker>
            </el-form-item>
            <el-form-item class="form-item width-125" v-show="type === 1" size="small" label="支出类型">
              <el-select filterable v-model="addInformation.costTypeId" placeholder="请选择" clearable>
                <el-option v-for="(item, index) in costTypes" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
              </el-select>
            </el-form-item>
            <el-form-item class="form-item width-125" size="small" label="内容">
              <el-input v-model="addInformation.remark" clearable placeholder="请输入"></el-input>
            </el-form-item>
            <el-form-item class="form-item width-125" size="small" label="金额">
              <el-input v-model="addInformation.money" clearable placeholder="请输入"></el-input>
            </el-form-item>
            <el-form-item class="form-item width-125" size="small" label="归属人">
              <el-select v-model="addInformation.belongUserId" filterable placeholder="请选择" clearable>
                <el-option label="全部" value=""></el-option>
                <el-option v-for="(item, index) in users" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
              </el-select>
            </el-form-item>
            <el-form-item class="form-item width-125" v-show="type === 1" size="small" label="支付方式">
              <el-select v-model="addInformation.payMethodId" filterable placeholder="请选择" clearable>
                <el-option v-for="(item, index) in payMethods" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
              </el-select>
            </el-form-item>
            <el-form-item class="form-item" v-show="type === 1" size="small" label="报销进度">
              <el-radio-group v-model="addInformation.reimbursement">
                <el-radio :label="0">无需报销</el-radio>
                <el-radio :label="1">待报销</el-radio>
                <el-radio :label="2">已提交</el-radio>
                <el-radio :label="3">已报销</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item class="form-item width-125" v-show="type === 2" size="small" label="收入类型">
              <el-select v-model="addInformation.incomesTypeId" filterable placeholder="请选择" clearable>
                <el-option v-for="(item, index) in incomesTypes" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
              </el-select>
            </el-form-item>
            <el-form-item class="form-item" size="small">
              <el-button :disabled="saveLoading" @click="addInfo">保存</el-button>
              <el-button @click="changeAddContainer">取消</el-button>
            </el-form-item>
          </el-form>
        </div>
      </div>
    </div>
    <div class="context">
      <div class="overview">
        <div class="top-container item">
          <div class="title">本月收支概览</div>
          <div class="line">本月支出：{{ monthOverview.totalCost }}</div>
          <div class="line" v-for="item in monthOverview.belongUserCosts" :key="item.belongUserId + item.userId">({{ item.userName }}) {{ item.belongUserName }}支出：{{ item.money.toFixed(2) }}</div>
          <div class="line">本月预算：{{ monthOverview.budget }}</div>
        </div>
        <div class="calculate-container item">
          <div class="title">收支合计：{{ proportion.money }}</div>
          <el-input class="margin-top-10" v-model="proportion.first" size="small"></el-input>
          <el-input class="margin-top-10" v-model="proportion.second" size="small"></el-input>
          <el-button class="margin-top-10" size="small" @click="calculateMoney">计算</el-button>
        </div>
        <div class="monthly-cost item">
          <div class="title">本月各类型支出比例</div>
          <div class="record-cost-statistics" id="costStatistics"></div>
        </div>
      </div>
      <div class="timeline-container" v-infinite-scroll="load" infinite-scroll-distance="40" infinite-scroll-delay="300">
        <div class="list-item" v-for="(item, index) in listData" :key="item.date + index">
          <div class="decorate">
            <div class="line"></div>
            <div class="circle"></div>
          </div>
          <div class="date">{{ item.date }}</div>
          <div class="date-overview">
            <div class="types">
              <div class="type-item" v-for="typeData in item.types" :key="typeData.name">
                {{ typeData.name }}: <span>{{ typeData.money.toFixed(2) }}</span>
              </div>
            </div>
          </div>
          <div class="detail">
            <div class="detail-item" v-for="detail in item.datas" :class="{ 'gray-background': detail.reimbursement !== 0 }" :key="detail._id">
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
      </div>
    </div>
    <el-dialog title="您确定要删除吗？" class="delete-transaction-dialog" v-model="deleteDialog">
      <div style="color: #999">删除后数据将无法恢复</div>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="small" :loading="btnLoading" type="primary" @click="submitDeleteTransaction">确定</el-button>
          <el-button size="small" :disabled="btnLoading" @click="deleteDialog = false">取消</el-button>
        </div>
      </template>
    </el-dialog>
    <el-dialog title="编辑明细" class="edit-transaction-dialog" v-model="editDialog">
      <el-form v-if="editDialog" class="form-container">
        <el-form-item class="form-item" size="small" label="日期">
          <el-date-picker v-model="operateData.date" type="date" placeholder="请选择" clearable></el-date-picker>
        </el-form-item>
        <el-form-item class="form-item" v-show="type === 1" size="small" label="支出类型">
          <el-select v-model="operateData.costTypeId" filterable placeholder="请选择" clearable>
            <el-option v-for="(item, index) in costTypes" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item class="form-item" v-show="type === 1" size="small" label="支付方式">
          <el-select v-model="operateData.payMethodId" filterable placeholder="请选择" clearable>
            <el-option v-for="(item, index) in payMethods" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item class="form-item" size="small" label="归属人">
          <el-select v-model="operateData.belongUserId" filterable placeholder="请选择" clearable>
            <el-option label="全部" value=""></el-option>
            <el-option v-for="(item, index) in users" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item class="form-item" size="small" label="金额">
          <el-input v-model="operateData.money" placeholder="请输入"></el-input>
        </el-form-item>
        <el-form-item class="form-item" v-show="type === 1" size="small" label="报销进度">
          <el-radio-group v-model="operateData.reimbursement">
            <el-radio :label="0">无需报销</el-radio>
            <el-radio :label="1">待报销</el-radio>
            <el-radio :label="2">已提交</el-radio>
            <el-radio :label="3">已报销</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item class="form-item" v-show="type === 2" size="small" label="收入类型">
          <el-select v-model="operateData.incomesTypeId" filterable placeholder="请选择" clearable>
            <el-option v-for="(item, index) in incomesTypes" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
          </el-select>
        </el-form-item>

        <el-form-item class="form-item" size="small" label="内容">
          <el-input v-model="operateData.remark" placeholder="请输入"></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button size="small" :loading="btnLoading" type="primary" @click="submitEditTransaction">确定</el-button>
          <el-button size="small" :disabled="btnLoading" @click="editDialog = false">取消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { useAddEdit } from './hooks/use-add-edit'
import { useRecord } from './hooks/use-record'
import { useStatistics } from './hooks/use-statitics'

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
const { monthOverview, proportion, getCost, calculateMoney } = useStatistics({ users })
const {
  showAdd,
  saveLoading,
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
  changeAddContainer,
} = useAddEdit({ getCost, search, type })

const serachAll = () => {
  search()
  getCost()
}
</script>

<style scoped lang="scss">
.record {
  height: calc(100% - 60px);
  background-color: #8cb3bf;
  width: 100%;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  .header {
    width: 95%;
    padding: 15px;
    background-color: #fafafa;
    box-shadow: 0px 0px 10px #999;
    margin-bottom: 20px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    .type-box {
      width: fit-content;
      height: 100%;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin-right: 10px;
      display: flex;
      flex-direction: column;
      .item {
        flex: 1;
        width: 40px;
        padding: 2px 4px;
        cursor: pointer;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        &:last-of-type {
          border-top: 1px solid #ddd;
        }
        &.active {
          background: rgb(135, 180, 248);
          color: #fff;
        }
      }
    }
    .content {
      flex: 1;
      .form-item {
        margin-bottom: 0;
      }
      .add-data {
        border-top: 1px solid #ddd;
        padding-top: 10px;
        margin-top: 10px;
      }
    }
  }
  .context {
    flex: 1;
    width: 95%;
    min-height: 0;
    display: flex;
    .overview {
      width: 240px;
      margin-right: 20px;
      .top-container {
        height: fit-content;

        .line {
          margin-top: 10px;
          font-size: 14px;
        }
      }
      .item {
        padding: 20px;
        background-color: #fff;
        border: 1px solid #ddd;
        box-shadow: 1px 1px 5px #999;
        border-radius: 8px;
      }
      .calculate-container {
        margin-top: 20px;
        text-align: center;
        .margin-top-10 {
          margin-top: 10px;
        }
      }
      .monthly-cost {
        margin-top: 20px;
        height: 250px;
        .record-cost-statistics {
          height: calc(100% - 21px);
          width: 100%;
        }
      }

      .title {
        text-align: center;
        font-weight: bold;
        font-size: 16px;
        height: 21px;
      }
    }
    .timeline-container {
      flex: 1;
      background-color: #fff;
      box-shadow: 1px 1px 5px #999;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      padding-top: 40px;
      overflow: auto;
      .list-item {
        width: 50%;
        padding: 30px 20px;
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
          left: -130px;
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
            font-size: 14px;
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
          font-size: 14px;
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
                font-size: 12px;
              }
              .money {
                color: #dd3914;
              }
            }

            .remark-container {
              font-size: 12px;
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
            right: -130px;
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
  .width-125 {
    .el-date-editor,
    .el-input,
    .el-input__wrapper {
      width: 125px;
    }
  }
  .width-150 {
    .el-date-editor,
    .el-input,
    .el-input__wrapper {
      width: 150px;
    }
  }
  .width-100 {
    .el-input,
    .el-input__wrapper {
      width: 100px;
    }
  }
  .width-80 {
    .el-input {
      width: 50px;
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
</style>
