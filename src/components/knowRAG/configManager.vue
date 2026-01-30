<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

// 定义组件接口
interface Props {
  store: any
  model: any
  getModel: () => Promise<void>
  cosineSimilarity?: (vecA: number[], vecB: number[]) => number
}

const props = defineProps<Props>()

// 定义类型
interface ConfigGroup {
  title: string
  icon: string
  description: string
}

interface ConfigItemOption {
  value?: string
  label?: string
  name?: string
  size?: number
}

interface ConfigItem {
  group: string
  key: string
  label: string
  labelEn: string
  type: 'text' | 'select' | 'number' | 'range' | 'textarea' | 'checkbox' | 'display'
  placeholder?: string
  placeholderEn?: string
  description: string
  descriptionEn: string
  options?: ConfigItemOption[] | any
  min?: number
  max?: number
  step?: number
  value?: string | (() => string)
  show?: () => boolean
}

interface KnowledgeBaseFile {
  label: string
  path: string
  config?: {
    embedModel?: string
    timestamp?: string
    version?: string
    blockCount?: number
  }
  metadata?: {
    blockCount?: number
    hasEmbeddings?: boolean
    hasQuestions?: boolean
    avgVectorDimension?: number
    reasonedCount?: number
    fileCount?: number
  }
}

// 本地化文本
const t = (zh: string, en: string): string => {
  return props.store.locales === 'zh' ? zh : en
}

// 区分嵌入模型与对话/处理模型
const embedModelList = computed(() => {
  return (props.model.list || []).filter((m: any) => (m.name || '').toLowerCase().includes('embed'))
})

const nonEmbedModelList = computed(() => {
  return (props.model.list || []).filter((m: any) => !(m.name || '').toLowerCase().includes('embed'))
})

// 配置分组
const configGroups: Record<string, ConfigGroup> = {
  knowledgebase: {
    title: t('知识库配置', 'Knowledge Base Configuration'),
    icon: 'fa fa-database',
    description: t('知识库文件管理', 'Knowledge Base File Management')
  },
  model: {
    title: t('模型配置', 'Model Configuration'),
    icon: 'fa fa-microchip',
    description: t('AI模型相关配置', 'AI Model Related Configuration')
  },
  search: {
    title: t('检索配置', 'Search Configuration'),
    icon: 'fa fa-search',
    description: t('知识检索相关配置', 'Knowledge Search Related Configuration')
  },
  process: {
    title: t('处理配置', 'Processing Configuration'),
    icon: 'fa fa-cogs',
    description: t('知识处理相关配置', 'Knowledge Processing Related Configuration')
  }
}

// 知识库文件列表
const knowledgeBases = ref<KnowledgeBaseFile[]>([])
const isLoadingKb = ref(false)
const selectedKbIndex = ref(-1)
const kbScanPath = ref('')

