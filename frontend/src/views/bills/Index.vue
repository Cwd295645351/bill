<template>
  <div class="bills">
    <div class="bill" v-for="item in bills" :key="item.id">
      <div class="modal">
        <i class="item el-icon-view" @click="showDetail(item)"></i>
        <i class="item el-icon-delete" @click="showDelete(item)"></i>
      </div>
      {{ item.name }}
    </div>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex'
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

  methods: {
    ...mapActions(['updateState']),
    // 进入账本
    showDetail(item) {
      sessionStorage.setItem('tabValue', 'record')
      sessionStorage.setItem('bill', JSON.stringify(item))
      this.updateState({ key: 'bill', value: item })
      this.$router.push('/layout/record')
    },
    // 删除账本
    showDelete(item) {
      console.log('删除账本', item)
    }
  }
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
    position: relative;
    width: 200px;
    height: 150px;
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
    .modal {
      position: absolute;
      top: 0;
      left: 0;
      visibility: hidden;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      .item {
        &:hover {
          color: rgba(111, 197, 255, 0.5);
        }
        & + .item {
          margin-left: 10px;
        }
      }
    }
    &:hover {
      .modal {
        visibility: visible;
      }
    }
  }
}
</style>
