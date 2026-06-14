// utils/workflowRunner.ts

import { retrieveKnowledge, validateKnowledgeBase } from './kbRetrieval'
import { mcpManager, type McpTool } from './mcpManager'

// 定义节点类型
export type NodeType = 'reasoning' | 'decision' | 'local' | 'web' | 'text' | 'webpage' | 'python' | 'knowledge' | 'structured' | 'start' | 'end' | 'mcp'

// MCP 节点特有字段
export interface McpConfig {
  transport: 'stdio' | 'sse' | 'http'
  command?: string
  args?: string | string[]
  env?: Record<string, string> | string
  serverUrl?: string
  selectedTool?: string
  toolArguments?: Record<string, any>
  autoConnect?: boolean
  tools?: Array<{
    name: string
    description: string
    inputSchema: any
  }>
}

// 文件节点模板配置
export interface FileTemplate {
  name: string
  pattern: string
  outputName: string
}

// 文件节点处理模式
export type FileMode = 'full' | 'template'

// 决策分支接口
export interface DecisionBranch {
  id: string
  name: string
  description: string
  condition?: string // 规则决策的条件表达式
  dataTemplate?: string // 传递给下游的数据模板，默认 {input}
}

// 工作流数据结构接口
export interface NodeData {
  id: number
  name: string
  type: NodeType
  model_type: string
  model: string
  prompt: string
  result: string
  x: number
  y: number
  width: number
  height: number
  status: 'idle' | 'running' | 'success' | 'error'
  startPorts?: {
    prompt: boolean
    file: boolean
  }
  // 推理节点特有字段
  reasoningConfig?: any
  
  // 决策节点特有字段
  decisionMode?: 'llm' | 'rule'
  decisionPrompt?: string
  decisionRules?: string
  decisionConfig?: {
    mode: 'llm' | 'rule'
    prompt?: string
    rules?: string
    branches: DecisionBranch[]
    selectedBranch?: string
  }
  decisionBranches?: DecisionBranch[]
  
  // 知识库节点特有字段
  kbPath?: string
  kbQuery?: string
  kbOptions?: {
    topK?: number
    summaryWeight?: number
    useReverseInference?: boolean
    reverseWeight?: number
    embedModel?: string
    debug?: boolean
    missingModelStrategy?: 'error' | 'fallback'
    fallbackModels?: string[]
  }
  kbValidation?: {
    valid: boolean
    issues: string[]
    availableModel?: string
    config?: any
  }
  
  // 结构化节点特有字段
  structuredData?: any[]
  structuredColumns?: any[]
  structuredConfig?: any
  
  // MCP 节点特有字段
  mcpConfig?: McpConfig
  mcpConnected?: boolean
  mcpTools?: McpTool[]
  
  // 文件节点特有字段
  fileMode?: FileMode
  fileTemplates?: FileTemplate[]
  outputPorts?: {
    default: boolean;  // 默认输出端口
    ports: Array<{
      id: string;
      name: string;
      description?: string;
      enabled: boolean;
      data?: any; // 新增：存储该端口的数据
    }>;
  };
}

export interface Link {
  source: number
  target: number
  sourcePort?: string  // 源端口ID
  targetPort?: string  // 目标端口ID
  branch?: string // 决策节点的分支连接
}

export interface WorkflowData {
  items: NodeData[]
  links: Link[]
}

// 执行状态回调接口
export interface ExecutionCallback {
  // 节点执行开始
  onNodeStart?: (nodeId: number, nodeName: string, nodeType: NodeType) => void
  
  // 节点执行结束
  onNodeComplete?: (nodeId: number, nodeName: string, nodeType: NodeType, status: NodeData['status'], result: any) => void
  
  // Python节点执行错误
  onPythonError?: (nodeId: number, nodeName: string, error: string, traceback?: string) => void
  
  // 决策节点分支选择
  onDecisionBranchSelected?: (nodeId: number, nodeName: string, branchId: string, branchName: string, reason?: string) => void
  
  // MCP节点连接状态更新
  onMcpStatusChange?: (nodeId: number, connected: boolean, tools?: McpTool[]) => void
  
  // 工作流进度更新
  onProgress?: (completed: number, total: number, currentNode?: string) => void
  
  // 工作流执行完成
  onComplete?: (success: boolean, finalResult: string, aggregatedResults?: Record<string, any>) => void
  
  // 实时日志
  onLog?: (message: string, level: 'info' | 'warning' | 'error') => void
  
  // 节点状态更新（用于Vue组件响应式更新）
  onNodeStatusUpdate?: (nodeId: number, status: NodeData['status'], result?: string) => void
  
  // 工作流数据保存回调
  onSaveWorkflow?: () => void
  
  // 国际化函数
  t?: (key: string) => string
}

// 工作流运行器类
export class WorkflowRunner {
  private workflowData: WorkflowData
  private store: any
  private callbacks: ExecutionCallback
  private _isRunning: boolean = false
  private currentStep: number = 0
  private abortController: AbortController | null = null
  private decisionPaths: Map<number, string> = new Map() // 记录决策节点选中的分支
  private decisionDataTemplates: Map<number, string> = new Map() // 记录决策节点的数据模板
  private executionLogs: Array<{message: string, level: 'info' | 'warning' | 'error', timestamp: Date}> = []
  private executedNodes: Set<number> = new Set() // 记录已执行的节点
  private nodeExecutionOrder: number[] = [] // 记录节点执行顺序
  private t: (key: string) => string // 国际化函数
  
  constructor(workflowData: WorkflowData, store: any, callbacks: ExecutionCallback = {}) {
    this.workflowData = workflowData
    this.store = store
    this.callbacks = callbacks
    // 使用传入的国际化函数或默认返回 key
    this.t = callbacks.t || ((key: string) => key)
  }
  
  // 获取是否正在运行
  get isRunning(): boolean {
    return this._isRunning
  }
  
  // 获取执行日志
  get logs(): Array<{message: string, level: 'info' | 'warning' | 'error', timestamp: Date}> {
    return this.executionLogs
  }
  
  // 获取节点执行顺序
  get executionOrder(): number[] {
    return this.nodeExecutionOrder
  }
  
  // 设置工作流数据
  setWorkflowData(data: WorkflowData): void {
    this.workflowData = data
  }
  
  // 设置起始节点输入
  setStartNodeInput(inputText: string): boolean {
    const startNode = this.workflowData.items.find(item => item.type === 'start')
    if (!startNode) {
      this.log('未找到开始节点', 'error')
      return false
    }
    
    startNode.prompt = inputText
    return true
  }
  
  // 运行工作流
  async run(inputText?: string): Promise<{
    success: boolean
    result: string
    aggregatedResults: Record<string, any>
    executionStats: {
      totalNodes: number
      completedNodes: number
      failedNodes: number
      errors: Array<{nodeId: number, nodeName: string, error: string}>
      decisionPaths: Map<number, string>
      executionTime: number
      executedNodes: number[]
      executionOrder: number[]
    }
  }> {
    if (this._isRunning) {
      throw new Error('工作流正在运行中')
    }
    
    this._isRunning = true
    this.currentStep = 0
    this.executionLogs = []
    this.executedNodes.clear()
    this.nodeExecutionOrder = []
    this.decisionPaths.clear()
    this.decisionDataTemplates.clear()
    
    const startTime = Date.now()
    const errors: Array<{nodeId: number, nodeName: string, error: string}> = []
    
    // 创建中止控制器
    this.abortController = new AbortController()
    
    try {
      // 重置所有节点状态
      this.resetNodes()
      
      // 设置起始节点输入（如果提供了）
      if (inputText) {
        if (!this.setStartNodeInput(inputText)) {
          throw new Error('设置起始节点输入失败')
        }
      }
      
      // 验证工作流
      if (!this.validateWorkflow()) {
        throw new Error('工作流验证失败')
      }
      
      // 检查循环依赖
      if (this.hasCycleWithDecisions()) {
        throw new Error('检测到循环依赖')
      }
      
      // 找到开始节点
      const startNode = this.workflowData.items.find(item => item.type === 'start')
      if (!startNode) {
        throw new Error('未找到开始节点')
      }
      
      this.log('开始执行工作流', 'info')
      this.callbacks.onProgress?.(0, 100, '准备开始')
      
      // 采用智能的拓扑排序+递归依赖检查的方式执行所有必要节点
      let success = true
      const executionResult = await this.executeAllReachableNodes(startNode.id)
      success = executionResult.success
      
      // 计算执行统计
      const completedNodes = this.workflowData.items.filter(n => n.status === 'success').length
      const failedNodes = this.workflowData.items.filter(n => n.status === 'error').length
      
      // 收集错误信息
      this.workflowData.items.forEach(node => {
        if (node.status === 'error') {
          const error = this.extractErrorFromResult(node.result)
          errors.push({
            nodeId: node.id,
            nodeName: node.name,
            error: error
          })
          
          // Python节点特殊处理
          if (node.type === 'python') {
            const errorInfo = this.extractPythonErrorInfo(node.result)
            this.callbacks.onPythonError?.(node.id, node.name, errorInfo.error, errorInfo.traceback)
          }
        }
      })
      
      // 获取最终结果
      let finalResult = ''
      let aggregatedResults: Record<string, any> = {}
      
      const endNode = this.workflowData.items.find(item => item.type === 'end')
      if (endNode && endNode.status === 'success') {
        try {
          const parsedResult = JSON.parse(endNode.result)
          finalResult = parsedResult.result || ''
          aggregatedResults = parsedResult.aggregated_results || {}
        } catch {
          finalResult = endNode.result
        }
      }
      
      const executionTime = Date.now() - startTime
      const executionStats = {
        totalNodes: this.workflowData.items.length,
        completedNodes: completedNodes,
        failedNodes: failedNodes,
        errors: errors,
        decisionPaths: this.decisionPaths,
        executionTime: executionTime,
        executedNodes: Array.from(this.executedNodes),
        executionOrder: this.nodeExecutionOrder
      }
      
      const overallSuccess = success && failedNodes === 0
      
      this.log(`工作流执行${overallSuccess ? '成功' : '失败'}，耗时: ${executionTime}ms`, overallSuccess ? 'info' : 'error')
      this.callbacks.onComplete?.(overallSuccess, finalResult, aggregatedResults)
      
      return {
        success: overallSuccess,
        result: finalResult,
        aggregatedResults,
        executionStats
      }
      
    } catch (error: any) {
      this.log(`工作流执行异常: ${error.message}`, 'error')
      
      return {
        success: false,
        result: `工作流执行失败: ${error.message}`,
        aggregatedResults: {},
        executionStats: {
          totalNodes: this.workflowData.items.length,
          completedNodes: this.currentStep,
          failedNodes: errors.length + 1,
          errors: [...errors, {nodeId: -1, nodeName: '系统', error: error.message}],
          decisionPaths: this.decisionPaths,
          executionTime: Date.now() - startTime,
          executedNodes: Array.from(this.executedNodes),
          executionOrder: this.nodeExecutionOrder
        }
      }
    } finally {
      this._isRunning = false
      this.abortController = null
    }
  }
  
