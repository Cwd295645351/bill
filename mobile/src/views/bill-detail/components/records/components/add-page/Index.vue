<template>
  <div class="add-record-page">
    <van-nav-bar left-text="返回" lefr-arrow fixed safe-area-inset-top @click-left="onClickLeft">
      <template #title>
        <div class="type-group">
          <div class="type-item" :class="{ active: type === 1 }" @click="changeType(1)">支出</div>
          <div class="type-item" :class="{ active: type === 2 }" @click="changeType(2)">收入</div>
        </div>
      </template>
    </van-nav-bar>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const type = ref<1 | 2>(1)

/** 切换收支类型 */
const changeType = (changeType: 1 | 2) => {
  type.value = changeType
}

const onClickLeft = () => history.back()
</script>

<style scoped lang="scss">
.add-record-page {
  width: 100vw;
  height: 100vh;
  .type-group {
    display: flex;
    align-items: center;
    width: 100px;
    height: 46px;
    .type-item {
      flex: 1;
      min-width: 0;
      height: 100%;
      text-align: center;
      line-height: 46px;
      color: #999;
      font-size: 14px;
      &.active {
        color: #333;
        border-bottom: 1px solid #7baeff;
      }
    }
  }
}
</style>
