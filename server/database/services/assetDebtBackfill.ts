import { Asset } from '../index'

/**
 * 把类型已是负债、但负债标记仍为假的未隐藏资产补上标记。
 * 重复执行结果相同。不在服务启动时自动调用。
 */
const backfillDebtFlag = async () => {
  const [affected] = await Asset.update(
    { isDebt: true },
    { where: { type: 'debt', isDebt: false, isDel: false } }
  )
  return affected
}

export { backfillDebtFlag }
