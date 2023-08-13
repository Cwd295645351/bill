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
          ({{ item.userName }}) {{ item.belongUserName }}{{ item.type === 1 ? '支出：' : '收入：' }}<span :class="[item.type === 1 ? 'color-red' : 'color-green']">{{ item.money.toFixed(2) }}</span>
        </div>
      </div>
      <div class="add-data-container">
        <el-form :model="belongCondition" ref="form" class="form-container" labelPosition="top">
          <el-form-item prop="startDate" required size="small" label="开始时间">
            <el-date-picker style="width: 100%" v-model="belongCondition.startDate" value-format="YYYY-MM-DD" type="date" placeholder="开始时间"> </el-date-picker>
          </el-form-item>
          <el-form-item prop="endDate" required size="small" label="结束时间">
            <el-date-picker style="width: 100%" v-model="belongCondition.endDate" value-format="YYYY-MM-DD" type="date" placeholder="结束时间"> </el-date-picker>
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

<script setup lang="ts">
import { useOverview } from './hooks/use-overview'
import { useTypeChart } from './hooks/use-type-chart'
const colorOptions = ['#afd8ff', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc']
const { perYearCostDatas } = useOverview({ colorOptions })
const { belongCondition, belongUsers, getBalanceAndPieData } = useTypeChart({ colorOptions })
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
        .el-form-item__content {
          justify-content: center;
        }
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
