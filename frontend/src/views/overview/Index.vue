<template>
  <div class="overview-module">
    <div class="belong-user-module">
      <div class="title">收支概览</div>
      <div class="total-context">
        <div class="line">
          总支出：<span class="color-red">{{ belongUsers.totalCost }}</span>
        </div>
        <div class="line">
          总收入：<span class="color-red">{{ belongUsers.totalIncomes }}</span>
        </div>
      </div>
      <div class="detail">
        <div class="detail-item" v-for="item in belongUsers.details" :key="item.belongUserId + '_' + item.userId">
          ({{ item.userName }}) {{ item.belongUserName }}支出：<span class="color-red">{{ item.money.toFixed(2) }}</span>
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
          <el-form-item prop="proportion" required size="small" label="比例（宜：栋）">
            <el-input v-model="belongCondition.proportion" placeholder="比例（宜：栋）"></el-input>
          </el-form-item>
          <el-form-item class="form-item" size="small">
            <el-button type="primary" @click="search">查询</el-button>
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
          </div>
          <div class="line" v-for="(item, index) in perYearCostDatas.datas" :key="item.name" :style="{ 'background-color': colorOptions[index] }">
            <div class="line-item bold">{{ item.name }}</div>
            <div class="line-item" v-for="(ite, idx) in item.datas" :key="idx">
              {{ ite }}
            </div>
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
export default {
  data() {
    return {
      belongUsers: {
        totalCost: 0, // 总支出
        totalIncomes: 0, // 总收入
        details: [
          {
            belongUserId: '63023d593783325f04872f00',
            belongUserName: '栋',
            money: 142,
            userId: '63023d593783325f04872f00',
            userName: '栋'
          },
          {
            belongUserId: '630cd5db5d09bb41002461bb',
            belongUserName: '宜',
            money: 142,
            userId: '63023d593783325f04872f00',
            userName: '栋'
          },
          {
            belongUserId: '',
            belongUserName: '全部',
            money: 142,
            userId: '63023d593783325f04872f00',
            userName: '栋'
          },
          {
            belongUserId: '630cd5db5d09bb41002461bb',
            belongUserName: '宜',
            money: 142,
            userId: '630cd5db5d09bb41002461bb',
            userName: '宜'
          },
          {
            belongUserId: '63023d593783325f04872f00',
            belongUserName: '栋',
            money: 142,
            userId: '630cd5db5d09bb41002461bb',
            userName: '宜'
          },
          {
            belongUserId: '',
            belongUserName: '全部',
            money: 142,
            userId: '630cd5db5d09bb41002461bb',
            userName: '宜'
          }
        ]
      },
      belongCondition: {
        startDate: '',
        endDate: '',
        proportion: '954.44:1055'
      },
      // 年度支出趋势数据
      perYearCostDatas: {
        type: ['住房', '餐饮买菜', '交通', '日用品', '家居', '餐饮买菜1', '交通1', '日用品1', '家居1', '餐饮买菜2', '交通2', '日用品2', '家居2'],
        datas: [
          { name: '2020', datas: [42154, 12055, 414, 816, 6151, 12055, 414, 816, 6151, 12055, 414, 816, 6151] },
          { name: '2021', datas: [48154, 13055, 504, 836, 5151, 13055, 504, 836, 5151, 13055, 504, 836, 5151] },
          { name: '2022', datas: [52154, 16055, 614, 786, 4151, 16055, 614, 786, 4151, 16055, 614, 786, 4151] }
        ]
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
          axisLabel: { fontSize: 16 },
          data: []
        },
        yAxis: { type: 'value', axisLabel: { fontSize: 16 } },
        series: []
      },
      // 年度支出趋势折线图
      perYearChart: null,
      // 各归属人不同类型支出数据
      belongTypeDatas: {
        type: ['住房', '餐饮买菜', '交通', '日用品', '家居', '餐饮买菜1', '交通1', '日用品1', '家居1', '餐饮买菜2', '交通2', '日用品2', '家居2'],
        datas: [
          { name: '全部', datas: [42154, 12055, 414, 816, 6151, 12055, 414, 86, 6151, 12055, 414, 816, 6151] },
          { name: '栋', datas: [48154, 1355, 504, 836, 5151, 1305, 504, 836, 5151, 1355, 504, 836, 5151] },
          { name: '宜', datas: [5154, 16055, 614, 786, 4151, 16055, 614, 786, 4151, 16055, 614, 786, 4151] }
        ]
      },
      belongOptions: {
        title: {
          text: '',
          top: 50,
          left: 'center'
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
            radius: ['30', '50%'],
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
    this.perYearChart = this.$echarts.init(document.getElementById('perYearChart'))
    this.belongTypeChart1 = this.$echarts.init(document.getElementById('belongTypeChart1'))
    this.belongTypeChart2 = this.$echarts.init(document.getElementById('belongTypeChart2'))
    this.belongTypeChart3 = this.$echarts.init(document.getElementById('belongTypeChart3'))
    this.perYearOptions.color = this.colorOptions
    this.belongOptions.color = this.colorOptions
    this.setYearLineChartData()
    this.setPieData()
  },
  methods: {
    search() {
      console.log(this.belongCondition)
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
      const setSeriesData = (target, source, chart) => {
        this.belongOptions.title.text = source.name + '-各支出比例'
        target.name = source.name
        target.data = source.datas.map((item, index) => {
          return { value: item, name: this.belongTypeDatas.type[index] }
        })
        chart.setOption(this.belongOptions, true)
      }
      this.belongOptions.legend.data = this.belongTypeDatas.type
      setSeriesData(this.belongOptions.series[0], this.belongTypeDatas.datas[0], this.belongTypeChart1)
      setSeriesData(this.belongOptions.series[0], this.belongTypeDatas.datas[1], this.belongTypeChart2)
      setSeriesData(this.belongOptions.series[0], this.belongTypeDatas.datas[2], this.belongTypeChart3)
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
            min-width: 0;
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
