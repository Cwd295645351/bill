<template>
  <div class="overview-module">
    <div class="belong-user-module">
      <div class="title">收支概览</div>
      <div class="total-context">
        <div class="line">总支出：{{ belongUsers.totalCost }}</div>
        <div class="line">总收入：{{ belongUsers.totalIncomes }}</div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      belongUsers: {
        totalCost: 0, // 总支出
        totalIncomes: 0 // 总收入
      }
    }
  }
}
</script>

<style lang="scss">
.overview-module {
  height: calc(100% - 60px);
  width: 100%;
  background-color: #fff;
  display: flex;
  align-items: center;
  padding: 20px;
  .belong-user-module {
    width: 300px;
    height: 100%;
    border-radius: 8px;
    box-shadow: 1px 1px 5px #999;
    background-color: #fff;
    padding: 20px;
    .title {
      font-size: 18px;
      font-weight: bold;
      text-align: center;
      height: 30px;
      line-height: 30px;
      margin-bottom: 20px;
    }
    .total-context {
      padding-bottom: 10px;
      border-top: 1px solid #ddd;
      border-bottom: 1px solid #ddd;
      .line {
        padding-top: 10px;
      }
    }
  }
}
</style>
