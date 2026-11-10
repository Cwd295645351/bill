<template>
  <div class="page plan-page">
    <van-nav-bar title="计划" left-arrow fixed placeholder @click-left="goBack" />

    <div v-if="loadError" class="page-pad">
      <van-empty :description="loadError">
        <van-button size="small" type="primary" color="#4285F4" @click="load">重试</van-button>
      </van-empty>
    </div>

    <template v-else>
      <div class="plan-main">
        <div class="a-hint">
          计划只是想买或待办，不会自动变成记账。买完后请再到记账里补一条支出。
        </div>

        <div class="plan-list">
          <template v-for="(meta, idx) in priorityMeta" :key="meta.priority">
            <div class="p-head" :style="{ background: meta.color }">{{ meta.label }}</div>
            <template v-if="groups[idx].length">
              <div v-for="item in groups[idx]" :key="item.id" class="p-card">
                <div class="title">{{ item.title }}</div>
                <div class="context">{{ item.context }}</div>
                <div class="b-ops">
                  <button type="button" class="edit" @click="openEdit(item)">编辑</button>
                  <button type="button" class="del" @click="openDelete(item)">删除</button>
                </div>
              </div>
            </template>
            <div v-else class="a-note">这一档还没有</div>
          </template>
        </div>

        <div class="a-foot">
          <button type="button" class="primary" @click="openAdd">新增计划</button>
        </div>
      </div>
    </template>

    <BookTabBar :bill-id="billId" active="plan" />

    <van-popup v-model:show="showForm" position="bottom" round>
      <div class="sheet">
        <div class="sheet-bar">
          <button type="button" class="cancel" @click="showForm = false">取消</button>
          <div class="sheet-title">{{ formMode === 'edit' ? '编辑计划' : '新增计划' }}</div>
          <button type="button" class="confirm" :disabled="saving" @click="saveForm">保存</button>
        </div>
        <van-cell-group>
          <van-field v-model="formTitle" label="标题" placeholder="请输入标题" clearable />
          <van-field v-model="formContext" label="内容" placeholder="请输入内容" clearable />
        </van-cell-group>
        <div class="hint">优先级</div>
        <div class="chips">
          <button
            v-for="opt in priorityOptions"
            :key="opt.value"
            type="button"
            class="chip"
            :class="{ on: formPriority === opt.value }"
            @click="formPriority = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
    </van-popup>

    <van-dialog
      v-model:show="showDel"
      title="删除这条计划"
      message="删除后不能恢复。"
      show-cancel-button
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import {
  getPlanList,
  planAdd,
  planDelete,
  planEdit,
  type PlanItem,
  type PlanPriority,
} from '@/api/plan'
import BookTabBar from '@/components/BookTabBar.vue'
import { groupPlansByPriority, PLAN_PRIORITY_META } from '@/utils/plan-group'

const route = useRoute()
const router = useRouter()

const billId = ref(String(route.params.id || ''))
const loading = ref(false)
const loadError = ref('')
const details = ref<PlanItem[]>([])

const showForm = ref(false)
const showDel = ref(false)
const saving = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const formId = ref('')
const formTitle = ref('')
const formContext = ref('')
const formPriority = ref<PlanPriority>(1)
const pendingDelId = ref('')

const priorityMeta = PLAN_PRIORITY_META
const priorityOptions = [
  { value: 1 as PlanPriority, label: '高' },
  { value: 2 as PlanPriority, label: '中' },
  { value: 3 as PlanPriority, label: '低' },
]

const groups = computed(() => groupPlansByPriority(details.value))

function goBack() {
  router.replace({ name: 'bill-detail', params: { id: billId.value } })
}

async function load() {
  if (!billId.value) {
    loadError.value = '缺少账本'
    return
  }
  loading.value = true
  loadError.value = ''
  const res = await getPlanList(billId.value)
  loading.value = false
  if (res.retCode !== 0) {
    loadError.value = res.message || '加载失败'
    details.value = []
    return
  }
  const list = Array.isArray(res.data?.details) ? res.data.details : []
  details.value = list.map((item) => ({
    id: String(item.id),
    title: String(item.title || ''),
    context: String(item.context || ''),
    priority: (Number(item.priority) as PlanPriority) || 1,
  }))
}

