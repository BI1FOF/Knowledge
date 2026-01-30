<!-- home.vue -->
<template>
  <div class="ai-chat-container">
    <!-- 聊天列表侧边栏 -->
    <div class="chat-sidebar" v-show="showSidebar">
      <div class="chat-list scoll">
        <div 
          v-for="(chat, index) in chats" 
          :key="chat.id"
          class="chat-item"
          :class="{ 
            active: currentChatIndex === index,
            generating: chat.isGenerating
          }"
          @click="switchChat(index)"
        >
          <div class="chat-item-header">
            <span class="chat-title">{{ chat.title || `聊天 ${index + 1}` }}</span>
            <div v-if="chat.isGenerating" class="generating-indicator">
              <div class="generating-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
            <div class="chat-actions" @click.stop="deleteChat(index)" title="删除聊天">
              <i class="fa fa-trash"></i>
            </div>
          </div>
          <div class="chat-info">
            <span class="model-name">{{ getModelDisplayName(chat.config) }}</span>
            <span class="message-count">{{ chat.messages.length }} 条消息</span>
          </div>
        </div>
        <div class="chat-item" @click="createNewChat" title="新建聊天">
          <div style="width:100%;text-align: center;">
            <i class="fa fa-plus"></i>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 主聊天区域 -->
    <div class="chat-main" :class="{ 'sidebar-hidden': !showSidebar }">
      <!-- 聊天头部 -->
      <div class="chat-header">
        <div class="header-left">
          <input 
            v-model="currentChat.title" 
            placeholder="输入聊天标题..."
            class="chat-title-input"
            @change="saveChats"
          />
          <select 
            v-model="currentChat.config.llmType" 
            @change="onModelTypeChange"
            class="model-select"
            title="模型类型"
          >
            <option v-for="type in store.AIconfig.llm.types" :value="type">
              {{ type.charAt(0).toUpperCase() + type.slice(1) }}
            </option>
          </select>
          
          <select 
            v-model="currentChat.config.model" 
            class="model-select"
            :disabled="!availableModels.length"
            title="选择模型"
          >
            <option value="">select model</option>
            <option v-for="model in availableModels" :value="model">
              {{  model }}
            </option>
          </select>
          
          <div class="button" @click="refreshModels" title="刷新模型列表">
            <i class="fa fa-refresh"></i>
          </div>
          <select v-model="currentChat.config.functionIndex" class="model-select">
            <option v-for="(func, index) in store.AIconfig.functions" :value="index">
                {{ func.title }}
            </option>
          </select>
          
          <div 
            class="button" 
            @click="selectKnowledgeBase" 
            :class="{ active: currentChat.config.kbPath }" 
            :title="getKbButtonTitle()"
          >
            <i class="fa fa-book"></i>
          </div>

          <div 
            class="button"
            style="text-align: center;"
            @click="selectWorkflow"
            :class="{ 
              active: currentChat.config.workflowPath,
              'workflow-running': isWorkflowRunning,
              'workflow-error': workflowError
            }" 
            :title="getWorkflowButtonTitle()"
          >
            <i class="fa fa-stumbleupon"></i>
          </div>

          <div class="button" @click="clearCurrentChat" title="清空当前聊天">
            <i class="fa fa-trash"></i>
          </div>
          <div class="button" @click="exportChat" title="导出聊天为Markdown">
            <i class="fa fa-download"></i>
          </div>
        </div>
        
        <div class="header-right" @click="testCurrentModelConnection" title="test">
          <div class="status-indicator" :class="{ online: currentModelOnline, offline: !currentModelOnline }"></div>
        </div>
      </div>
      
      <!-- 消息区域 -->
      <div 
        class="message-container scoll" 
        id="messageContainer" 
        ref="messageContainer"
        @wheel="handleWheel"
        @scroll="handleScroll"
      >
        <!-- 常规聊天消息 -->
        <div 
          v-for="(message, index) in currentChat.messages" 
          :key="index" 
          class="message-item"
          :class="{
            'user-message': message.role === 'user',
            'assistant-message': message.role === 'assistant',
            'system-message': message.role === 'system',
            'workflow-message': message.workflowResult,
            'workflow-running': message.isWorkflowRunning
          }"
        >
          <div class="message-header">
            <span class="message-role">
              {{ getRoleDisplay(message.role) }}
              <!-- 在助理消息旁边添加打字动画 -->
              <div v-if="message.role === 'assistant' && index === currentChat.messages.length - 1 && !message.content" class="typing-dots-inline">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <!-- 如果是工作流生成的消息，添加标识 -->
              <span v-if="message.workflowResult" class="workflow-badge">
                <i class="fa fa-users"></i> workflow
              </span>
            </span>
            <span class="message-time">
              {{ formatTime(message.timestamp) }}
            </span>
            <div class="message-actions">
              <div class="action-button" @click.stop="store.tts(message.content)" title="朗读">
                <i class="fa fa-volume-up"></i>
              </div>
              <div class="action-button" @click.stop="copyMessage(message.content)" title="复制">
                <i class="fa fa-copy"></i>
              </div>
              <div class="action-button" @click.stop="deleteMessage(index)" title="删除">
                <i class="fa fa-times"></i>
              </div>
            </div>
          </div>
          
          <!-- 工作流执行状态（显示在工作流执行中的消息里） -->
          <div v-if="message.isWorkflowRunning" class="workflow-execution-status">
            <div class="workflow-progress">
              <div class="progress-bar">
                <div 
                  class="progress-fill" 
                  :style="{ width: workflowStatus?.progress || 0 + '%' }"
                ></div>
              </div>
              <div class="progress-info">
                <span class="progress-text">
                  <i class="fa fa-users"></i>
                  {{ store.locales=='zh' ? '工作流执行中: ' : 'Working: ' }}{{ workflowStatus?.completedNodes || 0 }}/{{ workflowStatus?.totalNodes || 0 }}
                </span>
                <span class="progress-time">{{ workflowStatus?.executionTime || 0 }}ms</span>
              </div>
            </div>
            
            <!-- 工作流节点执行详情 -->
            <div v-if="workflowNodeStatus.length > 0" class="workflow-node-status scoll">
              <div 
                v-for="(node, nodeIndex) in workflowNodeStatus" 
                :key="node.id || nodeIndex"
                class="workflow-node-item"
                :class="{
                  'node-success': node.status === 'success',
                  'node-error': node.status === 'error',
                  'node-running': node.status === 'running'
                }"
              >
                <div class="node-header">
                  <i class="fa" :class="getNodeStatusIcon(node.status)"></i>
                  <span class="node-name">{{ node.name }}</span>
                  <span class="node-type">{{ node.type }}</span>
                  <span class="node-index">{{ nodeIndex + 1 }}</span>
                  <div v-if="node.timestamp" class="node-timestamp">
                    <i class="fa fa-clock-o"></i>
                    {{ formatNodeTime(node.timestamp) }}
                  </div>
                  <div v-if="node.message" class="node-message">
                    <i class="fa fa-info-circle"></i>
                    {{ node.message }}
                  </div>
                </div>
                
                <!-- 节点详情区域 -->
                <div class="node-details">
                  <!-- 推理节点的流式内容 -->
                  <div v-if="node.streamContent && node.type === 'reasoning'" class="node-stream-content">
                    <div class="stream-header">
                      <i class="fa fa-stream"></i>
                    </div>
                    <div class="stream-content scoll">
                      {{ node.streamContent }}
                    </div>
                  </div>
                  
                  <!-- 结果预览 -->
                  <div v-if="node.resultPreview" class="node-result-preview">
                    <div class="result-header">
                      <i class="fa fa-file-alt"></i>
                    </div>
                    <div class="result-content scoll">
                      {{ node.resultPreview }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 工作流执行错误 -->
            <div v-if="workflowErrors.length > 0" class="workflow-errors">
              <div class="error-header">
                <i class="fa fa-exclamation-triangle"></i>
                工作流执行错误
              </div>
              <div class="error-list">
                <div v-for="(error, errorIndex) in workflowErrors" :key="errorIndex" class="error-item">
                  <div class="error-node">{{ error.nodeName }} ({{ error.nodeType }})</div>
                  <div class="error-message">{{ error.error }}</div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 消息内容 -->
          <div class="message-content" v-html="renderMarkdown(message.content)"></div>
          
          <!-- 工作流执行统计（如果消息来自工作流且已完成） -->
          <div v-if="message.workflowStats && !message.isWorkflowRunning" class="workflow-stats">
            <div class="stats-header">
              <i class="fa fa-chart-bar"></i>
              工作流执行统计
            </div>
            <div class="stats-grid">
              <div class="stat-item">
                <span class="stat-label">总节点数:</span>
                <span class="stat-value">{{ message.workflowStats.totalNodes }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">成功:</span>
                <span class="stat-value">{{ message.workflowStats.completedNodes }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">失败:</span>
                <span class="stat-value">{{ message.workflowStats.failedNodes }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">耗时:</span>
                <span class="stat-value">{{ message.workflowStats.executionTime }}ms</span>
              </div>
            </div>
            <div v-if="message.workflowStats.errors && message.workflowStats.errors.length > 0" class="workflow-error-summary">
              <i class="fa fa-exclamation-circle"></i>
              有 {{ message.workflowStats.errors.length }} 个节点执行失败
            </div>
          </div>
          
          <!-- 添加召回标签显示区域 -->
          <div v-if="message.kbInfo?.relevantBlocks?.length" class="kb-tags-container">
            <div class="kb-tags-header" @click="toggleKbDetails(message)">
              <i class="fa" :class="showKbDetails[message.timestamp] ? 'fa-chevron-down' : 'fa-chevron-right'"></i>
              <span>召回文件标签 ({{ message.kbInfo.relevantBlocks.length }}个)</span>
            </div>
            
            <div class="kb-tags" v-show="showKbDetails[message.timestamp]">
              <div 
                v-for="tag in getMergedKbTags(message.kbInfo.relevantBlocks)" 
                :key="tag.label"
                class="kb-tag"
                :title="getKbTagTooltip(tag)"
                :style="{ '--similarity-color': getSimilarityColor(tag.similarity) }"
              >
                <span class="tag-label">{{ tag.label }}</span>
                <span class="tag-similarity">{{ (tag.similarity * 100).toFixed(1) }}%</span>
              </div>
            </div>
            
            <!-- 详细列表 -->
            <div v-if="showKbDetails[message.timestamp]" class="kb-details">
              <div v-for="(block, blockIndex) in message.kbInfo.relevantBlocks" :key="blockIndex" class="kb-detail-item">
                <div class="kb-detail-header">
                  <span class="detail-label">{{ block.label }}</span>
                  <span class="detail-similarity">{{ (block.similarity * 100).toFixed(1) }}%</span>
                </div>
                <div v-if="block.content" class="kb-detail-content scoll">
                  {{ block.content }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 输入区域 -->
      <div class="input-area">
        <!-- 步骤指示器和统计信息 -->
        <div v-if="currentChat.isGenerating || connectionTestStatus || (workflowStatus && workflowStatus.isRunning)" class="step-info-container">
          <!-- 聊天生成状态 -->
          <div v-if="currentChat.isGenerating && !isWorkflowRunning" class="step-indicator" :class="stepIndicatorClass">
            <i :class="stepIcon"></i> {{ currentStep }}
          </div>
          
          <!-- 连接测试状态 -->
          <div v-if="connectionTestStatus" class="step-indicator" :class="connectionTestClass">
            <i :class="connectionTestIcon"></i> {{ connectionTestStatus }}
          </div>
          
          <!-- 工作流执行状态 -->
          <div v-if="isWorkflowRunning" class="step-indicator step-workflow">
            <i class="fa fa-spinner fa-spin"></i>
            工作流执行中: {{ workflowStatus?.currentNode || '初始化...' }}
          </div>
          
          <!-- 右侧：检索统计信息 -->
          <div v-if="retrievalStats && !isWorkflowRunning" class="retrieval-stats">
            <div class="stat-item" title="总知识片段数量">
              <i class="fa fa-cubes"></i>
              <span>{{ retrievalStats.totalBlocks }}</span>
            </div>
            <div class="stat-item" title="返回的片段数量">
              <i class="fa fa-check-circle"></i>
              <span>{{ retrievalStats.returnedBlocks }}</span>
            </div>
            <div class="stat-item" title="最大相似度">
              <i class="fa fa-chart-line"></i>
              <span>{{ retrievalStats.maxSimilarity }}</span>
            </div>
            <div v-if="retrievalStats.averageSimilarity" class="stat-item" title="平均相似度">
              <i class="fa fa-chart-bar"></i>
              <span>{{ retrievalStats.averageSimilarity }}</span>
            </div>
          </div>
        </div>
        
        <div class="input-container">
          <textarea
            v-model="inputText"
            :placeholder="getInputPlaceholder()"
            @keydown.enter.exact.prevent="sendMessage"
            @keydown.enter.shift.exact.prevent="inputText += '\n'"
            ref="textInput"
            class="message-input scoll"
            :disabled="currentChat.isGenerating || isWorkflowRunning"
            style="width:calc(100% - 20px)"
            rows="3"
          ></textarea>
          
          <div class="input-controls">
            
            <div v-if="showSidebar" class="button" @click="toggleSidebar" title="隐藏侧边栏">
              <i class="fa fa-chevron-left"></i>
            </div>
            <div v-if="!showSidebar" class="button" @click="toggleSidebar">
              <i class="fa fa-chevron-right"></i>
            </div>
            <div 
              class="button" 
              style="flex:1" 
              @click="sendMessage" 
              :disabled="currentChat.isGenerating || !inputText.trim() || !currentChat.config.model || isWorkflowRunning" 
              :title="getSendButtonTitle()"
            >
              <i :class="getSendButtonIcon()"></i>
            </div>
            <div 
              class="button" 
              @click="stopCurrentGeneration" 
              v-if="currentChat.isGenerating || isWorkflowRunning" 
              title="停止生成"
            >
              <i class="fa fa-stop"></i>
            </div>
            <div class="button" @click="toggleTTS" :class="{ active: ttsEnabled }" title="语音朗读">
              <i class="fa fa-volume-up"></i>
            </div>
            <div class="parameter" title="temperature">
              <label>{{ currentChat.config.temperature }}</label>
              <input 
                type="range" 
                v-model="currentChat.config.temperature" 
                min="0" 
                max="2" 
                step="0.1"
                class="param-slider"
                :disabled="isWorkflowRunning"
              >
            </div>
            <div class="parameter" title="maxTokens">
              <label>{{ currentChat.config.maxTokens }}</label>
              <input 
                type="range" 
                v-model.number="currentChat.config.maxTokens" 
                min="2000" 
                max="10000" 
                step="100"
                class="param-slider"
                @input="currentChat.config.maxTokens = Math.floor(currentChat.config.maxTokens)"
                :disabled="isWorkflowRunning"
              >
            </div>
            <div v-if="currentChat.config.kbPath" class="parameter" title="知识库片段数量">
              <label>{{ currentChat.config.kbTopK || 5 }}</label>
              <input 
                type="range" 
                v-model.number="currentChat.config.kbTopK" 
                min="3" 
                max="20" 
                step="1"
                class="param-slider"
                :disabled="isWorkflowRunning"
              >
            </div>
            <label class="checkbox-label">
              <input type="checkbox" v-model="currentChat.config.stream" :disabled="isWorkflowRunning"> 流式
            </label>
            <label class="checkbox-label">
              <input type="checkbox" v-model="currentChat.config.think" :disabled="currentChat.config.llmType !== 'ollama' || isWorkflowRunning"> 思考
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { usestore } from '../store'
import { retrieveKnowledge } from '../utils/kbRetrieval'
import { WorkflowRunner, type WorkflowData, type ExecutionCallback, type NodeType } from '../utils/workflowRunner'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

const store = usestore()

// TypeScript 类型定义
interface RelevantBlock {
  label: string
  content: string
  similarity: number
  summaryScore?: number
  sliceScore?: number
  reverseScore?: number
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  model?: string
  kbInfo?: {
    kbPath: string
    relevantBlocks?: RelevantBlock[]
    debugInfo?: any
  }
  workflowResult?: boolean
  isWorkflowRunning?: boolean
  workflowStats?: {
    totalNodes: number
    completedNodes: number
    failedNodes: number
    executionTime: number
    errors?: Array<{nodeId: number, nodeName: string, error: string}>
  }
}

interface ChatConfig {
  llmType: string
  model: string
  temperature: number
  maxTokens: number
  stream: boolean
  think: boolean
  functionIndex: number
  kbPath?: string
  kbTopK?: number
  workflowPath?: string
  workflowData?: WorkflowData
}

interface Chat {
  id: string
  title: string
  messages: ChatMessage[]
  config: ChatConfig
  createdAt: number
  online?: boolean
  isGenerating?: boolean
}

interface RetrievalStats {
  totalBlocks: number
  returnedBlocks: number
  maxSimilarity: string
  averageSimilarity?: string
}

// 工作流相关接口
interface WorkflowStatus {
  isRunning: boolean
  progress: number
  currentStep: number
  totalSteps: number
  executionTime: number
  completedNodes: number
  totalNodes: number
  currentNode?: string
}

interface WorkflowNodeStatus {
  id: number
  name: string
  type: NodeType
  status: 'idle' | 'running' | 'success' | 'error'
  message?: string
  streamContent?: string
  resultPreview?: string
  timestamp?: number
  progress?: number
}

interface WorkflowError {
  nodeId: number
  nodeName: string
  nodeType: string
  error: string
}

interface DecisionPath {
  nodeId: number
  nodeName: string
  branchId: string
  branchName: string
  reason?: string
}

// 响应式数据
const chats = ref<Chat[]>([createNewChatData()])
const currentChatIndex = ref(0)
const inputText = ref<string>('')
const showSidebar = ref(true)
const ttsEnabled = ref(false)
const abortController = ref<AbortController | null>(null)
const autoScrollEnabled = ref(true)
const isUserScrolling = ref(false)
const scrollTimeout = ref<NodeJS.Timeout | null>(null)
const messageContainer = ref<HTMLElement | null>(null)
const showKbDetails = ref<Record<number, boolean>>({})

// 状态变量
const retrievalStats = ref<RetrievalStats | null>(null)
const currentStep = ref('')
const stepIcon = ref('fa fa-circle-o-notch fa-spin')
const stepIndicatorClass = ref('')

// 连接测试状态
const connectionTestStatus = ref('')
const connectionTestIcon = ref('')
const connectionTestClass = ref('')
const connectionTestTimeout = ref<NodeJS.Timeout | null>(null)

// 工作流相关状态
const workflowStatus = ref<WorkflowStatus | null>(null)
const workflowNodeStatus = ref<WorkflowNodeStatus[]>([])
const workflowErrors = ref<WorkflowError[]>([])
const decisionPaths = ref<DecisionPath[]>([])
const workflowError = ref(false)
const workflowRunner = ref<WorkflowRunner | null>(null)
const workflowStartTime = ref<number>(0)

// 计算属性
const currentChat = computed(() => chats.value[currentChatIndex.value])
const currentModelOnline = computed(() => currentChat.value.online || false)
const isWorkflowRunning = computed(() => workflowStatus.value?.isRunning || false)

const availableModels = computed(() => {
  const llmType = currentChat.value.config.llmType
  const config = store.AIconfig.llm
  
  switch(llmType) {
    case 'ollama':
      return config.ollama.available_models || []
    case 'openai':
    case 'deepseek':
      return config.openai.available_models || []
    case 'anthropic':
      return [config.anthropic.model]
    case 'google':
      return [config.google.model]
    case 'azure':
      return config.azure.deployment ? [config.azure.deployment] : []
    case 'custom':
      return config.custom.model ? [config.custom.model] : []
    default:
      return []
  }
})

// 初始化 MarkdownIt 实例
const md: MarkdownIt = new MarkdownIt({
  html: true,
  linkify: true,
  highlight: function (str: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return '<pre class="hljs"><code>' +
          hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
          '</code></pre>'
      } catch (__) {}
    }
    return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>'
  },
})

// 工具函数：合并重复标签
const mergeDuplicateLabels = (blocks: RelevantBlock[]): Array<{label: string, contents: string[], similarity: number}> => {
  const mergedMap = new Map<string, {contents: string[], maxSimilarity: number}>()
  
  blocks.forEach(block => {
    if (!mergedMap.has(block.label)) {
      mergedMap.set(block.label, {
        contents: block.content ? [block.content] : [],
        maxSimilarity: block.similarity
      })
    } else {
      const existing = mergedMap.get(block.label)!
      if (block.content && block.content.trim()) {
        // 避免重复的 content
        if (!existing.contents.includes(block.content)) {
          existing.contents.push(block.content)
        }
      }
      // 保留最高的相似度
      if (block.similarity > existing.maxSimilarity) {
        existing.maxSimilarity = block.similarity
      }
    }
  })
  
  return Array.from(mergedMap.entries()).map(([label, data]) => ({
    label,
    contents: data.contents,
    similarity: data.maxSimilarity
  }))
}

// 获取知识库按钮标题
const getKbButtonTitle = (): string => {
  const kbPath = currentChat.value.config.kbPath
  if (!kbPath) {
    return '关联知识库'
  }
  
  const fileName = kbPath.split(/[\\/]/).pop() || kbPath
  return `已关联: ${fileName}`
}

// 获取工作流按钮标题
const getWorkflowButtonTitle = (): string => {
  const workflowPath = currentChat.value.config.workflowPath
  if (!workflowPath) {
    return '选择工作流'
  }
  
  const fileName = workflowPath.split(/[\\/]/).pop() || workflowPath
  let title = `工作流: ${fileName}`
  
  if (isWorkflowRunning.value) {
    title += ' (运行中)'
  } else if (workflowError.value) {
    title += ' (有错误)'
  }
  
  return title
}

// 获取输入框占位符
const getInputPlaceholder = (): string => {
  if (currentChat.value.config.workflowPath) {
    return store.locales == 'zh' 
      ? '输入工作流起始文本... (Enter发送，Shift+Enter换行)'
      : 'Enter workflow start text... (Enter to send, Shift+Enter for new line)';
  }
  return store.locales == 'zh'
    ? '输入消息... (Enter发送，Shift+Enter换行)'
    : 'Enter message... (Enter to send, Shift+Enter for new line)';
}

// 获取发送按钮标题
const getSendButtonTitle = (): string => {
  if (isWorkflowRunning.value) {
    return 'Working...'
  }
  if (currentChat.value.config.workflowPath) {
    return 'Run (Enter)'
  }
  return 'Send (Enter)'
}

// 获取发送按钮图标
const getSendButtonIcon = (): string => {
  if (currentChat.value.config.workflowPath) {
    return 'fa fa-play'
  }
  return 'fa fa-paper-plane'
}

// 获取节点状态图标
const getNodeStatusIcon = (status: string): string => {
  const icons: Record<string, string> = {
    'idle': 'fa fa-clock',
    'running': 'fa fa-spinner fa-spin',
    'success': 'fa fa-check-circle',
    'error': 'fa fa-exclamation-circle'
  }
  return icons[status] || 'fa fa-question-circle'
}

// 格式化节点时间
const formatNodeTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  })
}

