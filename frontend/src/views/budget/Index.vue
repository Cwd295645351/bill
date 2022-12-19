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
        <el-form :model="addInformation" ref="addForm" :rules="rules" class="form-container" labelPosition="top">
          <el-form-item prop="costTypeId" required size="mini" label="支出类型">
            <el-select style="width: 100%" v-model="addInformation.costTypeId" filterable placeholder="请选择" clearable>
              <el-option v-for="(item, index) in costTypes" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item prop="money" required size="mini" label="金额">
            <el-input v-model="addInformation.money" clearable placeholder="请输入"></el-input>
          </el-form-item>
          <el-form-item class="form-item" size="mini">
            <el-button type="primary" :disabled="saveLoading" @click="addBudget">保存</el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
    <div class="budget-list-cards">
      <div class="budget-list-card-item" v-for="(item, index) in budgetDetails" :key="item.costTypeId + index">
        <div class="type">{{ item.costTypeName }}</div>
        <div class="tips">预算：{{ item.budget }}</div>
        <div class="line budget"></div>
        <div class="tips">花费：{{ item.cost }}</div>
        <div class="line cost" :style="{ width: `${item.costPercent * 100}%`, background: item.costPercent !== 1 ? '#33e392' : 'red' }"></div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import { getBudgetList, addBudget, deleteBudget } from './api'
export default {
  data() {
    return {
      totalBudget: '0', // 总预算
      totalCost: '0', // 总支出
      year: '', // 当前年度
      saveLoading: false,
      costTypes: [], // 支出类型配置项
      addInformation: {
        costTypeId: '', // 类型
        money: 0 // 金额
      },
      chart: null,
      options: {
        title: {
          text: '各支出类型预算占比',
          left: 'center',
          top: 100,
          textStyle: {
            fontSize: 24
          }
        },
        tooltip: {
          trigger: 'item'
        },
        legend: {
          orient: 'horizontal',
          bottom: 100
        },
        series: [
          {
            name: '各支出类型占比',
            type: 'pie',
            radius: '50%',
            data: [],
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0, 0, 0, 0.5)'
              }
            }
          }
        ]
      },
      budgetDetails: [], // 预算明细列表
      rules: {
        money: [
          { required: true, message: '请输入金额', trigger: 'change' },
          {
            validator: (rule, value, callback) => {
              const num = Number(value)
              if (isNaN(num)) {
                callback(new Error('请输入数字'))
              } else if (num <= 0) {
                callback(new Error('金额必须为正数'))
              } else {
                callback()
              }
            },
            trigger: 'blur'
          }
        ],
        costTypeId: [{ required: true, message: '请选择支出类型', trigger: 'change' }]
      }
    }
  },

  created() {
    this.year = new Date().getFullYear()
    this.getDetail()
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
        this.costTypes = bill.costTypes
      }
    }
  },

  mounted() {
    this.chart = this.$echarts.init(document.getElementById('budgetStatistics'))
    setTimeout(() => {
      this.initEcharts()
    }, 200)
  },

  methods: {
    // 获取当前年度预算详情
    async getDetail() {
      const params = { date: this.year, billId: this.billId }
      const [err, res] = await getBudgetList({ params })
      const seriesData = (this.options.series[0].data = [])
      if (err) return
      if (res.retCode === 0) {
        console.log(res)
        const data = res.data
        this.totalBudget = data.totalBudget
        this.totalCost = data.currCost
        this.budgetDetails = data.details.map((item) => {
          seriesData.push({ value: item.cost, name: item.costTypeName })
          const costPercent = item.cost / item.budget
          item.costPercent = costPercent > 1 ? 1 : costPercent
          return item
        })
      } else {
        this.$message.error('获取当前年度预算失败，' + res.message)
      }
    },
    addBudget() {
      this.$refs.addForm.validate(async (valid) => {
        if (valid) {
          alert('submit!')
          const data = { date: this.year, billId: this.billId, costTypeId: this.addInformation.costTypeId, money: this.addInformation.money }
          const [err, res] = await addBudget({ data })
          if (err) return
          if (res.retCode === 0) {
            this.$message.success('新增预算成功')
            this.getDetail()
          } else {
            this.$message.error('新增预算失败，' + res.message)
          }
        } else {
          return false
        }
      })
    },
    initEcharts() {
      this.chart.setOption(this.options, true)
    }
  }
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
    width: 300px;
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
        text-align: center;
      }
    }
  }
  .budget-list-cards {
    flex: 1;
    height: 100%;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    // background-color: #fafafa;
    .budget-list-card-item {
      width: 200px;
      height: 150px;
      border-radius: 4px;
      box-shadow: 1px 1px 5px #ddd;
      padding: 10px;
      margin-right: 20px;
      margin-bottom: 20px;
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
    }
  }
}
</style>
