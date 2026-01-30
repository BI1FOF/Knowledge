// src/utils/kbRetrieval.ts
import { Ollama } from 'ollama/dist/browser.mjs'

// ==================== 类型定义 ====================

export interface KnowledgeBlock {
  filePath: string
  label: string
  content: string
  A_vector?: number[]
  Q_vector?: number[]
  [key: string]: any
}

export interface FileSummaryInfo {
  content: string
  vector?: number[]
}

export interface RetrievalOptions {
  /** 召回的文件数量（默认：5） */
  topK?: number
  /** 摘要的权重（0-1，默认：0.7） */
  summaryWeight?: number
  /** 是否启用反推计算相似度（默认：false） */
  useReverseInference?: boolean
  /** 反推相似度权重（0-1，默认：0.3） */
  reverseWeight?: number
  /** Ollama服务地址（默认：http://127.0.0.1:11434） */
  ollamaHost?: string
  /** 嵌入模型（默认：优先使用知识库中的模型） */
  embedModel?: string
  /** 是否返回调试信息（默认：false） */
  debug?: boolean
  /** 模型缺失时的处理策略：'error' 抛出错误，'fallback' 使用回退模型（默认：'error'） */
  missingModelStrategy?: 'error' | 'fallback'
  /** 回退嵌入模型列表（按优先级） */
  fallbackModels?: string[]
}

export interface RelevantBlock {
  label: string
  content: string
  similarity: number
  summaryScore?: number
  sliceScore?: number
  reverseScore?: number
}

export interface RetrievalResult {
  /** 由最相关的知识片段组成的文本 */
  context: string
  /** 相关片段详细信息 */
  relevantBlocks: RelevantBlock[]
  /** 实际使用的嵌入模型 */
  usedEmbedModel: string
  /** 调试信息（仅在debug=true时返回） */
  debugInfo?: {
    config: RetrievalOptions
    knowledgeBaseModel?: string
    totalBlocks: number
    selectedCount: number
    similarityStats: {
      min: number
      max: number
      avg: number
    }
  }
}

export interface KnowledgeBaseConfig {
  embedModel?: string
  timestamp?: string
  version?: string
  summaryWeight?: number
  sliceWeight?: number
  [key: string]: any
}

export interface KnowledgeBaseData {
  config?: KnowledgeBaseConfig
  blocks: KnowledgeBlock[]
  fileSummaries?: Record<string, FileSummaryInfo>
}

// ==================== 错误类定义 ====================

export class ModelNotAvailableError extends Error {
  constructor(
    public requestedModel: string,
    public availableModels: string[],
    message = `嵌入模型 "${requestedModel}" 不可用`
  ) {
    super(message)
    this.name = 'ModelNotAvailableError'
  }
}

export class KnowledgeBaseFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'KnowledgeBaseFormatError'
  }
}

// ==================== 主函数 ====================

/**
 * 知识库检索函数
 * 
 * @param query 查询问题
 * @param kbPath 知识库文件路径
 * @param options 检索选项
 * @returns 返回知识库中最相关的片段组成的文本
 * 
 * @example
 * ```typescript
 * // 基本用法
 * const result = await retrieveKnowledge(
 *   "什么是机器学习？",
 *   "/path/to/knowledge.kb"
 * )
 * 
 * // 高级用法
 * const result = await retrieveKnowledge(
 *   "什么是深度学习？",
 *   "/path/to/knowledge.kb",
 *   {
 *     topK: 10,
 *     summaryWeight: 0.7,
 *     useReverseInference: true,
 *     reverseWeight: 0.3,
 *     missingModelStrategy: 'fallback',
 *     fallbackModels: ['mxbai-embed-large:latest', 'nomic-embed-text:latest'],
 *     debug: true
 *   }
 * )
 * ```
 */