// Markdown 渲染函数
const renderMarkdown = (str: string): string => {
  return md.render(str)
}

// 获取合并后的知识库标签
const getMergedKbTags = (blocks: RelevantBlock[]) => {
  return mergeDuplicateLabels(blocks)
}

// 获取知识库标签的工具提示
const getKbTagTooltip = (tag: {label: string, contents: string[], similarity: number}): string => {
  let tooltip = `标签: ${tag.label}\n相似度: ${(tag.similarity * 100).toFixed(1)}%\n\n`
  
  if (tag.contents && tag.contents.length > 0) {
    tooltip += '相关内容:\n'
    tag.contents.forEach((content, index) => {
      if (content && content.trim()) {
        const truncated = content.length > 100 ? content.substring(0, 100) + '...' : content
        tooltip += `${index + 1}. ${truncated}\n`
      }
    })
  } else {
    tooltip += '无详细内容'
  }
  
  return tooltip
}

// 根据相似度获取颜色
const getSimilarityColor = (similarity: number): string => {
  // 根据相似度返回颜色，从红色到绿色渐变
  const hue = Math.round(similarity * 120) // 0-120，红到绿
  return `hsl(${hue}, 70%, 50%)`
}

// 切换知识库详情显示
const toggleKbDetails = (message: ChatMessage) => {
  showKbDetails.value[message.timestamp] = !showKbDetails.value[message.timestamp]
}

