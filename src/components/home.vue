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
            generating: chat.isGenerating,
            'has-background-execution': globalExecutionState.isExecuting && globalExecutionState.chatId === chat.id && currentChatIndex !== index,
            'chat-retrieval': chat.mode === 'retrieval',
            'chat-workflow': chat.mode === 'workflow',
            'chat-skill': chat.mode === 'skill'
          }"
          @click="switchChat(index)"
        >
          <div class="chat-item-header">
            <span class="chat-title">
              <div v-if="chat.mode === 'normal'" class="mode-icon" title="普通模式">
                <i class="fa fa-user-o"></i>
              </div>
              <div v-if="chat.mode === 'retrieval'" class="mode-icon" title="知识库模式">
                <i class="fa fa-book"></i>
              </div>
              <div v-else-if="chat.mode === 'workflow'" class="mode-icon" title="工作流模式">
                <i class="fa fa-stumbleupon"></i>
              </div>
              <div v-else-if="chat.mode === 'skill'" class="mode-icon" title="技能模式">
                <i class="fa fa-cubes"></i>
              </div>
              {{ chat.title || `聊天 ${index + 1}` }}
            </span>
            <div class="chat-item-right">
              <!-- 删除按钮 -->
              <div class="chat-actions" @click.stop="deleteChat(index)" title="删除聊天">
                <i class="fa fa-trash"></i>
              </div>
              <!-- 当前聊天的生成指示器 -->
              <div v-if="chat.isGenerating || shouldShowBackgroundExecution(chat, index)" 
               class="execution-indicator" 
               :title="chat.isGenerating ? '正在生成中...' : '后台执行中...'">
                <i class="fa fa-spinner fa-spin"></i>
              </div>
            </div>
          </div>
          <div class="chat-info">
            <span class="model-name">{{ getModelDisplayName(chat.config) }}</span>
            <span class="message-count">{{ chat.messages.length }} {{store.locales=="zh"?"条消息":"messages"}}</span>
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
      <div class="chat-header" ref="chatHeaderRef" @wheel="handleHeaderWheel">
        <input 
          v-model="currentChat.title" 
          :placeholder="store.locales=='zh' ? '输入聊天标题...' : 'Enter Chat Title...'"
          class="chat-title-input"
          @change="saveChats"
        />
        <select 
          v-model="currentChat.config.llmType" 
          @change="onModelTypeChange"
          class="model-select"
          title="模型类型"
          :disabled="isAnyExecuting"
        >
          <option v-for="type in store.AIconfig.llm.types" :value="type">
            {{ type.charAt(0).toUpperCase() + type.slice(1) }}
          </option>
        </select>
        <select 
          v-model="currentChat.config.model" 
          class="model-select"
          :disabled="!availableModels.length || isAnyExecuting"
          title="选择模型"
        >
          <option value="">select model</option>
          <option v-for="model in availableModels" :value="model">
            {{ model }}
          </option>
        </select>
        <div class="button" @click="refreshModels" title="刷新模型列表" :class="{ disabled: isAnyExecuting }">
          <i class="fa fa-refresh"></i>
        </div>
        <div class="header-right" @click="testCurrentModelConnection" title="test">
          <div class="status-indicator" :class="{ online: currentModelOnline, offline: !currentModelOnline }"></div>
        </div>
        <label class="checkbox-label">
          <input type="checkbox" v-model="currentChat.config.stream" :disabled="isAnyExecuting"> {{ store.locales=='zh' ? '流式' : 'Stream' }}
        </label>
        <label class="checkbox-label">
          <input type="checkbox" v-model="currentChat.config.think" :disabled="currentChat.config.llmType !== 'ollama' || isAnyExecuting"> {{ store.locales=='zh' ? '思考' : 'Think' }}
        </label>
        <div v-if="currentChat.mode === 'retrieval' && currentChat.config.kbPath" class="parameter" :title="store.locales=='zh' ? '知识库片段数量' : 'Knowledge Base Fragment Count'">
          <label>{{ currentChat.config.kbTopK || 5 }}</label>
          <input 
            type="range" 
            v-model.number="currentChat.config.kbTopK" 
            min="3" 
            max="20" 
            step="1"
            class="param-slider"
            :disabled="isAnyExecuting"
          >
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
            :disabled="isAnyExecuting"
          >
        </div>
        <div class="parameter" title="maxTokens">
          <label>{{ currentChat.config.maxTokens }}</label>
          <input 
            type="range" 
            v-model.number="currentChat.config.maxTokens" 
            min="2000" 
            max="30000" 
            step="100"
            class="param-slider"
            @input="currentChat.config.maxTokens = Math.floor(currentChat.config.maxTokens)"
            :disabled="isAnyExecuting"
          >
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
        <!-- 合并的消息显示 -->
        <div 
          v-for="(message, index) in currentChat.messages" 
          :key="index" 
          class="message-item"
          :class="{
            'user-message': message.role === 'user',
            'assistant-message': message.role === 'assistant',
            'system-message': message.role === 'system',
            'execution-message': message.executionType,
            'execution-running': message.isExecuting,
            'execution-workflow': message.executionType === 'workflow',
            'execution-skill': message.executionType === 'skill'
          }"
        >
          <div class="message-header">
            <span class="message-role">
              {{ getRoleDisplay(message.role) }}
              
              <!-- 统一的执行标识 -->
              <span v-if="message.executionType" class="execution-badge" :class="`execution-badge-${message.executionType}`">
                <i class="fa" :class="getExecutionIcon(message)"></i>
                {{ getExecutionTypeName(message) }}
                <span v-if="message.isExecuting && message.executionProgress" class="execution-progress">
                  {{ message.executionProgress.completed }}/{{ message.executionProgress.total }}
                </span>
              </span>
              
              <!-- 知识库标识 -->
              <span v-else-if="message.kbInfo?.relevantBlocks?.length" class="execution-badge execution-badge-retrieval">
                <i class="fa fa-book"></i>
                知识库
              </span>
              
              <!-- 打字动画 -->
              <div v-if="message.role === 'assistant' && index === currentChat.messages.length - 1 && !message.content && !message.isExecuting" class="typing-dots-inline">
                <span></span>
                <span></span>
                <span></span>
              </div>
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
          
          <!-- 图片预览区域 -->
          <div v-if="message.images && message.images.length > 0" class="image-preview-container">
            <div 
              v-for="(imageData, imgIndex) in message.images" 
              :key="imgIndex" 
              class="image-preview-item"
            >
              <img 
                :src="getImageSrc(imageData)" 
                alt="用户上传的图片"
                class="message-image"
                @click="openImagePreview(imageData)"
              />
              <div class="image-actions">
                <div class="image-action-button" @click.stop="removeImageFromMessage(index, imgIndex)" title="删除图片">
                  <i class="fa fa-times"></i>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 执行单元列表（技能步骤） -->
          <div v-if="message.executionUnits && message.executionUnits.length > 0" 
               class="execution-status-container" 
               :class="`execution-${message.executionType}`">
            
            <!-- 进度条 -->
            <div v-if="message.isExecuting" class="execution-progress-bar">
              <div 
                class="progress-fill" 
                :style="{ width: getExecutionProgress(message) + '%' }"
                :class="`progress-${message.executionType}`"
              ></div>
            </div>
            
            <!-- 执行单元列表 -->
            <div class="execution-unit-list scoll">
              <div 
                v-for="(unit, unitIndex) in message.executionUnits" 
                :key="unit.id"
                class="execution-unit-item"
                :class="[
                  `unit-${message.executionType}`,
                  {
                    'unit-pending': unit.status === 'pending',
                    'unit-running': unit.status === 'running',
                    'unit-success': unit.status === 'success',
                    'unit-error': unit.status === 'error'
                  }
                ]"
              >
                <div class="unit-header">
                  <div class="unit-header-left">
                    <i class="fa" :class="getUnitStatusIcon(unit.status)"></i>
                    
                    <!-- 技能步骤显示类型和描述 -->
                    <template v-if="message.executionType === 'skill'">
                      <span class="unit-type">
                        <i class="fa" :class="getStepTypeIcon(unit.stepType || '')"></i>
                        {{ getStepTypeDisplay(unit.stepType || '') }}
                      </span>
                      <span class="unit-description" :title="unit.description">
                        {{ unit.description }}
                      </span>
                    </template>
                    
                    <!-- 工作流节点显示 -->
                    <template v-else-if="message.executionType === 'workflow'">
                      <span class="unit-name">{{ (unit as WorkflowUnit).name || '' }}</span>
                      <span class="unit-type">{{ (unit as WorkflowUnit).nodeType || '' }}</span>
                    </template>
                    
                    <!-- 执行时间 -->
                    <span v-if="unit.endTime && unit.startTime" class="unit-duration">
                      {{ (unit.endTime - unit.startTime) }}ms
                    </span>
                  </div>
                  
                  <div class="unit-header-right">
                    <span class="unit-index">{{ unitIndex + 1 }}</span>
                  </div>
                </div>
                
                <!-- 单元详情区域 -->
                <div v-if="shouldShowUnitDetails(unit)" class="unit-details">
                  <!-- 推理过程 -->
                  <div v-if="unit.streamContent && unit.streamContent.length > 0" class="unit-stream-content">
                    <div class="details-content scoll">
                      {{ unit.streamContent }}
                    </div>
                  </div>
                  
                  <!-- 执行结果预览 -->
                  <div v-else-if="unit.result || unit.resultPreview" class="unit-result-preview">
                    <div class="details-content scoll">
                      {{ formatUnitResult(unit.resultPreview || unit.result) }}
                    </div>
                  </div>
                  
                  <!-- 决策信息 -->
                  <div v-if="(unit as WorkflowUnit).decisionInfo" class="unit-decision-info">
                    <i class="fa fa-code-branch"></i>
                    {{ (unit as WorkflowUnit).decisionInfo }}
                  </div>
                  
                  <!-- 错误信息 -->
                  <div v-if="unit.error" class="unit-error-message">
                    <i class="fa fa-exclamation-triangle"></i>
                    {{ unit.error }}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 知识库召回标签 -->
          <div v-if="message.role === 'assistant' && currentChat.mode === 'retrieval' && message.kbInfo?.relevantBlocks?.length" class="kb-tags-container">
            <div class="kb-tags-header" @click="toggleKbDetails(message)">
              <i class="fa" :class="showKbDetails[message.timestamp] ? 'fa-chevron-down' : 'fa-chevron-right'"></i>
              <span>{{ store.locales=='zh' ? '召回文件标签' : 'Knowledge Base Tags' }} ({{ message.kbInfo.relevantBlocks.length }}个)</span>
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
          <!-- 消息内容 -->
          <div v-if="!message.isExecuting || message.content" class="message-content" v-html="renderMarkdown(message.content)"></div>
          
          <!-- 执行统计 -->
          <div v-if="!message.isExecuting && message.executionStats" class="execution-stats" :class="`stats-${message.executionType}`">
            <div class="stats-header">
              <i class="fa fa-chart-bar"></i>
              {{ getStatsTitle(message) }}
            </div>
            <div class="stats-grid">
              <div class="stat-item">
                <span class="stat-label">{{ store.locales=='zh' ? '总数:' : 'Total:' }}</span>
                <span class="stat-value">{{ message.executionStats.total }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">{{ store.locales=='zh' ? '成功:' : 'Success:' }}</span>
                <span class="stat-value">{{ message.executionStats.success }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">{{ store.locales=='zh' ? '失败:' : 'Failed:' }}</span>
                <span class="stat-value">{{ message.executionStats.failed }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">{{ store.locales=='zh' ? '耗时:' : 'Time:' }}</span>
                <span class="stat-value">{{ message.executionStats.time }}ms</span>
              </div>
            </div>
            
            <!-- 错误汇总 -->
            <div v-if="message.executionStats.errors && message.executionStats.errors.length > 0" class="execution-error-summary">
              <i class="fa fa-exclamation-circle"></i>
              {{ store.locales=='zh' ? `有 ${message.executionStats.errors.length} 个执行单元失败` : `${message.executionStats.errors.length} unit(s) failed` }}
            </div>
          </div>
          
        </div>
      </div>
      
      <!-- 输入区域 -->
      <div class="input-area">
        <!-- 步骤指示器和统计信息 -->
        <div v-if="shouldShowExecution || connectionTestStatus || isExecuting || currentChat.isGenerating || retrievalStats" class="step-info-container">
          <!-- 聊天生成状态 - 普通对话时显示 -->
          <div v-if="currentChat.isGenerating && !isAnotherChatExecuting" class="step-indicator" :class="stepIndicatorClass">
            <i :class="stepIcon"></i> {{ currentStep }}
          </div>
          
          <!-- 连接测试状态 -->
          <div v-if="connectionTestStatus" class="step-indicator" :class="connectionTestClass">
            <i :class="connectionTestIcon"></i> {{ connectionTestStatus }}
          </div>
          
          <!-- 统一的执行状态 - 只在当前聊天有执行时显示（工作流/技能） -->
          <div v-if="shouldShowExecution" class="step-indicator" :class="`step-${currentExecutionType}`">
            <i class="fa" :class="getStepIcon()"></i>
            {{ getStepDescription() }}
          </div>
          
          <!-- 显示其他聊天后台执行提示 -->
          <div v-else-if="isAnyExecuting && globalExecutionState.chatId !== currentChat.id" class="step-indicator step-info">
            <i class="fa fa-info-circle"></i>
            {{ store.locales=='zh' ? '其他聊天正在后台执行中...' : 'Other chat executing in background...' }}
          </div>
          
          <!-- 右侧：检索统计信息 - 只在有检索结果且不是执行状态时显示 -->
          <div v-if="retrievalStats && !isExecuting && !shouldShowExecution" class="retrieval-stats">
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
        
        <!-- 图片预览区域 -->
        <div v-if="currentImages.length > 0" class="image-preview-area">
          <div class="image-preview-header">
            <span>{{store.locales === 'en' ? 'The uploaded image has been successfully added ' : '已上传图片'}} ({{ currentImages.length }})</span>
            <div class="clear-images-button" @click="clearAllImages" title="清除所有图片">
              <i class="fa fa-trash"></i>
            </div>
          </div>
          <div class="image-preview-list scoll">
            <div 
              v-for="(imageData, index) in currentImages" 
              :key="index" 
              class="image-preview-item-small"
            >
              <img 
                :src="getImageSrc(imageData)" 
                alt="预览图片"
                class="preview-image"
              />
              <div class="preview-actions">
                <div class="preview-action-button" @click="removeImage(index)" title="删除">
                  <i class="fa fa-times"></i>
                </div>
              </div>
              <div class="preview-filename" :title="getImageName(imageData)">
                {{ getImageName(imageData) }}
              </div>
            </div>
          </div>
        </div>
        
        <!-- 问答模式界面 -->
        <div v-if="showQuestionDialog" class="question-container">
          <div class="question-message">{{ currentQuestion }}</div>
          <div class="question-input-area">
            <textarea
              v-model="userAnswer"
              :placeholder="store.locales == 'zh' ? '请输入您的回答...' : 'Enter your answer...'"
              rows="3"
              class="question-textarea scoll"
              @keydown.enter.exact.prevent="submitUserAnswer"
              @keydown.enter.shift.exact.prevent
              ref="questionInputRef"
            ></textarea>
          </div>
          <div class="question-actions">
            <div class="button" @click="cancelUserAnswer" :title="store.locales=='zh' ? '取消' : 'Cancel'">
              <i class="fa fa-times"></i>
            </div>
            <div class="button" style="flex:1" @click="submitUserAnswer" :title="store.locales=='zh' ? '提交' : 'Submit'">
              <i class="fa fa-check"></i>
            </div>
          </div>
        </div>
        
        <!-- 普通输入模式 -->
        <div v-else class="input-container">
          <textarea
            v-model="inputText"
            :placeholder="getInputPlaceholder()"
            @keydown.enter.exact.prevent="sendMessage"
            @keydown.enter.shift.exact.prevent="inputText += '\n'"
            ref="textInput"
            class="message-input scoll"
            :disabled="isAnyExecuting"
            style="width:calc(100% - 20px)"
            rows="3"
          ></textarea>
          <div class="input-controls">
            <div v-if="showSidebar" class="button" @click="toggleSidebar" :title="store.locales=='zh' ? '隐藏侧边栏' : 'Hide Sidebar'">
              <i class="fa fa-chevron-left"></i>
            </div>
            <div v-if="!showSidebar" class="button" @click="toggleSidebar">
              <i class="fa fa-chevron-right"></i>
            </div>
            <div 
              class="button" 
              style="flex:1" 
              @click="sendMessage" 
              :disabled="isSendButtonDisabled"
              :class="{ 'send-disabled': isSendButtonDisabled }"
              :title="getSendButtonTitle()"
            >
              <i class="fa fa-play"></i>
            </div>
            <!-- 图片上传按钮 -->
            <div class="button" v-if="currentChat.mode === 'normal'" @click="triggerFileUpload" :title="store.locales=='zh' ? '上传图片' : 'Upload Image'" :class="{ disabled: isAnyExecuting }">
              <i class="fa fa-image"></i>
              <input 
                type="file" 
                ref="fileInput"
                @change="handleFileUpload"
                accept="image/*"
                multiple
                style="display: none;"
              />
            </div>
            
            <!-- 截图按钮 -->
            <div class="button" v-if="currentChat.mode === 'normal'" @click="takeScreenshot" :title="store.locales=='zh' ? '截图' : 'Take Screenshot'" :class="{ disabled: isAnyExecuting }">
              <i class="fa fa-camera"></i>
            </div>
            <div 
              class="button" 
              @click="stopCurrentGeneration" 
              v-if="isAnyExecuting" 
              :title="store.locales=='zh' ? '停止生成' : 'Stop Generation'"
            >
              <i class="fa fa-stop"></i>
            </div>
            <div class="button" @click="toggleTTS" :class="{ active: ttsEnabled }" :title="store.locales=='zh' ? '语音朗读' : 'Text-to-Speech'">
              <i class="fa fa-volume-up"></i>
            </div>
            <div 
              class="button" 
              @click="selectKnowledgeBase" 
              :class="{ active: currentChat.mode === 'retrieval' && currentChat.config.kbPath }" 
              :title="getKbButtonTitle()"
              :disabled="isAnyExecuting"
            >
              <i class="fa fa-book"></i>
            </div>

            <div 
              class="button"
              style="text-align: center;"
              @click="selectWorkflow"
              :class="{ 
                active: currentChat.mode === 'workflow' && currentChat.config.workflowPath,
                'execution-active': currentChat.mode === 'workflow' && isExecuting,
                'execution-error': workflowError
              }" 
              :title="getWorkflowButtonTitle()"
              :disabled="isAnyExecuting"
            >
              <i class="fa fa-stumbleupon"></i>
            </div>

            <div 
              class="button"
              style="text-align: center;"
              @click="toggleSkillMode"
              :class="{ 
                active: currentChat.mode === 'skill',
                'execution-active': currentChat.mode === 'skill' && isExecuting,
                'execution-loading': skillLoading
              }" 
              :title="getSkillButtonTitle()"
              :disabled="isAnyExecuting"
            >
              <i class="fa" :class="skillLoading ? 'fa-spinner fa-spin' : 'fa-cubes'"></i>
            </div>

            <div class="button" @click="clearCurrentChat" v-if="currentChat.messages.length > 0" :title="store.locales=='zh' ? '清空当前聊天' : 'Clear Current Chat'" :class="{ disabled: isAnyExecuting }">
              <i class="fa fa-trash"></i>
            </div>
            <div class="button" @click="exportChat" v-if="currentChat.messages.length > 0" :title="store.locales=='zh' ? '导出聊天为Markdown' : 'Export Chat as Markdown'">
              <i class="fa fa-download"></i>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 图片预览模态框 -->
    <div v-if="showImagePreview" class="image-preview-modal" @click="closeImagePreview">
      <div class="modal-content" @click.stop>
        <img :src="previewImageSrc" alt="预览图片" class="full-size-image" />
        <div class="modal-actions">
          <button class="modal-button" @click="downloadImage(previewImageSrc)" title="下载图片">
            <i class="fa fa-download"></i> <span>下载</span>
          </button>
          <button class="modal-button" @click="closeImagePreview" title="关闭">
            <i class="fa fa-times"></i> <span>关闭</span>
          </button>
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
import { AIUtils } from '../utils/ai-utils'
// 导入技能管理器
import { getSkillManager, type Skill, type SkillExecutionResult, type ExecutionStep } from '../utils/agentSkills'

const store = usestore()

// TypeScript 类型定义
type ChatMode = 'normal' | 'retrieval' | 'workflow' | 'skill'

interface RelevantBlock {
  label: string
  content: string
  similarity: number
  summaryScore?: number
  sliceScore?: number
  reverseScore?: number
}

// 统一的执行单元接口
interface ExecutionUnit {
  id: string | number
  status: 'pending' | 'running' | 'success' | 'error'
  
  // 技能步骤字段
  stepType?: string
  description?: string
  
  // 通用字段
  result?: any
  resultPreview?: string
  streamContent?: string
  error?: string
  
  // 时间信息
  startTime?: number
  endTime?: number
}

// 工作流单元接口（扩展自 ExecutionUnit）
interface WorkflowUnit extends ExecutionUnit {
  name?: string
  nodeType?: string
  decisionInfo?: string
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
  
  // 统一的执行相关字段
  executionType?: 'workflow' | 'skill'
  isExecuting?: boolean
  executionName?: string
  executionUnits?: (ExecutionUnit | WorkflowUnit)[]
  executionProgress?: {
    completed: number
    total: number
  }
  executionTime?: number
  executionStats?: {
    total: number
    success: number
    failed: number
    time: number
    errors?: Array<{id: string | number, name: string, error: string}>
  }
  
  // 添加图片支持
  images?: Array<string | Uint8Array | ArrayBuffer>
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
  mode: ChatMode  // 每个聊天的独立模式
}

interface RetrievalStats {
  totalBlocks: number
  returnedBlocks: number
  maxSimilarity: string
  averageSimilarity?: string
}

// ==================== 全局执行状态管理 ====================
const globalExecutionState = ref<{
  isExecuting: boolean
  executionType: 'workflow' | 'skill' | null
  chatId: string | null
  skillLoading: boolean
  currentStep: string
  stepIcon: string
  stepIndicatorClass: string
  workflowRunner: WorkflowRunner | null
  abortController: AbortController | null
}>({
  isExecuting: false,
  executionType: null,
  chatId: null,
  skillLoading: false,
  currentStep: '',
  stepIcon: '',
  stepIndicatorClass: '',
  workflowRunner: null,
  abortController: null
})

// 技能管理器实例
const skillManager = getSkillManager(store)

// 技能相关状态
const availableSkills = ref<Skill[]>([])
const matchedSkill = ref<Skill | null>(null)

// 响应式数据
const chats = ref<Chat[]>([createNewChatData()])
const currentChatIndex = ref(0)
const inputText = ref<string>('')
const showSidebar = ref(true)
const ttsEnabled = ref(false)
const autoScrollEnabled = ref(true)
const isUserScrolling = ref(false)
const scrollTimeout = ref<NodeJS.Timeout | null>(null)
const messageContainer = ref<HTMLElement | null>(null)
const showKbDetails = ref<Record<number, boolean>>({})

// 图片上传相关状态
const currentImages = ref<Array<string | Uint8Array | ArrayBuffer>>([])
const fileInput = ref<HTMLInputElement | null>(null)
const showImagePreview = ref(false)
const previewImageSrc = ref<string>('')
const previewImageData = ref<string | Uint8Array | ArrayBuffer>('')

// 状态变量
const retrievalStats = ref<RetrievalStats | null>(null)

// 连接测试状态
const connectionTestStatus = ref('')
const connectionTestIcon = ref('')
const connectionTestClass = ref('')
const connectionTestTimeout = ref<NodeJS.Timeout | null>(null)

// 工作流相关状态
const workflowError = ref(false)

// 用户问答相关状态
const pendingQuestions = ref<Record<string, {
  question: string
  resolve: (value: string) => void
  reject: (reason?: any) => void
  stepId: string
  timeout: NodeJS.Timeout
}>>({})

const showQuestionDialog = ref(false)
const currentQuestion = ref('')
const currentQuestionId = ref('')
const userAnswer = ref('')
const questionInputRef = ref<HTMLTextAreaElement | null>(null)

// ==================== 计算属性 ====================
const currentChat = computed(() => chats.value[currentChatIndex.value])
const currentModelOnline = computed(() => currentChat.value.online || false)

// 计算当前是否应该显示执行状态
const shouldShowExecution = computed(() => {
  return globalExecutionState.value.isExecuting && 
         globalExecutionState.value.chatId === currentChat.value.id
})

// 计算是否处于执行中
const isAnyExecuting = computed(() => globalExecutionState.value.isExecuting)

// 是否有其他聊天正在执行（不是当前聊天）
const isAnotherChatExecuting = computed(() => {
  return globalExecutionState.value.isExecuting && globalExecutionState.value.chatId !== currentChat.value.id
})

// 当前聊天是否在执行中
const isExecuting = computed(() => {
  const hasExecutingMessage = currentChat.value.messages.some(msg => msg.isExecuting === true)
  const isGenerating = currentChat.value.isGenerating === true
  const isGlobalExecutingForThisChat = globalExecutionState.value.isExecuting && 
                                       globalExecutionState.value.chatId === currentChat.value.id
  
  return hasExecutingMessage || isGenerating || isGlobalExecutingForThisChat
})

const skillLoading = computed({
  get: () => globalExecutionState.value.skillLoading,
  set: (value) => { globalExecutionState.value.skillLoading = value }
})

const currentExecutionType = computed({
  get: () => globalExecutionState.value.executionType,
  set: (value) => { globalExecutionState.value.executionType = value }
})

const currentStep = computed({
  get: () => globalExecutionState.value.currentStep,
  set: (value) => { globalExecutionState.value.currentStep = value }
})

const stepIcon = computed({
  get: () => globalExecutionState.value.stepIcon,
  set: (value) => { globalExecutionState.value.stepIcon = value }
})

const stepIndicatorClass = computed({
  get: () => globalExecutionState.value.stepIndicatorClass,
  set: (value) => { globalExecutionState.value.stepIndicatorClass = value }
})

const abortController = computed({
  get: () => globalExecutionState.value.abortController,
  set: (value) => { globalExecutionState.value.abortController = value }
})

const workflowRunner = computed({
  get: () => globalExecutionState.value.workflowRunner,
  set: (value) => { globalExecutionState.value.workflowRunner = value }
})

const isSendButtonDisabled = computed(() => {
  const chat = currentChat.value
  
  return Boolean(
    chat.isGenerating ||
    (!inputText.value.trim() && currentImages.value.length === 0) ||
    !chat.config.model ||
    isAnyExecuting.value
  )
})

const availableModels = computed(() => {
  const llmType = currentChat.value.config.llmType
  const config = store.AIconfig.llm
  
  switch(llmType) {
    case 'llama':
      return config.llama.availableModels.map(m => m.name) || []
    case 'ollama':
      return config.ollama.available_models || []
    case 'lmstudio':
      return config.lmstudio?.available_models || []
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

const chatHeaderRef = ref<HTMLElement | null>(null)

// ==================== 辅助函数 ====================

// 判断是否应该显示后台执行指示器
const shouldShowBackgroundExecution = (chat: Chat, index: number) => {
  return globalExecutionState.value.isExecuting && 
         globalExecutionState.value.chatId === chat.id && 
         currentChatIndex.value !== index
}

// 合并重复标签
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
        if (!existing.contents.includes(block.content)) {
          existing.contents.push(block.content)
        }
      }
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

// 图片处理相关函数
const getImageSrc = (imageData: string | Uint8Array | ArrayBuffer): string => {
  if (typeof imageData === 'string') {
    if (imageData.startsWith('data:')) {
      return imageData
    }
    return `data:image/jpeg;base64,${imageData}`
  } else if (imageData instanceof Uint8Array || imageData instanceof ArrayBuffer) {
    const bytes = imageData instanceof Uint8Array ? imageData : new Uint8Array(imageData)
    const binary = bytes.reduce((acc, byte) => acc + String.fromCharCode(byte), '')
    const base64 = btoa(binary)
    return `data:image/jpeg;base64,${base64}`
  }
  return ''
}

const getImageName = (imageData: any): string => {
  if (imageData.name && imageData.size) {
    return imageData.name
  }
  return `image_${Date.now()}.jpg`
}

// 获取知识库按钮标题
const getKbButtonTitle = (): string => {
  if (currentChat.value.mode !== 'retrieval') {
    return store.locales=='zh' ? '点击切换到知识库模式' : 'Click to switch to retrieval mode'
  }
  
  const kbPath = currentChat.value.config.kbPath
  if (!kbPath) {
    return store.locales=='zh' ? '选择知识库文件' : 'Select knowledge base file'
  }
  
  const fileName = kbPath.split(/[\\/]/).pop() || kbPath
  return store.locales=='zh' ? `已关联: ${fileName}` : `Linked: ${fileName}`
}

// 获取工作流按钮标题
const getWorkflowButtonTitle = (): string => {
  if (currentChat.value.mode !== 'workflow') {
    return store.locales=='zh' ? '点击切换到工作流模式' : 'Click to switch to workflow mode'
  }
  
  const workflowPath = currentChat.value.config.workflowPath
  if (!workflowPath) {
    return store.locales=='zh' ? '选择工作流文件' : 'Select workflow file'
  }
  
  const fileName = workflowPath.split(/[\\/]/).pop() || workflowPath
  let title = store.locales=='zh' ? `工作流: ${fileName}` : `Workflow: ${fileName}`
  
  if (isExecuting.value && currentExecutionType.value === 'workflow') {
    title += store.locales=='zh' ? ' (运行中)' : ' (Running)'
  } else if (workflowError.value) {
    title += store.locales=='zh' ? ' (有错误)' : ' (Error)'
  }
  
  return title
}

// 获取技能按钮标题
const getSkillButtonTitle = (): string => {
  if (currentChat.value.mode !== 'skill') {
    return store.locales=='zh' ? '点击切换到技能模式' : 'Click to switch to skill mode'
  }
  
  if (skillLoading.value) {
    return store.locales=='zh' ? '技能执行中...' : 'Skill executing...'
  }
  
  const count = availableSkills.value.length
  return store.locales=='zh' 
    ? `技能模式 (已加载 ${count} 个技能)` 
    : `Skill Mode (${count} skills loaded)`
}

// 获取输入框占位符
const getInputPlaceholder = (): string => {
  switch (currentChat.value.mode) {
    case 'skill':
      return store.locales == 'zh' 
        ? '输入需求，AI将自动使用技能... (Enter发送，Shift+Enter换行)'
        : 'Enter your request, AI will use skills automatically... (Enter to send, Shift+Enter for new line)';
    case 'workflow':
      return store.locales == 'zh' 
        ? '输入工作流起始文本... (Enter发送，Shift+Enter换行)'
        : 'Enter workflow start text... (Enter to send, Shift+Enter for new line)';
    case 'retrieval':
      return store.locales == 'zh'
        ? '输入问题，将检索知识库后回答... (Enter发送，Shift+Enter换行)'
        : 'Enter question, will retrieve from knowledge base... (Enter to send, Shift+Enter for new line)';
    default:
      if (currentImages.value.length > 0) {
        return store.locales == 'zh'
          ? '输入图片描述... (Enter发送，Shift+Enter换行)'
          : 'Enter image description... (Enter to send, Shift+Enter for new line)';
      }
      return store.locales == 'zh'
        ? '输入消息... (Enter发送，Shift+Enter换行)'
        : 'Enter message... (Enter to send, Shift+Enter for new line)';
  }
}

// 获取发送按钮标题
const getSendButtonTitle = (): string => {
  if (skillLoading.value) {
    return 'Skill executing...'
  }
  if (isExecuting.value) {
    return 'Executing...'
  }
  switch (currentChat.value.mode) {
    case 'skill':
      return store.locales == 'zh' ? '执行技能 (Enter)' : 'Execute skill (Enter)'
    case 'workflow':
      return 'Run workflow (Enter)'
    case 'retrieval':
      return '检索并回答 (Enter)'
    default:
      if (currentImages.value.length > 0) {
        return store.locales == 'zh' ? '发送图片消息 (Enter)' : 'Send image message (Enter)'
      }
      return 'Send (Enter)'
  }
}

// Markdown 渲染函数
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
  const hue = Math.round(similarity * 120)
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

// 处理头部滚轮事件
const handleHeaderWheel = (event: WheelEvent) => {
  const header = chatHeaderRef.value
  if (header) {
    header.scrollLeft += event.deltaY
    event.preventDefault()
  }
}

// 设置连接测试状态
const setConnectionTestStatus = (status: string, isSuccess: boolean) => {
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
  
  connectionTestTimeout.value = setTimeout(() => {
    connectionTestStatus.value = ''
    connectionTestTimeout.value = null
  }, 5000)
}

// ==================== 统一的执行相关辅助函数 ====================

// 获取执行图标
const getExecutionIcon = (message: ChatMessage): string => {
  if (message.isExecuting) {
    return 'fa-spinner fa-spin'
  }
  return message.executionType === 'workflow' ? 'fa-stumbleupon' : 'fa-cubes'
}

// 获取执行类型名称
const getExecutionTypeName = (message: ChatMessage): string => {
  if (message.executionType === 'workflow') {
    return store.locales == 'zh' ? '工作流' : 'Workflow'
  }
  if (message.executionType === 'skill') {
    return message.executionName || (store.locales == 'zh' ? '技能' : 'Skill')
  }
  return ''
}

// 获取执行进度百分比
const getExecutionProgress = (message: ChatMessage): number => {
  if (!message.executionProgress) return 0
  const { completed, total } = message.executionProgress
  return total > 0 ? (completed / total) * 100 : 0
}

// 获取单元状态图标
const getUnitStatusIcon = (status: string): string => {
  const icons: Record<string, string> = {
    'pending': 'fa-clock-o',
    'running': 'fa-spinner fa-spin',
    'success': 'fa-check-circle',
    'error': 'fa-exclamation-circle'
  }
  return icons[status] || 'fa-question-circle'
}

// 获取步骤类型显示文本
const getStepTypeDisplay = (type: string): string => {
  if (store.locales === 'en') {
    const types: Record<string, string> = {
      'think': 'Think',
      'web_search': 'Search',
      'web_fetch': 'Fetch',
      'read_file': 'Read File',
      'write_file': 'Write File',
      'run_python': 'Python',
      'ask_user': 'Ask User',
      'replan': 'Replan',
      'respond': 'Respond',
      'planning': 'Planning',
      'matching': 'Matching'
    }
    return types[type] || type
  } else {
    const types: Record<string, string> = {
      'think': '思考',
      'web_search': '搜索',
      'web_fetch': '网页',
      'read_file': '读取文件',
      'write_file': '写入文件',
      'run_python': 'Python',
      'ask_user': '询问用户',
      'replan': '重新规划',
      'respond': '响应',
      'planning': '规划',
      'matching': '匹配'
    }
    return types[type] || type
  }
}

// 获取步骤类型图标
const getStepTypeIcon = (type: string): string => {
  const icons: Record<string, string> = {
    'think': 'fa-user-o',
    'web_search': 'fa-search',
    'web_fetch': 'fa-globe',
    'read_file': 'fa-file-text-o',
    'write_file': 'fa-file-text-o',
    'run_python': 'fa-code',
    'ask_user': 'fa-question-circle',
    'replan': 'fa-refresh',
    'respond': 'fa-reply',
    'planning': 'fa-tasks',
    'matching': 'fa-search'
  }
  return icons[type] || 'fa-cog'
}

// 判断是否应该显示单元详情
const shouldShowUnitDetails = (unit: ExecutionUnit | WorkflowUnit): boolean => {
  // 如果是 respond 步骤类型，不显示详情
  if (unit.stepType === 'respond') {
    return false
  }
  
  return !!(
    (unit.streamContent && unit.streamContent.length > 0) || 
    unit.result || 
    unit.resultPreview || 
    unit.error ||
    (unit as WorkflowUnit).decisionInfo
  )
}

// 格式化单元结果
const formatUnitResult = (result: any): string => {
  if (typeof result === 'string') {
    return result.length > 1000 ? result.substring(0, 1000) + '...' : result
  }
  if (typeof result === 'object') {
    const str = JSON.stringify(result, null, 2)
    return str.length > 1000 ? str.substring(0, 1000) + '...' : str
  }
  return String(result)
}

// 获取统计标题
const getStatsTitle = (message: ChatMessage): string => {
  if (message.executionType === 'workflow') {
    return store.locales == 'zh' ? '工作流执行统计' : 'Workflow Stats'
  } else {
    return store.locales == 'zh' ? '技能执行统计' : 'Skill Stats'
  }
}

// 获取步骤图标
const getStepIcon = (): string => {
  if (skillLoading.value) return 'fa-spinner fa-spin'
  if (currentExecutionType.value === 'workflow') return 'fa-stumbleupon fa-spin'
  if (currentExecutionType.value === 'skill') return 'fa-cubes fa-spin'
  return 'fa-spinner fa-spin'
}

// 获取步骤描述
const getStepDescription = (): string => {
  if (skillLoading.value) {
    return currentStep.value || (store.locales == 'zh' ? '正在执行技能...' : 'Executing skill...')
  }
  if (currentExecutionType.value === 'workflow') {
    return currentStep.value || (store.locales == 'zh' ? '工作流执行中...' : 'Workflow running...')
  }
  if (currentExecutionType.value === 'skill') {
    return currentStep.value || (store.locales == 'zh' ? '技能执行中...' : 'Skill executing...')
  }
  return currentStep.value || (store.locales == 'zh' ? '执行中...' : 'Executing...')
}

// ==================== 图片上传相关方法 ====================

const triggerFileUpload = () => {
  if (fileInput.value) {
    fileInput.value.click()
  }
}

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const files = target.files
  
  if (!files || files.length === 0) return
  
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      if (!file.type.startsWith('image/')) {
        alert(`文件 ${file.name} 不是图片类型`)
        continue
      }
      
      if (file.size > 5 * 1024 * 1024) {
        alert(`文件 ${file.name} 大小超过5MB限制`)
        continue
      }
      
      const base64String = await AIUtils.imageToBase64(file)
      currentImages.value.push(base64String)
    }
    
    target.value = ''
    
    if (currentImages.value.length > 0 && !inputText.value.trim()) {
      const textInput = document.querySelector('.message-input') as HTMLTextAreaElement
      if (textInput) {
        textInput.focus()
      }
    }
    
  } catch (error) {
    console.error('图片上传失败:', error)
    alert('图片上传失败，请重试')
  }
}

