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
          <el-form-item class="form-item width-150" size="mini" label="日期">
            <el-date-picker v-model="searchOptions.beginDate" value-format="yyyy-MM-dd" type="date" placeholder="请选择" clearable></el-date-picker>~
            <el-date-picker v-model="searchOptions.endDate" value-format="yyyy-MM-dd" type="date" placeholder="请选择" clearable></el-date-picker>
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
          <el-form-item class="form-item width-150" size="mini" label="归属人">
            <el-select v-model="searchOptions.belongUserId" filterable placeholder="请选择" clearable>
              <el-option label="全部" value=""></el-option>
              <el-option v-for="(item, index) in users" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item class="form-item width-150" v-show="type === 2" size="mini" label="收入类型">
            <el-select v-model="searchOptions.incomesTypeId" filterable placeholder="请选择" clearable>
              <el-option v-for="(item, index) in incomesTypes" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item class="form-item width-150" size="mini" label="内容">
            <el-input v-model="searchOptions.remark" placeholder="请输入"></el-input>
          </el-form-item>
          <el-form-item class="form-item" size="mini">
            <el-button @click="search">查询</el-button>
            <el-button v-show="!showAdd" @click="changeAddContainer">新增</el-button>
          </el-form-item>
        </el-form>
        <!-- 新增交易 -->
        <div class="add-data" v-show="showAdd">
          <el-form class="form-container" :inline="true">
            <el-form-item class="form-item width-125" size="mini" label="日期">
              <el-date-picker v-model="addInformation.date" type="date" placeholder="请选择" clearable></el-date-picker>
            </el-form-item>
            <el-form-item class="form-item width-125" v-show="type === 1" size="mini" label="支出类型">
              <el-select v-model="addInformation.costTypeId" filterable placeholder="请选择" clearable>
                <el-option v-for="(item, index) in costTypes" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
              </el-select>
            </el-form-item>
            <el-form-item class="form-item width-125" size="mini" label="内容">
              <el-input v-model="addInformation.remark" clearble placeholder="请输入"></el-input>
            </el-form-item>
            <el-form-item class="form-item width-125" size="mini" label="金额">
              <el-input v-model="addInformation.money" clearble placeholder="请输入"></el-input>
            </el-form-item>
            <el-form-item class="form-item width-125" size="mini" label="归属人">
              <el-select v-model="addInformation.belongUserId" filterable placeholder="请选择" clearable>
                <el-option label="全部" value=""></el-option>
                <el-option v-for="(item, index) in users" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
              </el-select>
            </el-form-item>
            <el-form-item class="form-item width-125" v-show="type === 1" size="mini" label="支付方式">
              <el-select v-model="addInformation.payMethodId" filterable placeholder="请选择" clearable>
                <el-option v-for="(item, index) in payMethods" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
              </el-select>
            </el-form-item>
            <el-form-item class="form-item" v-show="type === 1" size="mini" label="报销进度">
              <el-radio-group v-model="addInformation.reimbursement">
                <el-radio :label="0">无需报销</el-radio>
                <el-radio :label="1">待报销</el-radio>
                <el-radio :label="2">已提交</el-radio>
                <el-radio :label="3">已报销</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item class="form-item width-125" v-show="type === 2" size="mini" label="收入类型">
              <el-select v-model="addInformation.incomesTypeId" filterable placeholder="请选择" clearable>
                <el-option v-for="(item, index) in incomesTypes" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
              </el-select>
            </el-form-item>
            <el-form-item class="form-item" size="mini">
              <el-button :disabled="saveLoading" @click="addTransaction">保存</el-button>
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
      <div class="timeline-container" v-infinite-scroll="load" infinite-scroll-distance="40" infinite-scroll-delay="300">
        <div class="list-item" v-for="item in listData" :key="item.date">
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
    <el-dialog title="您确定要删除吗？" custom-class="delete-transaction-dialog" :visible.sync="deleteDialog">
      <div style="color: #999">删除后数据将无法恢复</div>
      <div slot="footer" class="dialog-footer">
        <el-button size="small" :loading="btnLoading" type="primary" @click="submitDeleteTransaction">确定</el-button>
        <el-button size="small" :disabled="btnLoading" @click="deleteDialog = false">取消</el-button>
      </div>
    </el-dialog>
    <el-dialog title="编辑明细" custom-class="edit-transaction-dialog" :visible.sync="editDialog">
      <el-form v-if="editDialog" class="form-container" label-width="70px">
        <el-form-item class="form-item" size="mini" label="日期">
          <el-date-picker v-model="operateData.date" type="date" placeholder="请选择" clearable></el-date-picker>
        </el-form-item>
        <el-form-item class="form-item" v-show="type === 1" size="mini" label="支出类型">
          <el-select v-model="operateData.costTypeId" filterable placeholder="请选择" clearable>
            <el-option v-for="(item, index) in costTypes" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item class="form-item" v-show="type === 1" size="mini" label="支付方式">
          <el-select v-model="operateData.payMethodId" filterable placeholder="请选择" clearable>
            <el-option v-for="(item, index) in payMethods" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item class="form-item" size="mini" label="归属人">
          <el-select v-model="operateData.belongUserId" filterable placeholder="请选择" clearable>
            <el-option label="全部" value=""></el-option>
            <el-option v-for="(item, index) in users" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item class="form-item" size="mini" label="金额">
          <el-input v-model="operateData.money" placeholder="请输入"></el-input>
        </el-form-item>
        <el-form-item class="form-item" v-show="type === 1" size="mini" label="报销进度">
          <el-radio-group v-model="operateData.reimbursement">
            <el-radio :label="0">无需报销</el-radio>
            <el-radio :label="1">待报销</el-radio>
            <el-radio :label="2">已提交</el-radio>
            <el-radio :label="3">已报销</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item class="form-item" v-show="type === 2" size="mini" label="收入类型">
          <el-select v-model="operateData.incomesTypeId" filterable placeholder="请选择" clearable>
            <el-option v-for="(item, index) in incomesTypes" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
          </el-select>
        </el-form-item>

        <el-form-item class="form-item" size="mini" label="内容">
          <el-input v-model="operateData.remark" placeholder="请输入"></el-input>
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button size="small" :loading="btnLoading" type="primary" @click="submitEditTransaction">确定</el-button>
        <el-button size="small" :disabled="btnLoading" @click="editDialog = false">取消</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import dayjs from 'dayjs'
