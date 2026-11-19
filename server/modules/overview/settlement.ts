/**
 * 概览多人分账。纯计算，不访问数据库。
 * 金额在内部使用整数「分」，避免浮点误差。
 */

/** 元转分。0.1 元这类二进制小数先四舍五入到分 */
const toCents = (yuan: number | string | null | undefined) => Math.round(Number(yuan) * 100)

import { isPublicBelong, isMultiBelong, splitBelongIds, BELONG_NAME_SEPARATOR } from '../transaction'

/** 分转元，保留两位 */
const fromCents = (cents: number) => Number((cents / 100).toFixed(2))

/** 转账文案：甲 → 乙 转 100.00 元 */
const formatLine = (fromName: string, toName: string, cents: number) => `${fromName} → ${toName} 转 ${(cents / 100).toFixed(2)} 元`

/**
 * 把一笔金额分给当前成员。公共支出先加总，再用这个函数只分一次。
 * 除最后一名外四舍五入到分，且不超过尚未分出的金额；最后一名拿剩余。
 * @param {number} cents 这笔支出的分
 * @param {number[]} weights 与成员顺序一致的权重
 * @returns {number[]} 每人分到的分
 */
const allocatePublic = (cents: number, weights: number[]) => {
  const count = weights.length
  if (count === 0) return []
  const shares = new Array(count).fill(0)
  if (cents <= 0) return shares
  const weightSum = weights.reduce((sum: number, weight: number) => sum + weight, 0)
  let allocated = 0
  for (let i = 0; i < count - 1; i += 1) {
    const raw = weightSum === 0 ? 0 : Math.round((cents * weights[i]) / weightSum)
    const take = Math.min(Math.max(raw, 0), cents - allocated)
    shares[i] = take
    allocated += take
  }
  shares[count - 1] = cents - allocated
  return shares
}

/**
 * 逐笔份额先保证每一笔加总等于原金额，再把差额挪到与「公共支出合计只分一次」相同。
 * 每人合计与合计分摊一致，每一笔的份额之和不变。
 * @param {number[][]} shareRows 每笔的份额，与成员顺序一致
 * @param {number[]} target 公共支出合计分一次后，每人应承担的分
 */
const reconcileToTarget = (shareRows: number[][], target: number[]) => {
  if (!shareRows.length) return
  const diff = target.map((goal: number, index: number) => {
    const actual = shareRows.reduce((sum: number, shares: number[]) => sum + (shares[index] || 0), 0)
    return goal - actual
  })
  while (true) {
    const over = diff.findIndex((item: number) => item < 0)
    const under = diff.findIndex((item: number) => item > 0)
    if (over < 0 || under < 0) return
    let moved = false
    for (let rowIndex = shareRows.length - 1; rowIndex >= 0; rowIndex -= 1) {
      const shares = shareRows[rowIndex]
      if (!shares[over]) continue
      const amount = Math.min(shares[over], -diff[over], diff[under])
      if (amount <= 0) continue
      shares[over] -= amount
      shares[under] += amount
      diff[over] += amount
      diff[under] -= amount
      moved = true
      break
    }
    if (!moved) return
  }
}

/** 支出结构里的一个类型扇区，金额用分累计 */
interface Slice {
  costTypeId: string
  name: string
  cents: number
}

/** 按金额从高到低输出扇区，0 元的类型不展示 */
const toSlices = (bucket: Record<string, Slice>) =>
  Object.values(bucket)
    .filter((item) => item.cents > 0)
    .sort((a, b) => b.cents - a.cents || String(a.name).localeCompare(String(b.name), 'zh'))
    .map((item) => ({
      costTypeId: item.costTypeId,
      name: item.name,
      money: fromCents(item.cents)
    }))

const addSlice = (bucket: Record<string, Slice>, costTypeId: string | null | undefined, name: string | null | undefined, cents: number) => {
  if (!cents) return
  const key = costTypeId || ''
  if (!bucket[key]) {
    bucket[key] = { costTypeId: key, name: name || '未分类', cents: 0 }
  }
  bucket[key].cents += cents
  if (name) bucket[key].name = name
}

/**
 * 计算一次查询的分摊、净额、转账和支出结构。
 * @param {object} input
 * @param {Array<{userId: string, name: string}>} input.members 已按 bill_users.id 升序
 * @param {Array} input.rules 已启用的概览规则
 * @param {Array<{ruleId: string, quantity: number, belongUserId: string}>} input.quantityInputs
 * @param {Array} input.transactions 区间内未删除的记账；belongUserId 为数据库原值，多人时是按 bill_users.id 升序的逗号串
 * @returns {object} 结算结果
 */
