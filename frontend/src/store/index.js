import Vue from 'vue'
import Vuex from 'vuex'

/**
 * @typedef {import('./type').payload} Payload
 */

Vue.use(Vuex)

const store = new Vuex.Store({
  state: () => {
    return {
      billId: null, // 当前账本id
      bill: null, // 当前账本
      updateBill: false // 账本已更新
    }
  },
  mutations: {
    /**
     * 统一更新 store 内容方法
     * @param {object} state - state对象
     * @param {Payload} paylod - 载荷
     */
    updateState(state, paylod) {
      state[paylod.key] = paylod.value
    }
  },
  actions: {
    updateState({ commit }, payload) {
      if (Array.isArray(payload)) {
        payload.forEach((item) => {
          commit('updateState', item)
        })
      } else {
        commit('updateState', payload)
      }
    }
  }
})

export default store
