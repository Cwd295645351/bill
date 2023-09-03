<template>
  <div class="plan-module">
    <div class="tool-container">
      <el-popover placement="right" :width="400" trigger="click">
        <template #reference>
          <div class="item">查询</div>
        </template>
        <div class="search-container">1111</div>
      </el-popover>
      <el-popover placement="right" :width="400" trigger="click">
        <template #reference>
          <div class="item">新增</div>
        </template>
        <div class="add-container">222</div>
      </el-popover>
    </div>
    <div class="plan-item" v-for="(item, index) in planList" :key="index">
      <div class="content">{{ item.context }}</div>
      <div class="priority">
        优先级：<span class="text" :style="{ background: priorityMap[item.priority].color }">{{ priorityMap[item.priority].text }}</span>
      </div>
      <div class="operate">
        <el-button size="small" type="primary" :icon="Edit" circle></el-button>
        <el-button size="small" type="danger" :icon="Delete" circle></el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Delete, Edit } from '@element-plus/icons-vue'
import { useList } from './hooks/use-list'

const { getList, planList, total } = useList()

const priorityMap = {
  1: { text: '高', color: 'red' },
  2: { text: '中', color: 'orange' },
  3: { text: '低', color: 'green' },
}
</script>

<style scoped lang="scss">
.plan-module {
  height: calc(100% - 60px);
  width: 100%;
  padding: 20px 10%;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-start;
  align-content: flex-start;
  .tool-container {
    position: fixed;
    width: 50px;
    top: 200px;
    left: 5%;
    overflow: hidden;
    .item {
      width: 100%;
      font-weight: bold;
      height: 50px;
      padding: 5px;
      line-height: 40px;
      background-color: #fff;
      border-radius: 4px;
      text-align: center;
      border: 1px solid #ddd;
      cursor: pointer;
      box-shadow: 1px 1px 5px #ddd;
      &:hover {
        background-color: orange;
        color: #fff;
      }
      & + .item {
        margin-top: 5px;
      }
    }
  }
  .plan-item {
    box-shadow: 1px 1px 5px #ddd;
    width: 150px;
    height: 150px;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    & + .plan-item {
      margin-left: 20px;
    }
    .content {
      width: 100%;
      flex: 1;
      min-height: 0;
      font-weight: bold;
      font-size: 16px;
    }
    .priority {
      margin: 15px 0;
      height: 20px;
      line-height: 20px;
      .text {
        display: inline-block;
        width: 40px;
        height: 100%;
        font-weight: bold;
        text-align: center;
        color: #fff;
        border-radius: 4px;
      }
    }
    .operate {
      text-align: center;
    }
  }
}
</style>
