<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted } from 'vue'
import block_md from '../block_md.vue'
import * as XLSX from 'xlsx'
import {usestore} from '../../store'
const store=usestore()

// 定义组件接口
interface Props {
  store: any
  blocks: any[]
  model: any
  getModel: () => Promise<void>
  cosineSimilarity: (vecA: number[], vecB: number[]) => number
  files?: any[]
  // 本体增强相关
  globalEntities?: Map<string, any>
  getCurrentOntologyContext?: () => { entities: any[], relations: any[] }
  chatWithOntology?: (prompt: string) => Promise<any>
  // PCA/MDS 相关方法
  computePCA?: (vectors: number[][]) => number[][]
  computeMDS?: (vectors: number[][], iterations: number, epsilon: number) => number[][]
}

// 检索算法类型
type SearchAlgorithm = 'cosine' | 'pca' | 'mds' | 'ontology_max' | 'ontology_pow'

// 测试结果类型
interface TestResult {
  question: string
  answer: string
  algorithm: SearchAlgorithm
  slices: Array<{
    label: string
    content: string
    score: number
    extension: string
    containsAnswer: boolean
    answerText: string
    rank: number
    detailedScores: {
      fileSummaryScore: number
      sliceScore: number
      reverseScore: number
      overallScore: number
      pcaScore?: number
      mdsScore?: number
      entityBoostMultiplier?: number
      matchedEntities?: string[]
    }
  }>
  avgScore: number
  timestamp: string
  testConfig: {
    searchNum: number
    summaryWeight: number
    sliceWeight: number
    useReverseInference: boolean
    reverseWeight: number
    pcaComponents?: number
    mdsIterations?: number
    entityBoostWeight?: number
  }
}

// 位次分析结果类型
interface RankAnalysisResult {
  question: string
  answer: string
  algorithm: SearchAlgorithm
  ranks: string  // 位次，多个用逗号分隔
  firstRank: number
  bestRank: number
  foundCount: number
  timestamp: string
}

const props = defineProps<Props>()

// 测试相关状态
const test = reactive({
  questions: [''] as string[],
  answers: [''] as string[],
  searchNum: 5 as any,
  isRunning: false,
  progress: 0,
  currentAlgorithm: 'cosine' as SearchAlgorithm,
  questionStatus: [] as Array<{text: string, color: string, icon: string, time?: string, algorithm?: SearchAlgorithm}>
})

const testResults = ref<TestResult[]>([])
const rankAnalysisResults = ref<RankAnalysisResult[]>([])
const lastUpdateTime = ref('')
const isImporting = ref(false)
const isExporting = ref(false)
const activeTab = ref('test') // 'test' 或 'rank'

// 算法选项
const algorithmOptions = [
  { value: 'cosine', label: store.locales=='zh' ? '余弦相似度' : 'Cosine Similarity', icon: 'fa fa-line-chart' },
  { value: 'pca', label: store.locales=='zh' ? 'PCA降维检索' : 'PCA Dimension Reduction', icon: 'fa fa-area-chart' },
  { value: 'mds', label: store.locales=='zh' ? 'MDS降维检索' : 'MDS Dimension Reduction', icon: 'fa fa-braille' },
  { value: 'ontology_max', label: store.locales=='zh' ? '本体增强(单乘级)' : 'Ontology (Max Boost)', icon: 'fa fa-github-alt' },
  { value: 'ontology_pow', label: store.locales=='zh' ? '本体增强(指数乘积)' : 'Ontology (Exponential)', icon: 'fa fa-github-alt' }
]

// 文件摘要信息存储
const fileSummaries = ref(new Map()) as any

