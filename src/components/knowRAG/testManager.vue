<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted } from 'vue'
import block_md from '../block_md.vue'

// 定义组件接口
interface Props {
  store: any
  blocks: any[]
  model: any
  getModel: () => Promise<void>
  cosineSimilarity: (vecA: number[], vecB: number[]) => number
  files?: any[]
}

const props = defineProps<Props>()

// 本地化函数
const t = (zh: string, en: string): string => {
  return props.store?.locales === 'zh' ? zh : en
}

// 测试相关状态
const test = reactive({
  questions: [''] as string[],
  answers: [''] as string[],
  searchNum: 5 as any,
  isRunning: false,
  progress: 0,
  questionStatus: [] as Array<{text: string, color: string, icon: string, time?: string}>
})

const testResults = ref([]) as any
const lastUpdateTime = ref('')

// 文件摘要信息存储（用于测试模块）
const fileSummaries = ref(new Map()) as any

// 监听语言切换
watch(() => props.store?.locales, (newLocale) => {
  // 重新初始化状态
  test.questionStatus = test.questionStatus.map(status => {
    // 如果状态文本是中文的，需要重新翻译
    const textMap: Record<string, {zh: string, en: string}> = {
      '未测试': {zh: '未测试', en: 'Not Tested'},
      '测试中...': {zh: '测试中...', en: 'Testing...'},
      '完成': {zh: '完成', en: 'Completed'},
      '完成 ✓': {zh: '完成 ✓', en: 'Completed ✓'},
      '测试失败': {zh: '测试失败', en: 'Test Failed'}
    }
    
    const statusText = status.text
    if (textMap[statusText]) {
      return {
        ...status,
        text: newLocale === 'zh' ? textMap[statusText].zh : textMap[statusText].en
      }
    }
    return status
  })
})

// 计算嵌入模型列表
const embedModelList = computed(() => {
  return (props.model.list || []).filter((m: any) => (m.name || '').toLowerCase().includes('embed'))
})

// 获取搜索模式翻译
const getSearchModeText = (mode: string) => {
  if (mode === t('按数量', 'By Count')) return t('按数量', 'By Count')
  if (mode === t('按匹配率', 'By Match Rate')) return t('按匹配率', 'By Match Rate')
  if (mode === t('按字符', 'By Characters')) return t('按字符', 'By Characters')
  return mode
}

// 添加问题行
const addQuestionRow = () => {
  test.questions.push('')
  test.answers.push('')
  test.questionStatus.push({text: t('未测试', 'Not Tested'), color: 'var(--borderColor)', icon: 'fa fa-circle-o'})
}

// 删除问题行
const removeQuestionRow = (index: number) => {
  if (test.questions.length > 1) {
    test.questions.splice(index, 1)
    test.answers.splice(index, 1)
    test.questionStatus.splice(index, 1)
    testResults.value.splice(index, 1)
  }
}

// 清空所有问题
const clearAllQuestions = () => {
  test.questions = ['']
  test.answers = ['']
  test.questionStatus = [{text: t('未测试', 'Not Tested'), color: 'var(--borderColor)', icon: 'fa fa-circle-o'}]
  testResults.value = []
}

// 从文件内容中提取摘要信息
function extractFileSummary(file: any) {
  if (!file.content || typeof file.content !== 'string') return
  
  // 尝试从YAML frontmatter中提取摘要
  const yamlMatch = file.content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/)
  if (yamlMatch) {
    const yamlContent = yamlMatch[1]
    // 查找摘要字段（支持中文"摘要"、英文"summary"、"abstract"）
    const summaryMatch = yamlContent.match(/^(摘要|summary|abstract):\s*(.+)$/mi)
    if (summaryMatch && summaryMatch[2]) {
      const summary = summaryMatch[2].trim()
      fileSummaries.value.set(file.path, {
        content: summary,
        vector: null // 将在使用时计算
      })
      return
    }
  }
  
  // 如果没有找到YAML摘要，尝试从文件属性中获取
  if (file.attributes && (file.attributes.summary || file.attributes.摘要 || file.attributes.abstract)) {
    const summary = file.attributes.summary || file.attributes.摘要 || file.attributes.abstract
    fileSummaries.value.set(file.path, {
      content: summary.toString().trim(),
      vector: null
    })
  }
}