// 处理鼠标滚轮事件
const handleWheel = (event: WheelEvent) => {
  if (!messageContainer.value) return
  
  const container = messageContainer.value
  const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 10
  
  if (event.deltaY < 0 && !isAtBottom) {
    autoScrollEnabled.value = false
    isUserScrolling.value = true
    
    if (scrollTimeout.value) {
      clearTimeout(scrollTimeout.value)
    }
    scrollTimeout.value = setTimeout(() => {
      autoScrollEnabled.value = true
      isUserScrolling.value = false
    }, 30000)
  }
  
  if (isAtBottom) {
    autoScrollEnabled.value = true
    isUserScrolling.value = false
    if (scrollTimeout.value) {
      clearTimeout(scrollTimeout.value)
      scrollTimeout.value = null
    }
  }
}

// 处理滚动事件
const handleScroll = () => {
  if (!messageContainer.value) return
  
  const container = messageContainer.value
  const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 10
  
  if (isAtBottom) {
    autoScrollEnabled.value = true
    isUserScrolling.value = false
    if (scrollTimeout.value) {
      clearTimeout(scrollTimeout.value)
      scrollTimeout.value = null
    }
  }
}

// 自动滚动到底部
const scrollToBottom = () => {
  if (!messageContainer.value || !autoScrollEnabled.value) return
  
  nextTick(() => {
    const container = messageContainer.value
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      })
    }
  })
}

// 设置连接测试状态
const setConnectionTestStatus = (status: string, isSuccess: boolean) => {
  // 清除之前的定时器
  if (connectionTestTimeout.value) {
    clearTimeout(connectionTestTimeout.value)
    connectionTestTimeout.value = null
  }
  
  connectionTestStatus.value = status
  if (isSuccess) {
    connectionTestIcon.value = 'fa fa-check-circle'
    connectionTestClass.value = 'step-success'
  } else {
    connectionTestIcon.value = 'fa fa-times-circle'
    connectionTestClass.value = 'step-error'
  }
  
  // 5秒后自动清除状态
  connectionTestTimeout.value = setTimeout(() => {
    connectionTestStatus.value = ''
    connectionTestTimeout.value = null
  }, 5000)
}

// 初始化
onMounted(() => {
  loadChatsFromStorage()
  checkCurrentModelConnection()
  
  // 监听当前聊天的消息变化，自动滚动
  watch(() => currentChat.value.messages.length, () => {
    if (currentChat.value.isGenerating || isWorkflowRunning.value) {
      scrollToBottom()
    }
  }, { immediate: true })
  
  // 监听当前聊天的生成状态
  watch(() => currentChat.value.isGenerating, (newVal) => {
    if (newVal) {
      autoScrollEnabled.value = true
      scrollToBottom()
    } else {
      // 当生成完成时，清理状态
      currentStep.value = ''
      retrievalStats.value = null
    }
  })
  
  // 监听模型配置变化
  watch(() => currentChat.value.config, (newConfig) => {
    currentChat.value.online = false
    saveChats()
  }, { deep: true })
  
  // 监听工作流状态变化
  watch(() => workflowStatus.value, (newStatus) => {
    if (newStatus?.isRunning) {
      autoScrollEnabled.value = true
      scrollToBottom()
    }
  }, { deep: true })
})

onBeforeUnmount(() => {
  store.saveConfig()
  if (scrollTimeout.value) {
    clearTimeout(scrollTimeout.value)
  }
  if (connectionTestTimeout.value) {
    clearTimeout(connectionTestTimeout.value)
  }
  // 停止工作流执行
  stopWorkflow()
})

// 选择知识库文件
const selectKnowledgeBase = async () => {
  try {
    const filePath = await window.ipcRenderer.invoke('selectFile')
    if(filePath==null) currentChat.value.config.kbPath=undefined
    if (filePath && filePath.endsWith('.kb')) {
      currentChat.value.config.kbPath = filePath
      if (currentChat.value.config.kbTopK === undefined) {
        currentChat.value.config.kbTopK = 5
      }
      saveChats()
      console.log(`已关联知识库: ${filePath}`)
    } else if (filePath && !filePath.endsWith('.kb')) {
      alert('请选择.kb格式的知识库文件')
    }
  } catch (error) {
    console.error('选择知识库文件失败:', error)
  }
}