// 监听语言切换
watch(() => props.store?.locales, (newLocale) => {
  test.questionStatus = test.questionStatus.map(status => {
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

// 从文件内容中提取摘要信息
function extractFileSummary(file: any) {
  if (!file.content || typeof file.content !== 'string') return
  
  const yamlMatch = file.content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/)
  if (yamlMatch) {
    const yamlContent = yamlMatch[1]
    const summaryMatch = yamlContent.match(/^(摘要|summary|abstract):\s*(.+)$/mi)
    if (summaryMatch && summaryMatch[2]) {
      const summary = summaryMatch[2].trim()
      fileSummaries.value.set(file.path, {
        content: summary,
        vector: null
      })
      return
    }
  }
  
  if (file.attributes && (file.attributes.summary || file.attributes.摘要 || file.attributes.abstract)) {
    const summary = file.attributes.summary || file.attributes.摘要 || file.attributes.abstract
    fileSummaries.value.set(file.path, {
      content: summary.toString().trim(),
      vector: null
    })
  }
}

// 获取文件摘要向量
async function getFileSummaryVector(filePath: string) {
  const summaryInfo = fileSummaries.value.get(filePath)
  if (!summaryInfo || !summaryInfo.content) return null
  
  if (summaryInfo.vector) return summaryInfo.vector
  
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

// 理解查询中的本体实体
async function understandQueryWithOntology(query: string): Promise<{ matchedEntities: Array<{ name: string }> }> {
  if (!props.globalEntities || props.globalEntities.size === 0) {
    return { matchedEntities: [] }
  }
  
  const matchedEntities: Array<{ name: string }> = []
  
  for (const [name, entity] of props.globalEntities.entries()) {
    if (query.includes(entity.name) || entity.name.includes(query)) {
      matchedEntities.push({ name: entity.name })
    }
  }
  
  if (matchedEntities.length === 0 && props.getCurrentOntologyContext) {
    try {
      const ollama = new (await import('ollama/dist/browser.mjs')).Ollama({ host: props.model.url });
      const entityNames = Array.from(props.globalEntities.keys())
      
      const prompt = `用户查询: "${query}"
      
已知实体列表: ${entityNames.join(', ')}

请找出查询中可能关联的实体，返回JSON格式：
{
  "matchedEntities": ["实体1", "实体2"]
}`

      const response = await ollama.chat({
        model: props.model.process,
        messages: [{ role: 'user', content: prompt }],
        stream: false
      })
      const jsonMatch = response.message.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0])
        for (const name of (result.matchedEntities || [])) {
          const key = name.toLowerCase()
          const entity = props.globalEntities.get(key)
          if (entity) {
            matchedEntities.push({ name: entity.name })
          }
        }
      }
    } catch (error) {
      console.error('AI查询理解失败:', error)
    }
  }
  
  return { matchedEntities }
}

// 执行检索（支持多种算法）
async function performSearch(question: string, searchNum: number, algorithm: SearchAlgorithm, answer?: string): Promise<{
  slices: TestResult['slices'],
  avgScore: number
}> {
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
    throw new Error(store.locales=='zh' ? "无法获取问题向量" : "Failed to get question vector")
  }
  
  // 配置参数
  const SUMMARY_WEIGHT = props.model.summaryWeight !== undefined ? props.model.summaryWeight : 0.7
  const SLICE_WEIGHT = 1 - SUMMARY_WEIGHT
  const USE_REVERSE_INFERENCE = props.model.useReverseInference || false
  const REVERSE_WEIGHT = props.model.reverseInferenceWeight || 0.3
  
  // 判断是否为本体增强算法
  const isOntologyMax = algorithm === 'ontology_max'
  const isOntologyPow = algorithm === 'ontology_pow'
  const isOntology = isOntologyMax || isOntologyPow
  
  // 本体增强：获取查询中匹配的实体
  let matchedEntities: Array<{ name: string }> = []
  if (isOntology && props.globalEntities) {
    const ontologyContext = await understandQueryWithOntology(question)
    matchedEntities = ontologyContext.matchedEntities
    if (matchedEntities.length > 0) {
      console.log(`[本体检索] 查询匹配到 ${matchedEntities.length} 个实体:`, matchedEntities.map(e => e.name).join(', '))
    }
  }
  
  // 批量计算文件摘要向量
  const fileSummaryPromises = [] as any[]
  const filePaths = [] as string[]
  
  for (let i = 0; i < props.blocks.length; i++) {
    const block = props.blocks[i]
    const filePath = block.filePath || block.path
    if (filePath && !filePaths.includes(filePath)) {
      filePaths.push(filePath)
    }
  }
  
  for (const filePath of filePaths) {
    fileSummaryPromises.push(getFileSummaryVector(filePath))
  }
  
  const fileSummaryVectors = await Promise.all(fileSummaryPromises)
  const fileSummaryMap = new Map()
  for (let i = 0; i < filePaths.length; i++) {
    fileSummaryMap.set(filePaths[i], fileSummaryVectors[i])
  }
  
  // 收集所有块向量用于PCA/MDS
  const blockVectors = props.blocks.map((b: any) => b.A_vector)
  const hasValidVectors = blockVectors.some(v => v && v.length > 0)
  
  // 预计算PCA/MDS分数（如果需要）
  let pcaScores: number[] = []
  let mdsScores: number[] = []
  
  if (algorithm === 'pca' && hasValidVectors && queryEmbedding && props.computePCA) {
    try {
      const allVectors = [...blockVectors, queryEmbedding]
      const pcaPoints = props.computePCA(allVectors)
      const queryPoint = pcaPoints[pcaPoints.length - 1]
      pcaScores = blockVectors.map((_, idx) => {
        const point = pcaPoints[idx]
        const dx = point[0] - queryPoint[0]
        const dy = point[1] - queryPoint[1]
        const distance = Math.sqrt(dx * dx + dy * dy)
        return 1 / (1 + distance)
      })
      const maxScore = Math.max(...pcaScores, 1)
      pcaScores = pcaScores.map(s => s / maxScore)
    } catch (error) {
      console.error('PCA计算失败:', error)
      pcaScores = blockVectors.map(() => 0)
    }
  }
  
  if (algorithm === 'mds' && hasValidVectors && queryEmbedding && props.computeMDS) {
    try {
      const allVectors = [...blockVectors, queryEmbedding]
      const mdsIterations = props.model.mdsIterations || 50
      const mdsEpsilon = props.model.mdsEpsilon || 0.1
      const mdsPoints = props.computeMDS(allVectors, mdsIterations, mdsEpsilon)
      const queryPoint = mdsPoints[mdsPoints.length - 1]
      mdsScores = blockVectors.map((_, idx) => {
        const point = mdsPoints[idx]
        const dx = point[0] - queryPoint[0]
        const dy = point[1] - queryPoint[1]
        const distance = Math.sqrt(dx * dx + dy * dy)
        return 1 / (1 + distance)
      })
      const maxScore = Math.max(...mdsScores, 1)
      mdsScores = mdsScores.map(s => s / maxScore)
    } catch (error) {
      console.error('MDS计算失败:', error)
      mdsScores = blockVectors.map(() => 0)
    }
  }
  
  // 为每个块计算相似度
  for (let i = 0; i < props.blocks.length; i++) {
    const b = props.blocks[i]
    let fileSummaryScore = 0
    let sliceScore = 0
    let reverseScore = 0
    
    const filePath = b.filePath || b.path
    const fileSummaryVector = fileSummaryMap.get(filePath)
    if (fileSummaryVector && queryEmbedding) {
      try { fileSummaryScore = props.cosineSimilarity(queryEmbedding, fileSummaryVector) } 
      catch (e) { fileSummaryScore = 0 }
    }
    
    if (b.A_vector && queryEmbedding) {
      try { sliceScore = props.cosineSimilarity(queryEmbedding, b.A_vector) } 
      catch (e) { sliceScore = 0 }
    }
    
    if (USE_REVERSE_INFERENCE && b.Q_vector && b.Q_vector.length > 0 && queryEmbedding) {
      try { reverseScore = props.cosineSimilarity(queryEmbedding, b.Q_vector) } 
      catch (e) { reverseScore = 0 }
    }
    
    // 余弦相似度综合分
    let cosineScore = 0
    if (USE_REVERSE_INFERENCE && b.Q_vector && b.Q_vector.length > 0) {
      const remainingWeight = 1 - REVERSE_WEIGHT
      const adjustedSummaryWeight = SUMMARY_WEIGHT * remainingWeight
      const adjustedSliceWeight = SLICE_WEIGHT * remainingWeight
      cosineScore = adjustedSummaryWeight * fileSummaryScore + adjustedSliceWeight * sliceScore + REVERSE_WEIGHT * reverseScore
    } else {
      cosineScore = SUMMARY_WEIGHT * fileSummaryScore + SLICE_WEIGHT * sliceScore
    }
    
    // 根据算法计算最终分数
    let finalScore = 0
    let entityBoostMultiplier = 1
    let matchedEntityNames: string[] = []
    
    if (algorithm === 'pca') {
      finalScore = pcaScores[i] || cosineScore
    } else if (algorithm === 'mds') {
      finalScore = mdsScores[i] || cosineScore
    } else if (isOntology) {
      const entityBoostValue = props.model.entityBoostWeight || 1.5
      
      // 统计匹配到的实体数量（去重）
      let matchedCount = 0
      
      for (const entity of matchedEntities) {
        const entityName = entity.name
        if ((b.A && b.A.includes(entityName)) || 
            (b.Q && b.Q.includes(entityName))) {
          if (!matchedEntityNames.includes(entityName)) {
            matchedEntityNames.push(entityName)
            matchedCount++
          }
        }
      }
      
      if (matchedCount > 0) {
        if (isOntologyMax) {
          // 单乘级：取最大值（匹配多个实体时乘数不变）
          entityBoostMultiplier = entityBoostValue
          finalScore = cosineScore * entityBoostMultiplier
        } else {
          // 指数乘积：entityBoostValue ^ matchedCount
          entityBoostMultiplier = Math.pow(entityBoostValue, matchedCount)
          finalScore = cosineScore * entityBoostMultiplier
        }
        
        console.log(`[本体增强-${isOntologyMax ? '单乘级' : '指数乘积'}] 切片匹配到 ${matchedCount} 个实体 [${matchedEntityNames.join(', ')}], ` +
                    `乘数=${entityBoostMultiplier.toFixed(4)}, 原分=${cosineScore.toFixed(4)}, 新分=${finalScore.toFixed(4)}`)
      } else {
        finalScore = cosineScore
      }
    } else {
      finalScore = cosineScore
    }
    
    b.p = finalScore
    b.fileSummaryScore = fileSummaryScore
    b.sliceScore = sliceScore
    b.reverseScore = reverseScore
    b.entityBoostMultiplier = entityBoostMultiplier
    b.matchedEntities = matchedEntityNames
    b.pcaScore = pcaScores[i]
    b.mdsScore = mdsScores[i]
  }
  
  // 排序
  props.blocks.sort((a: any, b: any) => (b.p || 0) - (a.p || 0))
  
  // 收集结果
  const slices = []
  let totalScore = 0
  const numToTake = Math.min(searchNum, props.blocks.length)
  const answerText = answer?.trim() || ''
  
  for (let i = 0; i < numToTake; i++) {
    const block = props.blocks[i]
    const sliceContent = block.A || ''
    
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
      rank: i + 1,
      detailedScores: {
        fileSummaryScore: block.fileSummaryScore || 0,
        sliceScore: block.sliceScore || 0,
        reverseScore: block.reverseScore || 0,
        overallScore: block.p || 0,
        pcaScore: block.pcaScore,
        mdsScore: block.mdsScore,
        entityBoostMultiplier: block.entityBoostMultiplier,
        matchedEntities: block.matchedEntities
      }
    })
    totalScore += block.p || 0
  }
  
  const avgScore = slices.length > 0 ? totalScore / slices.length : 0
  
  return { slices, avgScore }
}

