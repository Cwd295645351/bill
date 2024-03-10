<template>
  <div class="record-container">
    <div class="title-header">
      <div class="bill-name">{{ bill.name }}</div>
      <div class="operater-box">搜索按钮</div>
    </div>
    <div class="context-container">
      <div class="budget-cost-card">
        <div class="item-box cost">年度支出：{{ budgetInfo.currCost.toFixed(2) }}</div>
        <div class="item-box budget">剩余预算：{{ budgetInfo.restBudget.toFixed(2) }}</div>
      </div>
      <van-button class="add-new-record" icon="records" size="large" type="primary">添加一条新记账</van-button>
      <div class="record-list"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import { useBudget } from './hooks/use-budget'

const store = useBillStore()
const { billId, bill } = storeToRefs(store)

const { getBudgetInfo, budgetInfo } = useBudget(billId as Ref<string>)
</script>

<style scoped lang="scss">
.record-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #fbfbfb;
  .title-header {
    width: 100%;
    height: 40px;
    padding: 0 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    line-height: 40px;
    background-color: #4285F4;
    .bill-name {
      flex: 1;
      height: 100%;
      color: #fff;
    }
    .operater-box {
      height: 100%;
    }
  }
  .context-container {
    flex: 1;
    min-height: 0;
    width: 100%;
    padding: 10px;
    display: flex;
    flex-direction: column;
    .budget-cost-card {
      width: 100%;
      height: 120px;
      border-radius: 4px;
      padding: 10px;
      background-color: #7baeff;
      color: #fff;

      .item-box {
        &.cost {
          // color: #f74f4f
        }
        .budget {
        }
        & + .item-box {
          margin-top: 5px;
        }
      }
    }
    .add-new-record {
      margin: 10px 0;
    }
    .record-list {
      flex: 1;
      min-height: 0;
      width: 100%;
    }
  }
}
</style>
