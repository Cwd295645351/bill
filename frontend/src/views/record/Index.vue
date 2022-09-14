<template>
  <div class="record">
    <aside class="operate-group">
      <ol
        class="item"
        :class="{ disabled: item.disabled, active: item.value === currModule }"
        v-for="item in modules"
        :key="item.value"
        @click="changeModule(item)"
      >
        {{
          item.label
        }}
      </ol>
    </aside>
    <div class="content">214</div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      currModule: 'record',
      modules: [
        { value: 'record', label: '收支', disabled: false },
        { value: 'plan', label: '计划', disabled: false },
        { value: 'budget', label: '预算', disabled: true }
      ]
    }
  },

  created() {},

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
.record {
  width: 100%;
  height: calc(100% - 60px);
  padding: 60px 0;
  display: flex;
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

      &:hover {
        background-color: rgba(111, 197, 255, 0.5);
        color: #fff;
      }
      &.active {
        background-color: rgb(111, 197, 255);
        color: #fff;
        width: 60px;
        line-height: 60px;
      }
      &.disabled {
        cursor: not-allowed;
        background-color: #eee;
        color: #999;
      }
    }
  }
  .content {
    width: 1200px;
    height: 100%;
    box-shadow: 0 0 10px #ddd;
  }
}
</style>
