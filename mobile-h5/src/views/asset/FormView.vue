<template>
  <div class="asset-screen">
    <van-nav-bar :title="form.id ? '编辑资产' : '登记资产'" left-arrow fixed placeholder @click-left="router.back()" />
    <p v-if="!members.length" class="a-hint">还没有资产成员。请先添加成员，不能保存没有归属的资产。<button type="button" class="a-link" @click="router.push({ name: 'bill-asset-members', params: { id: billId } })">去添加</button></p>
    <template v-else>
      <div class="panel">
        <div class="field"><label>名称</label><input v-model="form.name" placeholder="例如工资卡" /></div>
        <button type="button" class="cell" @click="openPick('member')"><span class="grow">成员</span><span class="val">{{ memberName }}</span><span class="arrow">›</span></button>
        <button type="button" class="cell" @click="openPick('type')"><span class="grow">资产属性</span><span class="val">{{ labelOf(ASSET_TYPES, form.type) }}</span><span class="arrow">›</span></button>
        <button v-if="form.type !== 'debt'" type="button" class="cell" @click="openPick('four')"><span class="grow">四笔钱</span><span class="val">{{ labelOf(FOUR_TYPES, form.fourMoneyType) }}</span><span class="arrow">›</span></button>
        <div v-if="form.id" class="cell"><span class="grow">币种</span><span class="val">{{ labelOf(CURRENCIES, form.currency) }}</span></div>
        <button v-else type="button" class="cell" @click="openPick('currency')"><span class="grow">币种</span><span class="val">{{ labelOf(CURRENCIES, form.currency) }}</span><span class="arrow">›</span></button>
        <div class="field"><label>{{ insured ? '现金价值' : '当前金额' }}</label><input :value="amountShown" inputmode="decimal" :placeholder="insured ? '不要填保额' : '不能小于 0'" @focus="amountOpen = true" @blur="amountOpen = false" @input="onAmount" /></div>
        <div v-if="!form.id" class="field"><label>盘点日</label><input v-model="form.date" type="date" :max="today" /></div>
        <template v-if="insured">
          <div class="field"><label>险种</label><input v-model="form.insuranceCategory" placeholder="不填则归入其他" /></div>
          <div class="field"><label>年交保费</label><input :value="premiumShown" inputmode="decimal" placeholder="可选" @focus="premiumOpen = true" @blur="premiumOpen = false" @input="onPremium" /></div>
        </template>
      </div>
      <div class="a-hint" :class="{ warn: form.type === 'debt' }">{{ hint }}</div>
      <p v-if="error" class="a-hint warn">{{ error }}</p>
      <button v-if="form.id" type="button" class="danger" @click="askDelete = true">删除这笔资产</button>
      <div class="submit-bar"><button type="button" class="ok" @click="save">保存</button></div>
    </template>
    <van-popup v-model:show="picking" position="bottom" round>
      <div class="sheet-bar"><button type="button" class="cancel" @click="picking = false">取消</button><div class="sheet-title">{{ pickTitle }}</div><span></span></div>
      <div class="sheet-list">
        <button v-for="item in pickOptions" :key="item.value" type="button" class="sheet-item" :class="{ on: item.value === pickCurrent }" @click="choosePick(item.value)">{{ item.label }}</button>
      </div>
    </van-popup>
    <van-dialog v-model:show="askDelete" title="删除这笔资产" message="删除后，这笔资产和全部盘点不再出现。" show-cancel-button @confirm="remove" />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { assetApi, type AssetPayload, type AssetRow } from '@/api/asset'
import { useAssetViewStore } from '@/stores/asset-view'
import { ASSET_TYPES, CURRENCIES, FOUR_TYPES, dayStamp, labelOf, todayText } from '@/utils/asset-format'
import './asset.css'

const route = useRoute()
const router = useRouter()
const view = useAssetViewStore()
const billId = computed(() => String(route.params.id || ''))
const members = ref<{ id: string; name: string }[]>([])
const error = ref('')
const askDelete = ref(false)
const origin = ref<number | null>(null)
const kept = reactive({ channel: '', turnaroundCycle: 'T+0' })
const today = todayText()
const form = reactive({
  id: '',
  name: '',
  memberId: '',
  type: 'living',
  fourMoneyType: 'living',
  currency: 'CNY',
  latestAmount: '',
  date: today,
  insuranceCategory: '',
  annualPremium: ''
})
const amountOpen = ref(false)
const premiumOpen = ref(false)
const maskSaved = computed(() => view.hideAmount && !!form.id)
const amountShown = computed(() => (maskSaved.value && !amountOpen.value ? '****' : form.latestAmount))
const premiumShown = computed(() => (maskSaved.value && form.annualPremium !== '' && !premiumOpen.value ? '****' : form.annualPremium))
const unchanged = computed(() => !!form.id && origin.value != null && Number(form.latestAmount) === origin.value)
const insured = computed(() => form.type !== 'debt' && form.fourMoneyType === 'insurance')
const memberName = computed(() => members.value.find((item) => item.id === form.memberId)?.name || '请选择')
const hint = computed(() => {
  if (form.id && unchanged.value) return '金额没有变化，这次不会新增盘点。币种登记后不能修改。'
  if (form.id) return '金额有变化时，会在今天追加一条盘点，原来的盘点不动。币种登记后不能修改。'
  if (form.type === 'debt') return '类型为负债时计入总负债，不计入总资产，也不选四笔钱。盘点日可以改成补记的那一天。'
  if (insured.value) return '现金价值不要填保额。保障计入总资产。盘点日可以改成补记的那一天。'
  return '金额不能小于 0。盘点日可以改成补记的那一天，保存后留下这一条。'
})
const picking = ref(false)
const pickKind = ref<'member' | 'type' | 'four' | 'currency'>('member')
const pickTitle = computed(() => ({ member: '成员', type: '资产属性', four: '四笔钱', currency: '币种' }[pickKind.value]))
const pickOptions = computed(() => {
  if (pickKind.value === 'member') return members.value.map((item) => ({ value: item.id, label: item.name }))
  if (pickKind.value === 'type') return ASSET_TYPES
  if (pickKind.value === 'four') return FOUR_TYPES
  return CURRENCIES
})
const pickCurrent = computed(() => (pickKind.value === 'member' ? form.memberId : pickKind.value === 'type' ? form.type : pickKind.value === 'four' ? form.fourMoneyType : form.currency))