// 选择工作流文件
const selectWorkflow = async () => {
  try {
    const filePath = await window.ipcRenderer.invoke('selectFile', {
      filters: [
        { name: '工作流文件', extensions: ['flow', 'json'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    
    if (filePath == null) {
      currentChat.value.config.workflowPath = undefined
      currentChat.value.config.workflowData = undefined
      workflowError.value = false
      saveChats()
      return
    }
    console.log(filePath)
    if (filePath && (filePath.endsWith('.flow') || filePath.endsWith('.json'))) {
      // 读取工作流文件
      const content = await window.ipcRenderer.invoke('readFile', filePath)
      console.log(content)
      const workflowData = JSON.parse(content)
      console.log(workflowData)
      // 验证工作流数据
      if (!workflowData.items || !Array.isArray(workflowData.items)) {
        throw new Error('无效的工作流文件格式')
      }
      
      // 检查是否有开始和结束节点
      const startNode = workflowData.items.find((item: any) => item.type === 'start')
      const endNode = workflowData.items.find((item: any) => item.type === 'end')
      
      if (!startNode) {
        throw new Error('工作流缺少开始节点')
      }
      
      if (!endNode) {
        throw new Error('工作流缺少结束节点')
      }
      
      // 保存工作流数据
      currentChat.value.config.workflowPath = filePath
      currentChat.value.config.workflowData = workflowData
      workflowError.value = false
      
      // 初始化工作流运行器
      initWorkflowRunner()
      
      // 将开始节点的文本设置为输入框默认值
      if (startNode.prompt && startNode.prompt.trim()) {
        inputText.value = startNode.prompt
      } else {
        inputText.value = ''
      }
      
      saveChats()
      console.log(`已加载工作流: ${filePath}`)
      
      // 检查工作流是否可执行
      try {
        const isValid = await validateWorkflow()
        if (!isValid) {
          alert('工作流验证失败，请检查配置')
          workflowError.value = true
        }
      } catch (error: any) {
        alert(`工作流验证错误: ${error.message}`)
        workflowError.value = true
      }
      
    } else if (filePath && !filePath.endsWith('.flow') && !filePath.endsWith('.json')) {
      alert('请选择.flow或.json格式的工作流文件')
    }
  } catch (error: any) {
    console.error('选择工作流文件失败:', error)
    alert(`加载工作流失败: ${error.message}`)
    currentChat.value.config.workflowPath = undefined
    currentChat.value.config.workflowData = undefined
    workflowError.value = true
    saveChats()
  }
}

// 初始化工作流运行器
const initWorkflowRunner = () => {
  if (!currentChat.value.config.workflowData) {
    workflowRunner.value = null
    return
  }
  
  const callbacks: ExecutionCallback = {
    onNodeStart: (nodeId, nodeName, nodeType) => {
      console.log(`工作流节点开始: ${nodeName} (${nodeType})`)
      
      // 添加或更新节点状态
      const existingIndex = workflowNodeStatus.value.findIndex(n => n.id === nodeId)
      if (existingIndex !== -1) {
        // 更新现有节点
        workflowNodeStatus.value[existingIndex] = {
          id: nodeId,
          name: nodeName,
          type: nodeType,
          status: 'running',
          message: '执行中...',
          timestamp: Date.now()
        }
      } else {
        // 添加新节点
        workflowNodeStatus.value.push({
          id: nodeId,
          name: nodeName,
          type: nodeType,
          status: 'running',
          message: '执行中...',
          timestamp: Date.now()
        })
      }
      
      // 更新当前执行节点
      if (workflowStatus.value) {
        workflowStatus.value.currentNode = nodeName
      }
      
      scrollToBottom()
    },
    
    onNodeComplete: (nodeId, nodeName, nodeType, status, result) => {
      console.log(`工作流节点完成: ${nodeName} - ${status}`, result)
      
      // 更新节点状态
      const nodeIndex = workflowNodeStatus.value.findIndex(n => n.id === nodeId)
      if (nodeIndex !== -1) {
        const node = workflowNodeStatus.value[nodeIndex]
        node.status = status
        node.message = status === 'success' ? (store.locales=='zh' ? '执行成功' : 'Execution successful') : (store.locales=='zh' ? '执行失败' : 'Execution failed')
        
        // 提取结果预览
        if (result) {
          try {
            const parsedResult = JSON.parse(result)
            if (parsedResult.result) {
              // 截取前200个字符作为预览
              node.resultPreview = typeof parsedResult.result === 'string' 
                ? parsedResult.result.substring(0, 200) + (parsedResult.result.length > 200 ? '...' : '')
                : JSON.stringify(parsedResult.result).substring(0, 200) + '...'
            }
          } catch {
            // 如果不是JSON，直接使用字符串
            node.resultPreview = typeof result === 'string' 
              ? result.substring(0, 200) + (result.length > 200 ? '...' : '')
              : String(result).substring(0, 200) + '...'
          }
        }
        
        node.timestamp = Date.now()
      }
      
      // 更新工作流状态
      if (workflowStatus.value) {
        workflowStatus.value.completedNodes++
        workflowStatus.value.progress = (workflowStatus.value.completedNodes / workflowStatus.value.totalNodes) * 100
        workflowStatus.value.executionTime = Date.now() - workflowStartTime.value
      }
      
      scrollToBottom()
    },
    
    // 新增：节点状态更新回调（用于流式内容）
    onNodeStatusUpdate: (nodeId, status, result) => {
      if (result) {
        try {
          const parsedResult = JSON.parse(result)
          if (parsedResult.streaming && parsedResult.result) {
            // 更新推理节点的流式内容
            const nodeIndex = workflowNodeStatus.value.findIndex(n => n.id === nodeId)
            if (nodeIndex !== -1) {
              const node = workflowNodeStatus.value[nodeIndex]
              if (node.type === 'reasoning') {
                node.streamContent = parsedResult.result
                node.message = (store.locales=='zh' ? '流式生成中...' : 'Streaming generation...')
              }
            }
          }
        } catch {
          // 忽略解析错误
        }
      }
      
      // 触发界面更新
      nextTick(() => {
        // 确保界面响应式更新
      })
    },
    
    onPythonError: (nodeId, nodeName, error, traceback) => {
      console.error(`工作流Python节点错误: ${nodeName} - ${error}`)
      
      // 添加到错误列表
      workflowErrors.value.push({
        nodeId,
        nodeName,
        nodeType: 'python',
        error: error
      })
    },
    
    onDecisionBranchSelected: (nodeId, nodeName, branchId, branchName, reason) => {
      console.log(`决策节点分支选择: ${nodeName} -> ${branchName} (${branchId})`)
      
      // 记录决策路径
      decisionPaths.value.push({
        nodeId,
        nodeName,
        branchId,
        branchName,
        reason
      })
      
      // 更新对应节点的状态
      const nodeIndex = workflowNodeStatus.value.findIndex(n => n.id === nodeId)
      if (nodeIndex !== -1) {
        const node = workflowNodeStatus.value[nodeIndex]
        node.message = `选择分支: ${branchName}`
        if (reason) {
          node.resultPreview = `${reason}`
        }
      }
      
      scrollToBottom()
    },
    
    onProgress: (completed, total, currentNode) => {
      console.log(`工作流进度: ${completed}/${total}`)
      
      // 更新进度
      if (workflowStatus.value) {
        workflowStatus.value.completedNodes = completed
        workflowStatus.value.totalNodes = total
        workflowStatus.value.progress = (completed / total) * 100
        
        // 更新节点进度
        if (currentNode) {
          workflowStatus.value.currentNode = currentNode
        }
      }
      
      // 更新每个节点的进度
      workflowNodeStatus.value.forEach(node => {
        if (node.status === 'running') {
          node.progress = Math.min(100, (completed / total) * 100)
        }
      })
    },
    
    onComplete: (success, finalResult, aggregatedResults) => {
      console.log(`工作流执行${success ? '成功' : '失败'}`)
      
      // 完成工作流执行
      if (workflowStatus.value) {
        workflowStatus.value.isRunning = false
        workflowStatus.value.executionTime = Date.now() - workflowStartTime.value
      }
      
      // 查找并更新正在运行的工作流消息
      const messages = currentChat.value.messages
      const workflowMessageIndex = messages.findIndex(msg => msg.isWorkflowRunning)
      
      if (workflowMessageIndex !== -1) {
        // 更新现有的工作流消息
        const workflowMessage = messages[workflowMessageIndex]
        workflowMessage.isWorkflowRunning = false
        workflowMessage.content = success ? finalResult : `工作流执行失败: ${finalResult}`
        workflowMessage.workflowResult = true
        
        if (success && aggregatedResults && aggregatedResults.executionStats) {
          workflowMessage.workflowStats = {
            totalNodes: aggregatedResults.executionStats.totalNodes,
            completedNodes: aggregatedResults.executionStats.completedNodes,
            failedNodes: aggregatedResults.executionStats.failedNodes,
            executionTime: aggregatedResults.executionStats.executionTime,
            errors: aggregatedResults.executionStats.errors
          }
        }
        
        if (success && ttsEnabled.value) {
          store.tts(finalResult)
        }
      } else {
        // 如果没有找到正在运行的消息，添加新的结果消息
        const resultMessage: ChatMessage = {
          role: 'assistant',
          content: success ? finalResult : `工作流执行失败: ${finalResult}`,
          timestamp: Date.now(),
          workflowResult: true,
          workflowStats: success && aggregatedResults && aggregatedResults.executionStats ? {
            totalNodes: aggregatedResults.executionStats.totalNodes,
            completedNodes: aggregatedResults.executionStats.completedNodes,
            failedNodes: aggregatedResults.executionStats.failedNodes,
            executionTime: aggregatedResults.executionStats.executionTime,
            errors: aggregatedResults.executionStats.errors
          } : undefined
        }
        
        currentChat.value.messages.push(resultMessage)
        
        if (success && ttsEnabled.value) {
          store.tts(finalResult)
        }
      }
      
      if (!success) {
        workflowError.value = true
      }
      
      saveChats()
      
      // 5秒后清除工作流状态
      setTimeout(() => {
        resetWorkflowStatus()
      }, 5000)
      
      scrollToBottom()
    },
    
    onLog: (message, level) => {
      console.log(`[工作流 ${level}] ${message}`)
    }
  }
  
  workflowRunner.value = new WorkflowRunner(
    currentChat.value.config.workflowData,
    store,
    callbacks
  )
}

// 验证工作流
const validateWorkflow = async (): Promise<boolean> => {
  if (!workflowRunner.value || !currentChat.value.config.workflowData) {
    return false
  }
  
  try {
    // 重置工作流状态
    resetWorkflowStatus()
    
    // 验证工作流数据结构
    const workflowData = currentChat.value.config.workflowData
    
    if (!workflowData.items || !Array.isArray(workflowData.items)) {
      throw new Error('无效的工作流数据格式')
    }
    
    // 检查节点类型
    const nodeTypes = new Set(workflowData.items.map((item: any) => item.type))
    const requiredTypes = ['start', 'end']
    
    for (const type of requiredTypes) {
      if (!nodeTypes.has(type)) {
        throw new Error(`工作流缺少${type}节点`)
      }
    }
    
    // 检查连接
    if (!workflowData.links || !Array.isArray(workflowData.links)) {
      throw new Error('工作流连接数据无效')
    }
    
    return true
  } catch (error: any) {
    console.error('工作流验证失败:', error)
    workflowError.value = true
    return false
  }
}

// 保存到本地存储
const saveChats = () => {
  localStorage.setItem('ai-chats', JSON.stringify(chats.value))
}

const loadChatsFromStorage = () => {
  const saved = localStorage.getItem('ai-chats')
  if (saved) {
    try {
      const loadedChats = JSON.parse(saved)
      chats.value = loadedChats
      chats.value.forEach(chat => {
        if (chat.online === undefined) chat.online = false
        if (chat.config.functionIndex === undefined) chat.config.functionIndex = 0
        if (chat.config.kbTopK === undefined && chat.config.kbPath) {
          chat.config.kbTopK = 5
        }
        if (chat.isGenerating === undefined) chat.isGenerating = false
        if (chat.config.workflowPath) {
          // 尝试重新加载工作流数据
          if (chat.config.workflowData) {
            setTimeout(() => {
              initWorkflowRunner()
            }, 100)
          }
        }
      })
    } catch (e) {
      console.error('加载聊天记录失败:', e)
    }
  }
}

// 创建新聊天
function createNewChatData(): Chat {
  return {
    id: Date.now().toString(),
    title: '',
    messages: [],
    config: {
      llmType: store.AIconfig.llm.type,
      model: getDefaultModel(store.AIconfig.llm.type),
      temperature: store.AIconfig.llm.temperature,
      maxTokens: Math.floor(store.AIconfig.llm.max_tokens),
      stream: store.AIconfig.llm.stream,
      think: false,
      functionIndex: 0,
      kbPath: undefined,
      kbTopK: 5,
      workflowPath: undefined,
      workflowData: undefined
    },
    createdAt: Date.now(),
    online: false,
    isGenerating: false
  }
}

function getDefaultModel(llmType: string): string {
  switch(llmType) {
    case 'ollama':
      return store.AIconfig.llm.ollama.model || ''
    case 'openai':
    case 'deepseek':
      return store.AIconfig.llm.openai.model || 'deepseek-chat'
    default:
      return ''
  }
}

const createNewChat = () => {
  chats.value.push(createNewChatData())
  currentChatIndex.value = chats.value.length - 1
  saveChats()
}

// 切换聊天
const switchChat = async (index: number) => {
  currentChatIndex.value = index
  
  // 停止当前工作流执行
  if (isWorkflowRunning.value) {
    stopWorkflow()
  }
  
  // 重置工作流状态
  resetWorkflowStatus()
  
  await checkCurrentModelConnection()
  
  // 如果新聊天有工作流，初始化运行器
  if (currentChat.value.config.workflowPath && currentChat.value.config.workflowData) {
    initWorkflowRunner()
  }
}

// 删除聊天
const deleteChat = (index: number) => {
  if (chats.value.length <= 1) return
  
  // 停止工作流执行
  if (index === currentChatIndex.value && isWorkflowRunning.value) {
    stopWorkflow()
  }
  
  if (confirm('确定删除这个聊天吗？')) {
    // 清理知识库详情显示状态
    chats.value[index].messages.forEach(msg => {
      delete showKbDetails.value[msg.timestamp]
    })
    
    chats.value.splice(index, 1)
    if (currentChatIndex.value >= chats.value.length) {
      currentChatIndex.value = chats.value.length - 1
    }
    saveChats()
  }
}

// 清空当前聊天
const clearCurrentChat = () => {
  if (confirm('确定清空当前聊天记录吗？')) {
    // 停止工作流执行
    if (isWorkflowRunning.value) {
      stopWorkflow()
    }
    
    // 清理知识库详情显示状态
    currentChat.value.messages.forEach(msg => {
      delete showKbDetails.value[msg.timestamp]
    })
    
    currentChat.value.messages = []
    saveChats()
  }
}

// 模型类型变化
const onModelTypeChange = async () => {
  currentChat.value.config.model = getDefaultModel(currentChat.value.config.llmType)
  currentChat.value.online = false
  saveChats()
}

// 检查当前模型连接
const checkCurrentModelConnection = async () => {
  const config = currentChat.value.config
  
  if (!config.model) {
    currentChat.value.online = false
    return
  }
  
  try {
    const originalType = store.AIconfig.llm.type
    const originalModel = getCurrentModelFromStore()
    
    store.AIconfig.llm.type = config.llmType
    updateStoreModelConfig(config)
    
    await store.getAIconfig()
    currentChat.value.online = store.AIconfig.llm.online
    
    store.AIconfig.llm.type = originalType
    if (originalType === config.llmType) {
      restoreStoreModelConfig(originalType, originalModel)
    }
    
    saveChats()
  } catch (error) {
    console.error('检查连接失败:', error)
    currentChat.value.online = false
  }
}

// 测试当前模型连接
const testCurrentModelConnection = async () => {
  const config = currentChat.value.config
  
  if (!config.model) {
    setConnectionTestStatus('请先选择模型', false)
    return
  }
  
  // 显示测试中状态
  setConnectionTestStatus('正在测试连接...', true)
  connectionTestIcon.value = 'fa fa-refresh fa-spin'
  connectionTestClass.value = 'step-testing'
  
  try {
    const originalType = store.AIconfig.llm.type
    const originalModel = getCurrentModelFromStore()
    
    store.AIconfig.llm.type = config.llmType
    updateStoreModelConfig(config)
    
    await store.getAIconfig()
    const isOnline = store.AIconfig.llm.online
    
    // 更新聊天状态
    currentChat.value.online = isOnline
    
    // 恢复store中的原始配置
    store.AIconfig.llm.type = originalType
    if (originalType === config.llmType) {
      restoreStoreModelConfig(originalType, originalModel)
    }
    
    saveChats()
    
    // 显示连接结果
    if (isOnline) {
      setConnectionTestStatus(`模型 ${config.model} 连接成功！`, true)
      console.log(`模型 ${config.model} 连接成功！`)
    } else {
      setConnectionTestStatus(`模型 ${config.model} 连接失败，请检查配置。`, false)
      console.log(`模型 ${config.model} 连接失败，请检查配置。`)
    }
  } catch (error:any) {
    console.error('测试连接失败:', error)
    currentChat.value.online = false
    setConnectionTestStatus('连接测试失败: ' + error.message, false)
  }
}

// 刷新模型列表
const refreshModels = async () => {
  try {
    const originalType = store.AIconfig.llm.type
    store.AIconfig.llm.type = currentChat.value.config.llmType
    
    await store.getAIconfig()
    currentChat.value.online = store.AIconfig.llm.online
    
    store.AIconfig.llm.type = originalType
    
    saveChats()
  } catch (error) {
    console.error('刷新模型失败:', error)
  }
}

// 更新store中的模型配置
const updateStoreModelConfig = (config: ChatConfig) => {
  const llmConfig = store.AIconfig.llm
  
  switch(config.llmType) {
    case 'ollama':
      llmConfig.ollama.model = config.model
      break
    case 'openai':
    case 'deepseek':
      llmConfig.openai.model = config.model
      break
    case 'anthropic':
      llmConfig.anthropic.model = config.model
      break
    case 'google':
      llmConfig.google.model = config.model
      break
    case 'azure':
      llmConfig.azure.deployment = config.model
      break
    case 'custom':
      llmConfig.custom.model = config.model
      break
  }
  
  llmConfig.temperature = config.temperature
  llmConfig.max_tokens = config.maxTokens
  llmConfig.stream = config.stream
}

// 恢复store中的模型配置
const restoreStoreModelConfig = (type: string, model: string) => {
  const llmConfig = store.AIconfig.llm
  
  switch(type) {
    case 'ollama':
      llmConfig.ollama.model = model
      break
    case 'openai':
    case 'deepseek':
      llmConfig.openai.model = model
      break
    case 'anthropic':
      llmConfig.anthropic.model = model
      break
    case 'google':
      llmConfig.google.model = model
      break
    case 'azure':
      llmConfig.azure.deployment = model
      break
    case 'custom':
      llmConfig.custom.model = model
      break
  }
}

// 获取store中当前模型
const getCurrentModelFromStore = (): string => {
  const llmConfig = store.AIconfig.llm
  
  switch(llmConfig.type) {
    case 'ollama':
      return llmConfig.ollama.model || ''
    case 'openai':
    case 'deepseek':
      return llmConfig.openai.model || ''
    case 'anthropic':
      return llmConfig.anthropic.model
    case 'google':
      return llmConfig.google.model
    case 'azure':
      return llmConfig.azure.deployment || ''
    case 'custom':
      return llmConfig.custom.model || ''
    default:
      return ''
  }
}

// 发送消息或运行工作流
const sendMessage = async () => {
  const message = inputText.value.trim()
  
  // 检查是否正在生成中
  if (currentChat.value.isGenerating || isWorkflowRunning.value) {
    return
  }
  
  // 检查是否有模型
  if (!currentChat.value.config.model) {
    console.log('请先选择模型')
    return
  }
  
  // 检查连接状态
  if (!currentChat.value.online) {
    if(!testCurrentModelConnection()){
      if (!confirm('模型未连接，是否继续发送？')) {
        return
      }
    }
  }
  
  // 如果有工作流配置，运行工作流
  if (currentChat.value.config.workflowPath && currentChat.value.config.workflowData) {
    await runWorkflow(message)
  } else {
    // 否则执行普通聊天
    await sendChatMessage(message)
  }
}

// 运行工作流
const runWorkflow = async (userInput: string) => {
  if (!workflowRunner.value || !currentChat.value.config.workflowData) {
    alert('工作流未正确初始化')
    return
  }
  
  // 重置状态
  resetWorkflowStatus()
  workflowError.value = false
  
  // 在开始生成前获取当前聊天的引用
  const chatIndex = currentChatIndex.value
  
  // 立即添加用户消息并显示
  const userMessage: ChatMessage = {
    role: 'user',
    content: userInput,
    timestamp: Date.now(),
  }
  
  // 直接操作当前聊天的messages
  const currentChatData = chats.value[chatIndex]
  currentChatData.messages.push(userMessage)
  if (!currentChatData.config.workflowData) {
    console.error('工作流数据未定义')
    return
  }
  
  // 添加工作流执行中的助理消息（只添加一次）
  const workflowMessage: ChatMessage = {
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    isWorkflowRunning: true,
    workflowResult: true
  }
  
  currentChatData.messages.push(workflowMessage)
  
  // 清空输入框
  inputText.value = ''
  
  // 启用自动滚动
  autoScrollEnabled.value = true
  scrollToBottom()
  
  try {
    // 初始化工作流状态
    workflowStartTime.value = Date.now()
    workflowStatus.value = {
      isRunning: true,
      progress: 0,
      currentStep: 0,
      totalSteps: currentChatData.config.workflowData.items.length,
      executionTime: 0,
      completedNodes: 0,
      totalNodes: currentChatData.config.workflowData.items.length,
      currentNode: '初始化...'
    }
    
    workflowNodeStatus.value = []
    workflowErrors.value = []
    decisionPaths.value = []
    
    // 设置工作流开始节点的输入
    if (!workflowRunner.value.setStartNodeInput(userInput)) {
      throw new Error('设置起始节点输入失败')
    }
    
    // 执行工作流
    await workflowRunner.value.run()
    
    // 注意：onComplete 回调会处理消息的更新
    
  } catch (error: any) {
    console.error('运行工作流失败:', error)
    
    // 查找并更新正在运行的工作流消息
    const messages = currentChat.value.messages
    const workflowMessageIndex = messages.findIndex(msg => msg.isWorkflowRunning)
    
    if (workflowMessageIndex !== -1) {
      // 更新现有的工作流消息
      const workflowMessage = messages[workflowMessageIndex]
      workflowMessage.isWorkflowRunning = false
      workflowMessage.content = `工作流执行失败: ${error.message}`
      workflowMessage.workflowResult = true
    }
    
    workflowError.value = true
    
    // 5秒后清除工作流状态
    setTimeout(() => {
      resetWorkflowStatus()
    }, 5000)
  } finally {
    saveChats()
    scrollToBottom()
  }
}

// 重置工作流状态
const resetWorkflowStatus = () => {
  workflowStatus.value = null
  workflowNodeStatus.value = []
  workflowErrors.value = []
  decisionPaths.value = []
  workflowError.value = false
}

// 停止工作流
const stopWorkflow = () => {
  if (workflowRunner.value) {
    workflowRunner.value.stop()
  }
  
  if (workflowStatus.value) {
    workflowStatus.value.isRunning = false
  }
  
  // 查找并更新正在运行的工作流消息
  const messages = currentChat.value.messages
  const workflowMessageIndex = messages.findIndex(msg => msg.isWorkflowRunning)
  
  if (workflowMessageIndex !== -1) {
    // 更新现有的工作流消息
    const workflowMessage = messages[workflowMessageIndex]
    workflowMessage.isWorkflowRunning = false
    workflowMessage.content = store.locales=='zh' ? '工作流已停止' : 'Workflow stopped'
    workflowMessage.workflowResult = true
  }
  
  saveChats()
  
  // 5秒后清除状态
  setTimeout(() => {
    resetWorkflowStatus()
  }, 5000)
}

// 普通聊天消息发送
const sendChatMessage = async (message: string) => {
  // 在开始生成前获取当前聊天的引用
  const chatIndex = currentChatIndex.value
  
  // 立即添加用户消息并显示
  const userMessage: ChatMessage = {
    role: 'user',
    content: message,
    timestamp: Date.now(),
  }
  
  // 直接操作当前聊天的messages
  const currentChatData = chats.value[chatIndex]
  currentChatData.messages.push(userMessage)
  currentChatData.isGenerating = true
  
  // 设置初始状态
  setStep('正在发送请求...', 'fa fa-paper-plane', 'step-sending')
  
  inputText.value = ''
  
  // 启用自动滚动
  autoScrollEnabled.value = true
  scrollToBottom()

  const originalType = store.AIconfig.llm.type
  const originalModel = getCurrentModelFromStore()
  
  store.AIconfig.llm.type = currentChatData.config.llmType
  updateStoreModelConfig(currentChatData.config)

  // 检查是否关联了知识库
  const kbPath = currentChatData.config.kbPath
  let retrievedContext = message
  let relevantBlocks: RelevantBlock[] = []

  if (kbPath) {
    try {
      // 更新状态为检索中
      setStep('正在检索知识库...', 'fa fa-search fa-spin', 'step-retrieving')
      
      console.log(`正在检索知识库: ${kbPath}`)
      
      // 获取知识库片段数量配置
      const topK = currentChatData.config.kbTopK || 5
      
      const retrievalResult = await retrieveKnowledge(
        message,
        kbPath,
        {
          topK: topK,
          summaryWeight: 0.7,
          useReverseInference: true,
          debug: true
        }
      )
      console.log(retrievalResult)
      retrievedContext = retrievalResult.context
      relevantBlocks = retrievalResult.relevantBlocks || []
      
      // 更新用户消息，添加召回信息
      userMessage.kbInfo = {
        kbPath: kbPath,
        relevantBlocks: relevantBlocks,
        debugInfo: retrievalResult.debugInfo
      }
      
      // 更新检索统计信息
      if (retrievalResult.debugInfo) {
        const debug = retrievalResult.debugInfo
        retrievalStats.value = {
          totalBlocks: debug.totalBlocks,
          returnedBlocks: debug.selectedCount,
          maxSimilarity: `${(debug.similarityStats.max * 100).toFixed(1)}%`,
          averageSimilarity: `${(debug.similarityStats.avg * 100).toFixed(1)}%`
        }
      } else if (relevantBlocks && relevantBlocks.length > 0) {
        const maxSim = Math.max(...relevantBlocks.map(b => b.similarity))
        const avgSim = relevantBlocks.reduce((sum, b) => sum + b.similarity, 0) / relevantBlocks.length
        
        retrievalStats.value = {
          totalBlocks: relevantBlocks.length,
          returnedBlocks: relevantBlocks.length,
          maxSimilarity: `${(maxSim * 100).toFixed(1)}%`,
          averageSimilarity: `${(avgSim * 100).toFixed(1)}%`
        }
      }
      
      // 检索完成，更新状态为思考中
      setStep('检索完成，正在思考...', 'fa fa-cog fa-spin', 'step-thinking')
      
    } catch (error) {
      console.error('知识库检索失败:', error)
      setStep('检索失败，继续思考...', 'fa fa-exclamation-triangle', 'step-error')
    }
  } else {
    // 如果没有关联知识库，直接显示思考状态
    setStep('正在思考...', 'fa fa-cog fa-spin', 'step-thinking')
  }
  
  // 添加助理消息占位符
  const assistantMessage: ChatMessage = {
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    model: currentChatData.config.model
  }
  
  currentChatData.messages.push(assistantMessage)
  
  // 立即滚动到底部显示新的助理消息
  scrollToBottom()
  
  try {
    const messages = buildMessagesWithFunction(currentChatData, retrievedContext)
    
    // 更新状态为生成中
    setStep(`正在使用 ${getModelDisplayName(currentChatData.config)} 生成回复...`, 'fa fa-refresh fa-spin', 'step-generating')
    
    await store.sendToAI(
      messages,
      store.AIconfig.functions[currentChatData.config.functionIndex],
      {
        onStream: (chunk: string) => {
          const lastMessage = currentChatData.messages[currentChatData.messages.length - 1]
          if (lastMessage.role === 'assistant') {
            lastMessage.content += chunk
          }
          
          // 只有在当前显示的是这个聊天时才滚动
          if (currentChatIndex.value === chatIndex && autoScrollEnabled.value) {
            scrollToBottom()
          }
        },
        onComplete: (content: string) => {
          const lastMessage = currentChatData.messages[currentChatData.messages.length - 1]
          if (lastMessage.role === 'assistant') {
            lastMessage.content = content
          }
          
          if (ttsEnabled.value) {
            store.tts(content)
          }
          
          // 生成标题
          if (!currentChatData.title && currentChatData.messages.length === 2) {
            generateChatTitle(content)
          }
          
          // 清理状态
          currentChatData.isGenerating = false
          retrievalStats.value = null
          currentStep.value = ''
          saveChats()
          
          scrollToBottom()
        },
        onError: (error: Error) => {
          console.error('AI请求失败:', error)
          const lastMessage = currentChatData.messages[currentChatData.messages.length - 1]
          if (lastMessage.role === 'assistant') {
            lastMessage.content = '抱歉，请求失败：' + error.message
          }
          
          // 清理状态
          currentChatData.isGenerating = false
          retrievalStats.value = null
          currentStep.value = ''
          saveChats()
        }
      }
    )
  } catch (error) {
    console.error('发送消息失败:', error)
    const lastMessage = currentChatData.messages[currentChatData.messages.length - 1]
    if (lastMessage.role === 'assistant') {
      lastMessage.content = '请求失败，请检查网络连接和模型配置'
    }
    
    // 清理状态
    currentChatData.isGenerating = false
    retrievalStats.value = null
    currentStep.value = ''
    saveChats()
  } finally {
    store.AIconfig.llm.type = originalType
    if (originalType === currentChatData.config.llmType) {
      restoreStoreModelConfig(originalType, originalModel)
    }
    saveChats()
  }
}

// 设置步骤状态
const setStep = (step: string, icon: string, stepClass: string) => {
  currentStep.value = step
  stepIcon.value = icon
  stepIndicatorClass.value = stepClass
}

// 构建包含功能指令的消息历史
const buildMessagesWithFunction = (chat: Chat, context: string) => {
  const messages = []
  const functionConfig = store.AIconfig.functions[chat.config.functionIndex]
  
  if (functionConfig.prompt) {
    const characterPrompt = `${functionConfig.prompt}`
    messages.push({
      role: 'system',
      content: characterPrompt
    })
  }
  
  const historyMessages = chat.messages
    .slice(0, -1)
    .map(msg => ({
      role: msg.role,
      content: msg.content
    }))
  
  const lastMessage = {
    role: 'user' as const,
    content: context
  }
  
  return [...messages, ...historyMessages, lastMessage]
}

// 停止当前生成
const stopCurrentGeneration = () => {
  const currentChatData = currentChat.value
  
  if (isWorkflowRunning.value) {
    // 停止工作流
    stopWorkflow()
  } else {
    // 停止聊天生成
    if (abortController.value) {
      abortController.value.abort()
      abortController.value = null
    }
    
    // 停止当前聊天的生成
    currentChatData.isGenerating = false
    retrievalStats.value = null
    currentStep.value = ''
    
    const lastIndex = currentChatData.messages.length - 1
    if (lastIndex >= 0 && currentChatData.messages[lastIndex].content === '') {
      currentChatData.messages[lastIndex].content = '已停止生成'
      saveChats()
    }
  }
}

// 自动重命名每个聊天
const generateChatTitle = async (firstResponse: string) => {
  try {
    const currentChatData = currentChat.value
    
    // 确保聊天确实没有标题
    if (currentChatData.title && currentChatData.title.trim() !== '') {
      return
    }
    
    // 确保只有2条消息（用户消息+AI回复）
    if (currentChatData.messages.length !== 2) {
      return
    }
    
    const titlePrompt = `请根据以下对话内容生成一个简短的中文标题（不超过10个字）：\n${firstResponse.substring(0, 200)}`
    
    const title = await store.sendToAI(
      [{ role: 'user', content: titlePrompt }],
      { title: '总结', instruct: '请生成一个简短的标题' }
    )
    
    currentChatData.title = title.replace(/["']/g, '').trim()
    saveChats()
  } catch (error) {
    console.error('生成标题失败:', error)
  }
}

// 删除单条消息
const deleteMessage = (index: number) => {
  // 清理知识库详情显示状态
  const message = currentChat.value.messages[index]
  delete showKbDetails.value[message.timestamp]
  
  currentChat.value.messages.splice(index, 1)
  saveChats()
}

// 复制消息
const copyMessage = async (content: string) => {
  try {
    await navigator.clipboard.writeText(content)
  } catch (err) {
    console.error('复制失败:', err)
    const textarea = document.createElement('textarea')
    textarea.value = content
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }
}

// 导出聊天为Markdown格式
const exportChat = () => {
  const chat = currentChat.value
  const now = new Date()
  
  let fileName = ''
  if (chat.title && chat.title.trim() !== '') {
    fileName = chat.title.replace(/[\\/:*?"<>|]/g, '_').trim()
  } else {
    fileName = `聊天${currentChatIndex.value + 1}`
  }
  
  const timestamp = now.toISOString().split('T')[0] + '_' + 
                   now.getHours().toString().padStart(2, '0') + 
                   now.getMinutes().toString().padStart(2, '0')
  fileName = `${fileName}_${timestamp}.md`
  
  let markdownContent = `# ${chat.title || `聊天 ${currentChatIndex.value + 1}`}\n\n`
  
  markdownContent += `## 聊天信息\n\n`
  markdownContent += `- **导出时间**: ${now.toLocaleString('zh-CN')}\n`
  markdownContent += `- **模型类型**: ${chat.config.llmType}\n`
  markdownContent += `- **模型名称**: ${chat.config.model || '未设置'}\n`
  if (chat.config.kbPath) {
    const kbName = chat.config.kbPath.split(/[\\/]/).pop() || chat.config.kbPath
    markdownContent += `- **关联知识库**: ${kbName}\n`
    if (chat.config.kbTopK) {
      markdownContent += `- **知识库片段数**: ${chat.config.kbTopK}\n`
    }
  }
  if (chat.config.workflowPath) {
    const workflowName = chat.config.workflowPath.split(/[\\/]/).pop() || chat.config.workflowPath
    markdownContent += `- **工作流**: ${workflowName}\n`
  }
  markdownContent += `- **温度参数**: ${chat.config.temperature}\n`
  markdownContent += `- **最大令牌**: ${chat.config.maxTokens}\n`
  markdownContent += `- **功能模式**: ${store.AIconfig.functions[chat.config.functionIndex]?.title || '正常对话'}\n`
  markdownContent += `- **消息数量**: ${chat.messages.length}\n\n`
  
  markdownContent += `---\n\n`
  
  markdownContent += `## 对话记录\n\n`
  
  chat.messages.forEach((message, index) => {
    const time = new Date(message.timestamp).toLocaleString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
    
    const roleIcon = message.role === 'user' ? '👤' : 
                    message.role === 'assistant' ? '🤖' : '⚙️'
    
    const roleLabel = message.role === 'user' ? '用户' : 
                     message.role === 'assistant' ? '助理' : '系统'
    
    markdownContent += `### ${roleIcon} ${roleLabel}`
    
    // 如果是工作流生成的消息，添加标识
    if (message.workflowResult) {
      markdownContent += ` ⚙️ 工作流生成`
    }
    
    markdownContent += ` · ${time}\n\n`
    
    if (message.content.trim() !== '') {
      markdownContent += `${message.content}\n\n`
    } else {
      markdownContent += `*(空消息)*\n\n`
    }
    
    // 添加工作流统计信息
    if (message.workflowStats) {
      markdownContent += `**工作流执行统计:**\n\n`
      markdownContent += `- **总节点数**: ${message.workflowStats.totalNodes}\n`
      markdownContent += `- **成功节点**: ${message.workflowStats.completedNodes}\n`
      markdownContent += `- **失败节点**: ${message.workflowStats.failedNodes}\n`
      markdownContent += `- **执行耗时**: ${message.workflowStats.executionTime}ms\n\n`
      
      if (message.workflowStats.errors && message.workflowStats.errors.length > 0) {
        markdownContent += `**执行错误:**\n\n`
        message.workflowStats.errors.forEach((error, errorIndex) => {
          markdownContent += `${errorIndex + 1}. **${error.nodeName}**: ${error.error}\n`
        })
        markdownContent += `\n`
      }
    }
    
    // 添加召回信息到导出
    if (message.kbInfo?.relevantBlocks?.length) {
      markdownContent += `**召回文件标签 (${message.kbInfo.relevantBlocks.length}个):**\n\n`
      
      const mergedTags = mergeDuplicateLabels(message.kbInfo.relevantBlocks)
      mergedTags.forEach(tag => {
        markdownContent += `- **${tag.label}** (相似度: ${(tag.similarity * 100).toFixed(1)}%)\n`
        if (tag.contents && tag.contents.length > 0) {
          tag.contents.forEach((content, contentIndex) => {
            if (content && content.trim()) {
              markdownContent += `  ${contentIndex + 1}. ${content}\n`
            }
          })
        }
      })
      markdownContent += `\n`
    }
    
    if (index < chat.messages.length - 1) {
      markdownContent += `---\n\n`
    }
  })
  
  const dataBlob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(dataBlob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// 切换TTS
const toggleTTS = () => {
  ttsEnabled.value = !ttsEnabled.value
  if (!ttsEnabled.value) {
    store.stopTTS()
  }
}

// 切换侧边栏
const toggleSidebar = () => {
  showSidebar.value = !showSidebar.value
}

// 辅助函数
const getModelDisplayName = (config: ChatConfig): string => {
  if (config.model) {
    return config.model.length > 20 ? config.model.substring(0, 20) + '...' : config.model
  }
  return config.llmType + ' (未选择)'
}

const getRoleDisplay = (role: string): string => {
  if (store.locales == 'zh') {
    const roles: Record<string, string> = {
      'user': '👤 用户',
      'assistant': '🤖 助理',
      'system': '⚙️ 系统'
    }
    return roles[role] || role;
  } else {
    const roles: Record<string, string> = {
      'user': '👤 User',
      'assistant': '🤖 Assistant',
      'system': '⚙️ System'
    }
    return roles[role] || role;
  }
}

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
</script>

<style scoped>
.ai-chat-container {
  display: flex;
  height: 100%;
  background-color: var(--backgroundColor);
  position: relative;
}

/* 侧边栏样式 */
.chat-sidebar {
  width: 220px;
  border-right: 1px solid var(--borderColor);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.button {
  margin: 0px;
  background-color: var(--backgroundColor);
}

.chat-list {
  flex: 1;
  overflow-y: auto;
  padding: 5px;
}

.chat-item {
  padding: 6px;
  margin-bottom: 4px;
  border: 1px solid var(--borderColor);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: var(--backgroundColor);
  position: relative;
}

.chat-item:hover {
  background-color: var(--menuActiveColor);
}

.chat-item.active {
  border-color: var(--fontActiveColor);
  background-color: var(--menuActiveColor);
}

.chat-item.generating {
  border-color: var(--fontActiveColor);
  animation: pulse-border 2s infinite;
}

@keyframes pulse-border {
  0% { border-color: var(--fontActiveColor); }
  50% { border-color: rgba(var(--fontActiveColor-rgb), 0.3); }
  100% { border-color: var(--fontActiveColor); }
}

.chat-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 3px;
}

.chat-title {
  font-weight: bold;
  font-size: 11px;
  color: var(--fontColor);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  padding-right: 20px;
}

.chat-actions {
  position: absolute;
  right: 6px;
  top: 6px;
  opacity: 0;
  transition: opacity 0.2s;
  padding: 2px;
  border-radius: 3px;
  font-size: 12px;
  z-index: 1;
}

.chat-item:hover .chat-actions {
  opacity: 0.6;
}

.chat-actions:hover {
  opacity: 1 !important;
  color: var(--fontActiveColor);
}

.generating-indicator {
  position: absolute;
  right: 8px;
  top: 4px;
}

.generating-dots {
  display: flex;
  gap: 2px;
}

.generating-dots span {
  width: 3px;
  height: 3px;
  background-color: var(--fontActiveColor);
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out both;
}

/* 内联的打字动画点 */
.typing-dots-inline {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin: 0px 10px;
  vertical-align: middle;
}

.typing-dots-inline span {
  width: 4px;
  height: 4px;
  background-color: var(--fontColor);
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out both;
  display: inline-block;
}

.typing-dots-inline span:nth-child(1) { animation-delay: -0.32s; }
.typing-dots-inline span:nth-child(2) { animation-delay: -0.16s; }

.chat-info {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: var(--borderColor);
}

.model-name {
  max-width: 70px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin: 0px 5px;
}

.status-indicator.online {
  background-color: #2ecc71;
  box-shadow: 0 0 5px #2ecc71;
}

.status-indicator.offline {
  background-color: #e74c3c;
}

/* 主聊天区域 */
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  width: calc(100% - 220px);
  transition: width 0.2s ease;
}

.chat-main.sidebar-hidden {
  width: 100%;
}

.chat-header {
  padding: 1px 5px;
  border-bottom: 1px solid var(--borderColor);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  height: 40px;
  white-space: nowrap;
  overflow-y: hidden;
}

.header-left {
  display: flex;
  align-items: center;
  flex: 1;
  gap: 5px;
  flex-wrap: wrap;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--fontColor);
  padding-left: 5px;
}

.chat-title-input {
  flex: 2;
  border: 1px solid var(--borderColor);
  height: 30px;
  padding: 0 6px;
  margin: 0;
  background-color: var(--backgroundColor);
}

.model-select {
  flex: 1;
  height: 31px;
  padding: 0 4px;
  margin: 0px;
}

select {
  flex: 1;
  background-color: var(--backgroundColor);
}

/* 消息区域 */
.message-container {
  flex: 1;
  overflow-y: auto;
  padding: 5px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-height: 0;
}

/* 消息项样式 */
.message-item {
  border-radius: 6px;
  padding: 8px;
  min-width: 80px;
  max-width: 85%;
  animation: fadeIn 0.2s ease;
  position: relative;
  transition: all 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

.user-message {
  margin-left: auto;
  border: 1px solid var(--borderColor);
}

.assistant-message {
  margin-right: auto;
  border: 1px solid var(--borderColor);
}

.workflow-message {
  border: 2px solid rgba(52, 152, 219, 0.3);
  background-color: rgba(52, 152, 219, 0.03);
}

.message-item.workflow-running {
  border: 2px solid rgba(52, 152, 219, 0.5);
  background-color: rgba(52, 152, 219, 0.08);
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  font-size: 10px;
  color: var(--borderColor);
  position: relative;
}

.message-role {
  font-weight: bold;
  color: var(--fontColor);
  display: flex;
  align-items: center;
  gap: 6px;
}

.workflow-badge {
  font-size: 9px;
  background-color: rgba(52, 152, 219, 0.2);
  color: #3498db;
  padding: 1px 4px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 3px;
}

.message-actions {
  position: absolute;
  right: 0;
  top: 0;
  display: flex;
  opacity: 0;
  transition: opacity 0.2s ease;
  background-color: var(--backgroundColor);
  border-radius: 3px;
  padding: 2px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.message-item:hover .message-actions {
  opacity: 1;
}

.action-button {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
  color: var(--fontColor);
  transition: all 0.2s ease;
}

.action-button:hover {
  background-color: var(--menuActiveColor);
  color: var(--fontActiveColor);
}

.message-content {
  word-wrap: break-word;
  line-height: 1.4;
  font-size: 13px;
  padding-right: 30px;
}

.message-content :deep(pre) {
  background-color: var(--backgroundColor);
  padding: 6px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 4px 0;
  font-size: 11px;
}

.message-content :deep(code) {
  background-color: var(--backgroundColor);
  padding: 2px 4px;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
  font-size: 11px;
}

.message-content :deep(p) {
  margin: 4px 0;
}

.message-content :deep(ul), .message-content :deep(ol) {
  margin: 4px 0;
  padding-left: 20px;
}

.message-content :deep(li) {
  margin: 2px 0;
}

/* 工作流执行状态（显示在工作流执行中的消息里） */
.workflow-execution-status {
  margin: 0;
  padding: 5px;
  border: 1px solid rgba(52, 152, 219, 0.3);
  border-radius: 8px;
  background-color: rgba(52, 152, 219, 0.05);
  animation: slideInDown 0.3s ease;
}

@keyframes slideInDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.workflow-progress {
  margin-bottom: 10px;
}

.progress-bar {
  height: 6px;
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background-color: #3498db;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--fontColor);
}

.progress-text {
  display: flex;
  align-items: center;
  gap: 6px;
}

.progress-time {
  font-size: 11px;
  color: #7f8c8d;
  background-color: rgba(0, 0, 0, 0.05);
  padding: 2px 6px;
  border-radius: 10px;
}

.workflow-node-status {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
  max-height: 150px;
  overflow-y: auto;
}

.workflow-node-item {
  padding: 4px;
  border-radius: 4px;
  border-left: 3px solid #95a5a6;
  background-color: var(--backgroundColor);
  transition: all 0.2s ease;
}

.workflow-node-item.node-running {
  border-left-color: #3498db;
  background-color: rgba(52, 152, 219, 0.05);
}

.workflow-node-item.node-success {
  border-left-color: #2ecc71;
  background-color: rgba(46, 204, 113, 0.05);
}

.workflow-node-item.node-error {
  border-left-color: #e74c3c;
  background-color: rgba(231, 76, 60, 0.05);
}

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  margin-bottom: 2px;
}

.node-header i {
  font-size: 10px;
  width: 12px;
}

.node-name {
  font-weight: bold;
  color: var(--fontColor);
  flex: 1;
}

.node-type {
  font-size: 10px;
  color: #7f8c8d;
  background-color: rgba(0, 0, 0, 0.05);
  padding: 1px 4px;
  border-radius: 3px;
}

/* 工作流错误样式 */
.workflow-errors {
  margin: 8px 0;
  padding: 12px;
  border: 1px solid rgba(231, 76, 60, 0.3);
  border-radius: 8px;
  background-color: rgba(231, 76, 60, 0.05);
  animation: slideInDown 0.3s ease;
}

.error-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: bold;
  color: #e74c3c;
  margin-bottom: 8px;
}

.error-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.error-item {
  padding: 6px 8px;
  border-radius: 4px;
  background-color: rgba(231, 76, 60, 0.1);
  border-left: 3px solid #e74c3c;
}

.error-node {
  font-size: 11px;
  font-weight: bold;
  color: var(--fontColor);
  margin-bottom: 2px;
}

.error-message {
  font-size: 10px;
  color: #c0392b;
  word-break: break-word;
}

/* 工作流统计样式 */
.workflow-stats {
  margin-top: 10px;
  padding: 8px;
  border: 1px solid rgba(52, 152, 219, 0.2);
  border-radius: 6px;
  background-color: rgba(52, 152, 219, 0.03);
}

.stats-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: bold;
  color: #3498db;
  margin-bottom: 8px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
  color: var(--fontColor);
}

.stat-label {
  opacity: 0.7;
}

.stat-value {
  font-weight: bold;
  color: var(--fontActiveColor);
}

.workflow-error-summary {
  margin-top: 6px;
  padding: 4px 6px;
  background-color: rgba(231, 76, 60, 0.1);
  border-radius: 4px;
  font-size: 10px;
  color: #e74c3c;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 知识库标签样式 */
.kb-tags-container {
  margin-top: 8px;
  padding: 6px;
  border: 1px solid rgba(52, 152, 219, 0.1);
  border-radius: 6px;
  font-size: 11px;
}

.kb-tags-header {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
  color: var(--fontActiveColor);
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
}

.kb-tags-header i {
  font-size: 10px;
  transition: transform 0.2s ease;
}

.kb-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

.kb-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  background-color: var(--backgroundColor);
  border: 1px solid var(--borderColor);
  border-radius: 12px;
  cursor: help;
  transition: all 0.2s ease;
  max-width: 200px;
  overflow: hidden;
}

.kb-tag:hover {
  border-color: var(--fontActiveColor);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.tag-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--fontColor);
  font-size: 10px;
}

.tag-similarity {
  font-size: 9px;
  font-weight: bold;
  color: var(--fontActiveColor);
  min-width: 30px;
  text-align: right;
}

/* 使用 CSS 变量来设置相似度颜色 */
.kb-tag .tag-similarity {
  color: var(--similarity-color);
}

/* 知识库详情样式 */
.kb-details {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(52, 152, 219, 0.1);
}

.kb-detail-item {
  margin-bottom: 6px;
  padding: 4px;
  background-color: var(--backgroundColor);
  border-radius: 4px;
  border-left: 3px solid var(--fontActiveColor);
}

.kb-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px;
  font-size: 10px;
}

.detail-label {
  font-weight: bold;
  color: var(--fontColor);
  max-width: 70%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-similarity {
  font-size: 9px;
  font-weight: bold;
  color: var(--fontActiveColor);
}

.kb-detail-content {
  font-size: 10px;
  color: var(--fontColor);
  line-height: 1.3;
  max-height: 60px;
  overflow-y: auto;
  padding: 2px;
  border-radius: 2px;
}

/* 打字动画关键帧 */
@keyframes typing {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.6; }
  40% { transform: scale(1); opacity: 1; }
}

/* 输入区域 */
.input-area {
  padding: 8px;
  border-top: 1px solid var(--borderColor);
  flex-shrink: 0;
  position: relative;
}

/* 步骤信息和统计信息容器 */
.step-info-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 8px;
}

/* 左侧：步骤指示器 */
.step-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  padding: 6px 10px;
  border-radius: 8px;
  animation: pulse 2s infinite;
  flex-shrink: 0;
}

.step-indicator.step-sending {
  background-color: rgba(52, 152, 219, 0.1);
  color: #3498db;
  border: 1px solid rgba(52, 152, 219, 0.2);
}

.step-indicator.step-retrieving {
  background-color: rgba(243, 156, 18, 0.1);
  color: #f39c12;
  border: 1px solid rgba(243, 156, 18, 0.2);
}

.step-indicator.step-thinking {
  background-color: rgba(46, 204, 113, 0.1);
  color: #2ecc71;
  border: 1px solid rgba(46, 204, 113, 0.2);
}

.step-indicator.step-generating {
  background-color: rgba(155, 89, 182, 0.1);
  color: #9b59b6;
  border: 1px solid rgba(155, 89, 182, 0.2);
}

.step-indicator.step-error {
  background-color: rgba(231, 76, 60, 0.1);
  color: #e74c3c;
  border: 1px solid rgba(231, 76, 60, 0.2);
}

.step-indicator.step-success {
  background-color: rgba(46, 204, 113, 0.1);
  color: #2ecc71;
  border: 1px solid rgba(46, 204, 113, 0.2);
}

.step-indicator.step-testing {
  background-color: rgba(52, 152, 219, 0.1);
  color: #3498db;
  border: 1px solid rgba(52, 152, 219, 0.2);
}

.step-indicator i {
  font-size: 12px;
}

@keyframes pulse {
  0% { opacity: 0.9; }
  50% { opacity: 1; }
  100% { opacity: 0.9; }
}

/* 右侧：检索统计信息 */
.retrieval-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 10px;
  background-color: rgba(52, 152, 219, 0.05);
  border: 1px solid rgba(52, 152, 219, 0.1);
  border-radius: 8px;
  padding: 4px 8px;
  margin-left: auto;
  flex-shrink: 0;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--fontColor);
  white-space: nowrap;
}

.stat-item i {
  font-size: 10px;
  color: var(--fontActiveColor);
}

.stat-item span {
  font-weight: bold;
  color: var(--fontActiveColor);
}

.message-input {
  width: 100%;
  min-height: 60px;
  max-height: 120px;
  font-size: 12px;
  padding: 8px;
  line-height: 1.4;
  border: 1px solid var(--borderColor);
  border-radius: 4px;
  resize: vertical;
}

.input-controls {
  display: flex;
  flex-direction: row;
  gap: 5px;
}

.parameter {
  display: flex;
  align-items: center;
  font-size: 11px;
  color: var(--fontColor);
}

.parameter label {
  white-space: nowrap;
  min-width: 20px;
  padding: 0px;
}

.param-slider {
  width: 80px;
  height: 4px;
  background: var(--borderColor);
  border-radius: 2px;
  outline: none;
}

.param-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--fontActiveColor);
  cursor: pointer;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  white-space: nowrap;
  padding: 0;
  font-size: 11px;
}

