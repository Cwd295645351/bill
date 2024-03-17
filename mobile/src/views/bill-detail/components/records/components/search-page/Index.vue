<template>
  <div @click="showSearchCondition = true">搜索</div>
  <!-- 右侧弹出 -->
  <van-popup v-model:show="showSearchCondition" position="right" :style="{ width: '70%', height: '100%' }">
    <van-form @submit="onSubmit">
      <van-field v-model="searchOptions.userId" is-link readonly name="picker" label="记账人" placeholder="点击选择记账人" @click="showPicker = true" />
      <van-popup v-model:show="showPicker" position="bottom">
        <van-picker :columns="users" :columns-field-names="{ text: 'name', value: 'id' }" @confirm="onSelectUser" @change="onSelectUser" @cancel="showPicker = false" />
      </van-popup>
      <div style="margin: 16px">
        <van-button round block type="primary" native-type="submit"> 提交 </van-button>
      </div>
    </van-form>
  </van-popup>
</template>

<script setup lang="ts">
import { Ref, ref } from 'vue'
import { useSearch } from './hooks/use-search'
const showSearchCondition = ref(false)

const { searchOptions, users, costTypes, incomesTypes, payMethods, conditionOptions } = useSearch()

const onSelectUser = ({ selectedValues, selectedOptions, selectedIndexes }) => {
  searchOptions.value.userId = selectedValues[0]
}

const showPicker = ref(false)

const onSubmit = () => {}
</script>

<style scoped></style>
