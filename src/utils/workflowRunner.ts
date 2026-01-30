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
    branches: Array<{
      id: string
      name: string
      description: string
      condition?: string
    }>
    selectedBranch?: string
  }
  decisionBranches?: Array<{
    id: string
    name: string
    description: string
  }>
  
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
  onNodeComplete?: (nodeId: number, nodeName: string, nodeType: NodeType, status: 'success' | 'error', result: any) => void
  
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
  onNodeStatusUpdate?: (nodeId: number, status: 'idle' | 'running' | 'success' | 'error', result?: string) => void
  
  // 工作流数据保存回调
  onSaveWorkflow?: () => void
}

// 工作流运行器类
export class WorkflowRunner {
  private workflowData: WorkflowData
  private store: any
  private callbacks: ExecutionCallback
  private _isRunning: boolean = false
  private executionOrder: number[] = []
  private currentStep: number = 0
  private abortController: AbortController | null = null
  private activePath: Set<number> = new Set() // 记录当前活跃的执行路径
  private decisionPaths: Map<number, string> = new Map() // 记录决策节点选中的分支
  
  constructor(workflowData: WorkflowData, store: any, callbacks: ExecutionCallback = {}) {
    this.workflowData = workflowData
    this.store = store
    this.callbacks = callbacks
  }
  
