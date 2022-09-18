<template>
  <div class="bills">
    <div class="bill" v-for="item in bills" :key="item.id">{{ item.name }}</div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
export default {
  data() {
    return {}
  },

  created() {},
  computed: {
    ...mapState({
      bills: (state) => state.bills // 账本数组
    })
  },

  mounted() {},

  methods: {}
}
</script>
<style scoped lang="scss">
.bills {
  height: 100%;
  width: 100%;
  padding: 20px 0 0 20px;
  display: flex;
  align-items: center;
  align-content: flex-start;
  flex-wrap: wrap;
  .bill {
    width: 150px;
    height: 200px;
    color: #fff;
    padding: 10px;
    margin-right: 20px;
    margin-bottom: 20px;
    border: 1px solid #ddd;
    box-shadow: 2px 2px 2px #eee;
    font-size: 24px;
    background-color: #95c7df;
    border-radius: 4px;
    cursor: pointer;
  }
}
</style>
