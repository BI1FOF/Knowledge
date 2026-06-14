<template>
  <div class="ontology-viewer">
  
    <!-- 左侧控制面板 -->
    <div class="control-panel">
      
      <!-- 节点类型开关（仅实体） -->
      <div class="control-section">
        <div class="switch-list">
          <div class="switch-item" :class="{ active: visibleNodeTypes.includes('entity') }" @click="toggleNodeType('entity')">
            <span class="switch-dot entity"></span>
            <span class="switch-label">{{store.locales == 'zh' ? '实体节点' : 'Entity'}}</span>
            <span class="switch-count">{{ getNodeTypeCount('entity') }}</span>
          </div>
          <div class="switch-item" :class="{ active: showSliceNodes }" @click="showSliceNodes = !showSliceNodes">
            <span class="switch-dot slice"></span>
            <span class="switch-label">{{store.locales == 'zh' ? '切片节点' : 'Slice'}}</span>
            <span class="switch-count">{{ totalSliceNodes }}</span>
          </div>
          <div class="switch-item" :class="{ active: showFileNodes }" @click="showFileNodes = !showFileNodes">
            <span class="switch-dot file"></span>
            <span class="switch-label">{{store.locales == 'zh' ? '文件节点' : 'File'}}</span>
            <span class="switch-count">{{ totalFileNodes }}</span>
          </div>
          <div class="switch-item" :class="{ active: showSliceAssociation }" @click="showSliceAssociation = !showSliceAssociation">
            <span class="switch-dot slice-assoc"></span>
            <span class="switch-label">{{store.locales == 'zh' ? '切片关联' : 'Associations'}}</span>
            <span class="switch-count">{{ totalEntitySliceEdges }}</span>
          </div>
          <div class="switch-item" v-if="metaKeys.length > 0" :class="{ active: showMetaNodes }" @click="showMetaNodes = !showMetaNodes">
            <span class="switch-dot meta"></span>
            <span class="switch-label">{{store.locales == 'zh' ? '元信息节点' : 'Meta'}}</span>
            <span class="switch-count">{{ totalMetaNodes }}</span>
          </div>
        </div>
        <!-- 元信息筛选 -->
        <div class="meta-filter-list" v-if="showMetaNodes">
          <div class="button small" @click="setAllMetaFilter(true)">{{store.locales == 'zh' ? '全部' : 'All'}}</div>
          <div class="button small" @click="setAllMetaFilter(false)">{{store.locales == 'zh' ? '清除' : 'Clear'}}</div>
          <div v-for="key in metaKeys" :key="key" class="meta-filter-item">
            <span class="meta-filter-label">{{ key }}</span>
            <span class="meta-filter-count">{{ getMetaKeyCount(key) }}</span>
            <input type="checkbox" v-model="metaFilter[key]" @change="renderGraph" />
          </div>
        </div>
      </div>
      <!-- 搜索栏 -->
      <div class="search-section">
        <div class="search-box">
          <i class="fa fa-search"></i>
          <input 
            class="search-input" 
            :placeholder="store.locales == 'zh' ? '搜索节点...' : 'Search Nodes...'" 
            v-model="searchKeyword"
            @focus="showSearchResults = true"
            @blur="handleSearchBlur"
          />
          <div v-if="searchKeyword" class="search-clear" @click="clearSearch">
            <i class="fa fa-times"></i>
          </div>
        </div>
        <!-- 搜索结果下拉列表 -->
        <div class="search-results-dropdown" v-if="filteredSearchNodes.length > 0">
          <div class="search-results-header">
            {{store.locales == 'zh' ? '搜索结果' : 'Search Results'}} ({{ filteredSearchNodes.length }})
          </div>
          <div class="search-results-list">
            <div 
              v-for="(node, idx) in filteredSearchNodes" 
              :key="node.id"
              class="search-result-item"
              :class="{ active: currentFocusIndex === idx }"
              @click="jumpToNode(node.id)"
              @mouseenter="currentFocusIndex = idx"
            >
              <span class="result-dot" :style="{ backgroundColor: getNodeColor(node) }"></span>
              <span class="result-name">{{ node.name }}</span>
              <span class="result-type">{{ getNodeDisplayType(node) }}</span>
            </div>
          </div>
        </div>
        
      </div>
      
    </div>

    <!-- 图谱容器 -->
    <div class="graph-container" ref="graphContainerRef">
      <svg ref="svgRef" class="graph-svg" @click="onGraphClick"></svg>
      
      <!-- 节点详情浮窗 -->
      <div class="node-tooltip" v-show="tooltipVisible" :style="tooltipStyle">
        <div class="tooltip-title">
          <span class="tooltip-badge edge-badge" v-if="tooltipNode?.type === 'edge'">边</span>
          <span class="tooltip-badge entity-badge" v-else-if="tooltipNode?.type === 'entity'">实体</span>
          <span class="tooltip-badge slice-badge" v-if="tooltipNode?.type === 'slice'">切片</span>
          <span class="tooltip-badge file-badge" v-if="tooltipNode?.type === 'file'">文件</span>
          <span class="tooltip-badge meta-badge" v-if="tooltipNode?.type === 'meta'">元信息</span>
          {{ tooltipNode?.name }}
        </div>
        <div class="tooltip-type" v-if="tooltipNode?.type !== 'edge'">{{ getNodeDisplayType(tooltipNode) }} · {{ tooltipNode?.layer }}</div>
        <div class="tooltip-type" v-else>边关系</div>
        <div class="tooltip-desc">{{ tooltipNode?.description || (tooltipNode?.type === 'slice' ? (tooltipNode?.preview || '无内容') : '无描述') }}</div>
        <div class="tooltip-associated" v-if="showSliceAssociation && tooltipNode?.type !== 'slice' && tooltipNode?.associatedBlocks && tooltipNode.associatedBlocks.length > 0">
          <div class="tooltip-associated-title">关联切片 ({{ tooltipNode.associatedBlocks.length }})</div>
          <div class="tooltip-associated-list">
            <div v-for="blockId in tooltipNode.associatedBlocks.slice(0, 3)" :key="blockId" class="associated-item">
              <span class="associated-label">{{ getBlockLabel(blockId) }}</span>
            </div>
          </div>
        </div>
      </div>
    
      <!-- 空状态 -->
      <div class="graph-empty" v-if="allNodes.length === 0">
        <i class="fa fa-sitemap empty-icon"></i>
        <div>暂无数据</div>
        <div v-if="!showFileNodes" class="empty-hint">文件节点显示已关闭，请在左侧面板中开启</div>
        <div v-if="props.files && props.files.length === 0" class="empty-hint">请先打开文件夹加载文件</div>
        <div v-if="props.files && props.files.length > 0 && showFileNodes" class="empty-hint">正在加载文件节点...</div>
      </div>
    </div>

    <!-- 右侧属性面板 -->
    <div class="association-panel" v-if="selectedNode && showAssociationPanel" @click.stop>
      <div class="panel-header">
        <div class="panel-title">
          <span class="entity-dot" :class="selectedNode.type"></span>
          <span :title="selectedNode.name">{{ selectedNode.name }}</span>
        </div>
        <div class="panel-actions">
          <button @click="jumpToNode(selectedNode.id)" style="border: 0px;" title="在图谱中定位节点">
            <i class="fa fa-crosshairs"></i>
          </button>
          <button class="panel-close" @click="showAssociationPanel = false">
            <i class="fa fa-times"></i>
          </button>
        </div>
      </div>
      
      <div class="panel-tabs">
        <button class="tab-btn" :class="{ active: activeTab === 'info' }" @click="activeTab = 'info'">
          <i class="fa fa-info-circle"></i> 详情
        </button>
        <button v-if="selectedNode.type !== 'slice' && selectedNode.type !== 'file' && selectedNode.type !== 'meta'" class="tab-btn" :class="{ active: activeTab === 'blocks' }" @click="activeTab = 'blocks'">
          <i class="fa fa-file-text-o"></i> 切片 ({{ associatedBlocks.length }})
        </button>
        <button class="tab-btn" :class="{ active: activeTab === 'relations' }" @click="activeTab = 'relations'">
          <i class="fa fa-share-alt"></i> 节点 ({{ relatedNodes.length }})
        </button>
      </div>
      
      <div class="panel-content">
        <!-- 关联切片列表 -->
        <div v-if="activeTab === 'blocks' && selectedNode.type !== 'slice'" class="blocks-list">
          <div v-for="block in associatedBlocks" :key="block.id" class="block-card">
            <div class="block-header">
              <button class="jump-btn" @click.stop="jumpToNode(`slice-${block.id}`)" title="跳转到切片节点">
                <i class="fa fa-crosshairs"></i>
              </button>
              <span class="block-label" @click="jumpToNode(`slice-${block.id}`)">
                <i :class="getFileIcon(block.extension)"></i>
                {{ block.label }}
              </span>
            </div>
            <div class="block-preview">{{ block.preview }}</div>
            <div class="block-footer">
              <span class="block-file">{{ block.fileName }}</span>
            </div>
          </div>
          <div v-if="associatedBlocks.length === 0" class="empty-tip">暂无关联切片</div>
        </div>
        
        <!-- 关联节点列表 -->
        <div v-if="activeTab === 'relations'" class="relations-list">
          <div v-for="rel in relatedNodes" :key="rel.targetId" class="relation-card">
            <div class="relation-line">
              <button class="jump-btn" @click.stop="jumpToNode(rel.targetId)" title="跳转到目标节点">
                <i class="fa fa-crosshairs"></i>
              </button>
              <div class="relation-source">
                <span class="entity-dot" :class="selectedNode?.type"></span>
                {{ selectedNode?.name }}
              </div>
              <i class="fa fa-arrow-right relation-arrow"></i>
              <div class="relation-target">
                <span class="entity-dot" :class="rel.targetType"></span>
                {{ rel.targetName }}
              </div>
            </div>
            <div class="relation-type">{{ getRelationDisplayName(rel.edgeType) }}</div>
            <div class="relation-desc" v-if="rel.description">{{ rel.description }}</div>
          </div>
          <div v-if="relatedNodes.length === 0" class="empty-tip">暂无关联节点</div>
        </div>
          
        <!-- 详情信息 -->
        <div v-if="activeTab === 'info'" class="info-content">
          <div class="info-row"><span class="info-label">ID</span><span class="info-value" style="font-family: monospace; font-size: 9px;">{{ selectedNode?.id }}</span></div>
          <div class="info-row"><span class="info-label">类型</span><span class="info-value">{{ getNodeDisplayType(selectedNode) }}</span></div>
          <div class="info-row"><span class="info-label">名称</span><span class="info-value">{{ selectedNode?.name }}</span></div>
          <div class="info-row" v-if="selectedNode?.layer && selectedNode?.type !== 'slice' && selectedNode?.type !== 'file' && selectedNode?.type !== 'meta'">
            <span class="info-label">层级</span><span class="info-value">{{ selectedNode?.layer }}</span>
          </div>
          <div class="info-row"><span class="info-label">描述</span><span class="info-value">{{ selectedNode?.description || (selectedNode?.type === 'slice' ? (selectedNode?.preview || '无') : '无') }}</span></div>
          <div class="info-row" v-if="selectedNode?.type === 'slice' && selectedNode?.originalBlock">
            <span class="info-label">所属文件</span><span class="info-value">{{ selectedNode.originalBlock.fileName }}</span>
          </div>
          <div class="info-row" v-if="selectedNode?.associatedBlocks && selectedNode.associatedBlocks.length">
            <span class="info-label">关联切片数</span><span class="info-value">{{ selectedNode.associatedBlocks.length }} 个</span>
          </div>
          <div class="info-row" v-if="selectedNode?.associatedFiles && selectedNode.associatedFiles.length">
            <span class="info-label">关联文件</span><span class="info-value">{{ selectedNode.associatedFiles.length }} 个</span>
          </div>
          
          <!-- 切片内容 -->
          <div v-if="selectedNode.type === 'slice'" class="slice-content">
            <div class="slice-full-content">
              <pre class="content-pre">{{ selectedNode.originalBlock?.A || selectedNode.description || '无内容' }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as d3 from 'd3'
import {usestore} from '../../store'
const store=usestore()
// ==================== 类型定义 ====================
interface OntologyNode {
  id: string
  name: string
  type: string       // 'entity' | 'slice' | 'file' | 'meta'
  layer: string
  description?: string
  preview?: string
  fullContent?: string
  originalBlock?: any
  associatedBlocks?: string[]
  associatedFiles?: string[]
  metaKey?: string
  value?: string
  count?: number
  size?: number
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

interface OntologyEdge {
  id: string
  source: string | OntologyNode
  target: string | OntologyNode
  type: string
  layer: string
  description?: string
  metaKey?: string
}

interface BlockInfo {
  id: string
  label: string
  content: string
  preview: string
  fullContent: string
  fileName: string
  extension: string
}

interface Props {
  ontologyData: {
    nodes: OntologyNode[]
    edges: OntologyEdge[]
  }
  blocks?: BlockInfo[]
  files?: any[]
}

const props = withDefaults(defineProps<Props>(), {
  blocks: () => [],
  files: () => []
})

// ==================== Emits ====================
const emit = defineEmits<{
  (e: 'node-click', node: OntologyNode): void
  (e: 'block-click', block: BlockInfo): void
  (e: 'view-block', block: BlockInfo): void
}>()

// ==================== 响应式状态 ====================
const graphContainerRef = ref<HTMLElement | null>(null)
const svgRef = ref<SVGSVGElement | null>(null)

// 节点类型过滤（仅实体）
const visibleNodeTypes = ref(['entity'])
const showSliceNodes = ref(false)
const showFileNodes = ref(false)
const showMetaNodes = ref(false)
const showSliceAssociation = ref(false)
const tooltipVisible = ref(false)
const tooltipNode = ref<OntologyNode | null>(null)
const tooltipStyle = ref({})
const selectedNode = ref<OntologyNode | null>(null)
const showAssociationPanel = ref(false)
const activeTab = ref<'blocks' | 'relations' | 'info'>('blocks')

const metaKeys = ref<string[]>([])
const metaFilter = ref<Record<string, boolean>>({})

const searchKeyword = ref('')
const searchResults = ref<Set<string>>(new Set())
const isSearching = ref(false)
const currentFocusIndex = ref(-1)
const focusedNodesList = ref<any[]>([])
const selectedNodeId = ref<string | null>(null)

const showSearchResults = ref(false)
const searchBlurTimer = ref<any>(null)

// 切片节点总数
const totalSliceNodes = computed(() => {
  return (props.blocks || []).length
})

// 文件节点总数
const totalFileNodes = computed(() => {
  if (!props.files || props.files.length === 0) return 0
  const fileNames = new Set<string>()
  for (const file of props.files) {
    const fileName = file.label?.substring(0, file.label.lastIndexOf('.')) || file.label || 'unknown'
    fileNames.add(fileName)
  }
  return fileNames.size
})

// 元信息节点总数
const totalMetaNodes = computed(() => {
  const fileNamesSet = new Set<string>()
  for (const file of props.files || []) {
    const docName = file.label?.substring(0, file.label.lastIndexOf('.')) || 'unknown'
    fileNamesSet.add(docName)
  }
  
  const valueMap = new Map<string, { value: string, count: number }>()
  for (const file of props.files) {
    if (!file || !file.content || typeof file.content !== 'string') continue
    const fmMatch = String(file.content).match(/^\s*---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
    if (fmMatch && fmMatch[1]) {
      const lines = fmMatch[1].split(/\r?\n/).map((l: string) => l.trim()).filter((l: string) => l.length > 0)
      for (const line of lines) {
        const kv = line.match(/^([^:\n]+):\s*(.*)$/)
        if (!kv) continue
        const val = kv[2].trim()
        if (!val) continue
        const parts = val.split(/[;；]/).map((p: string) => p.trim()).filter((p: string) => p.length > 0)
        for (const part of parts) {
          let metaValue = part
          if (metaValue.toLowerCase().endsWith('.md')) {
            metaValue = metaValue.substring(0, metaValue.length - 3).trim()
          }
          if (fileNamesSet.has(metaValue)) continue
          if (!valueMap.has(metaValue)) {
            valueMap.set(metaValue, { value: metaValue, count: 0 })
          }
          valueMap.get(metaValue)!.count++
        }
      }
    }
  }
  return valueMap.size
})

// 实体-切片关联边总数
const totalEntitySliceEdges = computed(() => {
  let count = 0
  for (const entity of nodes.value) {
    if (entity.associatedBlocks && entity.associatedBlocks.length > 0) {
      count += entity.associatedBlocks.length
    }
  }
  return count
})

// 按节点类型统计
const getNodeTypeCount = (nodeType: string) => {
  return nodes.value.filter(node => node.type === nodeType).length
}

const getMetaKeyCount = (key: string) => {
  let count = 0
  for (const file of props.files) {
    if (!file || !file.content) continue
    const fmMatch = String(file.content).match(/^\s*---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
    if (fmMatch && fmMatch[1]) {
      const lines = fmMatch[1].split(/\r?\n/).map((l: string) => l.trim()).filter((l: string) => l.length > 0)
      for (const line of lines) {
        const kv = line.match(/^([^:\n]+):\s*(.*)$/)
        if (!kv) continue
        const k = kv[1].trim()
        if (k === key) count++
      }
    }
  }
  return count
}

// 获取节点显示类型名称
const getNodeDisplayType = (node: any) => {
  if (!node) return ''
  if (node.type === 'entity') return '实体'
  if (node.type === 'slice') return '切片'
  if (node.type === 'file') return '文件'
  if (node.type === 'meta') return '元信息'
  return node.type || ''
}

// 获取关系显示名称
const getRelationDisplayName = (type: string) => {
  const names: Record<string, string> = {
    'has_attribute': '拥有属性',
    'is_a': '继承',
    'part_of': '组成部分',
    'depends_on': '依赖',
    'related_to': '关联',
    'contains': '包含',
    'associated_with': '关联切片',
    'belongs_to': '属于文件',
    'has_meta': '元信息',
    'references': '引用'
  }
  return names[type] || type
}

const getBlockLabel = (blockId: string) => {
  const block = props.blocks?.find((b: any) => b.id === blockId)
  return block?.label || blockId
}

// 过滤搜索结果
const filteredSearchNodes = computed(() => {
  if (!searchKeyword.value) return []
  const keyword = searchKeyword.value.trim().toLowerCase()
  if (!keyword) return []
  
  return visibleNodes.value.filter(node => {
    if (node.name && node.name.toLowerCase().includes(keyword)) return true
    if (node.type === 'slice' && node.description && node.description.toLowerCase().includes(keyword)) return true
    if (node.type === 'meta' && node.value && node.value.toLowerCase().includes(keyword)) return true
    if (node.description && node.description.toLowerCase().includes(keyword)) return true
    return false
  }).slice(0, 20)
})

const handleSearchBlur = () => {
  searchBlurTimer.value = setTimeout(() => {
    showSearchResults.value = false
  }, 200)
}

watch(searchKeyword, () => {
  if (searchKeyword.value) {
    showSearchResults.value = true
  }
})

let lastHighlightedNodeId: string | null = null
let searchDebounceTimer: any = null

// D3 相关
let svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null
let g: d3.Selection<SVGGElement, unknown, null, undefined> | null = null
let zoom: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null
let simulation: d3.Simulation<d3.SimulationNodeDatum, undefined> | null = null
let width = 800
let height = 600

const nodes = ref<OntologyNode[]>([])
const edges = ref<OntologyEdge[]>([])

let currentEdges: d3.Selection<SVGLineElement, any, SVGGElement, unknown> | null = null
let currentNodes: d3.Selection<SVGCircleElement, any, SVGGElement, unknown> | null = null
let currentLabels: d3.Selection<SVGTextElement, any, SVGGElement, unknown> | null = null

let isDragging = false
let nodePositions = new Map<string, { x: number, y: number }>()

// ==================== 元信息扫描 ====================
function scanMetadata() {
  const keysSet = new Set<string>()
  for (const file of props.files) {
    if (!file || !file.content || typeof file.content !== 'string') continue
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
  }
  const arr = Array.from(keysSet)
  arr.sort()
  metaKeys.value = arr
  for (const k of metaKeys.value) {
    if (metaFilter.value[k] === undefined) metaFilter.value[k] = true
  }
}

function setAllMetaFilter(value: boolean) {
  Object.keys(metaFilter.value).forEach(k => {
    metaFilter.value[k] = value
  })
  renderGraph()
}

// ==================== 计算属性 ====================

const sliceNodes = computed(() => {
  if (!showSliceNodes.value) return []
  return (props.blocks || []).map(block => ({
    id: `slice-${block.id}`,
    name: block.label,
    type: 'slice',
    layer: 'slice',
    description: block.content,
    preview: block.preview,
    fullContent: block.content,
    originalBlock: block,
    originalId: block.id,
    x: Math.random() * width,
    y: Math.random() * height
  }))
})

const fileNodesDirect = computed(() => {
  if (!showFileNodes.value) return []
  if (!props.files || props.files.length === 0) return []
  
  const fileMap = new Map<string, { id: string, name: string, path: string, blockIds: Set<string> }>()
  
  for (const file of props.files) {
    const fileName = file.label?.substring(0, file.label.lastIndexOf('.')) || file.label || 'unknown'
    const fileId = `file-${fileName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}`
    if (!fileMap.has(fileId)) {
      fileMap.set(fileId, { id: fileId, name: fileName, path: file.path, blockIds: new Set() })
    }
  }
  
  if (props.blocks && props.blocks.length > 0) {
    for (const block of props.blocks) {
      const fileName = block.fileName
      const fileId = `file-${fileName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}`
      if (fileMap.has(fileId)) {
        fileMap.get(fileId)!.blockIds.add(block.id)
      }
    }
  }
  
  return Array.from(fileMap.values()).map(file => ({
    id: file.id,
    name: file.name,
    type: 'file',
    layer: 'file',
    description: file.blockIds.size > 0 ? `包含 ${file.blockIds.size} 个切片` : '文件节点',
    associatedBlocks: Array.from(file.blockIds),
    filePath: file.path,
    x: Math.random() * width,
    y: Math.random() * height
  }))
})

const metaNodes = computed(() => {
  if (!showMetaNodes.value) return []
  
  const fileNamesSet = new Set<string>()
  for (const file of props.files || []) {
    const docName = file.label?.substring(0, file.label.lastIndexOf('.')) || 'unknown'
    fileNamesSet.add(docName)
  }
  
  const valueMap = new Map<string, { value: string, count: number, documents: Set<string>, keys: Set<string> }>()
  
  for (const file of props.files) {
    if (!file || !file.content || typeof file.content !== 'string') continue
    const docName = file.label?.substring(0, file.label.lastIndexOf('.')) || 'unknown'
    const fmMatch = String(file.content).match(/^\s*---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
    if (fmMatch && fmMatch[1]) {
      const lines = fmMatch[1].split(/\r?\n/).map((l: string) => l.trim()).filter((l: string) => l.length > 0)
      for (const line of lines) {
        const kv = line.match(/^([^:\n]+):\s*(.*)$/)
        if (!kv) continue
        const key = kv[1].trim()
        if (!metaFilter.value[key]) continue
        const val = kv[2].trim()
        if (!key || !val) continue
        
        const parts = val.split(/[;；]/).map((p: string) => p.trim()).filter((p: string) => p.length > 0)
        for (const part of parts) {
          let metaValue = part
          if (metaValue.toLowerCase().endsWith('.md')) {
            metaValue = metaValue.substring(0, metaValue.length - 3).trim()
          }
          if (fileNamesSet.has(metaValue)) continue
          
          if (!valueMap.has(metaValue)) {
            valueMap.set(metaValue, { value: metaValue, count: 0, documents: new Set(), keys: new Set() })
          }
          valueMap.get(metaValue)!.count++
          valueMap.get(metaValue)!.documents.add(docName)
          valueMap.get(metaValue)!.keys.add(key)
        }
      }
    }
  }
  
  return Array.from(valueMap.values()).map((item) => {
    const displayName = item.count > 1 ? `${item.value} (${item.count})` : item.value
    return {
      id: `meta-${item.value.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}`,
      name: displayName,
      type: 'meta',
      layer: 'meta',
      description: `关联标签: ${Array.from(item.keys).join(', ')}`,
      metaKey: Array.from(item.keys).join(','),
      value: item.value,
      count: item.count,
      associatedDocuments: Array.from(item.documents),
      associatedKeys: Array.from(item.keys),
      size: Math.min(14, 8 + Math.log(item.count + 1) * 2),
      x: Math.random() * width,
      y: Math.random() * height
    }
  })
})

const entityNodes = computed(() => {
  return nodes.value.map(node => ({
    ...node,
    type: node.type,
    layer: node.layer
  }))
})

const allNodes = computed(() => {
  const result = [...entityNodes.value]
  if (showSliceNodes.value) result.push(...sliceNodes.value)
  if (showFileNodes.value) result.push(...fileNodesDirect.value)
  if (showMetaNodes.value) result.push(...metaNodes.value)
  return result
})

const entitySliceEdges = computed(() => {
  if (!showSliceAssociation.value) return []
  const edges: OntologyEdge[] = []
  for (const entity of nodes.value) {
    if (entity.associatedBlocks && entity.associatedBlocks.length > 0) {
      for (const blockId of entity.associatedBlocks) {
        const sliceNodeId = `slice-${blockId}`
        if (allNodes.value.some(n => n.id === sliceNodeId)) {
          edges.push({
            id: `edge-${entity.id}-${sliceNodeId}`,
            source: entity.id,
            target: sliceNodeId,
            type: 'associated_with',
            layer: 'association',
            description: `关联切片`
          })
        }
      }
    }
  }
  return edges
})

const sliceFileEdges = computed(() => {
  if (!showFileNodes.value) return []
  if (!props.blocks || props.blocks.length === 0) return []
  
  const edges: OntologyEdge[] = []
  const fileNodeMap = new Map<string, OntologyNode>()
  for (const fileNode of fileNodesDirect.value) {
    fileNodeMap.set(fileNode.name, fileNode)
  }
  
  for (const block of props.blocks) {
    const sliceNodeId = `slice-${block.id}`
    const fileName = block.fileName
    const fileNode = fileNodeMap.get(fileName)
    const sliceExists = allNodes.value.some(n => n.id === sliceNodeId)
    if (sliceExists && fileNode) {
      edges.push({
        id: `edge-${sliceNodeId}-${fileNode.id}`,
        source: sliceNodeId,
        target: fileNode.id,
        type: 'belongs_to',
        layer: 'association',
        description: `属于文件`
      })
    }
  }
  return edges
})

const fileMetaEdges = computed(() => {
  if (!showMetaNodes.value || !showFileNodes.value) return []
  const edges: OntologyEdge[] = []
  const metaNodeMap = new Map<string, OntologyNode>()
  const fileNodeMap = new Map<string, OntologyNode>()
  
  for (const metaNode of metaNodes.value) {
    metaNodeMap.set(metaNode.value, metaNode)
  }
  for (const fileNode of fileNodesDirect.value) {
    fileNodeMap.set(fileNode.name, fileNode)
  }
  
  const fileNamesSet = new Set(fileNodeMap.keys())
  
  for (const file of props.files) {
    if (!file || !file.content) continue
    const docName = file.label?.substring(0, file.label.lastIndexOf('.')) || 'unknown'
    const fileNode = fileNodeMap.get(docName)
    if (!fileNode) continue
    
    const fmMatch = String(file.content).match(/^\s*---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
    if (fmMatch && fmMatch[1]) {
      const lines = fmMatch[1].split(/\r?\n/).map((l: string) => l.trim()).filter((l: string) => l.length > 0)
      for (const line of lines) {
        const kv = line.match(/^([^:\n]+):\s*(.*)$/)
        if (!kv) continue
        const key = kv[1].trim()
        if (!metaFilter.value[key]) continue
        const val = kv[2].trim()
        if (!key || !val) continue
        
        const parts = val.split(/[;；]/).map((p: string) => p.trim()).filter((p: string) => p.length > 0)
        for (const part of parts) {
          let metaValue = part
          if (metaValue.toLowerCase().endsWith('.md')) {
            metaValue = metaValue.substring(0, metaValue.length - 3).trim()
          }
          
          if (fileNamesSet.has(metaValue)) {
            const targetFileNode = fileNodeMap.get(metaValue)
            if (targetFileNode && targetFileNode.id !== fileNode.id) {
              const edgeId = `edge-${fileNode.id}-${targetFileNode.id}`
              const exists = edges.some(e => e.id === edgeId)
              if (!exists) {
                edges.push({
                  id: edgeId,
                  source: fileNode.id,
                  target: targetFileNode.id,
                  type: 'references',
                  layer: 'association',
                  description: `${key}: ${metaValue}`,
                  metaKey: key
                })
              }
            }
            continue
          }
          
          const metaNode = metaNodeMap.get(metaValue)
          if (metaNode) {
            const edgeId = `edge-${fileNode.id}-${metaNode.id}`
            const exists = edges.some(e => e.id === edgeId)
            if (!exists) {
              edges.push({
                id: edgeId,
                source: fileNode.id,
                target: metaNode.id,
                type: 'has_meta',
                layer: 'association',
                description: `${key}: ${metaValue}`,
                metaKey: key
              })
            }
          }
        }
      }
    }
  }
  return edges
})

const allEdges = computed(() => {
  return [...edges.value, ...entitySliceEdges.value, ...sliceFileEdges.value, ...fileMetaEdges.value]
})

// 按节点类型过滤（仅实体）
const visibleNodes = computed(() => {
  return allNodes.value.filter(node => {
    // 切片、文件、元信息节点不受 entity 开关控制
    if (node.type === 'slice' || node.type === 'file' || node.type === 'meta') return true
    // 仅实体节点，无属性节点
    return visibleNodeTypes.value.includes(node.type)
  })
})

const visibleEdges = computed(() => {
  const visibleNodeIds = new Set(visibleNodes.value.map(n => n.id))
  return allEdges.value.filter(edge => {
    const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source
    const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target
    return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId)
  })
})

const associatedBlocks = computed(() => {
  if (!selectedNode.value || !selectedNode.value.associatedBlocks) return []
  const blockIds = selectedNode.value.associatedBlocks
  const result: BlockInfo[] = []
  for (const blockId of blockIds) {
    const block = props.blocks.find((b: any) => b.id === blockId)
    if (block) result.push(block)
  }
  return result
})

const relatedNodes = computed(() => {
  if (!selectedNode.value) return []
  const relations: { targetId: string; targetName: string; targetType: string; targetLayer: string; edgeType: string; description?: string }[] = []
  for (const edge of visibleEdges.value) {
    const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source
    const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target
    if (sourceId === selectedNode.value.id) {
      const targetNode = visibleNodes.value.find(n => n.id === targetId)
      if (targetNode && targetNode.id !== selectedNode.value.id) {
        relations.push({
          targetId: targetNode.id,
          targetName: targetNode.name,
          targetType: targetNode.type,
          targetLayer: targetNode.layer,
          edgeType: edge.type,
          description: edge.description
        })
      }
    }
    if (targetId === selectedNode.value.id) {
      const sourceNode = visibleNodes.value.find(n => n.id === sourceId)
      if (sourceNode && sourceNode.id !== selectedNode.value.id) {
        relations.push({
          targetId: sourceNode.id,
          targetName: sourceNode.name,
          targetType: sourceNode.type,
          targetLayer: sourceNode.layer,
          edgeType: edge.type,
          description: edge.description
        })
      }
    }
  }
  return relations
})

// ==================== 辅助函数 ====================
const getFileIcon = (extension: string): string => {
  const icons: Record<string, string> = {
    '.md': 'fa fa-file-text-o',
    '.txt': 'fa fa-file-text-o',
    '.pdf': 'fa fa-file-pdf-o',
    '.docx': 'fa fa-file-word-o',
    '.doc': 'fa fa-file-word-o'
  }
  return icons[extension] || 'fa fa-file-o'
}

// 节点颜色：实体使用蓝色
const getNodeColor = (node: OntologyNode): string => {
  if (node.type === 'slice') return '#FF5722'
  if (node.type === 'file') return '#795548'
  if (node.type === 'meta') return '#00BCD4'
  if (node.type === 'entity') return '#2196F3'
  return '#2196F3'
}

// 节点大小
const getNodeSize = (node: OntologyNode): number => {
  if (node.type === 'slice') return 12
  if (node.type === 'file') return 14
  if (node.type === 'meta') return node.size || 12
  if (node.type === 'entity') return 10
  return 10
}

const updateSize = () => {
  if (graphContainerRef.value) {
    width = graphContainerRef.value.clientWidth
    height = graphContainerRef.value.clientHeight
    if (svg) {
      svg.attr('viewBox', `0 0 ${width} ${height}`)
    }
  }
}

// ==================== 搜索功能 ====================
function searchNodes() {
  const keyword = searchKeyword.value.trim().toLowerCase()
  
  if (!keyword) {
    searchResults.value.clear()
    isSearching.value = false
    focusedNodesList.value = []
    currentFocusIndex.value = -1
    if (lastHighlightedNodeId) {
      currentNodes?.filter((d: any) => d.id === lastHighlightedNodeId)
        .attr('stroke-width', 2).attr('stroke', '#fff')
      lastHighlightedNodeId = null
    }
    updateNodeOpacity()
    return
  }
  
  isSearching.value = true
  const results = new Set<string>()
  const matchedNodes: any[] = []
  
  for (const node of visibleNodes.value) {
    let matched = false
    if (node.name && node.name.toLowerCase().includes(keyword)) matched = true
    else if (node.type === 'slice' && node.description && node.description.toLowerCase().includes(keyword)) matched = true
    else if (node.type === 'meta' && node.value && node.value.toLowerCase().includes(keyword)) matched = true
    else if (node.description && node.description.toLowerCase().includes(keyword)) matched = true
    
    if (matched) {
      results.add(node.id)
      matchedNodes.push(node)
    }
  }
  
  searchResults.value = results
  focusedNodesList.value = matchedNodes
  currentFocusIndex.value = matchedNodes.length > 0 ? 0 : -1
  updateNodeOpacity()
  
  if (matchedNodes.length > 0 && matchedNodes[0].x !== undefined) {
    jumpToNode(matchedNodes[0].id, true)
  }
}

function clearSearch() {
  searchKeyword.value = ''
  searchResults.value.clear()
  isSearching.value = false
  focusedNodesList.value = []
  currentFocusIndex.value = -1
  if (lastHighlightedNodeId) {
    currentNodes?.filter((d: any) => d.id === lastHighlightedNodeId)
      .attr('stroke-width', 2).attr('stroke', '#fff')
    lastHighlightedNodeId = null
  }
  updateNodeOpacity()
}

function updateNodeOpacity() {
  if (!currentNodes) return
  if (!isSearching.value || searchResults.value.size === 0) {
    currentNodes.attr('opacity', 1)
    currentEdges?.attr('opacity', 0.6)
    currentLabels?.attr('opacity', 1)
    return
  }
  currentNodes.attr('opacity', (d: any) => searchResults.value.has(d.id) ? 1 : 0.2)
  currentEdges?.attr('opacity', (d: any) => {
    const sourceId = d.source?.id || d.source
    const targetId = d.target?.id || d.target
    if (searchResults.value.has(sourceId) && searchResults.value.has(targetId)) return 0.8
    if (searchResults.value.has(sourceId) || searchResults.value.has(targetId)) return 0.4
    return 0.05
  })
  currentLabels?.attr('opacity', (d: any) => searchResults.value.has(d.id) ? 1 : 0.2)
}

watch(searchKeyword, () => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(searchNodes, 300)
})

// ==================== 跳转功能 ====================
function jumpToNode(nodeId: string, highlightOnly: boolean = false, skipPanel: boolean = false) {
  const targetNode = allNodes.value.find(n => n.id === nodeId)
  if (!targetNode) return
  
  if (!highlightOnly && !skipPanel) {
    selectedNode.value = targetNode
    showAssociationPanel.value = true
    
    if (targetNode.type === 'slice') {
      activeTab.value = 'info'
    } else if (targetNode.type === 'file') {
      activeTab.value = 'info'
    } else if (targetNode.type === 'meta') {
      activeTab.value = 'info'
    } else {
      activeTab.value = 'info'
    }
  }
  
  const pos = nodePositions.get(nodeId)
  if (pos && svg && zoom) {
    const currentWidth = graphContainerRef.value?.clientWidth || width
    const currentHeight = graphContainerRef.value?.clientHeight || height
    const currentTransform = d3.zoomTransform(svg.node() as Element)
    const screenX = pos.x * currentTransform.k + currentTransform.x
    const screenY = pos.y * currentTransform.k + currentTransform.y
    const deltaX = (currentWidth / 2) - screenX
    const deltaY = (currentHeight / 2) - screenY
    const newTransform = d3.zoomIdentity
      .translate(currentTransform.x + deltaX, currentTransform.y + deltaY)
      .scale(currentTransform.k)
    svg.transition().duration(500).call(zoom.transform as any, newTransform)
  }
  
  highlightNodeInGraph(nodeId)
  setTimeout(() => {
    if (currentNodes) currentNodes.attr('stroke', '#fff').attr('stroke-width', 2)
  }, 3000)
}

const updateNodePositions = () => {
  if (!currentNodes) return
  nodePositions.clear()
  currentNodes.each(function(d: any) {
    if (d && d.id) nodePositions.set(d.id, { x: d.x, y: d.y })
  })
}

const highlightNodeInGraph = (nodeId: string) => {
  if (!currentNodes) return
  if (lastHighlightedNodeId) {
    currentNodes.filter((d: any) => d.id === lastHighlightedNodeId)
      .attr('stroke-width', 2).attr('stroke', '#fff')
  }
  currentNodes.filter((d: any) => d.id === nodeId)
    .attr('stroke-width', 3).attr('stroke', '#FF5722')
  lastHighlightedNodeId = nodeId
}

const onGraphClick = () => {
  if (selectedNodeId.value !== null) {
    selectedNodeId.value = null
    selectedNode.value = null
    showAssociationPanel.value = false
    resetHighlight()
  } else {
    showAssociationPanel.value = false
  }
  tooltipVisible.value = false
  showSearchResults.value = false
}

// ==================== 拖动函数 ====================
const dragStarted = (event: d3.D3DragEvent<any, any, any>, d: any) => {
  if (!event.active && simulation) simulation.alphaTarget(0.3).restart()
  d.fx = d.x
  d.fy = d.y
  isDragging = true
}

const dragged = (event: d3.D3DragEvent<any, any, any>, d: any) => {
  d.fx = event.x
  d.fy = event.y
  if (currentNodes) {
    currentNodes.attr('cx', (nd: any) => nd.id === d.id ? event.x : nd.x)
      .attr('cy', (nd: any) => nd.id === d.id ? event.y : nd.y)
  }
  if (currentLabels) {
    currentLabels.attr('x', (nd: any) => nd.id === d.id ? event.x : nd.x)
      .attr('y', (nd: any) => nd.id === d.id ? event.y : nd.y)
  }
  if (currentEdges) {
    currentEdges
      .attr('x1', (l: any) => l.source.id === d.id ? event.x : l.source.x)
      .attr('y1', (l: any) => l.source.id === d.id ? event.y : l.source.y)
      .attr('x2', (l: any) => l.target.id === d.id ? event.x : l.target.x)
      .attr('y2', (l: any) => l.target.id === d.id ? event.y : l.target.y)
  }
  updateNodePositions()
}

const dragEnded = (event: d3.D3DragEvent<any, any, any>, d: any) => {
  if (!event.active && simulation) simulation.alphaTarget(0)
  d.fx = d.x
  d.fy = d.y
  isDragging = false
  updateNodePositions()
}

const createDragBehavior = () => {
  return d3.drag<any, any>()
    .on('start', dragStarted)
    .on('drag', dragged)
    .on('end', dragEnded)
}

// ==================== D3 初始化 ====================
const initD3 = () => {
  if (!svgRef.value || !graphContainerRef.value) return
  updateSize()
  svg = d3.select(svgRef.value)
  svg.selectAll('*').remove()
  svg.attr('viewBox', `0 0 ${width} ${height}`)
  svg.style('background-color', 'var(--backgroundColor)')
  
  const defs = svg.append('defs')
  // 箭头颜色映射
  const arrowColors = { entity: '#2196F3', association: '#999', slice: '#FF5722', file: '#795548', meta: '#00BCD4' }
  Object.entries(arrowColors).forEach(([type, color]) => {
    defs.append('marker')
      .attr('id', `arrow-${type}`)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 15)
      .attr('refY', 0)
      .attr('markerWidth', 8)
      .attr('markerHeight', 8)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', color)
  })
  
  g = svg.append('g')
  zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 3])
    .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
      if (g) g.attr('transform', event.transform.toString())
    })
  svg.call(zoom)
}