// 获取文件摘要向量（如果未计算则进行计算）
async function getFileSummaryVector(filePath: string) {
  const summaryInfo = fileSummaries.value.get(filePath)
  if (!summaryInfo || !summaryInfo.content) return null
  
  // 如果已计算过向量，直接返回
  if (summaryInfo.vector) return summaryInfo.vector
  
  // 计算向量
  try {
    const ollama = new (await import('ollama/dist/browser.mjs')).Ollama({ host: props.model.url });
    const embedResponse = await ollama.embed({
      model: props.model.embed,
      input: summaryInfo.content,
      truncate: true,
      keep_alive: "1h"
    })
    
    if (embedResponse?.embeddings?.[0]) {
      summaryInfo.vector = embedResponse.embeddings[0]
      fileSummaries.value.set(filePath, summaryInfo)
      return summaryInfo.vector
    }
  } catch (error) {
    console.error('计算文件摘要向量失败:', error)
  }
  
  return null
}

// 初始化文件摘要信息
const initFileSummaries = () => {
  if (!props.files || props.files.length === 0) return
  
  fileSummaries.value.clear()
  
  // 从文件列表中提取摘要信息
  for (const file of props.files) {
    if (file.content) {
      extractFileSummary(file)
    }
  }
  
  // 从blocks中提取文件路径并关联文件摘要
  if (props.blocks && props.blocks.length > 0) {
    const uniqueFilePaths = new Set()
    for (const block of props.blocks) {
      if (block.filePath || block.path) {
        uniqueFilePaths.add(block.filePath || block.path)
      }
    }
    
    // 为每个文件路径查找对应的文件信息
    for (const filePath of uniqueFilePaths) {
      const file = props.files.find(f => f.path === filePath)
      if (file && file.content) {
        extractFileSummary(file)
      }
    }
  }
}

// 组件挂载时初始化文件摘要
onMounted(() => {
  initFileSummaries()
})

// 监听文件和blocks的变化
watch(() => [props.files, props.blocks], () => {
  initFileSummaries()
}, { deep: true })

// 单独测试某一行
const runSingleTest = async (index: number) => {
  const question = test.questions[index]?.trim()
  const answer = (test.answers && test.answers[index]) ? test.answers[index].trim() : ''
  
  if (!question) {
    emit('updateState', t('请输入问题', 'Please enter a question'))
    return
  }
  
  try {
    test.questionStatus[index] = {
      text: t('测试中...', 'Testing...'),
      color: '#FF9800',
      icon: 'fa fa-spinner fa-spin'
    }
    
    const searchNum = parseInt(test.searchNum.toString())
    
    // 临时保存原始设置
    const originalSearchMode = props.model.searchMode
    const originalSearchNum = props.model.searchNum
    
    // 设置为按数量搜索模式
    props.model.searchMode = t("按数量", "By Count")
    props.model.searchNum = searchNum
    
    // 执行测试
    await performTestChat(question, searchNum, index)
    
    // 恢复原始设置
    props.model.searchMode = originalSearchMode
    props.model.searchNum = originalSearchNum
    
    // 更新状态
    const result = testResults.value[index]
    const hasAnswerMatch = result?.slices?.some((s: any) => s.containsAnswer) || false
    const avgScore = result?.avgScore || 0
    
    let statusText = t('完成', 'Completed')
    let statusColor = '#4CAF50'
    let statusIcon = 'fa fa-check-circle'
    
    if (hasAnswerMatch) {
      statusText = t('完成 ✓', 'Completed ✓')
      statusColor = '#4CAF50'
    } else if (avgScore > 0.7) {
      statusText = t('完成', 'Completed')
      statusColor = '#4CAF50'
    } else if (avgScore > 0.4) {
      statusText = t('完成', 'Completed')
      statusColor = '#FF9800'
      statusIcon = 'fa fa-exclamation-circle'
    } else {
      statusText = t('完成', 'Completed')
      statusColor = '#f44336'
      statusIcon = 'fa fa-times-circle'
    }
    
    test.questionStatus[index] = {
      text: statusText,
      color: statusColor,
      icon: statusIcon,
      time: new Date().toLocaleTimeString()
    }
    
    lastUpdateTime.value = new Date().toLocaleTimeString()
    
  } catch (error) {
    console.error('单行测试失败:', error)
    
    let errorMessage = t('测试失败', 'Test Failed')
    if (error instanceof Error) errorMessage = error.message
    
    test.questionStatus[index] = {
      text: errorMessage,
      color: '#f44336',
      icon: 'fa fa-times-circle',
      time: new Date().toLocaleTimeString()
    }
    
    emit('updateState', t('测试失败: ', 'Test Failed: ') + errorMessage)
  }
}

