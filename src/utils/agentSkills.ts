// utils/agentSkills.ts

// 技能元数据接口
export interface SkillMetadata {
  name: string
  description: string
  version?: string
  author?: string
  tags?: string[]
  requires?: {
    models?: string[]
  }
}

// 技能接口
export interface Skill {
  name: string
  description: string
  path: string
  metadata: SkillMetadata
  content: string
  files: string[]
}

// 技能执行步骤类型
export type StepType = 
  | 'think'        // 思考/推理
  | 'web_search'   // 网页搜索
  | 'web_fetch'    // 获取网页内容
  | 'read_file'    // 读取文件
  | 'write_file'   // 写入文件
  | 'run_python'   // 执行Python代码
  | 'ask_user'     // 询问用户
  | 'replan'       // 重新规划后续步骤
  | 'respond'      // 响应结果

// 执行步骤接口
export interface ExecutionStep {
  id: string
  type: StepType
  description: string
  params: Record<string, any>
  status: 'pending' | 'running' | 'success' | 'error'
  result?: any
  error?: string
  startTime?: number
  endTime?: number
  // 重规划相关字段
  originalPlan?: ExecutionStep[]  // 原始计划（用于重规划时保存）
  newPlan?: ExecutionStep[]       // 新计划（重规划后生成）
  // 流式内容字段
  streamContent?: string          // 流式输出的推理内容
  // 显示控制
  showDetails?: boolean           // true显示推理过程，false显示结果
  // 结果预览
  resultPreview?: string          // 结果预览（截断后的）
  // 文件压缩相关
  originalLength?: number         // 原始文件长度
  compressedLength?: number       // 压缩后长度
}

// 规划上下文接口
export interface PlanningContext {
  skill: Skill | null
  userInput: string
  executedSteps?: ExecutionStep[]
  additionalContext?: string
  isReplan?: boolean
  userAnswer?: string
}

// 技能执行上下文
export interface SkillExecutionContext {
  input: string
  files?: Record<string, string>  // 文件名 -> 内容
  variables?: Record<string, any>
  store: any
  callbacks?: {
    onUserQuestion?: (askId: string, question: string, resolve: (value: string) => void, reject: (reason?: any) => void) => void
  }
}

// 技能执行结果
export interface SkillExecutionResult {
  success: boolean
  result: string
  steps: ExecutionStep[]
  executionTime: number
  error?: string
}

// 执行状态回调 - 增强以支持流式输出
export interface ExecutionCallbacks {
  onStepStart?: (step: ExecutionStep) => void
  onStepComplete?: (step: ExecutionStep) => void
  onStepError?: (step: ExecutionStep, error: string) => void
  onLog?: (message: string, level: 'info' | 'warning' | 'error') => void
  onProgress?: (current: number, total: number, stepDescription: string) => void
  // 流式输出回调
  onStream?: (content: string, stepId: string) => void
  // 重规划回调
  onReplan?: (originalStep: ExecutionStep, newPlan: ExecutionStep[]) => void
}

// 规划结果接口
export interface PlanningResult {
  steps: ExecutionStep[]
  error?: string
}

// 压缩配置
interface CompressionConfig {
  enabled: boolean           // 是否启用压缩
  threshold: number          // 触发压缩的阈值（字符数）
  minLength: number          // 压缩最小长度
  maxLength: number          // 压缩最大长度
  cacheOriginal: boolean     // 是否缓存原始内容（用于写入操作）
}

// 技能管理器类
export class SkillManager {
  private skills: Map<string, Skill> = new Map()
  private skillsPath: string = ''
  private loading: boolean = false
  private store: any
  
  // 步骤ID计数器 - 统一步骤ID生成
  private stepIdCounter: number = 0
  
  // 压缩配置
  private compressionConfig: CompressionConfig = {
    enabled: true,
    threshold: 1000,      // 超过1000字符触发压缩
    minLength: 20,        // 压缩后最少20字
    maxLength: 1000,      // 压缩后最多1000字
    cacheOriginal: true   // 缓存原始内容供写入操作使用
  }

  constructor(store: any) {
    this.store = store
  }

  // 配置压缩选项
  configureCompression(config: Partial<CompressionConfig>): void {
    this.compressionConfig = { ...this.compressionConfig, ...config }
  }

  // 统一生成步骤ID
  private getNextStepId(): string {
    this.stepIdCounter++
    return `step_${this.stepIdCounter}`
  }

  // 重置步骤ID计数器
  private resetStepIdCounter(startFrom: number = 0): void {
    this.stepIdCounter = startFrom
  }