// 执行测试聊天（支持算法选择）
const performTestChat = async (question: string, searchNum: number, algorithm: SearchAlgorithm, index?: number, answer?: string) => {
  try {
    const { slices, avgScore } = await performSearch(question, searchNum, algorithm, answer)
    
    const result: TestResult = {
      question: question,
      answer: answer || '',
      algorithm: algorithm,
      slices: slices,
      avgScore: avgScore,
      timestamp: new Date().toISOString(),
      testConfig: {
        searchNum: searchNum,
        summaryWeight: props.model.summaryWeight || 0.7,
        sliceWeight: (1 - (props.model.summaryWeight || 0.7)),
        useReverseInference: props.model.useReverseInference || false,
        reverseWeight: props.model.reverseInferenceWeight || 0.3,
        pcaComponents: props.model.pcaComponents || 2,
        mdsIterations: props.model.mdsIterations || 50,
        entityBoostWeight: props.model.entityBoostWeight
      }
    }
    
    if (index !== undefined) {
      testResults.value[index] = result
    } else {
      testResults.value.push(result)
    }
    
    // 生成位次分析
    generateRankAnalysis(result)
    
    return slices
  } catch (error) {
    console.error('测试聊天失败:', error)
    throw error
  }
}

// 生成位次分析
const generateRankAnalysis = (result: TestResult) => {
  const answerText = result.answer?.trim()
  if (!answerText) return
  
  // 找出所有包含答案的切片位次
  const answerRanks: number[] = []
  for (const slice of result.slices) {
    if (slice.containsAnswer) {
      answerRanks.push(slice.rank)
    }
  }
  
  const rankAnalysis: RankAnalysisResult = {
    question: result.question,
    answer: result.answer,
    algorithm: result.algorithm,
    ranks: answerRanks.length > 0 ? answerRanks.join(',') : '未找到',
    firstRank: answerRanks.length > 0 ? Math.min(...answerRanks) : -1,
    bestRank: answerRanks.length > 0 ? Math.min(...answerRanks) : -1,
    foundCount: answerRanks.length,
    timestamp: result.timestamp
  }
  
  // 检查是否已存在相同问题和算法的记录
  const existingIndex = rankAnalysisResults.value.findIndex(
    r => r.question === result.question && r.algorithm === result.algorithm
  )
  
  if (existingIndex !== -1) {
    rankAnalysisResults.value[existingIndex] = rankAnalysis
  } else {
    rankAnalysisResults.value.push(rankAnalysis)
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

// 单独测试某一行
const runSingleTest = async (index: number) => {
  const question = test.questions[index]?.trim()
  const answer = test.answers && test.answers[index] ? test.answers[index].trim() : ''
  
  if (!question) {
    emit('updateState', store.locales=='zh' ? '请输入问题' : 'Please enter a question')
    return
  }
  
  try {
    test.questionStatus[index] = {
      text: store.locales=='zh' ? '测试中...' : 'Testing...',
      color: '#FF9800',
      icon: 'fa fa-spinner fa-spin',
      algorithm: test.currentAlgorithm
    }
    
    const searchNum = parseInt(test.searchNum.toString())
    
    await performTestChat(question, searchNum, test.currentAlgorithm, index, answer)
    
    const result = testResults.value[index]
    const hasAnswerMatch = result?.slices?.some((s: any) => s.containsAnswer) || false
    const avgScore = result?.avgScore || 0
    
    let statusText = store.locales=='zh' ? '完成' : 'Completed'
    let statusColor = '#4CAF50'
    let statusIcon = 'fa fa-check-circle'
    
    if (hasAnswerMatch) {
      statusText = store.locales=='zh' ? '完成 ✓' : 'Completed ✓'
      statusColor = '#4CAF50'
    } else if (avgScore > 0.7) {
      statusText = store.locales=='zh' ? '完成' : 'Completed'
      statusColor = '#4CAF50'
    } else if (avgScore > 0.4) {
      statusText = store.locales=='zh' ? '完成' : 'Completed'
      statusColor = '#FF9800'
      statusIcon = 'fa fa-exclamation-circle'
    } else {
      statusText = store.locales=='zh' ? '完成' : 'Completed'
      statusColor = '#f44336'
      statusIcon = 'fa fa-times-circle'
    }
    
    test.questionStatus[index] = {
      text: statusText,
      color: statusColor,
      icon: statusIcon,
      time: new Date().toLocaleTimeString(),
      algorithm: test.currentAlgorithm
    }
    
    lastUpdateTime.value = new Date().toLocaleTimeString()
    
  } catch (error) {
    console.error('单行测试失败:', error)
    
    test.questionStatus[index] = {
      text: store.locales=='zh' ? '测试失败' : 'Test Failed',
      color: '#f44336',
      icon: 'fa fa-times-circle',
      time: new Date().toLocaleTimeString(),
      algorithm: test.currentAlgorithm
    }
    
    emit('updateState', store.locales=='zh' ? '测试失败: ' : 'Test Failed: ') + (error instanceof Error ? error.message : String(error))
  }
}

// 批量测试（使用当前算法）
const runBatchTest = async () => {
  const validQuestions = test.questions.filter((q, i) => q && q.trim())
  if (validQuestions.length === 0) {
    emit('updateState', store.locales=='zh' ? '请输入至少一个有效问题' : 'Please enter at least one valid question')
    return
  }
  
  test.isRunning = true
  test.progress = 0
  
  initFileSummaries()
  
  // 清空当前算法的位次分析记录
  rankAnalysisResults.value = rankAnalysisResults.value.filter(
    r => r.algorithm !== test.currentAlgorithm
  )
  
  for (let i = 0; i < test.questions.length; i++) {
    const question = test.questions[i]?.trim()
    const answer = test.answers && test.answers[i] ? test.answers[i].trim() : ''
    
    if (!question) {
      test.questionStatus[i] = {
        text: store.locales=='zh' ? '未测试' : 'Not Tested',
        color: 'var(--borderColor)',
        icon: 'fa fa-circle-o'
      }
      test.progress = ((i + 1) / test.questions.length) * 100
      continue
    }
    
    try {
      test.questionStatus[i] = {
        text: store.locales=='zh' ? '测试中...' : 'Testing...',
        color: '#FF9800',
        icon: 'fa fa-spinner fa-spin',
        algorithm: test.currentAlgorithm
      }
      
      const searchNum = parseInt(test.searchNum.toString())
      
      await performTestChat(question, searchNum, test.currentAlgorithm, i, answer)
      
      const result = testResults.value[i]
      const hasAnswerMatch = result?.slices?.some((s: any) => s.containsAnswer) || false
      const avgScore = result?.avgScore || 0
      
      let statusText = store.locales=='zh' ? '完成' : 'Completed'
      let statusColor = '#4CAF50'
      let statusIcon = 'fa fa-check-circle'
      
      if (hasAnswerMatch) {
        statusText = store.locales=='zh' ? '完成 ✓' : 'Completed ✓'
        statusColor = '#4CAF50'
      } else if (avgScore > 0.7) {
        statusText = store.locales=='zh' ? '完成' : 'Completed'
        statusColor = '#4CAF50'
      } else if (avgScore > 0.4) {
        statusText = store.locales=='zh' ? '完成' : 'Completed'
        statusColor = '#FF9800'
        statusIcon = 'fa fa-exclamation-circle'
      } else {
        statusText = store.locales=='zh' ? '完成' : 'Completed'
        statusColor = '#f44336'
        statusIcon = 'fa fa-times-circle'
      }
      
      test.questionStatus[i] = {
        text: statusText,
        color: statusColor,
        icon: statusIcon,
        time: new Date().toLocaleTimeString(),
        algorithm: test.currentAlgorithm
      }
      
    } catch (error) {
      console.error(store.locales=='zh' ? '第 ' : 'Row ' + (i + 1) + (store.locales=='zh' ? ' 行测试失败:' : ' test failed:'), error)
      
      test.questionStatus[i] = {
        text: store.locales=='zh' ? '测试失败' : 'Test Failed',
        color: '#f44336',
        icon: 'fa fa-times-circle',
        time: new Date().toLocaleTimeString(),
        algorithm: test.currentAlgorithm
      }
    }
    
    test.progress = ((i + 1) / test.questions.length) * 100
  }
  
  test.isRunning = false
  lastUpdateTime.value = new Date().toLocaleTimeString()
  
  const answerMatches = testResults.value.reduce((count, result) => {
    if (!result || !result.slices) return count
    return count + result.slices.filter((s: any) => s.containsAnswer).length
  }, 0)
  
  emit('updateState', store.locales=='zh' ? '批量测试完成' : 'Batch test completed' + 
       store.locales=='zh' ? '，共处理 ' : ', processed ' + testResults.value.filter(Boolean).length + 
       store.locales=='zh' ? ' 个问题，' : ' questions, ' + answerMatches + 
       store.locales=='zh' ? ' 个切片包含参考答案' : ' slices contain reference answers')
}

// 添加问题行
const addQuestionRow = () => {
  test.questions.push('')
  test.answers.push('')
  test.questionStatus.push({text: store.locales=='zh' ? '未测试' : 'Not Tested', color: 'var(--borderColor)', icon: 'fa fa-circle-o'})
}

// 删除问题行
const removeQuestionRow = (index: number) => {
  if (test.questions.length > 1) {
    test.questions.splice(index, 1)
    test.answers.splice(index, 1)
    test.questionStatus.splice(index, 1)
    testResults.value.splice(index, 1)
    // 删除对应的位次分析记录
    const question = test.questions[index]?.trim()
    if (question) {
      rankAnalysisResults.value = rankAnalysisResults.value.filter(
        r => r.question !== question || r.algorithm !== test.currentAlgorithm
      )
    }
  }
}

// 清空所有问题
const clearAllQuestions = () => {
  test.questions = ['']
  test.answers = ['']
  test.questionStatus = [{text: store.locales=='zh' ? '未测试' : 'Not Tested', color: 'var(--borderColor)', icon: 'fa fa-circle-o'}]
  testResults.value = []
  rankAnalysisResults.value = []
}

// 从Excel导入问题和答案
const importFromExcel = async () => {
  isImporting.value = true
  try {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xlsx, .xls, .csv'
    
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement
      const file = target.files?.[0]
      if (!file) return
      
      const reader = new FileReader()
      reader.onload = async (loadEvent) => {
        try {
          const data = new Uint8Array(loadEvent.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array' })
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
          const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][]
          
          if (rows.length === 0) {
            emit('updateState', store.locales=='zh' ? 'Excel文件为空' : 'Excel file is empty')
            return
          }
          
          // 解析表头
          const headers = rows[0].map((h: any) => String(h || '').toLowerCase())
          const questionColIndex = headers.findIndex(h => h.includes('问题') || h === 'question' || h === 'q')
          const answerColIndex = headers.findIndex(h => h.includes('答案') || h === 'answer' || h === 'a')
          
          if (questionColIndex === -1) {
            emit('updateState', store.locales=='zh' ? '未找到问题列，请确保有"问题"或"question"列' : 'Question column not found')
            return
          }
          
          // 清空现有数据
          test.questions = []
          test.answers = []
          test.questionStatus = []
          testResults.value = []
          rankAnalysisResults.value = []
          
          // 导入数据
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i]
            const question = row[questionColIndex] ? String(row[questionColIndex]).trim() : ''
            const answer = answerColIndex !== -1 && row[answerColIndex] ? String(row[answerColIndex]).trim() : ''
            
            if (question) {
              test.questions.push(question)
              test.answers.push(answer)
              test.questionStatus.push({text: store.locales=='zh' ? '未测试' : 'Not Tested', color: 'var(--borderColor)', icon: 'fa fa-circle-o'})
            }
          }
          
          if (test.questions.length === 0) {
            test.questions = ['']
            test.answers = ['']
            test.questionStatus = [{text: store.locales=='zh' ? '未测试' : 'Not Tested', color: 'var(--borderColor)', icon: 'fa fa-circle-o'}]
            emit('updateState', store.locales=='zh' ? '未找到有效问题数据' : 'No valid question data found')
          } else {
            emit('updateState', store.locales=='zh' ? `成功导入 ${test.questions.length} 个问题` : `Successfully imported ${test.questions.length} questions`)
          }
        } catch (error) {
          console.error('解析Excel失败:', error)
          emit('updateState', store.locales=='zh' ? '解析Excel文件失败' : 'Failed to parse Excel file')
        } finally {
          isImporting.value = false
        }
      }
      reader.readAsArrayBuffer(file)
    }
    
    input.click()
  } catch (error) {
    console.error('导入失败:', error)
    emit('updateState', store.locales=='zh' ? '导入失败' : 'Import failed')
    isImporting.value = false
  }
}

