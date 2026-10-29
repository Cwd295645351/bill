<template>
  <div class="page search-page">
    <van-nav-bar title="搜索记账" left-arrow fixed placeholder @click-left="router.back()" />

    <div class="filters">
      <div class="types">
        <button type="button" class="type" :class="{ on: type === 1 }" @click="onType(1)">支出</button>
        <button type="button" class="type" :class="{ on: type === 2 }" @click="onType(2)">收入</button>
      </div>

      <van-cell-group>
        <van-field
          :model-value="beginDate || '请选择'"
          is-link
          readonly
          label="开始时间"
          @click="showBegin = true"
        />
        <van-field
          :model-value="endDate || '请选择'"
          is-link
          readonly
          label="结束时间"
          @click="showEnd = true"
        />
        <van-field v-model="remark" label="内容" placeholder="备注关键字" clearable />
        <van-field
          :model-value="belongUserName"
          is-link
          readonly
          label="归属人"
          @click="showUsers = true"
        />
        <van-field
          :model-value="categoryName"
          is-link
          readonly
          label="分类"
          @click="showCategory = true"
        />
        <van-field
          :model-value="conditionName"
          is-link
          readonly
          label="金额"
          @click="showCondition = true"
        />
        <van-field
          v-model="rangeMoney"
          type="digit"
          label="数值"
          placeholder="不填则不限制"
          clearable
        />
      </van-cell-group>

      <div class="search-btn">
        <van-button block type="primary" color="#4285F4" @click="onSearch">搜索</van-button>
      </div>
    </div>

    <div
      v-if="searched"
      class="list"
      @scroll.passive="onScroll"
      ref="listEl"
    >
      <van-empty v-if="!loading && !groups.length" description="没有符合条件的记录" />
      <template v-for="group in groups" :key="group.date">
        <div class="day">
          {{ group.date }} {{ group.week }}　收 {{ group.incomes }}　支 {{ group.cost }}
        </div>
        <div
          v-for="record in group.arr"
          :key="record.id"
          class="row"
          :class="{ mine: record.mine }"
          :style="record.belongBg ? { backgroundColor: record.belongBg } : undefined"
          @click="onEdit(record)"
        >
          <div class="row-main">
            <div class="title">
              <span>{{ record.belongUserName || '全部' }} · {{ record.category }}</span>
              <span v-if="record.mine" class="mine-tag">我</span>
            </div>
            <div v-if="record.remark" class="remark">{{ record.remark }}</div>
            <div
              v-if="record.images && record.images.length"
              class="photo-entry"
              @click.stop="onPreviewImages(record)"
            >
              查看照片 {{ record.images.length }}
            </div>
          </div>
          <div class="money" :class="record.type === 1 ? 'cost' : 'income'">
            {{ record.moneyText }}
          </div>
        </div>
      </template>
      <div v-if="loading" class="list-tip">加载中…</div>
      <div v-else-if="finished && groups.length" class="list-tip">没有更多了</div>
    </div>

    <van-popup v-model:show="showBegin" position="bottom" round>
      <van-date-picker
        title="开始时间"
        :min-date="minDate"
        :max-date="maxDate"
        @confirm="onBeginConfirm"
        @cancel="showBegin = false"
      />
    </van-popup>
    <van-popup v-model:show="showEnd" position="bottom" round>
      <van-date-picker
        title="结束时间"
        :min-date="minDate"
        :max-date="maxDate"
        @confirm="onEndConfirm"
        @cancel="showEnd = false"
      />
    </van-popup>
    <van-popup v-model:show="showUsers" position="bottom" round>
      <van-picker
        title="归属人"
        :columns="userColumns"
        @confirm="onUserConfirm"
        @cancel="showUsers = false"
      />
    </van-popup>
    <van-popup v-model:show="showCategory" position="bottom" round>
      <van-picker
        title="分类"
        :columns="categoryColumns"
        @confirm="onCategoryConfirm"
        @cancel="showCategory = false"
      />
    </van-popup>
    <van-popup v-model:show="showCondition" position="bottom" round>
      <van-picker
        title="金额条件"
        :columns="conditionColumns"
        @confirm="onConditionConfirm"
        @cancel="showCondition = false"
      />
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showImagePreview, showToast } from 'vant'
import { getBillDetail } from '@/api/bill'
import { getRecordList } from '@/api/transaction'
import { useSessionStore } from '@/stores/session'
import { dayEndTs, dayStartTs } from '@/utils/date'
import { groupRecords, type DayGroup, type RecordItem } from '@/utils/records'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()

