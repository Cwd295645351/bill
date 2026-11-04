<template>
  <div class="slider-captcha">
    <div class="slider-captcha__panel" :style="{ width: width + 'px' }">
      <div class="slider-captcha__bg" :style="{ height: height + 'px' }">
        <img v-if="backgroundImage" class="slider-captcha__bg-img" :src="backgroundImage" alt="" />
        <img
          v-if="puzzleImage"
          class="slider-captcha__puzzle"
          :src="puzzleImage"
          alt=""
          :style="{ left: slideX + 'px', top: y + 'px', width: puzzleSize + 'px', height: puzzleSize + 'px' }"
        />
        <button type="button" class="slider-captcha__refresh" @click="reload" title="刷新">↻</button>
      </div>
      <div
        class="slider-captcha__track"
        @mousedown="onStart"
        @touchstart.prevent="onStart"
      >
        <div class="slider-captcha__track-fill" :style="{ width: slideX + puzzleSize / 2 + 'px' }"></div>
        <div
          class="slider-captcha__knob"
          :class="{ ok: verified, fail: !!error && !verified }"
          :style="{ left: slideX + 'px' }"
        >
          {{ verified ? '✓' : '→' }}
        </div>
        <span v-if="!dragging && slideX < 4" class="slider-captcha__hint">向右拖动滑块完成拼图</span>
      </div>
    </div>
    <p v-if="error" class="slider-captcha__error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { fetchCaptcha } from './api'

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
const verified = ref(false)
const error = ref('')
let startClientX = 0
let startSlideX = 0

const maxSlide = () => Math.max(0, width.value - puzzleSize.value)

function emitState(ready: boolean) {
  emit('update', {
    captchaId: captchaId.value,
    captchaX: Math.round(slideX.value),
    ready,
  })
}

async function reload() {
  error.value = ''
  verified.value = false
  slideX.value = 0
  emitState(false)
  try {
    const [err, res] = await fetchCaptcha()
    if (err || !res || res.retCode !== 0 || !res.data) {
      error.value = (res && res.message) || '获取滑块失败'
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
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const next = Math.min(maxSlide(), Math.max(0, startSlideX + (clientX - startClientX)))
  slideX.value = next
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
    verified.value = false
    error.value = '请对准缺口'
    emitState(false)
    setTimeout(() => { reload() }, 400)
    return
  }
  verified.value = true
  error.value = ''
  emitState(true)
}

function onStart(e: MouseEvent | TouchEvent) {
  if (!captchaId.value) return
  dragging.value = true
  verified.value = false
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  startClientX = clientX
  startSlideX = slideX.value
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onEnd)
  window.addEventListener('touchmove', onMove, { passive: false })
  window.addEventListener('touchend', onEnd)
}

onMounted(reload)
onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onMove)
  window.removeEventListener('mouseup', onEnd)
  window.removeEventListener('touchmove', onMove)
  window.removeEventListener('touchend', onEnd)
})

defineExpose({ reload, reset: reload })
</script>

<style scoped lang="scss">
.slider-captcha {
  margin-bottom: 16px;
  text-align: left;
  &__panel {
    user-select: none;
  }
  &__bg {
    position: relative;
    overflow: hidden;
    border-radius: 6px;
    background: #f0f2f5;
  }
  &__bg-img {
    width: 100%;
    height: 100%;
    display: block;
  }
  &__puzzle {
    position: absolute;
    pointer-events: none;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35));
  }
  &__refresh {
    position: absolute;
    top: 6px;
    right: 6px;
    border: none;
    background: rgba(0, 0, 0, 0.45);
    color: #fff;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    cursor: pointer;
  }
  &__track {
    position: relative;
    margin-top: 10px;
    height: 40px;
    border-radius: 20px;
    background: #f2f3f5;
    border: 1px solid #e5e6eb;
    overflow: hidden;
  }
  &__track-fill {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    background: rgba(64, 158, 255, 0.2);
  }
  &__knob {
    position: absolute;
    top: 2px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #409eff;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: grab;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
    &.ok {
      background: #67c23a;
    }
    &.fail {
      background: #f56c6c;
    }
  }
  &__hint {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #909399;
    font-size: 13px;
    pointer-events: none;
  }
  &__error {
    margin: 6px 0 0;
    color: #f56c6c;
    font-size: 12px;
  }
}
</style>