// 导出测试结果到Excel
const exportToExcel = async () => {
  if (testResults.value.length === 0) {
    emit('updateState', store.locales=='zh' ? '没有可导出的测试结果' : 'No test results to export')
    return
  }
  
  isExporting.value = true
  try {
    // 准备导出数据
    const exportData: any[][] = [
      ['问题', '参考答案', '算法', '平均相似度', '包含答案', '位次', '切片内容', '切片相似度', '切片文件', '文件摘要分', '切片分', 'PCA分', 'MDS分', '实体增强乘数', '匹配实体', '测试时间']
    ]
    
    for (const result of testResults.value) {
      if (!result) continue
      
      for (let i = 0; i < result.slices.length; i++) {
        const slice = result.slices[i]
        exportData.push([
          result.question,
          result.answer,
          result.algorithm,
          result.avgScore.toFixed(4),
          slice.containsAnswer ? '是' : '否',
          slice.rank,
          slice.content.substring(0, 500),
          slice.score.toFixed(4),
          slice.label,
          slice.detailedScores?.fileSummaryScore?.toFixed(4) || '',
          slice.detailedScores?.sliceScore?.toFixed(4) || '',
          slice.detailedScores?.pcaScore?.toFixed(4) || '',
          slice.detailedScores?.mdsScore?.toFixed(4) || '',
          slice.detailedScores?.entityBoostMultiplier?.toFixed(2) || '',
          (slice.detailedScores?.matchedEntities || []).join(', '),
          new Date(result.timestamp).toLocaleString()
        ])
      }
      
      // 如果没有切片，添加一行基本信息
      if (result.slices.length === 0) {
        exportData.push([
          result.question,
          result.answer,
          result.algorithm,
          result.avgScore.toFixed(4),
          '否',
          '',
          '无结果',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          new Date(result.timestamp).toLocaleString()
        ])
      }
    }
    
    // 添加汇总统计
    exportData.push([])
    exportData.push(['汇总统计'])
    exportData.push(['总测试数', testResults.value.length])
    
    const algoStats: Record<string, { count: number, avgScore: number, matchCount: number }> = {}
    for (const result of testResults.value) {
      if (!result) continue
      if (!algoStats[result.algorithm]) {
        algoStats[result.algorithm] = { count: 0, avgScore: 0, matchCount: 0 }
      }
      algoStats[result.algorithm].count++
      algoStats[result.algorithm].avgScore += result.avgScore
      algoStats[result.algorithm].matchCount += result.slices.filter(s => s.containsAnswer).length
    }
    
    for (const [algo, stats] of Object.entries(algoStats)) {
      exportData.push([`算法: ${algo}`, `测试数: ${stats.count}`, `平均分: ${(stats.avgScore / stats.count).toFixed(4)}`, `匹配数: ${stats.matchCount}`])
    }
    
    // 创建工作簿和工作表
    const ws = XLSX.utils.aoa_to_sheet(exportData)
    
    // 设置列宽
    ws['!cols'] = [
      { wch: 30 }, // 问题
      { wch: 30 }, // 参考答案
      { wch: 15 }, // 算法
      { wch: 12 }, // 平均相似度
      { wch: 10 }, // 包含答案
      { wch: 8 },  // 位次
      { wch: 50 }, // 切片内容
      { wch: 12 }, // 切片相似度
      { wch: 20 }, // 切片文件
      { wch: 12 }, // 文件摘要分
      { wch: 10 }, // 切片分
      { wch: 10 }, // PCA分
      { wch: 10 }, // MDS分
      { wch: 12 }, // 实体增强乘数
      { wch: 20 }, // 匹配实体
      { wch: 20 }  // 测试时间
    ]
    
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '测试结果')
    
    // 导出文件
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    XLSX.writeFile(wb, `test_results_${timestamp}.xlsx`)
    
    emit('updateState', store.locales=='zh' ? '导出成功' : 'Export successful')
  } catch (error) {
    console.error('导出失败:', error)
    emit('updateState', store.locales=='zh' ? '导出失败' : 'Export failed')
  } finally {
    isExporting.value = false
  }
}