  // 执行所有可达节点（包含必要的依赖节点）
  private async executeAllReachableNodes(startNodeId: number): Promise<{ success: boolean; executedNodes: number[] }> {
    const executedNodes: number[] = []
    let success = true
    
    // 第一步：使用改进的方法找到所有需要执行的节点（考虑决策路径）
    const allNodesToExecute = this.getNodesToExecuteWithDecisions(startNodeId)
    
    if (allNodesToExecute.length === 0) {
      this.log('没有找到需要执行的节点', 'warning')
      return { success: false, executedNodes: [] }
    }
    
    this.log(`总共需要执行 ${allNodesToExecute.length} 个节点`, 'info')
    
    // 第二步：获取拓扑排序的执行顺序
    const executionOrder = this.getTopologicalOrderForNodesWithDecisions(allNodesToExecute)
    
    if (executionOrder.length === 0) {
      this.log('无法确定执行顺序', 'error')
      return { success: false, executedNodes: [] }
    }
    
    this.log(`执行顺序: ${executionOrder.map(id => {
      const node = this.workflowData.items.find(n => n.id === id)
      return node ? `${node.name}(${id})` : `${id}`
    }).join(' -> ')}`, 'info')
    
    // 第三步：按拓扑顺序执行所有节点
    for (const nodeId of executionOrder) {
      // 检查是否被中止
      if (this.abortController?.signal.aborted) {
        success = false
        break
      }
      
      // 执行当前节点（包含依赖检查）
      const nodeSuccess = await this.executeSingleNodeWithDependencies(nodeId)
      executedNodes.push(nodeId)
      
      if (!nodeSuccess) {
        success = false
        break
      }
    }
    
    return { success, executedNodes }
  }
  
  // 获取所有需要执行的节点（考虑决策路径）
  private getNodesToExecuteWithDecisions(startNodeId: number): number[] {
    // 使用BFS找到所有可能被执行的节点
    const allPossibleNodes = new Set<number>()
    const queue: number[] = [startNodeId]
    
    while (queue.length > 0) {
      const nodeId = queue.shift()!
      if (allPossibleNodes.has(nodeId)) {
        continue
      }
      
      allPossibleNodes.add(nodeId)
      
      // 获取当前节点的所有后续节点
      const outgoingLinks = this.workflowData.links.filter(link => link.source === nodeId)
      
      // 对于决策节点，我们需要考虑所有分支的后续节点（初步分析阶段）
      const node = this.workflowData.items.find(item => item.id === nodeId)
      if (node?.type === 'decision') {
        // 决策节点：添加所有分支的后续节点（执行时会根据决策结果选择）
        for (const link of outgoingLinks) {
          if (!allPossibleNodes.has(link.target)) {
            queue.push(link.target)
          }
        }
      } else {
        // 普通节点：添加所有后续节点
        for (const link of outgoingLinks) {
          if (!allPossibleNodes.has(link.target)) {
            queue.push(link.target)
          }
        }
      }
    }
    
    // 现在，根据当前的决策结果（可能为空）过滤节点
    return this.filterNodesByDecisionPaths(Array.from(allPossibleNodes))
  }
  
  // 根据决策路径过滤节点
  private filterNodesByDecisionPaths(allPossibleNodes: number[]): number[] {
    // 如果还没有任何决策结果，返回所有可能的节点
    if (this.decisionPaths.size === 0) {
      return allPossibleNodes
    }
    
    // 使用BFS，但根据决策路径进行过滤
    const reachableNodes = new Set<number>()
    const startNode = this.workflowData.items.find(item => item.type === 'start')
    if (!startNode) return []
    
    const queue: number[] = [startNode.id]
    
    while (queue.length > 0) {
      const nodeId = queue.shift()!
      if (reachableNodes.has(nodeId)) {
        continue
      }
      
      reachableNodes.add(nodeId)
      const outgoingLinks = this.workflowData.links.filter(link => link.source === nodeId)
      
      for (const link of outgoingLinks) {
        const sourceNode = this.workflowData.items.find(n => n.id === nodeId)
        
        // 如果是决策节点的连接，检查是否是被选中的分支
        if (sourceNode?.type === 'decision' && link.branch) {
          const selectedBranch = this.decisionPaths.get(nodeId)
          // 只添加被选中分支的后续节点
          if (selectedBranch === link.branch) {
            if (!reachableNodes.has(link.target)) {
              queue.push(link.target)
            }
          }
          // 如果决策节点还没有执行（selectedBranch为undefined），我们暂时跳过这个连接
          // 在实际执行时，executeSingleNodeWithDependencies会处理这种情况
        } else {
          // 非决策节点或没有分支标记的连接，直接添加
          if (!reachableNodes.has(link.target)) {
            queue.push(link.target)
          }
        }
      }
    }
    
    // 只返回既在allPossibleNodes中又在reachableNodes中的节点
    return Array.from(reachableNodes).filter(nodeId => allPossibleNodes.includes(nodeId))
  }
  
  // 为指定节点集合获取拓扑排序（考虑决策路径）
  private getTopologicalOrderForNodesWithDecisions(nodeIds: number[]): number[] {
    if (nodeIds.length === 0) {
      return []
    }
    
    const indegree: Record<number, number> = {}
    const adjacencyList: Record<number, number[]> = {}
    
    // 初始化
    nodeIds.forEach(nodeId => {
      indegree[nodeId] = 0
      adjacencyList[nodeId] = []
    })
    
    // 只考虑在指定节点集合内的连接
    this.workflowData.links.forEach(link => {
      if (nodeIds.includes(link.source) && nodeIds.includes(link.target)) {
        const sourceNode = this.workflowData.items.find(n => n.id === link.source)
        
        // 对于决策节点的连接，检查是否是被选中的分支
        if (sourceNode?.type === 'decision' && link.branch) {
          const selectedBranch = this.decisionPaths.get(link.source)
          // 如果决策结果已知且匹配，或者决策结果未知（执行时会处理），则添加连接
          if (!selectedBranch || selectedBranch === link.branch) {
            adjacencyList[link.source].push(link.target)
            indegree[link.target] = (indegree[link.target] || 0) + 1
          }
        } else {
          // 非决策节点，直接添加
          adjacencyList[link.source].push(link.target)
          indegree[link.target] = (indegree[link.target] || 0) + 1
        }
      }
    })
    
    // 找到入度为0的节点
    const queue: number[] = []
    nodeIds.forEach(nodeId => {
      if (indegree[nodeId] === 0) {
        queue.push(nodeId)
      }
    })
    
    const result: number[] = []
    
    while (queue.length > 0) {
      const nodeId = queue.shift()!
      result.push(nodeId)
      
      const neighbors = adjacencyList[nodeId] || []
      for (const neighbor of neighbors) {
        indegree[neighbor]--
        if (indegree[neighbor] === 0) {
          queue.push(neighbor)
        }
      }
    }
    
    // 检查是否所有节点都被处理
    if (result.length !== nodeIds.length) {
      this.log('警告：节点集合中存在循环依赖或决策分支过滤导致节点缺失', 'warning')
      // 返回能够确定顺序的节点
    }
    
    return result
  }
  
  // 带依赖检查的节点执行 - 修复了决策分支过滤问题
  private async executeSingleNodeWithDependencies(nodeId: number): Promise<boolean> {
    const node = this.workflowData.items.find(item => item.id === nodeId)
    if (!node) return false
    
    // 检查节点是否已经执行过
    if (this.executedNodes.has(nodeId)) {
      return node.status === 'success'
    }
    
    // 检查是否被中止
    if (this.abortController?.signal.aborted) {
      return false
    }
    
    // 开始节点没有前置依赖，可以直接执行
    if (node.type === 'start') {
      return await this.executeSingleNode(nodeId)
    }
    
    // 获取所有前置连接
    const incomingLinks = this.workflowData.links.filter(link => link.target === nodeId)
    
    if (incomingLinks.length === 0) {
      // 没有输入连接的节点可以直接执行
      return await this.executeSingleNode(nodeId)
    }
    
    // 检查每个前置连接，确保所有必要的前置节点都已执行
    // 修复：正确处理决策节点的分支连接
    for (const link of incomingLinks) {
      const sourceNode = this.workflowData.items.find(n => n.id === link.source)
      if (!sourceNode) continue
      
      // 检查决策节点的分支连接（关键修复）
      if (link.branch && sourceNode.type === 'decision') {
        // 如果决策节点还没有执行，先执行它
        if (!this.executedNodes.has(sourceNode.id)) {
          const sourceSuccess = await this.executeSingleNodeWithDependencies(sourceNode.id)
          if (!sourceSuccess) {
            this.log(`节点 ${node.name} 的前置决策节点 ${sourceNode.name} 执行失败`, 'error')
            return false
          }
        }
        
        // 获取决策结果
        const selectedBranch = this.decisionPaths.get(sourceNode.id)
        
        // 关键修复：只有当分支匹配时才需要这个依赖
        if (selectedBranch !== link.branch) {
          // 跳过这个连接，因为不是选中的分支
          // 这意味着当前节点可能还有其他输入连接，继续检查其他连接
          continue
        }
        // 如果分支匹配，继续检查源节点是否已成功执行
      }
      
      // 如果源节点还没有执行，先执行它
      if (!this.executedNodes.has(link.source)) {
        const sourceSuccess = await this.executeSingleNodeWithDependencies(link.source)
        if (!sourceSuccess) {
          this.log(`节点 ${node.name} 的前置节点 ${sourceNode.name} 执行失败`, 'error')
          return false
        }
      }
    }
    
    // 检查节点是否还有有效的输入连接（对于决策分支过滤后的情况）
    // 如果节点只有决策节点的分支连接，且所有连接都被跳过，则这个节点不应该执行
    const hasValidInput = incomingLinks.some(link => {
      const sourceNode = this.workflowData.items.find(n => n.id === link.source)
      if (!sourceNode) return false
      
      if (link.branch && sourceNode.type === 'decision') {
        const selectedBranch = this.decisionPaths.get(sourceNode.id)
        return selectedBranch === link.branch
      }
      return true
    })
    
    if (!hasValidInput && incomingLinks.length > 0) {
      this.log(`节点 ${node.name} 没有有效的输入连接（决策分支不匹配），跳过执行`, 'info')
      // 标记节点为跳过状态
      node.status = 'idle'
      node.result = this.t('node_skipped')
      this.callbacks.onNodeStatusUpdate?.(node.id, 'idle', node.result)
      // 虽然跳过，但不视为失败
      return true
    }
    
    // 所有必要的前置节点都已执行，执行当前节点
    return await this.executeSingleNode(nodeId)
  }
  