// 配置项
const configItems: ConfigItem[] = [
  {
    group: 'model',
    key: 'url',
    label: 'Ollama服务地址',
    labelEn: 'Ollama Service URL',
    type: 'text',
    placeholder: 'http://127.0.0.1:11434',
    placeholderEn: 'http://127.0.0.1:11434',
    description: 'Ollama API服务器地址',
    descriptionEn: 'Ollama API Server Address'
  },
  {
    group: 'model',
    key: 'embed',
    label: '嵌入模型',
    labelEn: 'Embedding Model',
    type: 'select',
    options: embedModelList,
    description: '用于向量化文本的模型',
    descriptionEn: 'Model for text vectorization'
  },
  {
    group: 'model',
    key: 'chat',
    label: '聊天模型',
    labelEn: 'Chat Model',
    type: 'select',
    options: nonEmbedModelList,
    description: '用于对话的模型',
    descriptionEn: 'Model for conversation'
  },
  {
    group: 'model',
    key: 'process',
    label: '处理模型',
    labelEn: 'Processing Model',
    type: 'select',
    options: nonEmbedModelList,
    description: '用于知识处理的模型',
    descriptionEn: 'Model for knowledge processing'
  },
  {
    group: 'search',
    key: 'searchMethod',
    label: '检索方法',
    labelEn: 'Search Method',
    type: 'select',
    options: [
      { value: 'CS', label: t('余弦相似度 (CS)', 'Cosine Similarity (CS)') },
      { value: 'CS(M)', label: t('合并余弦相似度 (CS(M))', 'Merged Cosine Similarity (CS(M))') },
      { value: 'MDS', label: t('多维缩放 (MDS)', 'Multidimensional Scaling (MDS)') },
      { value: 'MDS(M)', label: t('合并多维缩放 (MDS(M))', 'Merged MDS (MDS(M))') },
      { value: 'PCA', label: t('主成分分析 (PCA)', 'Principal Component Analysis (PCA)') }
    ],
    description: '向量相似度计算方法',
    descriptionEn: 'Vector similarity calculation method'
  },
  {
    group: 'search',
    key: 'searchMode',
    label: '检索模式',
    labelEn: 'Search Mode',
    type: 'select',
    options: [
      { value: t('按数量', 'By Count'), label: t('按数量', 'By Count') },
      { value: t('按匹配率', 'By Match Rate'), label: t('按匹配率', 'By Match Rate') },
      { value: t('按字符', 'By Characters'), label: t('按字符', 'By Characters') }
    ],
    description: '知识片段召回策略',
    descriptionEn: 'Knowledge fragment retrieval strategy'
  },
  {
    group: 'search',
    key: 'searchNum',
    label: '检索数量',
    labelEn: 'Search Count',
    type: 'number',
    min: 1,
    max: 20,
    show: () => props.model.searchMode === t('按数量', 'By Count'),
    description: '按数量检索时返回的片段数',
    descriptionEn: 'Number of fragments to return when searching by count'
  },
  {
    group: 'search',
    key: 'matchRatio',
    label: '匹配率阈值',
    labelEn: 'Match Ratio Threshold',
    type: 'number',
    min: 0,
    max: 1,
    step: 0.01,
    show: () => props.model.searchMode === t('按匹配率', 'By Match Rate'),
    description: '按匹配率检索时的相似度阈值',
    descriptionEn: 'Similarity threshold when searching by match rate'
  },
  {
    group: 'search',
    key: 'searchCharacter',
    label: '字符限制',
    labelEn: 'Character Limit',
    type: 'number',
    min: 100,
    max: 10000,
    show: () => props.model.searchMode === t('按字符', 'By Characters'),
    description: '按字符检索时的最大字符数',
    descriptionEn: 'Maximum characters when searching by characters'
  },
  {
    group: 'search',
    key: 'summaryWeight',
    label: '摘要权重',
    labelEn: 'Summary Weight',
    type: 'range',
    min: 0,
    max: 1,
    step: 0.01,
    description: '摘要相似度在综合评分中的权重',
    descriptionEn: 'Weight of summary similarity in comprehensive score'
  },
  {
    group: 'search',
    key: 'sliceWeight',
    label: '片段权重',
    labelEn: 'Fragment Weight',
    type: 'display',
    value: () => (1 - props.model.summaryWeight).toFixed(2),
    description: '片段相似度在综合评分中的权重（自动计算）',
    descriptionEn: 'Weight of fragment similarity in comprehensive score (auto calculated)'
  },
  {
    group: 'search',
    key: 'useReverseInference',
    label: '反推相似度计算',
    labelEn: 'Reverse Inference Similarity',
    type: 'checkbox',
    description: '是否使用反推相似度计算（当反推向量可用时）',
    descriptionEn: 'Whether to use reverse inference similarity (when reverse vectors are available)'
  },
  {
    group: 'search',
    key: 'reverseInferenceWeight',
    label: '反推权重',
    labelEn: 'Reverse Inference Weight',
    type: 'range',
    min: 0,
    max: 1,
    step: 0.1,
    show: () => props.model.useReverseInference,
    description: '反推相似度在综合评分中的权重',
    descriptionEn: 'Weight of reverse inference similarity in comprehensive score'
  },
  {
    group: 'process',
    key: 'processPrompt',
    label: '知识处理提示词',
    labelEn: 'Knowledge Processing Prompt',
    type: 'textarea',
    placeholder: '请根据如下资料，提出这些资料能够解答的若干个问题...',
    placeholderEn: 'Based on the following information, please raise several questions that these materials can answer...',
    description: '用于生成知识片段问题的提示词',
    descriptionEn: 'Prompt for generating knowledge fragment questions'
  },
  {
    group: 'process',
    key: 'think',
    label: '深度思考',
    labelEn: 'Deep Thinking',
    type: 'checkbox',
    description: '是否启用模型的深度思考模式',
    descriptionEn: 'Whether to enable model deep thinking mode'
  }
]