interface SettlementMember {
  userId: string
  name: string
}

interface SettlementRule {
  id: string
  ruleType?: string
  unitPrice?: number | string | null
  costTypeId?: string | null
}

interface QuantityInput {
  ruleId: string
  quantity?: number | string | null
  belongUserId?: string
}

interface SettlementRow {
  type?: number | string
  money?: number | string
  belongUserId?: string | null
  belongUserName?: string | null
  costTypeId?: string | null
  costTypeName?: string | null
  userId?: string
  payerName?: string | null
}

const buildSettlement = ({
  members,
  rules,
  quantityInputs,
  transactions
}: {
  members?: SettlementMember[]
  rules?: SettlementRule[]
  quantityInputs?: QuantityInput[]
  transactions?: SettlementRow[]
}) => {
  const memberList = members || []
  const memberIds = new Set(memberList.map((member: SettlementMember) => member.userId))
  const ruleList = rules || []
  const inputs = quantityInputs || []
  const rows = transactions || []

  const incomeCents: Record<string, number> = {}
  const effectiveCents: Record<string, number> = {}
  memberList.forEach((member: SettlementMember) => {
    incomeCents[member.userId] = 0
    effectiveCents[member.userId] = 0
  })

  rows.forEach((row: SettlementRow) => {
    if (Number(row.type) !== 2) return
    if (isPublicBelong(row.belongUserId) || !memberIds.has(row.belongUserId)) return
    incomeCents[row.belongUserId] += toCents(row.money)
  })

  const deductionCents: Record<string, number> = {}
  memberList.forEach((member: SettlementMember) => {
    deductionCents[member.userId] = 0
  })

  const inputByRule = new Map<string, QuantityInput>(inputs.map((input: QuantityInput) => [input.ruleId, input]))
  ruleList.forEach((rule: SettlementRule) => {
    if (rule.ruleType === 'quantity') {
      const input = inputByRule.get(rule.id)
      const quantity = input ? Number(input.quantity) || 0 : 0
      const belongUserId = input && input.belongUserId ? input.belongUserId : ''
      if (quantity > 0 && belongUserId && memberIds.has(belongUserId)) {
        deductionCents[belongUserId] += Math.round(quantity * Number(rule.unitPrice || 0) * 100)
      }
      return
    }
    if (rule.ruleType === 'cost_type' && rule.costTypeId) {
      /** 多人行按组合汇总后再在组内平均分，同一组合只取整一次 */
      const groupCents = new Map<string, number>()
      rows.forEach((row: SettlementRow) => {
        if (Number(row.type) !== 1) return
        if (row.costTypeId !== rule.costTypeId) return
        if (isPublicBelong(row.belongUserId)) return
        if (isMultiBelong(row.belongUserId)) {
          groupCents.set(row.belongUserId, (groupCents.get(row.belongUserId) || 0) + toCents(row.money))
          return
        }
        if (!memberIds.has(row.belongUserId)) return
        deductionCents[row.belongUserId] += toCents(row.money)
      })
      groupCents.forEach((cents, key) => {
        const groupIds = splitBelongIds(key).filter((id) => memberIds.has(id))
        const shares = allocatePublic(cents, groupIds.map(() => 1))
        groupIds.forEach((id, index) => {
          deductionCents[id] += shares[index]
        })
      })
    }
  })

  memberList.forEach((member: SettlementMember) => {
    effectiveCents[member.userId] = incomeCents[member.userId] - deductionCents[member.userId]
  })

  let weights = memberList.map((member: SettlementMember) => Math.max(effectiveCents[member.userId], 0))
  const weightSum = weights.reduce((sum: number, weight: number) => sum + weight, 0)
  const equalSplit = memberList.length > 0 && weightSum === 0
  if (equalSplit) weights = memberList.map(() => 1)

  const paid: Record<string, number> = {}
  const borne: Record<string, number> = {}
  const names: Record<string, string> = {}
  const exclusiveBorne: Record<string, number> = {}
  const sharedBorne: Record<string, number> = {}
  const publicBorne: Record<string, number> = {}
  memberList.forEach((member: SettlementMember) => {
    paid[member.userId] = 0
    borne[member.userId] = 0
    exclusiveBorne[member.userId] = 0
    sharedBorne[member.userId] = 0
    publicBorne[member.userId] = 0
    names[member.userId] = member.name
  })

  const ensureParty = (userId: string | null | undefined, name: string | null | undefined) => {
    if (!userId || memberIds.has(userId) || paid[userId] != null) return
    paid[userId] = 0
    borne[userId] = 0
    names[userId] = name || '未知'
  }

  const allSlices: Record<string, Slice> = {}
  const memberSlices: Record<string, Record<string, Slice>> = {}
  memberList.forEach((member: SettlementMember) => {
    memberSlices[member.userId] = {}
  })
  /** 公共支出先记下，等全部加总后再分一次，避免逐笔四舍五入把零头叠大 */
  const publicRows: SettlementRow[] = []
  /** 多人支出按归属人组合分组，组内同样先加总再分一次；Map 保持首次出现顺序 */
  const multiGroups = new Map<string, SettlementRow[]>()

  rows.forEach((row: SettlementRow) => {
    if (Number(row.type) !== 1) return
    const cents = toCents(row.money)
    const payerId = row.userId
    ensureParty(payerId, row.payerName)
    if (payerId && paid[payerId] != null) paid[payerId] += cents

    addSlice(allSlices, row.costTypeId, row.costTypeName, cents)

    if (isPublicBelong(row.belongUserId)) {
      publicRows.push(row)
      return
    }

    if (isMultiBelong(row.belongUserId)) {
      const group = multiGroups.get(row.belongUserId) || []
      if (!multiGroups.has(row.belongUserId)) multiGroups.set(row.belongUserId, group)
      group.push(row)
      return
    }

    const belongId = row.belongUserId
    ensureParty(belongId, row.belongUserName)
    if (borne[belongId] != null) borne[belongId] += cents
    if (exclusiveBorne[belongId] != null) exclusiveBorne[belongId] += cents
    if (memberIds.has(belongId)) {
      addSlice(memberSlices[belongId], row.costTypeId, row.costTypeName, cents)
    }
  })

  const publicCents = publicRows.map((row: SettlementRow) => toCents(row.money))
  const totalPublic = publicCents.reduce((sum: number, cents: number) => sum + cents, 0)
  const targetShares = allocatePublic(totalPublic, weights)
  const shareRows = publicCents.map((cents: number) => allocatePublic(cents, weights))
  reconcileToTarget(shareRows, targetShares)
  publicRows.forEach((row: SettlementRow, rowIndex: number) => {
    const shares = shareRows[rowIndex]
    memberList.forEach((member: SettlementMember, index: number) => {
      const share = shares[index] || 0
      borne[member.userId] += share
      publicBorne[member.userId] += share
      addSlice(memberSlices[member.userId], row.costTypeId, row.costTypeName, share)
    })
  })

  multiGroups.forEach((groupRows, key) => {
    const groupIds = splitBelongIds(key)
    const groupNames = String(groupRows[0].belongUserName || '').split(BELONG_NAME_SEPARATOR)
    groupIds.forEach((id, index) => ensureParty(id, groupNames[index]))
    let groupWeights = groupIds.map((id) => (memberIds.has(id) ? Math.max(effectiveCents[id], 0) : 0))
    if (groupWeights.every((weight) => weight === 0)) groupWeights = groupIds.map(() => 1)

    const groupCents = groupRows.map((row: SettlementRow) => toCents(row.money))
    const groupTotal = groupCents.reduce((sum: number, cents: number) => sum + cents, 0)
    const groupTarget = allocatePublic(groupTotal, groupWeights)
    const groupShareRows = groupCents.map((cents: number) => allocatePublic(cents, groupWeights))
    reconcileToTarget(groupShareRows, groupTarget)
    groupRows.forEach((row: SettlementRow, rowIndex: number) => {
      const shares = groupShareRows[rowIndex]
      groupIds.forEach((id, index) => {
        const share = shares[index] || 0
        if (borne[id] != null) borne[id] += share
        if (sharedBorne[id] != null) sharedBorne[id] += share
        if (memberIds.has(id)) addSlice(memberSlices[id], row.costTypeId, row.costTypeName, share)
      })
    })
  })

  const parties: SettlementParty[] = []
  memberList.forEach((member: SettlementMember) => {
    parties.push({
      userId: member.userId,
      name: names[member.userId] || member.name,
      netCents: (paid[member.userId] || 0) - (borne[member.userId] || 0)
    })
  })
  Object.keys(paid)
    .filter((userId) => !memberIds.has(userId))
    .forEach((userId) => {
      parties.push({
        userId,
        name: names[userId] || '未知',
        netCents: (paid[userId] || 0) - (borne[userId] || 0)
      })
    })

  const settled = linesFromNets(memberList, parties)

  return {
    members: memberList.map((member: SettlementMember) => ({
      userId: member.userId,
      name: member.name,
      income: fromCents(incomeCents[member.userId] || 0),
      effectiveIncome: fromCents(effectiveCents[member.userId] || 0),
      weight: equalSplit ? 1 : fromCents(Math.max(effectiveCents[member.userId] || 0, 0)),
      paid: fromCents(paid[member.userId] || 0),
      borne: fromCents(borne[member.userId] || 0),
      exclusive: fromCents(exclusiveBorne[member.userId] || 0),
      sharedShare: fromCents(sharedBorne[member.userId] || 0),
      publicShare: fromCents(publicBorne[member.userId] || 0),
      net: fromCents((paid[member.userId] || 0) - (borne[member.userId] || 0))
    })),
    lines: settled.lines,
    transfers: settled.transfers,
    pies: {
      all: toSlices(allSlices),
      members:
        memberList.length <= 1
          ? []
          : memberList.map((member: SettlementMember) => ({
              userId: member.userId,
              name: member.name,
              slices: toSlices(memberSlices[member.userId])
            }))
    },
    parties
  }
}