// 执行测试聊天
const performTestChat = async (question: string, searchNum: number, index?: number) => {
  const answer = (index !== undefined && test.answers && test.answers[index]) ? test.answers[index] : '';
  
  try {
    const ollama = new (await import('ollama/dist/browser.mjs')).Ollama({ host: props.model.url })
    
    // 计算问题的向量
    const queryResponse = await ollama.embed({
      model: props.model.embed,
      input: question,
      truncate: true,
      keep_alive: "1h",
    })
    
    const queryEmbedding = queryResponse.embeddings?.[0]
    
    if (!queryEmbedding) {
      throw new Error(t("无法获取问题向量", "Failed to get question vector"))
    }
    
    // 计算每个块的相似度（使用与主模块相同的基于文件摘要的方法）
    const SUMMARY_WEIGHT = props.model.summaryWeight !== undefined ? props.model.summaryWeight : 0.7
    const SLICE_WEIGHT = 1 - SUMMARY_WEIGHT
    const USE_REVERSE_INFERENCE = props.model.useReverseInference || false
    const REVERSE_WEIGHT = props.model.reverseInferenceWeight || 0.3
    
    // 批量计算文件摘要向量
    const fileSummaryPromises = [] as any[]
    const filePaths = [] as string[]
    
    // 收集所有需要计算的文件路径
    for (let i = 0; i < props.blocks.length; i++) {
      const block = props.blocks[i]
      const filePath = block.filePath || block.path
      if (filePath && !filePaths.includes(filePath)) {
        filePaths.push(filePath)
      }
    }
    
    // 批量计算文件摘要向量
    for (const filePath of filePaths) {
      fileSummaryPromises.push(getFileSummaryVector(filePath))
    }
    
    const fileSummaryVectors = await Promise.all(fileSummaryPromises)
    const fileSummaryMap = new Map()
    for (let i = 0; i < filePaths.length; i++) {
      fileSummaryMap.set(filePaths[i], fileSummaryVectors[i])
    }
    
    // 为每个块计算相似度
    for (let i = 0; i < props.blocks.length; i++) {
      const b = props.blocks[i]
      let fileSummaryScore = 0
      let sliceScore = 0
      let reverseScore = 0
      
      // 计算文件摘要相似度
      const filePath = b.filePath || b.path
      const fileSummaryVector = fileSummaryMap.get(filePath)
      if (fileSummaryVector && queryEmbedding) {
        try { 
          fileSummaryScore = props.cosineSimilarity(queryEmbedding, fileSummaryVector) 
        } catch (e) { 
          fileSummaryScore = 0 
          console.warn(`文件摘要相似度计算失败: ${e}`)
        }
      }
      
      // 计算切片相似度
      if (b.A_vector && queryEmbedding) {
        try { 
          sliceScore = props.cosineSimilarity(queryEmbedding, b.A_vector) 
        } catch (e) { 
          sliceScore = 0 
          console.warn(`切片相似度计算失败: ${e}`)
        }
      }
      
      // 计算反推相似度
      if (USE_REVERSE_INFERENCE && b.Q_vector && b.Q_vector.length > 0 && queryEmbedding) {
        try { 
          reverseScore = props.cosineSimilarity(queryEmbedding, b.Q_vector) 
        } catch (e) { 
          reverseScore = 0 
          console.warn(`反推相似度计算失败: ${e}`)
        }
      }
      
      b.fileSummaryScore = fileSummaryScore
      b.sliceScore = sliceScore
      b.reverseScore = reverseScore
      
      // 综合评分计算（与主模块相同的逻辑）
      if (USE_REVERSE_INFERENCE && b.Q_vector && b.Q_vector.length > 0) {
        // 使用三元权重：文件摘要、切片、反推
        const remainingWeight = 1 - REVERSE_WEIGHT
        const adjustedSummaryWeight = SUMMARY_WEIGHT * remainingWeight
        const adjustedSliceWeight = SLICE_WEIGHT * remainingWeight
        
        b.p = (adjustedSummaryWeight * fileSummaryScore + 
              adjustedSliceWeight * sliceScore + 
              REVERSE_WEIGHT * reverseScore)
      } else {
        // 使用二元权重：文件摘要和切片
        b.p = SUMMARY_WEIGHT * fileSummaryScore + SLICE_WEIGHT * sliceScore
      }
      
      // 记录文件摘要内容（用于调试）
      const summaryInfo = fileSummaries.value.get(filePath)
      b.fileSummaryContent = summaryInfo?.content || ''
    }
    
    // 排序
    props.blocks.sort((a: any, b: any) => (b.p || 0) - (a.p || 0))
    
    // 收集结果
    const slices = []
    let totalScore = 0
    
    const numToTake = Math.min(searchNum, props.blocks.length)
    
    for (let i = 0; i < numToTake; i++) {
      const block = props.blocks[i]
      const sliceContent = block.A || ''
      const answerText = answer.trim()
      
      // 检查切片内容是否包含参考答案
      const containsAnswer = answerText && (
        sliceContent.includes(answerText) || 
        answerText.includes(sliceContent.substring(0, Math.min(50, sliceContent.length))) ||
        fuzzyMatch(sliceContent, answerText)
      )
      
      slices.push({
        label: block.label,
        content: sliceContent,
        score: block.p || 0,
        extension: block.extension,
        containsAnswer: containsAnswer,
        answerText: answerText,
        // 保存详细的相似度信息（包括文件摘要相似度）
        detailedScores: {
          fileSummaryScore: block.fileSummaryScore || 0,
          sliceScore: block.sliceScore || 0,
          reverseScore: block.reverseScore || 0,
          overallScore: block.p || 0,
          summaryWeight: SUMMARY_WEIGHT,
          sliceWeight: SLICE_WEIGHT,
          reverseWeight: USE_REVERSE_INFERENCE ? REVERSE_WEIGHT : 0,
          useReverseInference: USE_REVERSE_INFERENCE,
          fileSummaryContent: block.fileSummaryContent || ''
        }
      })
      totalScore += block.p || 0
    }
    
    const avgScore = slices.length > 0 ? totalScore / slices.length : 0
    
    // 保存结果
    if (index !== undefined) {
      testResults.value[index] = {
        question: question,
        answer: answer,
        slices: slices,
        avgScore: avgScore,
        timestamp: new Date().toISOString(),
        // 保存测试配置信息
        testConfig: {
          searchNum: searchNum,
          summaryWeight: SUMMARY_WEIGHT,
          sliceWeight: SLICE_WEIGHT,
          useReverseInference: USE_REVERSE_INFERENCE,
          reverseWeight: REVERSE_WEIGHT
        }
      }
    } else {
      testResults.value.push({
        question: question,
        answer: answer,
        slices: slices,
        avgScore: avgScore,
        timestamp: new Date().toISOString(),
        testConfig: {
          searchNum: searchNum,
          summaryWeight: SUMMARY_WEIGHT,
          sliceWeight: SLICE_WEIGHT,
          useReverseInference: USE_REVERSE_INFERENCE,
          reverseWeight: REVERSE_WEIGHT
        }
      })
    }
    
    return slices
    
  } catch (error) {
    console.error('测试聊天失败:', error)
    let errorMessage = t('测试聊天失败', 'Test chat failed')
    if (error instanceof Error) errorMessage = error.message
    throw new Error(errorMessage)
  }
}