  // 获取是否正在运行
  get isRunning(): boolean {
    return this._isRunning
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
    }
  }> {
    if (this._isRunning) {
      throw new Error('工作流正在运行中')
    }
    
    this._isRunning = true
    this.currentStep = 0
    const startTime = Date.now()
    const errors: Array<{nodeId: number, nodeName: string, error: string}> = []
    
    // 创建中止控制器
    this.abortController = new AbortController()
    
    try {
      // 重置所有节点状态
      this.resetNodes()
      this.activePath.clear()
      this.decisionPaths.clear()
      
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
      
      // 检查循环依赖（考虑决策分支）
      if (this.hasCycleWithDecisions()) {
        throw new Error('检测到循环依赖（包括决策分支）')
      }
      
      // 获取拓扑排序执行顺序（考虑决策分支）
      this.executionOrder = this.getTopologicalOrderWithDecisions()
      
      if (this.executionOrder.length === 0) {
        throw new Error('工作流拓扑排序失败，可能存在循环依赖或无效连接')
      }
      
      this.log(`开始执行工作流，共 ${this.executionOrder.length} 个节点`, 'info')
      this.callbacks.onProgress?.(0, this.executionOrder.length)
      
      // 按拓扑顺序执行所有节点
      let completedNodes = 0
      
      for (const nodeId of this.executionOrder) {
        // 检查是否被中止
        if (this.abortController.signal.aborted) {
          this.log('工作流执行被中止', 'warning')
          break
        }
        
        const node = this.workflowData.items.find(item => item.id === nodeId)
        if (!node) continue
        
        // 检查节点是否在活跃路径中（对于决策分支后的节点）
        if (!this.isNodeInActivePath(nodeId)) {
          this.log(`跳过节点 ${node.name}，不在当前活跃路径中`, 'info')
          continue
        }
        
        this.currentStep++
        completedNodes++
        
        this.log(`执行节点: ${node.name} (ID: ${node.id}, 类型: ${node.type})`, 'info')
        this.callbacks.onNodeStart?.(node.id, node.name, node.type)
        this.callbacks.onProgress?.(completedNodes, this.executionOrder.length, node.name)
        
        // 执行节点
        const success = await this.executeNode(node.id)
        
        if (!success) {
          const error = node.result ? this.extractErrorFromResult(node.result) : '执行失败'
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
          
          this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result)
          
          // 如果节点执行失败，停止工作流
          this.log(`节点执行失败: ${node.name} - ${error}`, 'error')
          break
        } else {
          this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'success', node.result)
          this.log(`节点执行成功: ${node.name}`, 'info')
        }
      }
      
      // 获取最终结果
      const endNode = this.workflowData.items.find(item => item.type === 'end')
      let finalResult = ''
      let aggregatedResults: Record<string, any> = {}
      
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
        totalNodes: this.executionOrder.length,
        completedNodes: completedNodes,
        failedNodes: errors.length,
        errors: errors,
        decisionPaths: this.decisionPaths,
        executionTime: executionTime
      }
      
      const success = errors.length === 0 && completedNodes > 0
      
      this.log(`工作流执行${success ? '成功' : '失败'}，耗时: ${executionTime}ms`, success ? 'info' : 'error')
      this.callbacks.onComplete?.(success, finalResult, aggregatedResults)
      
      return {
        success,
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
          totalNodes: this.executionOrder.length || 0,
          completedNodes: this.currentStep,
          failedNodes: errors.length + 1,
          errors: [...errors, {nodeId: -1, nodeName: '系统', error: error.message}],
          decisionPaths: this.decisionPaths,
          executionTime: Date.now() - startTime
        }
      }
    } finally {
      this._isRunning = false
      this.abortController = null
    }
  }
  
  // 停止工作流
  stop(): void {
    if (this.abortController) {
      this.abortController.abort()
    }
    this._isRunning = false
    this.log('工作流已停止', 'warning')
  }
  
  // 获取当前执行状态
  getExecutionStatus(): {
    isRunning: boolean
    currentStep: number
    totalSteps: number
    currentNode?: string
    progress: number
    activeDecisionPaths: Map<number, string>
  } {
    const currentNodeId = this.executionOrder[this.currentStep - 1]
    const currentNode = currentNodeId ? 
      this.workflowData.items.find(item => item.id === currentNodeId) : undefined
    
    return {
      isRunning: this._isRunning,
      currentStep: this.currentStep,
      totalSteps: this.executionOrder.length,
      currentNode: currentNode?.name,
      progress: this.executionOrder.length > 0 ? 
        (this.currentStep / this.executionOrder.length) * 100 : 0,
      activeDecisionPaths: this.decisionPaths
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
    
    this.callbacks.onNodeStart?.(node.id, node.name, node.type)
    
    const success = await this.executeNode(node.id)
    
    if (success) {
      this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'success', node.result)
    } else {
      const error = this.extractErrorFromResult(node.result)
      this.callbacks.onNodeComplete?.(node.id, node.name, node.type, 'error', node.result)
      
      if (node.type === 'python') {
        const errorInfo = this.extractPythonErrorInfo(node.result)
        this.callbacks.onPythonError?.(node.id, node.name, errorInfo.error, errorInfo.traceback)
      }
    }
    
    return success
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
    console.log(`[WorkflowRunner ${level.toUpperCase()}] ${message}`)
    this.callbacks.onLog?.(message, level)
  }
  
  private resetNodes(): void {
    this.workflowData.items.forEach(node => {
      node.status = 'idle'
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
  
  // 获取拓扑排序执行顺序（考虑决策分支）
  private getTopologicalOrderWithDecisions(): number[] {
    const indegree: Record<number, number> = {}
    const adjacencyList: Record<number, Array<{target: number, branch?: string}>> = {}
    
    // 初始化
    this.workflowData.items.forEach(node => {
      indegree[node.id] = 0
      adjacencyList[node.id] = []
    })
    
    // 构建邻接表和入度表（考虑决策分支）
    this.workflowData.links.forEach(link => {
      adjacencyList[link.source].push({
        target: link.target,
        branch: link.branch
      })
      indegree[link.target] = (indegree[link.target] || 0) + 1
    })
    
    // 找到入度为0的节点（开始节点）
    const queue: number[] = []
    this.workflowData.items.forEach(node => {
      if (indegree[node.id] === 0) {
        queue.push(node.id)
      }
    })
    
    const result: number[] = []
    
    while (queue.length > 0) {
      const nodeId = queue.shift()!
      result.push(nodeId)
      
      const neighbors = adjacencyList[nodeId] || []
      for (const neighbor of neighbors) {
        indegree[neighbor.target]--
        if (indegree[neighbor.target] === 0) {
          queue.push(neighbor.target)
        }
      }
    }
    
    return result
  }
  
  // 检查节点是否在活跃路径中
  private isNodeInActivePath(nodeId: number): boolean {
    // 开始节点总是在活跃路径中
    const node = this.workflowData.items.find(item => item.id === nodeId)
    if (!node) return false
    
    if (node.type === 'start') {
      this.activePath.add(nodeId)
      return true
    }
    
    // 检查是否有上游节点在活跃路径中
    const incomingLinks = this.workflowData.links.filter(link => link.target === nodeId)
    
    for (const link of incomingLinks) {
      const sourceNode = this.workflowData.items.find(n => n.id === link.source)
      if (!sourceNode) continue
      
      // 如果源节点不在活跃路径中，跳过
      if (!this.activePath.has(link.source)) {
        continue
      }
      
      // 如果是决策节点的连接，检查分支是否匹配
      if (sourceNode.type === 'decision' && link.branch) {
        const selectedBranch = this.decisionPaths.get(sourceNode.id)
        if (selectedBranch === link.branch) {
          this.activePath.add(nodeId)
          return true
        }
      } else {
        // 普通连接，直接添加到活跃路径
        this.activePath.add(nodeId)
        return true
      }
    }
    
    return false
  }
  
  private async executeNode(nodeId: number): Promise<boolean> {
    const node = this.workflowData.items.find(item => item.id === nodeId)
    if (!node) return false
    
    node.status = 'running'
    this.callbacks.onNodeStatusUpdate?.(node.id, 'running', node.result)
    
    try {
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
      return false
    }
  }
  
  // 各类型节点的执行方法
  private async runStartNode(node: NodeData): Promise<boolean> {
    // 解析输入参数（支持两个参数：提示词和文件路径）
    let promptText = '';
    let filePath = '';
    
    if (node.prompt && node.prompt.trim() !== '') {
      // 尝试解析是否为两个参数的格式（用特定分隔符分隔）
      const parts = node.prompt.split('|').map(part => part.trim());
      if (parts.length === 2) {
        promptText = parts[0];
        filePath = parts[1];
      } else {
        // 单参数格式，保持向后兼容
        promptText = node.prompt;
      }
    }
    
    // 验证输入
    if (!promptText || promptText.trim() === '') {
      node.result = JSON.stringify({
        result: '请输入文本',
        type: 'start',
        success: false,
        error: '输入文本为空',
        // 添加空的数据结构，确保下游能获取
        outputByPort: { default: '' }
      });
      node.status = 'error';
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result);
      return false;
    }
    
    // 如果有文件路径，读取文件内容
    let fileContent = '';
    if (filePath && filePath.trim() !== '') {
      try {
        fileContent = await window.ipcRenderer.invoke('readFile', filePath);
      } catch (error: any) {
        node.result = JSON.stringify({
          result: `读取文件失败: ${error.message}`,
          type: 'start',
          success: false,
          error: error.message,
          // 添加空的数据结构，确保下游能获取
          outputByPort: { default: '' }
        });
        node.status = 'error';
        this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result);
        return false;
      }
    }
    
    // 构建结果对象 - 确保有 outputByPort 结构
    const startResult = {
      type: 'start',
      success: true,
      prompt: promptText,
      filePath: filePath || null,
      fileContent: fileContent || null,
      result: fileContent ? `${promptText}\n\n文件内容:\n${fileContent}` : promptText,
      // 关键：添加 outputByPort 结构
      outputByPort: {
        default: fileContent ? `${promptText}\n\n文件内容:\n${fileContent}` : promptText,
        prompt: promptText,
        file: fileContent || null
      },
      timestamp: new Date().toISOString()
    };
    
    node.result = JSON.stringify(startResult);
    node.status = 'success';
    this.callbacks.onNodeStatusUpdate?.(node.id, 'success', node.result);
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
      
      // 检查源节点是否在活跃路径中
      if (!this.activePath.has(sourceNode.id)) {
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
      
      // 添加决策路径信息
      if (this.decisionPaths.size > 0) {
        outputText += ''
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
        const nodeName = sourceNode?.name || `节点 ${nodeId}`
        
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
      summaryResult.result = '工作流执行完成，但没有输入节点连接到结束节点。'
    }
    
    node.result = JSON.stringify(summaryResult)
    node.status = 'success'
    this.callbacks.onNodeStatusUpdate?.(node.id, 'success', node.result)
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
      return false
    }
    
    // 获取上游数据（考虑端口）
    const contexts = this.getNodeContextWithPorts(node.id)
    
    // 合并所有上下文数据
    let combinedContext = ''
    if (contexts.length > 0) {
      combinedContext = '相关上下文信息：\n\n' + contexts.join('\n\n') + '\n\n'
    }
    
    const fullPrompt = combinedContext + '用户指令：' + node.prompt
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
          null,
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
      this.callbacks.onSaveWorkflow?.()
      return true
      
    } catch (error: any) {
      node.result = JSON.stringify({
        result: `推理错误: ${error.message}`,
        model: node.model,
        model_type: node.model_type,
        timestamp: new Date().toISOString(),
        type: 'reasoning',
        error: error.message
      })
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
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
        result: '决策节点需要至少2个分支',
        type: 'decision',
        success: false,
        error: '分支数量不足'
      })
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
      return false
    }
    
    try {
      // 获取上游节点的数据作为决策依据（考虑端口）
      const contexts = this.getNodeContextWithPorts(node.id)
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
            result: '请配置LLM模型',
            type: 'decision',
            success: false,
            error: '模型未配置'
          })
          node.status = 'error'
          this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
          return false
        }
        
        // 构建分支选择提示词
        const branchesInfo = node.decisionBranches.map(branch => 
          `分支ID: ${branch.id}\n分支名称: ${branch.name}\n描述: ${branch.description || '无'}`
        ).join('\n\n')
        
        const decisionPrompt = node.decisionPrompt || 
          `请根据以下内容进行分析决策，从提供的分支中选择最合适的一个：\n\n输入内容：{input}\n\n可用分支：{branches}\n\n请只返回分支ID，不要包含其他内容。`
        
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
            // 其他模型类型...
          }
          
          const aiResponse = await new Promise<string>((resolve, reject) => {
            if (!this.store.sendToAI) {
              reject(new Error('store.sendToAI 不存在'))
              return
            }
            
            this.store.sendToAI(
              messages,
              null,
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
            result: '请配置决策规则',
            type: 'decision',
            success: false,
            error: '规则未配置'
          })
          node.status = 'error'
          this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
          return false
        }
        
        try {
          const rules = JSON.parse(node.decisionRules)
          if (!Array.isArray(rules)) {
            throw new Error('规则必须是数组格式')
          }
          
          // 评估规则
          for (const rule of rules) {
            if (rule.condition && rule.branch) {
              try {
                // 创建一个安全的评估环境
                const safeEval = (condition: string, context: any): boolean => {
                  try {
                    // 简单的条件评估，实际项目中应该使用更安全的评估方法
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
                    
                    // 默认情况
                    return false
                  } catch {
                    return false
                  }
                }
                
                if (safeEval(rule.condition, { input: inputData })) {
                  selectedBranchId = rule.branch
                  reason = `规则匹配: ${rule.condition}`
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
              reason = '默认规则'
            }
          }
          
        } catch (error: any) {
          node.result = JSON.stringify({
            result: `规则解析失败: ${error.message}`,
            type: 'decision',
            success: false,
            error: error.message
          })
          node.status = 'error'
          this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
          return false
        }
      }
      
      // 验证选中的分支是否有效
      if (!selectedBranchId || !node.decisionBranches.some(branch => branch.id === selectedBranchId)) {
        // 如果没有有效选择，使用第一个分支作为默认
        selectedBranchId = node.decisionBranches[0].id
        reason = '默认分支（无有效选择）'
      }
      
      // 记录决策结果
      this.decisionPaths.set(node.id, selectedBranchId)
      
      const selectedBranch = node.decisionBranches.find(branch => branch.id === selectedBranchId)
      
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
        allBranches: node.decisionBranches,
        inputPreview: inputData.substring(0, 200) + (inputData.length > 200 ? '...' : ''),
        timestamp: new Date().toISOString()
      }
      
      node.result = JSON.stringify(formattedResult)
      node.status = 'success'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'success', node.result)
      this.callbacks.onSaveWorkflow?.()
      return true
      
    } catch (error: any) {
      node.result = JSON.stringify({
        result: `决策失败: ${error.message}`,
        type: 'decision',
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
      this.callbacks.onSaveWorkflow?.()
      return false
    }
  }
  
  private async runTextNode(node: NodeData): Promise<boolean> {
    if (!node.prompt || node.prompt.trim() === '') {
      node.result = JSON.stringify({
        result: '请输入文本',
        status: 'error'
      })
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
      return false
    }
    
    node.result = JSON.stringify({
      result: node.prompt,
      type: 'text'
    })
    
    node.status = 'success'
    this.callbacks.onNodeStatusUpdate?.(node.id, 'success', node.result)
    this.callbacks.onSaveWorkflow?.()
    return true
  }
  
  private async runStructuredNode(node: NodeData): Promise<boolean> {
    // 简化的结构化节点执行
    if (!node.structuredData || node.structuredData.length === 0) {
      node.result = JSON.stringify({
        result: '表格为空',
        type: 'structured',
        success: false,
        error: '表格为空'
      })
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
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
      this.callbacks.onSaveWorkflow?.()
      return true
      
    } catch (error: any) {
      node.result = JSON.stringify({
        result: `结构化处理失败: ${error.message}`,
        type: 'structured',
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
      this.callbacks.onSaveWorkflow?.()
      return false
    }
  }
  
  private async runWebpageNode(node: NodeData): Promise<boolean> {
    if (!node.prompt || node.prompt.trim() === '' || node.prompt === 'https://') {
      node.result = '请输入网址'
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
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
      this.callbacks.onSaveWorkflow?.()
      return true
    } catch (error: any) {
      node.result = `获取网页内容失败: ${error.message}`
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
      this.callbacks.onSaveWorkflow?.()
      return false
    }
  }
  
  private async runWebNode(node: NodeData): Promise<boolean> {
    if (!node.prompt || node.prompt.trim() === '') {
      node.result = '请输入搜索关键词'
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
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
      this.callbacks.onSaveWorkflow?.()
      return true
    } catch (error: any) {
      node.result = `搜索失败: ${error.message}`
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
      this.callbacks.onSaveWorkflow?.()
      return false
    }
  }
  
  private async runLocalNode(node: NodeData): Promise<boolean> {
    let filePath = node.prompt;
    
    if (!filePath || filePath.trim() === '' || filePath === '拖入文件或点击选择') {
      const contexts = this.getNodeContextWithPorts(node.id);
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
          result: '请选择文件或连接提供文件路径的上游节点',
          type: 'local',
          success: false,
          error: '文件路径为空'
        });
        node.status = 'error';
        this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result);
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
            result: '请配置模板',
            type: 'local',
            success: false,
            error: '模板配置为空'
          });
          node.status = 'error';
          this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result);
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
          filteredContent = filteredContent.replace(pattern, '[图片已过滤]');
        });
        
        const markdownBase64Pattern = /!\[[^\]]*\]\(data:image\/[^)]+\)/gi;
        filteredContent = filteredContent.replace(markdownBase64Pattern, '![图片已过滤]');
        
        const htmlBase64Pattern = /<img[^>]+src=["']data:image\/[^"']+["'][^>]*>/gi;
        filteredContent = filteredContent.replace(htmlBase64Pattern, '<img src="[图片已过滤]">');
        
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
            this.log(`模板 "${template.name}" 匹配失败: ${error.message}`, 'warning');
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
          result: `文件处理完成。总共匹配到 ${allMatches.length} 个位置，生成 ${templates.length} 组切片。`,
          timestamp: new Date().toISOString()
        };

        node.result = JSON.stringify(formattedResult);
      }
      
      node.status = 'success';
      this.callbacks.onNodeStatusUpdate?.(node.id, 'success', node.result);
      this.callbacks.onSaveWorkflow?.();
      return true;
      
    } catch (error: any) {
      node.result = JSON.stringify({
        result: `读取文件失败: ${error.message}`,
        type: 'local',
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      node.status = 'error';
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result);
      this.callbacks.onSaveWorkflow?.();
      return false;
    }
  }
  
  private async runPythonNode(node: NodeData): Promise<boolean> {
    const pythonCode = node.prompt || ''
    
    if (!pythonCode.trim()) {
      node.result = '请输入代码'
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
      return false
    }
    
    const sourceLinks = this.workflowData.links.filter(link => link.target === node.id)
    const upstreamData = sourceLinks.length > 0 ? this.getUpstreamDataWithPorts(node.id) : null
    
    try {
      const environment = this.store.TrustedPython ? 'trusted' : 'safe'
      
      const result = await this.safeIpcInvoke('executePythonCodeWithEnvironment', {
        code: pythonCode,
        environment: environment,
        input: upstreamData
      })
      
      if (result.success) {
        node.result = JSON.stringify({
          result: result.output?.trim() || result.result || '✓',
          type: 'python',
          success: true
        })
        node.status = 'success'
        this.callbacks.onNodeStatusUpdate?.(node.id, 'success', node.result)
        this.callbacks.onSaveWorkflow?.()
        return true
      } else {
        node.result = JSON.stringify({
          result: `Python执行错误: ${result.error || '未知错误'}`,
          type: 'python',
          success: false,
          error: result.error,
          timestamp: new Date().toISOString()
        })
        node.status = 'error'
        this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
        this.callbacks.onSaveWorkflow?.()
        return false
      }
    } catch (error: any) {
      node.result = JSON.stringify({
        result: `Python执行异常: ${error.message}`,
        type: 'python',
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
      this.callbacks.onSaveWorkflow?.()
      return false
    }
  }
  
  private async runKnowledgeNode(node: NodeData): Promise<boolean> {
    if (!node.kbPath || node.kbPath.trim() === '') {
      node.result = JSON.stringify({
        result: '请选择知识库文件',
        type: 'knowledge_retrieval',
        success: false,
        error: '请选择知识库文件'
      })
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
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
        result: '请输入查询文本',
        type: 'knowledge_retrieval',
        success: false,
        error: '请输入查询文本'
      })
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
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
      
      const formattedResult = {
        type: 'knowledge_retrieval',
        success: true,
        query: queryText,
        context: retrievalResult.context,
        relevantBlocks: retrievalResult.relevantBlocks,
        usedEmbedModel: retrievalResult.usedEmbedModel,
        debugInfo: retrievalResult.debugInfo,
        timestamp: new Date().toISOString()
      }
      
      node.result = JSON.stringify(formattedResult)
      node.status = 'success'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'success', node.result)
      this.callbacks.onSaveWorkflow?.()
      return true
      
    } catch (error: any) {
      node.result = JSON.stringify({
        result: `知识库检索失败: ${error.message}`,
        type: 'knowledge_retrieval',
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
      this.callbacks.onSaveWorkflow?.()
      return false
    }
  }
  
  private async runMcpNode(node: NodeData): Promise<boolean> {
    if (!node.mcpConfig) {
      node.result = JSON.stringify({
        result: 'MCP 配置为空',
        type: 'mcp',
        success: false,
        error: 'MCP 配置为空'
      })
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
      return false
    }
    
    try {
      // 检查是否需要自动连接
      let connected = mcpManager.isConnected(node.id)
      
      if (!connected && node.mcpConfig.autoConnect !== false) {
        try {
          connected = await this.connectMcpNode(node.id)
          if (!connected) {
            throw new Error('自动连接失败')
          }
        } catch (error: any) {
          node.result = JSON.stringify({
            result: `MCP 连接失败: ${error.message}`,
            type: 'mcp',
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
          })
          node.status = 'error'
          this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
          this.callbacks.onSaveWorkflow?.()
          return false
        }
      }
      
      if (!connected) {
        node.result = JSON.stringify({
          result: 'MCP 未连接',
          type: 'mcp',
          success: false,
          error: 'MCP 未连接',
          timestamp: new Date().toISOString()
        })
        node.status = 'error'
        this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
        this.callbacks.onSaveWorkflow?.()
        return false
      }
      
      // 检查是否有选中的工具
      const selectedTool = node.mcpConfig.selectedTool
      if (!selectedTool) {
        node.result = JSON.stringify({
          result: '未选择 MCP 工具',
          type: 'mcp',
          success: false,
          error: '未选择 MCP 工具',
          availableTools: node.mcpTools?.map(t => t.name) || [],
          timestamp: new Date().toISOString()
        })
        node.status = 'error'
        this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
        this.callbacks.onSaveWorkflow?.()
        return false
      }
      
      // 准备工具参数
      let toolArguments = node.mcpConfig.toolArguments || {}
      
      // 如果有上游节点，可以将其结果作为输入（考虑端口）
      const contexts = this.getNodeContextWithPorts(node.id)
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
      
      this.log(`执行 MCP 工具: ${selectedTool}，参数: ${JSON.stringify(toolArguments)}`, 'info')
      
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
        this.callbacks.onSaveWorkflow?.()
        
        this.log(`MCP 工具执行成功: ${selectedTool}`, 'info')
        return true
      } else {
        const formattedResult = {
          type: 'mcp',
          success: false,
          result: `MCP 工具执行失败: ${toolResult.error}`,
          tool: selectedTool,
          arguments: toolArguments,
          error: toolResult.error,
          details: toolResult.details,
          timestamp: new Date().toISOString()
        }
        
        node.result = JSON.stringify(formattedResult)
        node.status = 'error'
        this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
        this.callbacks.onSaveWorkflow?.()
        
        this.log(`MCP 工具执行失败: ${selectedTool} - ${toolResult.error}`, 'error')
        return false
      }
      
    } catch (error: any) {
      const formattedResult = {
        type: 'mcp',
        success: false,
        result: `MCP 节点执行异常: ${error.message}`,
        error: error.message,
        timestamp: new Date().toISOString()
      }
      
      node.result = JSON.stringify(formattedResult)
      node.status = 'error'
      this.callbacks.onNodeStatusUpdate?.(node.id, 'error', node.result)
      this.callbacks.onSaveWorkflow?.()
      
      this.log(`MCP 节点执行异常: ${error.message}`, 'error')
      return false
    }
  }
  
  // 辅助方法
  private validateModelConfig(node: NodeData): { valid: boolean; message: string } {
    if (!node.model_type) {
      return { valid: false, message: '请选择模型类型' }
    }
    
    if (!node.model) {
      return { valid: false, message: '请选择模型' }
    }
    
    switch (node.model_type) {
      case 'ollama':
        break
        
      case 'openai':
      case 'deepseek':
        if (!this.store.AIconfig?.llm?.openai?.api_key) {
          return { valid: false, message: '需要API密钥' }
        }
        break
        
      case 'anthropic':
        if (!this.store.AIconfig?.llm?.anthropic?.api_key) {
          return { valid: false, message: '需要API密钥' }
        }
        break
        
      case 'google':
        if (!this.store.AIconfig?.llm?.google?.api_key) {
          return { valid: false, message: '需要API密钥' }
        }
        break
        
      case 'azure':
        if (!this.store.AIconfig?.llm?.azure?.api_key || !this.store.AIconfig?.llm?.azure?.endpoint || !this.store.AIconfig?.llm?.azure?.deployment) {
          return { valid: false, message: '需要API密钥' }
        }
        break
        
      case 'custom':
        if (!this.store.AIconfig?.llm?.custom?.api_url) {
          return { valid: false, message: '需要API地址' }
        }
        break
    }
    
    return { valid: true, message: '' }
  }
  
  // 新增：支持端口的节点上下文获取方法
  private getNodeContextWithPorts(nodeId: number): string[] {
    const sourceLinks = this.workflowData.links.filter(link => link.target === nodeId)
    const contexts: string[] = []
    
    for (const link of sourceLinks) {
      const sourceNode = this.workflowData.items.find(n => n.id === link.source)
      if (!sourceNode) continue
      
      // 检查源节点是否在活跃路径中
      if (!this.activePath.has(sourceNode.id)) {
        continue
      }
      
      // 获取源节点的数据（考虑端口）
      const nodeData = this.getSourceNodeData(sourceNode.id, link.sourcePort)
      if (nodeData !== null && nodeData !== undefined) {
        // 直接添加格式化后的字符串
        contexts.push(String(nodeData))
      }
    }
    
    return contexts
  }
  
  private getSourceNodeData(sourceNodeId: number, sourcePort?: string): any {
    const sourceNode = this.workflowData.items.find(n => n.id === sourceNodeId)
    if (!sourceNode || !sourceNode.result) {
      return null
    }
    
    try {
      const parsed = JSON.parse(sourceNode.result)
      
      // 特殊处理决策节点
      if (sourceNode.type === 'decision') {
        // 对于连接到决策节点的下游节点，我们始终提供决策节点的上游数据
        // 因为分支节点需要基于原始数据进行处理，而不是决策结果本身
        
        // 从决策节点的结果中获取上游数据
        if (parsed.upstreamData) {
          // 如果是字符串格式的上游数据，直接返回
          if (typeof parsed.upstreamData === 'string') {
            return parsed.upstreamData
          }
          // 如果是对象格式，合并所有值
          else if (typeof parsed.upstreamData === 'object') {
            const values = Object.values(parsed.upstreamData)
            if (values.length > 0) {
              return values.join('\n\n')
            }
          }
        }
        
        // 如果没有格式化后的上游数据，尝试从原始数据获取
        if (parsed.upstreamDataRaw && typeof parsed.upstreamDataRaw === 'object') {
          const values = Object.values(parsed.upstreamDataRaw)
          if (values.length > 0) {
            return values.map(val => 
              typeof val === 'string' ? val : JSON.stringify(val, null, 2)
            ).join('\n\n')
          }
        }
        
        // 如果也没有原始数据，返回决策结果本身
        return parsed.result || JSON.stringify(parsed, null, 2)
      }
      
      // 本地文件节点且有端口连接
      if (sourceNode.type === 'local' && sourceNode.fileMode === 'template') {
        // 优先从 outputByPort 中获取特定端口数据
        if (parsed.outputByPort && sourcePort) {
          const portData = parsed.outputByPort[sourcePort]
          if (portData !== undefined && portData !== null && portData !== '') {
            return portData
          }
        }
        
        // 如果没有特定端口数据，检查是否有切片数据
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
      
      // 如果都没有，返回整个解析对象
      return parsed
      
    } catch {
      // 如果解析失败，返回原始字符串
      return sourceNode.result
    }
  }
  // 辅助方法：格式化端口数据为下游节点可用的格式
  private formatPortDataForOutput(portData: any): string {
    if (portData === null || portData === undefined) {
      return ''
    }
    
    if (typeof portData === 'string') {
      return portData
    }
    
    if (typeof portData === 'object') {
      // 如果是空对象，返回空字符串
      if (Object.keys(portData).length === 0) {
        return ''
      }
      
      // 如果是切片数据对象（键值对），合并所有值
      const values = Object.values(portData)
      if (values.length === 0) {
        return ''
      }
      
      // 所有值都是字符串，用分隔符合并
      if (values.every(val => typeof val === 'string')) {
        return values.join('\n\n---\n\n')
      }
      
      // 尝试转换为JSON字符串
      try {
        return JSON.stringify(portData, null, 2)
      } catch {
        return String(portData)
      }
    }
    
    return String(portData)
  }

  // 辅助方法：格式化切片数据
  private formatSlicesForOutput(slices: Record<string, string>): string {
    if (!slices || Object.keys(slices).length === 0) {
      return ''
    }
    
    const sliceValues = Object.values(slices)
    if (sliceValues.length === 0) {
      return ''
    }
    
    // 合并所有切片内容
    return sliceValues.join('\n\n---\n\n')
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
      
      // 检查源节点是否在活跃路径中
      if (!this.activePath.has(sourceNode.id)) {
        continue
      }
      
      const key = `node_${sourceNode.id}${link.sourcePort ? '_' + link.sourcePort : ''}`
      
      // 获取源节点数据（考虑端口）
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
      
      // 检查源节点是否在活跃路径中
      if (!this.activePath.has(sourceNode.id)) {
        continue
      }
      
      // 获取源节点数据（考虑端口）
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
          // 尝试从错误信息中提取Python错误
          const errorStr = String(parsed.error)
          const lines = errorStr.split('\n')
          
          // 查找包含Python错误信息的行
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
  private extractBranchIdFromResponse(response: string, branches: Array<{id: string, name: string}>): string {
    // 清理响应文本
    const cleanResponse = response.trim().toLowerCase()
    
    // 尝试直接匹配分支ID
    for (const branch of branches) {
      if (cleanResponse.includes(branch.id.toLowerCase())) {
        return branch.id
      }
    }
    
    // 尝试匹配分支名称
    for (const branch of branches) {
      if (cleanResponse.includes(branch.name.toLowerCase())) {
        return branch.id
      }
    }
    
    // 提取可能的数字索引
    const numberMatch = cleanResponse.match(/(\d+)/)
    if (numberMatch) {
      const index = parseInt(numberMatch[1]) - 1
      if (index >= 0 && index < branches.length) {
        return branches[index].id
      }
    }
    
    // 默认返回第一个分支
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