<template>
  <div class="asset-screen">
    <van-nav-bar title="成员与汇率" left-arrow fixed placeholder @click-left="router.back()" />
    <div class="panel"><div class="field"><label>新成员</label><input v-model="name" placeholder="没有账号也可以" /></div></div>
    <div style="padding:12px"><button type="button" class="btn" @click="add">添加</button></div>
    <p v-if="error" class="a-hint warn">{{ error }}</p>
    <div class="a-group">
      <div v-if="!members.length" class="a-note" style="padding:12px">还没有资产成员</div>
      <div v-for="item in members" :key="item.id" class="a-arow">
        <span class="grow">{{ item.name }}</span>
        <button type="button" class="a-link" style="margin:0 10px 0 0" @click="openRename(item)">改名</button>
        <button type="button" class="a-link" style="margin:0;color:#f74f4f" @click="pending = item">隐藏</button>
      </div>
    </div>
    <div class="a-hint">隐藏后名字离开名单，名下资产仍算在「全部」里，家庭合计不变。这名单和记账成员不是同一份。这里不列出已隐藏成员，也不能恢复。</div>
    <div class="panel">
      <div class="field"><label>1 港币</label><input v-model="hkd" inputmode="decimal" /></div>
      <div class="field"><label>1 美元</label><input v-model="usd" inputmode="decimal" /></div>
    </div>
    <div class="a-hint">{{ rateNote }}汇总和图表按当前汇率折算，改汇率会重画历史曲线，不会改原币金额。</div>
    <div class="submit-bar"><button type="button" class="ok" @click="saveRates">保存汇率</button></div>
    <van-dialog v-model:show="showHide" title="隐藏成员" message="名字离开名单，名下资产仍算在全部里，家庭合计不变。" show-cancel-button @confirm="hide" @cancel="pending = null" />
    <van-dialog v-model:show="renaming" title="改名" show-cancel-button @confirm="rename">
      <div class="field"><label>名字</label><input v-model="nextName" /></div>
    </van-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { assetApi, type AssetMember } from '@/api/asset'
import { useAssetViewStore } from '@/stores/asset-view'
import './asset.css'

const route = useRoute()
const router = useRouter()
const view = useAssetViewStore()
const billId = computed(() => String(route.params.id || ''))
const members = ref<AssetMember[]>([])
const name = ref('')
const nextName = ref('')
const renaming = ref(false)
const renameId = ref('')
const pending = ref<AssetMember | null>(null)
const error = ref('')
const hkd = ref('')
const usd = ref('')
const saved = ref(true)
const showHide = computed({
  get: () => !!pending.value,
  set: (value) => { if (!value) pending.value = null }
})
const rateNote = computed(() => (saved.value ? '右边填折合多少人民币。' : '还没有保存过汇率，当前展示的是大于 0 的初始值。'))

async function load() {
  view.bindBill(billId.value)
  const [memberRes, rateRes] = await Promise.all([assetApi.members(billId.value), assetApi.exchangeRate(billId.value)])
  if (memberRes.retCode !== 0) return (error.value = memberRes.message || '无权查看该账本')
  members.value = memberRes.data || []
  if (rateRes.retCode === 0 && rateRes.data) {
    hkd.value = String(rateRes.data.hkdRate ?? '')
    usd.value = String(rateRes.data.usdRate ?? '')
    saved.value = !!rateRes.data.saved
  }
}
async function add() {
  const text = name.value.trim()
  if (!text) return (error.value = '请填写名字')
  if (members.value.some((item) => item.name === text)) return (error.value = '已经有这个名字')
  const res = await assetApi.addMember(billId.value, text)
  if (res.retCode !== 0) return (error.value = res.message || '没有添加')
  name.value = ''
  error.value = ''
  await load()
}
function openRename(item: AssetMember) {
  renameId.value = item.id
  nextName.value = item.name
  renaming.value = true
}
async function rename() {
  const text = nextName.value.trim()
  if (!text || members.value.some((item) => item.name === text && item.id !== renameId.value)) {
    error.value = '已经有这个名字'
    return
  }
  const res = await assetApi.editMember(renameId.value, text)
  if (res.retCode !== 0) error.value = res.message || '没有改名'
  else await load()
}
async function hide() {
  if (!pending.value) return
  const id = pending.value.id
  const res = await assetApi.hideMember(id)
  pending.value = null
  if (res.retCode !== 0) return (error.value = res.message || '没有隐藏')
  if (view.memberId === id) view.memberId = ''
  await load()
}
async function saveRates() {
  if (!(Number(hkd.value) > 0) || !(Number(usd.value) > 0)) return (error.value = '汇率必须大于 0')
  const res = await assetApi.saveExchangeRate(billId.value, hkd.value, usd.value)
  if (res.retCode !== 0) error.value = res.message || '没有保存'
  else {
    saved.value = true
    error.value = ''
  }
}
watch(billId, load, { immediate: true })
</script>
