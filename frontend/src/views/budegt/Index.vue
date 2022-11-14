<template>
  <div class="budget-container">
    <div class="budget-overview-container"></div>
    <div class="budget-list-cards"></div>
  </div>
</template>

<script>
export default {
  data() {
    return {}
  },

  created() {},

  mounted() {},

  methods: {}
}
</script>
<style scoped lang="scss">
.budget-container {
  width: 100%;
  height: calc(100% - 60px);
  padding: 20px;
  display: flex;
  align-items: center;
  .budget-overview-container {
    width: 300px;
    height: 100%;
    margin-right: 20px;
    border-radius: 8px;
    box-shadow: 1px 1px 5px #ddd;
  }
  .budget-list-cards {
    flex: 1;
    height: 100%;
    min-width: 0;
    border-radius: 8px;
    box-shadow: 1px 1px 5px #ddd;
  }
}
</style>