function openAdd() {
  formMode.value = 'create'
  formId.value = ''
  formTitle.value = ''
  formContext.value = ''
  formPriority.value = 1
  showForm.value = true
}

function openEdit(item: PlanItem) {
  formMode.value = 'edit'
  formId.value = item.id
  formTitle.value = item.title
  formContext.value = item.context
  formPriority.value = item.priority
  showForm.value = true
}

function openDelete(item: PlanItem) {
  pendingDelId.value = item.id
  showDel.value = true
}

async function saveForm() {
  const title = formTitle.value.trim()
  const context = formContext.value.trim()
  if (!title || !context) {
    showToast('请填写标题和内容')
    return
  }
  const priority = formPriority.value
  if (priority !== 1 && priority !== 2 && priority !== 3) {
    showToast('请选择优先级')
    return
  }
  saving.value = true
  const res =
    formMode.value === 'edit'
      ? await planEdit({
          id: formId.value,
          billId: billId.value,
          title,
          context,
          priority,
        })
      : await planAdd({
          billId: billId.value,
          title,
          context,
          priority,
        })
  saving.value = false
  if (res.retCode !== 0) {
    showToast(res.message || '保存失败')
    return
  }
  showForm.value = false
  showToast('已保存')
  await load()
}

async function confirmDelete() {
  const id = pendingDelId.value
  if (!id) return
  const res = await planDelete({ id, billId: billId.value })
  if (res.retCode !== 0) {
    showToast(res.message || '删除失败')
    return
  }
  showToast('已删除')
  await load()
}

onMounted(async () => {
  billId.value = String(route.params.id || '')
  await load()
})
</script>

<style scoped>
.plan-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: #f5f6f8;
  box-sizing: border-box;
}
.plan-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.a-hint {
  flex: none;
  margin: 8px 12px 10px;
  padding: 10px 12px;
  color: #666;
  font-size: 12px;
  line-height: 1.5;
  background: #fff;
  border-radius: 8px;
}
.plan-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 8px;
}
.p-head {
  margin: 0 12px 8px;
  padding: 8px 12px;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  border-radius: 8px;
}
.p-card {
  box-sizing: border-box;
  width: calc(100% - 24px);
  margin: 0 12px 10px;
  padding: 12px;
  background: #fff;
  border-radius: 10px;
  text-align: left;
}
.p-card .title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}
.p-card .context {
  margin-top: 6px;
  color: #666;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.a-note {
  margin: 0 12px 10px;
  color: #999;
  font-size: 12px;
  line-height: 1.5;
}
.b-ops {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 10px;
}
.b-ops button {
  flex: 1;
  max-width: 88px;
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
  border: none;
  border-radius: 14px;
}
.b-ops .edit {
  color: #4285f4;
  background: #e8f1ff;
}
.b-ops .del {
  color: #f74f4f;
  background: #fdecec;
}
.a-foot {
  flex: none;
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  background: #fff;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.04);
}
.a-foot .primary {
  flex: 1;
  height: 40px;
  color: #fff;
  font-size: 14px;
  background: #4285f4;
  border: none;
  border-radius: 20px;
}
.sheet {
  padding-bottom: 16px;
}
.sheet-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
}
.sheet-title {
  font-weight: 600;
}
.cancel,
.confirm {
  border: none;
  background: transparent;
  color: #4285f4;
  font-size: 15px;
}
.cancel {
  color: #999;
}
.hint {
  padding: 8px 16px 0;
  color: #999;
  font-size: 12px;
  line-height: 1.5;
}
.chips {
  display: flex;
  gap: 8px;
  padding: 8px 16px 4px;
}
.chip {
  flex: 1;
  height: 32px;
  border: 1px solid #ebedf0;
  border-radius: 16px;
  background: #fff;
  color: #666;
  font-size: 13px;
}
.chip.on {
  color: #fff;
  background: #4285f4;
  border-color: #4285f4;
}
.page-pad {
  padding: 24px 12px;
}
</style>