import { addTransaction, getList, deleteTransaction, editTransaction, getCurrentMonthCost } from './api'
export default {
  data() {
    let _this = this
    return {
      loadingMore: false, // 加载更多数据
      noMore: false, // 暂无数据
      saveLoading: false,
      deleteDialog: false, // 删除按钮弹窗
      editDialog: false, // 编辑明细弹窗
      btnLoading: false, // 按钮loading
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
        belongUserId: '', // 归属人id
        costTypeId: '', // 支出类型
        incomesTypeId: '', // 收入类型
        payMethodId: '', // 支付方式
        remark: '' // 内容
      },
      pageContent: { pageIndex: 1, pageSize: 20 },
      users: [], // 记账人配置项
      costTypes: [], // 支出类型配置项
      incomesTypes: [], // 收入类型配置项
      payMethods: [], // 支付方式配置项
      showAdd: false, // 新增数据显示栏
      type: 1, // 类型：1=支出；2=收入
      typeName: 'costTypeName',
      // 新增信息
      addInformation: {
        date: '', // 日期
        costTypeId: '', // 支出类型（支出数据）
        payMethodId: '', // 支付方式（支出数据）
        reimbursement: 0, // 报销进度（支出数据）
        belongUserId: '', // 归属人（支出数据）
        incomesTypeId: '', // 收入类型（收入数据）
        money: 0, // 金额
        remark: '' // 内容
      },
      listData: [], // 交易明细数据
      totalCount: 0, // 总数
      currentCount: 0, // 当前加载总数
      operateData: null, // 正在操作的数据
      reimbursementData: ['无需报销', '待报销', '已提交', '已报销'],
      userInfo: {} // 用户信息
    }
  },

  created() {
    this.userInfo = this.$tools.getUserInfo()
  },
  computed: {
    ...mapState({
      billId: (state) => state.billId,
      bill: (state) => state.bill
    })
  },
  watch: {
    bill: {
      handler(bill) {
        const budget = bill.budget
        this.users = bill.users
        this.costTypes = bill.costTypes
        this.incomesTypes = bill.incomesTypes
        this.payMethods = bill.payMethods

        this.monthOverview.budget = budget.find((item) => item.date === dayjs(new Date()).format('YYYY-MM'))?.totalBudget || 0

        this.getList()
        this.getCurrentMonthCost()
      }
    },
    type: {
      handler(val) {
        this.typeName = val === 1 ? 'costTypeName' : 'incomesTypeName'
      }
    }
  },

  mounted() {},

  methods: {
    load() {
      if (this.totalCount === this.currentCount) {
        this.noMore = true
        return
      }
      this.loadingMore = true
      this.pageContent.pageIndex++
      this.getList()
    },
    // 显示删除弹窗
    showDeleteDialog(detail) {
      this.operateData = detail
      this.deleteDialog = true
    },
    // 显示编辑弹窗
    showEditDialog(detail) {
      this.operateData = detail
      this.editDialog = true
    },
    // 查询本月收支概况
    async getCurrentMonthCost() {
      const params = { billId: this.bill._id }
      const [err, res] = await getCurrentMonthCost({ params })
      if (err) return
      if (res.retCode === 0) {
        this.monthOverview.cost = res.data.cost
        this.monthOverview.incomes = res.data.incomes
      } else {
        this.$message.error('查询本月收支概况失败，', res.message)
      }
    },
    // 删除交易明细
    async submitDeleteTransaction() {
      const data = { id: this.operateData._id }
      this.btnLoading = true
      const [err, res] = await deleteTransaction({ data })
      this.btnLoading = false
      this.deleteDialog = false
      if (err) return
      if (res.retCode === 0) {
        this.$message.success('删除交易明细成功')
        this.search()
      } else {
        this.$message.error('删除交易明细失败，' + res.message)
      }
    },
    // 编辑交易明细
    async submitEditTransaction() {
      const operateData = this.operateData
      const data = {
        id: operateData.id,
        billId: operateData.billId,
        date: operateData.date,
        money: operateData.money,
        type: operateData.type,
        remark: operateData.remark,
        costTypeId: operateData.costTypeId,
        payMethodId: operateData.payMethodId,
        reimbursement: operateData.reimbursement,
        belongUserId: operateData.belongUserId
      }
      this.btnLoading = true
      const [err, res] = await editTransaction({ data })
      this.btnLoading = false
      this.deleteDialog = false
      this.editDialog = false
      if (err) return
      if (res.retCode === 0) {
        this.$message.success('编辑交易明细成功')
        this.search()
      } else {
        this.$message.error('编辑交易明细失败，' + res.message)
      }
    },
    // 切换新增数据栏显隐
    changeAddContainer() {
      this.showAdd = !this.showAdd
    },
    // 切换收入/支出类型
    changeAddType(type) {
      this.type = type
      this.search()
    },
    // 按钮查询
    search() {
      this.listData = []
      this.pageContent.pageIndex = 1
      this.pageContent.pageSize = 20
      this.getList()
      this.getCurrentMonthCost()
    },
    async getList() {
      const params = {
        beginDate: this.searchOptions.beginDate,
        endDate: this.searchOptions.endDate,
        belongUserId: this.searchOptions.belongUserId,
        pageIndex: this.pageContent.pageIndex,
        pageSize: this.pageContent.pageSize,
        type: this.type,
        billId: this.bill._id
      }
      const [err, res] = await getList({ params })
      this.loadingMore = false
      if (err) return
      if (res.retCode === 0) {
        // 构造收支金额时间线
        this.totalCount = res.data.total
        this.currentCount += res.data.datas.length
        const listData = this.setData(res.data.datas)
        // 获取收支金额数组最后一个日期内容
        const lastData = this.listData[this.listData.length - 1]
        if (listData.length > 0 && lastData?.date === listData[0]?.date) {
          this.mergeData(lastData, listData[0])
          listData.shift()
        }
        this.listData = this.listData.concat(listData)
      } else {
        this.$message.error('查询交易明细失败，' + res.message)
      }
    },
    // 统计每日各类型金额及总金额
    setData(data) {
      const arr = []
      let currDate = '' // 当前正在记录的日期，若存在，则代表已有相关对象
      data.forEach((item) => {
        if (item.date === currDate) {
          // 已存在日期
          const obj = arr[arr.length - 1]
          // 判断是否无需报销且已存在该类型
          if (item.reimbursement === 0) {
            obj.money += item.money
            const type = obj.types.find((type) => type.name === item[this.typeName])
            if (type) {
              type.money += item.money
            } else {
              obj.types.push({ name: item[this.typeName], money: item.money })
            }
          }
          obj.datas.push(item)
        } else {
          // 新日期
          currDate = item.date
          const obj = {
            date: currDate,
            money: 0,
            types: [],
            datas: [item]
          }
          if (item.reimbursement === 0) {
            // 无需报销时才记录类型
            obj.money = item.money
            obj.types = [{ name: item[this.typeName], money: item.money }]
          }
          arr.push(obj)
        }
      })
      return arr
    },
    // 合并同一日期的收支金额
    mergeData(firstData, secondData) {
      firstData.money += secondData.money

      secondData.types.forEach((item) => {
        const type = firstData.types.find((type) => type.name === item.name)
        if (type) {
          type.money += item.money
        } else {
          firstData.types.push({ name: item[this.typeName], money: item.money })
        }
      })
    },
    // 新增交易明细
    async addTransaction() {
      const addInformation = this.addInformation
      const data = {
        billId: this.bill._id,
        date: addInformation.date,
        money: addInformation.money,
        type: this.type,
        belongUserId: addInformation.belongUserId,
        remark: addInformation.remark
      }
      if (this.type === 1) {
        data.costTypeId = addInformation.costTypeId
        data.payMethodId = addInformation.payMethodId
        data.reimbursement = addInformation.reimbursement
      } else {
        data.incomesTypeId = addInformation.incomesTypeId
      }
      this.saveLoading = true
      const [err, res] = await addTransaction({ data })
      this.saveLoading = false
      if (err) return
      if (res.retCode === 0) {
        this.$message.success('新增交易明细成功')
        this.search()
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
    min-height: 0;
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
  .width-125 {
    .el-date-editor,
    .el-input,
    .el-input__inner {
      width: 125px;
    }
  }
  .width-150 {
    .el-date-editor,
    .el-input,
    .el-input__inner {
      width: 150px;
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
    .el-date-editor,
    .el-input,
    .el-input__inner {
      width: 320px;
    }
  }
}
</style>
