<template>
  <div class="overview-module">
    <div class="belong-user-module">
      <div class="title">收支概览</div>
      <div class="total-context">
        <div class="line">
          总支出：<span class="color-red">{{ belongUsers.totalCost }}</span>
        </div>
        <div class="line">
          总收入：<span class="color-red">{{ belongUsers.totalIncomes }}</span>
        </div>
      </div>
      <div class="detail">
        <div class="detail-item" v-for="item in belongUsers.details" :key="item.belongUserId + '_' + item.userId">
          ({{ item.userName }}) {{ item.belongUserName }}支出：<span class="color-red">{{ item.money.toFixed(2) }}</span>
        </div>
      </div>
      <div class="add-data-container">
        <el-form :model="belongCondition" ref="form" class="form-container" labelPosition="top">
          <el-form-item prop="startDate" required size="small" label="开始时间">
            <el-date-picker style="width: 100%" v-model="belongCondition.startDate" value-format="yyyy-MM-dd" type="date" placeholder="开始时间">
            </el-date-picker>
          </el-form-item>
          <el-form-item prop="endDate" required size="small" label="结束时间">
            <el-date-picker style="width: 100%" v-model="belongCondition.endDate" value-format="yyyy-MM-dd" type="date" placeholder="结束时间">
            </el-date-picker>
          </el-form-item>
          <el-form-item prop="proportion" required size="small" label="比例（宜：栋）">
            <el-input v-model="belongCondition.proportion" placeholder="比例（宜：栋）"></el-input>
          </el-form-item>
          <el-form-item class="form-item" size="small">
            <el-button type="primary" @click="search">查询</el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      belongUsers: {
        totalCost: 0, // 总支出
        totalIncomes: 0, // 总收入
        details: [
          {
            belongUserId: '63023d593783325f04872f00',
            belongUserName: '栋',
            money: 142,
            userId: '63023d593783325f04872f00',
            userName: '栋'
          },
          {
            belongUserId: '630cd5db5d09bb41002461bb',
            belongUserName: '宜',
            money: 142,
            userId: '63023d593783325f04872f00',
            userName: '栋'
          },
          {
            belongUserId: '',
            belongUserName: '全部',
            money: 142,
            userId: '63023d593783325f04872f00',
            userName: '栋'
          },
          {
            belongUserId: '630cd5db5d09bb41002461bb',
            belongUserName: '宜',
            money: 142,
            userId: '630cd5db5d09bb41002461bb',
            userName: '宜'
          },
          {
            belongUserId: '63023d593783325f04872f00',
            belongUserName: '栋',
            money: 142,
            userId: '630cd5db5d09bb41002461bb',
            userName: '宜'
          },
          {
            belongUserId: '',
            belongUserName: '全部',
            money: 142,
            userId: '630cd5db5d09bb41002461bb',
            userName: '宜'
          }
        ]
      },
      belongCondition: {
        startDate: '',
        endDate: '',
        proportion: '954.44:1055'
      }
    }
  },
  methods: {
    search() {
      console.log(this.belongCondition)
    }
  }
}
</script>

<style lang="scss">
.overview-module {
  height: calc(100% - 60px);
  width: 100%;
  background-color: #fff;
  display: flex;
  align-items: center;
  padding: 20px;
  .color-red {
    color: rgb(247, 79, 79);
  }
  .belong-user-module {
    width: 300px;
    height: 100%;
    border-radius: 8px;
    box-shadow: 1px 1px 5px #999;
    background-color: #fff;
    padding: 20px;
    display: flex;
    flex-direction: column;
    .title {
      font-size: 26px;
      font-weight: bold;
      text-align: center;
      // height: 30px;
      // line-height: 30px;
      margin-bottom: 20px;
    }
    .total-context {
      padding-bottom: 10px;
      border-top: 1px solid #ddd;
      border-bottom: 1px solid #ddd;
      font-size: 24px;
      .line {
        padding-top: 10px;
      }
    }
    .detail {
      flex: 1;
      min-height: 0;
      .detail-item {
        height: 35px;
        line-height: 35px;
        font-size: 20px;
        border-bottom: 1px dotted #ccc;
      }
    }
    .add-data-container {
      width: 100%;
      height: 320px;
      border-top: 1px solid #ddd;
      .form-item {
        text-align: center;
      }
    }
  }
}
</style>
