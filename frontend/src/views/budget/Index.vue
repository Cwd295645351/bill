<template>
  <div class="budget-container">
    <div class="budget-overview-container">
      <div class="total">
        年度预算：<span class="num">{{ total }}</span>
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
    <div class="budget-list-cards"></div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
export default {
  data() {
    return {
      total: '120000.00', // 总预算
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
            data: [
              { value: 1048, name: '餐饮买菜' },
              { value: 735, name: '日用品' },
              { value: 580, name: '衣服鞋帽' },
              { value: 484, name: '休闲娱乐' },
              { value: 300, name: '零食饮料' }
            ],
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
    addBudget() {
      this.$refs.addForm.validate((valid) => {
        if (valid) {
          alert('submit!')
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
    border-radius: 8px;
    box-shadow: 1px 1px 5px #ddd;
  }
}
</style>
