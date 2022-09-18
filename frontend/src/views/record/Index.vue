<template>
  <div class="record">
    <aside class="operate-group">
      <ol
        class="item"
        :class="{ disabled: item.disabled, active: item.value === currModule }"
        :style="{ 'background-color': item.color }"
        v-for="item in modules"
        :key="item.value"
        @click="changeModule(item)"
      >
        {{
          item.label
        }}
      </ol>
    </aside>
    <div class="content"></div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
export default {
  data() {
    return {
      currModule: 'record', // 当前模块
      modules: [
        { value: 'record', label: '收支', color: '#00C5CD', disabled: true },
        { value: 'plan', label: '计划', color: '#5F9EA0', disabled: true },
        { value: 'budget', label: '预算', color: '#FFB90F', disabled: true },
        { value: 'setting', label: '设置', color: '#FF8247', disabled: true }
      ],
      billId: '' // 账本id
    }
  },

  created() {
    const billId = localStorage.getItem('billId')
    console.log(this.bills)
    const bills = this.bills

    // 设置当前账本id
    if (bills.length > 0) {
      this.billId = bills.find((item) => item.id === billId) ? billId : bills[0].id
    }

    if (this.billId) {
      this.modules.forEach((item) => {
        item.disabled = false
      })
    }
  },
  computed: {
    ...mapState({
      bills: (state) => state.bills // 账本数组
    })
  },

  mounted() {},

  methods: {
    // 切换模块
    changeModule(module) {
      if (module.disabled) return
      this.currModule = module.value
    }
  }
}
</script>
<style scoped lang="scss">
@keyframes active {
  from {
    width: 30px;
    line-height: 30px;
  }
  to {
    width: 60px;
    line-height: 60px;
  }
}
@keyframes default {
  from {
    width: 60px;
    line-height: 60px;
  }
  to {
    width: 30px;
    line-height: 30px;
  }
}
.record {
  width: 100%;
  height: calc(100% - 60px);
  padding: 60px 0;
  display: flex;
  background-color: #96d59ef7;
  justify-content: center;
  .operate-group {
    height: 100%;
    width: 60px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    .item {
      width: 30px;
      height: 70px;
      line-height: 30px;
      text-align: center;
      cursor: pointer;
      border: 1px solid #ddd;
      border-radius: 4px 0 0 4px;
      writing-mode: tb-rl;
      color: #fff;
      animation: default 0.5s;
      &.active {
        animation: active 0.5s;
        width: 60px;
        line-height: 60px;
      }
      &.disabled {
        cursor: not-allowed;
        background-color: #eee !important;
        color: #999;
      }
    }
  }
  .content {
    width: 1200px;
    height: 100%;
    box-shadow: 0 0 2px #ddd;
    background-color: #fff;
  }
}
</style>
