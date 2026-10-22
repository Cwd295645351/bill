<template>
  <div class="overview-module">
    <div class="belong-user-module">
      <div class="title">收支概览</div>
      <div class="total-context">
        <div class="line">
          总支出：<span class="color-red">{{ belongUsers.totalCost }}</span>
        </div>
        <div class="line">
          总投资：<span class="color-red">{{ belongUsers.investCost }}</span>
        </div>
        <div class="line">
          总消费：<span class="color-red">{{ belongUsers.consumptionCost.toFixed(2) }}</span>
        </div>
        <div class="line">
          总收入：<span class="color-green">{{ belongUsers.totalIncomes }}</span>
        </div>
      </div>
      <div class="detail">
        <div class="detail-item" v-for="item in incomeDetails" :key="item.belongUserIds.join(',') + '_' + item.userId + '_' + item.type">
          ({{ item.userName }}) {{ item.belongUserName }}收入：<span class="color-green">{{ item.money.toFixed(2) }}</span>
        </div>
      </div>
      <div class="add-data-container">
        <el-form :model="belongCondition" ref="form" class="form-container" labelPosition="top">
          <el-form-item prop="startDate" required size="small" label="开始时间">
            <el-date-picker style="width: 100%" v-model="belongCondition.startDate" value-format="x" type="date" placeholder="开始时间"> </el-date-picker>
          </el-form-item>
          <el-form-item prop="endDate" required size="small" label="结束时间">
            <el-date-picker style="width: 100%" v-model="belongCondition.endDate" value-format="x" type="date" placeholder="结束时间"> </el-date-picker>
          </el-form-item>
          <el-form-item class="form-item" size="small">
            <el-button type="primary" @click="getBalanceAndPieData">查询</el-button>
          </el-form-item>
          <div class="settlement-lines">
            <div class="settlement-line" v-for="(line, index) in settlementLines" :key="index">{{ line }}</div>
          </div>
        </el-form>
      </div>
    </div>
    <div class="chart-container">
      <el-scrollbar height="100%">
        <div class="per-year-container">
          <div class="per-year-chart" id="perYearChart"></div>
          <el-table :data="perYearCostDatas.datas" :row-style="getRowStyle" border class="per-year-table">
            <el-table-column prop="name" label="年份" align="center" width="90" fixed="left">
              <template #default="{ row }">
                <span class="bold">{{ row.name }}</span>
              </template>
            </el-table-column>
            <el-table-column label="总消费" align="center" min-width="110">
              <template #default="{ row }">
                {{ row.consumption != null ? Number(row.consumption).toFixed(2) : '0.00' }}
              </template>
            </el-table-column>
            <el-table-column label="总支出" align="center" min-width="110">
              <template #default="{ row }">
                {{ row.total != null ? Number(row.total).toFixed(2) : '0.00' }}
              </template>
            </el-table-column>
            <el-table-column v-for="member in perYearCostDatas.members" :key="'expense_' + member.userId" :label="`${member.name}支出`" align="center" min-width="110">
              <template #default="{ row }">
                {{ row.memberExpenses?.[member.name] != null ? Number(row.memberExpenses[member.name]).toFixed(2) : '0.00' }}
              </template>
            </el-table-column>
            <el-table-column label="总收入" align="center" min-width="110">
              <template #default="{ row }">
                {{ row.totalIncome != null ? Number(row.totalIncome).toFixed(2) : '0.00' }}
              </template>
            </el-table-column>
            <el-table-column v-for="member in perYearCostDatas.members" :key="'income_' + member.userId" :label="`${member.name}收入`" align="center" min-width="110">
              <template #default="{ row }">
                {{ row.memberIncomes?.[member.name] != null ? Number(row.memberIncomes[member.name]).toFixed(2) : '0.00' }}
              </template>
            </el-table-column>

            <el-table-column v-for="(item, idx) in perYearCostDatas.type" :key="item" :label="item" align="center" min-width="105">
              <template #default="{ row }">
                {{ row.datas?.[idx] }}
              </template>
            </el-table-column>
          </el-table>
        </div>
        <div class="belong-type-container">
          <div class="belong-type-chart" v-for="i in chartCount" :key="i" :id="'belongTypeChart' + (i - 1)"></div>
        </div>
      </el-scrollbar>
    </div>
    <el-dialog v-model="dialogVisible" :title="`${currentCategory} - 消费明细 (共 ${currentCategoryTotal} 元)`" width="70%">
      <el-table :data="detailList" v-loading="loading" stripe height="500px">
        <el-table-column property="date" label="日期" width="160" sortable></el-table-column>
        <el-table-column property="userName" label="记账人" width="100"></el-table-column>
        <el-table-column property="belongUserName" label="归属人" width="100"></el-table-column>
        <el-table-column property="money" label="金额" width="140" sortable>
          <template #default="scope">
            <span class="color-red">{{ Number(scope.row.money).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column property="remark" label="备注"></el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useOverview } from './hooks/use-overview'
import { useTypeChart } from './hooks/use-type-chart'
const colorOptions = ['#afd8ff', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc']
const { perYearCostDatas } = useOverview({ colorOptions })
const { users, quantityRules, belongCondition, belongUsers, settlementLines, getBalanceAndPieData, dialogVisible, detailList, loading, currentCategory, currentCategoryTotal, chartCount } =
  useTypeChart({ colorOptions })
/** 明细只展示收入。分账按区间内的支出计算，不看这些行是否出现在屏幕上 */
const incomeDetails = computed(() => belongUsers.value.details.filter((item) => item.type !== 1))

/** 表格行背景色匹配年度折线/柱状图色彩 */
const getRowStyle = ({ rowIndex }: { rowIndex: number }) => {
  if (colorOptions[rowIndex]) {
    return {
      backgroundColor: colorOptions[rowIndex],
      '--el-table-tr-bg-color': colorOptions[rowIndex],
    }
  }
  return {}
}
</script>
<style lang="scss" scoped>
.overview-module {
  flex: 1;
  min-height: 0;
  width: 100%;
  background-color: #fafafa;
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
    width: 200px;
    height: 100%;
    margin-right: 10px;
    border-radius: 8px;
    box-shadow: 1px 1px 5px #ddd;
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
        line-height: 35px;
        font-size: 20px;
        border-bottom: 1px dotted #ccc;
      }
    }
    .add-data-container {
      width: 100%;
      border-top: 1px solid #ddd;
      :deep(.el-form-item) {
        margin-bottom: 10px;
      }
      .form-item {
        :deep(.el-form-item__content) {
          justify-content: center;
        }
      }
      .settlement-lines {
        padding-top: 4px;
      }
      .settlement-line {
        font-size: 16px;
        line-height: 26px;
        color: #333;
      }
    }
  }
  .chart-container {
    flex: 1;
    min-width: 0;
    min-height: 0;
    height: 100%;
    container-type: size;
    :deep(.el-scrollbar__view) {
      padding: 0 2px 2px 2px;
      box-sizing: border-box;
    }
    .per-year-container {
      background-color: #fff;
      box-shadow: 1px 1px 5px #ddd;
      border-radius: 8px;
      width: 100%;
      height: 572px;
      padding: 10px;
      display: flex;
      flex-direction: column;
      .per-year-chart {
        flex: 1;
        min-height: 0;
        width: 100%;
        margin-bottom: 20px;
      }
      .per-year-table {
        width: 100%;
        height: 194px;
        font-size: 16px;
        .bold {
          font-weight: bold;
        }
        :deep(.el-table__cell) {
          font-size: 16px;
          color: #333;
          padding: 4px 0;
        }
        :deep(th.el-table__cell) {
          color: #333;
          font-weight: bold;
        }
      }
    }
    .belong-type-container {
      margin-top: 10px;
      width: 100%;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      grid-auto-rows: 393px;
      gap: 10px;
      .belong-type-chart {
        background-color: #fff;
        min-width: 0;
        height: 100%;
        box-shadow: 1px 1px 5px #ddd;
        border-radius: 8px;
      }
    }
  }
}
</style>
