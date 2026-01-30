<script setup lang="ts">
import { ref, reactive, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as d3 from 'd3'

// 定义组件接口
interface Props {
  store: any
  files: any[]
  blocks: any[]
  kb_state: string
}

const props = defineProps<Props>()

// 图谱相关状态
const atlasNodes = ref([]) as any
const atlasLinks = ref([]) as any
const metaKeys = ref([]) as any
const metaFilter = reactive<Record<string, boolean>>({})

// D3相关引用
let atlasSvg = null as any
let atlasSimulation = null as any
let atlasZoom = null as any
let atlasResizeHandler = null as any
let atlasInitialized = ref(false)
let refreshTimer: any = null

// 定义发射事件
const emit = defineEmits<{
  updateState: [state: string]
  scheduleRefresh: [delay: number]
}>()

// 工具函数
function scheduleRefreshAtlas(delay = 180) {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    try {
      refreshAtlas()
    } catch (e) {
      console.error('刷新图谱失败:', e)
    }
    refreshTimer = null
  }, delay)
}

// 清理图谱相关资源
function cleanupAtlas() {
  try {
    if (atlasResizeHandler) {
      window.removeEventListener('resize', atlasResizeHandler)
      atlasResizeHandler = null
    }
  } catch (e) {}

  try {
    d3.select('#atlas-svg').on('.zoom', null)
  } catch (e) {}

  try {
    if (atlasSimulation && typeof atlasSimulation.stop === 'function') {
      atlasSimulation.stop()
    }
  } catch (e) {}

  try {
    if (atlasSvg) {
      atlasSvg.selectAll('*').remove()
      atlasSvg = null
    }
  } catch (e) {}

  atlasSimulation = null
  atlasZoom = null
  atlasInitialized.value = false
}

// 初始化图谱
function initAtlas() {
  nextTick(() => {
    const svgElement = document.getElementById('atlas-svg')
    
    if (!svgElement) {
      console.error('SVG元素未找到，等待后重试...')
      setTimeout(() => {
        initAtlas()
      }, 100)
      return
    }
    
    const width = svgElement.clientWidth
    const height = svgElement.clientHeight
    
    if (width === 0 || height === 0) {
      svgElement.style.width = '100%'
      svgElement.style.height = '500px'
    }
    
    svgElement.innerHTML = ''

    try {
      const existing = d3.select('#atlas-svg').select('g.atlas-main-group')
      if (!existing.empty()) {
        atlasSvg = existing
      } else {
        atlasSvg = d3.select('#atlas-svg').append('g').attr('class', 'atlas-main-group')
      }

      d3.select('#atlas-svg').on('.zoom', null)

      atlasZoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
          if (atlasSvg) {
            atlasSvg.attr('transform', event.transform)
          }
        })

      d3.select('#atlas-svg').call(atlasZoom)

      atlasResizeHandler = () => {
        setTimeout(() => {
          const container = document.getElementById('atlas-container')
          if (!container) return
          const w = container.clientWidth
          const h = container.clientHeight
          if (atlasSimulation && typeof atlasSimulation.force === 'function') {
            atlasSimulation.force('center', d3.forceCenter(w / 2, h / 2))
            try { atlasSimulation.alpha(0.3).restart() } catch (e) {}
          }
          centerAtlas()
        }, 80)
      }

      window.addEventListener('resize', atlasResizeHandler)
      try {
        const container = document.getElementById('atlas-container')
        if (container && (window as any).ResizeObserver) {
          const ro = new (window as any).ResizeObserver(() => atlasResizeHandler())
          ro.observe(container)
        }
      } catch (e) {
        console.warn('ResizeObserver not available:', e)
      }
      
    } catch (error:any) {
      d3.select('#atlas-svg')
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .text('图谱初始化失败: ' + error.message)
        .attr('fill', 'red')
    }
  })
}