// 导出位次分析结果到Excel
const exportRankAnalysis = async () => {
  if (rankAnalysisResults.value.length === 0) {
    emit('updateState', store.locales=='zh' ? '没有可导出的位次分析结果' : 'No rank analysis results to export')
    return
  }
  
  isExporting.value = true
  try {
    // 准备导出数据
    const exportData: any[][] = [
      ['问题', '参考答案', '算法', '答案出现位次', '首次出现位次', '最佳位次', '命中数量', '测试时间']
    ]
    
    for (const result of rankAnalysisResults.value) {
      exportData.push([
        result.question,
        result.answer,
        result.algorithm,
        result.ranks,
        result.firstRank === -1 ? '未找到' : result.firstRank,
        result.bestRank === -1 ? '未找到' : result.bestRank,
        result.foundCount,
        new Date(result.timestamp).toLocaleString()
      ])
    }
    
    // 添加汇总统计
    exportData.push([])
    exportData.push(['汇总统计'])
    
    const algoStats: Record<string, { count: number, avgFirstRank: number, totalFound: number }> = {}
    for (const result of rankAnalysisResults.value) {
      if (!algoStats[result.algorithm]) {
        algoStats[result.algorithm] = { count: 0, avgFirstRank: 0, totalFound: 0 }
      }
      algoStats[result.algorithm].count++
      if (result.firstRank !== -1) {
        algoStats[result.algorithm].avgFirstRank += result.firstRank
      }
      algoStats[result.algorithm].totalFound += result.foundCount
    }
    
    for (const [algo, stats] of Object.entries(algoStats)) {
      const avgFirstRank = stats.count > 0 ? (stats.avgFirstRank / stats.count).toFixed(2) : 'N/A'
      exportData.push([`算法: ${algo}`, `测试数: ${stats.count}`, `平均首次位次: ${avgFirstRank}`, `总命中数: ${stats.totalFound}`])
    }
    
    // 创建工作簿和工作表
    const ws = XLSX.utils.aoa_to_sheet(exportData)
    
    // 设置列宽
    ws['!cols'] = [
      { wch: 40 }, // 问题
      { wch: 30 }, // 参考答案
      { wch: 20 }, // 算法
      { wch: 15 }, // 答案出现位次
      { wch: 12 }, // 首次出现位次
      { wch: 12 }, // 最佳位次
      { wch: 10 }, // 命中数量
      { wch: 20 }  // 测试时间
    ]
    
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '位次分析')
    
    // 导出文件
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    XLSX.writeFile(wb, `rank_analysis_${timestamp}.xlsx`)
    
    emit('updateState', store.locales=='zh' ? '位次分析导出成功' : 'Rank analysis exported successfully')
  } catch (error) {
    console.error('导出位次分析失败:', error)
    emit('updateState', store.locales=='zh' ? '导出位次分析失败' : 'Failed to export rank analysis')
  } finally {
    isExporting.value = false
  }
}