/** 参与人净额，单位为分。成员和付款的非成员都在内 */
interface SettlementParty {
  userId: string
  name: string
  netCents: number
}

interface SettlementSlice {
  costTypeId: string
  name: string
  money: number
}

interface YearSettlement {
  members: {
    userId: string
    name: string
    income: number
    effectiveIncome: number
    weight: number
    paid: number
    borne: number
    exclusive: number
    sharedShare: number
    publicShare: number
    net: number
  }[]
  lines: string[]
  transfers: { fromUserId?: string; fromName?: string; toUserId?: string; toName?: string; amount: number }[]
  pies: {
    all: SettlementSlice[]
    members: { userId: string; name: string; slices: SettlementSlice[] }[]
  }
  parties: SettlementParty[]
}

/**
 * 按净额生成与单次分摊相同的转账句子。
 * @param memberList 当前成员，顺序与 bill_users.id 一致
 * @param parties 各参与人净额，分
 * @returns 一组结算句子和转账
 */
const linesFromNets = (memberList: SettlementMember[], parties: SettlementParty[]) => {
  const memberIds = new Set(memberList.map((member) => member.userId))
  const names: Record<string, string> = {}
  const netCents: Record<string, number> = {}
  parties.forEach((party) => {
    names[party.userId] = party.name
    netCents[party.userId] = (netCents[party.userId] || 0) + party.netCents
  })
  memberList.forEach((member) => {
    if (netCents[member.userId] == null) netCents[member.userId] = 0
    if (!names[member.userId]) names[member.userId] = member.name
  })

  const outsiders = Object.keys(netCents)
    .filter((userId) => !memberIds.has(userId))
    .sort((left, right) => {
      const byName = String(names[left] || '').localeCompare(String(names[right] || ''), 'zh')
      if (byName !== 0) return byName
      return String(left).localeCompare(String(right))
    })

  const orderedIds = [...memberList.map((member) => member.userId), ...outsiders]
  const creditors: { userId: string; name: string; remain: number }[] = []
  const debtors: { userId: string; name: string; remain: number }[] = []
  orderedIds.forEach((userId) => {
    const net = netCents[userId] || 0
    if (net > 0) creditors.push({ userId, name: names[userId], remain: net })
    else if (net < 0) debtors.push({ userId, name: names[userId], remain: -net })
  })

  const transfers: {
    fromUserId: string
    fromName: string
    toUserId: string
    toName: string
    amount: number
    cents: number
  }[] = []
  let creditorIndex = 0
  debtors.forEach((debtor) => {
    while (debtor.remain > 0 && creditorIndex < creditors.length) {
      const creditor = creditors[creditorIndex]
      const amount = Math.min(debtor.remain, creditor.remain)
      if (amount > 0) {
        transfers.push({
          fromUserId: debtor.userId,
          fromName: debtor.name,
          toUserId: creditor.userId,
          toName: creditor.name,
          amount: fromCents(amount),
          cents: amount
        })
        debtor.remain -= amount
        creditor.remain -= amount
      }
      if (creditor.remain === 0) creditorIndex += 1
    }
  })

  const outsiderInvolved = transfers.some(
    (item) => !item.fromUserId || !memberIds.has(item.fromUserId) || !item.toUserId || !memberIds.has(item.toUserId)
  )
  let lines: string[]
  if (memberList.length <= 1 && transfers.length === 0) {
    lines = ['无需分账']
  } else if (memberList.length === 2 && !outsiderInvolved) {
    lines =
      transfers.length === 0
        ? ['双方结清，无需转账']
        : [formatLine(transfers[0].fromName || '', transfers[0].toName || '', transfers[0].cents || 0)]
  } else if (transfers.length === 0) {
    lines = ['各方结清，无需转账']
  } else {
    lines = transfers.map((item) => formatLine(item.fromName || '', item.toName || '', item.cents || 0))
  }

  return {
    lines,
    transfers: transfers.map(({ fromUserId, fromName, toUserId, toName, amount }) => ({
      fromUserId,
      fromName,
      toUserId,
      toName,
      amount
    }))
  }
}