// 刷新图谱数据
async function refreshAtlas() {
  emit('updateState', '正在构建知识图谱...')
  
  // 预扫描可用的 frontmatter keys
  try {
    const keysSet = new Set<string>()
    ;(props.files || []).forEach((file: any) => {
      if (!file || !file.content || typeof file.content !== 'string') return
      const fmMatch = String(file.content).match(/^\s*---\r?\n([\s\S]*?)\r?\n---\r?\n?/) 
      if (fmMatch && fmMatch[1]) {
        const lines = fmMatch[1].split(/\r?\n/).map((l: string) => l.trim()).filter((l: string) => l.length > 0)
        for (const line of lines) {
          const kv = line.match(/^([^:\n]+):\s*(.*)$/)
          if (!kv) continue
          const key = kv[1].trim()
          if (key) keysSet.add(key)
        }
      }
    })
    const arr = Array.from(keysSet)
    arr.sort()
    metaKeys.value = arr
    for (const k of metaKeys.value) {
      if (metaFilter[k] === undefined) metaFilter[k] = true
    }
  } catch (e) {
    console.warn('扫描frontmatter失败:', e)
  }
  
  // 构建节点数据
  const nodes = [] as Array<any>
  const links = [] as Array<any>
  
  // 1. 收集文档节点
  const documentMap = new Map()
  const metaValueMap = new Map() // 提前声明，用于全局跟踪元信息节点

  if (props.blocks.length > 0) {
    props.blocks.forEach((block: any, index: number) => {
      const docName = block.label
      if (!documentMap.has(docName)) {
        documentMap.set(docName, {
          id: `doc-${docName}`,
          name: docName,
          type: 'document',
          sliceCount: 0,
          avgScore: 0,
          size: 20
        })
      }
      const docNode = documentMap.get(docName)
      docNode.sliceCount++
    })
  } else if (props.files.length > 0) {
    props.files.forEach((file: any) => {
      const docName = file.label.substring(0, file.label.lastIndexOf('.'))
      if (!documentMap.has(docName)) {
        documentMap.set(docName, {
          id: `doc-${docName}`,
          name: docName,
          type: 'document',
          sliceCount: 0,
          avgScore: 0,
          size: 20
        })
      }
    })
  } else {
    emit('updateState', '没有可用的文档数据')
    atlasNodes.value = []
    atlasLinks.value = []
    renderAtlas()
    return
  }
  
  // 2. 添加知识片段节点
  const sliceNodes = [] as any
  if (props.blocks.length > 0) {
    const maxDisplay = Math.min(10000, props.blocks.length)
    for (let i = 0; i < maxDisplay; i++) {
      const block = props.blocks[i]
      const sliceNode = {
        id: `slice-${i}`,
        name: `片段 ${i+1}`,
        document: block.label,
        content: block.A ? block.A.substring(0, 100) + '...' : '无内容',
        type: 'slice',
        score: block.p || 0,
        isRetrieved: block.state || false,
        size: 12
      }
      sliceNodes.push(sliceNode)
      
      links.push({
        source: `doc-${block.label}`,
        target: `slice-${i}`,
        value: 0.5,
        type: 'belongs'
      })
    }
  }
  
  // 3. 解析元信息并创建节点
  const allMetaLinks = [] as Array<any> // 临时存储所有元信息链接

  for (const [docName, docNode] of documentMap.entries()) {
    const relatedSlices = sliceNodes.filter((s: any) => s.document === docName)
    if (relatedSlices.length > 0) {
      docNode.avgScore = relatedSlices.reduce((sum: number, s: any) => sum + s.score, 0) / relatedSlices.length
      docNode.size = 15 + Math.sqrt(relatedSlices.length) * 3
    }
    nodes.push(docNode)

    try {
      let fileContent = ''
      
      const file = (props.files || []).find((f: any) => {
        if (!f || !f.label) return false
        const name = f.label && f.label.lastIndexOf('.') > 0 ? 
          f.label.substring(0, f.label.lastIndexOf('.')) : f.label
        return name === docName
      })

      if (file && file.content && typeof file.content === 'string') {
        fileContent = file.content
      } else {
        const filePath = (props.files || []).find((f: any) => {
          if (!f || !f.label) return false
          const name = f.label && f.label.lastIndexOf('.') > 0 ? 
            f.label.substring(0, f.label.lastIndexOf('.')) : f.label
          return name === docName
        })?.path
        
        if (filePath) {
          try {
            const content = await window.ipcRenderer.invoke('readFile', filePath)
            fileContent = content || ''
          } catch (e) {
            console.warn('读取文件失败:', e)
          }
        }
      }

      if (fileContent && typeof fileContent === 'string') {
        const fmMatch = String(fileContent).match(/^\s*---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
        if (fmMatch && fmMatch[1]) {
          const fm = fmMatch[1]
          const lines = fm.split(/\r?\n/).map((l: string) => l.trim()).filter((l: string) => l.length > 0)
          const ignoreKeys = new Set(['摘要', 'abstract'])
          
          for (const line of lines) {
            const kv = line.match(/^([^:\n]+):\s*(.*)$/)
            if (!kv) continue
            
            let key = kv[1].trim()
            if (metaFilter && metaFilter[key] === false) continue
            let val = kv[2].trim()
            if (!key || !val) continue
            if (ignoreKeys.has(key)) continue

            const parts = val.split(/[;；]/).map((p: string) => p.trim()).filter((p: string) => p.length > 0)
            
            for (let pi = 0; pi < parts.length; pi++) {
              const part = parts[pi]
              
              let metaValue = part
              if (metaValue.toLowerCase().endsWith('.md')) {
                metaValue = metaValue.substring(0, metaValue.length - 3).trim()
              }
              
              // 检查是否是文档名
              const normalizedMetaValue = metaValue.toLowerCase().trim()
              const documentNames = Array.from(documentMap.keys())
              const normalizedDocNames = documentNames.map(name => name.toLowerCase().trim())
              
              const isSameAsAnyDocument = normalizedDocNames.includes(normalizedMetaValue)
              
              if (isSameAsAnyDocument) {
                const targetDocName = documentNames.find(name => 
                  name.toLowerCase().trim() === normalizedMetaValue
                )
                
                if (targetDocName && targetDocName !== docName) {
                  allMetaLinks.push({
                    source: `doc-${docName}`,
                    target: `doc-${targetDocName}`,
                    value: 0.6,
                    type: 'has_meta',
                    metaKey: key,
                    isDocumentToDocument: true
                  })
                }
                continue
              }
              
              // 关键修改：使用全局唯一的ID生成策略
              const safeValue = metaValue.replace(/[^a-zA-Z0-9\-_\u4e00-\u9fa5]/g, '_').replace(/_+/g, '_')
              const metaId = `meta-${key}-${safeValue}`
              
              if (!metaValueMap.has(metaId)) {
                // 创建新的元信息节点
                const metaNode = {
                  id: metaId,
                  name: metaValue,
                  value: metaValue,
                  type: 'meta',
                  size: 10,
                  metaKey: key, // 存储关联的key
                  count: 1 // 引用计数
                }
                // 重要：在这里就将节点添加到全局nodes数组中
                nodes.push(metaNode)
                metaValueMap.set(metaId, metaNode)
              } else {
                // 如果节点已存在，增加引用计数
                const existingNode = metaValueMap.get(metaId)
                existingNode.count++
                // 根据引用次数调整节点大小
                existingNode.size = 8 + Math.min(existingNode.count, 10) * 2
              }
              
              // 存储链接关系，稍后统一处理
              allMetaLinks.push({
                source: `doc-${docName}`,
                target: metaId,
                value: 0.8,
                type: 'has_meta',
                metaKey: key
              })
            }
          }
        }
      }
    } catch (e) {
      console.warn('解析 frontmatter 时出错', e)
    }
  }
  
  // 4. 添加片段节点
  if (sliceNodes.length > 0) {
    nodes.push(...sliceNodes)
  }
  
  // 5. 添加元信息链接
  links.push(...allMetaLinks)

  // 6. 后处理：更新元信息节点的大小和标签
  // 让被引用次数多的节点更大
  metaValueMap.forEach((node: any) => {
    // 节点大小已在创建/更新时设置
    // 可以在这里添加更复杂的逻辑，比如根据引用次数显示数字
    if (node.count > 1) {
      node.name = `${node.value} (${node.count})`
    }
  });
  atlasNodes.value = nodes
  atlasLinks.value = links
  
  renderAtlas()
  
  const sliceInfo = props.blocks.length > 0 ? `, ${sliceNodes.length}个片段` : ''
  emit('updateState', `图谱构建完成: ${documentMap.size}个文档${sliceInfo}, ${links.length}条边`)
}

// 渲染图谱
function renderAtlas() {
  nextTick(() => {
    const container = document.getElementById('atlas-svg')
    if (!container) return
    
    const width = container.clientWidth
    const height = container.clientHeight
    
    atlasSvg?.selectAll('*').remove()
    
    if (atlasNodes.value.length === 0) {
      atlasSvg.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .text('没有可用的数据')
        .attr('fill', 'var(--fontColor)')
      return
    }
    
    try { if (atlasSimulation && typeof atlasSimulation.stop === 'function') atlasSimulation.stop() } catch (e) {}
    atlasNodes.value.forEach((n: any) => {
      if (n.x === undefined || n.y === undefined || isNaN(n.x) || isNaN(n.y)) {
        n.x = width / 2 + (Math.random() - 0.5) * 80
        n.y = height / 2 + (Math.random() - 0.5) * 80
      }
    })

    const linkForce = d3.forceLink(atlasLinks.value)
      .id((d: any) => d.id)
      .distance((d: any) => {
        if (d.type === 'belongs') return 100
        return 200 / (d.value || 1)
      })
      .strength((d: any) => d.value || 0.1)

    atlasSimulation = d3.forceSimulation()
      .nodes(atlasNodes.value)
      .force('link', linkForce)
      .force('charge', d3.forceManyBody().strength((d: any) => d.type === 'document' ? -800 : -300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d: any) => d.size + 5))
    
    // 创建边
    const link = atlasSvg.append('g')
      .selectAll('line')
      .data(atlasLinks.value)
      .enter()
      .append('line')
      .attr('stroke', (d: any) => {
        if (d.type === 'belongs') return '#999'
        if (d.isDocumentToDocument) return '#FF9800'
        return d3.interpolateRdYlGn(d.value)
      })
      .attr('stroke-width', (d: any) => {
        if (d.isDocumentToDocument) return 1.5
        return Math.max(1, d.value * 3)
      })
      .attr('stroke-dasharray', (d: any) => {
        if (d.isDocumentToDocument) return '5,5'
        return null
      })
      .attr('stroke-opacity', 0.6)
      .on('mouseover', (event: MouseEvent, d: any) => {
        const element = event.currentTarget as SVGElement
        
        d3.select(element)
          .attr('stroke-width', (d: any) => {
            if (d.isDocumentToDocument) return 3
            return Math.max(2, (d.value || 1) * 4)
          })
          .attr('stroke-opacity', 0.9)
      })
      .on('mouseout', (event: MouseEvent, d: any) => {
        const element = event.currentTarget as SVGElement
        
        d3.select(element)
          .attr('stroke-width', (d: any) => {
            if (d.isDocumentToDocument) return 1.5
            return Math.max(1, d.value * 3)
          })
          .attr('stroke-opacity', 0.6)
      })

    // 为每条边添加title工具提示
    link.append('title')
      .text((d: any) => {
        const sourceNode = atlasNodes.value.find((n: any) => n.id === d.source?.id || n.id === d.source)
        const targetNode = atlasNodes.value.find((n: any) => n.id === d.target?.id || n.id === d.target)
        
        const sourceName = sourceNode?.name || '未知源'
        const targetName = targetNode?.name || '未知目标'
        
        let tooltipText = ''
        
        if (d.type === 'belongs') {
          tooltipText = `所属关系\n${sourceName} → ${targetName}\n片段属于文档`
        } 
        else if (d.type === 'has_meta') {
          const metaKey = d.metaKey || '未知标签'
          const isDocToDoc = d.isDocumentToDocument
          
          tooltipText = `元信息关系\n${sourceName} → ${targetName}\n${isDocToDoc ? '文档关联' : '文档标签'}: ${metaKey}\n关联强度: ${(d.value * 100).toFixed(0)}%`
          
          if (isDocToDoc) {
            tooltipText += `\n 这是文档间的标签关联（标签值与文档名相同）`
          }
        }
        else {
          tooltipText = `未知关系\n${sourceName} → ${targetName}\n类型: ${d.type || '未定义'}`
        }
        
        return tooltipText
      })
    
    // 创建节点
    const node = atlasSvg.append('g')
      .selectAll('circle')
      .data(atlasNodes.value)
      .enter()
      .append('circle')
      .attr('r', (d: any) => d.size)
      .attr('fill', (d: any) => {
        if (d.type === 'slice' && d.isRetrieved) {
          return '#FF5722'
        }
        if (d.type === 'meta') return '#9C27B0'
        if (d.score > 0.7) return '#FF9800'
        return '#2196F3'
      })
      .attr('stroke', (d: any) => {
        if (d.type === 'slice' && d.isRetrieved) {
          return '#FF5722'
        }
        return '#fff'
      })
      .attr('stroke-width', (d: any) => {
        if (d.type === 'slice' && d.isRetrieved) {
          return 3
        }
        return 2
      })
      .attr('class', (d: any) => {
        const classes = ['atlas-node']
        if (d.type === 'slice' && d.isRetrieved) {
          classes.push('retrieved-slice')
        }
        return classes.join(' ')
      })
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended)
      ).on('mouseover', (event: any, d: any) => {
        d3.select(event.currentTarget)
          .attr('stroke-width', 3)
          .attr('stroke', '#FF5722')
      })
      .on('mouseout', (event: any, d: any) => {
        const circle = d3.select(event.currentTarget)
        if (d.type === 'slice' && d.isRetrieved) {
          circle.attr('stroke-width', 3)
          circle.attr('stroke', '#FF5722')
        } else {
          circle.attr('stroke-width', 2)
          circle.attr('stroke', '#fff')
        }
      })

    // 添加节点tooltip
    node.append('title')
      .text((d: any) => {
        let text = `${d.name}\n类型: ${d.type === 'document' ? '文档' : d.type === 'meta' ? '元信息' : '片段'}`
        if (d.type === 'slice') {
          text += `\n相似度: ${(d.score * 100).toFixed(1)}%`
          text += `\n检索状态: ${d.isRetrieved ? '已匹配' : '未匹配'}`
          text += `\n内容: ${d.content}`
        } else if (d.type === 'meta') {
          const relatedLinks = atlasLinks.value.filter((l: any) => 
            l.target === d.id || (l.target?.id === d.id)
          )
          if (relatedLinks.length > 0) {
            const keys = [...new Set(relatedLinks.map((l: any) => l.metaKey))]
            text += `\n关联key: ${keys.join(', ')}`
            text += `\n关联文档数: ${relatedLinks.length}`
          }
        } else if (d.type === 'document') {
          const outgoingLinks = atlasLinks.value.filter((l: any) => 
            (l.source === d.id || l.source?.id === d.id) && l.type === 'has_meta'
          )
          if (outgoingLinks.length > 0) {
            const metaKeys = [...new Set(outgoingLinks.map((l: any) => l.metaKey))]
            text += `\n元信息标签: ${metaKeys.join(', ')}`
            text += `\n关联项: ${outgoingLinks.length}个`
          }
        }
        return text
      })
    
    // 添加节点标签
    const label = atlasSvg.append('g')
      .selectAll('text')
      .data(atlasNodes.value)
      .enter()
      .append('text')
      .text((d: any) => {
        if (d.type === 'document') return d.name
        if (d.type === 'meta') return d.name
        return ''
      })
      .attr('font-size', '12px')
      .attr('fill', 'var(--fontColor)')
      .attr('text-anchor', 'middle')
      .attr('dy', (d: any) => -d.size - 5)
    
    // 更新位置函数
    function ticked() {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)
      
      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y)
      
      label
        .attr('x', (d: any) => d.x)
        .attr('y', (d: any) => d.y)
    }
    
    // 拖拽函数
    function dragstarted(event: any, d: any) {
      if (!event.active) atlasSimulation.alphaTarget(0.3).restart()
      d.fx = d.x
      d.fy = d.y
    }
    
    function dragged(event: any, d: any) {
      d.fx = event.x
      d.fy = event.y
    }
    
    function dragended(event: any, d: any) {
      if (!event.active) atlasSimulation.alphaTarget(0)
      d.fx = null
      d.fy = null
    }
    
    try { if (atlasSimulation && atlasSimulation.force) atlasSimulation.force('link').links(atlasLinks.value) } catch (e) {}
    atlasSimulation.alpha(1).restart()
    atlasSimulation.on('tick', ticked)
    
    setTimeout(() => {
      centerAtlas()
    }, 100)
  })
}

