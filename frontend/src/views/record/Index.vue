<template>
  <div class="record">
    <div class="search-form">
      <el-form :inline="true" :model="searchOptions">
        <el-form-item size="small" label="日期">
          <el-date-picker
            v-model="searchOptions.beginDate"
            type="date"
            placeholder="选择开始日期"
            :picker-options="beginDateOptions"
            clearable
          ></el-date-picker
          >~
          <el-date-picker
            v-model="searchOptions.endDate"
            type="date"
            placeholder="选择结束日期"
            :picker-options="endDateOptions"
            clearable
          ></el-date-picker>
        </el-form-item>
        <el-form-item size="small" label="记账人">
          <el-select v-model="searchOptions.userId" filterable placeholder="请选择" clearable>
            <el-option v-for="(item, index) in bill.users" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item size="small" label="支出类型">
          <el-select v-model="searchOptions.costTypeId" filterable placeholder="请选择" clearable>
            <el-option v-for="(item, index) in bill.costTypes" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item size="small" label="收入类型">
          <el-select v-model="searchOptions.incomesTypeId" filterable placeholder="请选择" clearable>
            <el-option v-for="(item, index) in bill.incomesType" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item size="small" label="支付方式">
          <el-select v-model="searchOptions.payMethodId" filterable placeholder="请选择" clearable>
            <el-option v-for="(item, index) in bill.payMethods" :key="item + '_' + index" :label="item.name" :value="item.id"></el-option>
          </el-select>
        </el-form-item>
      </el-form>
    </div>
    <div class="context"></div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
export default {
  data() {
    return {
      searchOptions: {
        beginDate: '',
        endDate: '',
        userId: '',
        costTypeId: '',
        incomesTypeId: '',
        payMethodId: ''
      }
    }
  },

  created() {},
  computed: {
    ...mapState({
      billId: (state) => state.billId,
      bill: (state) => state.bill
    })
  },

  mounted() {},

  methods: {}
}
</script>
<style scoped lang="scss">
.record {
  height: calc(100% - 60px);
  background-color: #8cb3bf;
  width: 100%;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  .search-form {
    min-height: 80px;
    width: 80%;
    padding: 10px;
    background-color: #fff;
    box-shadow: 0px 0px 2px #ddd;
    margin-bottom: 20px;
  }
  .context {
    flex: 1;
    width: 80%;
    background-color: #fff;
    box-shadow: 0px 0px 4px #ddd;
  }
}
</style>
