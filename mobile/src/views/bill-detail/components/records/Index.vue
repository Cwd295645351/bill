<template>
  <div class="record-container">
    <div class="title-header">
      <div class="bill-name">{{ bill?.name }}</div>
      <van-icon name="search" size="30" color="#fff" @click="jumpToSearchPage" />
    </div>
    <div class="context-container van-safe-area-bottom">
      <div class="budget-cost-card">
        <div class="budget-item">
          <div class="item-title">年度支出</div>
          <div class="item-number">{{ budgetInfo.currCost.toFixed(2) }}</div>
        </div>
        <div class="budget-item">
          <div class="item-title">当月支出</div>
          <div class="item-number">{{ budgetInfo.currentMonthCost }}</div>
        </div>
        <div class="budget-item">
          <div class="item-title">剩余预算</div>
          <div class="item-number">{{ budgetInfo.restBudget.toFixed(2) }}</div>
        </div>
      </div>
      <van-button class="add-new-record" icon="records" size="large" type="primary">添加一条新记账</van-button>
      <div class="record-list">
        <van-list v-model:loading="loading" :finished="loadFinish" finished-text="没有更多了" @load="loadDatas">
          <template v-for="item in searchList">
            <div class="day-info">
              <div class="date">
                {{ item.date }} <span style="color: #999">{{ item.week }}</span>
              </div>
              <div class="day-cost">
                收：<span class="incomes">{{ item.incomes }}</span> 支：<span class="cost">{{ item.cost.toFixed(2) }}</span>
              </div>
            </div>
            <div class="list-item">
              <div class="record-item" v-for="record in item.arr">
                <div class="record-overview">
                  <div class="record-detail">{{ record.belongUserName }}--{{ record.type === 1 ? record.costTypeName : record.incomesTypeName }}</div>
                  <div class="record-money" :class="[record.type === 1 ? 'cost' : 'incomes']">{{ record.money }}</div>
                </div>
                <div class="record-context">{{ record.remark }}</div>
              </div>
            </div>
          </template>
        </van-list>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import router from '@/router'
import { useBudget } from './hooks/use-budget'
import { useSearch } from './hooks/use-search'
import { ref } from 'vue'

const store = useBillStore()
const { bill } = storeToRefs(store)

const pageIndex = ref(1)
const loadFinish = ref(false)

const { budgetInfo } = useBudget()

const { total, loading, searchList, searchDatas } = useSearch(40)

const loadDatas = async () => {
  await searchDatas(pageIndex.value++)
  if (total.value === searchList.value.length) loadFinish.value = true
}

const jumpToSearchPage = () => {
  router.push('/bill-record-search')
}
</script>

<style scoped lang="scss">
@import './styles/record-item.scss';

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
    background-color: #4285f4;
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
    display: flex;
    flex-direction: column;
    overflow: auto;
    min-height: 0;
    width: 100%;
    padding: 10px 10px 0;
    background-color: #eee;
    .budget-cost-card {
      display: flex;
      width: 100%;
      height: 120px;
      border-radius: 4px;
      padding: 10px;
      color: #333;
      background-image: linear-gradient(153deg, #dcf8f9 10%, #4285f4 100%);
      box-shadow: 1px 1px 3px 0 #999;

      .budget-item {
        text-align: center;
        .item-title {
          margin-bottom: 10px;
          font-size: 14px;
          color: #999;
        }
        & + .budget-item {
          margin-left: 20px;
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
