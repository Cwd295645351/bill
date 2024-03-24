<template>
  <div class="search-list-page">
    <van-search v-model="searchOptions.remark" show-action label="内容" shape="round" background="#4285F4" placeholder="请输入搜索关键词" @search="initSearch">
      <template #action>
        <div @click="showSearchCondition = true" style="color: #fff">筛选</div>
      </template>
    </van-search>
    <div class="search-list-container">
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
    </div>
  </div>
  <!-- 右侧弹出 -->
  <van-popup v-model:show="showSearchCondition" position="right" :style="{ width: '80%', height: '100%' }">
    <van-form @submit="searchDatas">
      <van-field v-model="searchOptions.beginDate" is-link readonly name="datePicker" label="开始时间" placeholder="点击选择时间" @click="showDatePickerAction('beginDate')" />
      <van-field v-model="searchOptions.endDate" is-link readonly name="datePicker" label="结束时间" placeholder="点击选择时间" @click="showDatePickerAction('endDate')" />
      <van-field v-model="searchOptions.remark" name="input" label="内容" placeholder="请输入内容" />
      <van-field v-model="searchOptions.userName" is-link readonly name="picker" label="记账人" placeholder="点击选择记账人" @click="showPickerAction('user')" />
      <van-field v-model="searchOptions.belongUserName" is-link readonly name="picker" label="归属人" placeholder="点击选择归属人" @click="showPickerAction('belongUser')" />
      <van-field name="radio" label="收支类型">
        <template #input>
          <van-radio-group v-model="searchOptions.type" direction="horizontal">
            <van-radio :name="1">支出</van-radio>
            <van-radio :name="2">收入</van-radio>
          </van-radio-group>
        </template>
      </van-field>
      <van-field
        v-show="searchOptions.type === 1"
        v-model="searchOptions.costTypeName"
        is-link
        readonly
        name="picker"
        label="支出类型"
        placeholder="点击选择支出类型"
        @click="showPickerAction('costType')"
      />
      <van-field
        v-show="searchOptions.type === 1"
        v-model="searchOptions.payMethodName"
        is-link
        readonly
        name="picker"
        label="支付方式"
        placeholder="点击选择支付方式"
        @click="showPickerAction('payMethod')"
      />
      <van-field
        v-show="searchOptions.type === 2"
        v-model="searchOptions.incomesTypeName"
        is-link
        readonly
        name="picker"
        label="收入类型"
        placeholder="点击选择收入类型"
        @click="showPickerAction('incomeType')"
      />
      <van-field
        v-show="searchOptions.type === 1"
        v-model="searchOptions.conditionName"
        is-link
        readonly
        name="picker"
        label="金额类型"
        placeholder="点击选择金额类型"
        @click="showPickerAction('condition')"
      />
      <van-field v-model="searchOptions.rangeMoney" name="input" label="金额" placeholder="请输入金额" />

      <div style="margin: 16px">
        <van-button round block type="primary" native-type="submit"> 提交 </van-button>
      </div>
    </van-form>
    <van-popup v-model:show="showSelectPicker" position="bottom">
      <van-picker :columns="currentPickerOptions.options" :columns-field-names="{ text: 'name', value: 'id' }" @confirm="onConfirmPicker" @cancel="showSelectPicker = false" />
    </van-popup>
    <van-popup v-model:show="showDatePicker" position="bottom">
      <van-date-picker @confirm="onConfirmDatePicker" @cancel="showDatePicker = false" />
    </van-popup>
  </van-popup>
</template>

<script setup lang="ts">
import { Ref, ref } from 'vue'
import { useSearch } from './hooks/use-search'

const {
  showSearchCondition,
  searchList,
  searchOptions,
  showSelectPicker,
  showDatePicker,
  currentPickerOptions,
  showPickerAction,
  onConfirmPicker,
  showDatePickerAction,
  onConfirmDatePicker,
  searchDatas,
  initSearch
} = useSearch()
</script>

<style scoped lang="scss">
.search-list-page {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  .search-list-container {
    flex: 1;
    min-height: 0;
    height: 100%;
    background-color: #fbfbfb;
    padding: 10px;
    color: #333;
    overflow: auto;
    .day-info {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      height: 24px;
      margin-bottom: 2px;
      .day-cost {
        .cost {
          color: #f74f4f;
        }
        .incomes {
          color: #18a356;
        }
      }
    }
    .list-item {
      width: 100%;
      box-shadow: 0px 0px 4px 0px #ccc;
      padding: 5px;
      border-radius: 2px;
      background-color: #fff;
      & + .day-info {
        margin-top: 10px;
      }

      .record-item {
        width: 100%;
        height: calc(100% - 24px);
        padding: 4px;
        & + .record-item {
          border-top: 1px dotted #ddd;
        }
        .record-overview {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 24px;
          width: 100%;
          .record-money {
            &.cost {
              color: #f74f4f;
            }
            &.incomes {
              color: #18a356;
            }
          }
        }
        .record-context {
          color: #999;
          font-size: 12px;
          padding-top: 2px;
        }
      }
    }
  }
}
</style>