let currentHighlightedEdge: any = null
let highlightTimeout: any = null

// ==================== 渲染力导向图 ====================
const renderGraph = () => {
  if (!svgRef.value || !g) return
  
  if (visibleNodes.value.length === 0) {
    g.selectAll('*').remove()
    return
  }
  
  g.selectAll('*').remove()
  
  const nodeData = visibleNodes.value.map(node => ({
    id: node.id,
    name: node.name,
    type: node.type,
    layer: node.layer,
    description: node.description,
    preview: node.preview,
    fullContent: node.fullContent,
    originalBlock: node.originalBlock,
    associatedBlocks: node.associatedBlocks,
    metaKey: node.metaKey,
    value: node.value,
    count: node.count,
    size: node.size,
    x: node.x ?? Math.random() * width,
    y: node.y ?? Math.random() * height,
    fx: node.fx ?? null,
    fy: node.fy ?? null
  }))
  
  const nodeMap = new Map(nodeData.map(n => [n.id, n]))
  
  const linksData = visibleEdges.value
    .filter(edge => {
      const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source
      const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target
      return nodeMap.has(sourceId) && nodeMap.has(targetId)
    })
    .map(edge => ({
      id: edge.id,
      source: nodeMap.get(typeof edge.source === 'object' ? edge.source.id : edge.source)!,
      target: nodeMap.get(typeof edge.target === 'object' ? edge.target.id : edge.target)!,
      type: edge.type,
      layer: edge.layer,
      description: edge.description,
      metaKey: edge.metaKey
    }))
  
  const connectionMap = new Map<string, Set<string>>()
  linksData.forEach(link => {
    const sourceId = link.source.id
    const targetId = link.target.id
    if (!connectionMap.has(sourceId)) connectionMap.set(sourceId, new Set())
    connectionMap.get(sourceId)!.add(targetId)
    if (!connectionMap.has(targetId)) connectionMap.set(targetId, new Set())
    connectionMap.get(targetId)!.add(sourceId)
  })
  
  // 边的颜色映射
  currentEdges = g.append('g')
    .attr('class', 'edges')
    .selectAll('line')
    .data(linksData)
    .enter()
    .append('line')
    .attr('stroke', (d: any) => {
      if (d.type === 'associated_with') return '#FF5722'
      if (d.type === 'belongs_to') return '#795548'
      if (d.type === 'has_meta') return '#00BCD4'
      if (d.type === 'references') return '#FF9800'
      if (d.type === 'has_attribute') return '#9C27B0'
      const colors: Record<string, string> = { entity: '#2196F3' }
      return colors[d.layer] || '#999'
    })
    .attr('stroke-width', (d: any) => {
      if (d.type === 'associated_with') return 1.5
      if (d.type === 'belongs_to') return 1
      if (d.type === 'has_meta') return 1
      if (d.type === 'references') return 1.5
      if (d.type === 'has_attribute') return 1.5
      return 2
    })
    .attr('stroke-dasharray', (d: any) => {
      if (d.type === 'associated_with') return '3,3'
      if (d.type === 'references') return '4,4'
      if (d.type === 'has_attribute') return '5,3'
      return null
    })
    .attr('stroke-opacity', 0.6)
    .attr('marker-end', (d: any) => {
      if (d.layer === 'association') return 'url(#arrow-association)'
      return `url(#arrow-${d.layer || 'entity'})`
    })
    .attr('cursor', 'pointer')
    .on('mouseover', function(event: MouseEvent, d: any) {
      if (highlightTimeout) {
        clearTimeout(highlightTimeout)
        highlightTimeout = null
      }
      
      if (currentHighlightedEdge && currentHighlightedEdge !== this) {
        d3.select(currentHighlightedEdge)
          .attr('stroke-width', (edgeData: any) => {
            if (edgeData.type === 'associated_with') return 1.5
            if (edgeData.type === 'belongs_to') return 1
            if (edgeData.type === 'has_meta') return 1
            if (edgeData.type === 'references') return 1.5
            if (edgeData.type === 'has_attribute') return 1.5
            return 2
          })
          .attr('stroke-opacity', 0.6)
      }
      
      d3.select(this)
        .attr('stroke-width', (edgeData: any) => {
          if (edgeData.type === 'associated_with') return 3
          if (edgeData.type === 'belongs_to') return 2.5
          if (edgeData.type === 'has_meta') return 2.5
          if (edgeData.type === 'references') return 3
          if (edgeData.type === 'has_attribute') return 3
          return 3
        })
        .attr('stroke-opacity', 1)
      
      currentHighlightedEdge = this
      
      const sourceName = d.source?.name || d.source?.id || '未知'
      const targetName = d.target?.name || d.target?.id || '未知'
      const edgeType = getRelationDisplayName(d.type || '关系')
      
      tooltipVisible.value = true
      tooltipNode.value = {
        id: d.id,
        name: `${sourceName} → ${targetName}`,
        type: 'edge',
        layer: d.layer,
        description: `关系类型: ${edgeType}${d.description ? '\n' + d.description : ''}`
      } as OntologyNode
      tooltipStyle.value = { left: `${event.pageX + 10}px`, top: `${event.pageY - 20}px` }
      
      if (currentNodes && selectedNodeId.value === null) {
        currentNodes.attr('stroke-width', (node: any) => {
          if (node.id === d.source.id || node.id === d.target.id) return 3
          return 2
        }).attr('stroke', (node: any) => {
          if (node.id === d.source.id || node.id === d.target.id) return '#FF9800'
          return '#fff'
        })
      }
    })
    .on('mousemove', function(event: MouseEvent) {
      tooltipStyle.value = { left: `${event.pageX + 10}px`, top: `${event.pageY - 20}px` }
    })
    .on('mouseout', function(event: MouseEvent) {
      highlightTimeout = setTimeout(() => {
        const relatedTarget = event.relatedTarget as HTMLElement
        if (relatedTarget && relatedTarget.classList?.contains('node-tooltip')) return
        
        d3.select(this)
          .attr('stroke-width', (edgeData: any) => {
            if (edgeData.type === 'associated_with') return 1.5
            if (edgeData.type === 'belongs_to') return 1
            if (edgeData.type === 'has_meta') return 1
            if (edgeData.type === 'references') return 1.5
            if (edgeData.type === 'has_attribute') return 1.5
            return 2
          })
          .attr('stroke-opacity', 0.6)
        
        if (currentHighlightedEdge === this) currentHighlightedEdge = null
        
        tooltipVisible.value = false
        tooltipNode.value = null
        
        if (currentNodes && selectedNodeId.value === null) {
          currentNodes.attr('stroke-width', 2).attr('stroke', '#fff')
        } else if (currentNodes && selectedNodeId.value !== null) {
          highlightNodeAndRelations(selectedNodeId.value)
        }
        
        highlightTimeout = null
      }, 50)
    })
  
  // 绘制节点
  currentNodes = g.append('g')
    .attr('class', 'nodes')
    .selectAll('circle')
    .data(nodeData)
    .enter()
    .append('circle')
    .attr('r', (d: any) => getNodeSize(d as OntologyNode))
    .attr('fill', (d: any) => getNodeColor(d as OntologyNode))
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)
    .attr('cursor', 'grab')
    .call(createDragBehavior() as any)
  
  currentNodes.on('click', (event: MouseEvent, d: any) => {
    if (!isDragging) {
      event.stopPropagation()
      
      if (selectedNodeId.value === d.id) {
        selectedNodeId.value = null
        selectedNode.value = null
        showAssociationPanel.value = false
        resetHighlight()
      } else {
        selectedNodeId.value = d.id
        selectedNode.value = d as OntologyNode
        showAssociationPanel.value = true
        activeTab.value = 'info'
        highlightNodeAndRelations(d.id)
      }
      
      emit('node-click', d as OntologyNode)
    }
  })
  
  currentNodes.on('mouseover', (event: MouseEvent, d: any) => {
    if (!isDragging) {
      tooltipNode.value = d as OntologyNode
      tooltipStyle.value = { left: `${event.pageX + 5}px`, top: `${event.pageY - 8}px` }
      tooltipVisible.value = true
      
      if (selectedNodeId.value === null) {
        const connectedNodes = connectionMap.get(d.id) || new Set()
        
        currentNodes?.attr('opacity', (node: any) => {
          if (node.id === d.id) return 1
          return connectedNodes.has(node.id) ? 1 : 0.3
        }).attr('stroke-width', (node: any) => {
          if (node.id === d.id) return 3
          return connectedNodes.has(node.id) ? 2.5 : 2
        }).attr('stroke', (node: any) => {
          if (node.id === d.id || connectedNodes.has(node.id)) return '#FF9800'
          return '#fff'
        })
        
        currentEdges?.attr('stroke-opacity', (l: any) => {
          if (l.source.id === d.id || l.target.id === d.id) return 1
          return 0.1
        }).attr('stroke-width', (l: any) => {
          if (l.source.id === d.id || l.target.id === d.id) {
            if (l.type === 'associated_with') return 3
            if (l.type === 'has_attribute') return 3
            return 2.5
          }
          return 1
        })
        
        currentLabels?.attr('opacity', (node: any) => {
          if (node.id === d.id) return 1
          return connectedNodes.has(node.id) ? 1 : 0.3
        })
      }
    }
  })
  
  currentNodes.on('mouseout', () => {
    if (!isDragging) {
      if (highlightTimeout) {
        clearTimeout(highlightTimeout)
        highlightTimeout = null
      }
      
      if (currentHighlightedEdge) {
        d3.select(currentHighlightedEdge)
          .attr('stroke-width', (edgeData: any) => {
            if (edgeData.type === 'associated_with') return 1.5
            if (edgeData.type === 'belongs_to') return 1
            if (edgeData.type === 'has_meta') return 1
            if (edgeData.type === 'references') return 1.5
            if (edgeData.type === 'has_attribute') return 1.5
            return 2
          })
          .attr('stroke-opacity', 0.6)
        currentHighlightedEdge = null
      }
      
      tooltipVisible.value = false
      tooltipNode.value = null
      
      if (selectedNodeId.value === null) {
        resetHighlight()
      } else {
        highlightNodeAndRelations(selectedNodeId.value)
      }
    }
  })
  
  // 节点标签
  currentLabels = g.append('g')
    .attr('class', 'labels')
    .selectAll('text')
    .data(nodeData)
    .enter()
    .append('text')
    .attr('font-size', (d: any) => d.type === 'slice' || d.type === 'meta' ? '8px' : '10px')
    .attr('fill', 'var(--fontColor)')
    .attr('text-anchor', 'middle')
    .attr('dy', (d: any) => -getNodeSize(d as OntologyNode) - 6)
    .text((d: any) => {
      let name = d.name
      if (d.type === 'slice') name = name.length > 10 ? name.slice(0, 8) + '...' : name
      else if (d.type === 'meta') name = name.length > 12 ? name.slice(0, 10) + '...' : name
      else if (name.length > 15) name = name.slice(0, 12) + '...'
      return name
    })
  
  if (simulation) {
    simulation.stop()
    simulation = null
  }
  
  simulation = d3.forceSimulation(nodeData as any)
    .force('link', d3.forceLink(linksData).id((d: any) => d.id).distance(100).strength(0.3))
    .force('charge', d3.forceManyBody().strength((d: any) => {
      if (d.type === 'entity') return -400
      if (d.type === 'slice') return -30
      if (d.type === 'file') return -50
      if (d.type === 'meta') return -80
      return -200
    }))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius((d: any) => getNodeSize(d as OntologyNode) + 10))
  
  const ticked = () => {
    if (!g) return
    currentEdges?.attr('x1', (d: any) => d.source?.x ?? 0).attr('y1', (d: any) => d.source?.y ?? 0)
      .attr('x2', (d: any) => d.target?.x ?? 0).attr('y2', (d: any) => d.target?.y ?? 0)
    currentNodes?.attr('cx', (d: any) => d.x ?? 0).attr('cy', (d: any) => d.y ?? 0)
    currentLabels?.attr('x', (d: any) => d.x ?? 0).attr('y', (d: any) => d.y ?? 0)
    updateNodePositions()
  }
  
  simulation.on('tick', ticked)
  simulation.alphaDecay(0.02)
  
  if (selectedNodeId.value) {
    setTimeout(() => {
      if (selectedNodeId.value) {
        highlightNodeAndRelations(selectedNodeId.value)
      }
    }, 100)
  }
}