// 模糊匹配函数
function fuzzyMatch(text: string, search: string, threshold = 0.7): boolean {
  if (!text || !search) return false
  
  const textLower = text.toLowerCase()
  const searchLower = search.toLowerCase()
  
  if (textLower.includes(searchLower) || searchLower.includes(textLower)) {
    return true
  }
  
  const words = searchLower.split(/\s+/).filter(w => w.length > 1)
  let matchedWords = 0
  
  for (const word of words) {
    if (textLower.includes(word)) {
      matchedWords++
    }
  }
  
  return words.length > 0 && (matchedWords / words.length) >= threshold
}

// 批量测试
const runBatchTest = async () => {
  const validQuestions = test.questions.filter((q, i) => q && q.trim())
  if (validQuestions.length === 0) {
    emit('updateState', t('请输入至少一个有效问题', 'Please enter at least one valid question'))
    return
  }
  
  test.isRunning = true
  test.progress = 0
  
  // 初始化文件摘要（确保最新）
  initFileSummaries()
  
  for (let i = 0; i < test.questions.length; i++) {
    const question = test.questions[i]?.trim()
    if (!question) {
      test.questionStatus[i] = {
        text: t('未测试', 'Not Tested'),
        color: 'var(--borderColor)',
        icon: 'fa fa-circle-o'
      }
      test.progress = ((i + 1) / test.questions.length) * 100
      continue
    }
    
    try {
      test.questionStatus[i] = {
        text: t('测试中...', 'Testing...'),
        color: '#FF9800',
        icon: 'fa fa-spinner fa-spin'
      }
      
      const searchNum = parseInt(test.searchNum.toString())
      
      const originalSearchMode = props.model.searchMode
      const originalSearchNum = props.model.searchNum
      
      props.model.searchMode = t("按数量", "By Count")
      props.model.searchNum = searchNum
      
      await performTestChat(question, searchNum, i)
      
      props.model.searchMode = originalSearchMode
      props.model.searchNum = originalSearchNum
      
      const result = testResults.value[i]
      const hasAnswerMatch = result?.slices?.some((s: any) => s.containsAnswer) || false
      const avgScore = result?.avgScore || 0
      
      let statusText = t('完成', 'Completed')
      let statusColor = '#4CAF50'
      let statusIcon = 'fa fa-check-circle'
      
      if (hasAnswerMatch) {
        statusText = t('完成 ✓', 'Completed ✓')
        statusColor = '#4CAF50'
      } else if (avgScore > 0.7) {
        statusText = t('完成', 'Completed')
        statusColor = '#4CAF50'
      } else if (avgScore > 0.4) {
        statusText = t('完成', 'Completed')
        statusColor = '#FF9800'
        statusIcon = 'fa fa-exclamation-circle'
      } else {
        statusText = t('完成', 'Completed')
        statusColor = '#f44336'
        statusIcon = 'fa fa-times-circle'
      }
      
      test.questionStatus[i] = {
        text: statusText,
        color: statusColor,
        icon: statusIcon,
        time: new Date().toLocaleTimeString()
      }
      
    } catch (error) {
      console.error(t('第 ', 'Row ') + (i + 1) + t(' 行测试失败:', ' test failed:'), error)
      
      let errorMessage = t('测试失败', 'Test Failed')
      if (error instanceof Error) errorMessage = error.message
      
      test.questionStatus[i] = {
        text: errorMessage,
        color: '#f44336',
        icon: 'fa fa-times-circle',
        time: new Date().toLocaleTimeString()
      }
    }
    
    test.progress = ((i + 1) / test.questions.length) * 100
  }
  
  test.isRunning = false
  lastUpdateTime.value = new Date().toLocaleTimeString()
  
  const answerMatches = testResults.value.reduce((count:any, result:any) => {
    if (!result || !result.slices) return count
    return count + result.slices.filter((s: any) => s.containsAnswer).length
  }, 0)
  
  emit('updateState', t('批量测试完成', 'Batch test completed') + 
       t('，共处理 ', ', processed ') + testResults.value.filter(Boolean).length + 
       t(' 个问题，', ' questions, ') + answerMatches + 
       t(' 个切片包含参考答案', ' slices contain reference answers'))
}

