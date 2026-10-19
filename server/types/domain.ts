import type { RouterContext } from 'koa-router'

/**
 * 账本、记账、预算、分账等业务对象。
 * 只声明会读取的字段，不使用 any。写错字段名时类型检查失败。
 * 查询条件里的 Sequelize 运算符是 symbol，单独放开。
 */
export interface Row {
  id?: string
  billId?: string
  userId?: string
  userName?: string
  name?: string
  nickName?: string
  username?: string
  password?: string
  avatarUrl?: string
  creator?: string
  openid?: string
  unionid?: string
  date?: number | string | null
  type?: number | string
  money?: number | string
  costTypeId?: string | null
  costTypeName?: string
  payMethodId?: string
  payMethodName?: string
  reimbursement?: number | string | null
  incomesTypeId?: string
  incomesTypeName?: string
  belongUserId?: string | null
  belongUserName?: string | null
  belongUserIds?: string[]
  remark?: string
  isDel?: boolean
  hidden?: boolean
  isBuy?: boolean
  isDebt?: boolean
  title?: string
  context?: string
  priority?: number | string
  planBuyCount?: number
  ruleType?: string
  enabled?: boolean
  unitName?: string | null
  excludeId?: string
  unitPrice?: number | string | null
  sort?: number
  isBuiltin?: boolean
  builtinKey?: string
  totalBudget?: number
  currCost?: number
  budget?: number | Row[]
  cost?: number
  budgetId?: string
  memberId?: string
  member?: { name?: string }
  memberName?: string
  fourMoneyType?: string
  latestAmount?: number | string
  insuranceCategory?: string | null
  annualPremium?: number | string | null
  lastUpdatedDate?: number | null
  amount?: number | string
  assetId?: string
  objectKey?: string
  transactionId?: string | null
  size?: number
  contentType?: string
  viewable?: boolean
  createdAt?: Date | string
  incomes?: number
  expenses?: number
  quantity?: number | string | null
  ruleId?: string
  payerName?: string | null
  imageIds?: string[]
  images?: { id?: string; sort?: number; viewUrl?: string }[]
  code?: string
  bindTicket?: string
  pageIndex?: number | string
  pageSize?: number | string
  direction?: string
  anchorDate?: string | number
  cursorDate?: string | number
  cursorId?: string
  beginDate?: string | number | null
  endDate?: string | number | null
  startDate?: string | number | null
  text?: string
  refreshToken?: string
  accessToken?: string
  list?: Row[]
  condition?: string
  rangeMoney?: number | string
  viewerUserId?: string
  operatorId?: string
  withMonthSummary?: boolean
  quantityInputs?: Row[]
  year?: number | string
  count?: number
  length?: number
  message?: string
  value?: number
  datas?: Row[]
  details?: Row[]
  users?: Row[]
  costTypes?: Row[]
  incomesTypes?: Row[]
  payMethods?: Row[]
  overviewRules?: Row[]
  planBuy?: { count?: number; details?: Row[] }
  planBuyDetails?: Row[]
  budgets?: Row[]
  rules?: Row[]
  transactions?: Row[]
  publicKey?: string
  privateKey?: string
  transaction?: unknown
  host?: string
  port?: number
  database?: string
  dialect?: string
  logging?: boolean
  pool?: { max?: number; min?: number; acquire?: number; idle?: number }
  cents?: number
  remain?: number
  fromUserId?: string
  fromName?: string
  toUserId?: string
  toName?: string
  effectiveIncome?: number
  weight?: number
  paid?: number
  borne?: number
  net?: number
  lines?: string[]
  transfers?: Row[]
  slices?: Row[]
  members?: Row[]
  index?: number
  filepath?: string
  mimetype?: string
  originalFilename?: string
  path?: string
  buffer?: Buffer
  hasOlder?: boolean
  hasNewer?: boolean
  total?: number
  typeName?: string
  change?: number
  changeRate?: number | null
  percent?: number
  prevAmount?: number | null
  key?: string
  errcode?: number
  errmsg?: string
  session_key?: string
  get?(options?: { plain?: boolean }): Row
  getDataValue?(key: string): string | number | Date | null
  toJSON?(): Row
  [key: symbol]: unknown
}

/** 查询条件。允许按字段名写入，也允许 Sequelize 的 symbol 运算符。 */
export interface WhereBag {
  [key: string]: unknown
  [key: symbol]: unknown
}

/** 路由入参。字段来自现有请求体，不使用 any。 */
export interface ApiInput extends Row {
  password?: string
  nickName?: string
  file?: Row
}

/** 与 koa-router 实际传入的上下文兼容。请求体在路由里收成 ApiInput。 */
export type HttpContext = RouterContext & {
  session?: Record<string, unknown> | null
  request: RouterContext['request'] & {
    body?: ApiInput
    files?: { file?: { filepath?: string; size?: number; mimetype?: string; originalFilename?: string } }
  }
}

/** 取出 JSON 请求体。没有请求体时按空对象处理。 */
export const readBody = (ctx: HttpContext): ApiInput => ctx.request.body || {}

/** 查询串和请求头在只有一个值时保持原字符串。 */
export const queryString = (value: string | string[] | undefined | null): string | undefined =>
  typeof value === 'string' ? value : undefined

/** 在路由边界把查询对象收成入参，字段名仍受 ApiInput 检查。 */
export const asInput = (value: object | null | undefined): ApiInput => (value || {}) as ApiInput