const billId = ref(String(route.query.billId || ''))
const type = ref(1)
const beginDate = ref('')
const endDate = ref('')
const remark = ref('')
const belongUserId = ref('')
const belongUserName = ref('全部')
const categoryId = ref('')
const categoryName = ref('全部分类')
const conditionId = ref('gte')
const conditionName = ref('大于等于')
const rangeMoney = ref('')

const users = ref<{ id: string; name: string }[]>([])
const costTypes = ref<any[]>([])
const incomesTypes = ref<any[]>([])

const showBegin = ref(false)
const showEnd = ref(false)
const showUsers = ref(false)
const showCategory = ref(false)
const showCondition = ref(false)

const records = ref<RecordItem[]>([])
const groups = ref<DayGroup[]>([])
const pageIndex = ref(1)
const finished = ref(false)
const loading = ref(false)
const searched = ref(false)
const listEl = ref<HTMLElement | null>(null)
const PAGE_SIZE = 20

const minDate = new Date(2018, 0, 1)
const maxDate = new Date()

const conditionColumns = [
  { text: '大于等于', value: 'gte' },
  { text: '大于', value: 'gt' },
  { text: '等于', value: 'eq' },
  { text: '小于等于', value: 'lte' },
  { text: '小于', value: 'lt' },
]

const userColumns = computed(() => [
  { text: '全部', value: '' },
  ...users.value.map((u) => ({ text: u.name, value: u.id })),
])

const categoryColumns = computed(() => {
  const list = type.value === 2 ? incomesTypes.value : costTypes.value
  return [
    { text: '全部分类', value: '' },
    ...list.filter((c) => !c.isDel && !c.hidden).map((c) => ({ text: c.name, value: c.id })),
  ]
})

const userId = computed(() => session.userInfo?.userId || '')

function rebuildGroups() {
  groups.value = groupRecords(records.value, userId.value, users.value)
}

function onType(next: number) {
  type.value = next === 2 ? 2 : 1
  categoryId.value = ''
  categoryName.value = '全部分类'
}

function fmtPicker(selectedValues: string[]) {
  if (!selectedValues || selectedValues.length < 3) return ''
  const [y, m, d] = selectedValues
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function onBeginConfirm({ selectedValues }: any) {
  beginDate.value = fmtPicker(selectedValues)
  showBegin.value = false
}

function onEndConfirm({ selectedValues }: any) {
  endDate.value = fmtPicker(selectedValues)
  showEnd.value = false
}

function onUserConfirm({ selectedOptions }: any) {
  belongUserId.value = selectedOptions?.[0]?.value ?? ''
  belongUserName.value = selectedOptions?.[0]?.text || '全部'
  showUsers.value = false
}

function onCategoryConfirm({ selectedOptions }: any) {
  categoryId.value = selectedOptions?.[0]?.value ?? ''
  categoryName.value = selectedOptions?.[0]?.text || '全部分类'
  showCategory.value = false
}

function onConditionConfirm({ selectedOptions }: any) {
  conditionId.value = selectedOptions?.[0]?.value || 'gte'
  conditionName.value = selectedOptions?.[0]?.text || '大于等于'
  showCondition.value = false
}

function onSearch() {
  records.value = []
  groups.value = []
  pageIndex.value = 1
  finished.value = false
  searched.value = true
  load(true)
}

function onScroll(e: Event) {
  const el = e.target as HTMLElement
  if (!el || loading.value || finished.value) return
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
    load(false)
  }
}