// 定义发射事件
const emit = defineEmits<{
  updateState: [state: string]
}>()

// 辅助函数：根据分数获取颜色
const getScoreColor = (score: number) => {
  if (score > 0.7) return '#4CAF50'
  if (score > 0.5) return '#FF9800'
  return '#f44336'
}

// 辅助函数：获取单元格的CSS类
const getScoreClass = (rowIndex: number, sliceIndex: number) => {
  const result = testResults.value[rowIndex]
  if (!result || !result.slices || !result.slices[sliceIndex]) return ''
  
  const slice = result.slices[sliceIndex]
  const score = slice.detailedScores?.overallScore || slice.score
  
  if (slice.containsAnswer) {
    return 'answer-match'
  }
  
  if (score > 0.7) return 'high-score'
  if (score > 0.5) return 'medium-score'
  return 'low-score'
}

// 格式化百分比显示
const formatPercent = (value: number) => {
  return (value * 100).toFixed(1) + '%'
}

// 下拉选项文本
const searchNumOptions = computed(() => [
  { value: '1', text: t('1个切片', '1 slice') },
  { value: '3', text: t('3个切片', '3 slices') },
  { value: '5', text: t('5个切片', '5 slices') },
  { value: '10', text: t('10个切片', '10 slices') }
])
</script>

