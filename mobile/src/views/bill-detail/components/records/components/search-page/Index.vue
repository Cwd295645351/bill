<template>
  <van-search v-model="searchOptions.remark" show-action label="内容" shape="round" background="#4285F4" placeholder="请输入搜索关键词" @search="onSubmit">
    <template #action>
      <div @click="showSearchCondition = true">筛选</div>
    </template>
  </van-search>
  <div @click="showSearchCondition = true">搜索</div>
  <!-- 右侧弹出 -->
  <van-popup v-model:show="showSearchCondition" position="right" :style="{ width: '80%', height: '100%' }">
    <van-form @submit="onSubmit">
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
const showSearchCondition = ref(false)

const { searchOptions, showSelectPicker, showDatePicker, currentPickerOptions, showPickerAction, onConfirmPicker, showDatePickerAction, onConfirmDatePicker } = useSearch()

const onSubmit = () => {
  console.log(searchOptions.value)
}
</script>

<style scoped></style>
