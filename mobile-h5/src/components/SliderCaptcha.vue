<template>
  <div class="sc">
    <div class="sc__panel" :style="{ width: width + 'px', maxWidth: '100%' }">
      <div class="sc__bg" :style="{ height: height + 'px' }">
        <img v-if="backgroundImage" class="sc__bg-img" :src="backgroundImage" alt="" />
        <img
          v-if="puzzleImage"
          class="sc__puzzle"
          :src="puzzleImage"
          alt=""
          :style="{ transform: 'translateX(' + slideX + 'px)', top: y + 'px', width: puzzleSize + 'px', height: puzzleSize + 'px' }"
        />
        <button type="button" class="sc__refresh" @click="reload">↻</button>
      </div>
      <div class="sc__track" @touchstart.prevent="onStart" @mousedown="onStart">
        <div class="sc__fill" :style="{ width: slideX + puzzleSize / 2 + 'px' }"></div>
        <div class="sc__knob" :class="{ ok: ready, fail: !!error && !ready }" :style="{ transform: 'translateX(' + slideX + 'px)' }"><span class="sc__knob-ico" aria-hidden="true">{{ ready ? '✓' : '→' }}</span></div>
        <span v-if="!dragging && slideX < 4" class="sc__hint">向右拖动完成验证</span>
      </div>
    </div>
    <p v-if="error" class="sc__error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { fetchCaptcha } from '@/api/common'

const emit = defineEmits<{
  (e: 'update', payload: { captchaId: string; captchaX: number; ready: boolean }): void
}>()

const captchaId = ref('')
const backgroundImage = ref('')
const puzzleImage = ref('')
const y = ref(40)
const width = ref(300)
const height = ref(150)
const puzzleSize = ref(42)
const targetX = ref(0)
const tolerance = ref(6)
const slideX = ref(0)
const dragging = ref(false)
const ready = ref(false)
const error = ref('')
let startClientX = 0
let startSlideX = 0

const maxSlide = () => Math.max(0, width.value - puzzleSize.value)

function emitState(isReady: boolean) {
  emit('update', { captchaId: captchaId.value, captchaX: Math.round(slideX.value), ready: isReady })
}

async function reload() {
  error.value = ''
  ready.value = false
  slideX.value = 0
  emitState(false)
  try {
    const res = await fetchCaptcha()
    if (res.retCode !== 0 || !res.data) {
      error.value = res.message || '获取滑块失败'
      return
    }
    const d = res.data
    captchaId.value = d.captchaId
    backgroundImage.value = d.backgroundImage
    puzzleImage.value = d.puzzleImage
    y.value = d.y
    width.value = d.width
    height.value = d.height
    puzzleSize.value = d.puzzleSize
    targetX.value = d.targetX
    tolerance.value = typeof d.tolerance === 'number' ? d.tolerance : 6
  } catch {
    error.value = '获取滑块失败'
  }
}

function onMove(e: MouseEvent | TouchEvent) {
  if (!dragging.value) return
  const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
  slideX.value = Math.min(maxSlide(), Math.max(0, startSlideX + (clientX - startClientX)))
}

function onEnd() {
  if (!dragging.value) return
  dragging.value = false
  window.removeEventListener('mousemove', onMove)
  window.removeEventListener('mouseup', onEnd)
  window.removeEventListener('touchmove', onMove)
  window.removeEventListener('touchend', onEnd)
  const ok = Math.abs(Math.round(slideX.value) - targetX.value) <= tolerance.value
  if (!ok) {
    ready.value = false
    error.value = '请对准缺口'
    emitState(false)
    setTimeout(() => { reload() }, 400)
    return
  }
  ready.value = true
  error.value = ''
  emitState(true)
}

function onStart(e: MouseEvent | TouchEvent) {
  if (!captchaId.value) return
  dragging.value = true
  ready.value = false
  const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
  startClientX = clientX
  startSlideX = slideX.value
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onEnd)
  window.addEventListener('touchmove', onMove, { passive: false } as any)
  window.addEventListener('touchend', onEnd)
}

onMounted(reload)
onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onMove)
  window.removeEventListener('mouseup', onEnd)
  window.removeEventListener('touchmove', onMove)
  window.removeEventListener('touchend', onEnd)
})

defineExpose({ reload })
</script>

<style scoped>
.sc { margin: 16px; }
.sc__panel { user-select: none; margin: 0 auto; }
.sc__bg { position: relative; overflow: hidden; border-radius: 8px; background: #f2f3f5; }
.sc__bg-img { width: 100%; height: 100%; display: block; }
.sc__puzzle { position: absolute; left: 0; pointer-events: none; filter: drop-shadow(0 1px 2px rgba(0,0,0,.35)); }
.sc__refresh { position: absolute; top: 6px; right: 6px; border: 0; width: 28px; height: 28px; border-radius: 50%; background: rgba(0,0,0,.45); color: #fff; }
.sc__track { position: relative; margin-top: 10px; height: 40px; border-radius: 20px; background: #f2f3f5; border: 1px solid #ebedf0; overflow: hidden; }
.sc__fill { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(66,133,244,.2); }
.sc__knob {
  position: absolute;
  top: 2px;
  left: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #4285f4;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 0;
  margin: 0;
  line-height: 0;
  font-size: 0;
  overflow: hidden;
}
.sc__knob-ico {
  width: 100%;
  height: 100%;
  font-size: 20px;
  font-weight: 700;
  line-height: 31px;
  text-align: center;
}
.sc__knob.ok { background: #07c160; }
.sc__knob.fail { background: #ee0a24; }
.sc__hint { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #969799; font-size: 13px; pointer-events: none; }
.sc__error { margin: 8px 0 0; color: #ee0a24; font-size: 12px; }
</style>
