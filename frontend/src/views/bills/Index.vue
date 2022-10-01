<template>
  <div class="bills">
    <div class="bill" v-for="item in bills" :key="item.id">
      <div class="modal">
        <i class="item el-icon-view" @click="showDetail(item)"></i>
        <i v-if="item.creator === userInfo.userId" class="item el-icon-share" @click="shareBill(item)"></i>
        <i v-if="item.creator === userInfo.userId" class="item el-icon-delete" @click="showDeleteDialog(item)"></i>
      </div>
      {{ item.name }}
    </div>
    <div class="bill add-bill" @click="showBillDialog">+</div>
    <el-dialog title="新增账本" custom-class="add-bill-dialog" :visible.sync="addBillDialog">
      <el-form ref="addForm" :model="form" :rules="rules">
        <el-form-item label="账本名称" label-width="70px" prop="name" style="margin-bottom: 0">
          <el-input v-model="form.name" autocomplete="off"></el-input>
        </el-form-item>
      </el-form>
      <div slot="footer" class="dialog-footer">
        <el-button :loading="dialogLoading" type="primary" @click="addBill">确定</el-button>
        <el-button :disabled="dialogLoading" @click="addBillDialog = false">取消</el-button>
      </div>
    </el-dialog>
    <el-dialog title="您确定要删除吗？" custom-class="delete-bill-dialog" :visible.sync="deleteBillDialog">
      <div style="color: #999">删除后账本相关数据将无法恢复</div>
      <div slot="footer" class="dialog-footer">
        <el-button :loading="dialogLoading" type="primary" @click="deleteBill">确定</el-button>
        <el-button :disabled="dialogLoading" @click="deleteBillDialog = false">取消</el-button>
      </div>
    </el-dialog>
    <el-dialog title="分享码已生成，时长为30分钟" custom-class="delete-bill-dialog" :visible.sync="shareBillDialog">
      <div style="color: #999">分享码：{{ shareCode }}</div>
      <div slot="footer" class="dialog-footer">
        <el-button type="primary" @click="shareBillDialog = false">确定</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script>
import { createBill, getBillList, deleteBill, shareBill } from './api'
import { mapState, mapActions } from 'vuex'
export default {
  data() {
    return {
      addBillDialog: false, // 新增账本弹窗
      deleteBillDialog: false, // 删除账本弹窗
      shareBillDialog: false, // 分享账本弹窗
      dialogLoading: false,
      bills: [], // 账本列表
      form: { name: '' },
      operateBill: null, // 当前操作的账本
      shareCode: '', // 分享码
      rules: {
        name: [
          {
            validator: (rule, value, callback) => {
              console.log(value)
              if (!value) {
                return callback(new Error('请输入账本名称'))
              }
              const reg = /^[\u4E00-\u9FA5A-Za-z0-9_]{3,10}$/
              if (reg.test(value)) {
                callback()
              } else {
                callback(new Error('账本只能包含中文、英文、数字以及下划线，长度在3-10之间'))
              }
            },
            trigger: 'blur'
          }
        ]
      },
      userInfo: {}, // 用户信息
    }
  },

  created() {
    this.userInfo = this.$tools.getUserInfo()
    this.getBillList()
  },

  mounted() {},
  computed: {
    ...mapState({
      updateBill: (state) => state.updateBill
    })
  },
  watch: {
    updateBill: {
      handler(val) {
        if (val) {
          this.getBillList()
          this.updateState({ key: 'updateBill', value: false })
        }
      }
    }
  },

  methods: {
    ...mapActions(['updateState']),
    // 进入账本
    showDetail(item) {
      sessionStorage.setItem('tabValue', 'record')
      sessionStorage.setItem('bill', JSON.stringify(item))
      this.updateState({ key: 'bill', value: item })
      this.$router.push('/layout/record')
    },
    // 显示新增账本弹窗
    showBillDialog() {
      this.form.name = ''
      this.addBillDialog = true
    },
    // 显示删除账本弹窗
    showDeleteDialog(item) {
      this.deleteBillDialog = true
      this.operateBill = item
    },
    // 获取账本列表
    async getBillList() {
      const [err, res] = await getBillList()
      if (err) return
      if (res.retCode === 0) {
        this.bills = res.data.map((item) => {
          item.id = item._id
          return item
        })
      } else {
        this.$message.error('获取账本列表失败，' + res.message)
      }
    },
    // 新增账本
    async addBill() {
      this.$refs.addForm.validate(async (valid) => {
        console.log(valid)
        if (valid) {
          const data = {
            name: this.form.name
          }
          this.dialogLoading = true
          const [err, res] = await createBill({ data })
          this.dialogLoading = false
          if (err) return
          if (res.retCode === 0) {
            this.addBillDialog = false
            this.$message.success('新增账本成功')
            this.getBillList()
          } else {
            this.$message.error('新增账本失败，' + res.message)
          }
        }
      })
    },
    // 删除账本
    async deleteBill() {
      const data = { id: this.operateBill.id }
      this.dialogLoading = true
      const [err, res] = await deleteBill({ data })
      this.dialogLoading = false
      this.deleteBillDialog = false
      if (err) return
      if (res.retCode === 0) {
        this.$message.success('删除账本成功')
        this.getBillList()
      } else {
        this.$message.error('删除账本失败，' + res.message)
      }
    },
    // 分享账本
    async shareBill(item) {
      const data = { id: item.id }
      const [err, res] = await shareBill({ data })
      if (err) return
      if (res.retCode === 0) {
        this.shareCode = res.data
        this.shareBillDialog = true
      } else {
        this.$message.error('生成分享码失败，' + res.message)
      }
    }
  }
}
</script>
<style scoped lang="scss">
.bills {
  height: 100%;
  width: 100%;
  padding: 20px 0 0 20px;
  display: flex;
  align-items: center;
  align-content: flex-start;
  flex-wrap: wrap;
  .bill {
    position: relative;
    width: 200px;
    height: 150px;
    color: #fff;
    padding: 10px;
    margin-right: 20px;
    margin-bottom: 20px;
    border: 1px solid #ddd;
    box-shadow: 2px 2px 2px #eee;
    font-size: 24px;
    background-color: #95c7df;
    border-radius: 4px;
    cursor: pointer;
    .modal {
      position: absolute;
      top: 0;
      left: 0;
      visibility: hidden;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      .item {
        &:hover {
          color: rgba(111, 197, 255, 0.5);
        }
        & + .item {
          margin-left: 10px;
        }
      }
    }
    &:hover {
      .modal {
        visibility: visible;
      }
    }
    &.add-bill {
      background: #fff;
      border-style: dashed;
      color: #999;
      font-size: 40px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }
}
</style>
<style lang="scss">
.add-bill-dialog {
  width: 380px;
}
.delete-bill-dialog {
  width: 380px;
}
</style>
