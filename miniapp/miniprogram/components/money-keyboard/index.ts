Component({
  properties: {
    showAgain: { type: Boolean, value: true },
    confirmText: { type: String, value: '' }
  },
  data: {
    rows: [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['.', '0', 'del']
    ]
  },
  methods: {
    onKey(e: WechatMiniprogram.TouchEvent) {
      const key = e.currentTarget.dataset.key
      this.triggerEvent('key', { key })
    },
    onConfirm() {
      this.triggerEvent('confirm')
    },
    onAgain() {
      this.triggerEvent('again')
    }
  }
})
