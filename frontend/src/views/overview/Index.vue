<template>
  <div class="overview-module">
    <div class="belong-user-module">
      <div class="title">收支概览</div>
      <div class="total-context">
        <div class="line">
          总支出：<span class="color-red">{{ belongUsers.totalCost }}</span>
        </div>
        <div class="line">
          总收入：<span class="color-green">{{ belongUsers.totalIncomes }}</span>
        </div>
      </div>
      <div class="detail">
        <div class="detail-item" v-for="item in belongUsers.details" :key="item.belongUserId + '_' + item.userId + '_' + item.type">
          ({{ item.userName }}) {{ item.belongUserName }}{{ item.type === 1 ? '支出：' : '收入：'
          }}<span :class="[item.type === 1 ? 'color-red' : 'color-green']">{{ item.money.toFixed(2) }}</span>
        </div>
      </div>
      <div class="add-data-container">
        <el-form :model="belongCondition" ref="form" class="form-container" labelPosition="top">
          <el-form-item prop="startDate" required size="small" label="开始时间">
            <el-date-picker style="width: 100%" v-model="belongCondition.startDate" value-format="yyyy-MM-dd" type="date" placeholder="开始时间">
            </el-date-picker>
          </el-form-item>
          <el-form-item prop="endDate" required size="small" label="结束时间">
            <el-date-picker style="width: 100%" v-model="belongCondition.endDate" value-format="yyyy-MM-dd" type="date" placeholder="结束时间">
            </el-date-picker>
          </el-form-item>
          <el-form-item prop="proportion" required size="small" :label="'比例（宜：栋）==>' + belongCondition.money">
            <el-input v-model="belongCondition.proportion" placeholder="比例（宜：栋）"></el-input>
          </el-form-item>
          <el-form-item class="form-item" size="small">
            <el-button type="primary" @click="getBalanceAndPieData">查询</el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
    <div class="chart-container">
      <div class="per-year-container">
        <div class="per-year-chart" id="perYearChart"></div>
        <div class="table-container">
          <div class="line bold">
            <div class="line-item">年份</div>
            <div class="line-item" v-for="item in perYearCostDatas.type" :key="item">{{ item }}</div>
            <div class="line-item">合计</div>
          </div>
          <div class="line" v-for="(item, index) in perYearCostDatas.datas" :key="item.name" :style="{ 'background-color': colorOptions[index] }">
            <div class="line-item bold">{{ item.name }}</div>
            <div class="line-item" v-for="(ite, idx) in item.datas" :key="idx">
              {{ ite }}
            </div>
            <div class="line-item">{{ item.total.toFixed(2) }}</div>
            <!-- <div class="line-item">{{ Number(item.total).toFixed(2) }}</div> -->
          </div>
        </div>
      </div>
      <div class="belong-type-container">
        <div class="belong-type-chart" id="belongTypeChart1"></div>
        <div class="belong-type-chart" id="belongTypeChart2"></div>
        <div class="belong-type-chart" id="belongTypeChart3"></div>
      </div>
    </div>
  </div>
</template>

