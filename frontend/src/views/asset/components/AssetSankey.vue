<template>
  <section v-show="active" class="sankey-panel">
    <div class="sankey-wrap">
      <div class="seg">
        <button type="button" :class="{ active: mode === 'amount' }" @click="mode = 'amount'">金额</button>
        <button type="button" :class="{ active: mode === 'ratio' }" @click="mode = 'ratio'">比例</button>
        <button type="button" :class="{ active: mode === 'hidden' }" @click="mode = 'hidden'">隐藏金额</button>
      </div>
      <div ref="host" class="sankey"></div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { inject, nextTick, ref, toRef, watch, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import { useSankey } from '../hooks/use-sankey'
import type { AssetMember } from '../type'

const props = defineProps<{
  active: boolean
  memberId: string
  members: AssetMember[]
}>()

const memberId = toRef(props, 'memberId')
const members = toRef(props, 'members')
const revision = inject<Ref<number>>('assetRevision', ref(0))
const { billId } = storeToRefs(useBillStore())
const { host, mode, load } = useSankey(memberId, members)

watch(
  [() => props.active, memberId, billId, revision],
  async () => {
    if (!props.active) return
    await nextTick()
    await load()
  },
  { immediate: true },
)
</script>

<style scoped lang="scss">
@use './asset.scss' as *;

.sankey-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;

  .sankey-wrap {
    @include panel-card;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 16px;

    .seg {
      @include seg;
    }

    .sankey {
      flex: 1;
      min-height: 0;
    }
  }
}
</style>
