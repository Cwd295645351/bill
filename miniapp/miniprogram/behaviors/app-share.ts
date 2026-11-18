import { appShareMessage, appShareTimeline, enableAppShare } from '../utils/share'

/** 全页通用：右上角转发 / 朋友圈，不邀请加入账本 */
export const appShareBehavior = Behavior({
  lifetimes: {
    attached() {
      enableAppShare()
    }
  },
  methods: {
    onShareAppMessage() {
      return appShareMessage()
    },
    onShareTimeline() {
      return appShareTimeline()
    }
  }
})