export async function retrieveKnowledge(
  query: string,
  kbPath: string,
  options: RetrievalOptions = {}
): Promise<RetrievalResult> {
  // 默认配置
  const config: Required<RetrievalOptions> = {
    topK: 5,
    summaryWeight: 0.7,
    useReverseInference: false,
    reverseWeight: 0.3,
    ollamaHost: 'http://127.0.0.1:11434',
    embedModel: '', // 默认留空，由知识库决定
    debug: false,
    missingModelStrategy: 'error',
    fallbackModels: ['nomic-embed-text:latest', 'all-minilm:latest'],
    ...options
  }

  try {
    // 1. 加载知识库（包括配置信息）
    const { blocks, fileSummaries, kbConfig } = await loadKnowledgeBase(kbPath)
    
    // 2. 初始化Ollama
    const ollama = new Ollama({ host: config.ollamaHost })
    
    // 3. 确定使用的嵌入模型
    const effectiveEmbedModel = await determineEmbedModel(
      ollama,
      config.embedModel || kbConfig?.embedModel,
      config.missingModelStrategy,
      config.fallbackModels
    )
    
    // 4. 验证模型一致性（如果知识库中有存储向量）
    if (config.debug && kbConfig?.embedModel) {
      console.log(`知识库使用模型: ${kbConfig.embedModel}, 实际使用模型: ${effectiveEmbedModel}`)
      
      if (kbConfig.embedModel !== effectiveEmbedModel) {
        console.warn('⚠️ 警告: 使用的嵌入模型与知识库创建时的模型不一致，可能影响检索准确性')
      }
    }
    
    // 5. 计算查询向量
    const queryResponse = await ollama.embed({
      model: effectiveEmbedModel,
      input: query,
      truncate: true,
      keep_alive: "1h"
    })
    const queryEmbedding = queryResponse.embeddings?.[0]
    
    if (!queryEmbedding) {
      throw new Error('查询向量化失败')
    }

    // 6. 批量计算文件摘要向量
    const fileSummaryVectors = await computeFileSummaryVectors(
      fileSummaries,
      ollama,
      effectiveEmbedModel
    )

    // 7. 计算综合相似度
    const scoredBlocks = calculateSimilarities(
      blocks,
      queryEmbedding,
      fileSummaryVectors,
      config,
      kbConfig
    )

    // 8. 排序并选择相关片段
    scoredBlocks.sort((a, b) => b.similarity - a.similarity)
    const selectedBlocks = scoredBlocks.slice(0, config.topK)
    
    // 9. 构建上下文文本
    const context = buildContext(query, selectedBlocks)

    // 10. 准备返回结果
    const result: RetrievalResult = {
      context,
      relevantBlocks: selectedBlocks.map(block => ({
        label: block.label,
        content: block.A,
        similarity: block.similarity,
        summaryScore: block.summaryScore,
        sliceScore: block.sliceScore,
        reverseScore: block.reverseScore
      })),
      usedEmbedModel: effectiveEmbedModel
    }

    // 11. 添加调试信息（如果需要）
    if (config.debug) {
      result.debugInfo = {
        config,
        knowledgeBaseModel: kbConfig?.embedModel,
        totalBlocks: blocks.length,
        selectedCount: selectedBlocks.length,
        similarityStats: {
          min: Math.min(...scoredBlocks.map(b => b.similarity)),
          max: Math.max(...scoredBlocks.map(b => b.similarity)),
          avg: scoredBlocks.reduce((sum, b) => sum + b.similarity, 0) / scoredBlocks.length
        }
      }
    }

    return result

  } catch (error) {
    console.error('知识库检索失败:', error)
    
    // 如果是模型不可用错误，提供更友好的错误信息
    if (error instanceof ModelNotAvailableError) {
      const modelError = error as ModelNotAvailableError
      const suggestion = modelError.availableModels.length > 0 
        ? `可用的模型有：${modelError.availableModels.join(', ')}。请安装 "${modelError.requestedModel}" 或使用 fallbackModels 配置。`
        : '系统中没有可用的嵌入模型。请至少安装一个嵌入模型。'
      
      throw new Error(`${modelError.message}。${suggestion}`)
    }
    
    throw error
  }
}

// ==================== 辅助函数 ====================

/**
 * 加载知识库文件
 */