const removeImage = (index: number) => {
  currentImages.value.splice(index, 1)
}

const clearAllImages = () => {
  currentImages.value = []
}

const openImagePreview = (imageData: string | Uint8Array | ArrayBuffer) => {
  previewImageSrc.value = getImageSrc(imageData)
  previewImageData.value = imageData
  showImagePreview.value = true
}

const closeImagePreview = () => {
  showImagePreview.value = false
  previewImageSrc.value = ''
  previewImageData.value = ''
}

const downloadImage = (imageSrc: string) => {
  const link = document.createElement('a')
  link.href = imageSrc
  link.download = `screenshot_${Date.now()}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const removeImageFromMessage = (messageIndex: number, imageIndex: number) => {
  const message = currentChat.value.messages[messageIndex]
  if (message.images) {
    message.images.splice(imageIndex, 1)
    if (message.images.length === 0) {
      delete message.images
    }
    saveChats()
  }
}

// 截图功能
const takeScreenshot = async () => {
  try {
    let imageData: string | Uint8Array | ArrayBuffer
    
    if (typeof window !== 'undefined' && (window as any).ipcRenderer) {
      imageData = await window.ipcRenderer.invoke('captureRegion')
    } else if (navigator.mediaDevices?.getDisplayMedia) {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      })
      
      const video = document.createElement('video')
      video.srcObject = stream
      await video.play()
      
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        imageData = canvas.toDataURL('image/png')
      } else {
        throw new Error('无法创建2D上下文')
      }
      
      stream.getTracks().forEach(track => track.stop())
    } else {
      alert('当前环境不支持截图功能')
      return
    }
    
    if (imageData) {
      currentImages.value.push(imageData)
    }
  } catch (error) {
    console.error('截图失败:', error)
    alert('截图失败，请确保您已允许截图权限')
  }
}

// ==================== 初始化 ====================

onMounted(async () => {
  loadChatsFromStorage()
  checkCurrentModelConnection()
  
  // 监听 store.skillsPath 的变化
  watch(() => store.skillsPath, async (newPath) => {
    // 只在当前聊天为技能模式时加载技能
    if (currentChat.value.mode === 'skill' && newPath) {
      await loadSkills()
    }
  })
  
  watch(() => currentChat.value.messages.length, () => {
    if (currentChat.value.isGenerating || isExecuting.value) {
      scrollToBottom()
    }
  }, { immediate: true })
  
  watch(() => currentChat.value.isGenerating, (newVal) => {
    if (newVal) {
      autoScrollEnabled.value = true
      scrollToBottom()
      // 设置初始步骤
      if (!globalExecutionState.value.currentStep) {
        setStep(store.locales == 'zh' ? '正在生成回复...' : 'Generating response...', 'fa fa-refresh fa-spin', 'step-generating')
      }
    } else {
      // 不清空步骤，让 onComplete 处理
    }
  })
  
  watch(() => currentChat.value.config, (newConfig) => {
    currentChat.value.online = false
    saveChats()
  }, { deep: true })
  
  watch(() => isExecuting.value, (newVal) => {
    if (newVal) {
      autoScrollEnabled.value = true
      scrollToBottom()
    }
  })

  // 如果当前聊天是技能模式，加载技能
  if (currentChat.value.mode === 'skill') {
    await loadSkills()
  }
})

onBeforeUnmount(() => {
  store.saveConfig()
  if (scrollTimeout.value) {
    clearTimeout(scrollTimeout.value)
  }
  if (connectionTestTimeout.value) {
    clearTimeout(connectionTestTimeout.value)
  }
  stopExecution()
})

// ==================== 技能相关函数 ====================

// 加载技能
const loadSkills = async (forceRefresh: boolean = false) => {
  if (!store.skillsPath) {
    //console.warn('技能路径未配置')
    return
  }
  
  if (!forceRefresh && availableSkills.value.length > 0) {
    //console.log('技能已加载，跳过扫描')
    return
  }
  
  skillLoading.value = true
  try {
    availableSkills.value = await skillManager.loadSkills(store.skillsPath)
    
    if (availableSkills.value.length > 0) {
      const skillNames = availableSkills.value.map(s => s.name).join(', ')
      //console.log(`可用技能: ${skillNames}`)
      
      globalExecutionState.value.currentStep = store.locales == 'zh' 
        ? `已加载 ${availableSkills.value.length} 个技能`
        : `Loaded ${availableSkills.value.length} skills`
      globalExecutionState.value.stepIcon = 'fa fa-check-circle'
      globalExecutionState.value.stepIndicatorClass = 'step-success'
      
      setTimeout(() => {
        if (globalExecutionState.value.currentStep.includes('技能') || globalExecutionState.value.currentStep.includes('skill')) {
          globalExecutionState.value.currentStep = ''
        }
      }, 3000)
    } else {
      console.warn('未找到任何技能文件')
      globalExecutionState.value.currentStep = store.locales == 'zh' 
        ? '未找到技能文件'
        : 'No skills found'
      globalExecutionState.value.stepIcon = 'fa fa-exclamation-triangle'
      globalExecutionState.value.stepIndicatorClass = 'step-error'
      
      setTimeout(() => {
        if (globalExecutionState.value.currentStep.includes('技能') || globalExecutionState.value.currentStep.includes('skill')) {
          globalExecutionState.value.currentStep = ''
        }
      }, 3000)
    }
  } catch (error) {
    console.error('加载技能失败:', error)
    globalExecutionState.value.currentStep = store.locales == 'zh' 
      ? '技能加载失败'
      : 'Skill loading failed'
    globalExecutionState.value.stepIcon = 'fa fa-exclamation-circle'
    globalExecutionState.value.stepIndicatorClass = 'step-error'
    
    setTimeout(() => {
      if (globalExecutionState.value.currentStep.includes('技能') || globalExecutionState.value.currentStep.includes('skill')) {
        globalExecutionState.value.currentStep = ''
      }
    }, 3000)
    
    availableSkills.value = []
  } finally {
    skillLoading.value = false
  }
}

// 切换技能模式 - 为当前聊天设置模式
const toggleSkillMode = async () => {
  // 如果已经是技能模式，切换到普通模式
  if (currentChat.value.mode === 'skill') {
    currentChat.value.mode = 'normal'
    // 清除工作流和知识库相关配置
    currentChat.value.config.workflowPath = undefined
    currentChat.value.config.workflowData = undefined
    currentChat.value.config.kbPath = undefined
    return
  }
  
  // 切换到技能模式
  if (!store.skillsPath) {
    console.warn('未设置技能路径，请先在配置中设置技能目录')
    if (store.locales == 'zh') {
      alert('请先在配置中设置技能目录路径')
    } else {
      alert('Please set the skills directory path in configuration')
    }
    return
  }
  
  // 设置当前聊天为技能模式
  currentChat.value.mode = 'skill'
  // 清除其他模式的配置
  currentChat.value.config.workflowPath = undefined
  currentChat.value.config.workflowData = undefined
  currentChat.value.config.kbPath = undefined
  
  globalExecutionState.value.currentStep = store.locales == 'zh' 
    ? '正在扫描技能...' 
    : 'Scanning skills...'
  globalExecutionState.value.stepIcon = 'fa fa-search fa-spin'
  globalExecutionState.value.stepIndicatorClass = 'step-skill-matching'
  
  await loadSkills(true)
  
  setTimeout(() => {
    if (globalExecutionState.value.currentStep.includes('技能') || globalExecutionState.value.currentStep.includes('skill')) {
      globalExecutionState.value.currentStep = ''
    }
  }, 2000)
  
  saveChats()
}

// ==================== 知识库模式切换 ====================

const selectKnowledgeBase = async () => {
  // 如果已经是检索模式，可以选择新的知识库或退出
  if (currentChat.value.mode === 'retrieval') {
    try {
      const filePath = await window.ipcRenderer.invoke('selectFile')
      if (filePath == null) {
        // 如果取消选择，退出检索模式
        currentChat.value.mode = 'normal'
        currentChat.value.config.kbPath = undefined
      } else if (filePath && filePath.endsWith('.kb')) {
        currentChat.value.config.kbPath = filePath
        if (currentChat.value.config.kbTopK === undefined) {
          currentChat.value.config.kbTopK = 5
        }
        console.log(`已关联知识库: ${filePath}`)
      } else if (filePath && !filePath.endsWith('.kb')) {
        alert('请选择.kb格式的知识库文件')
        return
      }
    } catch (error) {
      console.error('选择知识库文件失败:', error)
    }
  } else {
    // 切换到检索模式
    try {
      const filePath = await window.ipcRenderer.invoke('selectFile')
      if (filePath && filePath.endsWith('.kb')) {
        currentChat.value.mode = 'retrieval'
        // 清除其他模式的配置
        currentChat.value.config.workflowPath = undefined
        currentChat.value.config.workflowData = undefined
        currentChat.value.config.kbPath = filePath
        if (currentChat.value.config.kbTopK === undefined) {
          currentChat.value.config.kbTopK = 5
        }
        console.log(`已关联知识库: ${filePath}`)
      } else if (filePath && !filePath.endsWith('.kb')) {
        alert('请选择.kb格式的知识库文件')
      }
    } catch (error) {
      console.error('选择知识库文件失败:', error)
    }
  }
  saveChats()
}

// ==================== 工作流模式切换 ====================

const selectWorkflow = async () => {
  // 如果已经是工作流模式，可以选择新的工作流或退出
  if (currentChat.value.mode === 'workflow') {
    try {
      const filePath = await window.ipcRenderer.invoke('selectFile', {
        filters: [
          { name: '工作流文件', extensions: ['flow', 'json'] },
          { name: '所有文件', extensions: ['*'] }
        ]
      })
      
      if (filePath == null) {
        // 如果取消选择，退出工作流模式
        currentChat.value.mode = 'normal'
        currentChat.value.config.workflowPath = undefined
        currentChat.value.config.workflowData = undefined
        workflowError.value = false
      } else if (filePath && (filePath.endsWith('.flow') || filePath.endsWith('.json'))) {
        await loadWorkflowFile(filePath)
      } else if (filePath && !filePath.endsWith('.flow') && !filePath.endsWith('.json')) {
        alert('请选择.flow或.json格式的工作流文件')
      }
    } catch (error: any) {
      console.error('选择工作流文件失败:', error)
    }
  } else {
    // 切换到工作流模式
    try {
      const filePath = await window.ipcRenderer.invoke('selectFile', {
        filters: [
          { name: '工作流文件', extensions: ['flow', 'json'] },
          { name: '所有文件', extensions: ['*'] }
        ]
      })
      
      if (filePath && (filePath.endsWith('.flow') || filePath.endsWith('.json'))) {
        currentChat.value.mode = 'workflow'
        // 清除其他模式的配置
        currentChat.value.config.kbPath = undefined
        await loadWorkflowFile(filePath)
      } else if (filePath && !filePath.endsWith('.flow') && !filePath.endsWith('.json')) {
        alert('请选择.flow或.json格式的工作流文件')
      }
    } catch (error: any) {
      console.error('选择工作流文件失败:', error)
    }
  }
  saveChats()
}

const loadWorkflowFile = async (filePath: string) => {
  try {
    const content = await window.ipcRenderer.invoke('readFile', filePath)
    const workflowData = JSON.parse(content)
    
    if (!workflowData.items || !Array.isArray(workflowData.items)) {
      throw new Error('无效的工作流文件格式')
    }
    
    const startNode = workflowData.items.find((item: any) => item.type === 'start')
    const endNode = workflowData.items.find((item: any) => item.type === 'end')
    
    if (!startNode) {
      throw new Error('工作流缺少开始节点')
    }
    
    if (!endNode) {
      throw new Error('工作流缺少结束节点')
    }
    
    currentChat.value.config.workflowPath = filePath
    currentChat.value.config.workflowData = workflowData
    workflowError.value = false
    
    initWorkflowRunner()
    
    if (startNode.prompt && startNode.prompt.trim()) {
      inputText.value = startNode.prompt
    } else {
      inputText.value = ''
    }
    
    console.log(`已加载工作流: ${filePath}`)
    
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
    
  } catch (error: any) {
    console.error('加载工作流失败:', error)
    alert(`加载工作流失败: ${error.message}`)
    currentChat.value.config.workflowPath = undefined
    currentChat.value.config.workflowData = undefined
    workflowError.value = true
  }
}

// ==================== 技能帮助和列表处理函数 ====================

// 处理技能帮助请求
const handleSkillHelp = async (skillName: string) => {
  try {
    const helpContent = await skillManager.getSkillHelp(skillName)
    
    const helpMessage: ChatMessage = {
      role: 'assistant',
      content: helpContent,
      timestamp: Date.now()
    }
    
    currentChat.value.messages.push(helpMessage)
    
    if (ttsEnabled.value) {
      store.tts(helpContent.substring(0, 200))
    }
    
    scrollToBottom()
    saveChats()
    
  } catch (error: any) {
    console.error('获取技能帮助失败:', error)
    
    const errorMessage: ChatMessage = {
      role: 'assistant',
      content: `获取技能帮助失败: ${error.message}`,
      timestamp: Date.now()
    }
    
    currentChat.value.messages.push(errorMessage)
    scrollToBottom()
  }
}

// 处理技能列表请求
const handleSkillList = async () => {
  const skills = skillManager.getSkills()
  
  if (skills.length === 0) {
    const noSkillsMessage: ChatMessage = {
      role: 'assistant',
      content: store.locales == 'zh' 
        ? '📋 当前没有可用的技能。请先在配置中设置技能目录路径。' 
        : '📋 No skills available. Please set the skills directory path in configuration.',
      timestamp: Date.now()
    }
    currentChat.value.messages.push(noSkillsMessage)
  } else {
    let listContent = store.locales == 'zh' 
      ? `📋 **当前可用的技能列表（共 ${skills.length} 个）**\n\n` 
      : `📋 **Available Skills (${skills.length})**\n\n`
    
    skills.forEach((skill, index) => {
      listContent += `### ${index + 1}. ${skill.name}\n`
      listContent += `> ${skill.description}\n`
      
      if (skill.metadata.tags && skill.metadata.tags.length > 0) {
        listContent += `> ${store.locales == 'zh' ? '标签:' : 'Tags: '} \`${skill.metadata.tags.join('`, `')}\`\n`
      }
      
      if (skill.files && skill.files.length > 0) {
        listContent += `>  ${skill.files.length} ${store.locales == 'zh' ? '个文件' : 'Files'}\n`
      }
      
      listContent += '\n'
    })
    
    const listMessage: ChatMessage = {
      role: 'assistant',
      content: listContent,
      timestamp: Date.now()
    }
    
    currentChat.value.messages.push(listMessage)
  }
  
  scrollToBottom()
  saveChats()
}

