<template>
  <div class="kb">
    <div class="rows">
      <div v-for="(row, ri) in rows" :key="ri" class="row">
        <button
          v-for="key in row"
          :key="key"
          type="button"
          class="key"
          @click="emit('key', key)"
        >
          {{ key === 'del' ? '删除' : key }}
        </button>
      </div>
    </div>
    <div class="actions">
      <button
        v-if="showAgain"
        type="button"
        class="again"
        @click="emit('again')"
      >
        再记一笔
      </button>
      <button type="button" class="ok" @click="emit('confirm')">
        {{ confirmText || (showAgain ? '完成' : '保存') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    showAgain?: boolean
    confirmText?: string
  }>(),
  {
    showAgain: true,
    confirmText: '',
  },
)

const emit = defineEmits<{
  key: [key: string]
  confirm: []
  again: []
}>()

const rows = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'del'],
]
</script>

<style scoped>
.kb {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  display: flex;
  background: #e8eaed;
  padding: 6px 6px calc(6px + env(safe-area-inset-bottom));
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.08);
}
.rows {
  flex: 3;
}
.row {
  display: flex;
}
.key,
.again,
.ok {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  margin: 4px;
  border: none;
  border-radius: 6px;
  background: #fff;
  font-size: 18px;
  cursor: pointer;
}
.key {
  flex: 1;
}
.key:active,
.again:active {
  background: #f2f3f5;
}
.actions {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.again,
.ok {
  flex: 1;
  font-size: 15px;
}
.ok {
  background: #4285f4;
  color: #fff;
}
.ok:active {
  background: #2f6fda;
}
</style>
