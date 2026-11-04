import { fetchCaptcha } from '../../apis/index'

function touchClientX(e: WechatMiniprogram.TouchEvent): number | null {
  const list = (e.touches && e.touches.length ? e.touches : e.changedTouches) || []
  const t = list[0] as WechatMiniprogram.Touch | undefined
  if (!t) return null
  const x = t.clientX
  return typeof x === 'number' && Number.isFinite(x) ? x : null
}

Component({
  data: {
    captchaId: '',
    backgroundImage: '',
    puzzleImage: '',
    y: 40,
    width: 300,
    height: 150,
    puzzleSize: 42,
    targetX: 0,
    tolerance: 6,
    /** 逻辑坐标（与服务端 SVG / targetX 同一空间，单位：题面 width） */
    slideX: 0,
    /** 实际渲染缩放：displayWidth / width */
    scale: 1,
    displayWidth: 300,
    displayHeight: 150,
    displayY: 40,
    displayPuzzleSize: 42,
    displaySlideX: 0,
    dragging: false,
    ready: false,
    error: ''
  },

  lifetimes: {
    attached() {
      this.reload()
    }
  },

  methods: {
    emitState(ready: boolean) {
      this.triggerEvent('update', {
        captchaId: this.data.captchaId,
        captchaX: Math.round(this.data.slideX),
        ready
      })
    },

    /** 把逻辑 slideX 同步成展示用 px，并保持与背景同一缩放 */
    applySlide(logicalX: number, extra: Record<string, any> = {}) {
      const scale = this.data.scale || 1
      const slideX = Math.min(this.maxSlide(), Math.max(0, logicalX))
      this.setData({
        slideX,
        displaySlideX: slideX * scale,
        ...extra
      })
    },

    measureScale(): Promise<number> {
      return new Promise((resolve) => {
        const run = () => {
          wx.createSelectorQuery()
            .in(this)
            .select('.sc__bg')
            .boundingClientRect((rect) => {
              const logicalW = this.data.width || 300
              const logicalH = this.data.height || 150
              const logicalY = this.data.y || 0
              const logicalSize = this.data.puzzleSize || 42
              const displayWidth = rect && rect.width > 0 ? rect.width : logicalW
              const scale = displayWidth / logicalW
              this.setData({
                scale,
                displayWidth,
                displayHeight: logicalH * scale,
                displayY: logicalY * scale,
                displayPuzzleSize: logicalSize * scale,
                displaySlideX: this.data.slideX * scale
              })
              resolve(scale)
            })
            .exec()
        }
        if (typeof wx.nextTick === 'function') wx.nextTick(run)
        else setTimeout(run, 32)
      })
    },

    async reload() {
      this.setData({ error: '', ready: false, slideX: 0, displaySlideX: 0 })
      this.emitState(false)
      try {
        const res = await fetchCaptcha()
        if (res.retCode !== 0 || !res.data) {
          this.setData({ error: res.message || '获取滑块失败' })
          return
        }
        const d = res.data
        this.setData({
          captchaId: d.captchaId,
          backgroundImage: d.backgroundImage,
          puzzleImage: d.puzzleImage,
          y: d.y,
          width: d.width,
          height: d.height,
          puzzleSize: d.puzzleSize,
          targetX: d.targetX,
          tolerance: typeof d.tolerance === 'number' ? d.tolerance : 6,
          slideX: 0,
          displaySlideX: 0
        })
        await this.measureScale()
      } catch {
        this.setData({ error: '获取滑块失败' })
      }
    },

    onRefresh() {
      this.reload()
    },

    maxSlide() {
      return Math.max(0, this.data.width - this.data.puzzleSize)
    },

    onTouchStart(e: WechatMiniprogram.TouchEvent) {
      if (!this.data.captchaId) return
      const x = touchClientX(e)
      if (x == null) return
      ;(this as any)._sx = x
      ;(this as any)._ss = this.data.slideX
      this.setData({ dragging: true, ready: false })
    },

    onTouchMove(e: WechatMiniprogram.TouchEvent) {
      if (!this.data.dragging) return
      const x = touchClientX(e)
      if (x == null) return
      const scale = this.data.scale || 1
      const startX = (this as any)._sx || 0
      const startSlide = (this as any)._ss || 0
      // clientX 是屏幕 px；除以 scale 回到服务端逻辑坐标
      const logical = startSlide + (x - startX) / scale
      this.applySlide(logical)
    },

    onTouchEnd(_e: WechatMiniprogram.TouchEvent) {
      if (!this.data.dragging) return
      const ok =
        Math.abs(Math.round(this.data.slideX) - this.data.targetX) <= this.data.tolerance
      if (!ok) {
        this.setData({ dragging: false, ready: false, error: '请对准缺口' })
        this.emitState(false)
        setTimeout(() => {
          this.reload()
        }, 400)
        return
      }
      this.setData({ dragging: false, ready: true, error: '' })
      this.emitState(true)
    }
  }
})