// 将MDS和PCA参数移到相应的search分组中
configItems.push(
  {
    group: 'search',
    key: 'mdsIterations',
    label: 'MDS迭代次数',
    labelEn: 'MDS Iterations',
    type: 'number',
    min: 10,
    max: 1000,
    show: () => props.model.searchMethod.includes('MDS'),
    description: 'MDS算法的最大迭代次数',
    descriptionEn: 'Maximum iterations for MDS algorithm'
  },
  {
    group: 'search',
    key: 'mdsEpsilon',
    label: 'MDS收敛阈值',
    labelEn: 'MDS Convergence Threshold',
    type: 'number',
    min: 0.001,
    max: 1,
    step: 0.001,
    show: () => props.model.searchMethod.includes('MDS'),
    description: 'MDS算法的收敛判断阈值',
    descriptionEn: 'Convergence threshold for MDS algorithm'
  },
  {
    group: 'search',
    key: 'pcaComponents',
    label: 'PCA主成分数量',
    labelEn: 'PCA Components',
    type: 'number',
    min: 2,
    max: 10,
    show: () => props.model.searchMethod === 'PCA',
    description: 'PCA降维后的维度数量',
    descriptionEn: 'Number of dimensions after PCA reduction'
  }
)

// 活动配置分组
const activeGroup = ref<string>('knowledgebase')

// 响应式布局 - 根据容器宽度决定列数
const containerWidth = ref(0)
const columns = computed(() => {
  if (containerWidth.value >= 900) return 3
  if (containerWidth.value >= 600) return 2
  return 1
})

// 更新容器宽度
const updateContainerWidth = () => {
  const container = document.querySelector('.config-content-container')
  if (container) {
    containerWidth.value = container.clientWidth
  }
}

// 监听窗口大小变化
const handleResize = () => {
  updateContainerWidth()
}

// 获取当前组的配置项
const currentConfigItems = computed(() => {
  return configItems.filter(item => {
    if (item.group !== activeGroup.value) return false
    if (item.show && typeof item.show === 'function') {
      return item.show()
    }
    return true
  })
})

// 分组配置项（用于多列布局）
const groupedConfigItems = computed(() => {
  const items = currentConfigItems.value
  const result = []
  
  // 如果当前是知识库视图，不使用多列布局
  if (activeGroup.value === 'knowledgebase') {
    return [items]
  }
  
  // 根据列数分组
  const itemsPerColumn = Math.ceil(items.length / columns.value)
  
  for (let i = 0; i < columns.value; i++) {
    const start = i * itemsPerColumn
    const end = start + itemsPerColumn
    result.push(items.slice(start, end))
  }
  
  return result.filter(col => col.length > 0)
})

// 扫描知识库文件
const scanKnowledgeBases = async () => {
  if (!props.store.root) {
    kbScanPath.value = t('未选择文件夹', 'No folder selected')
    emit('updateState', kbScanPath.value)
    return
  }

  kbScanPath.value = props.store.root
  isLoadingKb.value = true
  emit('updateState', t('正在扫描知识库文件...', 'Scanning knowledge base files...'))

  try {
    const result = await window.ipcRenderer.invoke("getFilesRelation", props.store.root, 1)
    if (!result) {
      knowledgeBases.value = []
      return
    }

    const { fileList = [] } = result
    const kbFiles = fileList.filter((file: any) => file.path.endsWith('.kb'))
    
    // 读取每个知识库文件的元数据
    const processedFiles = await Promise.all(
      kbFiles.map(async (file: any) => {
        try {
          const content = await window.ipcRenderer.invoke('readFile', file.path)
          const data = JSON.parse(content)
          
          const kbFile: KnowledgeBaseFile = {
            label: file.label,
            path: file.path,
          }
          
          if (data.config) {
            kbFile.config = {
              embedModel: data.config.embedModel,
              timestamp: data.config.timestamp,
              version: data.config.version,
              blockCount: data.blocks?.length
            }
          }
          
          if (data.blocks && data.blocks.length > 0) {
            const firstBlock = data.blocks[0]
            const hasEmbeddings = !!firstBlock.A_vector
            const hasQuestions = firstBlock.Q && firstBlock.Q !== '' && firstBlock.Q !== '问题未推理' && firstBlock.Q !== 'Question not reasoned'
            const avgVectorDimension = hasEmbeddings ? firstBlock.A_vector.length : 0
            const reasonedCount = data.blocks.filter((b: any) => b.Q && b.Q !== '' && b.Q !== '问题未推理' && b.Q !== 'Question not reasoned').length
            const fileCount = new Set(data.blocks.map((b: any) => b.label)).size
            
            kbFile.metadata = {
              blockCount: data.blocks.length,
              hasEmbeddings,
              hasQuestions,
              avgVectorDimension,
              reasonedCount,
              fileCount
            }
          }
          
          return kbFile
        } catch (e) {
          // 如果解析失败，只返回基本信息
          console.error(t('解析知识库文件失败:', 'Failed to parse knowledge base file:'), file.label, e)
          return {
            label: file.label,
            path: file.path,
            config: { version: 'unknown' }
          } as KnowledgeBaseFile
        }
      })
    )
    
    // 按文件名排序（按时间戳降序）
    processedFiles.sort((a: any, b: any) => {
      return b.label.localeCompare(a.label)
    })
    
    knowledgeBases.value = processedFiles
    emit('updateState', t(
      `扫描完成，找到 ${knowledgeBases.value.length} 个知识库文件`,
      `Scan complete, found ${knowledgeBases.value.length} knowledge base files`
    ))
    
  } catch (error) {
    console.error(t('扫描知识库出错:', 'Error scanning knowledge base:'), error)
    emit('updateState', t('扫描知识库失败', 'Failed to scan knowledge bases'))
  } finally {
    isLoadingKb.value = false
  }
}

