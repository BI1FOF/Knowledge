// utils/mcpManager.ts

// 定义 MCP 工具接口
export interface McpTool {
  name: string
  description: string
  inputSchema: any
  metadata?: {
    serverName?: string
    serverVersion?: string
  }
}

// MCP 响应内容接口
interface McpContent {
  type: string
  text?: string
  [key: string]: any
}

// MCP 工具调用结果接口
interface McpToolResult {
  content?: McpContent[] | any
  isError?: boolean
  [key: string]: any
}

export class MCPManager {
  private clients: Map<number, any> = new Map() // nodeId -> Client (使用 any 避免类型问题)
  private toolsCache: Map<number, McpTool[]> = new Map() // nodeId -> 工具列表
  
  // 动态导入 MCP SDK（避免类型问题）
  private async getMCPClient(): Promise<any> {
    try {
      // 动态导入以避免类型检查问题
      const mcp = await import('@modelcontextprotocol/sdk/client/index.js')
      return mcp.Client
    } catch (error) {
      console.error('导入 MCP SDK 失败:', error)
      throw new Error('MCP SDK 未安装或导入失败')
    }
  }
  
  // 动态导入传输器
  private async getTransport(transportType: string, config: any): Promise<any> {
    try {
      if (transportType === 'stdio') {
        const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js')
        return new StdioClientTransport({
          command: config.command,
          args: config.args || [],
          env: config.env || {}
        })
      } else if (transportType === 'sse' || transportType === 'http') {
        const { SSEClientTransport } = await import('@modelcontextprotocol/sdk/client/sse.js')
        const serverUrl = new URL(config.serverUrl)
        return new SSEClientTransport(serverUrl)
      }
      throw new Error(`不支持的 transport 类型: ${transportType}`)
    } catch (error) {
      console.error('导入传输器失败:', error)
      throw error
    }
  }
  
  // 连接 MCP 服务器
  async connect(nodeId: number, config: any): Promise<boolean> {
    try {
      if (!config) {
        throw new Error('MCP 配置为空')
      }
      
      const transportType = config.transport || 'stdio'
      
      // 验证配置
      if (transportType === 'stdio' && !config.command) {
        throw new Error('stdio 模式需要 command 配置')
      }
      
      if ((transportType === 'sse' || transportType === 'http') && !config.serverUrl) {
        throw new Error('sse/http 模式需要 serverUrl 配置')
      }
      
      // 获取传输器
      const transport = await this.getTransport(transportType, config)
      
      // 获取 Client 类
      const ClientClass = await this.getMCPClient()
      
      // 创建客户端 - 简化配置，避免类型问题
      const client = new ClientClass(
        {
          name: 'workflow-mcp-client',
          version: '1.0.0',
        },
        {
          // 空的配置，避免类型问题
        }
      )
      
      // 连接
      await client.connect(transport)
      this.clients.set(nodeId, client)
      
      // 获取可用工具
      await this.refreshTools(nodeId)
      
      return true
    } catch (error: any) {
      console.error('MCP 连接失败:', error)
      throw error
    }
  }
  
  // 断开连接
  async disconnect(nodeId: number): Promise<void> {
    const client = this.clients.get(nodeId)
    if (client) {
      try {
        await client.close()
      } catch (error) {
        console.warn('断开 MCP 连接时出错:', error)
      }
      this.clients.delete(nodeId)
      this.toolsCache.delete(nodeId)
    }
  }
  
  // 刷新可用工具列表
  async refreshTools(nodeId: number): Promise<McpTool[]> {
    const client = this.clients.get(nodeId)
    if (!client) {
      throw new Error('MCP 客户端未连接')
    }
    
    try {
      // 尝试获取工具列表
      let response: any
      if (typeof client.listTools === 'function') {
        response = await client.listTools()
      } else {
        // 尝试其他可能的函数名
        const possibleMethods = ['tools', 'getTools', 'list_tools', 'get_tools']
        for (const method of possibleMethods) {
          if (typeof (client as any)[method] === 'function') {
            response = await (client as any)[method]()
            break
          }
        }
      }
      
      if (!response) {
        throw new Error('无法获取工具列表')
      }
      
      // 处理响应格式
      let toolsList: any[] = []
      
      if (Array.isArray(response)) {
        toolsList = response
      } else if (response && Array.isArray(response.tools)) {
        toolsList = response.tools
      } else if (response && response.tools && Array.isArray(response.tools.tools)) {
        toolsList = response.tools.tools
      }
      
      const tools: McpTool[] = toolsList.map((tool: any) => ({
        name: tool.name || tool.toolName || '',
        description: tool.description || '',
        inputSchema: tool.inputSchema || tool.schema || {},
        metadata: {
          serverName: tool.metadata?.serverName,
          serverVersion: tool.metadata?.serverVersion
        }
      }))
      
      this.toolsCache.set(nodeId, tools)
      return tools
    } catch (error) {
      console.error('获取工具列表失败:', error)
      
      // 如果失败，返回缓存的工具或模拟工具
      const cachedTools = this.toolsCache.get(nodeId)
      if (cachedTools && cachedTools.length > 0) {
        return cachedTools
      }
      
      // 返回模拟的工具列表
      const mockTools: McpTool[] = [
        {
          name: 'test_tool',
          description: '测试工具',
          inputSchema: {
            type: 'object',
            properties: {
              input: { type: 'string', description: '输入文本' }
            }
          }
        }
      ]
      
      this.toolsCache.set(nodeId, mockTools)
      return mockTools
    }
  }
  