<script>
import { getBalance, getThreeYearCost } from './api'
import { mapState } from 'vuex'
import dayjs from 'dayjs'
export default {
  data() {
    return {
      users: [], // 记账人配置项
      belongUsers: {
        totalCost: 0, // 总支出
        totalIncomes: 0, // 总收入
        details: []
      },
      belongCondition: {
        startDate: '',
        endDate: '',
        proportion: '954.44:1055',
        money: 0
      },
      // 年度支出趋势数据
      perYearCostDatas: {
        type: [],
        datas: []
      },
      colorOptions: ['#afd8ff', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'],
      // 年度支出趋势折线图配置
      perYearOptions: {
        title: { text: '近三年支出趋势' },
        tooltip: { trigger: 'axis' },
        legend: { data: [] },
        color: [],
        grid: {
          left: '1%',
          right: '1%',
          bottom: '0%',
          containLabel: true
        },
        xAxis: {
          type: 'category',
          boundaryGap: true,
          axisLabel: { fontSize: 16, interval: 0 },
          data: []
        },
        yAxis: { type: 'value', axisLabel: { fontSize: 16 } },
        series: []
      },
      // 年度支出趋势折线图
      perYearChart: null,
      // 各归属人不同类型支出数据
      belongTypeDatas: {},
      belongOptions: {
        title: {
          text: '',
          top: 50,
          left: 'center',
          subtextStyle: {
            fontSize: 16
          }
        },
        tooltip: {
          trigger: 'item',
          formatter: '{a} <br/>{b}: {c} ({d}%)'
        },
        legend: { type: 'scroll', data: [] },
        series: [
          {
            name: '',
            type: 'pie',
            selectedMode: 'single',
            radius: ['40', '50%'],
            top: '15%',
            label: {
              formatter: '{b}({d}%)',
              fontSize: 14
            },
            data: []
          }
        ]
      },
      belongTypeChart1: null,
      belongTypeChart2: null,
      belongTypeChart3: null
    }
  },
  mounted() {
    this.initChart()
    if (this.bill) {
      this.initData(this.bill)
    }
  },
  watch: {
    bill: {
      handler(bill) {
        this.initData(bill)
      }
    }
  },
  computed: {
    ...mapState({
      billId: (state) => state.billId,
      bill: (state) => state.bill
    })
  },
  methods: {
    initData(bill) {
      this.belongCondition.startDate = dayjs().startOf('month').format('YYYY-MM-DD')
      this.belongCondition.endDate = dayjs().format('YYYY-MM-DD')
      this.users = bill.users
      this.getBalanceAndPieData()
      this.getThreeYearCostData()
    },
    initChart() {
      this.perYearChart = this.$echarts.init(document.getElementById('perYearChart'))
      this.belongTypeChart1 = this.$echarts.init(document.getElementById('belongTypeChart1'))
      this.belongTypeChart2 = this.$echarts.init(document.getElementById('belongTypeChart2'))
      this.belongTypeChart3 = this.$echarts.init(document.getElementById('belongTypeChart3'))
      this.perYearOptions.color = this.colorOptions
      this.belongOptions.color = this.colorOptions
    },
    // 设置折线图
    setYearLineChartData() {
      this.perYearOptions.xAxis.data = this.perYearCostDatas.type
      this.perYearOptions.legend.data = []
      this.perYearOptions.series = []
      this.perYearCostDatas.datas.forEach((item) => {
        this.perYearOptions.legend.data.push(item.name)
        this.perYearOptions.series.push({ name: item.name, type: 'bar', data: item.datas })
      })
      this.perYearChart.setOption(this.perYearOptions, true)
    },
    // 设置饼图
    setPieData() {
      const setSeriesData = (target, source, chart, chartName) => {
        let total = 0
        this.belongOptions.title.text = chartName + '-各支出比例'
        target.name = chartName
        target.data = source.map((item) => {
          total += item.money
          return { value: item.money.toFixed(2), name: item.name }
        })
        this.belongOptions.title.subtext = '总花费：' + total.toFixed(2)
        chart.setOption(this.belongOptions, true)
      }
      this.belongOptions.legend.data = this.belongTypeDatas.type

      setSeriesData(this.belongOptions.series[0], this.belongTypeDatas['全部'], this.belongTypeChart1, '全部')
      setSeriesData(this.belongOptions.series[0], this.belongTypeDatas['宜'], this.belongTypeChart2, '宜')
      setSeriesData(this.belongOptions.series[0], this.belongTypeDatas['栋'], this.belongTypeChart3, '栋')
    },
    async getBalanceAndPieData() {
      const params = { billId: this.billId, beginDate: this.belongCondition.startDate, endDate: this.belongCondition.endDate }
      const [err, res] = await getBalance({ params })
      if (err) return
      if (res.retCode === 0) {
        this.belongUsers.totalCost = res.data.totalCost
        this.belongUsers.totalIncomes = res.data.totalIncomes
        this.belongUsers.details = res.data.belongUserCosts.map((item) => {
          item.userName = this.users.find((ite) => ite.id === item.userId).name
          return item
        })
        this.calculateMoney()
        this.setTypeData(res.data.costTypeRank)
        this.setPieData()
      } else {
        this.$message.error('查询概览失败，' + res.message)
      }
    },
    // 合计退款
    calculateMoney() {
      const costs = this.belongUsers.details
      const proportion = this.belongCondition.proportion.split(':')
      const total = Number(proportion[0]) + Number(proportion[1])
      let money = 0
      costs.forEach((item) => {
        if (item.userName === '宜') {
          if (item.belongUserId === '') {
            money += item.money * (proportion[1] / total)
          } else if (item.belongUserName === '栋') {
            money += item.money
          }
        } else if (item.userName === '栋') {
          if (item.belongUserId === '') {
            money -= item.money * (proportion[0] / total)
          } else if (item.belongUserName === '宜') {
            money -= item.money
          }
        }
      })
      this.belongCondition.money = money.toFixed(2)
    },
    // 查询过去三年支出概况
    async getThreeYearCostData() {
      const params = { billId: this.billId }
      const [err, res] = await getThreeYearCost(params)
      if (err) return
      if (res.retCode === 0) {
        const data = res.data
        this.perYearCostDatas = data
        data.datas.forEach((item) => {
          item.total = item.datas.reduce((prev, curr) => Number(prev) + Number(curr))
        })
        this.setYearLineChartData()
      } else {
        this.$message.error('查询过去三年支出概况失败，' + res.message)
      }
    },
    // 设置各归属人支出比例
    setTypeData(costTypeRank) {
      const proportion = this.belongCondition.proportion.split(':')
      const total = Number(proportion[0]) + Number(proportion[1])
      const proportion1 = proportion[0] / total // 宜比例
      const proportion2 = proportion[1] / total // 栋比例
      console.log(proportion1, proportion2, proportion)
      const data = {
        全部: [],
        宜: [],
        栋: []
      }
      const allRank = costTypeRank['全部'] || []
      const rank1 = costTypeRank['宜'] || [] // 宜
      const rank2 = costTypeRank['栋'] || [] // 栋
      // 全部类型数据处理
      const totalTypeDataHandle = (item) => {
        const allTypeDataIndex = data['全部'].findIndex((ite) => ite.type === item.type)
        if (allTypeDataIndex !== -1) {
          const obj = data['全部'][allTypeDataIndex]
          data['全部'][allTypeDataIndex] = { ...obj, money: obj.money + item.money }
        } else data['全部'].push(item)
      }
      allRank.forEach((item) => {
        data['全部'].push(item)
        data['宜'].push({ ...item, money: item.money * proportion1 })
        data['栋'].push({ ...item, money: item.money * proportion2 })
      })
      rank1.forEach((item) => {
        const index = data['宜'].findIndex((ite) => ite.type === item.type)
        if (index !== -1) {
          const obj = data['宜'][index]
          data['宜'][index] = { ...obj, money: obj.money + item.money }
        } else data['宜'].push(item)

        totalTypeDataHandle(item)
      })
      rank2.forEach((item) => {
        const index = data['栋'].findIndex((ite) => ite.type === item.type)
        if (index !== -1) {
          const obj = data['栋'][index]
          console.log(obj, 111)
          data['栋'][index] = { ...obj, money: obj.money + item.money }
        } else data['栋'].push(item)
        totalTypeDataHandle(item)
      })

      const sortData = (data) => {
        return data
          .sort((a, b) => b.money - a.money)
          .map((item) => {
            item.money = Number(item.money.toFixed(2))
            return item
          })
      }

      // 对数据进行排序
      data['全部'] = sortData(data['全部'])
      data['栋'] = sortData(data['栋'])
      data['宜'] = sortData(data['宜'])

      this.belongTypeDatas = data
    }
  }
}
</script>

<style lang="scss">
.overview-module {
  height: calc(100% - 60px);
  width: 100%;
  background-color: #fff;
  display: flex;
  align-items: center;
  padding: 20px;
  .color-red {
    color: rgb(247, 79, 79);
  }
  .color-green {
    color: #18a356;
  }
  .belong-user-module {
    width: 300px;
    height: 100%;
    margin-right: 20px;
    border-radius: 8px;
    box-shadow: 1px 1px 5px #999;
    background-color: #fff;
    padding: 20px;
    display: flex;
    flex-direction: column;
    .title {
      font-size: 26px;
      font-weight: bold;
      text-align: center;
      // height: 30px;
      // line-height: 30px;
      margin-bottom: 20px;
    }
    .total-context {
      padding-bottom: 10px;
      border-top: 1px solid #ddd;
      border-bottom: 1px solid #ddd;
      font-size: 24px;
      .line {
        padding-top: 10px;
      }
    }
    .detail {
      flex: 1;
      min-height: 0;
      .detail-item {
        height: 35px;
        line-height: 35px;
        font-size: 20px;
        border-bottom: 1px dotted #ccc;
      }
    }
    .add-data-container {
      width: 100%;
      height: 320px;
      border-top: 1px solid #ddd;
      .form-item {
        text-align: center;
      }
    }
  }
  .chart-container {
    flex: 1;
    min-width: 0;
    height: 100%;
    .per-year-container {
      box-shadow: 1px 1px 5px #999;
      border-radius: 8px;
      width: 100%;
      height: 50%;
      padding: 10px;
      display: flex;
      flex-direction: column;
      .per-year-chart {
        flex: 1;
        min-height: 0;
        width: 100%;
        margin: 20px 0;
      }
      .table-container {
        width: 100%;
        height: 122px;
        border: 1px solid #aaa;
        .bold {
          font-weight: bold;
        }
        .line {
          height: 30px;
          line-height: 30px;
          display: flex;
          align-items: center;
          & + .line {
            border-top: 1px solid #aaa;
          }
          .line-item {
            flex: 1;
            min-width: auto;
            height: 100%;
            text-align: center;
            & + .line-item {
              border-left: 1px solid #aaa;
            }
          }
        }
      }
    }
    .belong-type-container {
      margin-top: 20px;
      width: 100%;
      height: calc(50% - 20px);
      display: flex;
      align-items: center;
      justify-content: space-around;
      .belong-type-chart {
        width: 32%;
        height: 100%;
        box-shadow: 1px 1px 5px #999;
        border-radius: 8px;
      }
    }
  }
}
</style>