<template>
  <div style="display:flex;gap:5px;padding:5px;height:100%;width:100%;box-sizing:border-box;align-items:stretch;flex-direction:column;">
    <div style="display:flex;gap:8px;align-items:center;width: 100%;">
      <select v-model="test.searchNum" style="flex:1;height:32px;margin:0;padding:0 5px;width:100px;">
        <option v-for="option in searchNumOptions" :key="option.value" :value="option.value">
          {{ option.text }}
        </option>
      </select>
      <div class="button" @click="runBatchTest" style="margin:0;" :disabled="test.isRunning">
        <i class="fa fa-play"></i> {{ test.isRunning ? t('测试中...', 'Testing...') : t('批量测试', 'Batch Test') }}
      </div>
      <div class="button" @click="addQuestionRow" style="margin:0;" :title="t('添加测试行', 'Add Test Row')">
        <i class="fa fa-plus"></i>
      </div>
      <div class="button" @click="clearAllQuestions" style="margin:0;" :title="t('清空所有', 'Clear All')">
        <i class="fa fa-trash"></i>
      </div>
      <div style="display:flex;gap:4px;font-size:11px;">
        <span style="color:#4CAF50;"><i class="fa fa-square"></i> >70%</span>
        <span style="color:#FF9800;"><i class="fa fa-square"></i> 50-70%</span>
        <span style="color:#f44336;"><i class="fa fa-square"></i> <50%</span>
      </div>
      <div v-if="test.isRunning" style="flex:1;display:flex;align-items:center;gap:8px;">
        <div style="width:100%;height:6px;background-color:var(--borderColor);border-radius:3px;overflow:hidden;">
          <div :style="{width: test.progress + '%', height:'100%', backgroundColor:'#4CAF50', transition:'width 0.3s'}"></div>
        </div>
        <span style="font-size:12px;min-width:40px;">{{ test.progress.toFixed(0) }}%</span>
      </div>
      <span v-else style="margin-left:auto;font-size:12px;color:var(--borderColor);">
        {{ testResults.filter(Boolean).length }} / {{ test.questions.length }}
      </span>
    </div>
    
    <!-- 主表格区域 -->
    <div style="flex:1;border:1px solid var(--borderColor);border-radius:5px;padding:8px;display:flex;flex-direction:column;overflow:hidden;">
      
      <div class="scoll" style="flex:1;overflow:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead style="position:sticky;top:0;background-color:var(--menuColor);">
            <tr>
              <th style="padding:8px;border:1px solid var(--borderColor);text-align:left;min-width:100px;">
                <div style="display:flex;align-items:center;gap:4px;">
                  <span>{{ t('测试问题', 'Test Question') }}</span>
                </div>
              </th>
              <th style="padding:8px;border:1px solid var(--borderColor);text-align:left;min-width:100px;">
                <div style="display:flex;align-items:center;gap:4px;">
                  <span>{{ t('参考答案', 'Reference Answer') }}</span>
                </div>
              </th>
              <th v-for="n in parseInt(test.searchNum)" :key="n" style="padding:8px;border:1px solid var(--borderColor);text-align:left;">
                <div style="font-weight:bold;">{{ t('切片 ', 'Slice ') }}{{ n }}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(question, qIndex) in test.questions" :key="'question-' + qIndex" 
                :style="{backgroundColor: qIndex % 2 === 0 ? 'var(--backgroundColor)' : 'var(--menuColor)'}">
              <!-- 问题输入单元格 -->
              <td style="padding:8px;border:1px solid var(--borderColor);vertical-align:top;">
                <div style="display:flex;align-items:flex-start;gap:4px;">
                  <textarea class="scoll"
                    v-model="test.questions[qIndex]" 
                    style="flex:1;min-height:60px;padding:4px;font-size:12px;resize:vertical;border:1px solid var(--borderColor);border-radius:3px;"
                    :placeholder="t('输入问题 ', 'Enter question ') + (qIndex + 1)"
                    @keydown.ctrl.enter="runSingleTest(qIndex)"
                  ></textarea>
                </div>
                <div v-if="test.questionStatus[qIndex]" style="margin-top:4px;font-size:10px;display:flex;align-items:center;gap:4px;">
                  <span @click="runSingleTest(qIndex)" :disabled="!test.questions[qIndex]?.trim() || test.isRunning" :title="test.isRunning ? t('正在测试中...', 'Testing in progress...') : t('单独测试此行 (Ctrl+Enter)', 'Test this row individually (Ctrl+Enter)')">
                    <i class="fa fa-play"></i>
                  </span>
                  <span @click="removeQuestionRow(qIndex)" :disabled="test.isRunning" :title="test.questions.length > 1 ? t('删除此行', 'Delete this row') : t('至少保留一行', 'Keep at least one row')">
                    <i class="fa fa-trash"></i>
                  </span>
                </div>
              </td>
              <td style="padding:8px;border:1px solid var(--borderColor);vertical-align:top;">
                <textarea class="scoll"
                  v-model="test.answers[qIndex]" 
                  style="flex:1;min-height:60px;padding:4px;font-size:12px;resize:vertical;border:1px solid var(--borderColor);border-radius:3px;width:calc(100% - 12px);"
                  :placeholder="t('输入参考答案 ', 'Enter reference answer ') + (qIndex + 1)"
                ></textarea>
                <div v-if="test.questionStatus[qIndex]" style="margin-top:4px;font-size:10px;display:flex;align-items:center;gap:4px;">
                  <span :style="{color: test.questionStatus[qIndex].color}">
                    <i :class="test.questionStatus[qIndex].icon"></i>
                    {{ test.questionStatus[qIndex].text }}
                  </span>
                  <span v-if="test.questionStatus[qIndex].time" style="color:var(--borderColor);font-size:9px;">
                    {{ test.questionStatus[qIndex].time }}
                  </span>
                </div>
              </td>
              <td v-for="n in parseInt(test.searchNum)" :key="'result-' + qIndex + '-' + n" 
                  style="padding:8px;border:1px solid var(--borderColor);vertical-align:top;position:relative;"
                  :class="getScoreClass(qIndex, n-1)">
                <template v-if="testResults[qIndex] && testResults[qIndex].slices && testResults[qIndex].slices[n-1]">
                  <div style="max-height:80px;max-width:150px;overflow:auto;border:1px solid var(--borderColor);border-radius:3px;padding:4px;background-color:var(--backgroundColor);">
                    <block_md 
                      :content="testResults[qIndex].slices[n-1].content" 
                      :fontSize="'10px'"
                      :maxHeight="'60px'"
                    />
                  </div>
                  <div style="font-size:10px;color:var(--borderColor);display:flex;align-items:center;overflow:hidden;">
                    <i :class="store.icon(testResults[qIndex].slices[n-1].extension)"></i>&nbsp;
                    <span class="ellipsis" :title="testResults[qIndex].slices[n-1].label" 
                          style="white-space: nowrap;overflow: hidden;text-overflow: ellipsis;flex:1;width:60px">
                      {{ testResults[qIndex].slices[n-1].label }}
                    </span>
                  </div>
                  
                  <!-- 详细相似度信息 -->
                  <div v-if="testResults[qIndex]?.slices[n-1]?.detailedScores" >
                    <div style="display:flex;font-size:9px;flex-direction:row ;text-align: center;width:100%">
                        <div style="color:#2196F3;font-weight:bold;" :title="t('切片', 'Slice')">
                          {{ formatPercent(testResults[qIndex].slices[n-1].detailedScores.sliceScore) }}
                        </div>
                        /
                        <div style="color:#4CAF50;font-weight:bold;" :title="t('文件摘要', 'File Summary')">
                          {{ formatPercent(testResults[qIndex].slices[n-1].detailedScores.fileSummaryScore) }}
                        </div>
                        /
                        <div style="color:#9C27B0;font-weight:bold;" :title="t('反推', 'Reverse')">
                          {{ formatPercent(testResults[qIndex].slices[n-1].detailedScores.reverseScore) }}
                        </div>
                        <div style="flex:1;font-weight:bold;text-align: right;" :title="t('总体', 'Overall')">
                          {{ formatPercent(testResults[qIndex].slices[n-1].detailedScores.overallScore) }}
                        </div>
                    </div>
                  </div>
                  
                  <!-- 答案匹配标记 -->
                  <div v-if="testResults[qIndex].slices[n-1].containsAnswer" 
                      style="position:absolute;bottom:0px;left:5px;z-index:2;">
                    <i class="fa fa-check-circle" style="color:#4CAF50;font-size:14px;" 
                    :title="t('包含参考答案: ', 'Contains reference answer: ') + (testResults[qIndex].slices[n-1].answerText || '')"></i>
                  </div>
                </template>
                <div v-else style="color:var(--borderColor);font-size:11px;text-align:center;padding:35px 0;">
                  <i class="fa fa-hourglass-o"></i>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        
        <!-- 空状态 -->
        <div v-if="test.questions.length === 0" style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:200px;color:var(--borderColor);padding:20px;">
          <i class="fa fa-table" style="font-size:48px;margin-bottom:16px;"></i>
          <div style="margin-bottom:8px;">{{ t('暂无测试问题', 'No test questions yet') }}</div>
          <div class="button" @click="addQuestionRow">
            <i class="fa fa-plus"></i> {{ t('添加第一个测试问题', 'Add first test question') }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
    /* 测试视图特定的样式 */
    .answer-match {
    background-color: rgba(76, 175, 80, 0.1) !important;
    border-left: 3px solid #4CAF50 !important;
    }

    .answer-match:hover {
    background-color: rgba(76, 175, 80, 0.2) !important;
    }

    .high-score {
    background-color: rgba(76, 175, 80, 0.05);
    }

    .medium-score {
    background-color: rgba(255, 152, 0, 0.05);
    }

    .low-score {
    background-color: rgba(244, 67, 54, 0.05);
    }

    .scoll {
    overflow: auto;
    }

    .ellipsis {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    }
</style>