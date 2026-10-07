const COLORS = ['#4285F4', '#34A853', '#FBBC05', '#EA4335', '#9C27B0', '#00ACC1', '#FF7043', '#5C6BC0']

Component({
  properties: {
    list: { type: Array, value: [] },
    current: { type: String, value: '' }
  },
  data: {
    view: [] as any[],
    colors: COLORS
  },
  observers: {
    list(list: any[]) {
      const view = (list || []).map((item) => ({
        id: item.id,
        name: item.name,
        short: (item.name || '?').slice(0, 1)
      }))
      this.setData({ view })
    }
  },
  methods: {
    onTap(e: WechatMiniprogram.TouchEvent) {
      const id = e.currentTarget.dataset.id
      const name = e.currentTarget.dataset.name
      this.triggerEvent('select', { id, name })
    }
  }
})