/** 把各年已经取整的扇区金额相加，再按金额从高到低、名称中文排序 */
const mergeSlices = (groups: SettlementSlice[][]) => {
  const bucket = new Map<string, { costTypeId: string; name: string; cents: number }>()
  groups.forEach((slices) => {
    slices.forEach((slice) => {
      const key = slice.costTypeId || ''
      const current = bucket.get(key) || { costTypeId: key, name: slice.name || '未分类', cents: 0 }
      current.cents += toCents(slice.money)
      if (slice.name) current.name = slice.name
      bucket.set(key, current)
    })
  })
  return [...bucket.values()]
    .filter((item) => item.cents > 0)
    .sort((a, b) => b.cents - a.cents || String(a.name).localeCompare(String(b.name), 'zh'))
    .map((item) => ({ costTypeId: item.costTypeId, name: item.name, money: fromCents(item.cents) }))
}

const sumMoney = (
  rows: YearSettlement['members'],
  key: 'income' | 'effectiveIncome' | 'paid' | 'borne' | 'exclusive' | 'sharedShare' | 'publicShare' | 'net'
) => fromCents(rows.reduce((sum, row) => sum + toCents(row[key] || 0), 0))

/**
 * 各年已经取整后，把净额和成员份额相加，只生成一组结算。
 * @param memberList 当前成员
 * @param results 各自然年的分摊结果
 * @returns 与单次分摊相同形状的公开结果，不含 parties
 */