function resetHighlight() {
  if (currentEdges) {
    currentEdges.attr('stroke-opacity', 0.6)
      .attr('stroke-width', (l: any) => {
        if (l.type === 'associated_with') return 1.5
        if (l.type === 'belongs_to') return 1
        if (l.type === 'has_meta') return 1
        if (l.type === 'references') return 1.5
        if (l.type === 'has_attribute') return 1.5
        return 2
      })
  }
  
  if (currentNodes) {
    currentNodes.attr('opacity', 1)
      .attr('stroke-width', 2)
      .attr('stroke', '#fff')
  }
  
  if (currentLabels) {
    currentLabels.attr('opacity', 1)
  }
}

function highlightNodeAndRelations(nodeId: string) {
  if (!currentNodes || !currentEdges || !currentLabels) return
  
  const connectionMap = new Map<string, Set<string>>()
  if (currentEdges) {
    currentEdges.each(function(edge: any) {
      const sourceId = edge.source.id
      const targetId = edge.target.id
      if (!connectionMap.has(sourceId)) connectionMap.set(sourceId, new Set())
      connectionMap.get(sourceId)!.add(targetId)
      if (!connectionMap.has(targetId)) connectionMap.set(targetId, new Set())
      connectionMap.get(targetId)!.add(sourceId)
    })
  }
  
  const connectedNodes = connectionMap.get(nodeId) || new Set()
  
  currentNodes.attr('opacity', (node: any) => {
    if (node.id === nodeId) return 1
    return connectedNodes.has(node.id) ? 1 : 0.3
  }).attr('stroke-width', (node: any) => {
    if (node.id === nodeId) return 3
    return connectedNodes.has(node.id) ? 2.5 : 2
  }).attr('stroke', (node: any) => {
    if (node.id === nodeId || connectedNodes.has(node.id)) return '#FF9800'
    return '#fff'
  })
  
  currentEdges.attr('stroke-opacity', (l: any) => {
    if (l.source.id === nodeId || l.target.id === nodeId) return 1
    return 0.1
  }).attr('stroke-width', (l: any) => {
    if (l.source.id === nodeId || l.target.id === nodeId) {
      if (l.type === 'associated_with') return 3
      if (l.type === 'has_attribute') return 3
      return 2.5
    }
    return 1
  })
  
  currentLabels.attr('opacity', (node: any) => {
    if (node.id === nodeId) return 1
    return connectedNodes.has(node.id) ? 1 : 0.3
  })
}

