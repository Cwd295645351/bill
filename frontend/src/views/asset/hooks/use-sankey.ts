import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import * as echarts from 'echarts'
import { storeToRefs } from 'pinia'
import { useBillStore } from '@/store'
import { getSankey } from '../api'
import { formatMoney } from '../shared'
import type { SankeyData, SankeyNode } from '../type'

export type SankeyMode = 'amount' | 'ratio' | 'hidden'

const TYPE_COLOR: Record<string, string> = {
  流动资金: '#409eff',
  固定资产: '#91cc75',
  投资理财: '#fac858',
  应收款: '#73c0de',
  负债: '#f74f4f',
  净资产: '#18a356',
  总资产: '#5b8ff9',
}

const MEMBER_COLORS = ['#409eff', '#e6a23c', '#67c23a', '#909399', '#b37feb']

/** 构成图用 ECharts 桑基图。标注在前端切换，数字仍是实际金额 */
export const useSankey = (memberId: Ref<string>, memberNames: Ref<{ id: string; name: string }[]>) => {
  const { billId } = storeToRefs(useBillStore())
  const host = ref<HTMLElement | null>(null)
  const mode = ref<SankeyMode>('amount')
  const data = ref<SankeyData>({ nodes: [], links: [] })
  let chart: echarts.ECharts | null = null

  const memberColor = (name: string) => {
    const index = memberNames.value.findIndex((item) => item.name === name)
    return MEMBER_COLORS[(index < 0 ? 0 : index) % MEMBER_COLORS.length]
  }

  const nodeValue = (node: SankeyNode, links: SankeyData['links']) => {
    if (node.id === 'total') return links.filter((link) => link.target === node.id).reduce((sum, link) => sum + link.value, 0)
    const outgoing = links.filter((link) => link.source === node.id).reduce((sum, link) => sum + link.value, 0)
    if (outgoing > 0) return outgoing
    return links.filter((link) => link.target === node.id).reduce((sum, link) => sum + link.value, 0)
  }

  const nodeColor = (node: SankeyNode, nodes: SankeyNode[]) => {
    if (node.id === 'net') return TYPE_COLOR['净资产']
    if (node.id === 'debt') return TYPE_COLOR['负债']
    if (node.id === 'total') return TYPE_COLOR['总资产']
    if (TYPE_COLOR[node.name]) return TYPE_COLOR[node.name]
    const parentId = data.value.links.find((link) => link.target === node.id)?.source
    const parent = nodes.find((item) => item.id === parentId)
    return TYPE_COLOR[parent?.name || ''] || '#409eff'
  }

  const draw = () => {
    const el = host.value
    if (!el) return
    if (!chart) chart = echarts.init(el)
    chart.resize()
    const nodes = data.value.nodes || []
    const links = (data.value.links || []).filter((link) => link.value > 0)
    const total = links.filter((link) => link.source === 'total').reduce((sum, link) => sum + link.value, 0)
      || links.filter((link) => link.target === 'total').reduce((sum, link) => sum + link.value, 0)
    const showMember = !memberId.value
    chart.setOption(
      {
        tooltip: {
          trigger: 'item',
          formatter: (params: { dataType?: string; data?: { name?: string; value?: number; source?: string; target?: string } }) => {
            if (params.dataType === 'edge') {
              const source = nodes.find((item) => item.id === params.data?.source)
              const target = nodes.find((item) => item.id === params.data?.target)
              return `${source?.name || ''} → ${target?.name || ''}<br/>${formatMoney(params.data?.value)}`
            }
            const node = nodes.find((item) => item.id === params.data?.name)
            return `${node?.name || ''}<br/>${formatMoney(node ? nodeValue(node, links) : params.data?.value)}`
          },
        },
        series: [
          {
            type: 'sankey',
            left: 24,
            right: 140,
            top: 16,
            bottom: 16,
            nodeWidth: 16,
            nodeGap: 12,
            nodeAlign: 'justify',
            draggable: false,
            emphasis: { focus: 'adjacency' },
            lineStyle: { color: 'gradient', opacity: 0.38, curveness: 0.5 },
            data: nodes.map((node) => {
              const valueText = (() => {
                const value = nodeValue(node, links)
                if (mode.value === 'hidden') return ''
                if (mode.value === 'ratio') return ` ${total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'}%`
                return ` ${formatMoney(value)}`
              })()
              const detail = node.detail ? ` · ${node.detail}` : ''
              const badge = showMember && node.memberName ? `{badge|${node.memberName}} ` : ''
              return {
                name: node.id,
                itemStyle: { color: nodeColor(node, nodes) },
                label: {
                  formatter: `${badge}${node.name}${detail}${valueText}`,
                  color: '#333',
                  fontSize: 16,
                  rich: {
                    badge: {
                      backgroundColor: memberColor(node.memberName || ''),
                      color: '#fff',
                      borderRadius: 3,
                      padding: [2, 4],
                      fontSize: 11,
                    },
                  },
                },
              }
            }),
            links: links.map((link) => ({ source: link.source, target: link.target, value: link.value })),
          },
        ],
      },
      true,
    )
  }

  const load = async () => {
    if (!billId.value) {
      data.value = { nodes: [], links: [] }
      draw()
      return
    }
    const params: { billId: string; memberId?: string } = { billId: billId.value }
    if (memberId.value) params.memberId = memberId.value
    const [err, res] = await getSankey({ params })
    if (err || !res || res.retCode !== 0) {
      if (res?.message) ElMessage.error(res.message)
      return
    }
    data.value = res.data || { nodes: [], links: [] }
    draw()
  }

  watch(mode, draw)
  const onResize = () => chart?.resize()
  window.addEventListener('resize', onResize)
  const observer = new ResizeObserver(() => chart?.resize())
  watch(host, (el) => {
    observer.disconnect()
    if (el) observer.observe(el)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('resize', onResize)
    observer.disconnect()
    chart?.dispose()
  })

  return { host, mode, load, draw }
}