async function loadKnowledgeBase(kbPath: string): Promise<{
  blocks: KnowledgeBlock[]
  fileSummaries: Map<string, FileSummaryInfo>
  kbConfig?: KnowledgeBaseConfig
}> {
  try {
    const content = await window.ipcRenderer.invoke('readFile', kbPath)
    const saveData = JSON.parse(content) as KnowledgeBaseData
    
    if (!saveData.blocks) {
      throw new KnowledgeBaseFormatError('知识库文件格式错误：缺少blocks字段')
    }
    
    const fileSummaries = new Map<string, FileSummaryInfo>()
    
    // 加载文件摘要信息
    if (saveData.config?.version === "2.0" && saveData.fileSummaries) {
      Object.entries(saveData.fileSummaries).forEach(([key, value]: [string, any]) => {
        fileSummaries.set(key, {
          content: value.content,
          vector: value.vector
        })
      })
    }
    
    return {
      blocks: saveData.blocks,
      fileSummaries,
      kbConfig: saveData.config
    }
    
  } catch (error) {
    if (error instanceof KnowledgeBaseFormatError) {
      throw error
    }
    throw new KnowledgeBaseFormatError(`加载知识库文件失败: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * 确定要使用的嵌入模型
 */
async function determineEmbedModel(
  ollama: Ollama,
  preferredModel: string | undefined,
  missingModelStrategy: 'error' | 'fallback',
  fallbackModels: string[]
): Promise<string> {
  try {
    // 获取本地可用的模型列表
    const modelsResponse = await ollama.list()
    const availableModels = modelsResponse.models.map(m => m.name)
    
    // 如果没有可用的模型
    if (availableModels.length === 0) {
      throw new ModelNotAvailableError('', [], '系统中没有可用的嵌入模型')
    }
    
    // 如果有首选模型，检查是否可用
    if (preferredModel) {
      if (availableModels.includes(preferredModel)) {
        return preferredModel
      }
      
      // 模型不可用，根据策略处理
      if (missingModelStrategy === 'error') {
        throw new ModelNotAvailableError(preferredModel, availableModels)
      }
    }
    
    // 使用回退策略：尝试回退模型列表
    for (const fallbackModel of fallbackModels) {
      if (availableModels.includes(fallbackModel)) {
        console.warn(`首选模型 "${preferredModel || '未指定'}" 不可用，使用回退模型: ${fallbackModel}`)
        return fallbackModel
      }
    }
    
    // 所有回退模型都不可用，使用第一个可用的模型
    console.warn(`所有指定模型都不可用，使用第一个可用模型: ${availableModels[0]}`)
    return availableModels[0]
    
  } catch (error) {
    // 如果获取模型列表失败
    if (error instanceof ModelNotAvailableError) {
      throw error
    }
    
    console.error('获取模型列表失败:', error)
    
    // 如果无法获取模型列表，使用默认模型尝试
    const defaultModels = ['nomic-embed-text:latest', 'all-minilm:latest']
    
    for (const model of defaultModels) {
      try {
        // 尝试使用该模型进行简单的向量化测试
        const testResponse = await ollama.embed({
          model: model,
          input: 'test',
          truncate: true
        })
        
        if (testResponse.embeddings?.[0]) {
          console.warn(`使用默认模型 ${model} (无法获取模型列表)`)
          return model
        }
      } catch (e) {
        // 这个模型不可用，尝试下一个
        continue
      }
    }
    
    throw new ModelNotAvailableError('', [], '无法确定可用的嵌入模型')
  }
}

/**
 * 计算文件摘要向量
 */
async function computeFileSummaryVectors(
  fileSummaries: Map<string, FileSummaryInfo>,
  ollama: Ollama,
  embedModel: string
): Promise<Map<string, number[]>> {
  const vectors = new Map<string, number[]>()
  const promises: Promise<void>[] = []
  
  for (const [path, summaryInfo] of fileSummaries.entries()) {
    // 如果已有向量，直接使用
    if (summaryInfo.vector) {
      vectors.set(path, summaryInfo.vector)
      continue
    }
    
    // 如果没有向量但有内容，计算向量
    if (summaryInfo.content) {
      promises.push(
        (async () => {
          try {
            const embedResponse = await ollama.embed({
              model: embedModel,
              input: summaryInfo.content,
              truncate: true,
              keep_alive: "1h"
            })
            
            if (embedResponse?.embeddings?.[0]) {
              vectors.set(path, embedResponse.embeddings[0])
            }
          } catch (error) {
            console.warn(`文件摘要向量计算失败: ${path}`, error)
          }
        })()
      )
    }
  }
  
  if (promises.length > 0) {
    await Promise.all(promises)
  }
  
  return vectors
}

/**
 * 计算综合相似度
 */
function calculateSimilarities(
  blocks: KnowledgeBlock[],
  queryEmbedding: number[],
  fileSummaryVectors: Map<string, number[]>,
  config: Required<RetrievalOptions>,
  kbConfig?: KnowledgeBaseConfig
): any[] {
  const scoredBlocks: any[] = []
  
  // ============= 修复权重计算逻辑 =============
  let effectiveSummaryWeight: number
  let effectiveSliceWeight: number
  
  if (kbConfig) {
    // 使用知识库配置的权重，但确保有效性
    const kbSummaryWeight = kbConfig.summaryWeight ?? config.summaryWeight
    const kbSliceWeight = kbConfig.sliceWeight ?? (1 - config.summaryWeight)
    
    // 确保权重在有效范围内
    effectiveSummaryWeight = Math.max(0, Math.min(1, kbSummaryWeight))
    effectiveSliceWeight = Math.max(0, Math.min(1, kbSliceWeight))
    
    // 如果两者都提供了，确保它们和为1
    if (kbConfig.summaryWeight !== undefined && kbConfig.sliceWeight !== undefined) {
      const total = effectiveSummaryWeight + effectiveSliceWeight
      if (Math.abs(total - 1) > 0.01) {
        console.warn(`知识库权重之和不等于1: ${effectiveSummaryWeight} + ${effectiveSliceWeight} = ${total}，将归一化`)
        effectiveSummaryWeight = effectiveSummaryWeight / total
        effectiveSliceWeight = effectiveSliceWeight / total
      }
    } else if (kbConfig.summaryWeight !== undefined) {
      // 只提供了 summaryWeight，计算 sliceWeight
      effectiveSliceWeight = 1 - effectiveSummaryWeight
    } else if (kbConfig.sliceWeight !== undefined) {
      // 只提供了 sliceWeight，计算 summaryWeight
      effectiveSummaryWeight = 1 - effectiveSliceWeight
    } else {
      // 两个都没提供，使用默认配置
      effectiveSummaryWeight = config.summaryWeight
      effectiveSliceWeight = 1 - config.summaryWeight
    }
  } else {
    // 没有知识库配置，使用默认配置
    effectiveSummaryWeight = config.summaryWeight
    effectiveSliceWeight = 1 - config.summaryWeight
  }
  // ============= 权重计算结束 =============
  
  // 确保最终权重有效
  if (isNaN(effectiveSummaryWeight) || isNaN(effectiveSliceWeight)) {
    console.error('权重计算错误，使用默认值')
    effectiveSummaryWeight = config.summaryWeight
    effectiveSliceWeight = 1 - config.summaryWeight
  }
  
  const totalWeight = effectiveSummaryWeight + effectiveSliceWeight
  if (Math.abs(totalWeight - 1) > 0.01) {
    console.warn(`权重归一化: ${effectiveSummaryWeight} + ${effectiveSliceWeight} = ${totalWeight}`)
    const scale = 1 / totalWeight
    effectiveSummaryWeight *= scale
    effectiveSliceWeight *= scale
  }
  
  if (config.debug) {
    console.log('相似度计算 - 权重配置:')
    console.log('- 知识库配置:', kbConfig)
    console.log('- summaryWeight:', effectiveSummaryWeight)
    console.log('- sliceWeight:', effectiveSliceWeight)
    console.log('- 总和:', effectiveSummaryWeight + effectiveSliceWeight)
  }
  
  for (const block of blocks) {
    let summaryScore = 0
    let sliceScore = 0
    let reverseScore = 0
    
    // 计算文件摘要相似度
    const fileSummaryVector = fileSummaryVectors.get(block.filePath)
    if (fileSummaryVector) {
      summaryScore = cosineSimilarity(queryEmbedding, fileSummaryVector)
    }
    
    // 计算切片相似度
    if (block.A_vector && block.A_vector.length > 0) {
      sliceScore = cosineSimilarity(queryEmbedding, block.A_vector)
    }
    
    // 计算反推相似度
    if (config.useReverseInference && block.Q_vector && block.Q_vector.length > 0) {
      reverseScore = cosineSimilarity(queryEmbedding, block.Q_vector)
    }
    
    // 计算最终相似度
    const similarity = calculateFinalSimilarity(
      summaryScore,
      sliceScore,
      reverseScore,
      config,
      effectiveSummaryWeight,
      effectiveSliceWeight
    )
    
    if (config.debug && similarity > 0) {
      //console.log(`块 "${block.label}" 相似度: ${similarity} (summary=${summaryScore}, slice=${sliceScore})`)
    }
    
    scoredBlocks.push({
      ...block,
      summaryScore,
      sliceScore,
      reverseScore,
      similarity
    })
  }
  
  return scoredBlocks
}

/**
 * 计算最终相似度
 */
function calculateFinalSimilarity(
  summaryScore: number,
  sliceScore: number,
  reverseScore: number,
  config: Required<RetrievalOptions>,
  summaryWeight: number,
  sliceWeight: number
): number {
  // 如果没有启用反推，或者没有反推向量
  if (!config.useReverseInference || reverseScore === 0) {
    return summaryWeight * summaryScore + sliceWeight * sliceScore
  }
  
  // 如果启用了反推
  const remainingWeight = 1 - config.reverseWeight
  const adjustedSummaryWeight = summaryWeight * remainingWeight
  const adjustedSliceWeight = sliceWeight * remainingWeight
  
  return adjustedSummaryWeight * summaryScore + 
         adjustedSliceWeight * sliceScore + 
         config.reverseWeight * reverseScore
}

/**
 * 构建上下文文本
 */
function buildContext(query: string, blocks: any[]): string {
  let context = query + "\n\n参考资料：\n"
  
  for (const block of blocks) {
    context += `《${block.label}》：${block.A}\n`
  }
  
  return context
}

/**
 * 检查知识库的完整性
 */
export async function validateKnowledgeBase(
  kbPath: string,
  options: {
    ollamaHost?: string
    checkModelAvailability?: boolean
  } = {}
): Promise<{
  valid: boolean
  issues: string[]
  config?: KnowledgeBaseConfig
  availableModel?: string
}> {
  const issues: string[] = []
  
  try {
    // 加载知识库
    const { blocks, kbConfig } = await loadKnowledgeBase(kbPath)
    
    // 检查基本信息
    if (blocks.length === 0) {
      issues.push('知识库为空，没有知识块')
    }
    
    // 检查配置
    if (!kbConfig) {
      issues.push('知识库缺少配置信息')
    } else {
      if (!kbConfig.embedModel) {
        issues.push('知识库缺少嵌入模型配置')
      }
      
      if (!kbConfig.version) {
        issues.push('知识库缺少版本信息')
      }
    }
    
    // 检查模型可用性
    let availableModel: string | undefined
    if (options.checkModelAvailability && kbConfig?.embedModel) {
      try {
        const ollama = new Ollama({ host: options.ollamaHost || 'http://127.0.0.1:11434' })
        const models = await ollama.list()
        const modelNames = models.models.map(m => m.name)
        
        if (!modelNames.includes(kbConfig.embedModel)) {
          issues.push(`知识库使用的嵌入模型 "${kbConfig.embedModel}" 在当前系统中不可用`)
          
          // 查找可用的替代模型
          const commonModels = ['nomic-embed-text:latest', 'all-minilm:latest', 'mxbai-embed-large:latest']
          for (const model of commonModels) {
            if (modelNames.includes(model)) {
              availableModel = model
              break
            }
          }
        } else {
          availableModel = kbConfig.embedModel
        }
      } catch (error) {
        issues.push(`无法检查模型可用性: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    
    return {
      valid: issues.length === 0,
      issues,
      config: kbConfig,
      availableModel
    }
    
  } catch (error) {
    return {
      valid: false,
      issues: [`加载知识库失败: ${error instanceof Error ? error.message : String(error)}`]
    }
  }
}

// ==================== 工具函数 ====================

/**
 * 余弦相似度计算
 * 
 * @param vecA 向量A
 * @param vecB 向量B
 * @returns 余弦相似度值（范围：-1 到 1）
 * 
 * @example
 * ```typescript
 * const similarity = cosineSimilarity([1, 2, 3], [4, 5, 6])
 * ```
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB) return 0
  if (vecA.length !== vecB.length) {
    console.warn(`向量维度不匹配: ${vecA.length}/${vecB.length}`)
    return 0
  }
  
  let dotProduct = 0
  let normA = 0
  let normB = 0
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }
  
  if (normA === 0 || normB === 0) return 0
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

// ==================== 模块导出 ====================

export default {
  retrieveKnowledge,
  validateKnowledgeBase,
  cosineSimilarity,
  ModelNotAvailableError,
  KnowledgeBaseFormatError
}