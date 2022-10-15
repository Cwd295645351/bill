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
        <el-form :inline="true">
          <el-form-item class="form-item" size="mini" label="日期">
            <el-date-picker v-model="searchOptions.beginDate" type="date" placeholder="请选择" clearable></el-date-picker>~
            <el-date-picker v-model="searchOptions.endDate" type="date" placeholder="请选择" clearable></el-date-picker>
          </el-form-item>
          <el-form-item class="form-item width-150" size="mini" label="记账人">
            <el-select v-model="searchOptions.userId" filterable placeholder="请选择" clearable>
              <el-option v-for="(item, index) in users" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item class="form-item width-150" v-show="type === 1" size="mini" label="支出类型">
            <el-select v-model="searchOptions.costTypeId" filterable placeholder="请选择" clearable>
              <el-option v-for="(item, index) in costTypes" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item class="form-item width-150" v-show="type === 1" size="mini" label="支付方式">
            <el-select v-model="searchOptions.payMethodId" filterable placeholder="请选择" clearable>
              <el-option v-for="(item, index) in payMethods" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item class="form-item width-150" v-show="type === 2" size="mini" label="收入类型">
            <el-select v-model="searchOptions.incomesTypeId" filterable placeholder="请选择" clearable>
              <el-option v-for="(item, index) in incomesType" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item class="form-item width-150" size="mini" label="备注">
            <el-input v-model="searchOptions.remark" placeholder="请输入"></el-input>
          </el-form-item>
          <el-form-item class="form-item" size="mini">
            <el-button>查询</el-button>
            <el-button v-show="!showAdd" @click="changeAddContainer">新增</el-button>
          </el-form-item>
        </el-form>
        <div class="add-data" v-show="showAdd">
          <el-form class="form-container" :inline="true">
            <el-form-item class="form-item" size="mini" label="日期">
              <el-date-picker v-model="addInformation.date" type="date" placeholder="请选择" clearable></el-date-picker>
            </el-form-item>
            <el-form-item class="form-item width-150" v-show="type === 1" size="mini" label="支出类型">
              <el-select v-model="addInformation.costTypeId" filterable placeholder="请选择" clearable>
                <el-option v-for="(item, index) in costTypes" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
              </el-select>
            </el-form-item>
            <el-form-item class="form-item width-150" v-show="type === 1" size="mini" label="支付方式">
              <el-select v-model="addInformation.payMethodId" filterable placeholder="请选择" clearable>
                <el-option v-for="(item, index) in payMethods" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
              </el-select>
            </el-form-item>
            <el-form-item class="form-item width-150" size="mini" label="金额">
              <el-input v-model="addInformation.money" placeholder="请输入"></el-input>
            </el-form-item>
            <el-form-item class="form-item" v-show="type === 1" size="mini" label="报销进度">
              <el-radio-group v-model="addInformation.reimbursement">
                <el-radio :label="0">无需报销</el-radio>
                <el-radio :label="1">待报销</el-radio>
                <el-radio :label="2">已提交</el-radio>
                <el-radio :label="3">已报销</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item class="form-item width-150" v-show="type === 2" size="mini" label="收入类型">
              <el-select v-model="addInformation.incomesTypeId" filterable placeholder="请选择" clearable>
                <el-option v-for="(item, index) in incomesType" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
              </el-select>
            </el-form-item>

            <el-form-item class="form-item width-150" size="mini" label="备注">
              <el-input v-model="addInformation.remark" placeholder="请输入"></el-input>
            </el-form-item>
            <el-form-item class="form-item" size="mini">
              <el-button @click="addTransaction">保存</el-button>
              <el-button @click="changeAddContainer">取消</el-button>
            </el-form-item>
          </el-form>
        </div>
      </div>
    </div>
    <div class="context">
      <div class="overview">
        <div class="title">本月收支概览</div>
        <div class="line">本月支出：{{ monthOverview.cost }}</div>
        <div class="line">本月收入：{{ monthOverview.incomes }}</div>
        <div class="line">本月预算：{{ monthOverview.budget }}</div>
      </div>
      <div class="timeline-container"></div>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import { addTransaction, getList } from './api'