function onAmount(event: Event) {
  const value = (event.target as HTMLInputElement).value
  if (value === '****') return
  form.latestAmount = value
}
function onPremium(event: Event) {
  const value = (event.target as HTMLInputElement).value
  if (value === '****') return
  form.annualPremium = value
}
function openPick(kind: 'member' | 'type' | 'four' | 'currency') {
  pickKind.value = kind
  picking.value = true
}
function choosePick(value: string) {
  if (pickKind.value === 'member') form.memberId = value
  else if (pickKind.value === 'type') form.type = value
  else if (pickKind.value === 'four') form.fourMoneyType = value
  else form.currency = value
  picking.value = false
}

function fill(row: AssetRow) {
  form.id = row.id
  form.name = row.name
  form.memberId = row.memberId
  form.type = row.type
  form.fourMoneyType = row.fourMoneyType || 'living'
  form.currency = row.currency || 'CNY'
  form.latestAmount = String(row.rawAmount ?? row.latestAmount ?? '')
  form.insuranceCategory = row.insuranceCategory || ''
  form.annualPremium = row.annualPremium == null ? '' : String(row.annualPremium)
  origin.value = Number(row.rawAmount ?? row.latestAmount)
  kept.channel = row.channel || ''
  kept.turnaroundCycle = row.turnaroundCycle || 'T+0'
}

async function load() {
  view.bindBill(billId.value)
  const memberRes = await assetApi.members(billId.value)
  if (memberRes.retCode !== 0) return (error.value = memberRes.message || '无权查看该账本')
  members.value = memberRes.data || []
  if (!form.memberId) form.memberId = view.memberId || members.value[0]?.id || ''
  const assetId = String(route.query.assetId || '')
  if (!assetId) return
  const stats = await assetApi.listStats(billId.value)
  const rows = [...(stats.data?.assetGroups || []), ...(stats.data?.debtGroups || [])].flatMap((group) => group.assets)
  const row = rows.find((item) => item.id === assetId)
  if (row) fill(row)
}

async function save() {
  if (!members.value.length) return (error.value = '请先添加资产成员')
  if (!form.name.trim()) return (error.value = '名称不能为空')
  if (!form.memberId) return (error.value = '请选择成员')
  if (form.latestAmount.trim() === '' || !Number.isFinite(Number(form.latestAmount)) || Number(form.latestAmount) < 0) return (error.value = '当前金额不能小于 0，也不能留空')
  if (form.type !== 'debt' && !form.fourMoneyType) return (error.value = '请选择四笔钱')
  if (form.fourMoneyType === 'insurance' && form.annualPremium !== '' && Number(form.annualPremium) < 0) return (error.value = '年交保费不能小于 0')
  if (!form.id && !form.date) return (error.value = '请填写盘点日')
  error.value = ''
  const payload: AssetPayload = {
    id: form.id || undefined,
    name: form.name.trim(),
    billId: billId.value,
    memberId: form.memberId,
    type: form.type,
    fourMoneyType: form.type === 'debt' ? '' : form.fourMoneyType,
    latestAmount: Number(form.latestAmount),
    currency: form.currency,
    insuranceCategory: form.fourMoneyType === 'insurance' && form.type !== 'debt' ? form.insuranceCategory : '',
    annualPremium: form.fourMoneyType === 'insurance' && form.type !== 'debt' ? form.annualPremium : ''
  }
  if (form.id) {
    payload.channel = kept.channel
    payload.turnaroundCycle = kept.turnaroundCycle
  }
  const res = form.id ? await assetApi.editAsset(payload) : await assetApi.addAsset(payload)
  if (res.retCode !== 0) return (error.value = res.message || '没有保存')
  if (!form.id && form.date !== today) {
    const created = res.data as { id?: string } | null
    const assetId = created?.id || ''
    if (assetId) {
      const page = await assetApi.records(assetId, 1)
      const first = page.data?.list?.[0]
      if (first) await assetApi.saveRecord({ id: first.id, assetId, amount: Number(form.latestAmount), date: dayStamp(form.date) }, true)
    }
  }
  router.back()
}

async function remove() {
  const res = await assetApi.deleteAsset(form.id)
  if (res.retCode !== 0) error.value = res.message || '没有删除'
  else router.back()
}

watch(() => billId.value, load, { immediate: true })
</script>