// ==================== 停止执行函数 ====================

const stopExecution = () => {
  //console.log('停止执行')
  
  if (globalExecutionState.value.workflowRunner) {
    globalExecutionState.value.workflowRunner.stop()
  }
  
  if (globalExecutionState.value.abortController) {
    globalExecutionState.value.abortController.abort()
  }
  
  globalExecutionState.value = {
    isExecuting: false,
    executionType: null,
    chatId: null,
    skillLoading: false,
    currentStep: '',
    stepIcon: '',
    stepIndicatorClass: '',
    workflowRunner: null,
    abortController: null
  }
  
  chats.value.forEach(chat => {
    const executingMessage = chat.messages.find(msg => msg.isExecuting)
    if (executingMessage) {
      executingMessage.isExecuting = false
      executingMessage.content = store.locales=='zh' ? '执行已停止' : 'Execution stopped'
    }
  })
  
  nextTick(() => {
    //console.log('停止执行后状态:', globalExecutionState.value)
  })
  
  saveChats()
}

const setStep = (step: string, icon: string, stepClass: string) => {
  globalExecutionState.value.currentStep = step
  globalExecutionState.value.stepIcon = icon
  globalExecutionState.value.stepIndicatorClass = stepClass
}

// ==================== 保存和加载聊天 ====================

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
        // 兼容旧数据：如果没有mode字段，根据配置推断
        if (chat.mode === undefined) {
          if (chat.config.workflowPath) {
            chat.mode = 'workflow'
          } else if (chat.config.kbPath) {
            chat.mode = 'retrieval'
          } else {
            chat.mode = 'normal'
          }
        }
        
        if (chat.online === undefined) chat.online = false
        if (chat.config.functionIndex === undefined) chat.config.functionIndex = 0
        if (chat.config.kbTopK === undefined && chat.config.kbPath) {
          chat.config.kbTopK = 5
        }
        if (chat.isGenerating === undefined) chat.isGenerating = false
        
        // 兼容旧数据 - 使用类型断言处理可能的旧字段
        chat.messages.forEach((msg: any) => {
          // 将旧的工作流字段转换为新格式
          if (msg.isWorkflowRunning || msg.workflowResult) {
            msg.executionType = 'workflow'
            msg.isExecuting = msg.isWorkflowRunning
            if (msg.workflowStats) {
              msg.executionStats = {
                total: msg.workflowStats.totalNodes,
                success: msg.workflowStats.completedNodes,
                failed: msg.workflowStats.failedNodes,
                time: msg.workflowStats.executionTime,
                errors: msg.workflowStats.errors
              }
            }
            delete msg.isWorkflowRunning
            delete msg.workflowResult
            delete msg.workflowStats
          }
          
          // 将旧的技能字段转换为新格式
          if (msg.isSkillRunning || msg.skillResult) {
            msg.executionType = 'skill'
            msg.isExecuting = msg.isSkillRunning
            msg.executionName = msg.skillName
            if (msg.skillSteps) {
              msg.executionUnits = msg.skillSteps.map((step: any) => ({
                id: step.id,
                status: step.status,
                stepType: step.type,
                description: step.description,
                result: step.result,
                error: step.error,
                startTime: step.startTime,
                endTime: step.endTime
              }))
            }
            if (msg.skillStats) {
              msg.executionStats = {
                total: msg.skillStats.totalSteps,
                success: msg.skillStats.successSteps,
                failed: msg.skillStats.failedSteps,
                time: msg.skillStats.executionTime
              }
            }
            delete msg.isSkillRunning
            delete msg.skillResult
            delete msg.skillName
            delete msg.skillSteps
            delete msg.skillStats
          }
        })
        
        if (chat.config.workflowPath && chat.config.workflowData && chat.mode === 'workflow') {
          setTimeout(() => {
            initWorkflowRunner()
          }, 100)
        }
      })
    } catch (e) {
      console.error('加载聊天记录失败:', e)
    }
  }
}

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
    isGenerating: false,
    mode: 'normal'  // 默认普通模式
  }
}