// 导出当前问题和答案模板
const exportTemplate = () => {
  const exportData: any[][] = [
    ['问题', '参考答案']
  ]
  
  for (let i = 0; i < test.questions.length; i++) {
    exportData.push([test.questions[i] || '', test.answers[i] || ''])
  }
  
  const ws = XLSX.utils.aoa_to_sheet(exportData)
  ws['!cols'] = [{ wch: 40 }, { wch: 40 }]
  
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '测试模板')
  
  XLSX.writeFile(wb, `test_template_${new Date().toISOString().slice(0, 10)}.xlsx`)
  
  emit('updateState', store.locales=='zh' ? '模板导出成功' : 'Template exported successfully')
}

// 初始化文件摘要信息
const initFileSummaries = () => {
  if (!props.files || props.files.length === 0) return
  
  fileSummaries.value.clear()
  
  for (const file of props.files) {
    if (file.content) {
      extractFileSummary(file)
    }
  }
  
  if (props.blocks && props.blocks.length > 0) {
    const uniqueFilePaths = new Set()
    for (const block of props.blocks) {
      if (block.filePath || block.path) {
        uniqueFilePaths.add(block.filePath || block.path)
      }
    }
    
    for (const filePath of uniqueFilePaths) {
      const file = props.files.find(f => f.path === filePath)
      if (file && file.content) {
        extractFileSummary(file)
      }
    }
  }
}

// 辅助函数 - 安全获取详细分数
const getDetailedScore = (slice: any, key: string, defaultValue: number = 0): number => {
  if (!slice || !slice.detailedScores) return defaultValue
  const value = slice.detailedScores[key]
  return value !== undefined && value !== null ? value : defaultValue
}

// 辅助函数 - 安全获取匹配实体
const getMatchedEntities = (slice: any): string[] => {
  if (!slice || !slice.detailedScores) return []
  return slice.detailedScores.matchedEntities || []
}

// 辅助函数 - 安全获取实体增强乘数
const getEntityBoostMultiplier = (slice: any): number => {
  if (!slice || !slice.detailedScores) return 1
  return slice.detailedScores.entityBoostMultiplier || 1
}

const getScoreColor = (score: number) => {
  if (score > 0.7) return '#4CAF50'
  if (score > 0.5) return '#FF9800'
  return '#f44336'
}

const getScoreClass = (rowIndex: number, sliceIndex: number) => {
  const result = testResults.value[rowIndex]
  if (!result || !result.slices || !result.slices[sliceIndex]) return ''
  
  const slice = result.slices[sliceIndex]
  const score = getDetailedScore(slice, 'overallScore', slice.score)
  
  if (slice.containsAnswer) return 'answer-match'
  if (score > 0.7) return 'high-score'
  if (score > 0.5) return 'medium-score'
  return 'low-score'
}

const formatPercent = (value: number) => {
  if (value === undefined || value === null) return '0%'
  return (value * 100).toFixed(1) + '%'
}

// 获取算法标签
const getAlgorithmLabel = (algo: SearchAlgorithm) => {
  const option = algorithmOptions.find(o => o.value === algo)
  return option ? option.label : algo
}

const clearRankAnalysis = () => {
  if (rankAnalysisResults.value.length === 0) {
    emit('updateState', store.locales=='zh' ? '位次分析记录已为空' : 'Rank analysis records are already empty')
    return
  }
  
  rankAnalysisResults.value = []
  emit('updateState', store.locales=='zh' ? '已清空位次分析记录' : 'Rank analysis records cleared')
}

// 组件挂载时初始化
onMounted(() => {
  initFileSummaries()
})

// 监听文件和blocks的变化
watch(() => [props.files, props.blocks], () => {
  initFileSummaries()
}, { deep: true })

// 定义发射事件
const emit = defineEmits<{
  updateState: [state: string]
}>()
</script>