  // 从已有步骤中初始化ID计数器
  private initStepIdCounterFromSteps(steps: ExecutionStep[]): void {
    let maxId = 0
    for (const step of steps) {
      const match = step.id.match(/step_(\d+)/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxId) maxId = num
      }
    }
    this.stepIdCounter = maxId
  }

  // 获取所有技能
  getSkills(): Skill[] {
    return Array.from(this.skills.values())
  }

  // 获取技能
  getSkill(name: string): Skill | undefined {
    return this.skills.get(name)
  }

  // 获取技能路径
  getSkillsPath(): string {
    return this.skillsPath
  }

  // 是否正在加载
  isLoading(): boolean {
    return this.loading
  }

  // 加载技能
  async loadSkills(path: string): Promise<Skill[]> {
    if (!path) {
      this.skills.clear()
      this.skillsPath = ''
      return []
    }

    this.loading = true
    this.skillsPath = path

    try {
      const loadedSkills = await window.ipcRenderer.invoke('loadSkills', path)
      
      const skills: Skill[] = []
      this.skills.clear()

      for (const skillData of loadedSkills) {
        const skill: Skill = {
          name: skillData.name,
          description: skillData.description,
          path: skillData.path,
          metadata: skillData.metadata || { 
            name: skillData.name, 
            description: skillData.description 
          },
          content: skillData.preview?.content || '',
          files: skillData.preview?.files || []
        }

        this.skills.set(skill.name, skill)
        skills.push(skill)
      }

      return skills
    } catch (error) {
      console.error('加载技能失败:', error)
      throw error
    } finally {
      this.loading = false
    }
  }

  // 刷新技能
  async refreshSkills(): Promise<Skill[]> {
    if (!this.skillsPath) {
      return []
    }
    return this.loadSkills(this.skillsPath)
  }

  // 根据用户输入匹配合适的技能
  async matchSkill(userInput: string): Promise<{ skillName: string | null; intent: 'execute' | 'help' | 'list' }> {
    console.log('当前技能数量:', this.skills.size)
    
    // 如果没有技能，返回列表意图和null技能名
    if (this.skills.size === 0) {
      return {
        intent: 'list',
        skillName: null
      }
    }
    
    // 获取所有技能的元数据
    const skillsMetadata = Array.from(this.skills.values()).map(skill => ({
      name: skill.name,
      description: skill.description,
    }))

    const prompt = `你是一个技能匹配专家。请根据用户输入，判断用户意图并选择最匹配的技能。

用户输入: "${userInput}"

技能列表:
${JSON.stringify(skillsMetadata, null, 2)}

请分析用户输入，判断用户的意图：
1. 如果用户想要查看所有技能列表，意图为 list，skillName 返回 null
2. 如果用户想要查看某个技能的使用帮助，意图为 help，并从技能列表中选择最匹配的一个技能名称
3. 如果用户想要执行某个技能，意图为 execute，并从技能列表中选择最匹配的一个技能名称，如果都不匹配需要返回null，将激活自主规划

返回格式必须是纯JSON对象，不要使用markdown代码块，不要添加任何额外说明：
{
  "intent": "execute",
  "skillName": "技能名称"
}`

    try {
      const response = await this.callLLM(prompt, { 
        temperature: 0.3,
        maxTokens: 1000
      })

      console.log('技能匹配原始响应:', response)
      
      // 清理响应文本，移除markdown代码块标记
      let cleanResponse = response.trim()
      
      // 移除开头的 ```json 或 ```
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.substring(7)
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.substring(3)
      }
      
      // 移除结尾的 ```
      if (cleanResponse.endsWith('```')) {
        cleanResponse = cleanResponse.substring(0, cleanResponse.length - 3)
      }
      
      // 再次trim
      cleanResponse = cleanResponse.trim()
      
      console.log('清理后的响应:', cleanResponse)
      
      // 解析JSON响应
      const result = JSON.parse(cleanResponse)
      
      // 验证返回的意图是否有效
      const intent = result.intent === 'list' ? 'list' : 
                    (result.intent === 'help' ? 'help' : 'execute')
      
      // 如果是list意图，直接返回
      if (intent === 'list') {
        console.log('用户意图: 查看技能列表')
        return {
          intent: 'list',
          skillName: null
        }
      }
      
      // 对于execute和help意图，验证技能是否存在
      if (result.skillName) {
        const matchedSkill = this.skills.get(result.skillName)
        if (matchedSkill) {
          console.log(`用户意图: ${intent === 'execute' ? '执行技能' : '查看帮助'}, 技能: ${matchedSkill.name}`)
          return {
            intent: intent,
            skillName: matchedSkill.name
          }
        }
      }
      
      console.log(`没有找到匹配的技能，意图: ${intent}`)
      return {
        intent: intent,
        skillName: null
      }

    } catch (error) {    
      // 失败时返回默认的execute意图
      return {
        intent: 'execute',
        skillName: null
      }
    }
  }

  // 执行技能 - 每次都会重新规划
  async executeSkill(
    skillName: string | null,
    context: SkillExecutionContext,
    callbacks?: ExecutionCallbacks
  ): Promise<SkillExecutionResult> {
    const startTime = Date.now()
    const steps: ExecutionStep[] = []
    const isAutonomous = !skillName

    const log = (message: string, level: 'info' | 'warning' | 'error' = 'info') => {
      callbacks?.onLog?.(message, level)
    }

    try {
      if (context.files) {
        log(`上传文件: ${Object.keys(context.files).join(', ')}`)
      }

      const skill = skillName ? this.skills.get(skillName) ?? null : null
      
      if (skillName && !skill) {
        throw new Error(`技能不存在: ${skillName}`)
      }

      // 重置计数器
      this.resetStepIdCounter()

      log(isAutonomous ? '开始自主规划执行步骤...' : '开始规划执行步骤...')
      const planningContext: PlanningContext = {
        skill,
        userInput: context.input,
        executedSteps: [],
        isReplan: false
      }
      
      const planSteps = await this.planSteps(planningContext, log)
      log(`规划完成，共 ${planSteps.length} 个步骤`)
      console.log('规划步骤详情:', JSON.stringify(planSteps, null, 2))
      
      log('开始执行步骤...')
      const result = await this.executeStepsWithReplan(planSteps, skill, context, callbacks, log)
      
      log(`执行${result.success ? '成功' : '失败'}`)
      log(`执行耗时: ${Date.now() - startTime}ms`)
      
      return {
        success: result.success,
        result: result.finalResult,
        steps: result.steps,
        executionTime: Date.now() - startTime
      }

    } catch (error: any) {
      log(`执行失败: ${error.message}`, 'error')
      console.error('[Execution Error]', error)
      
      return {
        success: false,
        result: `执行失败: ${error.message}`,
        steps,
        executionTime: Date.now() - startTime,
        error: error.message
      }
    }
  }

  // 统一的规划方法
  private async planSteps(
    planningContext: PlanningContext,
    log: (message: string, level?: 'info' | 'warning' | 'error') => void
  ): Promise<ExecutionStep[]> {
    const { skill, userInput, executedSteps = [], additionalContext = '', isReplan = false, userAnswer = '' } = planningContext

    const executedStepsSummary = executedSteps.map(step => ({
      id: step.id,
      type: step.type,
      description: step.description,
      status: step.status,
      result: step.result ? (typeof step.result === 'string' ? step.result.substring(0, 200) + (step.result.length > 200 ? '...' : '') : '有结果') : '无结果'
    }))

    let skillInfoSection = ''
    if (skill) {
      const skillFullPath = skill.path.replace(/\\/g, '/').replace(/\/+/g, '/')
      
      const fileList = !skill.files || skill.files.length === 0 
        ? '无文件' 
        : skill.files.map((f: any) => {
            if (typeof f === 'string') return `- ${f}`
            if (f && typeof f === 'object' && 'name' in f) return `- ${f.name}`
            return `- ${String(f)}`
          }).join('\n  ')

      skillInfoSection = `
  ## 技能信息
  请基于以下技能说明规划执行步骤：

  技能文件夹路径: ${skillFullPath}
  技能文件夹包含的文件:
  ${fileList}

  ${skill.content}

  注意：你可以利用这个专用技能来完成用户需求，技能文件夹中的文件可以帮助你完成任务。
  `
    } else {
      skillInfoSection = `
  ## 自主规划模式
  你需要作为通用AI助手自主规划执行步骤，你可以灵活运用各种能力来满足用户需求。
  `
    }

    // 重规划说明 - 允许继续询问用户
    let replanNote = ''
    if (isReplan) {
      replanNote = `
  ## 重规划说明
  你正在进行重规划。用户已经提供了回答，但如果你仍然需要更多信息来更好地完成任务，
  可以继续使用 ask_user 步骤向用户询问。ask_user 后必须跟 replan 步骤。
  `
    }

    const systemPrompt = `你是一个任务规划专家。请根据${skill ? '技能信息' : '用户需求'}${isReplan ? '、用户最新回答' : ''}和已执行步骤，规划具体的执行步骤。

  ${skillInfoSection}
  ${replanNote}

  ## 当前任务
  用户需求: ${userInput}
  ${additionalContext ? `额外信息: ${additionalContext}` : ''}
  ${isReplan && userAnswer ? `用户最新回答: ${userAnswer}` : ''}

  ## 已执行步骤
  ${executedStepsSummary.length > 0 ? JSON.stringify(executedStepsSummary, null, 2) : '尚无已执行步骤'}

  ## 可用步骤类型
  - think: 思考/推理，需要思考什么问题
  - web_search: 网页搜索，需要搜索什么关键词（使用s.jina.ai服务）
  - web_fetch: 获取网页内容，需要什么URL（直接访问网页）
  - read_file: 读取文件，需要什么文件路径${skill ? '（可以使用技能文件夹内的相对路径，如"手册.md"，不要使用以/开头的路径）' : ''}
  - write_file: 写入文件，需要文件路径和内容${skill ? '（如果使用相对路径，将相对于技能文件夹创建）' : ''}
    * 直接在 params.content 中提供具体内容
    * 使用 {{result}} 引用上一步的结果
    * 如果留空，系统会尝试从上一步结果获取
  - run_python: 执行Python代码，需要什么代码
  - ask_user: 询问用户，需要什么问题
  - replan: 重新规划后续步骤（用于在ask_user后，根据用户回答调整计划）
  - respond: 输出最终结果（只在任务完成时使用）

  ## 重要规则

  1. **ask_user 和 replan 的配对规则**:
    - 当你需要向用户提问时，使用 ask_user 步骤
    - 在 ask_user 步骤之后，必须立即跟一个 replan 步骤
    - 不要在 ask_user 后面直接跟 respond 或其他步骤

  2. **文件路径处理**${skill ? ':' : '（无专用技能时需使用绝对路径）'}:
    ${skill 
      ? '- read_file 和 write_file 可以使用相对路径，系统会自动补全为技能文件夹下的完整路径'
      : '- read_file 和 write_file 需要使用绝对路径，或明确指定文件位置'
    }

  3. **代码生成与执行**:
    - 如果需要编写代码，可以规划 think 步骤来生成代码
    - 生成的代码应该放在代码块中（\`\`\`python ... \`\`\`）
    - 后续的 run_python 步骤会从上一步的结果中提取代码执行

  4. **最后一步规则**:
    - 规划的最后一个步骤必须是 respond 类型
    - respond 步骤不需要 params 参数，会自动返回上一步结果

  5. **${skill ? '技能使用原则' : '自主规划原则'}**:
    ${skill 
      ? '- 优先利用专用技能的能力来满足用户需求'
      : '- 根据用户需求自主决定需要执行哪些步骤'
    }
    ${skill
      ? '- 技能文件夹中的文件可以作为任务的输入或参考'
      : '- 如果需求不明确，可以使用 ask_user 向用户询问澄清'
    }
    ${skill
      ? '- 遵循技能说明中可能定义的步骤序列'
      : '- 作为通用AI助手，灵活运用各种能力'
    }

  ## 规划要求
  请根据以上信息规划具体的执行步骤${skill ? '，将技能说明转化为可执行的步骤' : '，以最有效的方式满足用户需求'}。

  返回JSON格式的步骤数组，每个步骤包含:
  - id: 步骤唯一标识 (step_1, step_2, ...)
  - type: 步骤类型
  - description: 步骤描述
  - params: 步骤参数对象（read_file和write_file步骤需要 path 参数，respond 步骤不需要 params 参数）

  只返回JSON数组，不要返回其他内容。`

    try {
      console.log('规划执行步骤')
      const response = await this.callLLM(systemPrompt, { 
        temperature: 0.3,
        maxTokens: 3000
      })

      const jsonMatch = response.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        throw new Error('无法解析规划结果')
      }

      const steps = JSON.parse(jsonMatch[0]) as ExecutionStep[]
      const processedSteps = this.processPlannedSteps(steps, skill)
      
      log(`规划完成，共 ${processedSteps.length} 个步骤`)
      processedSteps.forEach((step, i) => {
        const paramsInfo = step.type === 'respond' ? '' : ` ${JSON.stringify(step.params)}`
        log(`步骤 ${i+1}: [${step.type}] ${step.description}${paramsInfo}`)
      })

      console.log('规划步骤详情:', processedSteps)
      return processedSteps

    } catch (error: any) {
      log(`规划步骤失败: ${error.message}`, 'error')
      
      // 重规划失败时的兜底
      if (isReplan) {
        return [
          {
            id: this.getNextStepId(),
            type: 'think',
            description: '基于用户回答分析问题',
            params: { question: userInput },
            status: 'pending',
            showDetails: true,
            streamContent: ''
          },
          {
            id: this.getNextStepId(),
            type: 'respond',
            description: '输出分析结果',
            params: {},
            status: 'pending'
          }
        ]
      }
      
      return [
        {
          id: this.getNextStepId(),
          type: 'think',
          description: '思考如何执行任务',
          params: { question: userInput },
          status: 'pending',
          showDetails: true,
          streamContent: ''
        },
        {
          id: this.getNextStepId(),
          type: 'respond',
          description: '输出思考结果',
          params: {},
          status: 'pending'
        }
      ]
    }
  }

  // 确保 ask_user 后跟 replan
  private ensureAskUserReplanPair(steps: ExecutionStep[]): ExecutionStep[] {
    const result: ExecutionStep[] = []
    
    for (let i = 0; i < steps.length; i++) {
      result.push(steps[i])
      
      if (steps[i].type === 'ask_user') {
        const nextStep = steps[i + 1]
        if (!nextStep || nextStep.type !== 'replan') {
          console.log(`[ensureAskUserReplanPair] 在 ask_user 后自动插入 replan 步骤`)
          result.push({
            id: this.getNextStepId(),
            type: 'replan',
            description: '根据用户回答重新规划',
            params: {},
            status: 'pending'
          })
        }
      }
    }
    
    return result
  }

  // 确保最后一步是 respond
  private ensureLastStepIsRespond(steps: ExecutionStep[]): ExecutionStep[] {
    if (steps.length === 0) {
      steps.push({
        id: this.getNextStepId(),
        type: 'respond',
        description: '输出执行结果',
        params: {},
        status: 'pending'
      })
      return steps
    }

    const lastStep = steps[steps.length - 1]
    if (lastStep.type !== 'respond') {
      console.log(`[ensureLastStepIsRespond] 自动添加 respond 步骤`)
      steps.push({
        id: this.getNextStepId(),
        type: 'respond',
        description: '输出执行结果',
        params: {},
        status: 'pending'
      })
    }
    
    return steps
  }

  // 处理规划好的步骤
  private processPlannedSteps(
    steps: ExecutionStep[],
    skill: Skill | null
  ): ExecutionStep[] {
    console.log(`[processPlannedSteps] 处理 ${steps.length} 个规划步骤`)

    const processedSteps: ExecutionStep[] = steps.map((step) => {
      const params = step.params || {}
      
      // 为文件操作步骤规范化参数
      if (step.type === 'read_file' || step.type === 'write_file') {
        const pathValue = params.path || params.filePath || params.file || params.filename || Object.values(params)[0]
        
        if (!pathValue) {
          throw new Error(`${step.type} 步骤 "${step.description}" 缺少文件路径参数`)
        }
        
        const contentValue = step.type === 'write_file' 
          ? (params.content || params.text || params.data)
          : undefined
        
        step.params = { path: pathValue }
        if (contentValue) {
          step.params.content = contentValue
        }
      }
      
      // 处理技能文件的相对路径
      if (skill && (step.type === 'read_file' || step.type === 'write_file') && params.path) {
        let filePath = params.path
        const isAbsolutePath = filePath.match(/^[A-Za-z]:[\\/]/)
        
        if (!isAbsolutePath) {
          let relativePath = filePath.replace(/^[/\\]+/, '')
          const fullPath = `${this.skillsPath}/${skill.name}/${relativePath}`.replace(/\\/g, '/').replace(/\/+/g, '/')
          params.path = fullPath
          console.log(`[processPlannedSteps] 技能文件路径转换: ${filePath} -> ${fullPath}`)
        }
      }
      
      const processedStep: ExecutionStep = {
        id: this.getNextStepId(),
        type: step.type,
        description: step.description,
        params,
        status: step.status || 'pending',
        showDetails: step.type === 'think' ? true : (step.showDetails || false),
        streamContent: step.type === 'think' ? '' : step.streamContent
      }
      
      // respond 步骤不需要参数
      if (step.type === 'respond') {
        processedStep.params = {}
      }
      
      return processedStep
    })

    // 确保 ask_user → replan 配对
    const pairedSteps = this.ensureAskUserReplanPair(processedSteps)
    
    // 确保最后一步是 respond
    const finalSteps = this.ensureLastStepIsRespond(pairedSteps)

    console.log('[processPlannedSteps] 处理后的步骤:', 
      finalSteps.map(s => ({ id: s.id, type: s.type, description: s.description })))

    return finalSteps
  }

  // 执行步骤序列（支持重规划）
  private async executeStepsWithReplan(
    steps: ExecutionStep[],
    skill: Skill | null,
    context: SkillExecutionContext,
    callbacks?: ExecutionCallbacks,
    log?: (message: string, level?: 'info' | 'warning' | 'error') => void
  ): Promise<{
    success: boolean
    finalResult: string
    steps: ExecutionStep[]
  }> {
    let finalResult = ''
    const executedSteps: ExecutionStep[] = []
    let remainingSteps = [...steps]
    let totalSteps = steps.length
    
    // 从现有步骤初始化ID计数器
    this.initStepIdCounterFromSteps(steps)
    
    log?.(`开始执行 ${steps.length} 个步骤`, 'info')
    console.log('[ExecuteSteps] 初始步骤:', steps.map(s => ({ id: s.id, type: s.type })))

    let currentIndex = 0
    while (currentIndex < remainingSteps.length) {
      const step = remainingSteps[currentIndex]
      step.status = 'running'
      step.startTime = Date.now()
      
      if (step.type === 'think') {
        step.showDetails = true
        step.streamContent = ''
      }
      
      executedSteps.push(step)
      
      const currentProgress = executedSteps.filter(s => s.status !== 'pending').length
      log?.(`执行步骤 ${currentProgress}/${totalSteps}: ${step.description}`, 'info')
      
      callbacks?.onStepStart?.(step)
      callbacks?.onProgress?.(currentProgress, totalSteps, step.description)

      try {
        const stepContext = {
          ...context,
          variables: {
            ...context.variables,
            stepResults: executedSteps.reduce((acc, s, idx) => {
              if (s.id !== step.id) {
                acc[`step_${idx + 1}_result`] = s.result
              }
              return acc
            }, {} as Record<string, any>)
          }
        }

        let stepResult: any
        
        if (step.type === 'replan') {
          // 重规划：生成新计划并完全替换剩余步骤
          log?.(`开始重规划`, 'info')
          const replanResult = await this.executeReplan(
            step, 
            skill,
            stepContext, 
            executedSteps, 
            callbacks, 
            log
          )
          
          // 解析重规划结果
          try {
            const parsedResult = JSON.parse(replanResult)
            if (parsedResult.type === 'replan_complete' && parsedResult.newPlan) {
              // 保存原始计划
              step.originalPlan = [...remainingSteps.slice(currentIndex + 1)]
              step.newPlan = parsedResult.newPlan
              step.result = parsedResult.summary
              step.status = 'success'
              step.endTime = Date.now()
              
              callbacks?.onStepComplete?.(step)
              callbacks?.onReplan?.(step, parsedResult.newPlan)
              
              // 用新计划完全替换剩余步骤（newPlan已经是processPlannedSteps处理过的）
              const completedSteps = remainingSteps.slice(0, currentIndex + 1)
              const newSteps = parsedResult.newPlan
              
              remainingSteps = [...completedSteps, ...newSteps]
              totalSteps = remainingSteps.length
              
              log?.(`重规划完成，剩余步骤已替换为 ${newSteps.length} 个新步骤，总步骤数: ${totalSteps}`, 'info')
              
              const completedCount = executedSteps.filter(s => s.status === 'success' || s.status === 'error').length
              callbacks?.onProgress?.(completedCount, totalSteps, '重规划完成')
              
              currentIndex++
              continue
            }
          } catch (e) {
            console.warn('[executeStepsWithReplan] 重规划结果不是JSON格式:', e)
          }
          
          // 如果重规划返回的是普通结果（兜底处理）
          step.result = replanResult
          step.status = 'success'
          step.endTime = Date.now()
          callbacks?.onStepComplete?.(step)
          currentIndex++
          continue
        } else {
          // 执行普通步骤，传递完整的已执行步骤历史
          stepResult = await this.executeStep(
            step, 
            stepContext, 
            executedSteps.slice(0, -1), 
            executedSteps, 
            callbacks, 
            context.input
          )
          
          step.result = stepResult
          step.status = 'success'
          step.endTime = Date.now()
          
          if (step.type === 'think' && stepResult) {
            step.resultPreview = typeof stepResult === 'string' 
              ? (stepResult.length > 200 ? stepResult.substring(0, 200) + '...' : stepResult)
              : JSON.stringify(stepResult).substring(0, 200) + '...'
          }
          
          callbacks?.onStepComplete?.(step)
          log?.(`步骤 ${currentProgress} 执行成功`, 'info')

          if (step.type === 'respond') {
            finalResult = stepResult
          }
          
          currentIndex++
        }

      } catch (error: any) {
        step.status = 'error'
        step.error = error.message
        step.endTime = Date.now()
        
        callbacks?.onStepError?.(step, error.message)
        log?.(`步骤 ${executedSteps.length} 执行失败: ${error.message}`, 'error')

        return {
          success: false,
          finalResult: `步骤 ${step.description} 失败: ${error.message}`,
          steps: executedSteps
        }
      }
    }

    // 验证步骤ID唯一性（调试用）
    this.validateStepIds(executedSteps)

    if (!finalResult && executedSteps.length > 0) {
      const lastStep = executedSteps[executedSteps.length - 1]
      finalResult = lastStep.result || '技能执行完成'
    }

    log?.('所有步骤执行完成', 'info')

    return {
      success: true,
      finalResult: finalResult || '技能执行完成',
      steps: executedSteps
    }
  }

  // 验证步骤ID唯一性
  private validateStepIds(steps: ExecutionStep[]): void {
    const ids = steps.map(s => s.id)
    const uniqueIds = new Set(ids)
    if (uniqueIds.size !== ids.length) {
      const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)
      console.error('[ValidateStepIds] 发现重复步骤ID:', duplicates)
    }
  }

  // 执行重规划
  private async executeReplan(
    step: ExecutionStep,
    skill: Skill | null,
    context: SkillExecutionContext,
    executedSteps: ExecutionStep[],
    callbacks?: ExecutionCallbacks,
    log?: (message: string, level?: 'info' | 'warning' | 'error') => void
  ): Promise<string> {
    log?.(`开始重规划，已执行 ${executedSteps.length} 个步骤`, 'info')
    
    // 获取用户回答（从上一个非replan、非respond步骤的结果）
    let userAnswer = ''
    for (let i = executedSteps.length - 2; i >= 0; i--) {
      const prevStep = executedSteps[i]
      if (prevStep.type !== 'replan' && prevStep.type !== 'respond' && prevStep.result) {
        userAnswer = typeof prevStep.result === 'string' ? prevStep.result : JSON.stringify(prevStep.result)
        break
      }
    }
    
    if (!userAnswer) {
      userAnswer = '用户没有提供具体回答'
    }

    log?.(`用户回答: ${userAnswer.substring(0, 100)}${userAnswer.length > 100 ? '...' : ''}`, 'info')
    
    if (callbacks?.onStream) {
      callbacks.onStream('📋 正在根据您的回答重新规划后续步骤...', step.id)
    }

    const planningContext: PlanningContext = {
      skill,
      userInput: context.input,
      executedSteps: executedSteps.filter(s => s.type !== 'replan'),
      isReplan: true,
      userAnswer
    }

    try {
      // planSteps 内部已经调用了 processPlannedSteps，返回的步骤已处理完毕
      const newSteps = await this.planSteps(planningContext, log || (() => {}))
      
      if (newSteps && newSteps.length > 0) {
        const planSummary = newSteps.map((s, i) => {
          let paramInfo = ''
          if (s.type === 'ask_user') paramInfo = `: "${s.params.question}"`
          else if (s.type === 'web_search') paramInfo = `: "${s.params.query}"`
          else if (s.type === 'web_fetch') paramInfo = `: ${s.params.url}`
          else if ((s.type === 'read_file' || s.type === 'write_file') && s.params.path) paramInfo = `: ${s.params.path}`
          else if (s.type === 'replan') paramInfo = ': 等待您的回答后继续'
          else if (s.type === 'respond') paramInfo = ': 返回最终结果'
          
          return `${i+1}. [${s.type}] ${s.description}${paramInfo}`
        }).join('\n')
        
        if (callbacks?.onStream) {
          callbacks.onStream(`\n📋 根据您的回答，我规划了以下步骤:\n${planSummary}`, step.id)
        }
        
        log?.(`新计划共 ${newSteps.length} 个步骤`, 'info')
        
        // 返回新计划，让主循环处理执行
        return JSON.stringify({
          type: 'replan_complete',
          summary: `已根据您的回答重新规划，共 ${newSteps.length} 个步骤`,
          newPlan: newSteps  // 已经processPlannedSteps处理过，直接可用
        })
      } else {
        throw new Error('规划结果为空')
      }

    } catch (error: any) {
      log?.(`重规划失败: ${error.message}`, 'error')
      
      // 失败时创建兜底计划
      const defaultSteps: ExecutionStep[] = [
        {
          id: this.getNextStepId(),
          type: 'think',
          description: '分析用户回答',
          params: { question: context.input },
          status: 'pending' as const,
          showDetails: true,
          streamContent: ''
        },
        {
          id: this.getNextStepId(),
          type: 'respond',
          description: '输出分析结果',
          params: {},
          status: 'pending' as const
        }
      ]
      
      if (callbacks?.onStream) {
        callbacks.onStream(`⚠️ 重规划失败，使用默认计划`, step.id)
      }
      
      return JSON.stringify({
        type: 'replan_complete',
        summary: '重规划失败，使用默认计划',
        newPlan: defaultSteps
      })
    }
  }

  // 执行单个步骤
  private async executeStep(
    step: ExecutionStep,
    context: SkillExecutionContext,
    previousSteps: ExecutionStep[],
    allSteps: ExecutionStep[],
    callbacks?: ExecutionCallbacks,
    userInput?: string
  ): Promise<any> {
    const lastResult = previousSteps.length > 0 
      ? previousSteps[previousSteps.length - 1].result 
      : null

    console.log(`[executeStep] 执行步骤: ${step.type}`, {
      stepId: step.id,
      description: step.description,
      hasLastResult: !!lastResult
    })

    switch (step.type) {
      case 'think':
        return await this.executeThink(step, context, allSteps, callbacks)

      case 'web_search':
        return await this.executeWebSearch(step, lastResult, callbacks)

      case 'web_fetch':
        return await this.executeWebFetch(step, lastResult, callbacks)

      case 'read_file':
        // 传递完整的执行历史，用于智能压缩
        return await this.executeReadFile(step, context, callbacks, allSteps, userInput)

      case 'write_file':
        return await this.executeWriteFile(step, allSteps, callbacks)

      case 'run_python':
        return await this.executePython(step, lastResult, callbacks)

      case 'ask_user':
        return await this.executeAskUser(step, context, allSteps, callbacks)

      case 'respond':
        return await this.executeRespond(step, lastResult, callbacks)

      default:
        throw new Error(`未知步骤类型: ${step.type}`)
    }
  }

  // 思考步骤
  private async executeThink(
    step: ExecutionStep,
    context: SkillExecutionContext,
    allSteps: ExecutionStep[],
    callbacks?: ExecutionCallbacks
  ): Promise<string> {
    const historySteps = allSteps
      .filter(s => s.id !== step.id && s.result)
      .map((s, index) => {
        const resultStr = typeof s.result === 'string' ? s.result : JSON.stringify(s.result, null, 2)
        const truncatedResult = resultStr.length > 5000 ? resultStr.substring(0, 5000) + '...' : resultStr
        
        return `步骤${index + 1} (${s.type}): ${s.description}\n${truncatedResult}`
      })
      .join('\n---\n')
    
    const contextSummary = `用户需求: ${context.input}`
    
    const prompt = historySteps 
      ? `${contextSummary}。基于以下执行历史，继续执行${step.description}:\n${historySteps}`
      : `${contextSummary}，请执行以下任务: ${step.description}`
    
    console.log('[executeThink] prompt长度:', prompt.length)
    step.showDetails = true
    step.streamContent = ''
    
    const result = await this.callLLMStream(
      prompt,
      { temperature: 0.7, maxTokens: 8000, stream: true },
      (chunk) => {
        if (callbacks?.onStream) {
          callbacks.onStream(chunk, step.id)
        }
      }
    )
    
    step.result = result
    return result
  }

  // 网页搜索
  private async executeWebSearch(
    step: ExecutionStep,
    lastResult: any,
    callbacks?: ExecutionCallbacks
  ): Promise<string> {
    let query = step.params.query || step.params.keywords
    
    if (typeof query === 'string' && query.includes('{result}') && lastResult) {
      query = query.replace('{result}', lastResult)
    }

    if (!query) {
      throw new Error('搜索关键词不能为空')
    }

    console.log(`[executeWebSearch] 搜索关键词: ${query}`)
    callbacks?.onStream?.(`🔍 正在搜索: "${query}"...`, step.id)

    const searchUrl = `https://s.jina.ai/?q=${encodeURIComponent(query)}`
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer jina_dc3c60cad6c248a2b4274e4ca6cf205biTDzWeLNM2Mz8bBOIKYXlUMfnnwF',
        'X-Respond-With': 'no-content',
      }
    })

    if (!response.ok) {
      throw new Error(`搜索失败: HTTP ${response.status}`)
    }

    const content = await response.text()
    console.log(`[executeWebSearch] 搜索结果长度: ${content.length}`)
    
    const chunkSize = 1000
    callbacks?.onStream?.(`📄 搜索结果:\n`, step.id)
    
    for (let i = 0; i < content.length; i += chunkSize) {
      const chunk = content.substring(i, i + chunkSize)
      callbacks?.onStream?.(chunk, step.id)
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    
    return content
  }

  // 获取网页内容
  private async executeWebFetch(
    step: ExecutionStep,
    lastResult: any,
    callbacks?: ExecutionCallbacks
  ): Promise<string> {
    let url = step.params.url
    
    if (typeof url === 'string' && url.includes('{result}') && lastResult) {
      url = url.replace('{result}', lastResult)
    }

    if (!url) {
      throw new Error('URL不能为空')
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }

    callbacks?.onStream?.(`🌐 正在获取网页: ${url}`, step.id)

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const contentType = response.headers.get('content-type') || ''
      
      let result: string
      
      if (contentType.includes('application/json')) {
        const json = await response.json()
        result = JSON.stringify(json, null, 2)
      } else {
        result = await response.text()
      }

      if (!result || result.trim() === '') {
        throw new Error('获取的内容为空')
      }
      
      const filteredContent = this.filterMainContent(result)

      const CHUNK_SIZE = 2000

      if (filteredContent.length > CHUNK_SIZE) {
        callbacks?.onStream?.(`📄 过滤后的主要内容:\n`, step.id)
        
        for (let i = 0; i < filteredContent.length; i += CHUNK_SIZE) {
          const chunk = filteredContent.substring(i, i + CHUNK_SIZE)
          callbacks?.onStream?.(chunk, step.id)
          await new Promise(resolve => setTimeout(resolve, 5))
        }
      } else {
        callbacks?.onStream?.(`📄 过滤后的主要内容:\n${filteredContent}`, step.id)
      }

      return filteredContent.trim()

    } catch (error: any) {
      console.error('[executeWebFetch] 错误:', {
        url: url,
        error: error.message
      })
      callbacks?.onStream?.(`❌ 获取失败: ${error.message}`, step.id)
      throw new Error(`获取网页失败: ${error.message}`)
    }
  }

  // 过滤网页主要内容
  private filterMainContent(html: string): string {
    if (!html) return ''
    
    let content = html
    
    const links: Array<{text: string, url: string}> = []
    
    const aTagRegex = /<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["']([^>]*)>([\s\S]*?)<\/a>/gi
    content = content.replace(aTagRegex, (match, url, attrs, linkText) => {
      const cleanText = linkText.replace(/<[^>]*>/g, '').trim()
      if (cleanText && url && !url.startsWith('#') && !url.startsWith('javascript:')) {
        links.push({
          text: cleanText,
          url: url.startsWith('http') ? url : new URL(url, 'https://example.com').pathname
        })
      }
      return cleanText
    })
    
    const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
    let mdMatch
    while ((mdMatch = mdLinkRegex.exec(html)) !== null) {
      const [, text, url] = mdMatch
      if (text && url && !url.startsWith('#') && !url.startsWith('javascript:')) {
        links.push({
          text: text.trim(),
          url: url.startsWith('http') ? url : new URL(url, 'https://example.com').pathname
        })
      }
    }
    
    content = content.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    content = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    content = content.replace(/<[^>]*>/g, ' ')
    
    content = content.replace(/&nbsp;/g, ' ')
    content = content.replace(/&lt;/g, '<')
    content = content.replace(/&gt;/g, '>')
    content = content.replace(/&amp;/g, '&')
    content = content.replace(/&quot;/g, '"')
    content = content.replace(/&#39;/g, "'")
    content = content.replace(/&[a-z]+;/g, ' ')
    
    content = content.replace(/\s+/g, ' ')
    
    const sentences = content.split(/([。！？.!?])/g)
    const meaningfulSentences: string[] = []
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim()
      if (sentence.length > 10) {
        meaningfulSentences.push(sentence)
      }
    }
    
    content = meaningfulSentences.join(' ')
    content = content.replace(/\s+/g, ' ').trim()
    
    const MAX_CONTENT_LENGTH = 5000
    if (content.length > MAX_CONTENT_LENGTH) {
      const truncated = content.substring(0, MAX_CONTENT_LENGTH)
      const lastPeriod = Math.max(
        truncated.lastIndexOf('。'),
        truncated.lastIndexOf('.'),
        truncated.lastIndexOf('！'),
        truncated.lastIndexOf('?')
      )
      
      if (lastPeriod > MAX_CONTENT_LENGTH * 0.8) {
        content = truncated.substring(0, lastPeriod + 1)
      } else {
        content = truncated + '...'
      }
    }
    
    if (links.length > 0) {
      content += '\n\n---\n**页面中的链接:**\n'
      
      const uniqueLinks = new Map()
      links.forEach(link => {
        if (!uniqueLinks.has(link.url) || uniqueLinks.get(link.url).text.length < link.text.length) {
          uniqueLinks.set(link.url, link)
        }
      })
      
      Array.from(uniqueLinks.values())
        .slice(0, 50)
        .forEach((link, index) => {
          content += `${index + 1}. [${link.text}](${link.url})\n`
        })
      
      if (uniqueLinks.size > 50) {
        content += `... 还有 ${uniqueLinks.size - 50} 个链接未显示\n`
      }
    }
    
    return content
  }

  /**
   * 读取文件并自动压缩
   * 关键改进：传递完整的执行历史，用于智能压缩
   */
  private async executeReadFile(
    step: ExecutionStep,
    context: SkillExecutionContext,
    callbacks?: ExecutionCallbacks,
    allSteps?: ExecutionStep[],
    userInput?: string
  ): Promise<string> {
    let filePath = step.params.path || step.params.filePath
    
    // 处理以 / 开头的路径
    if (filePath && filePath.startsWith('/') && !filePath.match(/^\/[A-Za-z]:/)) {
      const relativePath = filePath.substring(1)
      console.log(`[executeReadFile] 路径格式调整: ${filePath} -> ${relativePath}`)
      filePath = relativePath
      step.params.path = relativePath
    }
    
    if (context.files && context.files[filePath]) {
      console.log(`[executeReadFile] 从上下文读取文件: ${filePath}`)
      callbacks?.onStream?.(`📁 从上下文读取文件: ${filePath}`, step.id)
      const content = context.files[filePath]
      return await this.compressFileContent(step, content, filePath, context, callbacks, allSteps, userInput)
    }

    if (!filePath) {
      throw new Error('文件路径不能为空')
    }

    console.log(`[executeReadFile] 从磁盘读取文件: ${filePath}`)
    callbacks?.onStream?.(`📁 正在读取文件: ${filePath}`, step.id)

    try {
      const content = await window.ipcRenderer.invoke('readFile', filePath)
      console.log(`[executeReadFile] 文件读取成功，长度: ${content.length}`)
      
      const fileSizeKB = (content.length / 1024).toFixed(1)
      callbacks?.onStream?.(`📄 文件大小: ${fileSizeKB} KB (${content.length} 字符)`, step.id)
      
      // 传递完整的执行历史用于智能压缩
      return await this.compressFileContent(step, content, filePath, context, callbacks, allSteps, userInput)
      
    } catch (error: any) {
      console.error(`[executeReadFile] 读取文件失败: ${filePath}`, error)
      callbacks?.onStream?.(`❌ 读取文件失败: ${error.message}`, step.id)
      throw new Error(`读取文件失败: ${error.message}`)
    }
  }

  /**
   * 压缩文件内容（流式输出）
   * 关键改进：结合执行历史（包括用户回答）进行智能压缩
   */
  private async compressFileContent(
    step: ExecutionStep,
    content: string,
    filePath: string,
    context: SkillExecutionContext,
    callbacks?: ExecutionCallbacks,
    allSteps?: ExecutionStep[],
    userInput?: string
  ): Promise<string> {
    const originalLength = content.length
    
    // 检查是否需要压缩
    if (!this.compressionConfig.enabled || originalLength <= this.compressionConfig.threshold) {
      console.log(`[compressFileContent] 内容长度 ${originalLength}，未超过阈值 ${this.compressionConfig.threshold}，不压缩`)
      
      const preview = content.length > 200 ? content.substring(0, 200) + '...' : content
      callbacks?.onStream?.(`📄 文件内容预览:\n${preview}`, step.id)
      
      step.originalLength = originalLength
      step.compressedLength = originalLength
      
      return content
    }
    
    // 需要压缩
    console.log(`[compressFileContent] 内容长度 ${originalLength}，超过阈值，开始压缩...`)
    
    callbacks?.onStream?.(
      `\n📊 文件较大 (${originalLength} 字符)，正在进行智能压缩...\n`,
      step.id
    )
    
    let targetLength = this.compressionConfig.maxLength
    if (originalLength < 5000) {
      targetLength = Math.min(500, this.compressionConfig.maxLength)
    } else if (originalLength < 20000) {
      targetLength = Math.min(800, this.compressionConfig.maxLength)
    }
    
    // 构建完整的用户上下文（包括执行历史中的用户回答）
    const fullUserContext = this.buildFullUserContext(userInput, allSteps)
    
    const compressPrompt = this.buildCompressPrompt(content, fullUserContext, originalLength, targetLength)
    
    try {
      let compressedContent = ''
      
      callbacks?.onStream?.(`\n📝 压缩结果:\n`, step.id)
      
      compressedContent = await this.callLLMStream(
        compressPrompt,
        { temperature: 0.3, maxTokens: targetLength + 500, stream: true },
        (chunk) => {
          if (callbacks?.onStream) {
            callbacks.onStream(chunk, step.id)
          }
        }
      )
      
      compressedContent = this.cleanCompressedContent(compressedContent, targetLength)
      
      const compressedLength = compressedContent.length
      const compressionRatio = ((1 - compressedLength / originalLength) * 100).toFixed(1)
      
      console.log(`[compressFileContent] 压缩完成: ${originalLength} → ${compressedLength} 字符 (压缩率 ${compressionRatio}%)`)
      
      const summary = `\n\n✅ 压缩完成: ${originalLength} → ${compressedLength} 字符 (节省 ${compressionRatio}%)\n\n`
      if (callbacks?.onStream) {
        for (let i = 0; i < summary.length; i += 50) {
          callbacks.onStream(summary.substring(i, i + 50), step.id)
          await new Promise(resolve => setTimeout(resolve, 5))
        }
      }
      
      step.originalLength = originalLength
      step.compressedLength = compressedLength
      step.resultPreview = `原始: ${originalLength} 字符 → 压缩后: ${compressedLength} 字符 (压缩率 ${compressionRatio}%)`
      
      if (this.compressionConfig.cacheOriginal) {
        if (!context.variables) {
          context.variables = {}
        }
        const cacheKey = `_original_file_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}`
        context.variables[cacheKey] = content
        console.log(`[compressFileContent] 原始内容已缓存到变量: ${cacheKey}`)
      }
      
      return compressedContent
      
    } catch (error: any) {
      console.error('[compressFileContent] 压缩失败:', error)
      
      callbacks?.onStream?.(`\n⚠️ 压缩失败: ${error.message}，使用截断内容\n`, step.id)
      
      const truncated = content.substring(0, this.compressionConfig.maxLength) + 
        `\n\n... (内容过长已截断，原始长度 ${originalLength} 字符，压缩失败)`
      
      step.originalLength = originalLength
      step.compressedLength = truncated.length
      step.resultPreview = `压缩失败，已截断: ${originalLength} → ${truncated.length} 字符`
      
      return truncated
    }
  }

  /**
   * 构建完整的用户上下文（包括原始输入和对话历史中的用户回答）
   */
  private buildFullUserContext(userInput?: string, allSteps?: ExecutionStep[]): string {
    const contextParts: string[] = []
    
    // 添加原始用户需求
    if (userInput) {
      contextParts.push(`原始用户需求: ${userInput}`)
    }
    
    // 从执行历史中提取用户回答
    if (allSteps && allSteps.length > 0) {
      const userAnswers: string[] = []
      
      for (let i = 0; i < allSteps.length; i++) {
        const step = allSteps[i]
        // 寻找 ask_user 步骤
        if (step.type === 'ask_user' && step.result) {
          const question = step.params.question || step.description
          const answer = typeof step.result === 'string' ? step.result : JSON.stringify(step.result)
          userAnswers.push(`用户问题: "${question}" → 用户回答: "${answer}"`)
        }
      }
      
      // 也查找已执行但尚未加入allSteps的ask_user步骤
      // 通过查找上一个ask_user步骤的结果
      if (userAnswers.length === 0) {
        const lastAskUserStep = [...allSteps].reverse().find(s => s.type === 'ask_user' && s.result)
        if (lastAskUserStep) {
          const question = lastAskUserStep.params.question || lastAskUserStep.description
          const answer = typeof lastAskUserStep.result === 'string' ? lastAskUserStep.result : JSON.stringify(lastAskUserStep.result)
          userAnswers.push(`用户被问及: "${question}" → 用户回答: "${answer}"`)
        }
      }
      
      if (userAnswers.length > 0) {
        contextParts.push(`对话历史中的用户回答:\n${userAnswers.join('\n')}`)
      }
      
      // 添加最近的think步骤结果（可能包含分析上下文）
      const recentThinkSteps = allSteps
        .filter(s => s.type === 'think' && s.result)
        .slice(-2)  // 最近2个think步骤
      
      if (recentThinkSteps.length > 0) {
        const thinkSummaries = recentThinkSteps.map(s => {
          const result = typeof s.result === 'string' ? s.result.substring(0, 500) : ''
          return `分析结果: ${result}${result.length >= 500 ? '...' : ''}`
        })
        contextParts.push(`最近的分析结果:\n${thinkSummaries.join('\n')}`)
      }
    }
    
    return contextParts.length > 0 ? contextParts.join('\n\n') : (userInput || '')
  }

  /**
   * 构建压缩提示词
   * 关键改进：结合用户上下文进行智能压缩
   */
  private buildCompressPrompt(
    content: string,
    userContext: string,
    originalLength: number,
    targetLength: number
  ): string {
    const MAX_PROMPT_CONTENT = 15000
    let contentForPrompt = content
    
    if (content.length > MAX_PROMPT_CONTENT) {
      const headSize = Math.floor(MAX_PROMPT_CONTENT * 0.7)
      const tailSize = MAX_PROMPT_CONTENT - headSize
      const head = content.substring(0, headSize)
      const tail = content.substring(content.length - tailSize)
      contentForPrompt = `${head}\n\n... (中间部分省略，原始长度 ${originalLength} 字符) ...\n\n${tail}`
    }
    
    return `你是一个专业的内容压缩专家。请根据用户的完整上下文，对以下文件内容进行智能压缩。

## 用户完整上下文
${userContext || '请全面总结文件的核心内容'}

## 压缩要求
1. **目标长度**: 控制在 ${targetLength} 字符以内
2. **上下文相关压缩**: 
   - 重点关注与用户需求、用户回答相关的内容
   - 如果用户提到了具体问题，优先保留与其相关的信息
   - 如果用户问题比较笼统，需要保留全面的信息
3. **信息保留**: 
   - 保留关键数据、数字、日期
   - 保留重要人名、地名、机构名
   - 保留核心观点和结论
   - 保留必要的上下文信息
4. **结构清晰**: 使用分点、分段组织，便于阅读
5. **语言精炼**: 去除冗余表达、重复内容、无关细节
6. **准确性**: 保持原意，不添加不存在的信息

## 原始文件内容
${contentForPrompt}

## 输出格式
直接输出压缩后的内容，不要添加额外说明。使用以下结构：
- 如有多个要点，使用数字列表
- 重要数据用 **粗体** 标注
- 保持段落清晰

压缩内容:`
  }

  /**
   * 清理压缩后的内容
   */
  private cleanCompressedContent(content: string, targetLength: number): string {
    let cleaned = content
      .replace(/^压缩内容:?\s*/i, '')
      .replace(/^以下是压缩后的内容:?\s*/i, '')
      .replace(/^总结:?\s*/i, '')
      .trim()
    
    if (cleaned.length > targetLength + 200) {
      const truncated = cleaned.substring(0, targetLength)
      const lastPeriod = Math.max(
        truncated.lastIndexOf('。'),
        truncated.lastIndexOf('\n'),
        truncated.lastIndexOf('.')
      )
      
      if (lastPeriod > targetLength * 0.7) {
        cleaned = truncated.substring(0, lastPeriod + 1)
      } else {
        cleaned = truncated + '...'
      }
    }
    
    return cleaned
  }

  // 写入文件
  private async executeWriteFile(
    step: ExecutionStep,
    allSteps: ExecutionStep[],
    callbacks?: ExecutionCallbacks
  ): Promise<string> {
    const filePath = step.params.path || step.params.filePath
    let content = step.params.content || step.params.text

    if (!filePath) {
      throw new Error('文件路径不能为空')
    }

    if (!content && allSteps.length > 1) {
      const lastStep = allSteps[allSteps.length - 2]
      if (lastStep && lastStep.result) {
        content = typeof lastStep.result === 'string' 
          ? lastStep.result 
          : JSON.stringify(lastStep.result, null, 2)
        console.log(`[executeWriteFile] 从上一步结果获取内容，长度: ${content.length}`)
        callbacks?.onStream?.(`📝 从上一步结果获取内容`, step.id)
      }
    }

    if (!content) {
      const thinkSteps = allSteps.filter(s => s.type === 'think' && s.result)
      
      if (thinkSteps.length > 0) {
        let summary = '# 思考过程汇总\n\n'
        summary += `生成时间: ${new Date().toLocaleString()}\n\n`
        
        thinkSteps.forEach((step, index) => {
          summary += `## 第 ${index + 1} 步思考\n\n`
          summary += `**描述**: ${step.description}\n\n`
          
          if (step.streamContent) {
            summary += `**推理过程**:\n\`\`\`\n${step.streamContent}\n\`\`\`\n\n`
          }
          
          if (step.result) {
            summary += `**结果**:\n\`\`\`\n${step.result}\n\`\`\`\n\n`
          }
          
          summary += '---\n\n'
        })
        
        content = summary
        console.log(`[executeWriteFile] 汇总思考步骤结果，长度: ${content.length}`)
        callbacks?.onStream?.(`📝 汇总思考步骤结果`, step.id)
      } else {
        const allResults = allSteps
          .filter(s => s.type !== 'write_file' && s.result)
          .map(s => {
            let stepContent = `## ${s.type} 步骤\n\n`
            stepContent += `**描述**: ${s.description}\n\n`
            
            if (s.streamContent) {
              stepContent += `**推理过程**:\n\`\`\`\n${s.streamContent}\n\`\`\`\n\n`
            }
            
            stepContent += `**结果**:\n\`\`\`\n${s.result}\n\`\`\`\n\n`
            
            return stepContent
          })
          .join('\n---\n\n')
        
        content = allResults || '无执行结果'
        console.log(`[executeWriteFile] 汇总所有步骤结果，长度: ${content.length}`)
        callbacks?.onStream?.(`📝 汇总所有步骤结果`, step.id)
      }
    } else if (typeof content === 'string') {
      const thinkSteps = allSteps.filter(s => s.type === 'think' && s.result)
      thinkSteps.forEach((step, index) => {
        const placeholder = `{{think_${index + 1}}}`
        if (content.includes(placeholder) && step.result) {
          content = content.replace(placeholder, step.result)
        }
      })
      
      if (content.includes('{{all_think}}')) {
        const allThink = thinkSteps.map(s => s.result).join('\n\n')
        content = content.replace('{{all_think}}', allThink)
      }
      
      if (content.includes('{{stream_content}}')) {
        const streamContent = thinkSteps
          .filter(s => s.streamContent)
          .map(s => s.streamContent)
          .join('\n\n')
        content = content.replace('{{stream_content}}', streamContent)
      }
      
      if (content.includes('{{result}}') && allSteps.length > 1) {
        const lastResult = allSteps[allSteps.length - 2]?.result
        if (lastResult) {
          content = content.replace('{{result}}', lastResult)
        }
      }
    }

    if (!content) {
      content = '无内容可写入'
      console.warn('[executeWriteFile] 没有内容可写入，使用默认内容')
    }

    try {
      console.log(`[executeWriteFile] 尝试写入文件: ${filePath}`)
      console.log(`[executeWriteFile] 内容长度: ${content.length}`)
      console.log(`[executeWriteFile] 内容预览: ${content.substring(0, 200)}...`)
      callbacks?.onStream?.(`💾 正在写入文件: ${filePath}`, step.id)
      
      const result = await window.ipcRenderer.invoke('writeFile', filePath, content)
      
      if (result.success) {
        console.log(`[executeWriteFile] 文件写入成功: ${filePath}`)
        
        let returnMessage = `文件已写入: ${filePath}`
        
        if (content.length > 0) {
          const summary = content.length > 500 
            ? content.substring(0, 500) + '...' 
            : content
          returnMessage += `\n\n文件内容摘要:\n\`\`\`\n${summary}\n\`\`\``
        }
        
        callbacks?.onStream?.(`✅ success: ${filePath}`, step.id)
        return returnMessage
      } else {
        throw new Error(result.error || '写入文件失败')
      }
    } catch (error: any) {
      console.error(`[executeWriteFile] 写入文件失败: ${filePath}`, error)
      callbacks?.onStream?.(`❌ fail: ${error.message}`, step.id)
      throw new Error(`写入文件失败: ${error.message}`)
    }
  }

  // 执行Python代码
  private async executePython(
    step: ExecutionStep,
    lastResult: any,
    callbacks?: ExecutionCallbacks
  ): Promise<string> {
    let code = step.params.code

    if (!code || code === '将从step_2获取的代码' || code === '将从上一步获取的代码') {
      if (lastResult && typeof lastResult === 'string') {
        console.log('[executePython] 尝试从上一步结果中提取代码')
        
        const pythonCodeBlockRegex = /```python\n([\s\S]*?)```/
        const match = lastResult.match(pythonCodeBlockRegex)
        
        if (match && match[1]) {
          code = match[1].trim()
          console.log(`[executePython] 从python代码块提取代码，长度: ${code.length}`)
          callbacks?.onStream?.(`📦 从推理结果中提取Python代码`, step.id)
        } else {
          const codeBlockRegex = /```\n([\s\S]*?)```/
          const codeMatch = lastResult.match(codeBlockRegex)
          
          if (codeMatch && codeMatch[1]) {
            code = codeMatch[1].trim()
            console.log(`[executePython] 从代码块提取代码，长度: ${code.length}`)
            callbacks?.onStream?.(`📦 从推理结果中提取代码`, step.id)
          } else {
            const codeIndicators = ['import ', 'def ', 'class ', 'if __name__', 'print(', 'for ', 'while ']
            const looksLikeCode = codeIndicators.some(indicator => lastResult.includes(indicator))
            
            if (looksLikeCode) {
              code = lastResult
              console.log(`[executePython] 结果看起来像代码，直接使用，长度: ${code.length}`)
              callbacks?.onStream?.(`📦 使用推理结果作为代码`, step.id)
            } else {
              const lines = lastResult.split('\n')
              let codeLines: string[] = []
              let inCode = false
              
              for (const line of lines) {
                if (/^(import|from|def|class|if|for|while|print)\s/.test(line.trim())) {
                  inCode = true
                  codeLines.push(line)
                } else if (inCode) {
                  if (line.trim() === '' || /^\s/.test(line) || /[)\]}]$/.test(line)) {
                    codeLines.push(line)
                  } else {
                    inCode = false
                  }
                }
              }
              
              if (codeLines.length > 0) {
                code = codeLines.join('\n')
                console.log(`[executePython] 从文本中提取代码片段，长度: ${code.length}`)
                callbacks?.onStream?.(`📦 从文本中提取代码片段`, step.id)
              } else {
                throw new Error('无法从上一步结果中提取Python代码，请确保生成的代码放在```python代码块中')
              }
            }
          }
        }
      } else {
        throw new Error('没有提供Python代码，且上一步结果无效')
      }
    }

    if (typeof code === 'string' && code.includes('{result}') && lastResult) {
      code = code.replace('{result}', JSON.stringify(lastResult))
    }

    if (!code) {
      throw new Error('Python代码不能为空')
    }
    callbacks?.onStream?.(`🐍 正在执行Python代码...`, step.id)

    if (code.includes('os.makedirs') || code.includes('mkdir')) {
      const match = code.match(/['"]([^'"]+)['"]/)
      if (match) {
        const dirPath = match[1]
        try {
          const result = await window.ipcRenderer.invoke('ensureDir', dirPath)
          if (result.success) {
            callbacks?.onStream?.(`✅ 目录创建成功: ${dirPath}`, step.id)
            return `目录已创建: ${dirPath}`
          } else {
            throw new Error(result.error)
          }
        } catch (error: any) {
          callbacks?.onStream?.(`❌ 创建目录失败: ${error.message}`, step.id)
          throw new Error(`创建目录失败: ${error.message}`)
        }
      }
    }

    const environment = this.store.TrustedPython ? 'trusted' : 'safe'

    try {
      const result = await window.ipcRenderer.invoke('executePython', {
        code: code,
        environment: environment,
        input: lastResult
      })

      if (result.success) {
        let parsedResult = result.output?.trim() || result.result || '执行成功'
        callbacks?.onStream?.(`✅ Python执行成功\n\n执行结果:\n${parsedResult}`, step.id)
        return parsedResult
      } else {
        callbacks?.onStream?.(`❌ Python执行失败: ${result.error}`, step.id)
        throw new Error(result.error || result.output || '执行失败')
      }
    } catch (error: any) {
      callbacks?.onStream?.(`❌ Python执行异常: ${error.message}`, step.id)
      throw new Error(`Python执行失败: ${error.message}`)
    }
  }

  // 询问用户
  private async executeAskUser(
    step: ExecutionStep,
    context: SkillExecutionContext,
    allSteps: ExecutionStep[],
    callbacks?: ExecutionCallbacks
  ): Promise<string> {
    let question = step.params.question || step.params.prompt
    
    const recentThinkSteps = allSteps
      .filter(s => 
        s.type === 'think' && 
        s.result && 
        s.status === 'success' &&
        s.id !== step.id
      )
      .sort((a, b) => (b.endTime || 0) - (a.endTime || 0))
    
    if (recentThinkSteps.length > 0) {
      const latestThink = recentThinkSteps[0]
      const thinkResult = latestThink.result
      
      if (thinkResult && typeof thinkResult === 'string' && thinkResult.trim().length > 0) {
        const optimizedQuestion = await this.optimizeQuestionWithThinkResult(
          question, 
          thinkResult,
          latestThink.description
        )
        
        if (optimizedQuestion && optimizedQuestion !== question) {
          console.log(`[executeAskUser] 问题已优化:`, {
            original: question,
            optimized: optimizedQuestion
          })
          question = optimizedQuestion
          step.params.question = question
        }
      }
    }
    
    if (typeof question === 'string') {
      if (question.includes('{{latest_think}}') && recentThinkSteps.length > 0) {
        question = question.replace('{{latest_think}}', recentThinkSteps[0].result || '')
      }
      
      if (question.includes('{{all_think}}')) {
        const allThinkResults = allSteps
          .filter(s => s.type === 'think' && s.result)
          .map(s => s.result)
          .join('\n\n')
        question = question.replace('{{all_think}}', allThinkResults)
      }
      
      if (question.includes('{{result}}') && allSteps.length > 1) {
        const lastResult = allSteps[allSteps.length - 2]?.result
        if (lastResult) {
          question = question.replace('{{result}}', lastResult)
        }
      }
    }

    if (!question) {
      throw new Error('问题不能为空')
    }

    console.log(`[executeAskUser] 最终问题: ${question}`)
    callbacks?.onStream?.(`❓ ${question}`, step.id)
    
    return new Promise((resolve, reject) => {
      const askId = `ask_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      if (context.callbacks && context.callbacks.onUserQuestion) {
        console.log(`[executeAskUser] 触发用户问题回调，askId: ${askId}`)
        context.callbacks.onUserQuestion(askId, question, (answer: string) => {
          console.log(`[executeAskUser] 收到用户回答: ${answer}`)
          callbacks?.onStream?.(`📝 用户回答: ${answer}`, step.id)
          
          const userAnswer = answer || '用户没有提供具体回答'
          resolve(userAnswer)
        }, (error) => {
          console.error(`[executeAskUser] 用户回答出错:`, error)
          reject(error)
        })
      } else {
        console.warn('[executeAskUser] 没有找到用户问题回调，使用模拟响应')
        setTimeout(() => {
          const mockAnswer = '用户响应模拟'
          callbacks?.onStream?.(`📝 用户回答: ${mockAnswer}`, step.id)
          resolve(mockAnswer)
        }, 100)
      }
    })
  }

  // 优化问题
  private async optimizeQuestionWithThinkResult(
    originalQuestion: string,
    thinkResult: string,
    thinkDescription: string
  ): Promise<string> {
    if (!thinkResult || thinkResult.length < 10) {
      return originalQuestion
    }
    
    try {
      const optimizePrompt = `你是一个问题优化专家。请根据思考结果，优化原始问题，使其更加精准、具体。

原始问题: "${originalQuestion}"

思考过程描述: "${thinkDescription}"

思考结果:
"""
${thinkResult.substring(0, 1000)}${thinkResult.length > 1000 ? '...' : ''}
"""

任务:
1. 基于关键信息，优化原始问题，使其更加具体、精准

要求:
- 保持问题的友好性、可理解性和简洁性
- 问题应该引导用户提供最有价值的信息
- 返回优化后的问题文本，不要添加任何解释

优化后的问题:`

      const optimizedQuestion = await Promise.race([
        this.callLLM(optimizePrompt, { 
          temperature: 0.3,
          maxTokens: 500
        }),
        new Promise<string>((resolve) => {
          setTimeout(() => resolve(originalQuestion), 2000)
        })
      ])
      
      if (optimizedQuestion && 
          typeof optimizedQuestion === 'string' && 
          optimizedQuestion.trim().length > 0) {
        return optimizedQuestion.trim()
      }
    } catch (error) {
      console.warn('[optimizeQuestionWithThinkResult] 问题优化失败，使用原问题:', error)
    }
    
    return originalQuestion
  }

  // 响应结果
  private async executeRespond(
    step: ExecutionStep,
    lastResult: any,
    callbacks?: ExecutionCallbacks
  ): Promise<string> {
    console.log(`[executeRespond] 执行 respond 步骤`)
    console.log(`[executeRespond] 上一步结果:`, lastResult)
    
    if (lastResult) {
      console.log(`[executeRespond] 返回上一步结果，长度: ${typeof lastResult === 'string' ? lastResult.length : JSON.stringify(lastResult).length}`)
      
      if (typeof lastResult === 'string' && lastResult.length > 0) {
        const chunkSize = 50
        for (let i = 0; i < lastResult.length; i += chunkSize) {
          const chunk = lastResult.substring(i, i + chunkSize)
          callbacks?.onStream?.(chunk, step.id)
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      } else {
        const resultStr = JSON.stringify(lastResult, null, 2)
        callbacks?.onStream?.(resultStr, step.id)
      }
      
      return lastResult
    }
    
    console.warn('[executeRespond] respond 步骤没有上一步结果')
    const fallbackMessage = '没有可返回的结果'
    callbacks?.onStream?.(fallbackMessage, step.id)
    return fallbackMessage
  }

  // LLM调用方法
  private async callLLM(
    prompt: string,
    options?: {
      temperature?: number
      maxTokens?: number
      model?: string
      modelType?: string
    }
  ): Promise<string> {
    const messages = [{ role: 'user', content: prompt }]
    
    console.log(`[callLLM] 调用LLM，prompt长度: ${prompt.length}`)
    
    return await new Promise((resolve, reject) => {
      if (!this.store.sendToAI) {
        reject(new Error('store.sendToAI 不存在'))
        return
      }

      this.store.sendToAI(
        messages,
        {
          temperature: options?.temperature || 0.3,
          max_tokens: options?.maxTokens || 1000,
          stream: false,
          onComplete: (content: string) => {            
            if (content.includes('data: ') && content.includes('[DONE]')) {
              const extractedContent = this.extractContentFromSSE(content)
              resolve(extractedContent)
            } else {
              resolve(content)
            }
          },
          onError: (error: Error) => {
            console.error('[callLLM] LLM调用失败:', error)
            reject(error)
          }
        }
      ).catch(reject)
    })
  }

  // 流式LLM调用
  private async callLLMStream(
    prompt: string,
    options?: {
      temperature?: number
      maxTokens?: number
      model?: string
      modelType?: string
      stream?: boolean
    },
    onStream?: (chunk: string) => void
  ): Promise<string> {
    const messages = [{ role: 'user', content: prompt }]
    
    return await new Promise((resolve, reject) => {
      if (!this.store.sendToAI) {
        reject(new Error('store.sendToAI 不存在'))
        return
      }

      let fullContent = ''

      this.store.sendToAI(
        messages,
        {
          temperature: options?.temperature || 0.3,
          max_tokens: options?.maxTokens || 4000,
          stream: options?.stream !== false,
          onStream: (chunk: string) => {
            fullContent += chunk
            if (onStream) {
              onStream(chunk)
            }
          },
          onComplete: (content: string) => {
            resolve(content || fullContent)
          },
          onError: (error: Error) => {
            reject(error)
          }
        }
      ).catch(reject)
    })
  }

  // 从SSE数据提取内容
  private extractContentFromSSE(sseData: string): string {
    if (!sseData.includes('data: ')) return sseData
    
    let result = ''
    const lines = sseData.split('\n')
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.substring(6).trim()
        
        if (data === '[DONE]') continue
        
        try {
          const parsed = JSON.parse(data)
          if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta) {
            const content = parsed.choices[0].delta.content
            if (content) {
              result += content
            }
          }
        } catch (e) {
          result += data
        }
      }
    }
    
    return result || sseData
  }

  // 获取技能帮助
  async getSkillHelp(skillName: string): Promise<string> {
    const skill = this.skills.get(skillName)
    if (!skill) {
      return `技能 "${skillName}" 不存在`
    }

    let help = `# ${skill.name}\n\n`
    help += `**描述**: ${skill.description}\n\n`
    help += `**技能文件夹路径**: ${this.skillsPath}\n\n`

    if (skill.metadata.version) {
      help += `**版本**: ${skill.metadata.version}\n`
    }
    if (skill.metadata.author) {
      help += `**作者**: ${skill.metadata.author}\n`
    }
    if (skill.metadata.tags && skill.metadata.tags.length > 0) {
      help += `**标签**: ${skill.metadata.tags.join(', ')}\n`
    }

    help += '\n## 使用方法\n\n'
    help += `直接输入你的需求，系统会自动匹配并使用此技能。\n\n`

    if (skill.metadata.requires?.models) {
      help += `**需要的模型**: ${skill.metadata.requires.models.join(', ')}\n`
    }

    if (skill.files && skill.files.length > 0) {
      help += '\n## 技能文件夹包含的文件\n\n'
      
      const fileList = skill.files.map(file => {
        if (typeof file === 'string') {
          return `- ${file}`
        } else if (file && typeof file === 'object') {
          const fileName = (file as any).name || (file as any).path || JSON.stringify(file)
          return `- ${fileName}`
        }
        return `- ${String(file)}`
      }).join('\n')
      
      help += fileList + '\n'
    }

    if (skill.content) {
      help += '\n## 技能说明\n\n'
      help += skill.content.substring(0, 500)
      if (skill.content.length > 500) {
        help += '...\n'
      }
    }

    return help
  }
}

// 创建单例
let skillManagerInstance: SkillManager | null = null

export function getSkillManager(store: any): SkillManager {
  if (!skillManagerInstance) {
    skillManagerInstance = new SkillManager(store)
  }
  return skillManagerInstance
}

export default {
  getSkillManager
}