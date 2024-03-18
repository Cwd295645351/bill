<template>
  <div @click="showSearchCondition = true">搜索</div>
  <!-- 右侧弹出 -->
  <van-popup v-model:show="showSearchCondition" position="right" :style="{ width: '70%', height: '100%' }">
    <van-form @submit="onSubmit">
      <van-field v-model="searchOptions.userName" is-link readonly name="picker" label="记账人" placeholder="点击选择记账人" @click="showPickerAction('user')" />
      <van-field v-model="searchOptions.costTypeName" is-link readonly name="picker" label="支出类型" placeholder="点击选择支出类型" @click="showPickerAction('costType')" />
      <van-field v-model="searchOptions.payMethodName" is-link readonly name="picker" label="支付方式" placeholder="点击选择支付方式" @click="showPickerAction('payMethod')" />

      <div style="margin: 16px">
        <van-button round block type="primary" native-type="submit"> 提交 </van-button>
      </div>
    </van-form>
    <van-popup v-model:show="showPicker" position="bottom">
      <van-picker :columns="currentPickerOptions.options" :columns-field-names="{ text: 'name', value: 'id' }" @confirm="onConfirmPicker" @cancel="showPicker = false" />
    </van-popup>
  </van-popup>
</template>

<script setup lang="ts">
import { Ref, ref } from 'vue'
import { useSearch } from './hooks/use-search'
const showSearchCondition = ref(false)

const { searchOptions, showPicker, currentPickerOptions, showPickerAction, onConfirmPicker } = useSearch()

const onSubmit = () => {
  console.log(searchOptions.value)
}
</script>

<style scoped></style>