// 图谱控制函数
function centerAtlas() {
  if (!atlasSvg) return
  const container = document.getElementById('atlas-container')
  if (!container) return
  
  const transform = d3.zoomIdentity
  d3.select('#atlas-svg').transition().duration(500).call(atlasZoom.transform, transform)
}

function zoomInAtlas() {
  if (!atlasSvg) return
  d3.select('#atlas-svg').transition().duration(300).call(atlasZoom.scaleBy, 1.2)
}

function zoomOutAtlas() {
  if (!atlasSvg) return
  d3.select('#atlas-svg').transition().duration(300).call(atlasZoom.scaleBy, 0.8)
}

// 暴露方法给父组件
defineExpose({
  refreshAtlas,
  centerAtlas,
  zoomInAtlas,
  zoomOutAtlas,
  cleanupAtlas,
  scheduleRefreshAtlas
})

// 监听元信息过滤器变化
watch(metaFilter, () => {
  scheduleRefreshAtlas(100)
}, { deep: true })

// 组件挂载时初始化
onMounted(() => {
  setTimeout(() => {
    const container = document.getElementById('atlas-container')
    if (!container) return
    
    if (container.clientWidth === 0 || container.clientHeight === 0) {
      console.warn('图谱容器尺寸为0')
      container.style.height = '500px'
    }
    
    if (!atlasInitialized.value) {
      initAtlas()
      atlasInitialized.value = true
      setTimeout(() => {
        refreshAtlas()
      }, 100)
    }
  }, 100)
})