<template>
  <div style="display:flex;gap:2px;height:100%;width:100%;box-sizing:border-box;align-items:stretch;flex-direction:column;">

    <!-- 工具栏 -->
    <div style="display:flex;align-items:center;width:calc(100% - 5px);flex-wrap:wrap;border-bottom:1px solid var(--borderColor);padding-right:5px;">
      
      <div 
        class="tab-button" 
        :class="{ active: activeTab === 'test' }"
        @click="activeTab = 'test'"
      >
        <i class="fa fa-table"></i> {{ store.locales=='zh' ? '测试结果' : 'Test Results' }}
      </div>
      <div 
        class="tab-button" 
        :class="{ active: activeTab === 'rank' }"
        @click="activeTab = 'rank'"
      >
        <i class="fa fa-line-chart"></i> {{ store.locales=='zh' ? '位次分析' : 'Rank Analysis' }}
      </div>
      <!-- 测试按钮 -->
      <div class="button" @click="runBatchTest" :disabled="test.isRunning" :title="test.isRunning ? (store.locales=='zh' ? '测试中...' : 'Testing...') : (store.locales=='zh' ? '批量测试' : 'Batch Test')">
        <i class="fa fa-play"></i>
      </div>
      
      <!-- 导入导出按钮 -->
      <div class="button" @click="importFromExcel" :disabled="isImporting" :title="store.locales=='zh'?'从Excel导入问题和答案':'Import questions and answers from Excel'">
        <i class="fa fa-file-excel-o"></i>
      </div>
      
      <div class="button" @click="exportTemplate" :title="store.locales=='zh'?'导出当前问题和答案模板':'Export current questions and answers template'">
        <i class="fa fa-download"></i>
      </div>
      
      <div class="button" @click="exportToExcel" :disabled="isExporting" :title="store.locales=='zh'?'导出测试结果':'Export Test Results'">
        <i class="fa fa-upload"></i>
      </div>
      
      <div class="button" v-if="activeTab === 'rank'" @click="exportRankAnalysis" :disabled="isExporting" :title="store.locales=='zh'?'导出位次分析':'Export Rank Analysis'">
        <i class="fa fa-bar-chart"></i>
      </div>
      
      <!-- 清空位次分析记录按钮 -->
      <div class="button" v-if="activeTab === 'rank'" @click="clearRankAnalysis" :title="store.locales=='zh'?'清空位次分析记录':'Clear Rank Analysis Records'">
        <i class="fa fa-eraser"></i>
      </div>
      
      <!-- 行操作 -->
      <div class="button" @click="addQuestionRow" :title="store.locales=='zh'?'添加问题行':'Add Question Row'">
        <i class="fa fa-plus"></i>
      </div>
      
      <div class="button" @click="clearAllQuestions" :title="store.locales=='zh'?'清空所有问题':'Clear All Questions'">
        <i class="fa fa-trash"></i>
      </div>
      
      <select 
        v-model="test.currentAlgorithm" 
        style="height:28px;padding:0 8px;border-radius:4px;border:1px solid var(--borderColor);background:var(--backgroundColor);margin-right:4px;width:180px;height:30px"
        :title="store.locales=='zh' ? '选择检索算法' : 'Select search algorithm'"
      >
        <option v-for="algo in algorithmOptions" :key="algo.value" :value="algo.value">
          {{ algo.label }}
        </option>
      </select>
      
      <!-- 切片数量选择 -->
      <input v-model="test.searchNum" type="number" style="width:40px;height:26px" :title="store.locales=='zh'?'切片数量':'Slice Count'"/>
      <!-- 统计信息 -->
      <div style="display:flex;gap:4px;font-size:11px;margin-left:5px;flex:1;">
        <span style="color:#4CAF50;"><i class="fa fa-square"></i> >70%</span>
        <span style="color:#FF9800;"><i class="fa fa-square"></i> 50-70%</span>
        <span style="color:#f44336;"><i class="fa fa-square"></i> <50%</span>
        <span style="color:#4CAF50;margin-left:8px;"><i class="fa fa-check-circle"></i> {{store.locales=='zh'?'含答案':'With Answers'}}</span>
      </div>
      
      <!-- 进度条 -->
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
    
    <!-- 测试结果表格区域 -->
    <div v-if="activeTab === 'test'" style="flex:1;border-radius:5px;padding:5px;display:flex;flex-direction:column;overflow:hidden;">
      <div class="scoll" style="flex:1;overflow:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed;">
          <thead style="position:sticky;top:0;background-color:var(--menuColor);">
            <tr>
              <th style="padding:5px;border:1px solid var(--borderColor);text-align:left;width:200px;">
                {{ store.locales=='zh' ? '测试问题' : 'Test Question' }}
              </th>
              <th style="padding:5px;border:1px solid var(--borderColor);text-align:left;width:180px;">
                {{ store.locales=='zh' ? '参考答案' : 'Reference Answer' }}
              </th>
              <th v-for="n in parseInt(test.searchNum)" :key="n" style="padding:5px;border:1px solid var(--borderColor);text-align:left;width:auto;">
                <div style="font-weight:bold;">{{ store.locales=='zh' ? '切片 ' : 'Slice ' }}{{ n }}</div>
                <div style="font-size:9px;color:var(--borderColor);">{{ store.locales=='zh' ? '位次:' : 'Rank:' }}{{ n }}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(question, qIndex) in test.questions" :key="'question-' + qIndex" 
                :style="{backgroundColor: qIndex % 2 === 0 ? 'var(--backgroundColor)' : 'var(--menuColor)'}">
              
              <!-- 问题输入单元格 -->
              <td style="padding:5px;border:1px solid var(--borderColor);vertical-align:top;width:200px;">
                <textarea
                  v-model="test.questions[qIndex]" class="scoll" style="flex:1;min-height:60px;padding:4px;font-size:12px;resize:vertical;border:1px solid var(--borderColor);border-radius:3px;width:calc(100% - 8px);"
                  :placeholder="store.locales=='zh' ? '输入问题 ' : 'Enter question ' + (qIndex + 1)"
                  @keydown.ctrl.enter="runSingleTest(qIndex)"
                ></textarea>
                <div style="margin-top:4px;font-size:10px;display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
                  <span @click="runSingleTest(qIndex)" :title="store.locales=='zh' ? '单独测试 (Ctrl+Enter)' : 'Test individually (Ctrl+Enter)'">
                    <i class="fa fa-play"></i>
                  </span>
                  <span @click="removeQuestionRow(qIndex)" :title="store.locales=='zh' ? '删除' : 'Delete'" v-if="test.questions.length > 1">
                    <i class="fa fa-trash"></i>
                  </span>
                  <span v-if="test.questionStatus[qIndex]" :style="{color: test.questionStatus[qIndex].color}">
                    <i :class="test.questionStatus[qIndex].icon"></i>
                    {{ test.questionStatus[qIndex].text }}
                  </span>
                  <span v-if="test.questionStatus[qIndex]?.algorithm" style="font-size:9px;background:var(--menuColor);padding:0 4px;border-radius:3px;">
                    {{ getAlgorithmLabel(test.questionStatus[qIndex].algorithm as SearchAlgorithm) }}
                  </span>
                </div>
              </td>
              
              <!-- 答案输入单元格 -->
              <td style="padding:5px;border:1px solid var(--borderColor);vertical-align:top;width:180px;">
                <textarea v-model="test.answers[qIndex]" class="scoll" style="min-height:60px;padding:4px;font-size:12px;resize:vertical;border:1px solid var(--borderColor);border-radius:3px;width:calc(100% - 8px);"
                  :placeholder="store.locales=='zh' ? '输入参考答案 ' : 'Enter answer ' + (qIndex + 1)"
                ></textarea>
              </td>
              
              <!-- 切片结果单元格 -->
              <td v-for="n in parseInt(test.searchNum)" :key="'result-' + qIndex + '-' + n" style="padding:5px;border:1px solid var(--borderColor);vertical-align:top;position:relative;width:auto;" :class="getScoreClass(qIndex, n-1)">
                <template v-if="testResults[qIndex] && testResults[qIndex].slices && testResults[qIndex].slices[n-1]">
                  <div style="max-height:100px;overflow:auto;border:1px solid var(--borderColor);border-radius:3px;padding:4px;background-color:var(--backgroundColor);overflow-x: hidden;">
                    <block_md 
                      :content="testResults[qIndex].slices[n-1].content" 
                      :fontSize="'10px'"
                      :maxHeight="'80px'"
                    />
                  </div>
                  
                  <!-- 文件信息 -->
                  <div style="font-size:10px;color:var(--borderColor);display:flex;align-items:center;overflow:hidden;margin-top:4px;">
                    <i :class="store.icon(testResults[qIndex].slices[n-1].extension)"></i>&nbsp;
                    <span class="ellipsis" :title="testResults[qIndex].slices[n-1].label" 
                          style="white-space: nowrap;overflow: hidden;text-overflow: ellipsis;flex:1;">
                      {{ testResults[qIndex].slices[n-1].label }}
                    </span>
                  </div>
                  
                  <!-- 详细分数 -->
                  <div style="display:flex;font-size:9px;flex-wrap:wrap;gap:4px;margin-top:4px;">
                    <span style="color:#2196F3;" :title="store.locales=='zh' ? '切片分' : 'Slice Score'">
                      S:{{ formatPercent(getDetailedScore(testResults[qIndex].slices[n-1], 'sliceScore')) }}
                    </span>
                    <span style="color:#4CAF50;" :title="store.locales=='zh' ? '文件摘要分' : 'File Summary Score'">
                      F:{{ formatPercent(getDetailedScore(testResults[qIndex].slices[n-1], 'fileSummaryScore')) }}
                    </span>
                    <span v-if="getDetailedScore(testResults[qIndex].slices[n-1], 'pcaScore') > 0" 
                          style="color:#673AB7;" :title="store.locales=='zh' ? 'PCA分' : 'PCA Score'">
                      P:{{ formatPercent(getDetailedScore(testResults[qIndex].slices[n-1], 'pcaScore')) }}
                    </span>
                    <span v-if="getDetailedScore(testResults[qIndex].slices[n-1], 'mdsScore') > 0" 
                          style="color:#009688;" :title="store.locales=='zh' ? 'MDS分' : 'MDS Score'">
                      M:{{ formatPercent(getDetailedScore(testResults[qIndex].slices[n-1], 'mdsScore')) }}
                    </span>
                    <span v-if="getEntityBoostMultiplier(testResults[qIndex].slices[n-1]) > 1" 
                          style="color:#FF9800;font-weight:bold;" 
                          :title="store.locales=='zh' ? `实体增强乘数: ${getEntityBoostMultiplier(testResults[qIndex].slices[n-1]).toFixed(2)}` : `Entity Boost: ${getEntityBoostMultiplier(testResults[qIndex].slices[n-1]).toFixed(2)}`">
                      ×{{ getEntityBoostMultiplier(testResults[qIndex].slices[n-1]).toFixed(2) }}
                    </span>
                    <span style="font-weight:bold;" :title="store.locales=='zh' ? '总分' : 'Total Score'">
                      T:{{ formatPercent(getDetailedScore(testResults[qIndex].slices[n-1], 'overallScore')) }}
                    </span>
                  </div>
                  
                  <!-- 答案匹配标记 -->
                  <div v-if="testResults[qIndex].slices[n-1].containsAnswer" 
                      style="position:absolute;bottom:2px;right:5px;">
                    <i class="fa fa-check-circle" style="color:#4CAF50;font-size:14px;" 
                    :title="store.locales=='zh' ? '包含参考答案' : 'Contains reference answer'"></i>
                  </div>
                  
                  <!-- 实体增强标记 -->
                  <div v-if="getMatchedEntities(testResults[qIndex].slices[n-1]).length > 0" 
                      style="position:absolute;bottom:4px;right:20px;">
                    <i class="fa fa-github-alt" style="color:#9C27B0;font-size:12px;" 
                    :title="store.locales=='zh' ? '匹配实体: ' : 'Matched entities: ' + getMatchedEntities(testResults[qIndex].slices[n-1]).join(', ')"></i>
                  </div>
                </template>
                <div v-else style="color:var(--borderColor);font-size:11px;text-align:center;padding:35px 0;">
                  <i class="fa fa-hourglass-o"></i>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 位次分析页面 -->
    <div v-if="activeTab === 'rank'" style="flex:1;border-radius:5px;padding:5px;display:flex;flex-direction:column;overflow:hidden;">
      <div class="scoll" style="flex:1;overflow:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead style="position:sticky;top:0;background-color:var(--menuColor);">
            <tr>
              <th style="padding:8px;border:1px solid var(--borderColor);text-align:left;">{{ store.locales=='zh' ? '问题' : 'Question' }}</th>
              <th style="padding:8px;border:1px solid var(--borderColor);text-align:left;">{{ store.locales=='zh' ? '参考答案' : 'Answer' }}</th>
              <th style="padding:8px;border:1px solid var(--borderColor);text-align:left;">{{ store.locales=='zh' ? '算法' : 'Algorithm' }}</th>
              <th style="padding:8px;border:1px solid var(--borderColor);text-align:left;">{{ store.locales=='zh' ? '答案出现位次' : 'Answer Ranks' }}</th>
              <th style="padding:8px;border:1px solid var(--borderColor);text-align:left;">{{ store.locales=='zh' ? '首次出现位次' : 'First Rank' }}</th>
              <th style="padding:8px;border:1px solid var(--borderColor);text-align:left;">{{ store.locales=='zh' ? '最佳位次' : 'Best Rank' }}</th>
              <th style="padding:8px;border:1px solid var(--borderColor);text-align:left;">{{ store.locales=='zh' ? '命中数量' : 'Hit Count' }}</th>
              <th style="padding:8px;border:1px solid var(--borderColor);text-align:left;">{{ store.locales=='zh' ? '测试时间' : 'Timestamp' }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(result, idx) in rankAnalysisResults" :key="idx"
                :style="{backgroundColor: idx % 2 === 0 ? 'var(--backgroundColor)' : 'var(--menuColor)'}">
              <td style="padding:8px;border:1px solid var(--borderColor);vertical-align:top;word-break:break-word;">
                {{ result.question }}
              </td>
              <td style="padding:8px;border:1px solid var(--borderColor);vertical-align:top;word-break:break-word;">
                {{ result.answer }}
              </td>
              <td style="padding:8px;border:1px solid var(--borderColor);vertical-align:top;">
                {{ getAlgorithmLabel(result.algorithm) }}
              </td>
              <td style="padding:8px;border:1px solid var(--borderColor);vertical-align:top;">
                <span :style="{color: result.ranks === '未找到' ? '#f44336' : '#4CAF50', fontWeight: result.ranks !== '未找到' ? 'bold' : 'normal'}">
                  {{ result.ranks }}
                </span>
              </td>
              <td style="padding:8px;border:1px solid var(--borderColor);vertical-align:top;">
                <span :style="{color: result.firstRank === -1 ? '#f44336' : '#4CAF50'}">
                  {{ result.firstRank === -1 ? (store.locales=='zh' ? '未找到' : 'Not Found') : result.firstRank }}
                </span>
              </td>
              <td style="padding:8px;border:1px solid var(--borderColor);vertical-align:top;">
                <span :style="{color: result.bestRank === -1 ? '#f44336' : '#4CAF50'}">
                  {{ result.bestRank === -1 ? (store.locales=='zh' ? '未找到' : 'Not Found') : result.bestRank }}
                </span>
              </td>
              <td style="padding:8px;border:1px solid var(--borderColor);vertical-align:top;">
                <span :style="{color: result.foundCount > 0 ? '#4CAF50' : '#f44336'}">
                  {{ result.foundCount }}
                </span>
              </td>
              <td style="padding:8px;border:1px solid var(--borderColor);vertical-align:top;font-size:11px;">
                {{ new Date(result.timestamp).toLocaleString() }}
              </td>
            </tr>
            <tr v-if="rankAnalysisResults.length === 0">
              <td colspan="8" style="padding:40px;text-align:center;color:var(--borderColor);">
                <i class="fa fa-info-circle"></i> 
                {{ store.locales=='zh' ? '暂无位次分析数据，请先运行测试' : 'No rank analysis data, please run tests first' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.algorithm-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.algorithm-btn:hover {
  background-color: rgba(33, 150, 243, 0.1);
}

.algorithm-btn.active {
  background-color: #2196F3;
  color: white;
}

.answer-match {
  background-color: rgba(76, 175, 80, 0.1) !important;
  border-left: 3px solid #4CAF50 !important;
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

.button {
  background-color: var(--backgroundColor);
}

.button:hover {
  background-color: var(--menuColor);
}

.tab-button {
  padding: 6px 12px;
  cursor: pointer;
  font-size: 12px;
  border-radius: 4px 4px 0 0;
  transition: all 0.2s;
  margin-right: 2px;
}

.tab-button:hover {
  background-color: var(--menuColor);
}

.tab-button.active {
  background-color: var(--menuColor);
  color: var(--fontActiveColor);
  border-bottom: 2px solid #2196F3;
}
</style>