import '../../config/loadEnv'
import { connectDB } from '../index'
import { backfillDebtFlag } from './assetDebtBackfill'

/** 手工执行一次负债标记回填。服务启动时不会调用这里。 */
const main = async () => {
  await connectDB()
  const affected = await backfillDebtFlag()
  console.log(JSON.stringify({ affected }))
  process.exit(0)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exit(1)
})