// 组件卸载时清理
onBeforeUnmount(() => {
  try { if (atlasResizeHandler) window.removeEventListener('resize', atlasResizeHandler) } catch (e) {}
  try { if (atlasSimulation && typeof atlasSimulation.stop === 'function') atlasSimulation.stop() } catch (e) {}
  cleanupAtlas()
})
</script>

<template>
  <div style="display:flex;height:100%;box-sizing:border-box;align-items:stretch;flex-direction:column;">
    <div style="display:flex;flex-wrap:wrap;align-items:center;padding-right: 5px;">
      <div class="button" @click="refreshAtlas" title="刷新图谱">
        <i class="fa fa-refresh"></i>
      </div>
      <div class="button" @click="centerAtlas" title="居中视图">
        <i class="fa fa-crosshairs"></i>
      </div>
      <div class="button" @click="zoomInAtlas" title="放大">
        <i class="fa fa-search-plus"></i>
      </div>
      <div class="button" @click="zoomOutAtlas" title="缩小">
        <i class="fa fa-search-minus"></i>
      </div>
      <span style="font-size:12px;margin-left:auto;">
        节点: {{ atlasNodes.length }} | 边: {{ atlasLinks.length }}
      </span>
    </div>
    <div id="atlas-container" style="flex:1;border:1px solid var(--borderColor);border-radius:5px;margin: 0px 5px 10px 5px;overflow:hidden;position:relative;">
      <svg id="atlas-svg" width="100%" height="100%"></svg>
      <div class="scoll" style="position:absolute;top:10px;right:10px;background:var(--backgroundColor);padding:10px;border-radius:5px;border:1px solid var(--borderColor);font-size:12px;max-height:60%;overflow:auto;min-width:80px;">
        <div v-if="metaKeys.length===0" style="color:var(--borderColor);font-size:12px;">无元信息</div>
        <div v-for="key in metaKeys" :key="key" style="display:flex;align-items:center;justify-content:space-between;gap:5px;">
          <div style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{key}}</div>
          <input type="checkbox" v-model="metaFilter[key]" />
        </div>
        <div style="display: flex;gap: 5px;">
          <div class="button" style="margin:0px;padding:3px;height:fit-content;width:50%" @click="Object.keys(metaFilter).forEach(k=>metaFilter[k]=true)">全部</div>
          <div class="button" style="margin:0px;padding:3px;height:fit-content;width:50%" @click="Object.keys(metaFilter).forEach(k=>metaFilter[k]=false)">清除</div>
        </div>
      </div>
      <div style="position:absolute;bottom:10px;right:10px;background:var(--backgroundColor);padding:10px;border-radius:5px;border:1px solid var(--borderColor);font-size:12px;">
        <div><span style="color:#4CAF50">●</span> 文档节点</div>
        <div><span style="color:#2196F3">●</span> 普通片段</div>
        <div><span style="color:#FF5722">●</span> 检索到的片段</div>
        <div><span style="color:#9C27B0">●</span> 元信息节点</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.button {
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 4px;
  background-color: var(--menuColor);
  border: 1px solid var(--borderColor);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
}

.button:hover {
  background-color: var(--borderColor);
}

#atlas-container {
  position: relative;
}

#atlas-container .atlas-main-group {
  transition: transform 0.3s ease;
}

#atlas-container circle:hover {
  stroke-width: 3px;
  stroke: #FF5722;
  cursor: pointer;
}

#atlas-container line {
  transition: stroke-width 0.2s ease;
}

#atlas-container line:hover {
  stroke-width: 3px;
  cursor: pointer;
}

#atlas-container text {
  pointer-events: none;
  user-select: none;
}

#atlas-container circle.retrieved-slice {
  animation: pulse 2s infinite;
  filter: drop-shadow(0 0 3px rgba(255, 87, 34, 0.7));
}

@keyframes pulse {
  0% {
    r: 12;
  }
  50% {
    r: 14;
  }
  100% {
    r: 12;
  }
}

#atlas-container line.retrieved-link {
  stroke: #FF5722 !important;
  stroke-width: 2px !important;
  stroke-opacity: 0.8 !important;
  animation: link-pulse 2s infinite;
}

@keyframes link-pulse {
  0% {
    stroke-width: 2px;
  }
  50% {
    stroke-width: 3px;
  }
  100% {
    stroke-width: 2px;
  }
}
</style>