// ==================== 交互方法 ====================
// 按节点类型切换（仅实体）
const toggleNodeType = (nodeType: string) => {
  const index = visibleNodeTypes.value.indexOf(nodeType)
  if (index === -1) visibleNodeTypes.value.push(nodeType)
  else visibleNodeTypes.value.splice(index, 1)
  renderGraph()
}

// ==================== 监听器 ====================
watch(() => props.ontologyData, (data) => {
  if (data && data.nodes && data.edges) {
    nodes.value = JSON.parse(JSON.stringify(data.nodes))
    edges.value = JSON.parse(JSON.stringify(data.edges))
    nextTick(() => {
      initD3()
      renderGraph()
    })
  }
}, { deep: true, immediate: true })

watch([visibleNodes, visibleEdges, () => props.blocks, showSliceNodes, showFileNodes, showMetaNodes, showSliceAssociation], () => {
  renderGraph()
}, { deep: true })

watch(() => props.files, () => {
  scanMetadata()
  nextTick(() => renderGraph())
}, { deep: true, immediate: true })

watch(metaFilter, () => {
  renderGraph()
}, { deep: true })

// ==================== 生命周期 ====================
onMounted(() => {
  initD3()
  if (props.ontologyData.nodes.length > 0) renderGraph()
  scanMetadata()
  nextTick(() => renderGraph())
  
  const resizeObserver = new ResizeObserver(() => {
    updateSize()
  })
  if (graphContainerRef.value) resizeObserver.observe(graphContainerRef.value)
  window.addEventListener('resize', () => {
    updateSize()
  })
})