async function load(reset: boolean) {
  if (loading.value) return
  if (!reset && finished.value) return
  const page = reset ? 1 : pageIndex.value
  loading.value = true
  try {
    const data: any = {
      billId: billId.value,
      type: type.value,
      pageIndex: page,
      pageSize: PAGE_SIZE,
      remark: remark.value,
      belongUserIds: belongUserId.value ? [belongUserId.value] : [],
      condition: conditionId.value,
      rangeMoney: Number(rangeMoney.value || 0),
    }
    if (beginDate.value) data.beginDate = dayStartTs(beginDate.value)
    if (endDate.value) data.endDate = dayEndTs(endDate.value)
    if (type.value === 1) data.costTypeId = categoryId.value
    else data.incomesTypeId = categoryId.value
    const res = await getRecordList(data)
    if (res.retCode !== 0 || !res.data) {
      if (reset) {
        records.value = []
        groups.value = []
      }
      return
    }
    const incoming = (res.data.datas || []) as RecordItem[]
    records.value = reset ? incoming : records.value.concat(incoming)
    const total = Number(res.data.total || 0)
    pageIndex.value = page + 1
    finished.value = records.value.length >= total
    rebuildGroups()
  } finally {
    loading.value = false
  }
}

function onEdit(item: RecordItem) {
  if (!item.mine) {
    showToast('只能编辑自己记的账单')
    return
  }
  sessionStorage.setItem('editingRecord', JSON.stringify(item))
  router.push({ name: 'record-edit', query: { billId: billId.value } })
}

function onPreviewImages(record: RecordItem) {
  if (!record.images || !record.images.length) return
  const sorted = record.images.slice().sort((a, b) => (a.sort || 0) - (b.sort || 0))
  const urls = sorted.map((img) => img.viewUrl).filter(Boolean)
  if (!urls.length) return
  showImagePreview({ images: urls, startPosition: 0 })
}

onMounted(async () => {
  if (!billId.value) return
  const res = await getBillDetail(billId.value)
  if (res.retCode === 0 && res.data) {
    users.value = (res.data.users || []).map((u: any) => ({ id: u.id, name: u.name }))
    costTypes.value = res.data.costTypes || []
    incomesTypes.value = res.data.incomesTypes || []
  }
})
</script>

<style scoped>
.search-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f7f8fa;
}
.filters {
  flex-shrink: 0;
  background: #fff;
}
.types {
  display: flex;
  align-items: center;
  background: #fff;
}
.type {
  flex: 1;
  margin: 0;
  padding: 0;
  line-height: 36px;
  text-align: center;
  color: #666;
  font-size: 15px;
  background: transparent;
  border: none;
}
.type.on {
  color: #4285f4;
  font-weight: 600;
}
.search-btn {
  padding: 8px 12px 12px;
  background: #fff;
}
.list {
  flex: 1;
  height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.day {
  padding: 8px 12px;
  color: #888;
  font-size: 12px;
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 12px 6px;
  padding: 10px 12px;
  background: #fff;
  border-radius: 6px;
}
.row.mine {
  box-shadow: inset 3px 0 0 #4285f4;
}
.row-main {
  min-width: 0;
  flex: 1;
  padding-right: 8px;
}
.title {
  display: flex;
  align-items: center;
  font-size: 14px;
  color: #323233;
}
.mine-tag {
  flex-shrink: 0;
  margin-left: 6px;
  padding: 0 5px;
  color: #4285f4;
  font-size: 10px;
  line-height: 16px;
  background: #e8f0fe;
  border-radius: 4px;
}
.remark {
  margin-top: 3px;
  color: #999;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.photo-entry {
  margin-top: 4px;
  color: #4285f4;
  font-size: 12px;
}
.money {
  flex-shrink: 0;
  font-weight: 600;
  font-size: 15px;
}
.money.cost {
  color: #f74f4f;
}
.money.income {
  color: #07c160;
}
.list-tip {
  padding: 12px;
  text-align: center;
  color: #999;
  font-size: 12px;
}
</style>
