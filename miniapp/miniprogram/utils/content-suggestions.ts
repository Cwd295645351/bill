/** 按分类名称给出的内容建议。自定义项按分类 id 存在本地。 */

const BUILTIN: Record<string, string[]> = {
  餐饮买菜: ['早餐', '午餐', '晚餐', '美团买菜', '朴朴超市'],
  交通: ['充深圳通', '地铁', '打车', '公交', '停车费', '高速费', '油费', '汽车保养', '充电费'],
  衣服鞋帽: ['上衣', '裤子', '鞋子', '外套', '内衣', '配饰'],
  日用品: ['纸巾', '洗护', '清洁', '厨具', '收纳'],
  通讯网费: ['话费', '宽带', '流量', '会员'],
  休闲娱乐: ['电影', '游戏', '羽毛球', 'KTV', '门票'],
  医疗: ['海露', '一次性口罩', '酒精棉片'],
  家居: ['家具', '家电', '装修', '维修'],
  零食饮料: ['零食', '饮料', '奶茶', '酒水'],
  学习: ['书籍', '课程', '文具', '培训'],
  护肤彩妆: ['护肤', '彩妆', '美容'],
  住房: ['房租', '水电', '物业', '燃气'],
  数码: ['手机', '电脑', '配件', '软件'],
  孝顺: ['生活费', '礼物', '医疗', '红包'],
  基金: ['微信定投', '支付宝定投', '且慢', '黄金'],
  爱的基金: ['礼物', '约会', '纪念日'],
  人情往来: ['红包', '礼物', '请客', '随礼'],
  出游: ['门票', '住宿', '交通', '餐饮', '特产'],
  其它支出: ['杂项'],
  工资: ['工资', '奖金', '补贴'],
  生活费: ['家用', '零花'],
  兼职外快: ['兼职', '稿费', '外包'],
  投资收入: ['基金', '股票', '利息', '理财'],
  奖金: ['年终奖', '绩效', '项目奖'],
  福利: ['报销', '津贴', '礼金'],
  其它收入: ['退款', '红包', '其他']
}

const STORAGE_KEY = 'contentSuggestions'

export interface SuggestionChip {
  text: string
  custom: boolean
  on: boolean
}

function readCustomMap(): Record<string, string[]> {
  const data = wx.getStorageSync(STORAGE_KEY)
  return data && typeof data === 'object' ? data : {}
}

export function builtinSuggestions(categoryName: string): string[] {
  return BUILTIN[categoryName] ? BUILTIN[categoryName].slice() : []
}

export function customSuggestions(categoryId: string): string[] {
  if (!categoryId) return []
  const list = readCustomMap()[categoryId]
  return Array.isArray(list) ? list.slice() : []
}

export function addCustomSuggestion(categoryId: string, text: string) {
  const map = readCustomMap()
  const list = Array.isArray(map[categoryId]) ? map[categoryId].slice() : []
  if (list.indexOf(text) < 0) list.push(text)
  map[categoryId] = list
  wx.setStorageSync(STORAGE_KEY, map)
}

export function removeCustomSuggestion(categoryId: string, text: string) {
  const map = readCustomMap()
  const list = Array.isArray(map[categoryId]) ? map[categoryId] : []
  map[categoryId] = list.filter((item) => item !== text)
  wx.setStorageSync(STORAGE_KEY, map)
}

export function suggestionChips(categoryId: string, categoryName: string, selected: string): SuggestionChip[] {
  const builtins = builtinSuggestions(categoryName)
  const customs = customSuggestions(categoryId).filter((text) => builtins.indexOf(text) < 0)
  return builtins
    .map((text) => ({ text, custom: false, on: text === selected }))
    .concat(customs.map((text) => ({ text, custom: true, on: text === selected })))
}

/** 建议标签是否出现在内容开头：单独标签、新格式「标签[描述]」、旧格式「标签 描述」 */
function matchTag(text: string, name: string) {
  if (text === name) return true
  if (text.indexOf(`${name}[`) === 0 && text.charAt(text.length - 1) === ']') return true
  return text.indexOf(`${name} `) === 0
}

/** 编辑时把已保存的内容拆回「建议标签 + 描述」 */
export function splitRemark(remark: string, categoryId: string, categoryName: string) {
  const text = remark || ''
  const names = builtinSuggestions(categoryName).concat(customSuggestions(categoryId))
  let matched = ''
  names.forEach((name) => {
    if (matchTag(text, name) && name.length > matched.length) matched = name
  })
  if (!matched) return { tag: '', desc: text }
  if (text === matched) return { tag: matched, desc: '' }
  if (text.indexOf(`${matched}[`) === 0 && text.charAt(text.length - 1) === ']') {
    return { tag: matched, desc: text.slice(matched.length + 1, -1) }
  }
  return { tag: matched, desc: text.slice(matched.length + 1) }
}

/** 有建议又有描述时存成「建议[内容]」，只填一边则只保留那一边 */
export function composeRemark(tag: string, desc: string) {
  const description = (desc || '').trim()
  if (tag && description) return `${tag}[${description}]`
  return tag || description
}