const mergeSettlementResults = (memberList: SettlementMember[], results: YearSettlement[]) => {
  const partyMap = new Map<string, SettlementParty>()
  results.forEach((result) => {
    result.parties.forEach((party) => {
      const current = partyMap.get(party.userId) || { userId: party.userId, name: party.name, netCents: 0 }
      current.netCents += party.netCents
      if (party.name) current.name = party.name
      partyMap.set(party.userId, current)
    })
  })
  const settled = linesFromNets(memberList, [...partyMap.values()])
  const members = memberList.map((member) => {
    const rows = results
      .map((result) => result.members.find((item) => item.userId === member.userId))
      .filter((item): item is YearSettlement['members'][number] => !!item)
    return {
      userId: member.userId,
      name: member.name,
      income: sumMoney(rows, 'income'),
      effectiveIncome: sumMoney(rows, 'effectiveIncome'),
      weight: 0,
      paid: sumMoney(rows, 'paid'),
      borne: sumMoney(rows, 'borne'),
      exclusive: sumMoney(rows, 'exclusive'),
      sharedShare: sumMoney(rows, 'sharedShare'),
      publicShare: sumMoney(rows, 'publicShare'),
      net: sumMoney(rows, 'net')
    }
  })
  return {
    members,
    lines: settled.lines,
    transfers: settled.transfers,
    pies: {
      all: mergeSlices(results.map((result) => result.pies.all)),
      members:
        memberList.length <= 1
          ? []
          : memberList.map((member) => ({
              userId: member.userId,
              name: member.name,
              slices: mergeSlices(
                results.map((result) => result.pies.members.find((item) => item.userId === member.userId)?.slices || [])
              )
            }))
    }
  }
}

/** 去掉内部净额，避免写进公开响应 */
const withoutParties = (result: YearSettlement) => {
  const { parties, ...rest } = result
  return rest
}

export { buildSettlement, toCents, allocatePublic, mergeSettlementResults, withoutParties }
