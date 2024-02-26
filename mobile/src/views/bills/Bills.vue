<template>
  <van-pull-refresh class="bills-list-container" v-model="billListLoading" @refresh="getBillList">
    <div v-for="item in billList" class="bill-item">
      <van-swipe-cell :name="item._id" :before-close="billEvent">
        <template #left>
          <van-button square type="primary" text="分享" />
        </template>
        <van-cell :border="false" :title="item.name" is-link @click="onBillClick(item)" />
        <template #right>
          <van-button square type="danger" text="删除" />
        </template>
      </van-swipe-cell>
      <div class="decorate-bottom"></div>
    </div>
    <van-empty v-if="showEmpty" description="当前无账本">
      <van-button round type="primary" class="bottom-button">新增账本</van-button>
    </van-empty>
  </van-pull-refresh>
</template>

<script setup lang="ts">
import { useBills } from './hooks/use-bills'

const { billList, showEmpty, billListLoading, getBillList, billEvent, onBillClick } = useBills()
</script>

<style scoped lang="scss">
.bills-list-container {
  width: 100%;
  height: 100%;
  background-color: #fbfbfb;
  padding: 20px;
  .bill-item {
    width: 100%;
    border: 1px solid #ddd;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 1px 1px 1px #eee;
    & + .bill-item {
      margin-top: 10px;
    }
    .decorate-bottom {
      width: 100%;
      height: 4px;
      background-color: #7baeff;
    }
  }
}
</style>