onBeforeUnmount(() => {
  if (simulation) simulation.stop()
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  currentEdges = null
  currentNodes = null
  currentLabels = null
})
</script>

<style scoped>
.ontology-viewer {
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 100%;
  background-color: var(--backgroundColor);
}

.control-panel {
  width: 240px;
  border-right: 1px solid var(--borderColor);
  padding: 5px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex-shrink: 0;
  height: calc(100% - 10px);
}

.graph-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  height: 100%;
}

.graph-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.association-panel {
  width: 300px;
  border-left: 1px solid var(--borderColor);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  height: 100%;
  overflow: hidden;
}

.search-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 4px;
}

.search-input {
  flex: 1;
  border: none;
  background: none;
  padding: 4px;
  margin: 0;
  color: var(--fontColor);
  font-size: 11px;
  outline: none;
}

.search-clear {
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-clear:hover {
  background-color: var(--borderColor);
}

.search-results-dropdown {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  background: var(--menuColor);
  border: 1px solid var(--borderColor);
  border-radius: 4px;
}

.search-results-header {
  padding: 6px 8px;
  font-size: 10px;
  color: var(--borderColor);
  border-bottom: 1px solid var(--borderColor);
  background: var(--menuColor);
  position: sticky;
  top: 0;
}

.search-results-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.search-result-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  cursor: pointer;
  transition: background 0.2s;
  border-bottom: 1px solid var(--borderColor);
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover,
.search-result-item.active {
  background-color: var(--borderColor);
}

.result-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.result-name {
  flex: 1;
  font-size: 11px;
  color: var(--fontColor);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-type {
  font-size: 9px;
  color: var(--borderColor);
  flex-shrink: 0;
}

.control-section {
  flex-shrink: 0;
  padding-bottom: 5px;
  border-bottom: 1px solid var(--borderColor);
}

.switch-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
}

.switch-item {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  padding: 3px 6px;
  border-radius: 4px;
  transition: all 0.2s;
  position: relative;
}

.switch-item:hover {
  background-color: var(--borderColor);
}

.switch-count {
  margin-left: auto;
  font-size: 9px;
  color: #FF9800;
  background: rgba(255, 152, 0, 0.1);
  padding: 1px 4px;
  border-radius: 10px;
  min-width: 24px;
  text-align: center;
}

.switch-item.active .switch-count {
  background: rgba(33, 150, 243, 0.2);
  color: #2196F3;
}

.switch-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.switch-dot.entity { background-color: #2196F3; }
.switch-dot.slice { background-color: #FF5722; }
.switch-dot.file { background-color: #795548; }
.switch-dot.slice-assoc { background-color: #22a7ff; }
.switch-dot.meta { background-color: #00BCD4; }

.switch-label {
  font-size: 10px;
  color: var(--fontColor);
}

.switch-item.active .switch-label {
  font-weight: 500;
}

.meta-filter-list {
  margin-top: 5px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
}

.meta-filter-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 9px;
  margin-bottom: 3px;
  gap: 4px;
}

.meta-filter-count {
  font-size: 8px;
  color: #FF9800;
  background: rgba(255, 152, 0, 0.1);
  padding: 1px 4px;
  border-radius: 10px;
  min-width: 28px;
  text-align: center;
}

.meta-filter-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 70px;
}

.button.small {
  padding: 2px 6px;
  font-size: 9px;
  height: 16px;
  margin: 0px;
  width: calc(100% - 14px);
  cursor: pointer;
  background-color: var(--backgroundColor);
  border: 1px solid var(--borderColor);
  border-radius: 4px;
  text-align: center;
}

.button.small:hover {
  background-color: var(--borderColor);
}

.node-tooltip {
  position: fixed;
  background: var(--menuColor);
  border: 1px solid var(--borderColor);
  border-radius: 5px;
  padding: 5px;
  font-size: 11px;
  pointer-events: none;
  z-index: 1000;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  max-width: 260px;
}

.tooltip-title {
  font-weight: bold;
  font-size: 12px;
  margin-bottom: 3px;
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.tooltip-badge {
  font-size: 8px;
  padding: 1px 5px;
  border-radius: 4px;
  font-weight: normal;
}

.tooltip-badge.entity-badge { background-color: #2196F3; color: white; }
.tooltip-badge.slice-badge { background-color: #FF5722; color: white; }
.tooltip-badge.file-badge { background-color: #795548; color: white; }
.tooltip-badge.meta-badge { background-color: #00BCD4; color: white; }
.tooltip-badge.edge-badge { background-color: #FF9800; color: white; }

.tooltip-type {
  font-size: 9px;
  color: var(--borderColor);
  margin-bottom: 4px;
}

.tooltip-desc {
  font-size: 10px;
  color: var(--fontColor);
  margin-bottom: 3px;
  word-break: break-word;
  max-height: 80px;
  overflow-y: auto;
}

.tooltip-associated {
  margin-top: 5px;
  padding-top: 3px;
  border-top: 1px solid var(--borderColor);
}

.tooltip-associated-title {
  font-size: 9px;
  font-weight: bold;
  margin-bottom: 3px;
}

.tooltip-associated-list {
  max-height: 60px;
  overflow-y: auto;
}

.associated-item {
  font-size: 9px;
  padding: 1px 0;
}

.associated-label {
  font-weight: 500;
  color: #FF5722;
}

@keyframes slideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  border-bottom: 1px solid var(--borderColor);
}

.panel-title {
  font-size: 13px;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 6px;
}

.entity-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.entity-dot.entity { background-color: #2196F3; }
.entity-dot.slice { background-color: #FF5722; }
.entity-dot.file { background-color: #795548; }

.panel-close {
  background: none;
  border: none;
  color: var(--fontColor);
  cursor: pointer;
  padding: 3px 6px;
  border-radius: 4px;
}

.panel-close:hover {
  background-color: var(--borderColor);
}

.panel-tabs {
  display: flex;
  border-bottom: 1px solid var(--borderColor);
}

.tab-btn {
  flex: 1;
  padding: 6px;
  background: none;
  border: none;
  color: var(--fontColor);
  cursor: pointer;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: all 0.2s;
}

.tab-btn:hover {
  background-color: var(--borderColor);
}

.tab-btn.active {
  border-bottom: 2px solid #2196F3;
  color: #2196F3;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 5px;
}

.blocks-list, .relations-list, .info-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.block-card {
  background: var(--backgroundColor);
  border: 1px solid var(--borderColor);
  border-radius: 6px;
  padding: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.block-card:hover {
  border-color: #FF5722;
  box-shadow: 0 1px 4px rgba(255, 87, 34, 0.1);
}

.block-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.block-label {
  font-size: 10px;
  font-weight: 500;
  color: #FF5722;
  display: flex;
  align-items: center;
  gap: 3px;
  cursor: pointer;
}

.jump-btn {
  background: none;
  border: none;
  color: #2196F3;
  cursor: pointer;
  font-size: 10px;
  padding: 2px 5px;
  border-radius: 4px;
}

.jump-btn:hover {
  background-color: rgba(33, 150, 243, 0.1);
}

.block-preview {
  font-size: 9px;
  color: var(--fontColor);
  line-height: 1.3;
  margin-bottom: 4px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
}

.block-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.block-file {
  font-size: 8px;
  color: var(--borderColor);
}

.slice-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.slice-full-content {
  background: var(--backgroundColor);
  border-radius: 6px;
  padding: 6px;
  flex:1;
}

.content-pre {
  font-family: inherit;
  font-size: 10px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  color: var(--fontColor);
}

.relation-card {
  background: var(--backgroundColor);
  border: 1px solid var(--borderColor);
  border-radius: 5px;
  padding: 6px;
}

.relation-line {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}

.relation-source, .relation-target {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
}

.relation-arrow {
  color: var(--borderColor);
  font-size: 10px;
}

.relation-type {
  font-size: 9px;
  color: #FF9800;
  margin-bottom: 3px;
}

.relation-desc {
  font-size: 9px;
  color: var(--borderColor);
  margin-bottom: 4px;
}

.info-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 10px;
}

.info-label {
  width: 65px;
  color: var(--borderColor);
  flex-shrink: 0;
}

.info-value {
  flex: 1;
  word-break: break-word;
}

.empty-tip {
  text-align: center;
  padding: 15px;
  color: var(--borderColor);
  font-size: 10px;
}

.graph-empty {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: var(--borderColor);
}

.empty-icon {
  font-size: 40px;
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 10px;
  margin-top: 8px;
  opacity: 0.7;
}

::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

::-webkit-scrollbar-track {
  background: var(--backgroundColor);
}

::-webkit-scrollbar-thumb {
  background: var(--borderColor);
  border-radius: 2px;
}
</style>