export default {
  data() {
    let _this = this
    return {
      // 本月概览数据
      monthOverview: {
        cost: 0, // 支出
        incomes: 0, // 收入
        budget: 0 // 预算
      },
      // 记账开始日期限制条件
      beginDateOptions: {
        disabledDate(time) {
          if (_this.searchOptions.endDate) {
            return time.getTime() > _this.searchOptions.endDate
          } else {
            return false
          }
        }
      },
      // 记账结束日期限制条件
      endDateOptions: {
        disabledDate(time) {
          if (_this.searchOptions.beginDate) {
            return time.getTime() < _this.searchOptions.beginDate
          } else {
            return false
          }
        }
      },
      // 查询条件
      searchOptions: {
        beginDate: '', // 开始时间
        endDate: '', // 结束时间
        userId: '', // 记账人id
        costTypeId: '', // 支出类型
        incomesTypeId: '', // 收入类型
        payMethodId: '', // 支付方式
        remark: '' // 备注
      },
      pageContent: { pageIndex: 1, pageSize: 20 },
      users: [], // 记账人配置项
      costTypes: [], // 支出类型配置项
      incomesType: [], // 收入类型配置项
      payMethods: [], // 支付方式配置项
      showAdd: false, // 新增数据显示栏
      type: 1, // 类型：1=支出；2=收入
      // 新增信息
      addInformation: {
        date: '', // 日期
        costTypeId: '', // 支出类型（支出数据）
        payMethodId: '', // 支付方式（支出数据）
        reimbursement: 0, // 报销进度（支出数据）
        incomesTypeId: '', // 收入类型（收入数据）
        money: 0, // 金额
        remark: '' // 备注
      }
    }
  },

  created() {},
  computed: {
    ...mapState({
      billId: (state) => state.billId,
      bill: (state) => state.bill
    })
  },
  watch: {
    bill: {
      handler(bill) {
        this.users = bill.users
        this.costTypes = bill.costTypes
        this.incomesType = bill.incomesType
        this.payMethods = bill.payMethods
        this.getList()
      }
    }
  },

  mounted() {},

  methods: {
    // 切换新增数据栏显隐
    changeAddContainer() {
      this.showAdd = !this.showAdd
    },
    // 切换收入/支出类型
    changeAddType(type) {
      this.type = type
    },
    async getList() {
      const params = {
        beginDate: this.searchOptions.beginDate,
        endDate: this.searchOptions.endDate,
        pageIndex: this.pageContent.pageIndex,
        pageSize: this.pageContent.pageSize,
        type: this.type,
        billId: this.bill._id
      }
      const [err, res] = await getList({ params })
      if (err) return
      if (res.retCode === 0) {
        console.log(res)
      } else {
        this.$message.error('查询交易明细失败，' + res.message)
      }
    },
    async addTransaction() {
      const addInformation = this.addInformation
      const data = {
        billId: this.bill._id,
        date: addInformation.date,
        money: addInformation.money,
        type: this.type,
        remark: addInformation.remark
      }
      if (this.type === 1) {
        data.costTypeId = addInformation.costTypeId
        data.payMethodId = addInformation.payMethodId
        data.reimbursement = addInformation.reimbursement
      } else {
        data.incomesTypeId = addInformation.incomesTypeId
      }

      const [err, res] = await addTransaction({ data })
      if (err) return
      if (res.retCode === 0) {
        this.$message.success('新增交易明细成功')
        this.getList()
      } else {
        this.$message.error('新增交易明细失败')
      }
    }
  }
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
    // background-color: #fff;
    // box-shadow: 0px 0px 4px #ddd;
    display: flex;
    .overview {
      width: 240px;
      height: fit-content;
      padding: 20px;
      background-color: #fff;
      border: 1px solid #ddd;
      box-shadow: 1px 1px 5px #999;
      margin-right: 20px;
      border-radius: 8px;
      .title {
        text-align: center;
        font-weight: bold;
      }
      .line {
        margin-top: 10px;
        font-size: 14px;
      }
    }
    .timeline-container {
      flex: 1;
      background-color: #fff;
      box-shadow: 1px 1px 5px #999;
      border-radius: 8px;
    }
  }
}
</style>
<style lang="scss">
.record {
  .width-200 {
  }
  .width-150 {
    .el-input__inner {
      width: 150px;
    }
  }
  .el-radio {
    margin-right: 10px;
  }
}
</style>