  // 停止工作流
  stop(): void {
    if (this.abortController) {
      this.abortController.abort()
    }
    this._isRunning = false
  }
  
  // 获取当前执行状态
  getExecutionStatus(): {
    isRunning: boolean
    currentStep: number
    totalSteps: number
    currentNode?: string
    progress: number
    activeDecisionPaths: Map<number, string>
    executionOrder: number[]
  } {
    return {
      isRunning: this._isRunning,
      currentStep: this.currentStep,
      totalSteps: this.workflowData.items.length,
      currentNode: undefined,
      progress: this.workflowData.items.length > 0 ? 
        (this.currentStep / this.workflowData.items.length) * 100 : 0,
      activeDecisionPaths: this.decisionPaths,
      executionOrder: this.nodeExecutionOrder
    }
  }
  
  // 获取工作流错误信息
  getErrors(): Array<{nodeId: number, nodeName: string, error: string}> {
    const errors: Array<{nodeId: number, nodeName: string, error: string}> = []
    
    this.workflowData.items.forEach(node => {
      if (node.status === 'error') {
        errors.push({
          nodeId: node.id,
          nodeName: node.name,
          error: this.extractErrorFromResult(node.result)
        })
      }
    })
    
    return errors
  }
  
  // 执行单个节点
  async executeSingleNode(nodeId: number): Promise<boolean> {
    const node = this.workflowData.items.find(item => item.id === nodeId)
    if (!node) return false
    
    // 检查节点是否正在运行
    if (node.status === 'running') {
      this.log(`节点 ${node.name} 正在运行中，请稍后`, 'warning')
      return false
    }
    
    // 检查是否被中止
    if (this.abortController?.signal.aborted) {
      return false
    }
    
    // 保存原始运行状态
    const wasRunning = this._isRunning
    const oldAbortController = this.abortController
    
    try {
      // 临时设置运行状态
      this._isRunning = true
      this.abortController = new AbortController()
      
      // 更新节点状态为运行中
      node.status = 'running'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'running', node.result)
      this.callbacks.onNodeStart?.(node.id, node.name, node.type)
      
      // 直接执行节点逻辑，不经过 executeNode（避免 executedNodes 检查）
      const success = await this.executeNodeDirect(node)
      
      if (success) {
        // 更新 executedNodes 记录（用于工作流整体运行时的依赖追踪）
        this.executedNodes.add(nodeId)
        // 确保节点顺序记录
        if (!this.nodeExecutionOrder.includes(nodeId)) {
          this.nodeExecutionOrder.push(nodeId)
        }
      }
      
      return success
      
    } catch (error: any) {
      node.status = 'error'
      node.result = JSON.stringify({
        error: error.message,
        type: node.type,
        timestamp: new Date().toISOString()
      })
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
      this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result)
      this.callbacks.onSaveWorkflow?.()
      return false
      
    } finally {
      // 恢复原始运行状态
      this._isRunning = wasRunning
      if (oldAbortController) {
        this.abortController = oldAbortController
      } else {
        this.abortController = null
      }
    }
  }

  // 新增：直接执行节点逻辑的方法（不检查 executedNodes）
  private async executeNodeDirect(node: NodeData): Promise<boolean> {
    try {
      let success = false
      
      // 执行节点逻辑
      switch (node.type) {
        case 'start':
          success = await this.runStartNode(node)
          break
        case 'end':
          success = await this.runEndNode(node)
          break
        case 'reasoning':
          success = await this.runReasoningNode(node)
          break
        case 'decision':
          success = await this.runDecisionNode(node)
          break
        case 'text':
          success = await this.runTextNode(node)
          break
        case 'structured':
          success = await this.runStructuredNode(node)
          break
        case 'webpage':
          success = await this.runWebpageNode(node)
          break
        case 'web':
          success = await this.runWebNode(node)
          break
        case 'local':
          success = await this.runLocalNode(node)
          break
        case 'python':
          success = await this.runPythonNode(node)
          break
        case 'knowledge':
          success = await this.runKnowledgeNode(node)
          break
        case 'mcp':
          success = await this.runMcpNode(node)
          break
        default:
          throw new Error(`未知节点类型: ${node.type}`)
      }
      
      if (success) {
        this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'success', node.result)
        this.callbacks.onSaveWorkflow?.()
      }
      
      return success
      
    } catch (error: any) {
      node.status = 'error'
      node.result = JSON.stringify({
        error: error.message,
        type: node.type,
        timestamp: new Date().toISOString()
      })
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
      this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result)
      this.callbacks.onSaveWorkflow?.()
      return false
    }
  }
  
  // MCP节点专用方法
  async testMcpConnection(nodeId: number): Promise<{ success: boolean; error?: string; tools?: McpTool[] }> {
    const node = this.workflowData.items.find(item => item.id === nodeId)
    if (!node || !node.mcpConfig) {
      return { success: false, error: '节点或MCP配置不存在' }
    }
    
    try {
      return await mcpManager.testConnection(node.mcpConfig)
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
  
  async connectMcpNode(nodeId: number): Promise<boolean> {
    const node = this.workflowData.items.find(item => item.id === nodeId)
    if (!node || !node.mcpConfig) {
      this.log(`MCP节点 ${nodeId} 配置不存在`, 'error')
      return false
    }
    
    try {
      const success = await mcpManager.connect(nodeId, node.mcpConfig)
      if (success) {
        node.mcpConnected = true
        node.mcpTools = mcpManager.getTools(nodeId)
        this.callbacks.onMcpStatusChange?.(nodeId, true, node.mcpTools)
        this.log(`MCP节点 ${node.name} 连接成功，工具数量: ${node.mcpTools?.length || 0}`, 'info')
      }
      return success
    } catch (error: any) {
      this.log(`MCP节点连接失败: ${error.message}`, 'error')
      return false
    }
  }
  
  async disconnectMcpNode(nodeId: number): Promise<void> {
    try {
      await mcpManager.disconnect(nodeId)
      const node = this.workflowData.items.find(item => item.id === nodeId)
      if (node) {
        node.mcpConnected = false
        this.callbacks.onMcpStatusChange?.(nodeId, false)
        this.log(`MCP节点 ${node.name} 已断开连接`, 'info')
      }
    } catch (error: any) {
      this.log(`断开MCP连接失败: ${error.message}`, 'error')
    }
  }
  
  async refreshMcpTools(nodeId: number): Promise<McpTool[]> {
    try {
      const tools = await mcpManager.refreshTools(nodeId)
      const node = this.workflowData.items.find(item => item.id === nodeId)
      if (node) {
        node.mcpTools = tools
        this.callbacks.onMcpStatusChange?.(nodeId, true, tools)
      }
      return tools
    } catch (error: any) {
      this.log(`刷新MCP工具失败: ${error.message}`, 'error')
      return []
    }
  }
  
  async callMcpTool(nodeId: number, toolName: string, arguments_: Record<string, any> = {}): Promise<any> {
    try {
      return await mcpManager.callTool(nodeId, toolName, arguments_)
    } catch (error: any) {
      throw new Error(`调用MCP工具失败: ${error.message}`)
    }
  }
  
  // 私有方法
  private log(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
    const logEntry = {
      message,
      level,
      timestamp: new Date()
    }
    this.executionLogs.push(logEntry)
    
    console.log(`[WorkflowRunner ${level.toUpperCase()}] ${message}`)
    this.callbacks.onLog?.(message, level)
  }
  
  public resetNodes(): void {
    // 获取等待状态文本映射
    const getWaitingText = (type: NodeType): string => {
      const waitingTextMap: Record<NodeType, string> = {
        'text': this.t('waiting'),
        'local': this.t('waiting'),
        'web': this.t('waiting_search'),
        'webpage': this.t('waiting_fetch'),
        'reasoning': this.t('waiting_reasoning'),
        'decision': this.t('waiting_decision'),
        'python': this.t('waiting_execute'),
        'knowledge': this.t('waiting_retrieval'),
        'structured': this.t('waiting_structured'),
        'mcp': this.t('waiting'),
        'start': this.t('waiting_start'),
        'end': this.t('waiting_end')
      }
      return waitingTextMap[type] || this.t('waiting')
    }
    
    this.workflowData.items.forEach(node => {
      node.status = 'idle'
      if (node.type !== 'start' && node.type !== 'end') {
        node.result = getWaitingText(node.type)
      }
      if (node.type === 'start') {
        node.result = this.t('waiting_start')
      }
      if (node.type === 'end') {
        node.result = this.t('waiting_end')
      }
      this.callbacks.onNodeStatusUpdate?.(node.id, 'idle', node.result)
    })
  }
  
  private validateWorkflow(): boolean {
    const startCount = this.workflowData.items.filter(item => item.type === 'start').length
    const endCount = this.workflowData.items.filter(item => item.type === 'end').length
    
    if (startCount !== 1) {
      this.log(`开始节点数量不正确: ${startCount} (需要1个)`, 'error')
      return false
    }
    
    if (endCount !== 1) {
      this.log(`结束节点数量不正确: ${endCount} (需要1个)`, 'error')
      return false
    }
    
    // 验证决策节点的分支配置
    const decisionNodes = this.workflowData.items.filter(item => item.type === 'decision')
    for (const node of decisionNodes) {
      if (!node.decisionBranches || node.decisionBranches.length < 2) {
        this.log(`决策节点 ${node.name} 的分支数量不足 (${node.decisionBranches?.length || 0})，至少需要2个分支`, 'error')
        return false
      }
      
      if (node.decisionBranches.length > 10) {
        this.log(`决策节点 ${node.name} 的分支数量过多 (${node.decisionBranches.length})，最多支持10个分支`, 'error')
        return false
      }
    }
    
    // 验证MCP节点的配置
    const mcpNodes = this.workflowData.items.filter(item => item.type === 'mcp')
    for (const node of mcpNodes) {
      if (!node.mcpConfig) {
        this.log(`MCP节点 ${node.name} 缺少配置`, 'error')
        return false
      }
      
      const config = node.mcpConfig
      if (!config.transport) {
        this.log(`MCP节点 ${node.name} 缺少传输类型配置`, 'error')
        return false
      }
      
      if (config.transport === 'stdio' && !config.command) {
        this.log(`MCP节点 ${node.name} (stdio模式) 缺少命令配置`, 'error')
        return false
      }
      
      if ((config.transport === 'sse' || config.transport === 'http') && !config.serverUrl) {
        this.log(`MCP节点 ${node.name} (${config.transport}模式) 缺少服务器URL`, 'error')
        return false
      }
      
      if (config.selectedTool && (!node.mcpTools || !node.mcpTools.some(tool => tool.name === config.selectedTool))) {
        this.log(`MCP节点 ${node.name} 选择的工具不存在: ${config.selectedTool}`, 'warning')
      }
    }
    
    return true
  }
  
  // 检查循环依赖（考虑决策分支）
  private hasCycleWithDecisions(): boolean {
    const visited = new Set<number>()
    const recStack = new Set<number>()
    const adjacencyList: Record<number, Array<{target: number, branch?: string}>> = {}
    
    // 构建邻接表（考虑决策分支）
    this.workflowData.items.forEach(node => {
      adjacencyList[node.id] = []
    })
    
    this.workflowData.links.forEach(link => {
      if (adjacencyList[link.source]) {
        adjacencyList[link.source].push({
          target: link.target,
          branch: link.branch
        })
      }
    })
    
    const dfs = (nodeId: number): boolean => {
      if (recStack.has(nodeId)) return true
      if (visited.has(nodeId)) return false
      
      visited.add(nodeId)
      recStack.add(nodeId)
      
      const neighbors = adjacencyList[nodeId] || []
      for (const neighbor of neighbors) {
        if (dfs(neighbor.target)) return true
      }
      
      recStack.delete(nodeId)
      return false
    }
    
    for (const node of this.workflowData.items) {
      if (dfs(node.id)) return true
    }
    
    return false
  }
  
  private async executeNode(nodeId: number): Promise<boolean> {
    const node = this.workflowData.items.find(item => item.id === nodeId)
    if (!node) return false

    // 检查节点是否已经执行过
    if (this.executedNodes.has(nodeId)) {
      return node.status === 'success'
    }

    node.status = 'running'
    this.callbacks.onNodeStatusUpdate?.(node.id, 'running', node.result)
    this.callbacks.onNodeStart?.(node.id, node.name, node.type)

    try {
      // 执行节点逻辑
      switch (node.type) {
        case 'start':
          return await this.runStartNode(node)
        case 'end':
          return await this.runEndNode(node)
        case 'reasoning':
          return await this.runReasoningNode(node)
        case 'decision':
          return await this.runDecisionNode(node)
        case 'text':
          return await this.runTextNode(node)
        case 'structured':
          return await this.runStructuredNode(node)
        case 'webpage':
          return await this.runWebpageNode(node)
        case 'web':
          return await this.runWebNode(node)
        case 'local':
          return await this.runLocalNode(node)
        case 'python':
          return await this.runPythonNode(node)
        case 'knowledge':
          return await this.runKnowledgeNode(node)
        case 'mcp':
          return await this.runMcpNode(node)
        default:
          throw new Error(`未知节点类型: ${node.type}`)
      }
    } catch (error: any) {
      node.status = 'error'
      node.result = JSON.stringify({
        error: error.message,
        type: node.type,
        timestamp: new Date().toISOString()
      })
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
      this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result)
      return false
    }
  }
  
  // 各类型节点的执行方法
  private async runStartNode(node: NodeData): Promise<boolean> {
    // 解析输入参数（支持两个参数：提示词和文件路径）
    let promptText = '';
    let filePath = '';
    
    if (node.prompt && node.prompt.trim() !== '') {
      const parts = node.prompt.split('|').map(part => part.trim());
      if (parts.length === 2) {
        promptText = parts[0];
        filePath = parts[1];
      } else {
        promptText = node.prompt;
      }
    }
    
    if (!promptText || promptText.trim() === '') {
      node.result = JSON.stringify({
        result: this.t('input_text_required'),
        type: 'start',
        success: false,
        error: this.t('input_text_empty'),
        outputByPort: { default: '' }
      });
      node.status = 'error';
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result);
      this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result);
      return false;
    }
    
    let fileContent = '';
    if (filePath && filePath.trim() !== '') {
      try {
        fileContent = await window.ipcRenderer.invoke('readFile', filePath);
      } catch (error: any) {
        node.result = JSON.stringify({
          result: `${this.t('file_read_error')}: ${error.message}`,
          type: 'start',
          success: false,
          error: error.message,
          outputByPort: { default: '' }
        });
        node.status = 'error';
        this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result);
        this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result);
        return false;
      }
    }
    
    const startResult = {
      type: 'start',
      success: true,
      prompt: promptText,
      filePath: filePath || null,
      fileContent: fileContent || null,
      result: fileContent ? `${promptText}\n\n${this.t('file_content')}:\n${fileContent}` : promptText,
      outputByPort: {
        default: fileContent ? `${promptText}\n\n${this.t('file_content')}:\n${fileContent}` : promptText,
        prompt: promptText,
        file: fileContent || null
      },
      timestamp: new Date().toISOString()
    };
    
    node.result = JSON.stringify(startResult);
    node.status = 'success';
    this.callbacks.onNodeStatusUpdate?.(node.id, 'success', node.result);
    this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'success', node.result);
    this.callbacks.onSaveWorkflow?.();
    return true;
  }
  
  private async runEndNode(node: NodeData): Promise<boolean> {
    // 获取所有连接到结束节点的上游节点的结果
    const sourceLinks = this.workflowData.links.filter(link => link.target === node.id)
    const results: Record<string, any> = {}
    
    for (const link of sourceLinks) {
      const sourceNode = this.workflowData.items.find(n => n.id === link.source)
      if (!sourceNode) continue
      
      // 检查源节点是否已执行
      if (!this.executedNodes.has(sourceNode.id)) {
        continue
      }
      
      // 获取源节点的数据（考虑端口）
      const nodeData = this.getSourceNodeData(sourceNode.id, link.sourcePort)
      if (nodeData !== null) {
        results[`node_${sourceNode.id}`] = nodeData
      }
    }
    
    // 构建汇总结果
    const summaryResult = {
      type: 'end',
      success: true,
      result: '',
      aggregated_results: results,
      decision_paths: Object.fromEntries(this.decisionPaths),
      timestamp: new Date().toISOString()
    }
    
    // 将结果转换为字符串格式
    if (Object.keys(results).length > 0) {
      let outputText = ''
      
      if (this.decisionPaths.size > 0) {
        outputText += `## ${this.t('decision_paths')}\n\n`
        this.decisionPaths.forEach((branchId, nodeId) => {
          const decisionNode = this.workflowData.items.find(n => n.id === nodeId)
          if (decisionNode) {
            const branch = decisionNode.decisionBranches?.find(b => b.id === branchId)
            outputText += `- **${decisionNode.name}** → ${branch?.name || branchId}\n`
          }
        })
        outputText += '\n'
      }
      
      Object.entries(results).forEach(([nodeKey, nodeResult]) => {
        const nodeId = nodeKey.replace('node_', '')
        const sourceNode = this.workflowData.items.find(n => n.id === parseInt(nodeId))
        const nodeName = sourceNode?.name || `${this.t('node')} ${nodeId}`
        
        outputText += `\n## ${nodeName}\n`
        
        if (typeof nodeResult === 'string') {
          outputText += nodeResult
        } else {
          try {
            outputText += JSON.stringify(nodeResult, null, 2)
          } catch {
            outputText += String(nodeResult)
          }
        }
        outputText += '\n'
      })
      
      summaryResult.result = outputText
    } else {
      summaryResult.result = this.t('no_input_to_end')
    }
    
    node.result = JSON.stringify(summaryResult)
    node.status = 'success'
    this.callbacks.onNodeStatusUpdate?.(node.id, 'success', node.result)
    this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'success', node.result)
    this.callbacks.onSaveWorkflow?.()
    return true
  }
  
  private async runReasoningNode(node: NodeData): Promise<boolean> {
    // 验证模型配置
    const validation = this.validateModelConfig(node)
    if (!validation.valid) {
      node.result = validation.message
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
      this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result)
      return false
    }
    
    // 获取上游数据（考虑端口）
    const contexts = await this.getNodeContextWithPorts(node.id)
    console.log(contexts)
    // 合并所有上下文数据
    let combinedContext = ''
    if (contexts.length > 0) {
      combinedContext = `${this.t('relevant_context')}：\n\n` + contexts.join('\n\n') + '\n\n'
    }
    
    const fullPrompt = combinedContext + `${this.t('user_instruction')}：` + node.prompt
    console.log(fullPrompt)
    const messages = [{ role: 'user', content: fullPrompt }]
    
    const originalConfig = JSON.parse(JSON.stringify(this.store.AIconfig?.llm || {}))
    
    let streamContent = ''
    
    try {
      if (this.store.AIconfig?.llm) {
        this.store.AIconfig.llm.type = node.model_type
      }
      
      switch (node.model_type) {
        case 'ollama':
          if (node.model && this.store.AIconfig?.llm?.ollama) {
            this.store.AIconfig.llm.ollama.model = node.model
          }
          break
        case 'openai':
        case 'deepseek':
          if (this.store.AIconfig?.llm?.openai) {
            this.store.AIconfig.llm.openai.model = node.model || this.store.AIconfig.llm.openai.model
          }
          break
        case 'anthropic':
          if (this.store.AIconfig?.llm?.anthropic) {
            this.store.AIconfig.llm.anthropic.model = node.model || this.store.AIconfig.llm.anthropic.model
          }
          break
        case 'google':
          if (this.store.AIconfig?.llm?.google) {
            this.store.AIconfig.llm.google.model = node.model || this.store.AIconfig.llm.google.model
          }
          break
        case 'azure':
          if (this.store.AIconfig?.llm?.azure) {
            this.store.AIconfig.llm.azure.deployment = node.model || this.store.AIconfig.llm.azure.deployment
          }
          break
        case 'custom':
          if (this.store.AIconfig?.llm?.custom) {
            this.store.AIconfig.llm.custom.model = node.model || ''
          }
          break
      }
      
      const aiResponse = await new Promise<string>((resolve, reject) => {
        if (!this.store.sendToAI) {
          reject(new Error('store.sendToAI 不存在'))
          return
        }
        
        this.store.sendToAI(
          messages,
          {
            onStream: (chunk: string) => {
              streamContent += chunk
              const streamingResult = JSON.stringify({
                result: streamContent,
                model: node.model,
                model_type: node.model_type,
                timestamp: new Date().toISOString(),
                type: 'reasoning',
                streaming: true
              })
              node.result = streamingResult
              this.callbacks.onNodeStatusUpdate?.(node.id, 'running', streamingResult)
            },
            onComplete: (fullContent: string) => {
              resolve(fullContent)
            },
            onError: (error: Error) => {
              reject(error)
            }
          }
        ).catch(reject)
      })
      
      node.result = JSON.stringify({
        result: aiResponse,
        model: node.model,
        model_type: node.model_type,
        timestamp: new Date().toISOString(),
        type: 'reasoning'
      })
      
      node.status = 'success'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'success', node.result)
      this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'success', node.result)
      this.callbacks.onSaveWorkflow?.()
      return true
      
    } catch (error: any) {
      node.result = JSON.stringify({
        result: `${this.t('reasoning_error')}: ${error.message}`,
        model: node.model,
        model_type: node.model_type,
        timestamp: new Date().toISOString(),
        type: 'reasoning',
        error: error.message
      })
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
      this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result)
      this.callbacks.onSaveWorkflow?.()
      return false
      
    } finally {
      if (this.store.AIconfig?.llm) {
        this.store.AIconfig.llm = originalConfig
      }
    }
  }
  
  private async runDecisionNode(node: NodeData): Promise<boolean> {
    if (!node.decisionBranches || node.decisionBranches.length < 2) {
      node.result = JSON.stringify({
        result: this.t('decision_need_branches'),
        type: 'decision',
        success: false,
        error: this.t('insufficient_branches')
      })
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
      this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result)
      return false
    }
    
    try {
      // 获取上游节点的数据作为决策依据（考虑端口）
      const contexts = await this.getNodeContextWithPorts(node.id)
      let inputData = ''
      
      if (contexts.length > 0) {
        inputData = contexts.join('\n\n')
      }
      
      let selectedBranchId = ''
      let reason = ''
      const mode = node.decisionMode || 'llm'
      
      if (mode === 'llm') {
        // LLM决策模式
        if (!node.model_type || !node.model) {
          node.result = JSON.stringify({
            result: this.t('configure_llm_model'),
            type: 'decision',
            success: false,
            error: this.t('model_not_configured')
          })
          node.status = 'error'
          this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
          this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result)
          return false
        }
        
        // 构建分支选择提示词
        const branchesInfo = node.decisionBranches.map(branch => 
          `${this.t('branch_id')}: ${branch.id}\n${this.t('branch_name')}: ${branch.name}\n${this.t('description')}: ${branch.description || this.t('none')}`
        ).join('\n\n')
        
        const decisionPrompt = node.decisionPrompt || 
          `${this.t('decision_prompt_template')}\n\n${this.t('input_content')}：{input}\n\n${this.t('available_branches')}：{branches}\n\n${this.t('return_branch_id_only')}`
        
        const fullPrompt = decisionPrompt
          .replace('{input}', inputData)
          .replace('{branches}', branchesInfo)
        
        const messages = [{ role: 'user', content: fullPrompt }]
        
        const originalConfig = JSON.parse(JSON.stringify(this.store.AIconfig?.llm || {}))
        
        try {
          if (this.store.AIconfig?.llm) {
            this.store.AIconfig.llm.type = node.model_type
          }
          
          // 设置模型
          switch (node.model_type) {
            case 'ollama':
              if (node.model && this.store.AIconfig?.llm?.ollama) {
                this.store.AIconfig.llm.ollama.model = node.model
              }
              break
            case 'openai':
            case 'deepseek':
              if (this.store.AIconfig?.llm?.openai) {
                this.store.AIconfig.llm.openai.model = node.model || this.store.AIconfig.llm.openai.model
              }
              break
          }
          
          const aiResponse = await new Promise<string>((resolve, reject) => {
            if (!this.store.sendToAI) {
              reject(new Error('store.sendToAI 不存在'))
              return
            }
            
            this.store.sendToAI(
              messages,
              {
                onComplete: (fullContent: string) => {
                  resolve(fullContent)
                },
                onError: (error: Error) => {
                  reject(error)
                }
              }
            ).catch(reject)
          })
          
          // 从响应中提取分支ID
          selectedBranchId = this.extractBranchIdFromResponse(aiResponse, node.decisionBranches)
          reason = `LLM: ${aiResponse}`
          
        } finally {
          if (this.store.AIconfig?.llm) {
            this.store.AIconfig.llm = originalConfig
          }
        }
        
      } else if (mode === 'rule') {
        // 规则决策模式
        if (!node.decisionRules) {
          node.result = JSON.stringify({
            result: this.t('configure_decision_rules'),
            type: 'decision',
            success: false,
            error: this.t('rules_not_configured')
          })
          node.status = 'error'
          this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
          this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result)
          return false
        }
        
        try {
          const rules = JSON.parse(node.decisionRules)
          if (!Array.isArray(rules)) {
            throw new Error(this.t('rules_must_be_array'))
          }
          
          // 评估规则
          for (const rule of rules) {
            if (rule.condition && rule.branch) {
              try {
                // 创建一个安全的评估环境
                const safeEval = (condition: string, context: any): boolean => {
                  try {
                    if (condition === 'true') return true
                    if (condition === 'false') return false
                    
                    // 检查输入长度
                    if (condition.includes('input.length')) {
                      const match = condition.match(/input\.length\s*([><=!]+)\s*(\d+)/)
                      if (match) {
                        const operator = match[1]
                        const value = parseInt(match[2])
                        const inputLength = inputData.length
                        
                        switch (operator) {
                          case '>': return inputLength > value
                          case '<': return inputLength < value
                          case '>=': return inputLength >= value
                          case '<=': return inputLength <= value
                          case '==': return inputLength === value
                          case '!=': return inputLength !== value
                        }
                      }
                    }
                    
                    // 检查是否包含关键词
                    if (condition.includes('input.includes')) {
                      const match = condition.match(/input\.includes\('([^']+)'\)/)
                      if (match) {
                        const keyword = match[1]
                        return inputData.includes(keyword)
                      }
                    }
                    
                    return false
                  } catch {
                    return false
                  }
                }
                
                if (safeEval(rule.condition, { input: inputData })) {
                  selectedBranchId = rule.branch
                  reason = `${this.t('rule_match')}: ${rule.condition}`
                  break
                }
              } catch (error) {
                console.error('规则评估失败:', error)
                continue
              }
            }
          }
          
          if (!selectedBranchId && rules.length > 0) {
            // 如果没有规则匹配，使用最后一个规则（通常是默认规则）
            const lastRule = rules[rules.length - 1]
            if (lastRule.branch) {
              selectedBranchId = lastRule.branch
              reason = this.t('default_rule')
            }
          }
          
        } catch (error: any) {
          node.result = JSON.stringify({
            result: `${this.t('rule_parse_failed')}: ${error.message}`,
            type: 'decision',
            success: false,
            error: error.message
          })
          node.status = 'error'
          this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
          this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result)
          return false
        }
      }
      
      // 验证选中的分支是否有效
      if (!selectedBranchId || !node.decisionBranches.some(branch => branch.id === selectedBranchId)) {
        selectedBranchId = node.decisionBranches[0].id
        reason = this.t('default_branch_no_valid')
      }
      
      // 记录决策结果
      this.decisionPaths.set(node.id, selectedBranchId)
      
      const selectedBranch = node.decisionBranches.find(branch => branch.id === selectedBranchId)
      
      // 存储数据模板
      if (selectedBranch?.dataTemplate) {
        this.decisionDataTemplates.set(node.id, selectedBranch.dataTemplate)
      } else {
        this.decisionDataTemplates.set(node.id, '{input}')
      }
      
      // 触发回调
      this.callbacks.onDecisionBranchSelected?.(
        node.id,
        node.name,
        selectedBranchId,
        selectedBranch?.name || selectedBranchId,
        reason
      )
      
      const formattedResult = {
        type: 'decision',
        success: true,
        mode: mode,
        selectedBranch: selectedBranchId,
        selectedBranchName: selectedBranch?.name || selectedBranchId,
        reason: reason,
        dataTemplate: this.decisionDataTemplates.get(node.id),
        allBranches: node.decisionBranches,
        inputPreview: inputData,
        timestamp: new Date().toISOString()
      }
      
      node.result = JSON.stringify(formattedResult)
      node.status = 'success'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'success', node.result)
      this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'success', node.result)
      this.callbacks.onSaveWorkflow?.()
      return true
      
    } catch (error: any) {
      node.result = JSON.stringify({
        result: `${this.t('decision_failed')}: ${error.message}`,
        type: 'decision',
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
      this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result)
      this.callbacks.onSaveWorkflow?.()
      return false
    }
  }
  
  private async runTextNode(node: NodeData): Promise<boolean> {
    if (!node.prompt || node.prompt.trim() === '') {
      node.result = JSON.stringify({
        result: this.t('enter_text'),
        status: 'error'
      })
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
      this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result)
      return false
    }
    
    node.result = JSON.stringify({
      result: node.prompt,
      type: 'text'
    })
    
    node.status = 'success'
    this.callbacks.onNodeStatusUpdate?.(node.id, 'success', node.result)
    this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'success', node.result)
    this.callbacks.onSaveWorkflow?.()
    return true
  }
  
  private async runStructuredNode(node: NodeData): Promise<boolean> {
    // 简化的结构化节点执行
    if (!node.structuredData || node.structuredData.length === 0) {
      node.result = JSON.stringify({
        result: this.t('empty_table'),
        type: 'structured',
        success: false,
        error: this.t('empty_table')
      })
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
      this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result)
      return false
    }
    
    try {
      // 这里简化为将表格数据转换为JSON
      const output = JSON.stringify(node.structuredData, null, 2)
      
      const formattedResult = {
        type: 'structured',
        success: true,
        result: output,
        timestamp: new Date().toISOString()
      }
      
      node.result = JSON.stringify(formattedResult)
      node.status = 'success'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'success', node.result)
      this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'success', node.result)
      this.callbacks.onSaveWorkflow?.()
      return true
      
    } catch (error: any) {
      node.result = JSON.stringify({
        result: `${this.t('structured_error')}: ${error.message}`,
        type: 'structured',
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
      this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result)
      this.callbacks.onSaveWorkflow?.()
      return false
    }
  }
  
  private async runWebpageNode(node: NodeData): Promise<boolean> {
    if (!node.prompt || node.prompt.trim() === '' || node.prompt === 'https://') {
      node.result = this.t('enter_url')
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
      this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result)
      return false
    }
    
    try {
      const url = `https://r.jina.ai/${node.prompt}`
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const content = await response.text()
    
      node.result = JSON.stringify({
        result: content,
        url: node.prompt,
        timestamp: new Date().toISOString(),
        length: content.length
      })
      
      node.status = 'success'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'success', node.result)
      this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'success', node.result)
      this.callbacks.onSaveWorkflow?.()
      return true
    } catch (error: any) {
      node.result = `${this.t('fetch_error')}: ${error.message}`
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
      this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result)
      this.callbacks.onSaveWorkflow?.()
      return false
    }
  }
  
  private async runWebNode(node: NodeData): Promise<boolean> {
    if (!node.prompt || node.prompt.trim() === '') {
      node.result = this.t('enter_search_keywords')
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
      this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result)
      return false
    }
    
    try {
      const searchUrl = `https://s.jina.ai/?q=${encodeURIComponent(node.prompt)}`
      
      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer jina_dc3c60cad6c248a2b4274e4ca6cf205biTDzWeLNM2Mz8bBOIKYXlUMfnnwF',
          'X-Respond-With': 'no-content',
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const content = await response.text()
    
      node.result = JSON.stringify({
        result: content,
        query: node.prompt,
        timestamp: new Date().toISOString(),
        source: 'jina_ai_search'
      })
      
      node.status = 'success'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'success', node.result)
      this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'success', node.result)
      this.callbacks.onSaveWorkflow?.()
      return true
    } catch (error: any) {
      node.result = `${this.t('search_error')}: ${error.message}`
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
      this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result)
      this.callbacks.onSaveWorkflow?.()
      return false
    }
  }
  
  private async runLocalNode(node: NodeData): Promise<boolean> {
    let filePath = node.prompt;
    
    if (!filePath || filePath.trim() === '' || filePath === this.t('drag_file')) {
      const contexts = await this.getNodeContextWithPorts(node.id);
      if (contexts.length > 0) {
        for (const context of contexts) {
          try {
            const parsed = JSON.parse(context);
            if (parsed && typeof parsed === 'object') {
              if (parsed.filePath) {
                filePath = parsed.filePath;
                break;
              } else if (parsed.result && typeof parsed.result === 'string' && 
                        (parsed.result.includes('\\') || parsed.result.includes('/'))) {
                const pathMatch = parsed.result.match(/([A-Za-z]:[\\/][^"\n]*|\/[^"\n]*)/);
                if (pathMatch) {
                  filePath = pathMatch[0];
                  break;
                }
              }
            }
          } catch {
            continue;
          }
        }
      }
      
      if (!filePath || filePath.trim() === '') {
        node.result = JSON.stringify({
          result: this.t('select_file_or_connect_upstream'),
          type: 'local',
          success: false,
          error: this.t('file_path_empty')
        });
        node.status = 'error';
        this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result);
        this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result);
        return false;
      }
    }
    
    try {
      const content = await window.ipcRenderer.invoke('readFile', filePath);
      
      const fileMode = node.fileMode || 'full';
      
      if (fileMode === 'full') {
        const fileExtension = '.' + filePath.split('.').pop()?.toLowerCase();
        
        const formattedResult = {
          type: 'local',
          success: true,
          mode: 'full',
          filePath: filePath,
          filename: filePath.split('/').pop() || filePath.split('\\').pop(),
          extension: fileExtension,
          content: content,
          result: content,
          timestamp: new Date().toISOString()
        };
        
        node.result = JSON.stringify(formattedResult);
        node.model = fileExtension;
        
      } else if (fileMode === 'template') {
        const templates = node.fileTemplates || [];
        
        if (templates.length === 0) {
          node.result = JSON.stringify({
            result: this.t('configure_templates'),
            type: 'local',
            success: false,
            error: this.t('no_templates')
          });
          node.status = 'error';
          this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result);
          this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result);
          return false;
        }
        
        const imagePatterns = [
          /data:image\/(?:png|jpeg|jpg|gif|bmp|webp|svg\+xml);base64,[a-zA-Z0-9+/]+={0,2}/gi,
          /\bhttps?:\/\/\S+\.(?:jpg|jpeg|png|gif|bmp|webp|svg)\b/gi,
          /\b[a-zA-Z]:[\\/][^\\/]+\.(?:jpg|jpeg|png|gif|bmp|webp|svg)\b/gi,
          /\/(?:[^\/]+\/)*[^\/]+\.(?:jpg|jpeg|png|gif|bmp|webp|svg)\b/gi,
          /!\[[^\]]*\]\([^)]+\.(?:jpg|jpeg|png|gif|bmp|webp|svg)\)/gi,
          /<img[^>]+src=["'][^"']+\.(?:jpg|jpeg|png|gif|bmp|webp|svg)["'][^>]*>/gi
        ];
        
        let filteredContent = content;
        imagePatterns.forEach(pattern => {
          filteredContent = filteredContent.replace(pattern, this.t('image_filtered'));
        });
        
        const markdownBase64Pattern = /!\[[^\]]*\]\(data:image\/[^)]+\)/gi;
        filteredContent = filteredContent.replace(markdownBase64Pattern, this.t('image_filtered_markdown'));
        
        const htmlBase64Pattern = /<img[^>]+src=["']data:image\/[^"']+["'][^>]*>/gi;
        filteredContent = filteredContent.replace(htmlBase64Pattern, '<img src="' + this.t('image_filtered') + '">');
        
        const slices: Record<string, string> = {};
        
        const allMatches: Array<{
          templateIndex: number;
          templateName: string;
          pattern: string;
          start: number;
          text: string;
        }> = [];
        
        templates.forEach((template, templateIndex) => {
          const pattern = template.pattern;
          
          if (!pattern.trim()) {
            return;
          }
          
          try {
            const regex = new RegExp(pattern, 'g');
            let match;
            regex.lastIndex = 0;
            
            while ((match = regex.exec(filteredContent)) !== null) {
              allMatches.push({
                templateIndex,
                templateName: template.name,
                pattern,
                start: match.index,
                text: match[0]
              });
            }
            
          } catch (error: any) {
            this.log(`${this.t('template_match_failed')} "${template.name}": ${error.message}`, 'warning');
          }
        });
        
        allMatches.sort((a, b) => a.start - b.start);
        
        templates.forEach((template, templateIndex) => {
          const templateMatches = allMatches
            .filter(m => m.templateIndex === templateIndex)
            .sort((a, b) => a.start - b.start);
          
          if (templateMatches.length === 0) {
            slices[`output${templateIndex + 1}`] = '';
            return;
          }
          
          const allMatchPositions = allMatches.map(m => m.start);
          
          const templateSlices: string[] = [];
          
          for (let i = 0; i < templateMatches.length; i++) {
            const currentMatch = templateMatches[i];
            const currentStart = currentMatch.start;
            
            let nextMatchStart = filteredContent.length;
            for (const matchPos of allMatchPositions) {
              if (matchPos > currentStart) {
                nextMatchStart = matchPos;
                break;
              }
            }
            
            if (currentStart < nextMatchStart) {
              const sliceContent = filteredContent.substring(currentStart, nextMatchStart);
              templateSlices.push(sliceContent);
            }
          }
          
          slices[`output${templateIndex + 1}`] = templateSlices.join('\n\n---\n\n');
        });
        
        const outputByPort: Record<string, string> = {};
        
        outputByPort['default'] = content;
        
        templates.forEach((template, index) => {
          const portId = `output${index + 1}`;
          outputByPort[portId] = slices[portId] || '';
        });
        
        if (node.outputPorts && node.outputPorts.ports) {
          node.outputPorts.ports.forEach(port => {
            if (!outputByPort[port.id]) {
              outputByPort[port.id] = '';
            }
          });
        }

        if (node.outputPorts && node.outputPorts.ports) {
          node.outputPorts.ports.forEach(port => {
            if (port.enabled) {
              port.data = outputByPort[port.id] || '';
            }
          });
        }

        const formattedResult = {
          type: 'local',
          success: true,
          mode: 'template',
          filePath: filePath,
          filename: filePath.split('/').pop() || filePath.split('\\').pop(),
          templates: templates,
          slices: slices,
          outputByPort: outputByPort,
          result: `${this.t('file_processed')} ${allMatches.length} ${this.t('matches')}，${templates.length} ${this.t('slice_groups')}`,
          timestamp: new Date().toISOString()
        };

        node.result = JSON.stringify(formattedResult);
      }
      
      node.status = 'success';
      this.callbacks.onNodeStatusUpdate?.(node.id, 'success', node.result);
      this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'success', node.result);
      this.callbacks.onSaveWorkflow?.();
      return true;
      
    } catch (error: any) {
      node.result = JSON.stringify({
        result: `${this.t('file_read_error')}: ${error.message}`,
        type: 'local',
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      node.status = 'error';
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result);
      this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result);
      this.callbacks.onSaveWorkflow?.();
      return false;
    }
  }
  
  private async runPythonNode(node: NodeData): Promise<boolean> {
    const pythonCode = node.prompt || ''
    
    // 优先使用节点自身的代码
    let codeToExecute = pythonCode;
    
    // 如果没有代码，从上游节点获取
    if (!codeToExecute.trim()) {
      const sourceLinks = this.workflowData.links.filter(link => link.target === node.id);
      const upstreamData = this.getUpstreamDataWithPorts(node.id);
      
      if (upstreamData && Object.keys(upstreamData).length > 0) {
        // 遍历所有上游数据，找到最可能是代码的内容
        for (const [key, value] of Object.entries(upstreamData)) {
          if (value && typeof value === 'string') {
            // 检查是否包含Python代码特征
            if (value.includes('def ') || 
                value.includes('import ') || 
                value.includes('print(') ||
                value.includes('```python') ||
                value.includes('plt.')) {
              // 提取代码块中的内容
              let extractedCode = value;
              
              // 处理markdown代码块
              const codeBlockMatch = value.match(/```python\s*([\s\S]*?)```/);
              if (codeBlockMatch) {
                extractedCode = codeBlockMatch[1].trim();
              } else {
                // 如果不是markdown格式，可能是纯代码
                extractedCode = value.trim();
              }
              
              codeToExecute = extractedCode;
              break;
            }
          }
        }
      }
    }
    
    if (!codeToExecute.trim()) {
      node.result = JSON.stringify({
        result: this.t('no_python_code'),
        type: 'python',
        success: false,
        error: this.t('code_empty')
      });
      node.status = 'error';
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result);
      this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result);
      return false;
    }
    
    try {
      const environment = this.store.TrustedPython ? 'trusted' : 'safe'
      
      const result = await this.safeIpcInvoke('executePython', {
        code: codeToExecute,
        environment: environment,
        input: null
      })
      
      if (result && result.success) {
        node.result = JSON.stringify({
          result: result.output?.trim() || result.result || '✓',
          type: 'python',
          success: true,
          executionTime: result.executionTime,
          logs: result.logs
        })
        node.status = 'success'
        this.callbacks.onNodeStatusUpdate?.(node.id, 'success', node.result)
        this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'success', node.result)
        this.callbacks.onSaveWorkflow?.()
        return true
      } else {
        const errorMessage = result?.error || result?.output || this.t('unknown_error')
        node.result = JSON.stringify({
          result: `${this.t('python_execution_error')}: ${errorMessage}`,
          type: 'python',
          success: false,
          error: errorMessage,
          timestamp: new Date().toISOString()
        })
        node.status = 'error'
        this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
        this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result)
        this.callbacks.onSaveWorkflow?.()
        return false
      }
    } catch (error: any) {
      node.result = JSON.stringify({
        result: `${this.t('python_execution_exception')}: ${error.message}`,
        type: 'python',
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
      this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result)
      this.callbacks.onSaveWorkflow?.()
      return false
    }
  }
  
  private async runKnowledgeNode(node: NodeData): Promise<boolean> {
    if (!node.kbPath || node.kbPath.trim() === '') {
      node.result = JSON.stringify({
        result: this.t('select_kb_file'),
        type: 'knowledge_retrieval',
        success: false,
        error: this.t('kb_file_required')
      })
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
      this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result)
      return false
    }
    
    const kbOptions = node.kbOptions || {
      topK: 5,
      summaryWeight: 0.7,
      useReverseInference: false,
      reverseWeight: 0.3,
      embedModel: '',
      debug: false
    }
    
    let queryText = node.kbQuery || ''
    
    const sourceLinks = this.workflowData.links.filter(link => link.target === node.id)
    if (sourceLinks.length > 0) {
      const upstreamQuery = this.getAllUpstreamQueryTextWithPorts(node.id)
      if (upstreamQuery && upstreamQuery.trim() !== '') {
        queryText = upstreamQuery
      }
    }
    
    if (!queryText || queryText.trim() === '') {
      queryText = node.prompt
    }
    
    if (!queryText || queryText.trim() === '') {
      node.result = JSON.stringify({
        result: this.t('enter_query_text'),
        type: 'knowledge_retrieval',
        success: false,
        error: this.t('query_required')
      })
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
      this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result)
      return false
    }
    
    try {
    const options = {
      topK: kbOptions.topK || 5,
      summaryWeight: kbOptions.summaryWeight || 0.7,
      useReverseInference: kbOptions.useReverseInference || false,
      reverseWeight: kbOptions.reverseWeight || 0.3,
      embedModel: kbOptions.embedModel || '',
      debug: kbOptions.debug || false,
      missingModelStrategy: kbOptions.missingModelStrategy || 'error',
      fallbackModels: kbOptions.fallbackModels || ['nomic-embed-text:latest', 'all-minilm:latest'],
      ollamaHost: this.store.AIconfig?.llm?.ollama?.model_url || 'http://127.0.0.1:11434'
    }
    
    const retrievalResult = await retrieveKnowledge(queryText, node.kbPath, options)
    
    // 构建更友好的结果格式
    let resultText = ''
    
    if (retrievalResult.context) {
      resultText = retrievalResult.context
    } else if (retrievalResult.relevantBlocks && retrievalResult.relevantBlocks.length > 0) {
      // 如果没有 context，从 relevantBlocks 构建
      resultText = `${this.t('relevant_knowledge')}：\n\n`
      retrievalResult.relevantBlocks.forEach((block: any, index: number) => {
        resultText += `${this.t('knowledge_item')} ${index + 1}】\n`
        if (block.text) resultText += `${block.text}\n`
        if (block.metadata?.source) resultText += `${this.t('source')}：${block.metadata.source}\n`
        resultText += '\n'
      })
    }
    
    const formattedResult = {
      type: 'knowledge_retrieval',
      success: true,
      query: queryText,
      // 主要结果放在 result 字段，方便下游节点获取
      result: resultText,
      // 原始数据放在 context 字段
      context: retrievalResult.context,
      relevantBlocks: retrievalResult.relevantBlocks,
      usedEmbedModel: retrievalResult.usedEmbedModel,
      debugInfo: retrievalResult.debugInfo,
      timestamp: new Date().toISOString()
    }
    
    node.result = JSON.stringify(formattedResult)
    node.status = 'success'
    this.callbacks.onNodeStatusUpdate?.(node.id, 'success', node.result)
    this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'success', node.result)
    this.callbacks.onSaveWorkflow?.()
    return true
    
  } catch (error: any) {
      node.result = JSON.stringify({
        result: `${this.t('retrieval_error')}: ${error.message}`,
        type: 'knowledge_retrieval',
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
      this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result)
      this.callbacks.onSaveWorkflow?.()
      return false
    }
  }
  
  private async runMcpNode(node: NodeData): Promise<boolean> {
    if (!node.mcpConfig) {
      node.result = JSON.stringify({
        result: this.t('mcp_config_empty'),
        type: 'mcp',
        success: false,
        error: this.t('mcp_config_empty')
      })
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
      this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result)
      return false
    }
    
    try {
      // 检查是否需要自动连接
      let connected = mcpManager.isConnected(node.id)
      
      if (!connected && node.mcpConfig.autoConnect !== false) {
        try {
          connected = await this.connectMcpNode(node.id)
          if (!connected) {
            throw new Error(this.t('auto_connect_failed'))
          }
        } catch (error: any) {
          node.result = JSON.stringify({
            result: `${this.t('mcp_connect_failed')}: ${error.message}`,
            type: 'mcp',
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
          })
          node.status = 'error'
          this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
          this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result)
          this.callbacks.onSaveWorkflow?.()
          return false
        }
      }
      
      if (!connected) {
        node.result = JSON.stringify({
          result: this.t('mcp_not_connected'),
          type: 'mcp',
          success: false,
          error: this.t('mcp_not_connected'),
          timestamp: new Date().toISOString()
        })
        node.status = 'error'
        this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
        this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result)
        this.callbacks.onSaveWorkflow?.()
        return false
      }
      
      // 检查是否有选中的工具
      const selectedTool = node.mcpConfig.selectedTool
      if (!selectedTool) {
        node.result = JSON.stringify({
          result: this.t('no_mcp_tool_selected'),
          type: 'mcp',
          success: false,
          error: this.t('no_mcp_tool_selected'),
          availableTools: node.mcpTools?.map(t => t.name) || [],
          timestamp: new Date().toISOString()
        })
        node.status = 'error'
        this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
        this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result)
        this.callbacks.onSaveWorkflow?.()
        return false
      }
      
      // 准备工具参数
      let toolArguments = node.mcpConfig.toolArguments || {}
      
      // 如果有上游节点，可以将其结果作为输入（考虑端口）
      const contexts = await this.getNodeContextWithPorts(node.id)
      if (contexts.length > 0 && (!toolArguments.input || !toolArguments.query)) {
        // 自动将上游数据作为输入
        const combinedInput = contexts.join('\n\n')
        if (!toolArguments.input) {
          toolArguments.input = combinedInput
        }
        if (!toolArguments.query) {
          toolArguments.query = combinedInput
        }
      }
      
      // 如果有节点提示词，也可以作为输入
      if (node.prompt && node.prompt.trim() !== '') {
        if (!toolArguments.input && !toolArguments.query) {
          toolArguments.input = node.prompt
        }
      }
      
      this.log(`${this.t('executing_mcp_tool')}: ${selectedTool}，${this.t('params')}: ${JSON.stringify(toolArguments)}`, 'info')
      
      // 调用 MCP 工具
      const toolResult = await mcpManager.callTool(node.id, selectedTool, toolArguments)
      
      if (toolResult.success) {
        const formattedResult = {
          type: 'mcp',
          success: true,
          result: toolResult.data,
          tool: selectedTool,
          arguments: toolArguments,
          rawResult: toolResult.raw,
          timestamp: new Date().toISOString()
        }
        
        node.result = JSON.stringify(formattedResult)
        node.status = 'success'
        this.callbacks.onNodeStatusUpdate?.(node.id, 'success', node.result)
        this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'success', node.result)
        this.callbacks.onSaveWorkflow?.()
        
        this.log(`${this.t('mcp_tool_success')}: ${selectedTool}`, 'info')
        return true
      } else {
        const formattedResult = {
          type: 'mcp',
          success: false,
          result: `${this.t('mcp_tool_failed')}: ${toolResult.error}`,
          tool: selectedTool,
          arguments: toolArguments,
          error: toolResult.error,
          details: toolResult.details,
          timestamp: new Date().toISOString()
        }
        
        node.result = JSON.stringify(formattedResult)
        node.status = 'error'
        this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
        this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result)
        this.callbacks.onSaveWorkflow?.()
        
        this.log(`${this.t('mcp_tool_failed')}: ${selectedTool} - ${toolResult.error}`, 'error')
        return false
      }
      
    } catch (error: any) {
      const formattedResult = {
        type: 'mcp',
        success: false,
        result: `${this.t('mcp_execution_exception')}: ${error.message}`,
        error: error.message,
        timestamp: new Date().toISOString()
      }
      
      node.result = JSON.stringify(formattedResult)
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
      this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result)
      this.callbacks.onSaveWorkflow?.()
      
      this.log(`${this.t('mcp_execution_exception')}: ${error.message}`, 'error')
      return false
    }
  }
  
  // 辅助方法
  private validateModelConfig(node: NodeData): { valid: boolean; message: string } {
    if (!node.model_type) {
      return { valid: false, message: this.t('select_model_type') }
    }
    
    if (!node.model) {
      return { valid: false, message: this.t('select_model') }
    }
    
    switch (node.model_type) {
      case 'ollama':
        break
        
      case 'openai':
      case 'deepseek':
        if (!this.store.AIconfig?.llm?.openai?.api_key) {
          return { valid: false, message: this.t('api_key_required') }
        }
        break
        
      case 'anthropic':
        if (!this.store.AIconfig?.llm?.anthropic?.api_key) {
          return { valid: false, message: this.t('api_key_required') }
        }
        break
        
      case 'google':
        if (!this.store.AIconfig?.llm?.google?.api_key) {
          return { valid: false, message: this.t('api_key_required') }
        }
        break
        
      case 'azure':
        if (!this.store.AIconfig?.llm?.azure?.api_key || !this.store.AIconfig?.llm?.azure?.endpoint || !this.store.AIconfig?.llm?.azure?.deployment) {
          return { valid: false, message: this.t('api_key_required') }
        }
        break
        
      case 'custom':
        if (!this.store.AIconfig?.llm?.custom?.api_url) {
          return { valid: false, message: this.t('api_url_required') }
        }
        break
    }
    
    return { valid: true, message: '' }
  }
  
  // 支持端口的节点上下文获取方法
  private async getNodeContextWithPorts(nodeId: number): Promise<string[]> {
    const sourceLinks = this.workflowData.links.filter(link => link.target === nodeId)
    const contexts: string[] = []
    
    for (const link of sourceLinks) {
      const sourceNode = this.workflowData.items.find(n => n.id === link.source)
      if (!sourceNode) continue
      
      // 关键修改：检查节点状态是否为成功，而不是检查 executedNodes
      if (sourceNode.status !== 'success') {
        continue
      }
      
      // 获取源节点的数据（考虑端口），传入目标节点ID
      const nodeData = this.getSourceNodeData(sourceNode.id, link.sourcePort, nodeId)
      if (nodeData !== null && nodeData !== undefined) {
        contexts.push(String(nodeData))
      }
    }
    
    return contexts
  }
  
  private getSourceNodeData(sourceNodeId: number, sourcePort?: string, targetNodeId?: number): any {
    const sourceNode = this.workflowData.items.find(n => n.id === sourceNodeId)
    if (!sourceNode || !sourceNode.result) {
      return null
    }
    
    try {
      const parsed = JSON.parse(sourceNode.result)
      
      // 特殊处理决策节点 - 应用数据模板
      if (sourceNode.type === 'decision') {
        // 获取上游数据（决策节点的输入）
        let inputData = ''
        if (parsed.inputPreview) {
          inputData = parsed.inputPreview
        } else if (parsed.result) {
          inputData = typeof parsed.result === 'string' 
            ? parsed.result 
            : JSON.stringify(parsed.result)
        }
        
        // 获取该决策节点选中的分支的数据模板
        const dataTemplate = this.decisionDataTemplates.get(sourceNodeId) || '{input}'
        
        // 应用模板替换
        let processedData = this.applyDataTemplate(dataTemplate, {
          input: inputData,
          branchId: this.decisionPaths.get(sourceNodeId) || '',
          branchName: parsed.selectedBranchName || '',
          result: parsed.result
        })
        
        return processedData
      }
      
      // 本地文件节点且有端口连接
      if (sourceNode.type === 'local' && sourceNode.fileMode === 'template') {
        if (parsed.outputByPort && sourcePort) {
          const portData = parsed.outputByPort[sourcePort]
          if (portData !== undefined && portData !== null && portData !== '') {
            return portData
          }
        }
        
        if (parsed.slices && sourcePort && parsed.slices[sourcePort]) {
          return parsed.slices[sourcePort]
        }
      }
      
      // 开始节点的特殊处理
      if (sourceNode.type === 'start' && parsed.outputByPort && sourcePort) {
        const portData = parsed.outputByPort[sourcePort]
        if (portData !== undefined && portData !== null) {
          return portData
        }
      }
      
      // 其他类型的节点或者没有端口信息，返回默认结果
      if (parsed.result !== undefined) {
        return parsed.result
      }
      
      return parsed
      
    } catch {
      return sourceNode.result
    }
  }

  // 应用数据模板的方法
  private applyDataTemplate(template: string, context: Record<string, any>): string {
    if (!template) return ''
    
    let result = template
    
    // 替换 {input} 为上游输入数据
    if (context.input !== undefined) {
      result = result.replace(/\{input\}/g, context.input)
    }
    
    // 替换 {branchId} 为分支ID
    if (context.branchId !== undefined) {
      result = result.replace(/\{branchId\}/g, context.branchId)
    }
    
    // 替换 {branchName} 为分支名称
    if (context.branchName !== undefined) {
      result = result.replace(/\{branchName\}/g, context.branchName)
    }
    
    // 替换 {result} 为决策结果
    if (context.result !== undefined) {
      result = result.replace(/\{result\}/g, context.result)
    }
    
    return result
  }

  private getUpstreamDataWithPorts(nodeId: number): any {
    const sourceLinks = this.workflowData.links.filter(link => link.target === nodeId)
    
    if (sourceLinks.length === 0) {
      return null
    }
    
    const upstreamData: Record<string, any> = {}
    
    for (const link of sourceLinks) {
      const sourceNode = this.workflowData.items.find(n => n.id === link.source)
      if (!sourceNode || !sourceNode.result) continue
      
      // 关键修改：检查节点状态是否为成功
      if (sourceNode.status !== 'success') {
        continue
      }
      
      const key = `node_${sourceNode.id}${link.sourcePort ? '_' + link.sourcePort : ''}`
      
      const nodeData = this.getSourceNodeData(sourceNode.id, link.sourcePort)
      if (nodeData !== null) {
        upstreamData[key] = nodeData
      }
    }
    
    return upstreamData
  }
  
  private getAllUpstreamQueryTextWithPorts(nodeId: number): string {
    const sourceLinks = this.workflowData.links.filter(link => link.target === nodeId)
    
    if (sourceLinks.length === 0) {
      return ''
    }
    
    const queryParts: string[] = []
    
    for (const link of sourceLinks) {
      const sourceNode = this.workflowData.items.find(n => n.id === link.source)
      
      if (!sourceNode || !sourceNode.result) {
        continue
      }
      
      // 关键修改：检查节点状态是否为成功
      if (sourceNode.status !== 'success') {
        continue
      }
      
      const nodeData = this.getSourceNodeData(sourceNode.id, link.sourcePort)
      if (nodeData !== null) {
        if (typeof nodeData === 'string') {
          queryParts.push(nodeData)
        } else {
          queryParts.push(JSON.stringify(nodeData))
        }
      }
    }
    
    return queryParts.join('\n\n')
  }
  
  private async safeIpcInvoke(channel: string, ...args: any[]) {
    try {
      if (!window.ipcRenderer || typeof window.ipcRenderer.invoke !== 'function') {
        throw new Error('IPC通信不可用')
      }
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`IPC调用超时 (1小时) - ${channel}`)), 3600000)
      )
      
      const result = await Promise.race([
        window.ipcRenderer.invoke(channel, ...args),
        timeoutPromise
      ])
      
      return result
    } catch (error: any) {
      throw new Error(`IPC调用失败: ${error.message}`)
    }
  }
  
  private extractErrorFromResult(result: string): string {
    try {
      const parsed = JSON.parse(result)
      if (parsed && typeof parsed === 'object') {
        if (parsed.error) {
          return parsed.error
        }
        if (parsed.result && typeof parsed.result === 'string') {
          if (parsed.result.includes('错误') || parsed.result.includes('Error') || parsed.result.includes('error')) {
            return parsed.result
          }
        }
      }
      return result.substring(0, 100)
    } catch {
      return result.substring(0, 100)
    }
  }
  
  private extractPythonErrorInfo(result: string): { error: string; traceback?: string } {
    try {
      const parsed = JSON.parse(result)
      if (parsed && typeof parsed === 'object') {
        if (parsed.error) {
          const errorStr = String(parsed.error)
          const lines = errorStr.split('\n')
          
          const errorLines = lines.filter(line => 
            line.includes('Traceback') || 
            line.includes('Error:') || 
            line.includes('Exception:') ||
            line.includes('File')
          )
          
          if (errorLines.length > 0) {
            return {
              error: errorLines[0].replace('Error:', '').replace('Exception:', '').trim(),
              traceback: errorStr
            }
          }
          
          return { error: errorStr.substring(0, 200) }
        }
      }
      return { error: this.extractErrorFromResult(result) }
    } catch {
      return { error: this.extractErrorFromResult(result) }
    }
  }
  
  // 从LLM响应中提取分支ID
  private extractBranchIdFromResponse(response: string, branches: DecisionBranch[]): string {
    const cleanResponse = response.trim().toLowerCase()
    
    for (const branch of branches) {
      if (cleanResponse.includes(branch.id.toLowerCase())) {
        return branch.id
      }
    }
    
    for (const branch of branches) {
      if (cleanResponse.includes(branch.name.toLowerCase())) {
        return branch.id
      }
    }
    
    const numberMatch = cleanResponse.match(/(\d+)/)
    if (numberMatch) {
      const index = parseInt(numberMatch[1]) - 1
      if (index >= 0 && index < branches.length) {
        return branches[index].id
      }
    }
    
    return branches[0].id
  }
  
  // 清理所有MCP连接
  cleanupMcpConnections(): void {
    const mcpNodes = this.workflowData.items.filter(item => item.type === 'mcp')
    mcpNodes.forEach(node => {
      if (node.mcpConnected) {
        this.disconnectMcpNode(node.id).catch(console.error)
      }
    })
    mcpManager.cleanup()
  }
  
  // 工作流停止时清理资源
  cleanup(): void {
    this.cleanupMcpConnections()
    this.stop()
  }
}