// 加载知识库到主模块
const loadKnowledgeBase = async (index: number) => {
  const kbFile = knowledgeBases.value[index]
  emit('updateState', t(
    `正在加载知识库: ${kbFile.label}`,
    `Loading knowledge base: ${kbFile.label}`
  ))
  
  // 发送事件到父组件加载知识库
  emit('loadKnowledgeBase', index)
}

// 删除知识库文件
const deleteKnowledgeBase = async (index: number) => {
  const kbFile = knowledgeBases.value[index]
  const confirmMessage = t(
    `确定要删除知识库文件 "${kbFile.label}" 吗？此操作不可恢复。`,
    `Are you sure you want to delete knowledge base file "${kbFile.label}"? This action cannot be undone.`
  )
  
  if (!confirm(confirmMessage)) return
  
  try {
    const success = await window.ipcRenderer.invoke('deleteFile', kbFile.path)
    if (success) {
      knowledgeBases.value.splice(index, 1)
      emit('updateState', t(
        `已删除知识库: ${kbFile.label}`,
        `Deleted knowledge base: ${kbFile.label}`
      ))
    }
  } catch (error:any) {
    console.error(t('删除知识库出错:', 'Error deleting knowledge base:'), error)
    emit('updateState', t(
      `删除失败: ${error.message}`,
      `Delete failed: ${error.message}`
    ))
  }
}

// 获取保存时间文本
const getSaveTimeText = (timestamp?: string) => {
  if (!timestamp) return t('未知', 'Unknown')
  try {
    const date = new Date(timestamp)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString().substring(0, 5)
  } catch (e) {
    return timestamp
  }
}

// 重置配置
const resetConfig = () => {
  if (confirm(t('确定要重置所有配置吗？', 'Are you sure to reset all configurations?'))) {
    const defaultConfig = {
      url: "http://127.0.0.1:11434",
      embed: "nomic-embed-text:latest",
      process: "qwen3:latest",
      processPrompt: t(
        "请根据如下资料，提出这些资料能够解答的若干个问题，不要返回其他表述。资料如下：",
        "Based on the following information, please raise several questions that these materials can answer. Do not return any other expressions. The information is as follows:"
      ),
      searchMethod: "CS",
      searchMode: t("按数量", "By Count"),
      matchRatio: 0.58,
      searchNum: 3,
      searchCharacter: 2500,
      chat: "qwen3:latest",
      mdsIterations: 50,
      mdsEpsilon: 0.1,
      pcaComponents: 2,
      summaryWeight: 0.0,
      useReverseInference: false,
      reverseInferenceWeight: 0.3,
      think: false
    }
    
    Object.assign(props.model, defaultConfig)
  }
}

// 导入配置
const importConfig = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      try {
        const text = await file.text()
        const config = JSON.parse(text)
        Object.assign(props.model, config)
        emit('updateState', t('配置导入成功', 'Configuration imported successfully'))
      } catch (error) {
        emit('updateState', t('配置导入失败', 'Failed to import configuration'))
      }
    }
  }
  input.click()
}