  // 获取工具列表
  getTools(nodeId: number): McpTool[] {
    return this.toolsCache.get(nodeId) || []
  }
  
  // 执行工具 - 修正 result 变量作用域问题
  async callTool(nodeId: number, toolName: string, arguments_: Record<string, any> = {}): Promise<any> {
    const client = this.clients.get(nodeId)
    if (!client) {
      throw new Error('MCP 客户端未连接')
    }
    
    let result: McpToolResult | undefined // 明确声明为可选的
    
    try {
      // 调用工具
      if (typeof client.callTool === 'function') {
        result = await client.callTool({
          name: toolName,
          arguments: arguments_
        })
      } else {
        // 尝试其他可能的函数名
        const possibleMethods = ['tool', 'executeTool', 'call_tool', 'execute_tool']
        let methodFound = false
        for (const method of possibleMethods) {
          if (typeof (client as any)[method] === 'function') {
            result = await (client as any)[method]({
              name: toolName,
              arguments: arguments_
            })
            methodFound = true
            break
          }
        }
        
        if (!methodFound) {
          throw new Error('找不到工具调用方法')
        }
      }
      
      // 格式化结果 - 现在 result 肯定已赋值
      if (result) {
        // 处理 content
        if (result.content) {
          const content = result.content
          
          if (Array.isArray(content) && content.length > 0) {
            const firstItem = content[0]
            if (firstItem && typeof firstItem === 'object') {
              if (firstItem.type === 'text' && firstItem.text) {
                return {
                  success: true,
                  data: firstItem.text,
                  raw: result
                }
              } else if (firstItem.type === 'resource' && firstItem.resource) {
                return {
                  success: true,
                  data: firstItem.resource,
                  raw: result
                }
              } else if (firstItem.text) {
                return {
                  success: true,
                  data: firstItem.text,
                  raw: result
                }
              }
            }
          } else if (typeof content === 'string') {
            return {
              success: true,
              data: content,
              raw: result
            }
          } else if (content && typeof content === 'object') {
            // 尝试提取文本
            const text = (content as any).text || 
                        (content as any).result || 
                        JSON.stringify(content, null, 2)
            return {
              success: true,
              data: text,
              raw: result
            }
          }
        }
        
        // 如果 content 不存在，直接返回结果
        return {
          success: true,
          data: result,
          raw: result
        }
      }
      
      // 默认返回
      return {
        success: true,
        data: '工具执行完成',
        raw: result
      }
    } catch (error: any) {
      console.error('调用工具失败:', error)
      return {
        success: false,
        error: error.message || '工具调用失败',
        details: error,
        raw: result // 这里 result 可能是 undefined
      }
    }
  }
  
  // 检查连接状态
  isConnected(nodeId: number): boolean {
    return this.clients.has(nodeId)
  }
  
  // 清理所有连接
  cleanup(): void {
    this.clients.forEach((client, nodeId) => {
      this.disconnect(nodeId).catch(console.error)
    })
  }
  
  // 测试连接
  async testConnection(config: any): Promise<{ success: boolean; error?: string; tools?: McpTool[] }> {
    let client: any = null
    let transport: any = null
    
    try {
      const transportType = config.transport || 'stdio'
      
      // 获取传输器
      transport = await this.getTransport(transportType, config)
      
      // 获取 Client 类
      const ClientClass = await this.getMCPClient()
      
      // 创建客户端
      client = new ClientClass(
        {
          name: 'workflow-mcp-test-client',
          version: '1.0.0',
        },
        {}
      )
      
      // 连接
      await client.connect(transport)
      
      // 尝试获取工具列表
      let tools: McpTool[] = []
      try {
        tools = await this.refreshToolsForTest(client)
      } catch (toolError) {
        console.warn('获取工具列表失败，但连接成功:', toolError)
      }
      
      return {
        success: true,
        tools: tools
      }
      
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      }
    } finally {
      // 清理临时连接
      if (client) {
        try {
          await client.close()
        } catch (closeError) {
          console.warn('关闭测试连接时出错:', closeError)
        }
      }
    }
  }
  
  // 测试连接专用的工具列表获取
  private async refreshToolsForTest(client: any): Promise<McpTool[]> {
    try {
      let response: any
      if (typeof client.listTools === 'function') {
        response = await client.listTools()
      }
      
      if (!response) {
        return []
      }
      
      let toolsList: any[] = []
      
      if (Array.isArray(response)) {
        toolsList = response
      } else if (response && Array.isArray(response.tools)) {
        toolsList = response.tools
      }
      
      return toolsList.map((tool: any) => ({
        name: tool.name || '',
        description: tool.description || '',
        inputSchema: tool.inputSchema || {}
      }))
    } catch (error) {
      console.warn('测试连接中获取工具失败:', error)
      return []
    }
  }
}

// 单例实例
export const mcpManager = new MCPManager()