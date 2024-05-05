<template>
  <div class="add-record-page">
    <van-nav-bar left-text="返回" lefr-arrow safe-area-inset-top @click-left="onClickLeft">
      <template #title>
        <div class="type-group">
          <div class="type-item" :class="{ active: type === 1 }" @click="changeType(1)">支出</div>
          <div class="type-item" :class="{ active: type === 2 }" @click="changeType(2)">收入</div>
        </div>
      </template>
    </van-nav-bar>
    <div class="form-container">
      <van-form @submit="submitForm">
        <van-field v-model="searchOptions.beginDate" is-link readonly name="datePicker" label="日期" placeholder="点击选择时间" @click="showDatePickerAction('beginDate')" />
        <van-field v-model="searchOptions.remark" name="input" label="内容" placeholder="请输入内容" />
        <van-field v-model="searchOptions.belongUserName" is-link readonly name="picker" label="归属人" placeholder="点击选择归属人" @click="showPickerAction('belongUser')" />
        <van-field v-show="type === 1" v-model="searchOptions.costTypeName" is-link readonly name="picker" label="支出类型" placeholder="点击选择支出类型" @click="showPickerAction('costType')" />
        <van-field
          v-show="type === 2"
          v-model="searchOptions.incomesTypeName"
          is-link
          readonly
          name="picker"
          label="收入类型"
          placeholder="点击选择收入类型"
          @click="showPickerAction('incomesType')"
        />
        <van-field v-model="searchOptions.rangeMoney" label="金额" readonly clickable @touchstart.stop="showNumberPop = true" />
        <van-number-keyboard v-model="searchOptions.rangeMoney" :show="showNumberPop" :maxlength="10" extra-key="." close-button-text="完成" @blur="showNumberPop = false" />

        <div style="margin: 16px">
          <van-button round block type="primary" native-type="submit"> 提交 </van-button>
        </div>
      </van-form>
      <van-popup v-model:show="showSelectPicker" position="bottom">
        <van-picker :columns="currentPickerOptions.options" :columns-field-names="{ text: 'name', value: 'id' }" @confirm="onConfirmPicker" @cancel="showSelectPicker = false" />
      </van-popup>
      <van-popup v-model:show="showDatePicker" position="bottom">
        <van-date-picker @confirm="onConfirmDatePicker" @cancel="showDatePicker = false" />
      </van-popup>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import dayjs from 'dayjs'
import { showFailToast, showLoadingToast, showConfirmDialog, showSuccessToast } from 'vant'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import { useSearch } from '../../hooks/use-search'
import { addTransactionApi } from '../../api'

const store = useBillStore()
const { billId, bill } = storeToRefs(store)

/** 收支类型：1=支出；2=收入 */
const type = ref<1 | 2>(1)

/** 数字键盘弹出 */
const showNumberPop = ref(false)

const { searchOptions, showSelectPicker, showDatePicker, currentPickerOptions, showPickerAction, onConfirmPicker, showDatePickerAction, onConfirmDatePicker } = useSearch(20)

const submitForm = async () => {
  const information = searchOptions.value
  const data: any = {
    billId: billId.value,
    date: information.beginDate,
    money: Number(information.rangeMoney),
    type: type.value,
    belongUserId: information.belongUserId,
    remark: information.remark,
  }
  if (type.value === 1) {
    data.reimbursement = 0
    data.costTypeId = information.costTypeId
  } else {
    data.incomesTypeId = information.incomesTypeId
  }
  showLoadingToast({ message: '保存中...', forbidClick: true })
  const [err, res] = await addTransactionApi({ data })
  if (err) return
  if (res.retCode === 0) {
    showSuccessToast('保存成功！')
    onClickLeft()
  } else {
    showFailToast('保存失败，' + res.message)
  }
}

/** 切换收支类型 */
const changeType = (changeType: 1 | 2) => {
  type.value = changeType
}

/** 返回 */
const onClickLeft = () => history.back()

onMounted(() => {
  searchOptions.value.beginDate = dayjs().format('YYYY-MM-DD')
  searchOptions.value.belongUserName = '全部'
  searchOptions.value.costTypeName=  '餐饮买菜'
  searchOptions.value.costTypeId=  '1001'
})
</script>

<style scoped lang="scss">
.add-record-page {
  width: 100vw;
  height: 100vh;
  .type-group {
    display: flex;
    align-items: center;
    width: 100px;
    height: 46px;
    .type-item {
      flex: 1;
      min-width: 0;
      height: 100%;
      text-align: center;
      line-height: 46px;
      color: #999;
      font-size: 14px;
      &.active {
        color: #333;
        border-bottom: 1px solid #7baeff;
      }
    }
  }
  .form-container {
    width: 100%;
    height: calc(100% - 46px);
  }
}
</style>