function getDefaultModel(llmType: string): string {
  switch(llmType) {
    case 'llama':
      return ''
    case 'ollama':
      return store.AIconfig.llm.ollama.model || ''
    case 'lmstudio':
      return store.AIconfig.llm.lmstudio?.model || ''
    case 'openai':
    case 'deepseek':
      return store.AIconfig.llm.openai.model || 'deepseek-chat'
    default:
      return ''
  }
}

const createNewChat = () => {
  currentImages.value = []
  chats.value.push(createNewChatData())
  currentChatIndex.value = chats.value.length - 1
  saveChats()
}

const switchChat = async (index: number) => {
  currentImages.value = []
  
  if (currentChatIndex.value === index) return
  
  currentChatIndex.value = index
  
  await checkCurrentModelConnection()
  
  // 根据当前聊天的模式初始化
  if (currentChat.value.mode === 'workflow' && currentChat.value.config.workflowPath && currentChat.value.config.workflowData) {
    initWorkflowRunner()
  } else if (currentChat.value.mode === 'skill') {
    await loadSkills()
  }
  
  // 清除临时状态
  retrievalStats.value = null
  globalExecutionState.value.currentStep = ''
}

const deleteChat = (index: number) => {
  if (chats.value.length <= 1) return
  
  if (globalExecutionState.value.isExecuting && globalExecutionState.value.chatId === chats.value[index].id) {
    if (!confirm(store.locales=='zh' ? '该聊天正在执行中，确定要删除吗？' : 'This chat is executing, are you sure you want to delete it?')) {
      return
    }
    stopExecution()
  }
  
  if (confirm('确定删除这个聊天吗？')) {
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

const clearCurrentChat = () => {
  if (confirm(store.locales == 'zh' ? '确定清空当前聊天记录吗？' : 'Are you sure you want to clear the current chat history?')) {
    if (isExecuting.value) {
      stopExecution()
    }
    
    currentChat.value.messages.forEach(msg => {
      delete showKbDetails.value[msg.timestamp]
    })
    
    currentImages.value = []
    currentChat.value.messages = []
    saveChats()
  }
}

// ==================== 模型相关函数 ====================

const onModelTypeChange = async () => {
  currentChat.value.config.model = getDefaultModel(currentChat.value.config.llmType)
  currentChat.value.online = false
  saveChats()
}

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

const testCurrentModelConnection = async () => {
  const config = currentChat.value.config
  
  if (!config.model) {
    setConnectionTestStatus(store.locales=='zh' ? '请先选择模型' : 'Please select a model', false)
    return
  }
  
  setConnectionTestStatus(store.locales=='zh' ? '正在测试连接...' : 'Testing connection...', true)
  connectionTestIcon.value = 'fa fa-refresh fa-spin'
  connectionTestClass.value = 'step-testing'
  
  try {
    const originalType = store.AIconfig.llm.type
    const originalModel = getCurrentModelFromStore()
    
    store.AIconfig.llm.type = config.llmType
    updateStoreModelConfig(config)
    
    await store.getAIconfig()
    const isOnline = store.AIconfig.llm.online
    
    currentChat.value.online = isOnline
    
    store.AIconfig.llm.type = originalType
    if (originalType === config.llmType) {
      restoreStoreModelConfig(originalType, originalModel)
    }
    
    saveChats()
    
    if (isOnline) {
      setConnectionTestStatus(store.locales=='zh' ? `模型 ${config.model} 连接成功！` : `Model ${config.model} connected successfully!`, true)
    } else {
      setConnectionTestStatus(store.locales=='zh' ? `模型 ${config.model} 连接失败，请检查配置。` : `Model ${config.model} connection failed, please check the configuration.`, false)
    }
  } catch (error:any) {
    currentChat.value.online = false
    setConnectionTestStatus(store.locales=='zh' ? '连接测试失败: ' + error.message : 'Connection test failed: ' + error.message, false)
  }
}

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

const updateStoreModelConfig = (config: ChatConfig) => {
  const llmConfig = store.AIconfig.llm
  
  switch(config.llmType) {
    case 'llama':
      llmConfig.llama.modelName = config.model
      break
    case 'ollama':
      llmConfig.ollama.model = config.model
      break
    case 'lmstudio':
      if (llmConfig.lmstudio) {
        llmConfig.lmstudio.model = config.model
      }
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

const restoreStoreModelConfig = (type: string, model: string) => {
  const llmConfig = store.AIconfig.llm
  
  switch(type) {
    case 'llama':
      llmConfig.llama.modelName = model
      break
    case 'ollama':
      llmConfig.ollama.model = model
      break
    case 'lmstudio':
      if (llmConfig.lmstudio) {
        llmConfig.lmstudio.model = model
      }
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

const getCurrentModelFromStore = (): string => {
  const llmConfig = store.AIconfig.llm
  
  switch(llmConfig.type) {
    case 'llama':
      return llmConfig.llama.modelName || ''
    case 'ollama':
      return llmConfig.ollama.model || ''
    case 'lmstudio':
      return llmConfig.lmstudio?.model || ''
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

// ==================== 用户问答处理 ====================

const onUserQuestion = (askId: string, question: string, 
                        resolve: (value: string) => void, 
                        reject: (reason?: any) => void) => {
  
  pendingQuestions.value[askId] = {
    question,
    resolve,
    reject,
    stepId: '',
    timeout: setTimeout(() => {
      if (pendingQuestions.value[askId]) {
        console.log('用户问题超时:', askId)
        delete pendingQuestions.value[askId]
        reject(new Error('用户等待超时'))
        if (showQuestionDialog.value && currentQuestionId.value === askId) {
          showQuestionDialog.value = false
        }
      }
    }, 3000000)
  }
  
  currentQuestionId.value = askId
  currentQuestion.value = question
  userAnswer.value = ''
  showQuestionDialog.value = true
  
  nextTick(() => {
    if (questionInputRef.value) {
      questionInputRef.value.focus()
    }
  })
}

const submitUserAnswer = () => {
  if (!userAnswer.value.trim()) {
    alert(store.locales == 'zh' ? '请输入回答' : 'Please enter your answer')
    return
  }
  
  const pending = pendingQuestions.value[currentQuestionId.value]
  if (pending) {
    clearTimeout(pending.timeout)
    pending.resolve(userAnswer.value)
    delete pendingQuestions.value[currentQuestionId.value]
  }
  
  showQuestionDialog.value = false
  userAnswer.value = ''
  
  nextTick(() => {
    const textInput = document.querySelector('.message-input') as HTMLTextAreaElement
    if (textInput) {
      textInput.focus()
    }
  })
}

const cancelUserAnswer = () => {
  const pending = pendingQuestions.value[currentQuestionId.value]
  if (pending) {
    clearTimeout(pending.timeout)
    pending.reject(new Error('用户取消了回答'))
    delete pendingQuestions.value[currentQuestionId.value]
  }
  
  showQuestionDialog.value = false
  userAnswer.value = ''
  
  nextTick(() => {
    const textInput = document.querySelector('.message-input') as HTMLTextAreaElement
    if (textInput) {
      textInput.focus()
    }
  })
}

// ==================== 发送消息 - 统一入口 ====================

const sendMessage = async () => {
  const message = inputText.value.trim()
  
  if (currentChat.value.isGenerating || isAnyExecuting.value) {
    return
  }
  
  if (!currentChat.value.config.model) {
    console.log('请先选择模型')
    return
  }
  
  if (!message && currentImages.value.length === 0) {
    console.log('请输入消息或上传图片')
    return
  }
  
  if (!currentChat.value.online) {
    if(!testCurrentModelConnection()){
      if (!confirm('模型未连接，是否继续发送？')) {
        return
      }
    }
  }

  // 根据当前聊天模式处理
  switch (currentChat.value.mode) {
    case 'skill':
      await handleSkillMode(message)
      break
    case 'workflow':
      await runWorkflow(message)
      break
    case 'retrieval':
      await sendChatMessage(message)
      break
    default:
      await sendChatMessage(message)
  }
}

// ==================== 技能模式处理 ====================

// 技能模式处理
const handleSkillMode = async (message: string) => {
  // 先创建用户消息
  const userMessage: ChatMessage = {
    role: 'user',
    content: message,
    timestamp: Date.now(),
    images: currentImages.value.length > 0 ? [...currentImages.value] : undefined
  }
  currentChat.value.messages.push(userMessage)
  
  // 清空输入和图片
  inputText.value = ''
  currentImages.value = []
  
  // 滚动到底部显示用户消息
  scrollToBottom()
  
  // 设置全局执行状态显示分析意图的指示器
  globalExecutionState.value = {
    ...globalExecutionState.value,
    isExecuting: true,
    executionType: 'skill',
    chatId: currentChat.value.id,
    skillLoading: true,
    currentStep: store.locales == 'zh' ? '正在分析意图...' : 'Analyzing intent...',
    stepIcon: 'fa fa-search fa-spin',
    stepIndicatorClass: 'step-skill-matching'
  }
  
  try {
    const matchResult = await skillManager.matchSkill(message)
    
    // 根据意图处理
    if (matchResult.intent === 'list') {
      // 清除执行状态
      globalExecutionState.value = {
        ...globalExecutionState.value,
        isExecuting: false,
        executionType: null,
        chatId: null,
        skillLoading: false,
        currentStep: '',
        stepIcon: '',
        stepIndicatorClass: ''
      }
      
      // 处理技能列表
      await handleSkillList()
      return
    }
    
    if (matchResult.intent === 'help' && matchResult.skillName) {
      // 清除执行状态
      globalExecutionState.value = {
        ...globalExecutionState.value,
        isExecuting: false,
        executionType: null,
        chatId: null,
        skillLoading: false,
        currentStep: '',
        stepIcon: '',
        stepIndicatorClass: ''
      }
      
      // 处理技能帮助
      await handleSkillHelp(matchResult.skillName)
      return
    }
    
    // execute 意图 - 无论是否匹配到技能都创建占位消息
    // 创建占位消息
    const placeholderMessage: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      executionType: 'skill',
      isExecuting: true,
      executionName: matchResult.skillName ? 
        (store.locales == 'zh' ? `正在执行技能: ${matchResult.skillName}` : `Executing skill: ${matchResult.skillName}`) :
        (store.locales == 'zh' ? '正在自主规划执行...' : 'Autonomous planning...'),
      executionUnits: [],
      executionProgress: { completed: 0, total: 0 }
    }
    currentChat.value.messages.push(placeholderMessage)
    
    autoScrollEnabled.value = true
    scrollToBottom()
    
    // 执行技能（skillName 可能为 null）
    await executeWithSkill(message, placeholderMessage, matchResult.skillName)
    
  } catch (error: any) {
    console.error('意图识别失败:', error)
    
    // 清除执行状态
    globalExecutionState.value = {
      ...globalExecutionState.value,
      isExecuting: false,
      executionType: null,
      chatId: null,
      skillLoading: false,
      currentStep: '',
      stepIcon: '',
      stepIndicatorClass: ''
    }
    
    // 即使识别失败，也尝试自主规划
    const placeholderMessage: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      executionType: 'skill',
      isExecuting: true,
      executionName: store.locales == 'zh' ? '正在自主规划执行...' : 'Autonomous planning...',
      executionUnits: [],
      executionProgress: { completed: 0, total: 0 }
    }
    currentChat.value.messages.push(placeholderMessage)
    
    autoScrollEnabled.value = true
    scrollToBottom()
    
    // 使用 null 作为技能名进行自主规划
    await executeWithSkill(message, placeholderMessage, null)
    
  } finally {
    // 保存聊天记录
    saveChats()
  }
}

// ==================== 技能执行函数 ====================

// 技能执行函数（现在也用于自主规划）
const executeWithSkill = async (userInput: string, placeholderMessage: ChatMessage, skillName: string | null) => {
  if (!placeholderMessage) {
    console.error('占位消息不存在')
    return
  }
  
  // 将传入的普通对象转换为 ref 对象
  const messageRef = ref<ChatMessage>(placeholderMessage)
  
  // 替换原数组中的消息为 ref 对象
  const messageIndex = currentChat.value.messages.findIndex(m => m.timestamp === placeholderMessage.timestamp)
  if (messageIndex !== -1) {
    currentChat.value.messages[messageIndex] = messageRef.value
  }
  
  // 初始化 executionUnits 和 executionProgress
  if (!messageRef.value.executionUnits) {
    messageRef.value.executionUnits = []
  }
  
  if (!messageRef.value.executionProgress) {
    messageRef.value.executionProgress = { completed: 0, total: 0 }
  }
  
  const chatId = currentChat.value.id
  const isAutonomous = !skillName // 判断是否为自主规划模式

  // 辅助函数：安全更新消息
  const updateMessage = () => {
    // 确保必要字段存在
    if (!messageRef.value.executionUnits) {
      messageRef.value.executionUnits = []
    }
    if (!messageRef.value.executionProgress) {
      messageRef.value.executionProgress = { completed: 0, total: 0 }
    }
    
    // 创建新对象触发响应式更新
    messageRef.value = { ...messageRef.value }
    
    // 同时更新聊天数组中的消息
    const msgIndex = currentChat.value.messages.findIndex(m => m.timestamp === messageRef.value.timestamp)
    if (msgIndex !== -1) {
      currentChat.value.messages[msgIndex] = { ...messageRef.value }
    }
  }

  try {
    matchedSkill.value = skillName ? skillManager.getSkill(skillName) || null : null
    
    if (skillName && !matchedSkill.value) {
      throw new Error(`技能 "${skillName}" 不存在`)
    }
    
    // 更新顶部指示器
    if (isAutonomous) {
      setStep('正在进行自主规划...', 'fa fa-tasks fa-spin', 'step-planning')
      messageRef.value.executionName = store.locales == 'zh' ? '自主规划' : 'Autonomous Planning'
    } else {
      setStep(`${store.locales == 'zh' ? '正在规划' : 'Planning tasks for skill'} "${matchedSkill.value?.name}"...`, 'fa fa-tasks fa-spin', 'step-planning')
      messageRef.value.executionName = matchedSkill.value?.name
    }
    
    // 添加规划阶段步骤
    const planningUnit: ExecutionUnit = {
      id: 'planning',
      status: 'running',
      stepType: 'planning',
      description: isAutonomous ? 
        (store.locales == 'zh' ? '正在自主规划执行步骤...' : 'Planning steps autonomously...') :
        `${store.locales == 'zh' ? '正在规划' : 'Planning steps for skill'} "${matchedSkill.value?.name}"...`,
      startTime: Date.now()
    }
    
    messageRef.value.executionUnits?.push(planningUnit)
    updateMessage()
    
    scrollToBottom()

    let planningCompleted = false

    if (isAutonomous) {
      setStep(`${store.locales == 'zh' ? '正在自主执行...' : 'Executing autonomously...'}`, 'fa fa-cubes fa-spin', 'step-skill-executing')
    } else {
      setStep(`${store.locales == 'zh' ? '正在执行' : 'Executing skill'}: ${matchedSkill.value?.name}`, 'fa fa-cubes fa-spin', 'step-skill-executing')
    }

    globalExecutionState.value = {
      ...globalExecutionState.value,
      isExecuting: true,
      executionType: 'skill',
      chatId: chatId,
      skillLoading: true
    }

    // 标记占位消息为正在执行
    messageRef.value.isExecuting = true
    updateMessage()

    // 执行技能（skillName 可能为 null）
    const result = await skillManager.executeSkill(
      skillName, // 直接传递 skillName，可能为 null
      {
        input: userInput,
        store: store,
        files: currentImages.value.length > 0 ? { 'uploaded_images': JSON.stringify(currentImages.value) } : undefined,
        variables: {
          chatId: currentChat.value.id,
          timestamp: Date.now()
        },
        callbacks: {
          onUserQuestion: onUserQuestion
        }
      },
      {
        onStepStart: (step) => {
          console.log('步骤开始:', step)
          
          globalExecutionState.value = {
            ...globalExecutionState.value,
            isExecuting: true
          }
          
          // 确保 executionUnits 存在
          if (!messageRef.value.executionUnits) {
            messageRef.value.executionUnits = []
          }
          
          if (!planningCompleted) {
            const planningIndex = messageRef.value.executionUnits?.findIndex(u => u.id === 'planning') ?? -1
            if (planningIndex !== -1 && messageRef.value.executionUnits?.[planningIndex]?.status === 'running') {
              if (messageRef.value.executionUnits?.[planningIndex]) {
                messageRef.value.executionUnits[planningIndex].status = 'success'
                messageRef.value.executionUnits[planningIndex].endTime = Date.now()
              }
              planningCompleted = true
            }
          }
          
          const unit: ExecutionUnit = {
            id: step.id,
            status: 'running',
            stepType: step.type,
            description: step.description,
            startTime: step.startTime
          }
          
          const existingIndex = messageRef.value.executionUnits?.findIndex(u => u.id === step.id) ?? -1
          if (existingIndex !== -1 && messageRef.value.executionUnits?.[existingIndex]) {
            messageRef.value.executionUnits.splice(existingIndex, 1, { ...messageRef.value.executionUnits[existingIndex], ...unit })
          } else {
            messageRef.value.executionUnits?.push(unit)
          }
          
          updateMessage()
          
          const stepTypeDisplay = getStepTypeDisplay(step.type || '')
          setStep(`执行中: ${stepTypeDisplay} - ${step.description}`, 'fa fa-cog fa-spin', 'step-executing')
          
          if (messageRef.value.executionProgress) {
            const completed = messageRef.value.executionUnits?.filter(u => u.status === 'success' || u.status === 'error').length ?? 0
            const total = messageRef.value.executionUnits?.length ?? 0
            messageRef.value.executionProgress = {
              completed,
              total
            }
          }
          
          scrollToBottom()
        },
        
        onStepComplete: (step) => {
          //console.log('步骤完成:', step)
          
          globalExecutionState.value = {
            ...globalExecutionState.value,
            isExecuting: true
          }
          
          if (!messageRef.value.executionUnits) {
            messageRef.value.executionUnits = []
            return
          }
          
          const index = messageRef.value.executionUnits?.findIndex(u => u.id === step.id) ?? -1
          if (index !== -1 && messageRef.value.executionUnits?.[index]) {
            const existingUnit = messageRef.value.executionUnits[index]
            const updatedUnit: ExecutionUnit = {
              ...existingUnit,
              status: 'success' as const,
              result: step.result,
              endTime: step.endTime,
              resultPreview: step.result ? (typeof step.result === 'string' 
                ? step.result.substring(0, 200) + (step.result.length > 200 ? '...' : '')
                : JSON.stringify(step.result).substring(0, 200) + '...') : undefined
            }
            
            messageRef.value.executionUnits.splice(index, 1, updatedUnit)
          }
          
          updateMessage()
          
          if (messageRef.value.executionProgress) {
            const completed = messageRef.value.executionUnits?.filter(u => u.status === 'success' || u.status === 'error').length ?? 0
            const total = messageRef.value.executionUnits?.length ?? 0
            messageRef.value.executionProgress = {
              completed,
              total
            }
          }
          
          scrollToBottom()
        },
        
        onStepError: (step, error) => {
          console.error('步骤错误:', step, error)
          
          globalExecutionState.value = {
            ...globalExecutionState.value,
            isExecuting: true
          }
          
          if (!messageRef.value.executionUnits) {
            messageRef.value.executionUnits = []
            return
          }
          
          const index = messageRef.value.executionUnits?.findIndex(u => u.id === step.id) ?? -1
          if (index !== -1 && messageRef.value.executionUnits?.[index]) {
            const existingUnit = messageRef.value.executionUnits[index]
            const updatedUnit: ExecutionUnit = {
              ...existingUnit,
              status: 'error' as const,
              error: error,
              endTime: Date.now()
            }
            
            messageRef.value.executionUnits.splice(index, 1, updatedUnit)
          }
          
          updateMessage()
          
          if (messageRef.value.executionProgress) {
            const completed = messageRef.value.executionUnits?.filter(u => u.status === 'success' || u.status === 'error').length ?? 0
            const total = messageRef.value.executionUnits?.length ?? 0
            messageRef.value.executionProgress = {
              completed,
              total
            }
          }
          
          scrollToBottom()
        },
        
        onProgress: (current, total, description) => {
          globalExecutionState.value = {
            ...globalExecutionState.value,
            isExecuting: true
          }
          
          setStep(`${description} (${current}/${total})`, 'fa fa-spinner fa-spin', 'step-progress')
          
          if (messageRef.value.isExecuting && messageRef.value.executionProgress) {
            const completed = Number(current) || 0
            const totalSteps = Number(total) || 0
            
            messageRef.value.executionProgress = {
              completed: completed,
              total: totalSteps
            }
            
            updateMessage()
            
            if (messageRef.value.executionUnits && messageRef.value.executionUnits.length !== totalSteps) {
              console.log('进度总数与单元数量不符，使用单元数量:', messageRef.value.executionUnits.length)
              if (messageRef.value.executionProgress) {
                messageRef.value.executionProgress.total = messageRef.value.executionUnits.length
              }
            }
          }
          
          if (messageRef.value.executionProgress) {
            const percentage = Math.round((messageRef.value.executionProgress.completed / messageRef.value.executionProgress.total) * 100) || 0
            setStep(`${description} (${current}/${total}) - ${percentage}%`, 'fa fa-spinner fa-spin', 'step-progress')
          }
        },
        
        onStream: (content, stepId) => {
          if (!messageRef.value.executionUnits) {
            messageRef.value.executionUnits = []
          }

          let unitIndex = messageRef.value.executionUnits?.findIndex(u => u.id === stepId) ?? -1
          if (unitIndex === -1) {
            const newUnit: ExecutionUnit = {
              id: stepId,
              status: 'running',
              stepType: 'think',
              description: '',
              startTime: Date.now(),
              streamContent: content
            }
            messageRef.value.executionUnits?.push(newUnit)
            unitIndex = (messageRef.value.executionUnits?.length ?? 1) - 1
          } else {
            const unit = messageRef.value.executionUnits?.[unitIndex]
            if (unit) {
              if (!unit.streamContent) unit.streamContent = ''
              unit.streamContent += content
            }
          }

          updateMessage()

          nextTick(() => {
            if (autoScrollEnabled.value) {
              const container = messageContainer.value
              if (container) {
                container.scrollTop = container.scrollHeight
              }
            }
          })
        },
        
        onLog: (message, level) => {
          //console.log(`[技能日志] ${level}: ${message}`)
        },
        
        onReplan: (originalStep, newPlan) => {
          //console.log('重规划:', originalStep, newPlan)
          
          globalExecutionState.value = {
            ...globalExecutionState.value,
            isExecuting: true
          }
          
          if (messageRef.value) {
            messageRef.value.isExecuting = true
          }
          
          if (messageRef.value.isExecuting && messageRef.value.executionUnits) {
            const index = messageRef.value.executionUnits?.findIndex(u => u.id === originalStep.id) ?? -1
            if (index !== -1 && messageRef.value.executionUnits?.[index]) {
              const updatedUnit = {
                ...messageRef.value.executionUnits[index],
                decisionInfo: `重新规划了 ${newPlan.length} 个步骤`
              }
              messageRef.value.executionUnits.splice(index, 1, updatedUnit)
              
              const newUnits = newPlan.map((step, idx) => {
                const baseUnit: ExecutionUnit = {
                  id: step.id,
                  status: 'pending' as const,
                  stepType: step.type,
                  description: step.description,
                  startTime: undefined
                }
                
                if (step.type === 'think') {
                  baseUnit.streamContent = ''
                }
                
                return baseUnit
              })
              
              const stepsAfterReplan = messageRef.value.executionUnits?.slice(index + 1) ?? []
              
              if (stepsAfterReplan.length > 0) {
                messageRef.value.executionUnits?.splice(index + 1, stepsAfterReplan.length)
              }
              
              messageRef.value.executionUnits?.splice(index + 1, 0, ...newUnits)
              
              updateMessage()
              
              if (messageRef.value.executionProgress) {
                const completed = messageRef.value.executionUnits?.filter(u => u.status === 'success' || u.status === 'error').length ?? 0
                const total = messageRef.value.executionUnits?.length ?? 0
                messageRef.value.executionProgress = {
                  completed,
                  total
                }
              }
              
              setStep(`重规划完成，继续执行... (${messageRef.value.executionProgress?.completed || 0}/${messageRef.value.executionProgress?.total || 0})`, 
                      'fa fa-cubes fa-spin', 'step-skill-executing')
              
              scrollToBottom()
            }
          }
        }
      }
    )

    console.log('执行结果:', result)

    if (!messageRef.value.executionUnits) {
      messageRef.value.executionUnits = []
    }

    // ========== 修复：确保结果正确设置到消息中 ==========
    messageRef.value.isExecuting = false
    messageRef.value.content = result.result
    messageRef.value.executionTime = result.executionTime
    messageRef.value.executionStats = {
      total: result.steps.length,
      success: result.steps.filter(s => s.status === 'success').length,
      failed: result.steps.filter(s => s.status === 'error').length,
      time: result.executionTime,
      errors: result.steps
        .filter(s => s.status === 'error')
        .map(s => ({
          id: s.id,
          name: s.description,
          error: s.error || '未知错误'
        }))
    }

    result.steps.forEach(step => {
      if (!messageRef.value.executionUnits) {
        messageRef.value.executionUnits = []
      }
      
      const existingIndex = messageRef.value.executionUnits?.findIndex(u => u.id === step.id) ?? -1
      if (existingIndex !== -1 && messageRef.value.executionUnits?.[existingIndex]) {
        const existingUnit = messageRef.value.executionUnits[existingIndex]
        const updatedUnit = {
          ...existingUnit,
          status: step.status,
          result: step.result,
          error: step.error,
          endTime: step.endTime,
          streamContent: existingUnit.streamContent || step.streamContent,
          resultPreview: step.result ? (typeof step.result === 'string' 
            ? step.result.substring(0, 200) + (step.result.length > 200 ? '...' : '')
            : JSON.stringify(step.result).substring(0, 200) + '...') : undefined
        }
        messageRef.value.executionUnits?.splice(existingIndex, 1, updatedUnit)
      } else {
        messageRef.value.executionUnits?.push({
          id: step.id,
          status: step.status,
          stepType: step.type,
          description: step.description,
          result: step.result,
          error: step.error,
          startTime: step.startTime,
          endTime: step.endTime,
          streamContent: step.streamContent,
          resultPreview: step.result ? (typeof step.result === 'string' 
            ? step.result.substring(0, 200) + (step.result.length > 200 ? '...' : '')
            : JSON.stringify(step.result).substring(0, 200) + '...') : undefined
        })
      }
    })

    // ========== 修复：最终更新，确保消息内容被添加到聊天历史 ==========
    // 创建消息的最终版本
    const finalMessage: ChatMessage = {
      ...messageRef.value,
      content: messageRef.value.content || result.result || '执行完成',
      isExecuting: false
    }
    
    // 更新 ref
    messageRef.value = finalMessage
    
    // 更新聊天数组中的消息
    const msgIndex = currentChat.value.messages.findIndex(m => m.timestamp === placeholderMessage.timestamp)
    if (msgIndex !== -1) {
      currentChat.value.messages[msgIndex] = { ...finalMessage }
    }
    
    // 强制触发响应式更新
    currentChat.value.messages = [...currentChat.value.messages]

    if (ttsEnabled.value) {
      store.tts(result.result)
    }
    
    const successMessage = isAutonomous ? 
      (store.locales == 'zh' ? '自主执行完成' : 'Autonomous execution completed') :
      (store.locales == 'zh' ? '技能执行完成' : 'Skill execution completed')
    
    globalExecutionState.value = {
      ...globalExecutionState.value,
      isExecuting: false,
      executionType: null,
      chatId: null,
      skillLoading: false,
      currentStep: successMessage,
      stepIcon: 'fa fa-check-circle',
      stepIndicatorClass: 'step-success'
    }
    
    setTimeout(() => {
      if (globalExecutionState.value.currentStep.includes('执行完成') || 
          globalExecutionState.value.currentStep.includes('execution completed')) {
        globalExecutionState.value.currentStep = ''
      }
    }, 1000)
    
    await nextTick()
    
    saveChats()
    scrollToBottom()

  } catch (error: any) {
    console.error('执行失败:', error)
    
    if (!messageRef.value.executionUnits) {
      messageRef.value.executionUnits = []
    }
    
    // ========== 修复：错误时也设置内容 ==========
    messageRef.value.isExecuting = false
    messageRef.value.content = `执行失败: ${error.message}`
    
    if (messageRef.value.executionUnits && messageRef.value.executionUnits.length > 0) {
      const lastUnit = messageRef.value.executionUnits[messageRef.value.executionUnits.length - 1]
      if (lastUnit.status === 'running') {
        const updatedUnit: ExecutionUnit = {
          ...lastUnit,
          status: 'error' as const,
          error: error.message,
          endTime: Date.now()
        }
        messageRef.value.executionUnits.splice(messageRef.value.executionUnits.length - 1, 1, updatedUnit)
      }
    }
    
    messageRef.value.executionStats = {
      total: messageRef.value.executionUnits?.length || 1,
      success: messageRef.value.executionUnits?.filter(u => u.status === 'success').length || 0,
      failed: (messageRef.value.executionUnits?.filter(u => u.status === 'error').length || 0) + 1,
      time: Date.now() - (messageRef.value.executionUnits?.[0]?.startTime || Date.now()),
      errors: [{ id: 'error', name: '执行失败', error: error.message }]
    }

    // ========== 修复：错误时也更新消息到聊天历史 ==========
    const msgIndex = currentChat.value.messages.findIndex(m => m.timestamp === placeholderMessage.timestamp)
    if (msgIndex !== -1) {
      currentChat.value.messages[msgIndex] = { ...messageRef.value }
    }
    currentChat.value.messages = [...currentChat.value.messages]

    const errorMessage = isAutonomous ? 
      (store.locales == 'zh' ? '自主执行失败' : 'Autonomous execution failed') :
      (store.locales == 'zh' ? '技能执行失败' : 'Skill execution failed')

    globalExecutionState.value = {
      ...globalExecutionState.value,
      isExecuting: false,
      executionType: null,
      chatId: null,
      skillLoading: false,
      currentStep: errorMessage,
      stepIcon: 'fa fa-exclamation-circle',
      stepIndicatorClass: 'step-error'
    }

    setTimeout(() => {
      if (globalExecutionState.value.currentStep.includes('执行失败') || 
          globalExecutionState.value.currentStep.includes('execution failed')) {
        globalExecutionState.value.currentStep = ''
      }
    }, 3000)

  } finally {
    
    const finalMsgIndex = currentChat.value.messages.findIndex(m => m.timestamp === placeholderMessage.timestamp)
    if (finalMsgIndex !== -1) {
      const finalMsg = currentChat.value.messages[finalMsgIndex]
      // 如果消息还没有内容，设置默认内容
      if (!finalMsg.content) {
        finalMsg.content = isAutonomous ? 
          (store.locales == 'zh' ? '自主执行完成' : 'Autonomous execution completed') :
          (store.locales == 'zh' ? '技能执行完成' : 'Skill execution completed')
      }
      // 确保 isExecuting 为 false
      finalMsg.isExecuting = false
      // 重新赋值触发响应式更新
      currentChat.value.messages[finalMsgIndex] = { ...finalMsg }
    }
    
    globalExecutionState.value = {
      ...globalExecutionState.value,
      isExecuting: false,
      executionType: null,
      chatId: null,
      skillLoading: false,
      currentStep: '',
      stepIcon: '',
      stepIndicatorClass: ''
    }
    
    await nextTick()
    
    saveChats()
    scrollToBottom()
  }
}

// ==================== 工作流相关函数 ====================

const initWorkflowRunner = () => {
  if (!currentChat.value.config.workflowData) {
    globalExecutionState.value.workflowRunner = null
    return
  }
  
  const callbacks: ExecutionCallback = {
    onNodeStart: (nodeId, nodeName, nodeType) => {
      console.log(`工作流节点开始: ${nodeName} (${nodeType})`)
      
      const messages = currentChat.value.messages
      const workflowMessage = messages.find(msg => msg.isExecuting && msg.executionType === 'workflow')
      
      if (workflowMessage && workflowMessage.executionUnits) {
        const existingIndex = workflowMessage.executionUnits.findIndex(u => u.id === nodeId)
        const unit: WorkflowUnit = {
          id: nodeId,
          name: nodeName,
          nodeType: nodeType,
          status: 'running',
          startTime: Date.now()
        }
        
        if (existingIndex !== -1) {
          workflowMessage.executionUnits.splice(existingIndex, 1, { ...workflowMessage.executionUnits[existingIndex], ...unit })
        } else {
          workflowMessage.executionUnits.push(unit)
        }
        
        workflowMessage.executionUnits = [...workflowMessage.executionUnits]
        
        workflowMessage.executionProgress = {
          completed: workflowMessage.executionUnits.filter(u => u.status === 'success' || u.status === 'error').length,
          total: currentChat.value.config.workflowData!.items.length
        }
      }
      
      setStep(`执行节点: ${nodeName}`, 'fa fa-cog fa-spin', 'step-executing')
      scrollToBottom()
    },
    
    onNodeComplete: (nodeId, nodeName, nodeType, status, result) => {
      console.log(`工作流节点完成: ${nodeName} - ${status}`, result)
      
      const messages = currentChat.value.messages
      const workflowMessage = messages.find(msg => msg.isExecuting && msg.executionType === 'workflow')
      
      if (workflowMessage && workflowMessage.executionUnits) {
        const nodeIndex = workflowMessage.executionUnits.findIndex(u => u.id === nodeId)
        if (nodeIndex !== -1) {
          const unit = workflowMessage.executionUnits[nodeIndex] as WorkflowUnit
          const updatedUnit: WorkflowUnit = {
            ...unit,
            status: (status === 'idle' ? 'pending' : status) as 'pending' | 'running' | 'success' | 'error',
            endTime: Date.now()
          }
          
          if (result) {
            try {
              const parsedResult = JSON.parse(result)
              if (parsedResult.result) {
                if (nodeType === 'reasoning' || nodeType === 'python') {
                  updatedUnit.resultPreview = typeof parsedResult.result === 'string' 
                    ? parsedResult.result
                    : JSON.stringify(parsedResult.result, null, 2)
                } else {
                  updatedUnit.resultPreview = typeof parsedResult.result === 'string' 
                    ? parsedResult.result.substring(0, 200) + (parsedResult.result.length > 200 ? '...' : '')
                    : JSON.stringify(parsedResult.result).substring(0, 200) + '...'
                }
              } else {
                if (nodeType === 'python') {
                  updatedUnit.resultPreview = typeof result === 'string' ? result : String(result)
                } else {
                  updatedUnit.resultPreview = typeof result === 'string' 
                    ? result.substring(0, 300)
                    : String(result).substring(0, 300)
                }
              }
            } catch {
              if (nodeType === 'python') {
                updatedUnit.resultPreview = typeof result === 'string' ? result : String(result)
              } else {
                updatedUnit.resultPreview = typeof result === 'string' 
                  ? result.substring(0, 300)
                  : String(result).substring(0, 300)
              }
            }
          }
          
          workflowMessage.executionUnits.splice(nodeIndex, 1, updatedUnit)
          workflowMessage.executionUnits = [...workflowMessage.executionUnits]
        }
        
        workflowMessage.executionProgress = {
          completed: workflowMessage.executionUnits.filter(u => u.status === 'success' || u.status === 'error').length,
          total: currentChat.value.config.workflowData!.items.length
        }
      }
      
      scrollToBottom()
    },
    
    onNodeStatusUpdate: (nodeId, status, result) => {
      if (result) {
        try {
          const parsedResult = JSON.parse(result)
          // 修复1: 确保流式内容正确累积，不重复
          if (parsedResult.streaming && parsedResult.result) {
            const messages = currentChat.value.messages
            const workflowMessage = messages.find(msg => msg.isExecuting && msg.executionType === 'workflow')
            
            if (workflowMessage && workflowMessage.executionUnits) {
              const nodeIndex = workflowMessage.executionUnits.findIndex(u => u.id === nodeId)
              if (nodeIndex !== -1) {
                const unit = workflowMessage.executionUnits[nodeIndex] as WorkflowUnit
                if (unit.nodeType === 'reasoning') {
                  // 修复: 检查是否是重复发送，通过比较长度避免重复
                  const newContent = parsedResult.result
                  if (!unit.streamContent) {
                    unit.streamContent = ''
                  }
                  
                  // 避免重复累积 - 如果新内容不是现有内容的简单追加，则替换
                  // 这可以防止由于网络问题导致的内容重叠
                  if (!unit.streamContent.endsWith(newContent) && newContent.length > unit.streamContent.length) {
                    unit.streamContent = newContent
                  }
                  
                  unit.resultPreview = unit.streamContent
                  
                  if (unit.resultPreview && unit.resultPreview.length > 5000) {
                    unit.resultPreview = unit.resultPreview.substring(0, 5000) + '...'
                  }
                  
                  workflowMessage.executionUnits[nodeIndex] = { ...unit }
                  workflowMessage.executionUnits = [...workflowMessage.executionUnits]
                }
              }
            }
          }
        } catch {}
      }
    },
    
    onPythonError: (nodeId, nodeName, error, traceback) => {
      console.error(`工作流Python节点错误: ${nodeName} - ${error}`)
      
      const messages = currentChat.value.messages
      const workflowMessage = messages.find(msg => msg.isExecuting && msg.executionType === 'workflow')
      
      if (workflowMessage && workflowMessage.executionUnits) {
        const nodeIndex = workflowMessage.executionUnits.findIndex(u => u.id === nodeId)
        if (nodeIndex !== -1) {
          const updatedUnit = {
            ...workflowMessage.executionUnits[nodeIndex],
            error: error
          }
          workflowMessage.executionUnits.splice(nodeIndex, 1, updatedUnit)
          workflowMessage.executionUnits = [...workflowMessage.executionUnits]
        }
      }
      
      if (!workflowMessage?.executionStats) {
        workflowMessage!.executionStats = { total: 0, success: 0, failed: 0, time: 0, errors: [] }
      }
      if (!workflowMessage!.executionStats.errors) {
        workflowMessage!.executionStats.errors = []
      }
      workflowMessage!.executionStats.errors.push({
        id: nodeId,
        name: nodeName,
        error: error
      })
    },
    
    onDecisionBranchSelected: (nodeId, nodeName, branchId, branchName, reason) => {
      console.log(`决策节点分支选择: ${nodeName} -> ${branchName} (${branchId})`)
      
      const messages = currentChat.value.messages
      const workflowMessage = messages.find(msg => msg.isExecuting && msg.executionType === 'workflow')
      
      if (workflowMessage && workflowMessage.executionUnits) {
        const nodeIndex = workflowMessage.executionUnits.findIndex(u => u.id === nodeId)
        if (nodeIndex !== -1) {
          const unit = workflowMessage.executionUnits[nodeIndex] as WorkflowUnit
          const updatedUnit = {
            ...unit,
            decisionInfo: `${store.locales=='zh' ? '选择分支: ' : 'Selected branch: '}${branchName}`
          }
          workflowMessage.executionUnits.splice(nodeIndex, 1, updatedUnit)
          workflowMessage.executionUnits = [...workflowMessage.executionUnits]
        }
      }
      
      scrollToBottom()
    },
    
    onProgress: (completed, total, currentNode) => {
      const messages = currentChat.value.messages
      const workflowMessage = messages.find(msg => msg.isExecuting && msg.executionType === 'workflow')
      
      if (workflowMessage) {
        workflowMessage.executionProgress = {
          completed,
          total
        }
      }
    },
    
    onComplete: (success, finalResult, aggregatedResults) => {
      const messages = currentChat.value.messages
      const workflowMessageIndex = messages.findIndex(msg => msg.isExecuting && msg.executionType === 'workflow')
      
      if (workflowMessageIndex !== -1) {
        const workflowMessage = messages[workflowMessageIndex]
        workflowMessage.isExecuting = false
        workflowMessage.content = success ? finalResult : `${store.locales=='zh' ? '工作流执行失败: ' : 'Workflow execution failed: '} ${finalResult}`
        workflowMessage.executionTime = Date.now() - workflowStartTime.value
        
        if (success && aggregatedResults && aggregatedResults.executionStats) {
          workflowMessage.executionStats = {
            total: aggregatedResults.executionStats.totalNodes,
            success: aggregatedResults.executionStats.completedNodes,
            failed: aggregatedResults.executionStats.failedNodes,
            time: aggregatedResults.executionStats.executionTime,
            errors: aggregatedResults.executionStats.errors
          }
        }
        
        if (success && ttsEnabled.value) {
          store.tts(finalResult)
        }
      }
      
      if (!success) {
        workflowError.value = true
      }
      
      globalExecutionState.value = {
        ...globalExecutionState.value,
        isExecuting: false,
        executionType: null,
        chatId: null,
        currentStep: '',
        stepIcon: '',
        stepIndicatorClass: ''
      }
      
      saveChats()
      
      setStep(success ? (store.locales=='zh' ? '工作流执行完成' : 'Workflow execution completed') : (store.locales=='zh' ? '工作流执行失败' : 'Workflow execution failed'), 
              success ? 'fa fa-check-circle' : 'fa fa-exclamation-circle', 
              success ? 'step-success' : 'step-error')
      
      setTimeout(() => {
        setStep('', '', '')
      }, 3000)
      
      scrollToBottom()
    },
    
    onLog: (message, level) => {
      //console.log(`[工作流 ${level}] ${message}`)
    }
  }
  
  globalExecutionState.value.workflowRunner = new WorkflowRunner(
    currentChat.value.config.workflowData,
    store,
    callbacks
  )
}

const workflowStatus = ref<any>(null)
const workflowStartTime = ref<number>(0)

const validateWorkflow = async (): Promise<boolean> => {
  if (!globalExecutionState.value.workflowRunner || !currentChat.value.config.workflowData) {
    return false
  }
  
  try {
    const workflowData = currentChat.value.config.workflowData
    
    if (!workflowData.items || !Array.isArray(workflowData.items)) {
      throw new Error('无效的工作流文件格式')
    }
    
    const nodeTypes = new Set(workflowData.items.map((item: any) => item.type))
    const requiredTypes = ['start', 'end']
    
    for (const type of requiredTypes) {
      if (!nodeTypes.has(type)) {
        throw new Error(`工作流缺少${type}节点`)
      }
    }
    
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

const runWorkflow = async (userInput: string) => {
  if (!globalExecutionState.value.workflowRunner || !currentChat.value.config.workflowData) {
    alert('工作流未正确初始化')
    return
  }
  
  const chatId = currentChat.value.id
  const currentChatData = currentChat.value
  
  workflowError.value = false
  
  globalExecutionState.value = {
    ...globalExecutionState.value,
    isExecuting: true,
    executionType: 'workflow',
    chatId: chatId
  }
  
  const userMessage: ChatMessage = {
    role: 'user',
    content: userInput,
    timestamp: Date.now(),
    images: currentImages.value.length > 0 ? [...currentImages.value] : undefined
  }
  
  currentChatData.messages.push(userMessage)
  currentImages.value = []
  
  const workflowMessage: ChatMessage = {
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    executionType: 'workflow',
    isExecuting: true,
    executionUnits: [],
    executionProgress: { completed: 0, total: currentChatData.config.workflowData?.items?.length || 0 }
  }
  
  currentChatData.messages.push(workflowMessage)
  inputText.value = ''
  autoScrollEnabled.value = true
  scrollToBottom()
  
  try {
    workflowStartTime.value = Date.now()
    
    if (!globalExecutionState.value.workflowRunner?.setStartNodeInput(userInput)) {
      throw new Error('设置起始节点输入失败')
    }
    
    await globalExecutionState.value.workflowRunner.run()
    
  } catch (error: any) {
    console.error('运行工作流失败:', error)
    
    const messages = currentChatData.messages
    const workflowMessageIndex = messages.findIndex(msg => msg.isExecuting && msg.executionType === 'workflow')
    
    if (workflowMessageIndex !== -1) {
      const workflowMessage = messages[workflowMessageIndex]
      workflowMessage.isExecuting = false
      workflowMessage.content = `${store.locales=='zh' ? '工作流执行失败: ' : 'Workflow execution failed: '} ${error.message}`
    }
    
    workflowError.value = true
    
    globalExecutionState.value = {
      ...globalExecutionState.value,
      isExecuting: false,
      executionType: null,
      chatId: null,
      currentStep: '',
      stepIcon: '',
      stepIndicatorClass: ''
    }
    
    setStep(store.locales=='zh' ? '工作流执行失败' : 'Workflow execution failed', 'fa fa-exclamation-circle', 'step-error')
    setTimeout(() => {
      setStep('', '', '')
    }, 3000)
  } finally {
    saveChats()
    scrollToBottom()
  }
}

// ==================== 普通聊天消息发送（包含检索模式） ====================

const sendChatMessage = async (message: string) => {
  const currentChatData = currentChat.value
  
  const userMessage: ChatMessage = {
    role: 'user',
    content: message,
    timestamp: Date.now(),
    images: currentImages.value.length > 0 ? [...currentImages.value] : undefined
  }
  
  currentChatData.messages.push(userMessage)
  currentChatData.isGenerating = true
  
  // 设置初始状态
  setStep(store.locales=='zh' ? '正在发送请求...' : 'Sending request...', 'fa fa-paper-plane', 'step-sending')
  
  inputText.value = ''
  currentImages.value = []
  
  autoScrollEnabled.value = true
  scrollToBottom()

  const originalType = store.AIconfig.llm.type
  const originalModel = getCurrentModelFromStore()
  
  store.AIconfig.llm.type = currentChatData.config.llmType
  updateStoreModelConfig(currentChatData.config)

  const kbPath = currentChatData.config.kbPath
  let retrievedContext = message
  let relevantBlocks: RelevantBlock[] = []
  // 使用局部变量存储 kbInfo，而不是全局变量
  let tempKbInfo: {
    kbPath: string
    relevantBlocks: RelevantBlock[]
    debugInfo?: any
  } | null = null

  // 知识库检索阶段（仅在检索模式且有知识库时）
  if (currentChatData.mode === 'retrieval' && kbPath) {
    try {
      setStep(store.locales=='zh' ? '正在检索知识库...' : `Retrieving knowledge base: ${kbPath}`, 'fa fa-search fa-spin', 'step-retrieving')
      
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
      
      const lastUserMessageIndex = [...currentChatData.messages].reverse().findIndex(msg => msg.role === 'user')
      if (lastUserMessageIndex !== -1) {
        const actualIndex = currentChatData.messages.length - 1 - lastUserMessageIndex
        const userMsg = currentChatData.messages[actualIndex]
        userMsg.kbInfo = {
          kbPath: kbPath,
          relevantBlocks: relevantBlocks,
          debugInfo: retrievalResult.debugInfo
        }
        
        // 保存到临时变量，用于助理消息
        tempKbInfo = {
          kbPath: kbPath,
          relevantBlocks: relevantBlocks,
          debugInfo: retrievalResult.debugInfo
        }
      }
      
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
      
      setStep(store.locales=='zh' ? '检索完成，正在思考...' : 'Retrieval complete, thinking...', 'fa fa-cog fa-spin', 'step-thinking')
      
    } catch (error) {
      setStep(store.locales=='zh' ? '检索失败，继续思考...' : 'Retrieval failed, continuing thinking...', 'fa fa-exclamation-triangle', 'step-error')
    }
  } else {
    setStep(store.locales=='zh' ? '正在思考...' : 'Thinking...', 'fa fa-cog fa-spin', 'step-thinking')
  }
  
  const assistantMessage: ChatMessage = {
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    model: currentChatData.config.model
  }

  // 如果有临时保存的 kbInfo，添加到助理消息
  if (tempKbInfo) {
    assistantMessage.kbInfo = { ...tempKbInfo }
  }
  
  currentChatData.messages.push(assistantMessage)
  scrollToBottom()
  
  try {
    let messages
    if (userMessage.images && userMessage.images.length > 0) {
      messages = buildMultimodalMessages(currentChatData, retrievedContext, userMessage.images)
    } else {
      messages = buildMessagesWithFunction(currentChatData, retrievedContext)
    }
    
    // 获取模型显示名称
    const modelDisplayName = getModelDisplayName(currentChatData.config)
    
    // 设置生成回复状态 - 显示模型名称
    if (currentChatData.mode === 'retrieval' && kbPath) {
      setStep(
        store.locales == 'zh' 
          ? `正在使用 ${modelDisplayName} 总结结论...` 
          : `Using ${modelDisplayName} to summarize...`,
        'fa fa-refresh fa-spin',
        'step-generating'
      )
    } else {
      setStep(
        store.locales == 'zh' 
          ? `正在使用 ${modelDisplayName} 生成回复...` 
          : `Using ${modelDisplayName} to generate response...`,
        'fa fa-refresh fa-spin',
        'step-generating'
      )
    }
    
    const controller = new AbortController()
    globalExecutionState.value.abortController = controller

    await store.sendToAI(
      messages,
      {
        onStream: (chunk: string) => {
          const lastMessage = currentChatData.messages[currentChatData.messages.length - 1]
          if (lastMessage.role === 'assistant') {
            lastMessage.content += chunk
          }
          if (currentChatIndex.value === currentChatIndex.value && autoScrollEnabled.value) {
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
          
          if (!currentChatData.title && currentChatData.messages.length === 2) {
            generateChatTitle(content)
          }
          
          currentChatData.isGenerating = false
          retrievalStats.value = null
          // 修复3: 清除步骤指示器
          globalExecutionState.value.currentStep = ''
          globalExecutionState.value.stepIcon = ''
          globalExecutionState.value.stepIndicatorClass = ''
          globalExecutionState.value.abortController = null
          saveChats()
          
          scrollToBottom()
        },
        onError: (error: Error) => {
          console.error('AI请求失败:', error)
          const lastMessage = currentChatData.messages[currentChatData.messages.length - 1]
          if (lastMessage.role === 'assistant') {
            lastMessage.content = '抱歉，请求失败：' + error.message
          }
          
          currentChatData.isGenerating = false
          retrievalStats.value = null
          // 修复3: 清除步骤指示器
          globalExecutionState.value.currentStep = ''
          globalExecutionState.value.stepIcon = ''
          globalExecutionState.value.stepIndicatorClass = ''
          globalExecutionState.value.abortController = null
          saveChats()
        },
        signal: controller.signal
      }
    )
  } catch (error) {
    console.error('发送消息失败:', error)
    const lastMessage = currentChatData.messages[currentChatData.messages.length - 1]
    if (lastMessage.role === 'assistant') {
      lastMessage.content = '请求失败，请检查网络连接和模型配置'
    }
    
    currentChatData.isGenerating = false
    retrievalStats.value = null
    // 修复3: 清除步骤指示器
    globalExecutionState.value.currentStep = ''
    globalExecutionState.value.stepIcon = ''
    globalExecutionState.value.stepIndicatorClass = ''
    globalExecutionState.value.abortController = null
    saveChats()
  } finally {
    store.AIconfig.llm.type = originalType
    if (originalType === currentChatData.config.llmType) {
      restoreStoreModelConfig(originalType, originalModel)
    }
    saveChats()
  }
}

const buildMultimodalMessages = (chat: Chat, context: string, images: Array<string | Uint8Array | ArrayBuffer>) => {
  const historyMessages = chat.messages
    .slice(0, -1)
    .map(msg => {
      if (msg.images && msg.images.length > 0) {
        return {
          role: msg.role,
          content: msg.content,
          images: msg.images
        }
      } else {
        return {
          role: msg.role,
          content: msg.content
        }
      }
    })
  
  const currentMessage = {
    role: 'user' as const,
    content: context,
    images: images
  }
  
  return [ ...historyMessages, currentMessage]
}

const buildMessagesWithFunction = (chat: Chat, context: string) => {  
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
  
  return [ ...historyMessages, lastMessage]
}

const stopCurrentGeneration = () => {
  stopExecution()
}

const generateChatTitle = async (firstResponse: string) => {
  try {
    const currentChatData = currentChat.value
    
    if (currentChatData.title && currentChatData.title.trim() !== '') {
      return
    }
    
    if (currentChatData.messages.length !== 2) {
      return
    }
    
    const titlePrompt = `请根据以下对话内容生成一个简短的中文标题（不超过10个字）：\n${firstResponse.substring(0, 200)}`
    
    const title = await store.sendToAI(
      [{ role: 'user', content: titlePrompt }]
    )
    
    currentChatData.title = title.replace(/["']/g, '').trim()
    saveChats()
  } catch (error) {
    console.error('生成标题失败:', error)
  }
}

const deleteMessage = (index: number) => {
  const message = currentChat.value.messages[index]
  delete showKbDetails.value[message.timestamp]
  
  currentChat.value.messages.splice(index, 1)
  saveChats()
}

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
  
  let markdownContent = ''
  
  // 聊天信息改为 YAML 格式
  markdownContent += `---\n`
  markdownContent += `导出时间: ${now.toLocaleString('zh-CN')}\n`
  markdownContent += `模型类型: ${chat.config.llmType}\n`
  markdownContent += `模型名称: ${chat.config.model || '未设置'}\n`
  if (chat.mode === 'retrieval' && chat.config.kbPath) {
    const kbName = chat.config.kbPath.split(/[\\/]/).pop() || chat.config.kbPath
    markdownContent += `知识库模式: ${kbName}\n`
    if (chat.config.kbTopK) {
      markdownContent += `知识库片段数: ${chat.config.kbTopK}\n`
    }
  }
  if (chat.mode === 'workflow' && chat.config.workflowPath) {
    const workflowName = chat.config.workflowPath.split(/[\\/]/).pop() || chat.config.workflowPath
    markdownContent += `工作流模式: ${workflowName}\n`
  }
  if (chat.mode === 'skill') {
    markdownContent += `技能模式: 已启用\n`
  }
  markdownContent += `温度参数: ${chat.config.temperature}\n`
  markdownContent += `最大令牌: ${chat.config.maxTokens}\n`
  markdownContent += `消息数量: ${chat.messages.length}\n`
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
    
    if (message.executionType) {
      const typeIcon = message.executionType === 'workflow' ? '⚙️' : '🧩'
      const typeName = message.executionType === 'workflow' ? '工作流' : '技能'
      markdownContent += ` ${typeIcon} ${typeName}生成`
      if (message.executionName) {
        markdownContent += ` (${message.executionName})`
      }
    } else if (message.kbInfo?.relevantBlocks?.length) {
      markdownContent += ` 📚 知识库生成`
    }
    
    markdownContent += ` · ${time}\n\n`
    
    if (message.images && message.images.length > 0) {
      markdownContent += `**📷 包含 ${message.images.length} 张图片**\n\n`
    }
    
    if (message.content.trim() !== '') {
      markdownContent += `${message.content}\n\n`
    } else {
      markdownContent += `*(空消息)*\n\n`
    }
    
    if (message.executionStats) {
      const typeName = message.executionType === 'workflow' ? '工作流' : '技能'
      markdownContent += `**${typeName}执行统计:**\n\n`
      markdownContent += `- **总${message.executionType === 'workflow' ? '节点' : '步骤'}数**: ${message.executionStats.total}\n`
      markdownContent += `- **成功**: ${message.executionStats.success}\n`
      markdownContent += `- **失败**: ${message.executionStats.failed}\n`
      markdownContent += `- **执行耗时**: ${message.executionStats.time}ms\n\n`
      
      if (message.executionStats.errors && message.executionStats.errors.length > 0) {
        markdownContent += `**执行错误:**\n\n`
        message.executionStats.errors.forEach((error, errorIndex) => {
          markdownContent += `${errorIndex + 1}. **${error.name}**: ${error.error}\n`
        })
        markdownContent += `\n`
      }
    }
    
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

const toggleTTS = () => {
  ttsEnabled.value = !ttsEnabled.value
  if (!ttsEnabled.value) {
    store.stopTTS()
  }
}

const toggleSidebar = () => {
  showSidebar.value = !showSidebar.value
}

const getModelDisplayName = (config: ChatConfig): string => {
  if (config.model) {
    return config.model.length > 20 ? config.model.substring(0, 20) + '...' : config.model
  }
  if (config.llmType === 'llama') {
    return 'llama (请选择GGUF模型)'
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
/* 样式保持不变，与原代码相同 */
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

.button.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.button.send-disabled {
  cursor: not-allowed;
}

.chat-list {
  flex: 1;
  overflow-y: auto;
  padding: 5px;
}

.chat-item {
  padding: 4px;
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

.chat-item.has-background-execution {
  border-color: rgba(255, 165, 0, 0.5);
  background-color: rgba(255, 165, 0, 0.05);
  animation: pulse-orange 2s infinite;
}

/* 不同模式的颜色样式 */
.chat-item.chat-retrieval {
  border-color: #f39c12 !important;
  background-color: rgba(243, 156, 18, 0.05) !important;
}

.chat-item.chat-retrieval.active {
  background-color: rgba(243, 156, 18, 0.15) !important;
  border-color: #f39c12 !important;
}

.chat-item.chat-workflow {
  border-color: #3498db !important;
  background-color: rgba(52, 152, 219, 0.05) !important;
}

.chat-item.chat-workflow.active {
  background-color: rgba(52, 152, 219, 0.15) !important;
  border-color: #3498db !important;
}

.chat-item.chat-skill {
  border-color: #9b59b6 !important;
  background-color: rgba(155, 89, 182, 0.05) !important;
}

.chat-item.chat-skill.active {
  background-color: rgba(155, 89, 182, 0.15) !important;
  border-color: #9b59b6 !important;
}

@keyframes pulse-orange {
  0% { border-color: rgba(255, 165, 0, 0.5); }
  50% { border-color: rgba(255, 165, 0, 0.2); }
  100% { border-color: rgba(255, 165, 0, 0.5); }
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
  width: 100%;
  position: relative;
}

.chat-title {
  font-weight: bold;
  font-size: 11px;
  color: var(--fontColor);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
  padding-right: 70px; /* 为右侧元素留出更多空间 */
}

.chat-item-right {
  display: flex;
  align-items: center;
  gap: 4px;
  position: absolute;
  right: 0px;
  top: 0px;
  z-index: 1;
}

/* 模式图标样式 */
.mode-icon {
  font-size: 10px;
  color: var(--fontColor);
  opacity: 0.7;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0; /* 防止图标被压缩 */
  margin-right: 3px;
}

.chat-item.chat-retrieval .mode-icon {
  color: #f39c12;
}

.chat-item.chat-workflow .mode-icon {
  color: #3498db;
}

.chat-item.chat-skill .mode-icon {
  color: #9b59b6;
}

.chat-actions {
  position: relative;
  right: auto;
  top: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.execution-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-right: 2px;
  color: var(--fontActiveColor);
}

.execution-indicator i {
  font-size: 12px;
  animation: spin 2s infinite linear;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(359deg); }
}

.chat-actions {
  opacity: 0;
  transition: opacity 0.2s;
  padding: 2px;
  border-radius: 3px;
  font-size: 12px;
}

.chat-item:hover .chat-actions {
  opacity: 0.6;
}

.chat-actions:hover {
  opacity: 1 !important;
  color: var(--fontActiveColor);
}

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
  align-items: center;
  flex-shrink: 0;
  height: 40px;
  width: calc(100% - 10px);
  overflow-x: auto;
  overflow-y: hidden;
  white-space: nowrap;
  -webkit-overflow-scrolling: touch;
  gap: 5px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.chat-header::-webkit-scrollbar {
  display: none;
}

.chat-title-input {
  flex: 2;
  border: 1px solid var(--borderColor);
  height: 30px;
  padding: 0 6px;
  margin: 0;
  background-color: var(--backgroundColor);
  min-width: 100px;
}

.model-select {
  flex: 1;
  height: 31px;
  padding: 0 4px;
  margin: 0px;
  min-width:85px
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

.execution-message {
  border-width: 2px;
}

.execution-running {
  animation: pulse-execution 2s infinite;
}

.execution-workflow {
  border-color: rgba(52, 152, 219, 0.3);
  background-color: rgba(52, 152, 219, 0.03);
}

.execution-skill {
  border-color: rgba(155, 89, 182, 0.3);
  background-color: rgba(155, 89, 182, 0.03);
}

.execution-running.execution-workflow {
  border-color: rgba(52, 152, 219, 0.5);
  background-color: rgba(52, 152, 219, 0.08);
  animation: pulse-workflow 2s infinite;
}

.execution-running.execution-skill {
  border-color: rgba(155, 89, 182, 0.5);
  background-color: rgba(155, 89, 182, 0.08);
  animation: pulse-skill 2s infinite;
}

@keyframes pulse-workflow {
  0% { border-color: rgba(52, 152, 219, 0.5); }
  50% { border-color: rgba(52, 152, 219, 0.2); }
  100% { border-color: rgba(52, 152, 219, 0.5); }
}

@keyframes pulse-skill {
  0% { border-color: rgba(155, 89, 182, 0.5); }
  50% { border-color: rgba(155, 89, 182, 0.2); }
  100% { border-color: rgba(155, 89, 182, 0.5); }
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
  flex-wrap: wrap;
}

.execution-badge {
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.execution-badge-workflow {
  background-color: rgba(52, 152, 219, 0.2);
  color: #3498db;
}

.execution-badge-skill {
  background-color: rgba(155, 89, 182, 0.2);
  color: #9b59b6;
}

.execution-badge-retrieval {
  background-color: rgba(243, 156, 18, 0.2);
  color: #f39c12;
}

.execution-progress {
  margin-left: 4px;
  font-size: 8px;
  opacity: 0.8;
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

.execution-status-container {
  margin: 0;
  padding: 5px;
  border-radius: 8px;
  animation: slideInDown 0.3s ease;
}

.execution-workflow .execution-status-container {
  border: 1px solid rgba(52, 152, 219, 0.3);
  background-color: rgba(52, 152, 219, 0.05);
}

.execution-skill .execution-status-container {
  border: 1px solid rgba(155, 89, 182, 0.3);
  background-color: rgba(155, 89, 182, 0.05);
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

.execution-progress-bar {
  height: 6px;
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-workflow {
  background-color: #3498db;
}

.progress-skill {
  background-color: #9b59b6;
}

.execution-unit-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
}

.execution-unit-item {
  padding: 4px;
  border-radius: 4px;
  border-left: 3px solid #95a5a6;
  background-color: var(--backgroundColor);
}

.unit-skill.unit-pending {
  border-left-color: #95a5a6;
  opacity: 0.6;
}

.unit-skill.unit-running {
  border-left-color: #9b59b6;
  background-color: rgba(155, 89, 182, 0.05);
}

.unit-skill.unit-success {
  border-left-color: #2ecc71;
  background-color: rgba(46, 204, 113, 0.05);
}

.unit-skill.unit-error {
  border-left-color: #e74c3c;
  background-color: rgba(231, 76, 60, 0.05);
}

.unit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  margin-bottom: 2px;
  padding-right: 4px;
}

.unit-header-left {
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 1;
  min-width: 0;
}

.unit-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.unit-header i {
  font-size: 10px;
  width: 12px;
}

.unit-type {
  font-size: 10px;
  color: #7f8c8d;
  background-color: rgba(0, 0, 0, 0.05);
  padding: 1px 4px;
  border-radius: 3px;
  white-space: nowrap;
}

.unit-description {
  font-size: 10px;
  color: var(--fontColor);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.unit-duration {
  font-size: 9px;
  color: #7f8c8d;
  background-color: rgba(0, 0, 0, 0.05);
  padding: 1px 4px;
  border-radius: 3px;
  white-space: nowrap;
}

.unit-index {
  font-size: 10px;
  color: #7f8c8d;
  background-color: rgba(0, 0, 0, 0.05);
  padding: 1px 6px;
  border-radius: 10px;
  white-space: nowrap;
}

.unit-details {
  padding: 0px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  animation: fadeIn 0.2s ease;
}

.unit-stream-content,
.unit-result-preview {
  border-radius: 3px;
  background-color: var(--backgroundColor);
}

.details-content {
  font-size: 10px;
  color: var(--fontColor);
  line-height: 1.4;
  max-height: 200px;
  overflow-y: auto;
  padding: 5px;
  background-color: rgba(0, 0, 0, 0.03);
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: monospace;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.unit-error-message {
  margin-top: 4px;
  padding: 4px;
  background-color: rgba(231, 76, 60, 0.1);
  border-radius: 4px;
  font-size: 10px;
  color: #e74c3c;
  display: flex;
  align-items: center;
  gap: 4px;
  border-left: 3px solid #e74c3c;
}

.execution-stats {
  margin-top: 10px;
  padding: 8px;
  border-radius: 6px;
}

.stats-workflow {
  border: 1px solid rgba(52, 152, 219, 0.2);
  background-color: rgba(52, 152, 219, 0.03);
}

.stats-skill {
  border: 1px solid rgba(155, 89, 182, 0.2);
  background-color: rgba(155, 89, 182, 0.03);
}

.stats-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: bold;
  margin-bottom: 8px;
}

.stats-workflow .stats-header {
  color: #3498db;
}

.stats-skill .stats-header {
  color: #9b59b6;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
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
}

.stats-workflow .stat-value {
  color: #3498db;
}

.stats-skill .stat-value {
  color: #9b59b6;
}

.execution-error-summary {
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

/* 图片预览区域 */
.image-preview-container {
  margin: 0px;
  padding: 0px;
  border: 1px solid rgba(52, 152, 219, 0.2);
  border-radius: 5px;
  background-color: rgba(52, 152, 219, 0.05);
}

.image-preview-item {
  position: relative;
  display: inline-block;
  margin: 0px;
  border-radius: 5px;
  overflow: hidden;
  transition: all 0.2s ease;
}

.image-preview-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.message-image {
  max-width: 200px;
  max-height: 200px;
  border-radius: 4px;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.message-image:hover {
  transform: scale(1.05);
}

.image-actions {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.image-preview-item:hover .image-actions {
  opacity: 1;
}

.image-action-button {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.6);
  border-radius: 4px;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 12px;
}

.image-action-button:hover {
  background-color: var(--fontActiveColor);
  transform: scale(1.1);
}

/* 输入区域的图片预览 */
.image-preview-area {
  margin-bottom: 8px;
  padding: 8px;
  border: 1px solid rgba(52, 152, 219, 0.2);
  border-radius: 8px;
  background-color: rgba(52, 152, 219, 0.05);
}

.image-preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--fontColor);
  font-weight: 500;
}

.clear-images-button {
  padding: 2px 6px;
  border-radius: 4px;
  background-color: rgba(231, 76, 60, 0.1);
  color: #e74c3c;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 11px;
}

.clear-images-button:hover {
  background-color: rgba(231, 76, 60, 0.2);
}

.image-preview-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 100px;
  overflow-y: auto;
}

.image-preview-item-small {
  position: relative;
  width: 60px;
  height: 60px;
  border-radius: 4px;
  overflow: hidden;
}

.preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-actions {
  position: absolute;
  top: 2px;
  right: 2px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.image-preview-item-small:hover .preview-actions {
  opacity: 1;
}

.preview-action-button {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.6);
  border-radius: 50%;
  color: white;
  cursor: pointer;
  font-size: 10px;
}

.preview-filename {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background-color: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 9px;
  padding: 2px 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 图片预览模态框 */
.image-preview-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

.modal-content {
  max-width: 90%;
  max-height: 90%;
  background-color: var(--backgroundColor);
  border-radius: 12px;
  padding: 5px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.3);
}

.full-size-image {
  max-width: 100%;
  max-height: calc(90vh - 80px);
  border-radius: 5px;
  display: block;
  margin: 0 auto;
}

.modal-actions {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 5px;
  margin-top: 5px;
}

.modal-button {
  padding: 5px;
  border: none;
  border-radius: 6px;
  background-color: var(--menuColor);
  color: var(--fontColor);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  flex: 1;
  min-width: 100px;
  font-size: 14px;
}

.modal-button i {
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-button span {
  display: inline-block;
  text-align: center;
}

.modal-button {
  line-height: 1.5;
  height: 40px;
}
.modal-button:hover {
  background-color: var(--menuActiveColor);
  color: var(--fontActiveColor);
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

.kb-tag .tag-similarity {
  color: var(--similarity-color);
}

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

/* 问答模式样式 */
.question-container {
  width: 100%;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.question-message {
  font-size: 13px;
  color: var(--fontColor);
  padding-bottom: 5px;
  border-radius: 4px;
  word-break: break-word;
}

.question-input-area {
  width: 100%;
}

.question-textarea {
  width: calc(100% - 12px);
  min-height: 60px;
  max-height: 120px;
  font-size: 12px;
  padding: 5px;
  line-height: 1.4;
  border: 1px solid var(--borderColor);
  border-radius: 4px;
  resize: vertical;
  background-color: var(--backgroundColor);
  color: var(--fontColor);
  font-family: inherit;
}

.question-textarea:focus {
  outline: none;
  border-color: var(--fontActiveColor);
  box-shadow: 0 0 0 2px rgba(var(--fontActiveColor-rgb), 0.1);
}

.question-actions {
  display: flex;
  flex-direction: row;
  gap: 5px;
}

.question-actions .button {
  background-color: var(--backgroundColor);
  border: 1px solid var(--borderColor);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 12px;
}

.question-actions .button:hover {
  background-color: var(--menuActiveColor);
  color: var(--fontActiveColor);
}

.question-actions .button i {
  font-size: 14px;
}

/* 输入区域 */
.input-area {
  padding: 5px;
  border-top: 1px solid var(--borderColor);
  flex-shrink: 0;
  position: relative;
}

.step-info-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
  flex-wrap: wrap;
  gap: 5px;
}

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

.step-indicator.step-skill-matching {
  background-color: rgba(52, 152, 219, 0.1);
  color: #3498db;
  border: 1px solid rgba(52, 152, 219, 0.2);
}

.step-indicator.step-skill-executing {
  background-color: rgba(155, 89, 182, 0.1);
  color: #9b59b6;
  border: 1px solid rgba(155, 89, 182, 0.2);
}

.step-indicator.step-executing {
  background-color: rgba(46, 204, 113, 0.1);
  color: #2ecc71;
  border: 1px solid rgba(46, 204, 113, 0.2);
}

.step-indicator.step-progress {
  background-color: rgba(52, 152, 219, 0.1);
  color: #3498db;
  border: 1px solid rgba(52, 152, 219, 0.2);
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

.step-indicator.step-info {
  background-color: rgba(52, 152, 219, 0.1);
  color: #3498db;
  border: 1px solid rgba(52, 152, 219, 0.2);
}

.step-indicator.step-testing {
  background-color: rgba(52, 152, 219, 0.1);
  color: #3498db;
  border: 1px solid rgba(52, 152, 219, 0.2);
}

.step-indicator.step-workflow {
  background-color: rgba(52, 152, 219, 0.1);
  color: #3498db;
  border: 1px solid rgba(52, 152, 219, 0.2);
}

.step-indicator.step-skill {
  background-color: rgba(155, 89, 182, 0.1);
  color: #9b59b6;
  border: 1px solid rgba(155, 89, 182, 0.2);
}

.step-indicator i {
  font-size: 12px;
}

@keyframes pulse {
  0% { opacity: 0.9; }
  50% { opacity: 1; }
  100% { opacity: 0.9; }
}

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

.retrieval-stats .stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--fontColor);
  white-space: nowrap;
}

.retrieval-stats .stat-item i {
  font-size: 10px;
  color: var(--fontActiveColor);
}

.retrieval-stats .stat-item span {
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

.button.workflow-running,
.button.execution-active {
  animation: pulse-execution 2s infinite;
}

.button.workflow-error {
  background-color: rgba(231, 76, 60, 0.2);
  color: #e74c3c;
}

.button.execution-loading {
  background-color: rgba(155, 89, 182, 0.2);
  color: #9b59b6;
  animation: pulse-skill-button 2s infinite;
}
.unit-decision-info{
  font-size: 10px;
  color: var(--fontColor);
  background-color: rgba(0, 0, 0, 0.02);
  padding: 4px;
}
@keyframes pulse-execution {
  0% { box-shadow: 0 0 0 0 rgba(52, 152, 219, 0.4); }
  70% { box-shadow: 0 0 0 4px rgba(52, 152, 219, 0); }
  100% { box-shadow: 0 0 0 0 rgba(52, 152, 219, 0); }
}

@keyframes pulse-skill-button {
  0% { box-shadow: 0 0 0 0 rgba(155, 89, 182, 0.4); }
  70% { box-shadow: 0 0 0 4px rgba(155, 89, 182, 0); }
  100% { box-shadow: 0 0 0 0 rgba(155, 89, 182, 0); }
}

/* 响应式调整 */
@media (max-width: 768px) {
  .chat-sidebar {
    width: 150px;
  }
  
  .chat-main {
    width: calc(100% - 150px);
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
  
  .retrieval-stats .stat-item {
    gap: 3px;
  }
  
  .retrieval-stats .stat-item i {
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
    grid-template-columns: repeat(2, 1fr);
  }

  .unit-type {
    min-width: 50px;
  }
}
</style>