// 导出配置
const exportConfig = () => {
  const configStr = JSON.stringify(props.model, null, 2)
  const blob = new Blob([configStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `knowledge-base-config-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  emit('updateState', t('配置已导出', 'Configuration exported'))
}

// 监听根目录变化
watch(() => props.store.root, (newRoot) => {
  if (newRoot && activeGroup.value === 'knowledgebase') {
    scanKnowledgeBases()
  }
})

// 初始化
onMounted(() => {
  // 如果已经有根目录，立即扫描
  if (props.store.root) {
    scanKnowledgeBases()
  }
  
  // 初始化容器宽度
  setTimeout(updateContainerWidth, 100)
  
  // 监听窗口大小变化
  window.addEventListener('resize', handleResize)
})

// 清理
onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

// 切换分组时扫描知识库
watch(activeGroup, (newGroup) => {
  if (newGroup === 'knowledgebase' && props.store.root) {
    scanKnowledgeBases()
  }
  
  // 更新容器宽度（确保DOM已更新）
  setTimeout(updateContainerWidth, 50)
})

// 定义发射事件
const emit = defineEmits<{
  updateState: [state: string]
  loadKnowledgeBase: [index: number]
}>()
</script>

<template>
  <div style="display:flex;width:100%;height:100%;">
    <div style="display:flex;flex:1;gap:10px;width:100%;height:100%;padding:10px;box-sizing:border-box;">
      <!-- 配置分组导航 -->
      <div class="scoll" style="width:160px;border:1px solid var(--borderColor);border-radius:5px;padding:10px;height:100%;box-sizing:border-box;display:flex;flex-direction:column;overflow-y: auto;">
        <div style="flex-shrink:0;">
          <div 
            v-for="(group, key) in configGroups" 
            :key="key"
            @click="activeGroup = key"
            :style="{
              padding: '5px',
              marginBottom: '5px',
              borderRadius: '4px',
              cursor: 'pointer',
              backgroundColor: activeGroup === key ? 'var(--menuColor)' : 'transparent',
              border: activeGroup === key ? '1px solid var(--borderColor)' : '1px solid transparent'
            }"
            class="group-item"
          >
            <div style="display:flex;align-items:center;gap:8px;">
              <i :class="group.icon" style="font-size:12px;"></i>
              <span style="font-size:12px;font-weight:bold;">{{ group.title }}</span>
            </div>
            <div style="font-size:10px;color:var(--borderColor);margin-top:3px;margin-left:20px;">{{ group.description }}</div>
          </div>
        </div>
        
        <!-- 配置操作 -->
        <div style="margin-top:auto;border-top:1px solid var(--borderColor);padding-top:10px;flex-shrink:0;">
          <div style="font-weight:bold;font-size:12px;margin-bottom:5px;color:var(--borderColor);">{{ t('配置操作', 'Configuration Actions') }}</div>
          <div style="display:flex;gap:5px;">
            <div 
              @click="importConfig"
              class="button"
              style="align-items:center;justify-content:center;flex:1;margin: 0px;"
              :title="t('导入配置', 'Import Configuration')"
            >
              <i class="fa fa-upload"></i>
            </div>
            <div 
              @click="exportConfig"
              class="button"
              style="align-items:center;justify-content:center;flex:1;margin: 0px;"
              :title="t('导出配置', 'Export Configuration')"
            >
              <i class="fa fa-download"></i>
            </div>
            <div 
              @click="resetConfig"
              class="button danger"
              style="align-items:center;justify-content:center;flex:1;margin: 0px;"
              :title="t('重置配置', 'Reset Configuration')"
            >
              <i class="fa fa-undo"></i>
            </div>
          </div>
        </div>
      </div>

      <!-- 配置内容 -->
      <div class="config-content-container scoll" style="flex:1;border:1px solid var(--borderColor);border-radius:5px;padding:8px;height:100%;box-sizing:border-box;display:flex;flex-direction:column;overflow-y: auto;">

        <div style="flex:1;padding-right:0px;">
          <!-- 知识库配置内容（不使用多列布局） -->
          <div v-if="activeGroup === 'knowledgebase'" style="height:100%;display:flex;flex-direction:column;gap:5px;">
            <!-- 操作栏 -->
            <div style="display:flex;gap:8px;flex-shrink:0;">
              <div 
                @click="scanKnowledgeBases"
                class="button"
                style="display:flex;align-items:center;gap:5px;padding:6px 12px;margin: 0px;"
                :title="t('重新扫描知识库文件', 'Rescan knowledge base files')"
              >
                <i class="fa fa-refresh" :class="{ 'fa-spin': isLoadingKb }"></i>
                <span>{{ t('刷新列表', 'Refresh') }}</span>
              </div>
              
              <div v-if="activeGroup === 'knowledgebase' && kbScanPath" style="margin-top:10px;font-size:11px;">
               <i class="fa fa-folder-open"></i> {{ kbScanPath }}
              </div>
              <div style="flex:1;"></div>
              <div style="font-size:12px;color:var(--borderColor);padding:6px 0;">
                {{ t('总计: ', 'Total: ') }}{{ knowledgeBases.length }}
              </div>
            </div>

            <!-- 知识库列表 -->
            <div class="scoll" style="flex:1;overflow-y:auto;border:1px solid var(--borderColor);border-radius:5px;padding:5px;">
              <div v-if="isLoadingKb" style="display:flex;justify-content:center;align-items:center;height:100px;">
                <i class="fa fa-spinner fa-spin" style="font-size:24px;color:var(--borderColor);"></i>
              </div>
              <div v-else-if="knowledgeBases.length === 0" style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:200px;color:var(--borderColor);">
                <i class="fa fa-database" style="font-size:48px;margin-bottom:16px;"></i>
                <div style="margin-bottom:8px;">{{ t('未找到知识库文件', 'No knowledge base files found') }}</div>
                <div style="font-size:12px;">{{ t('请确保已选择正确的文件夹', 'Please ensure you have selected the correct folder') }}</div>
              </div>
              <div v-else style="display:flex;flex-direction:column;gap:10px;">
                <div 
                  v-for="(kb, index) in knowledgeBases" 
                  :key="index"
                  :style="{
                    border: '1px solid var(--borderColor)',
                    borderRadius: '5px',
                    padding: '12px',
                    transition: 'background-color 0.2s'
                  }"
                  class="kb-item"
                >
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                    <div style="flex:1;min-width:0;">
                      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                        <i class="fa fa-database" style="color:#4CAF50;font-size:14px;"></i>
                        <span style="font-weight:bold;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ kb.label }}</span>
                        <span v-if="kb.config?.embedModel" style="font-size:10px;padding:2px 8px;background-color:var(--menuColor);border-radius:3px;flex-shrink:0;border:1px solid var(--borderColor);">
                          <i class="fa fa-cube"></i> {{ kb.config.embedModel }}
                        </span>
                        <div @click="loadKnowledgeBase(index)" class="button" style="margin: 0px;" :title="t('加载此知识库', 'Load this knowledge base')">
                            <i class="fa fa-play"></i>
                        </div>
                        <div @click="deleteKnowledgeBase(index)" class="button" style="margin: 0px;" :title="t('删除此知识库', 'Delete this knowledge base')">
                            <i class="fa fa-trash"></i>
                        </div>
                      </div>
                      
                      <!-- 主要信息网格 -->
                      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:10px;margin-bottom:8px;">
                        <!-- 片段统计 -->
                        <div style="font-size:11px;">
                          <div style="color:var(--borderColor);margin-bottom:2px;">{{ t('片段统计', 'Blocks') }}</div>
                          <div>
                            <span style="color:#2196F3;">{{ kb.metadata?.blockCount || kb.config?.blockCount || 0 }}</span> 
                            {{ t('个片段', 'blocks') }}
                            <span v-if="kb.metadata?.reasonedCount" style="color:#FF9800;margin-left:8px;">
                              ({{ t('已推理', 'reasoned') }}: {{ kb.metadata.reasonedCount }})
                            </span>
                          </div>
                        </div>
                        
                        <!-- 文件数 -->
                        <div style="font-size:11px;">
                          <div style="color:var(--borderColor);margin-bottom:2px;">{{ t('涉及文件数', 'Files') }}</div>
                          <div>
                            <span style="color:#4CAF50;">{{ kb.metadata?.fileCount || '?' }}</span> 
                            {{ t('个文件', 'files') }}
                          </div>
                        </div>
                        
                        <!-- 向量维度 -->
                        <div style="font-size:11px;">
                          <div style="color:var(--borderColor);margin-bottom:2px;">{{ t('向量维度', 'Vector Dimension') }}</div>
                          <div>
                            <span style="color:#9C27B0;">{{ kb.metadata?.avgVectorDimension || '?' }}</span> 
                            {{ t('维', 'dim') }}
                          </div>
                        </div>
                        
                        <!-- 保存时间 -->
                        <div style="font-size:11px;">
                          <div style="color:var(--borderColor);margin-bottom:2px;">{{ t('保存时间', 'Saved') }}</div>
                          <div>
                            <span style="color:#795548;">{{ getSaveTimeText(kb.config?.timestamp) }}</span>
                          </div>
                        </div>
                      </div>
                      
                      <!-- 状态指示器 -->
                      <div style="display:flex;gap:10px;margin-top:5px;">
                        <span v-if="kb.metadata?.hasEmbeddings" style="font-size:10px;color:#4CAF50;">
                          <i class="fa fa-check-circle"></i> {{ t('已向量化', 'Embedded') }}
                        </span>
                        <span v-if="kb.metadata?.hasQuestions" style="font-size:10px;color:#2196F3;">
                          <i class="fa fa-question-circle"></i> {{ t('已推理', 'Reasoned') }}
                        </span>
                        <span v-if="kb.metadata?.reasonedCount && kb.metadata?.blockCount" style="font-size:10px;color:#FF9800;">
                          <i class="fa fa-percent"></i> {{ ((kb.metadata.reasonedCount / kb.metadata.blockCount) * 100).toFixed(0) }}% {{ t('已推理', 'reasoned') }}
                        </span>
                        <span v-if="kb.config?.version" style="font-size:10px;color:#9C27B0;">
                          <i class="fa fa-code-fork"></i> v{{ kb.config.version }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 其他配置组内容（使用多列布局） -->
          <div v-else style="height:100%;display:flex;flex-direction:column;overflow:hidden;">
            <!-- 列布局容器 -->
            <div class="scoll" style="flex:1;overflow-y:auto;padding-right:5px;">
              <div v-if="groupedConfigItems.length > 0" style="display:flex;gap:15px;align-items:flex-start;">
                <div 
                  v-for="(columnItems, columnIndex) in groupedConfigItems" 
                  :key="columnIndex"
                  style="flex:1;min-width:0;"
                >
                  <div v-for="item in columnItems" 
                       :key="item.key"
                       style="border:1px solid var(--borderColor);border-radius:5px;padding:8px;margin-bottom:8px;background-color:var(--backgroundColor);">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                      <div style="flex:1;min-width:0;">
                        <div style="font-weight:bold;font-size:13px;margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                          {{ t(item.label, item.labelEn) }}
                        </div>
                        <div style="font-size:11px;color:var(--borderColor);">
                          {{ t(item.description, item.descriptionEn) }}
                        </div>
                      </div>
                      <div style="font-size:10px;padding:2px 6px;background-color:var(--menuColor);border-radius:3px;white-space:nowrap;flex-shrink:0;margin-left:8px;">
                        {{ item.key }}
                      </div>
                    </div>
                    
                    <!-- 文本输入 -->
                    <div v-if="item.type === 'text'" style="margin-top:8px;">
                      <input 
                        v-model="model[item.key]"
                        :placeholder="t(item.placeholder || '', item.placeholderEn || '')"
                        style="width:calc(100% - 10px);max-width:100%;padding:6px 8px;border:1px solid var(--borderColor);border-radius:4px;font-size:12px;box-sizing:border-box;"
                      />
                    </div>
                    
                    <!-- 下拉选择 -->
                    <div v-else-if="item.type === 'select'" style="margin-top:8px;">
                      <select 
                        v-model="model[item.key]"
                        style="width:calc(100% - 10px);max-width:100%;padding:6px 8px;border:1px solid var(--borderColor);border-radius:4px;font-size:12px;background-color:var(--backgroundColor);box-sizing:border-box;"
                      >
                        <template v-if="Array.isArray(item.options)">
                          <option v-for="(option, idx) in item.options" :key="idx" :value="option.value || option">
                            {{ typeof option.label === 'string' && option.label.includes('(') ? option.label : t(option.label || option, option.label || option) }}
                          </option>
                        </template>
                        <template v-else-if="item.options && item.options.value">
                          <option v-for="(option, idx) in item.options.value" :key="idx" :value="option.name || option">
                            {{ option.name || option }}
                            <template v-if="option.size">
                              ({{ (option.size/1024/1024/1024).toFixed(2) }}GB)
                            </template>
                          </option>
                        </template>
                      </select>
                    </div>
                    
                    <!-- 数字输入 -->
                    <div v-else-if="item.type === 'number'" style="margin-top:8px;">
                      <input 
                        type="number"
                        v-model.number="model[item.key]"
                        :min="item.min"
                        :max="item.max"
                        :step="item.step || 1"
                        style="width:calc(100% - 10px);max-width:100%;padding:6px 8px;border:1px solid var(--borderColor);border-radius:4px;font-size:12px;box-sizing:border-box;"
                      />
                    </div>
                    
                    <!-- 范围滑块 -->
                    <div v-else-if="item.type === 'range'" style="margin-top:8px;">
                      <div style="display:flex;align-items:center;gap:10px;width:100%;">
                        <input 
                          type="range"
                          v-model.number="model[item.key]"
                          :min="item.min"
                          :max="item.max"
                          :step="item.step"
                          style="flex:1;min-width:0;width:100%;"
                        />
                        <span style="font-size:12px;min-width:40px;flex-shrink:0;text-align:right;">{{ (model[item.key] * 100).toFixed(0) }}%</span>
                      </div>
                    </div>
                    
                    <!-- 多行文本 -->
                    <div v-else-if="item.type === 'textarea'" style="margin-top:8px;">
                      <textarea 
                        v-model="model[item.key]"
                        :placeholder="t(item.placeholder || '', item.placeholderEn || '')"
                        style="width:100%;max-width:100%;padding:6px 8px;border:1px solid var(--borderColor);border-radius:4px;font-size:12px;min-height:80px;resize:vertical;box-sizing:border-box;"
                      />
                    </div>
                    
                    <!-- 复选框 -->
                    <div v-else-if="item.type === 'checkbox'" style="margin-top:8px;">
                      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;width:100%;">
                        <input 
                          type="checkbox"
                          v-model="model[item.key]"
                          style="width:16px;height:16px;flex-shrink:0;"
                        />
                        <span style="font-size:12px;">{{ t('启用 ', 'Enable ') }}{{ t(item.label, item.labelEn) }}</span>
                      </label>
                    </div>
                    
                    <!-- 只读显示 -->
                    <div v-else-if="item.type === 'display'" style="margin-top:8px;">
                      <div style="padding:6px 8px;border:1px solid var(--borderColor);border-radius:4px;font-size:12px;background-color:var(--menuColor);width:calc(100% - 5px);box-sizing:border-box;">
                        {{ typeof item.value === 'function' ? item.value() : item.value }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- 权重分配信息（只在搜索分组显示） -->
              <div v-if="activeGroup === 'search' && model.useReverseInference" 
                  style="margin:15px 0;padding:12px;border:1px dashed var(--borderColor);border-radius:5px;background-color:rgba(0,0,0,0.02);width:calc(100% - 26px);">
                  <div style="font-size:12px;color:var(--borderColor);margin-bottom:8px;display:flex;align-items:center;gap:5px;">
                      <i class="fa fa-info-circle"></i> {{ t('当前权重分配：', 'Current Weight Allocation:') }}
                  </div>
                  <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:15px;font-size:11px;">
                      <div style="text-align:center;">
                          <div style="color:#4CAF50;font-weight:bold;margin-bottom:4px;">{{ t('摘要权重', 'Summary Weight') }}</div>
                          <div style="font-size:14px;font-weight:bold;">{{ (model.summaryWeight * (1 - model.reverseInferenceWeight)).toFixed(2) }}</div>
                      </div>
                      <div style="text-align:center;">
                          <div style="color:#2196F3;font-weight:bold;margin-bottom:4px;">{{ t('切片权重', 'Fragment Weight') }}</div>
                          <div style="font-size:14px;font-weight:bold;">{{ ((1 - model.summaryWeight) * (1 - model.reverseInferenceWeight)).toFixed(2) }}</div>
                      </div>
                      <div style="text-align:center;">
                          <div style="color:#9C27B0;font-weight:bold;margin-bottom:4px;">{{ t('反推权重', 'Reverse Inference Weight') }}</div>
                          <div style="font-size:14px;font-weight:bold;">{{ model.reverseInferenceWeight.toFixed(2) }}</div>
                      </div>
                  </div>
              </div>
              
              <!-- 空状态 -->
              <div v-if="currentConfigItems.length === 0" style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:200px;color:var(--borderColor);width:100%;">
                <i class="fa fa-sliders" style="font-size:48px;margin-bottom:16px;"></i>
                <div style="margin-bottom:8px;">{{ t('当前无可用配置项', 'No available configuration items') }}</div>
                <div style="font-size:12px;">{{ t('请检查当前检索模式设置', 'Please check the current search mode settings') }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.group-item:hover {
  background-color: var(--menuColor) !important;
}

.kb-item:hover {
  background-color: rgba(0, 0, 0, 0.02);
}

input, select, textarea {
  background-color: var(--backgroundColor);
  color: var(--fontColor);
  box-sizing: border-box;
}

input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--fontActiveColor);
}

/* 多列布局时的响应式调整 */
@media (max-width: 900px) and (min-width: 600px) {
  .config-content-container :deep(.config-item) {
    margin-bottom: 10px;
  }
}

@media (max-width: 600px) {
  .config-content-container :deep(.config-item) {
    margin-bottom: 12px;
  }
}
</style>