.checkbox-label input[type="checkbox"] {
  width: 12px;
  height: 12px;
  margin: 0;
}

.button.active {
  background-color: var(--menuActiveColor);
  color: var(--fontActiveColor);
}

.button.workflow-running {
  background-color: rgba(52, 152, 219, 0.2);
  color: #3498db;
  animation: pulse-button 2s infinite;
}

.button.workflow-error {
  background-color: rgba(231, 76, 60, 0.2);
  color: #e74c3c;
}

@keyframes pulse-button {
  0% { box-shadow: 0 0 0 0 rgba(52, 152, 219, 0.4); }
  70% { box-shadow: 0 0 0 4px rgba(52, 152, 219, 0); }
  100% { box-shadow: 0 0 0 0 rgba(52, 152, 219, 0); }
}

/* 响应式调整 */
@media (max-width: 768px) {
  .chat-sidebar {
    width: 140px;
  }
  
  .chat-main {
    width: calc(100% - 140px);
  }
  
  .step-indicator {
    font-size: 10px;
    padding: 4px 8px;
  }
  
  .param-slider {
    width: 40px;
  }

  .retrieval-stats {
    font-size: 9px;
    gap: 8px;
    padding: 3px 6px;
  }
  
  .stat-item {
    gap: 3px;
  }
  
  .stat-item i {
    font-size: 9px;
  }
  
  .kb-tags-container {
    font-size: 10px;
  }
  
  .kb-tag {
    max-width: 150px;
    padding: 1px 4px;
  }
  
  .tag-label {
    font-size: 9px;
  }
  
  .tag-similarity {
    font-size: 8px;
    min-width: 25px;
  }
  
  .kb-detail-item {
    font-size: 9px;
  }
  
  .detail-label {
    max-width: 60%;
  }
  
  .typing-dots-inline {
    margin-left: 4px;
  }
  
  .typing-dots-inline span {
    width: 3px;
    height: 3px;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
}


/* 工作流节点状态新增样式 */
.node-index {
  font-size: 10px;
  color: #7f8c8d;
  background-color: rgba(0, 0, 0, 0.05);
  padding: 1px 6px;
  border-radius: 10px;
  margin-left: auto;
}

.node-details {
  margin-top: 6px;
  padding: 4px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.node-stream-content,
.node-result-preview {
  margin-bottom: 6px;
  padding: 4px;
  border-radius: 3px;
  background-color: var(--backgroundColor);
}

.stream-header,
.result-header {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: bold;
  color: var(--fontActiveColor);
  margin-bottom: 3px;
}

.stream-header i,
.result-header i {
  font-size: 9px;
}

.stream-content,
.result-content {
  font-size: 10px;
  color: var(--fontColor);
  line-height: 1.3;
  max-height: 80px;
  overflow-y: auto;
  padding: 3px;
  background-color: rgba(0, 0, 0, 0.03);
  border-radius: 2px;
  white-space: pre-wrap;
  word-break: break-word;
}

.node-message {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--fontColor);
  padding: 2px;
  border-radius: 3px;
}

.node-message i {
  font-size: 9px;
  color: #3498db;
}

.node-timestamp {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 9px;
  color: #7f8c8d;
  margin-top: 2px;
}

.node-timestamp i {
  font-size: 8px;
}

/* 决策路径样式 */
.decision-paths {
  margin-top: 10px;
  padding: 8px;
  border: 1px solid rgba(46, 204, 113, 0.2);
  border-radius: 6px;
  background-color: rgba(46, 204, 113, 0.05);
  animation: fadeIn 0.3s ease;
}

.decision-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: bold;
  color: #2ecc71;
  margin-bottom: 6px;
}

.decision-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.decision-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: var(--fontColor);
  padding: 3px 6px;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.03);
}

.decision-node {
  font-weight: bold;
  color: var(--fontColor);
}

.decision-branch {
  font-weight: bold;
  color: #2ecc71;
}

.decision-reason {
  font-size: 9px;
  color: #7f8c8d;
  margin-left: auto;
  font-style: italic;
}

/* 工作流步骤指示器 */
.step-indicator.step-workflow {
  background-color: rgba(155, 89, 182, 0.1);
  color: #9b59b6;
  border: 1px solid rgba(155, 89, 182, 0.2);
  animation: pulse 1.5s infinite;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .stream-content,
  .result-content {
    max-height: 60px;
    font-size: 9px;
  }
  
  .decision-item {
    flex-wrap: wrap;
    font-size: 9px;
    gap: 4px;
  }
  
  .decision-reason {
    margin-left: 0;
    width: 100%;
    text-align: right;
  }
  
  .node-index {
    font-size: 9px;
    padding: 1px 4px;
  }
}

</style>