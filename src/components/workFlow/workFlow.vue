<!-- src/components/workFlow/workFlow.vue -->
<template>
  <div class="workflow-editor">
    <div class="top-toolbar">
      <div class="toolbar-left">
        <div class="toolbar-group">
          <button class="toolbar-btn" @click="openWorkflow" :title="t('open_workflow')">
            <i class="fa fa-folder-open"></i>
          </button>
          <button class="toolbar-btn" @click="saveWorkflow" :title="t('save_workflow')">
            <i class="fa fa-save"></i>
          </button>
          <button class="toolbar-btn" @click="runWorkflow" :title="t('run_workflow')"
            :disabled="!isWorkflowValid || runner?.isRunning" :class="{ disabled: !isWorkflowValid || runner?.isRunning }">
            <i class="fa fa-play"></i>
          </button>
          <button class="toolbar-btn" @click="stopWorkflow" :title="t('stop_workflow')"
            :disabled="!runner?.isRunning">
            <i class="fa fa-stop"></i>
          </button>
          <button class="toolbar-btn" @click="resetNodeStatuses" :title="t('reset_status')">
            <i class="fa fa-refresh"></i>
          </button>
          <button class="toolbar-btn" :class="{ active: operationMode === 'linking' }" @click="toggleLinkMode" :title="t('link_mode')">
            <i class="fa fa-link"></i>
          </button>
          <button class="toolbar-btn" @click="resetWorkflow" :title="t('reset_workflow')">
            <i class="fa fa-trash"></i>
          </button>
          <button class="toolbar-btn" @click="zoomOut" :title="t('zoom_out')">
            <i class="fa fa-search-minus"></i>
          </button>
          <button class="toolbar-btn" @click="zoomIn" :title="t('zoom_in')">
            <i class="fa fa-search-plus"></i>
          </button>
          <button class="toolbar-btn" @click="runWorkflowBatch" 
              title="批量运行" 
              :class="{ disabled: !isWorkflowValid || runner?.isRunning || isBatchRunning }"
              :disabled="!isWorkflowValid || runner?.isRunning || isBatchRunning">
              <i class="fa fa-rocket"></i>
            </button>
            <select v-model="batchRunTimes" :disabled="isBatchRunning" title="运行次数">
              <option :value="1">1</option>
              <option :value="3">3</option>
              <option :value="5">5</option>
              <option :value="10">10</option>
              <option :value="20">20</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
              <option :value="200">200</option>
              <option :value="500">500</option>
              <option :value="1000">1000</option>
            </select>
            <button class="toolbar-btn" @click="saveBatchResultsToFolder" 
              title="保存批量运行结果到文件夹"
              :disabled="batchResults.length === 0 || isBatchRunning"
              :class="{ disabled: batchResults.length === 0 || isBatchRunning }">
              <i class="fa fa-file-excel-o"></i>
            </button>
            
            <button class="toolbar-btn" @click="clearBatchResults" 
              title="清空批量运行结果"
              :disabled="batchResults.length === 0 || isBatchRunning"
              :class="{ disabled: batchResults.length === 0 || isBatchRunning }">
              <i class="fa fa-trash"></i>
            </button>
        </div>
      </div>
      <div class="toolbar-right">
        <div class="toolbar-item stats">
          <span v-if="isBatchRunning" class="batch-spinner">
            <i class="fa fa-spinner fa-spin"></i> {{ Math.round(batchProgress) }}%
          </span>
          <span class="stat-item">
            <i class="fa fa-object-group"></i>
            {{ nodesCount }}
          </span>
          <span class="stat-item">
            <i class="fa fa-link"></i>
            {{ links.length }}
          </span>
          <span class="stat-item" @click="resetZoom">
            <i class="fa fa-search"></i>
            {{ (scale * 100).toFixed(0) }}%
          </span>
          <span v-if="runner?.isRunning" class="stat-item running">
            <i class="fa fa-spinner fa-spin"></i>
            {{ executionProgress }}%
          </span>
        </div>
      </div>
    </div>
    
    <div class="editor-main">
      <!-- 左侧面板 -->
      <div class="left-panel">
        <div class="panel-content scoll">
          <div 
            class="node-tool start" 
            draggable="true" 
            @dragstart="handleNodeDragStart('start', $event)" 
            @click="addNode('start')" 
            :title="t('start_node')"
          >
            <i class="fa fa-play-circle" style="color: #4CAF50;"></i>
          </div>
          <div 
            class="node-tool end" 
            draggable="true" 
            @dragstart="handleNodeDragStart('end', $event)" 
            @click="addNode('end')" 
            :title="t('end_node')"
          >
            <i class="fa fa-flag-checkered" style="color: #f44336;"></i>
          </div>
          <div 
            class="node-tool text" 
            draggable="true" 
            @dragstart="handleNodeDragStart('text', $event)" 
            @click="addNode('text')" 
            :title="t('text_node')"
          >
            <i class="fa fa-tag" style="color: #FF5722;"></i>
          </div>
          <div 
            class="node-tool local" 
            draggable="true" 
            @dragstart="handleNodeDragStart('local', $event)" 
            @click="addNode('local')" 
            :title="t('local_node')"
          >
            <i class="fa fa-file-text" style="color: #2196F3;"></i>
          </div>
          <div 
            class="node-tool web" 
            draggable="true" 
            @dragstart="handleNodeDragStart('web', $event)" 
            @click="addNode('web')" 
            :title="t('web_node')"
          >
            <i class="fa fa-search" style="color: #FF9800;"></i>
          </div>
          <div 
            class="node-tool webpage" 
            draggable="true" 
            @dragstart="handleNodeDragStart('webpage', $event)" 
            @click="addNode('webpage')" 
            :title="t('webpage_node')"
          >
            <i class="fa fa-globe" style="color: #795548;"></i>
          </div>
          <div 
            class="node-tool knowledge" 
            draggable="true" 
            @dragstart="handleNodeDragStart('knowledge', $event)" 
            @click="addNode('knowledge')" 
            :title="t('knowledge_node')"
          >
            <i class="fa fa-database" style="color: #9C27B0;"></i>
          </div>
          <div 
            class="node-tool structured" 
            draggable="true" 
            @dragstart="handleNodeDragStart('structured', $event)" 
            @click="addNode('structured')" 
            :title="t('structured_node')"
          >
            <i class="fa fa-table" style="color: #673AB7;"></i>
          </div>
          <div 
            class="node-tool reasoning" 
            draggable="true" 
            @dragstart="handleNodeDragStart('reasoning', $event)" 
            @click="addNode('reasoning')" 
            :title="t('reasoning_node')"
          >
            <i class="fa fa-microchip" style="color: #4CAF50;"></i>
          </div>
          <div 
            class="node-tool decision" 
            draggable="true" 
            @dragstart="handleNodeDragStart('decision', $event)" 
            @click="addNode('decision')" 
            :title="t('decision_node')"
          >
            <i class="fa fa-code-fork" style="color: #E91E63;"></i>
          </div>
          <div 
            class="node-tool python" 
            draggable="true" 
            @dragstart="handleNodeDragStart('python', $event)" 
            @click="addNode('python')" 
            :title="t('python_node')"
          >
            <i class="fa fa-code" style="color: #3776AB;"></i>
          </div>
          <div 
            class="node-tool mcp" 
            draggable="true" 
            @dragstart="handleNodeDragStart('mcp', $event)" 
            @click="addNode('mcp')" 
            :title="t('mcp_node')"
          >
            <i class="fa fa-plug" style="color: #00BCD4;"></i>
          </div>
        </div>
      </div>
      
      <div 
        class="canvas-container"
        ref="flowsContainer"
        @dragover="handleCanvasDragOver"
        @dragleave="handleCanvasDragLeave"
        @drop="handleCanvasDrop"
        @click="handleCanvasClick"
        :class="{ 'drag-over': dragOverCanvas }"
      >
        <svg
          class="canvas"
          ref="svgRef"
          :width="svgWidth"
          :height="svgHeight"
          :style="{ backgroundColor: 'var(--backgroundColor)' }"
        >
          <defs>
            <marker 
              id="arrow-head" 
              viewBox="0 0 10 10" 
              refX="8" 
              refY="5" 
              markerWidth="6" 
              markerHeight="6" 
              orient="auto"
              fill="var(--fontActiveColor)"
            >
              <path d="M0,0 L10,5 L0,10 Z" />
            </marker>
            
            <marker 
              id="mid-arrow" 
              viewBox="0 0 10 10" 
              refX="8" 
              refY="5" 
              markerWidth="6" 
              markerHeight="6"
              fill="var(--fontActiveColor)"
            >
              <path d="M0,0 L10,5 L0,10 Z" />
            </marker>
          </defs>
          
          <g :transform="`translate(${viewTransform.x},${viewTransform.y}) scale(${viewTransform.k})`">
            <!-- 连接线 -->
            <g class="links">
              <path
                v-for="link in links"
                :key="getLinkKey(link)"
                :d="getLinkPath(link)"
                class="link"
                :class="{ 
                  'branch-link': link.branch || link.sourcePort,  // 文件节点和决策节点都使用虚线
                }"
                stroke-width="2"
                fill="none"
                style="cursor: pointer"
              />
              
              <g
                v-for="link in links"
                :key="`arrow-${link.source}-${link.target}`"
                class="link-arrow"
              >
                <path
                  :transform="`translate(${getLinkMidpoint(link).x},${getLinkMidpoint(link).y}) rotate(${getLinkAngle(link)})`"
                  d="M-5,-5 L5,0 L-5,5 Z"
                  fill="white"
                  stroke="var(--borderColor)"
                  stroke-width="1"
                  @dblclick="handleLinkDoubleClick(link, $event)"
                  style="cursor: pointer"
                />
              </g>
            </g>
            
            <!-- 节点及其布局 -->
            <g class="nodes">
              <g
                v-for="node in items"
                :key="node.id"
                class="node"
                :data-id="node.id"
                :transform="`translate(${node.x}, ${node.y})`"
                @mousedown="startNodeDrag(node.id, $event)"
                @mouseenter="hoveredNodeId = node.id"
                @mouseleave="hoveredNodeId = null"
                style="cursor: move"
              >
                <rect
                  :width="node.width"
                  :height="node.height"
                  rx="8"
                  ry="8"
                  fill="var(--backgroundColor)"
                  :stroke="selectedNodeId === node.id ? 'var(--fontActiveColor)' : 
                           hoveredNodeId === node.id ? 'var(--fontActiveColor)' : 'var(--borderColor)'"
                  :stroke-width="selectedNodeId === node.id ? 2 : 1"
                  :style="{ filter: (selectedNodeId === node.id || hoveredNodeId === node.id) ? 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2))' : 'none' }"
                />
                
                <foreignObject x="5" y="5" width="24" height="24">
                  <div class="node-icon">
                    <i class="fa fa-fw" :class="getNodeIcon(node)" :style="{ color: getNodeIconColor(node) }"></i>
                  </div>
                </foreignObject>
                
                <g :transform="`translate(15, ${node.height - 12})`">
                  <circle r="4" :fill="getStatusColor(node.status)" />
                  <text x="10" y="3" font-size="10px" text-anchor="start" fill="var(--fontColor)">
                    {{ getStatusText(node.status) }}
                  </text>
                </g>
                
                <text 
                  :x="28" 
                  :y="22" 
                  font-size="14px" 
                  font-weight="500" 
                  fill="var(--fontColor)"
                >
                  {{ truncateText(node.name, 26) }}
                </text>
                
                <text 
                  :x="10" 
                  :y="42" 
                  font-size="12px" 
                  fill="var(--fontColor)" 
                  opacity="0.8"
                >
                  {{ getNodeDisplayConfig(node) }}
                </text>
                
                <text 
                  v-if="node.type === 'knowledge' && node.kbPath" 
                  :x="110" 
                  :y="43" 
                  font-size="10px" 
                  fill="var(--fontColor)" 
                  opacity="0.6"
                >
                  {{ truncateText(node.kbPath.split('/').pop()?.split('\\').pop() || '', 25) }}
                </text>
                
                <!-- 开始节点特殊处理：两个输出端口 -->
                <template v-if="node.type === 'start'">
                  <!-- 提示词输出端口（左侧） -->
                  <g class="connector start-prompt" :transform="`translate(${node.width * 0.3}, ${node.height})`"
                    @mousedown="handleStartNodeConnectorClick(node.id, 'prompt', $event)"
                    style="cursor: crosshair">
                    <circle r="6" :fill="getConnectorColor(node, 'start-prompt', 'prompt')" 
                      stroke="var(--backgroundColor)" stroke-width="2" />
                    <text x="0" y="15" text-anchor="middle" font-size="9px" fill="var(--fontColor)">
                      提示词
                    </text>
                  </g>
                  
                  <!-- 文件路径输出端口（右侧） -->
                  <g class="connector start-file" :transform="`translate(${node.width * 0.7}, ${node.height})`"
                    @mousedown="handleStartNodeConnectorClick(node.id, 'file', $event)"
                    style="cursor: crosshair">
                    <circle r="6" :fill="getConnectorColor(node, 'start-file', 'file')" 
                      stroke="var(--backgroundColor)" stroke-width="2" />
                    <text x="0" y="15" text-anchor="middle" font-size="9px" fill="var(--fontColor)">
                      文件路径
                    </text>
                  </g>
                </template>
                
                <!-- 决策节点分支连接点 -->
                <template v-else-if="node.type === 'decision'">
                   <!-- 顶部连接点（输入端口） -->
                  <g class="connector top" :transform="`translate(${node.width / 2}, 0)`"
                    @mousedown="handleConnectorClick(node.id, 'top', $event)"
                    style="cursor: crosshair">
                    <circle r="6" :fill="getConnectorColor(node, 'top')"
                      stroke="var(--backgroundColor)" stroke-width="2" />
                  </g>
                  <!-- 默认连接点（在节点底部左侧第一个位置） -->
                  <g class="connector default" :transform="getDefaultConnectorTransform(node)"
                    @mousedown="handleConnectorClick(node.id, 'bottom', $event)"
                    style="cursor: crosshair">
                    <circle r="6" :fill="getConnectorColor(node, 'default')" 
                      stroke="var(--backgroundColor)" stroke-width="2" />
                  </g>
                  
                  <!-- 分支连接点（在节点底部边界均匀分布） -->
                  <g v-for="(branch, index) in node.decisionBranches || []" :key="branch.id" class="connector branch"
                    :transform="getBranchConnectorTransform(node, index)"
                    @mousedown="handleDecisionBranchConnectorClick(node.id, branch.id, $event)"
                    style="cursor: crosshair">
                    <circle r="6" :fill="getConnectorColor(node, 'branch', branch.id)"
                      stroke="var(--backgroundColor)" stroke-width="2" />
                    <text x="0" y="-10" text-anchor="middle" font-size="9px" fill="var(--fontColor)">
                      {{ branch.name }}
                    </text>
                  </g>
                </template>
                
                <!-- 文件节点输出端口（模板模式） -->
                <template v-else-if="node.type === 'local' && node.fileMode === 'template'">
                   <!-- 顶部连接点（输入端口） -->
                  <g class="connector top" :transform="`translate(${node.width / 2}, 0)`"
                    @mousedown="handleConnectorClick(node.id, 'top', $event)"
                    style="cursor: crosshair">
                    <circle r="6" :fill="getConnectorColor(node, 'top')"
                      stroke="var(--backgroundColor)" stroke-width="2" />
                  </g>
                  <!-- 默认连接点（完整文件输出） -->
                  <g v-if="getFileNodeDefaultPortEnabled(node)" class="connector file-default" 
                     :transform="getFileNodeDefaultPortTransform(node)"
                     @mousedown="handleFileNodeConnectorClick(node.id, 'default', $event)"
                     style="cursor: crosshair">
                    <circle r="6" :fill="getConnectorColor(node, 'file-default', 'default')" 
                            stroke="var(--backgroundColor)" stroke-width="2" />
                    <text x="0" y="15" text-anchor="middle" font-size="9px" fill="var(--fontColor)">
                      全部
                    </text>
                  </g>
                  
                  <!-- 模板切片输出端口 -->
                  <g v-for="(port, index) in getFileNodeOutputPorts(node)" :key="port.id" 
                     class="connector file-port" :transform="getFileNodePortTransform(node, index)"
                     @mousedown="handleFileNodeConnectorClick(node.id, port.id, $event)"
                     style="cursor: crosshair">
                    <circle r="6" :fill="getConnectorColor(node, 'file-port', port.id)"
                            stroke="var(--backgroundColor)" stroke-width="2" />
                    <text x="0" y="15" text-anchor="middle" font-size="9px" fill="var(--fontColor)">
                      {{ port.name }}
                    </text>
                  </g>
                </template>
                
                <!-- 普通节点（除决策节点和开始节点外） -->
                <template v-else>
                  <!-- 顶部连接点（输入端口） -->
                  <g class="connector top" :transform="`translate(${node.width / 2}, 0)`"
                    @mousedown="handleConnectorClick(node.id, 'top', $event)"
                    style="cursor: crosshair">
                    <circle r="6" :fill="getConnectorColor(node, 'top')"
                      stroke="var(--backgroundColor)" stroke-width="2" />
                  </g>
                  
                  <!-- 底部连接点（输出端口） -->
                  <g class="connector bottom" :transform="`translate(${node.width / 2}, ${node.height})`"
                    @mousedown="handleConnectorClick(node.id, 'bottom', $event)"
                    style="cursor: crosshair">
                    <circle r="6" :fill="getConnectorColor(node, 'bottom')"
                      stroke="var(--backgroundColor)" stroke-width="2" />
                  </g>
                </template>
                
                <g v-if="hoveredNodeId === node.id" class="delete-btn" :transform="`translate(${node.width - 15}, 15)`"
                  @click="deleteNode(node.id)" @mousedown.stop style="cursor: pointer">
                  <circle r="6" fill="#f44336" />
                  <text text-anchor="middle" dy="0.3em" font-size="9px" font-weight="bold" fill="white">×</text>
                </g>
              </g>
            </g>
          </g>
        </svg>
        
        <div class="canvas-status" v-if="operationMode === 'linking'">
          <div class="status-indicator">
            <i class="fa fa-link"></i>
            <span>{{ linkingSourceId !== null ? t('select_target') : t('select_source') }}</span>
          </div>
        </div>
        
        <div v-if="dragOverCanvas" class="drop-indicator">
          <div class="drop-indicator-content">
            <i class="fa fa-plus-circle"></i>
            <span>{{ t('drag_to_add') }}</span>
          </div>
        </div>
      </div>
      
      <!-- 右侧属性面板 -->
      <div v-if="selectedNode" class="right-panel">
        <div class="right-panel-header">
          <h3><i class="fa fa-sliders"></i> {{ t('node_properties') }}</h3>
          <button class="close-btn" @click="selectedNodeId = null" :title="t('close')">
            <i class="fa fa-times"></i>
          </button>
        </div>
        
        <div class="right-panel-content scoll">
          <div class="property-group">
            <div class="property-row">
              <label class="property-label">{{ t('node_name') }}</label>
              <div class="property-input">
                <input type="text" v-model="selectedNode.name" :placeholder="t('name')" />
              </div>
            </div>
            <div class="property-row">
              <label class="property-label">{{ t('node_type') }}</label>
              <div class="property-input">
                <select v-model="selectedNode.type">
                  <option value="start">{{ t('start_node') }}</option>
                  <option value="end">{{ t('end_node') }}</option>
                  <option value="reasoning">{{ t('reasoning_node') }}</option>
                  <option value="decision">{{ t('decision_node') }}</option>
                  <option value="local">{{ t('local_node') }}</option>
                  <option value="web">{{ t('web_node') }}</option>
                  <option value="python">{{ t('python_node') }}</option>
                  <option value="text">{{ t('text_node') }}</option>
                  <option value="webpage">{{ t('webpage_node') }}</option>
                  <option value="knowledge">{{ t('knowledge_node') }}</option>
                  <option value="structured">{{ t('structured_node') }}</option>
                  <option value="mcp">{{ t('mcp_node') }}</option>
                </select>
              </div>
            </div>
          </div>
          
          <div class="property-group">
            <!-- 开始节点配置 -->
            <div v-if="selectedNode.type === 'start'">
              <div class="property-row">
                <label class="property-label">{{ t('start_input') }}</label>
                <div class="property-input">
                  <textarea class="scoll" style="width:calc(100% - 16px)" v-model="selectedNode.prompt" rows="4" 
                    :placeholder="t('start_placeholder')"></textarea>
                </div>
              </div>
              <div class="code-help">
                <small>{{ t('start_help_new') }}</small>
              </div>
            </div>
            
            <!-- 结束节点配置 -->
            <div v-if="selectedNode.type === 'end'">
              <div class="code-help">
                <small>{{ t('end_help') }}</small>
              </div>
            </div>
            
            <!-- 推理节点配置 -->
            <div v-if="selectedNode.type === 'reasoning'">
              <div class="property-row">
                <label class="property-label">{{ t('model_type') }}</label>
                <div class="property-input">
                  <select v-model="selectedNode.model_type" @change="selectedNode.model = ''">
                    <option v-for="type in (store.AIconfig?.llm?.types || [])" :key="type" :value="type">
                      {{ t(type) }}
                    </option>
                  </select>
                </div>
              </div>
              
              <div class="property-row">
                <label class="property-label">{{ t('model_name') }}</label>
                <div class="property-input">
                  <select v-model="selectedNode.model" :disabled="!selectedNode.model_type">
                    <option value="">{{ t('select_model') }}</option>
                    <option v-for="model in getAvailableModels" :key="model" 
                            :value="model">
                      {{ model }}
                    </option>
                  </select>
                </div>
              </div>
              
              <div class="property-row">
                <div class="property-input" :title="t('prompt_input')">
                  <textarea class="scoll" style="width:calc(100% - 16px)" v-model="selectedNode.prompt" rows="8" :placeholder="t('input_prompt')"></textarea>
                </div>
              </div>
            </div>
            
            <!-- 决策节点配置 -->
            <div v-if="selectedNode.type === 'decision'">
              <div class="property-row">
                <label class="property-label">{{ t('decision_mode') }}</label>
                <div class="property-input">
                  <select v-model="selectedNode.decisionMode" @change="onDecisionModeChange">
                    <option value="llm">{{ t('llm_decision') }}</option>
                    <option value="rule">{{ t('rule_decision') }}</option>
                  </select>
                </div>
              </div>
              
              <!-- LLM决策配置 -->
              <div v-if="selectedNode.decisionMode === 'llm'">
                <div class="property-row">
                  <label class="property-label">{{ t('model_type') }}</label>
                  <div class="property-input">
                    <select v-model="selectedNode.model_type" @change="selectedNode.model = ''">
                      <option v-for="type in (store.AIconfig?.llm?.types || [])" :key="type" :value="type">
                        {{ t(type) }}
                      </option>
                    </select>
                  </div>
                </div>
                
                <div class="property-row">
                  <label class="property-label">{{ t('model_name') }}</label>
                  <div class="property-input">
                    <select v-model="selectedNode.model" :disabled="!selectedNode.model_type">
                      <option value="">{{ t('select_model') }}</option>
                      <option v-for="model in getAvailableModels" :key="model" 
                              :value="model">
                        {{ model }}
                    </option>
                    </select>
                  </div>
                </div>
                
                <div class="property-row">
                  <label class="property-label">{{ t('decision_prompt') }}</label>
                  <div class="property-input">
                    <textarea class="scoll" style="width:calc(100% - 16px)" v-model="selectedNode.decisionPrompt" rows="6" 
                      :placeholder="t('decision_prompt_placeholder')"></textarea>
                  </div>
                </div>
              </div>
              
              <!-- 规则决策配置 -->
              <div v-if="selectedNode.decisionMode === 'rule'">
                <div class="property-row">
                  <label class="property-label">{{ t('decision_rules') }}</label>
                  <div class="property-input">
                    <textarea class="scoll" style="width:calc(100% - 16px)" v-model="selectedNode.decisionRules" rows="8" 
                      :placeholder="t('decision_rules_placeholder')"></textarea>
                  </div>
                </div>
                
                <div class="code-help">
                  <small>{{ t('rule_decision_help') }}</small>
                </div>
              </div>
              
              <!-- 分支管理 -->
              <div class="property-group" style="margin-top: 10px; padding: 8px; background-color: rgba(0, 0, 0, 0.02); border-radius: 5px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                  <h4 style="margin: 0; font-size: 14px; display: flex; align-items: center; gap: 5px;">
                    <i class="fa fa-code-fork"></i> {{ t('branch_management') }}
                  </h4>
                  <div style="display: flex; gap: 5px;">
                    <button class="property-btn small" @click="addDecisionBranch" 
                      :disabled="(selectedNode.decisionBranches?.length || 0) >= 10"
                      style="font-size: 11px; padding: 3px 8px; height: auto;">
                      <i class="fa fa-plus"></i> {{ t('add_branch') }}
                    </button>
                  </div>
                </div>
                
                <div v-if="selectedNode.decisionBranches && selectedNode.decisionBranches.length > 0">
                  <table class="branches-table" style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <thead>
                      <tr style="background-color: rgba(0, 0, 0, 0.05); position: sticky; top: 0;">
                        <th style="padding: 4px; border: 1px solid var(--borderColor); width: 80px;">{{ t('branch_name') }}</th>
                        <th style="padding: 4px; border: 1px solid var(--borderColor); width: 100px;">{{ t('branch_description') }}</th>
                        <th style="padding: 4px; border: 1px solid var(--borderColor);">{{ t('data_template') }}</th>
                        <th style="padding: 4px; border: 1px solid var(--borderColor); width: 50px; text-align: center;">{{ t('delete') }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="branch in selectedNode.decisionBranches" :key="branch.id">
                        <td style="padding: 2px; border: 1px solid var(--borderColor);">
                          <input 
                            type="text" 
                            v-model="branch.name" 
                            style="width: calc(100% - 8px); padding: 3px; font-size: 11px; border: 1px solid var(--borderColor); border-radius: 3px;"
                          />
                        </td>
                        <td style="padding: 2px; border: 1px solid var(--borderColor);">
                          <input 
                            type="text" 
                            v-model="branch.description" 
                            style="width: calc(100% - 8px); padding: 3px; font-size: 11px; border: 1px solid var(--borderColor); border-radius: 3px;"
                            :placeholder="t('branch_description_placeholder')"
                          />
                        </td>
                        <td style="padding: 2px; border: 1px solid var(--borderColor);">
                          <input 
                            type="text" 
                            v-model="branch.dataTemplate" 
                            style="width: calc(100% - 8px); padding: 3px; font-size: 11px; border: 1px solid var(--borderColor); border-radius: 3px; font-family: monospace;"
                            :placeholder="'{input}'"
                          />
                        </td>
                        <td style="padding: 2px; border: 1px solid var(--borderColor); text-align: center;">
                          <button 
                            class="property-btn danger small" 
                            @click="deleteDecisionBranch(branch.id)"
                            :disabled="(selectedNode.decisionBranches && selectedNode.decisionBranches.length <= 2) || runner?.isRunning"
                            style="font-size: 10px; padding: 2px 6px;"
                            :title="t('delete_branch')"
                          >
                            <i class="fa fa-trash"></i>
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                
                <div class="code-help" style="font-size: 11px; color: var(--fontColor); opacity: 0.7; margin-top: 5px;">
                  <small>
                    <i class="fa fa-info-circle"></i> 
                    {{ t('branch_management_help') }}
                  </small>
                </div>
              </div>
              
              <!-- 决策结果映射 -->
              <div v-if="selectedNode.decisionBranches && selectedNode.decisionBranches.length > 0" 
                   class="property-group" style="margin-top: 10px; padding: 8px; background-color: rgba(0, 0, 0, 0.02); border-radius: 5px;">
                <h4 style="margin: 0 0 8px 0; font-size: 14px; display: flex; align-items: center; gap: 5px;">
                  <i class="fa fa-random"></i> {{ t('decision_result_mapping') }}
                </h4>
                
                <div class="code-help" style="font-size: 11px; color: var(--fontColor); opacity: 0.7;">
                  <small>
                    <i class="fa fa-info-circle"></i> 
                    {{ t('decision_result_mapping_help') }}
                  </small>
                </div>
              </div>
              
              <div class="code-help" style="margin-top: 10px; font-size: 11px; color: var(--fontColor); opacity: 0.7;">
                <small>{{ t('decision_node_help') }}</small>
              </div>
            </div>
            
            <!-- 本地文件节点配置 -->
            <div v-if="selectedNode.type === 'local'">
              <div class="property-row">
                <label class="property-label">{{ t('file_path') }}</label>
                <div class="property-input">
                  <div style="display: flex; gap: 5px">
                    <input type="text" :value="getFileName(selectedNode.prompt)" readonly :placeholder="t('drag_file')" />
                    <input type="hidden" v-model="selectedNode.prompt" />
                    <button class="property-btn" style="margin-top:5px" @click="selectFile">
                      <i class="fa fa-folder-open"></i>
                    </button>
                  </div>
                </div>
              </div>
              
              <div class="property-row">
                <label class="property-label">{{ t('file_processing_mode') }}</label>
                <div class="property-input">
                  <select v-model="selectedNode.fileMode" @change="onFileModeChange">
                    <option value="full">{{ t('full_file_mode') }}</option>
                    <option value="template">{{ t('template_mode') }}</option>
                  </select>
                </div>
              </div>
              
              <!-- 完整文件模式不需要额外配置 -->
              <div v-if="selectedNode.fileMode === 'full'" class="code-help">
                <small>{{ t('full_file_mode_help') }}</small>
              </div>
              
              <div v-if="selectedNode.fileMode === 'template'">
                <div class="property-group" style="margin-top: 10px; padding: 8px; background-color: rgba(0, 0, 0, 0.02); border-radius: 5px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                    <h4 style="margin: 0; font-size: 14px; display: flex; align-items: center; gap: 5px;">
                      <i class="fa fa-list-alt"></i> {{ t('template_configuration') }}
                    </h4>
                    <button class="property-btn small" @click="addFileTemplate" 
                      style="font-size: 11px; padding: 3px 8px; height: auto;">
                      <i class="fa fa-plus"></i> {{ t('add_template') }}
                    </button>
                  </div>
                  
                  <div class="code-help" style="font-size: 11px; color: var(--fontColor); opacity: 0.7; margin-bottom: 8px;">
                    <small>
                      <i class="fa fa-info-circle"></i> 
                      {{ t('template_help') }}
                    </small>
                  </div>
                  
                  <div v-if="selectedNode.fileTemplates && selectedNode.fileTemplates.length > 0">
                    <table class="templates-table" style="width: 100%; border-collapse: collapse; font-size: 11px;">
                      <thead>
                        <tr style="background-color: rgba(0, 0, 0, 0.05); position: sticky; top: 0;">
                          <th style="padding: 4px; border: 1px solid var(--borderColor);">ID</th>
                          <th style="padding: 4px; border: 1px solid var(--borderColor);">{{ t('template_name') }}</th>
                          <th style="padding: 4px; border: 1px solid var(--borderColor);">{{ t('pattern') }}</th>
                          <th style="padding: 4px; border: 1px solid var(--borderColor); width: 10px;">🔗</th>
                          <th style="padding: 4px; border: 1px solid var(--borderColor); width: 10px;">{{ t('status') }}</th>
                          <th style="padding: 4px; border: 1px solid var(--borderColor); width: 10px; text-align: center;">{{ t('delete') }}</th>
                        </tr>
                      </thead>
                      <tbody>
                        <!-- 默认端口行 -->
                        <tr v-if="getFileNodeDefaultPortEnabled(selectedNode)">
                          <td style="padding: 2px; border: 1px solid var(--borderColor); text-align: center;">
                            full
                          </td>
                          <td style="padding: 2px; border: 1px solid var(--borderColor);">
                            <div style="display: flex; align-items: center; gap: 5px;">
                              <i class="fa fa-file-text" style="color: #4CAF50; font-size: 12px;"></i>
                              <span>{{ t('default_port') }}</span>
                            </div>
                          </td>
                          <td style="padding: 2px; border: 1px solid var(--borderColor); color: var(--fontColor); opacity: 0.7;">
                            {{ t('full_file') }}
                          </td>
                          <td style="padding: 2px; border: 1px solid var(--borderColor); text-align: center;">
                            {{ getPortConnectionCount(selectedNode.id, 'default') }}
                          </td>
                          <td style="padding: 2px; border: 1px solid var(--borderColor); text-align: center;">
                            <i class="fa fa-check-circle" style="color: #4CAF50;"></i>
                          </td>
                          <td style="padding: 2px; border: 1px solid var(--borderColor); text-align: center;">
                            <div style="height: 24px; display: flex; align-items: center; justify-content: center;">
                              <span style="color: var(--fontColor); opacity: 0.5; font-size: 10px;">-</span>
                            </div>
                          </td>
                        </tr>
                        
                        <!-- 模板端口行 -->
                        <tr v-for="(template, index) in selectedNode.fileTemplates" :key="index">
                          <td style="padding: 2px; border: 1px solid var(--borderColor); text-align: center;">
                            <code style="font-size: 10px; background: rgba(0,0,0,0.05); padding: 2px 5px; border-radius: 3px;">
                              {{ index + 1 }}
                            </code>
                          </td>
                          <td style="padding: 2px; border: 1px solid var(--borderColor);">
                            <input 
                              type="text" 
                              v-model="template.name" 
                              style="width: calc(100% - 8px); padding: 3px; font-size: 11px; border: 1px solid var(--borderColor); border-radius: 3px;"
                              :placeholder="t('template_name_placeholder')"
                            />
                          </td>
                          <td style="padding: 2px; border: 1px solid var(--borderColor);">
                            <input 
                              type="text" 
                              v-model="template.pattern" 
                              style="width: calc(100% - 8px); padding: 3px; font-size: 11px; border: 1px solid var(--borderColor); border-radius: 3px;"
                              :placeholder="t('pattern_placeholder')"
                            />
                          </td>
                          <td style="padding: 2px; border: 1px solid var(--borderColor); text-align: center;">
                            {{ getPortConnectionCount(selectedNode.id, `output${index + 1}`) }}
                          </td>
                          <td style="padding: 2px; border: 1px solid var(--borderColor); text-align: center;">
                            <i class="fa fa-check-circle" style="color: #4CAF50;"></i>
                          </td>
                          <td style="padding: 2px; border: 1px solid var(--borderColor); text-align: center;">
                            <button 
                              class="property-btn danger" 
                              @click="deleteFileTemplate(index)"
                              style="font-size: 10px; padding: 2px 6px; width: 100%;"
                              :title="t('delete_template')"
                            >
                              <i class="fa fa-trash"></i>
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  
                  <div v-else class="empty-templates-message" style="padding: 10px; text-align: center; color: var(--fontColor); opacity: 0.5; font-size: 12px;">
                    <i class="fa fa-info-circle"></i> {{ t('no_templates_configured') }}
                  </div>
                  
                  <div class="code-help" style="font-size: 11px; color: var(--fontColor); opacity: 0.7; margin-top: 5px;">
                    <small>
                      <i class="fa fa-info-circle"></i> 
                      {{ t('port_help') }}
                    </small>
                  </div>
                  
                  <button class="property-btn small" @click="refreshFileNodePorts" 
                    style="font-size: 11px; padding: 3px 8px; height: auto; margin-top: 8px; width: 100%;">
                    <i class="fa fa-sync"></i> {{ t('refresh_ports') }}
                  </button>
                </div>
                
                <div class="code-help" style="font-size: 11px; color: var(--fontColor); opacity: 0.7;">
                  <small>
                    <i class="fa fa-lightbulb-o"></i> 
                    {{ t('template_examples') }}
                  </small>
                </div>
              </div>
              
              <div class="code-help" style="margin-top: 10px;">
                <small>{{ t('local_node_help_new') }}</small>
              </div>
            </div>
            
            <div v-if="selectedNode.type === 'web'">
              <div class="property-row">
                <label class="property-label">{{ t('search_term') }}</label>
                <div class="property-input">
                  <input type="text" v-model="selectedNode.prompt" :placeholder="t('input_search')" />
                </div>
              </div>
            </div>
            
            <!-- Python 节点配置区域 -->
            <div v-if="selectedNode.type === 'python'">
              <div v-if="upstreamNodeInfo.length > 0" class="upstream-info">
                <div class="upstream-header">
                  <span>{{ t('upstream_info') }}</span>
                </div>
                <table class="upstream-table">
                  <thead>
                    <tr>
                      <th>{{ t('upstream_node_id') }}</th>
                      <th>{{ t('upstream_node_name') }}</th>
                      <th>{{ t('upstream_node_type') }}</th>
                      <th>{{ t('upstream_data_key') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="info in upstreamNodeInfo" :key="info.id">
                      <td>
                        <i :class="'fa '+info.icon" :style="{ color: info.iconColor, marginRight: '5px' }"></i>
                        {{ info.id }}
                      </td>
                      <td>{{ info.name }}</td>
                      <td>{{ info.type }}</td>
                      <td><code>{{ info.key }}</code></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <div class="code-help">
                <small v-if="upstreamNodeInfo.length > 0">
                  <i class="fa fa-info-circle"></i> 
                  <template v-if="upstreamNodeInfo.length === 1">
                    {{ t('connected_node') }}。{{ t('input_dict') }} {{ t('contains_data') }}。<br>
                    {{ t('access_data') }} <code>input['{{ upstreamNodeInfo[0].key }}']</code>。
                  </template>
                  <template v-else>
                    {{ t('connected_nodes') }}。{{ t('input_dict') }} {{ t('contains_all_data') }}。<br>
                    {{ t('available_keys') }}:
                    <span v-for="(info, index) in upstreamNodeInfo" :key="info.id">
                      <code>{{ info.key }}</code>{{ index < upstreamNodeInfo.length - 1 ? ',' : '' }}
                    </span>
                  </template>
                </small>
                <small v-else-if="hasUpstreamCodeInput">
                  <i class="fa fa-info-circle"></i> {{ t('readonly_code') }} {{ t('edit_upstream') }}
                </small>
                <small v-else>
                  {{ t('available_vars') }}: <code>input</code> ({{ t('input_var') }}), <code>output</code> ({{ t('output_var') }}), <code>log()</code> ({{ t('log_func') }})<br>
                  {{ t('import_modules') }}: <code>import json, math, datetime, re, random</code> {{ t('standard_libs') }}<br>
                  {{ t('security_note') }}
                </small>
              </div>

              <div class="property-row">
                <div class="property-input">
                  <textarea 
                    v-model="selectedNode.prompt" 
                    rows="10" 
                    :placeholder="t('input_code')" 
                    class="code-textarea scoll"
                    :readonly="hasUpstreamCodeInput"
                    :class="{ 'readonly-textarea': hasUpstreamCodeInput }"
                  ></textarea>
                </div>
              </div>
            </div>
            
            <div v-if="selectedNode.type === 'text'">
              <div class="property-row">
                <label class="property-label">{{ t('text_content') }}</label>
                <div class="property-input">
                  <textarea class="scoll" style="width: calc(100% - 12px);" v-model="selectedNode.prompt" rows="8" :placeholder="t('input_text')"></textarea>
                </div>
              </div>
            </div>
            
            <div v-if="selectedNode.type === 'webpage'">
              <div class="property-row">
                <label class="property-label">{{ t('url_input') }}</label>
                <div class="property-input">
                  <input type="text" v-model="selectedNode.prompt" placeholder="https://example.com" />
                </div>
              </div>
              <div class="code-help">
                <small>{{ t('jina_api') }}</small>
              </div>
            </div>
            
            <!-- 知识库节点配置 -->
            <div v-if="selectedNode.type === 'knowledge'">
              <div class="property-row">
                <label class="property-label">{{ t('kb_path') }}</label>
                <div class="property-input">
                  <div style="display: flex; gap: 5px">
                    <input type="text" v-model="selectedNode.kbPath" readonly :placeholder="t('drag_kb_file')" />
                    <button class="property-btn" style="margin-top:5px" @click="selectKnowledgeBaseFile">
                      <i class="fa fa-folder-open"></i>
                    </button>
                  </div>
                </div>
              </div>
              
              <!-- 知识库验证状态 -->
              <div v-if="selectedNode.kbValidation" class="kb-validation">
                <div :class="['validation-status', selectedNode.kbValidation.valid ? 'valid' : 'invalid']">
                  <i class="fa" :class="selectedNode.kbValidation.valid ? 'fa-check-circle' : 'fa-exclamation-triangle'"></i>
                  <span>
                    {{ selectedNode.kbValidation.valid ? '知识库验证通过' : '知识库验证失败' }}
                    <span v-if="selectedNode.kbValidation?.availableModel">
                      (可用模型: {{ selectedNode.kbValidation.availableModel }})
                    </span>
                  </span>
                </div>
                <div v-if="selectedNode.kbValidation.issues && selectedNode.kbValidation.issues.length > 0" class="validation-issues">
                  <small v-for="(issue, index) in selectedNode.kbValidation.issues" :key="index">
                    <i class="fa fa-exclamation-circle"></i> {{ issue }}
                  </small>
                </div>
              </div>
              
              <div class="property-row">
                <label class="property-label">{{ t('query_input') }}</label>
                <div class="property-input">
                  <input type="text" v-model="selectedNode.kbQuery" :placeholder="t('input_search') + '...'" />
                </div>
              </div>
              <div class="property-row">
                <label class="property-label">{{ t('top_k') }}</label>
                <div class="property-input">
                  <input 
                    type="number" 
                    :value="selectedNode.kbOptions?.topK || defaultKbOptions.topK" 
                    @input="updateKbOption('topK', ($event.target as HTMLInputElement).value)"
                    min="1" max="20"
                  />
                </div>
              </div>
              <div class="code-help">
                <small>{{ t('kb_help') }}</small>
                <br>
                <small v-if="upstreamNodeInfo.length > 0">
                  {{ t('kb_query_help') }}。当前连接了{{ upstreamNodeInfo.length }}个上游节点，查询文本将自动从上游节点构建。
                </small>
              </div>
            </div>
            
            <!-- 结构化输入节点配置 -->
            <div v-if="selectedNode.type === 'structured'">
              <!-- 表格描述 -->
              <div class="property-row">
                <label class="property-label">{{ t('table_description') }}</label>
                <div class="property-input">
                  <input 
                    type="text" 
                    :value="selectedNode.structuredConfig?.tableDescription || ''" 
                    @input="updateStructuredConfig('tableDescription', ($event.target as HTMLInputElement).value)"
                    :placeholder="t('input_table_description')"
                    style="width: calc(100% - 8px);"
                  />
                </div>
              </div>
              
              <!-- 列管理 -->
              <div class="property-group" style="margin-top: 10px; padding: 8px; background-color: rgba(0, 0, 0, 0.02); border-radius: 5px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                  <h4 style="margin: 0; font-size: 14px; display: flex; align-items: center; gap: 5px;">
                    <i class="fa fa-columns"></i> {{ t('column_management') }}
                  </h4>
                  <div style="flex:1"></div>
                  <button class="property-btn primary small" @click="addStructuredColumn" style="font-size: 11px; padding: 3px 8px; height: auto;">
                    <i class="fa fa-plus"></i> {{ t('add_column') }}
                  </button>
                </div>
                
                <div v-if="selectedNode.structuredColumns && selectedNode.structuredColumns.length > 0">
                  <table class="columns-table" style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <thead>
                      <tr style="background-color: rgba(0, 0, 0, 0.05); position: sticky; top: 0;">
                        <th style="padding: 4px; border: 1px solid var(--borderColor);">{{ t('column_name') }}</th>
                        <th style="padding: 4px; border: 1px solid var(--borderColor); width: 80px;">{{ t('column_type') }}</th>
                        <th style="padding: 4px; border: 1px solid var(--borderColor); width: 60px; text-align: center;">{{ t('required') }}</th>
                        <th style="padding: 4px; border: 1px solid var(--borderColor); width: 40px; text-align: center;">{{ t('delete') }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(column, index) in selectedNode.structuredColumns" :key="column.id">
                        <td style="padding: 2px; border: 1px solid var(--borderColor);">
                          <input 
                            type="text" 
                            :value="column.name" 
                            @input="updateStructuredColumn(column.id, 'name', ($event.target as HTMLInputElement).value)"
                            style="width: calc(100% - 8px); padding: 3px; font-size: 11px; border: 1px solid var(--borderColor); border-radius: 3px;"
                          />
                        </td>
                        <td style="padding: 2px; border: 1px solid var(--borderColor);">
                          <select 
                            :value="column.type" 
                            @change="updateStructuredColumn(column.id, 'type', ($event.target as HTMLSelectElement).value)"
                            style="width: 100%; padding: 3px; font-size: 11px; border: 1px solid var(--borderColor); border-radius: 3px;"
                          >
                            <option value="text">{{ t('text_type') }}</option>
                            <option value="number">{{ t('number_type') }}</option>
                            <option value="boolean">{{ t('boolean_type') }}</option>
                            <option value="date">{{ t('date_type') }}</option>
                          </select>
                        </td>
                        <td style="padding: 2px; border: 1px solid var(--borderColor); text-align: center;">
                          <input 
                            type="checkbox" 
                            :checked="column.required" 
                            @change="updateStructuredColumn(column.id, 'required', ($event.target as HTMLInputElement).checked)"
                            :disabled="index < 2"
                          />
                        </td>
                        <td style="padding: 2px; border: 1px solid var(--borderColor); text-align: center;">
                          <button 
                            class="property-btn danger small" 
                            @click="deleteStructuredColumn(column.id)"
                            :disabled="selectedNode.structuredColumns && selectedNode.structuredColumns.length <= 2"
                            style="font-size: 10px; padding: 2px 6px;"
                            :title="t('delete_column')"
                          >
                            <i class="fa fa-trash"></i>
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                
                <div class="code-help" style="font-size: 11px; color: var(--fontColor); opacity: 0.7; margin-top: 5px;">
                  <small>
                    <i class="fa fa-info-circle"></i> 
                    {{ t('json_key_value_info') }}
                  </small>
                </div>
              </div>
              
              <!-- 数据表格 -->
              <div class="property-group" style="margin-top: 10px; padding: 8px; background-color: rgba(0, 0, 0, 0.02); border-radius: 5px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                  <h4 style="margin: 0; font-size: 14px; display: flex; align-items: center; gap: 5px;">
                    <i class="fa fa-table"></i> {{ t('data_table') }}
                  </h4>
                  <div style="flex:1"></div>
                  <button class="property-btn primary small" @click="addStructuredRow" style="font-size: 11px; padding: 3px 8px; height: auto;">
                    <i class="fa fa-plus"></i> {{ t('add_row') }}
                  </button>
                </div>
                
                <div v-if="selectedNode.structuredData && selectedNode.structuredData.length > 0">
                  <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <thead>
                      <tr style="position: sticky; top: 0; background-color: var(--backgroundColor); z-index: 1;">
                        <th style="padding: 4px; text-align: center; width: 30px; border: 1px solid var(--borderColor);">
                          {{ t('row_number') }}
                        </th>
                        <th v-for="column in selectedNode.structuredColumns" :key="column.id" 
                            style="padding: 4px; border: 1px solid var(--borderColor); min-width: 80px; font-size: 10px;">
                          {{ column.name }}
                          <span v-if="column.required" style="color: #f44336; margin-left: 2px;">*</span>
                        </th>
                        <th style="padding: 4px; text-align: center; width: 40px; border: 1px solid var(--borderColor);">
                          {{ t('delete') }}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in selectedNode.structuredData" :key="row.id">
                        <td style="text-align: center; padding: 4px; border: 1px solid var(--borderColor); font-size: 10px; color: var(--fontColor); opacity: 0.7;">
                          {{ row.id + 1 }}
                        </td>
                        <td v-for="column in selectedNode.structuredColumns" :key="column.id" 
                            style="padding: 2px; border: 1px solid var(--borderColor);">
                          <input 
                            type="text" 
                            :value="row.columns[column.id.toString()] || ''" 
                            @input="updateStructuredRow(row.id, column.id.toString(), ($event.target as HTMLInputElement).value)"
                            :class="{ 'required-error': column.required && !row.columns[column.id.toString()] }"
                            style="width: calc(100% - 8px); padding: 3px; font-size: 11px; border: 1px solid var(--borderColor); border-radius: 3px;"
                            :placeholder="column.name"
                          />
                        </td>
                        <td style="text-align: center; padding: 2px; border: 1px solid var(--borderColor);">
                          <button 
                            class="property-btn danger small" 
                            @click="deleteStructuredRow(row.id)"
                            style="font-size: 10px; padding: 2px 6px;"
                            :title="t('delete_row')"
                          >
                            <i class="fa fa-trash"></i>
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div v-else class="empty-table-message" style="padding: 10px; text-align: center; color: var(--fontColor); opacity: 0.5; font-size: 12px;">
                  <i class="fa fa-info-circle"></i> {{ t('empty_table') }}
                </div>
              </div>
              
              <!-- 输出格式配置 -->
              <div class="property-group" style="margin-top: 10px; padding: 8px; background-color: rgba(0, 0, 0, 0.02); border-radius: 5px;">
                <h4 style="margin: 0 0 8px 0; font-size: 14px; display: flex; align-items: center; gap: 5px;">
                  <i class="fa fa-cog"></i> {{ t('format_options') }}
                </h4>
                
                <div class="property-row" style="margin-bottom: 8px;">
                  <label class="property-label" style="width: 80px; font-size: 12px;">{{ t('output_format') }}</label>
                  <div class="property-input">
                    <select 
                      :value="selectedNode.structuredConfig?.outputFormat || 'json'" 
                      @change="updateStructuredConfig('outputFormat', ($event.target as HTMLSelectElement).value)"
                      style="width: 100%; padding: 3px; font-size: 11px; border: 1px solid var(--borderColor); border-radius: 3px;"
                    >
                      <option value="json">{{ t('format_json') }}</option>
                      <option value="markdown">{{ t('format_markdown') }}</option>
                      <option value="text">{{ t('format_text') }}</option>
                      <option value="csv">{{ t('format_csv') }}</option>
                    </select>
                  </div>
                </div>
                
                <div v-if="(selectedNode.structuredConfig?.outputFormat || 'json') === 'markdown' || (selectedNode.structuredConfig?.outputFormat || 'json') === 'csv'" 
                     class="property-row">
                  <label class="property-label" style="width: 80px; font-size: 12px;">{{ t('include_headers') }}</label>
                  <div class="property-input">
                    <input 
                      type="checkbox" 
                      :checked="selectedNode.structuredConfig?.includeHeaders !== false" 
                      @change="updateStructuredConfig('includeHeaders', ($event.target as HTMLInputElement).checked)"
                      style="margin-top: 5px;"
                    />
                  </div>
                </div>
              </div>
              
              <!-- 输出预览 -->
              <div v-if="selectedNode.structuredData && selectedNode.structuredData.length > 0" 
                   class="output-preview" style="margin-top: 10px; padding: 8px; background-color: rgba(0, 0, 0, 0.03); border-radius: 5px; border: 1px solid var(--borderColor);">
                <h5 style="margin: 0 0 5px 0; font-size: 13px; color: var(--fontColor); display: flex; align-items: center; gap: 5px;">
                  <i class="fa fa-eye"></i> {{ t('output_preview') }}
                </h5>
                <pre style="margin: 0; font-size: 10px; white-space: pre-wrap; max-height: 100px; overflow-y: auto; font-family: 'Consolas', 'Monaco', monospace;" class="scoll">
{{ getStructuredOutputPreview() }}
                </pre>
              </div>
              
              <div class="code-help" style="margin-top: 10px; font-size: 11px; color: var(--fontColor); opacity: 0.7;">
                <small>{{ t('structured_help') }}</small>
              </div>
            </div>

            <!-- MCP节点配置区域 -->
            <div v-if="selectedNode.type === 'mcp'">
              <McpNodeProperties
                :node="selectedNode"
                @test-mcp-connection="testMcpConnection"
                @connect-mcp-node="connectMcpNode"
                @disconnect-mcp-node="disconnectMcpNode"
                @refresh-mcp-tools="refreshMcpTools"
                @save="saveToLocalStorage"
              />
            </div>
          </div>
          
          <div class="property-row">
            <button class="property-btn primary" @click="runSingleNode"
              :disabled="selectedNode.status === 'running' || runner?.isRunning">
              <i class="fa fa-play"></i> 
              {{ selectedNode.status === 'running' ? t('running') : t('run') }}
            </button>
            <button class="status-badge" :class="selectedNode.status">
              <i class="fa" :class="getStatusIcon(selectedNode.status)"></i>
              {{ getStatusText(selectedNode.status) }}
            </button>
            <button 
              class="property-btn danger" 
              @click="selectedNodeId !== null && deleteNode(selectedNodeId)"
              :disabled="selectedNodeId === null || runner?.isRunning"
              :title="t('delete')"
            >
              <i class="fa fa-trash"></i>
            </button>
          </div>
          
          <div style="margin-top: 5px; flex: 1; border-radius: 5px; border: 1px solid var(--borderColor);">
            <block_md :content="getResultContent(selectedNode.result)" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed, watch, nextTick, type Ref } from 'vue'
import * as d3 from 'd3'
import { usestore } from '../../store'
import block_md from '../block_md.vue'
import * as XLSX from 'xlsx'

// 导入工作流运行器
import { WorkflowRunner, type NodeData, type Link, type WorkflowData, type NodeType, type McpConfig, type FileMode, type FileTemplate } from '../../utils/workflowRunner'

// 导入知识库检索模块
import { validateKnowledgeBase } from '../../utils/kbRetrieval'
import McpNodeProperties from './McpNodeProperties.vue'
const store = usestore()

// 定义本地化字典类型
interface LocaleDict {
  [key: string]: {
    [key: string]: string
  }
}

// 本地化文本 - 添加新增的文本
const t = (key: string): string => {
  const locales: LocaleDict = {
    zh: {
      // 新增开始节点相关文本
      'start_placeholder': '请输入文本或使用格式: 提示词|文件路径',
      'start_help_new': '开始节点: 可以输入单个文本，或使用"|"分隔符传递两个参数，格式为"提示词|文件路径"。系统会自动读取文件内容并与提示词合并。',
      
      // 新增本地节点相关文本
      'file_processing_mode': '处理模式',
      'full_file_mode': '完整文件模式',
      'template_mode': '模板匹配模式',
      'full_file_mode_help': '完整文件模式: 读取整个文件内容并作为单个字符串输出，只有一个输出端口',
      'template_configuration': '模板配置',
      'add_template': '添加模板',
      'template_help': '配置匹配模板和输出名称，系统将根据模板在文件中进行字符串匹配并切片',
      'template_name': '模板名称',
      'pattern': '匹配模式',
      'output_name': '输出名称',
      'template_name_placeholder': '例如: 第一章',
      'pattern_placeholder': '例如: 第一章',
      'output_name_placeholder': '例如: chapter_1',
      'delete_template': '删除模板',
      'no_templates_configured': '尚未配置模板',
      'template_examples': '示例: 第一章、第二章、Section 1、第[一二三四]章等。每个匹配到的字符串将作为一个切片，切片内容从该字符串开始到下一个匹配字符串之前。',
      'local_node_help_new': '本地文件节点: 支持两种处理模式。完整文件模式: 返回整个文件内容。模板匹配模式: 根据配置的模板进行字符串匹配和切片，每个切片通过不同的输出端口返回。',
      
      // 新增输出端口相关文本
      'output_ports_status': '输出端口状态',
      'refresh_ports': '刷新端口',
      'port_name': '端口名称',
      'default_port': '默认',
      'full_file': '完整文件',
      'port_help': '每个模板匹配到的切片会通过对应的输出端口传递到下游节点。点击端口可以进行连接。',
      
      // 其他已有文本...
      'mcp_node': 'MCP节点',
      
      // 决策节点相关
      'decision_node': '决策节点',
      'decision_mode': '决策模式',
      'llm_decision': '大模型决策',
      'rule_decision': '规则决策',
      'decision_prompt': '决策提示词',
      'decision_prompt_placeholder': '请输入决策提示词，例如：根据输入内容判断属于哪个类别...',
      'decision_rules': '决策规则',
      'decision_rules_placeholder': '请输入JSON格式的决策规则，例如：{"condition": "input.length > 10", "branch": "branch_1"}',
      'branch_management': '分支管理',
      'add_branch': '添加分支',
      'delete_branch': '删除分支',
      'branch_name': '分支名称',
      'branch_description': '分支描述',
      'branch_description_placeholder': '分支描述...',
      'branch_management_help': '决策节点支持2-10个分支，每个分支可以连接到不同的下游节点',
      'decision_result_mapping': '决策结果映射',
      'decision_result_mapping_help': '决策结果将映射到对应的分支，后续工作流将沿选定分支继续执行',
      'rule_decision_help': '规则决策支持简单的条件表达式，使用JSON格式定义规则',
      'decision_node_help': '决策节点可以根据输入内容选择不同的分支执行路径，支持基于大模型的智能决策和基于规则的简单决策',
      'waiting_decision': '等待决策',
      'running_decision': '正在决策',
      'decision_error': '决策错误',
      'selected_branch': '选定分支',
      
      // 通用
      'workflow': '工作流',
      'save': '保存',
      'open': '打开',
      'reset': '重置',
      'run': '运行',
      'running': '运行中',
      'idle': '待执行',
      'success': '成功',
      'error': '错误',
      'nodes': '节点',
      'links': '连接',
      'zoom': '缩放',
      'connect': '连接',
      'settings': '设置',
      'delete': '删除',
      'close': '关闭',
      'properties': '属性',
      'name': '名称',
      'type': '类型',
      'model': '模型',
      'prompt': '提示词',
      'result': '结果',
      'status': '状态',
      'text': '文本',
      'file': '文件',
      'search': '搜索',
      'webpage': '网页',
      'reasoning': '推理',
      'code': '代码',
      'python': 'Python',
      'select': '选择',
      'input': '输入',
      'output': '输出',
      'upload': '上传',
      'drag': '拖拽',
      'drop': '放下',
      'knowledge': '知识库',
      'structured': '结构化',
      'start': '开始',
      'end': '结束',
      'stop': '停止',
      'stop_workflow': '停止工作流',
      
      // 节点类型
      'text_node': '文本节点',
      'local_node': '本地文件节点',
      'web_node': '网络搜索',
      'webpage_node': '网页节点',
      'reasoning_node': '推理节点',
      'python_node': 'Python节点',
      'knowledge_node': '知识库节点',
      'structured_node': '结构化输入节点',
      'start_node': '开始节点',
      'end_node': '结束节点',
      
      // 结构化节点相关
      'structured_input': '结构化输入',
      'table_editor': '表格编辑器',
      'table_description': '表格描述',
      'input_table_description': '输入表格描述...',
      'add_row': '添加行',
      'delete_row': '删除行',
      'add_column': '添加列',
      'delete_column': '删除列',
      'key_column': '键',
      'value_column': '值',
      'description_column': '描述',
      'column_name': '列名',
      'column_type': '列类型',
      'text_type': '文本',
      'number_type': '数字',
      'boolean_type': '布尔值',
      'date_type': '日期',
      'required': '必填',
      'column': '列',
      'column_management': '列管理',
      'data_table': '数据表格',
      'row_number': '序号',
      'empty_table': '表格为空',
      'format_options': '格式选项',
      'output_format': '输出格式',
      'format_json': 'JSON格式',
      'format_markdown': 'Markdown表格',
      'format_text': '纯文本',
      'format_csv': 'CSV格式',
      'include_headers': '包含表头',
      'output_preview': '输出预览',
      
      // 提示信息
      'no_model': '无模型',
      'select_model': '请选择模型',
      'input_prompt': '请输入提示词',
      'input_text': '请输入文本内容',
      'input_code': '请输入代码',
      'input_url': '请输入网址',
      'input_search': '请输入搜索关键词',
      'select_file': '请选择文件',
      'drag_file': '请拖入文件或点击选择',
      'drag_kb_file': '拖入知识库文件 (.kb)',
      'select_kb_file': '选择知识库文件',
      'waiting': '等待处理',
      'waiting_search': '等待搜索',
      'waiting_fetch': '等待获取',
      'waiting_reasoning': '等待推理',
      'waiting_execute': '等待执行',
      'waiting_retrieval': '等待检索',
      'waiting_structured': '等待结构化输入',
      'waiting_start': '等待输入',
      'waiting_end': '等待汇总',
      'running_reasoning': '正在推理',
      'running_search': '正在搜索',
      'running_fetch': '正在获取网页内容',
      'running_read': '正在读取文件',
      'running_execute': '正在执行',
      'running_python': '正在执行Python代码',
      'running_retrieval': '正在检索知识库',
      'running_structured': '正在生成结构化输出',
      'running_start': '正在获取输入',
      'running_end': '正在汇总输出',
      'no_execute': '未执行',
      
      // 按钮文本
      'run_workflow': '运行工作流',
      'run_all': '运行所有节点',
      'open_workflow': '打开工作流',
      'save_workflow': '保存工作流',
      'reset_workflow': '重置工作流',
      'link_mode': '连接模式',
      'zoom_in': '放大',
      'zoom_out': '缩小',
      'reset_zoom': '重置缩放',
      
      // 属性面板
      'node_properties': '节点属性',
      'node_name': '节点名称:',
      'node_type': '节点类型:',
      'model_selection': '模型:',
      'prompt_input': '提示词',
      'file_path': '文件路径:',
      'file_type': '文件类型:',
      'search_term': '搜索词:',
      'url_input': '网址:',
      'python_code': 'Python代码:',
      'text_content': '文本内容:',
      'kb_path': '知识库路径:',
      'kb_config': '知识库配置:',
      'query_input': '查询输入:',
      'retrieval_options': '检索选项',
      'top_k': '召回数量:',
      'summary_weight': '摘要权重:',
      'use_reverse': '使用反推:',
      'reverse_weight': '反推权重:',
      'embed_model': '嵌入模型:',
      'debug_mode': '调试模式:',
      'retrieval_result': '检索结果',
      'structured_table': '结构表格:',
      'start_input': '输入文本:',
      'end_output': '输出结果:',
      
      // 模型类型
      'model_type': '模型类型',
      'ollama': 'Ollama',
      'openai': 'OpenAI',
      'deepseek': 'DeepSeek',
      'anthropic': 'Anthropic Claude',
      'google': 'Google Gemini',
      'azure': 'Azure OpenAI',
      'custom': '自定义',
      
      // 模型配置
      'model_name': '模型名称',
      'api_key': 'API密钥',
      'api_url': 'API地址',
      'base_url': '基础地址',
      'endpoint': '端点',
      'deployment': '部署',
      'api_version': 'API版本',
      'custom_config': '自定义配置',
      
      // 帮助文本
      'available_vars': '可用变量',
      'input_var': '上游节点结果',
      'output_var': '输出结果',
      'log_func': '日志函数',
      'jina_api': '使用 Jina AI Reader API 获取网页内容',
      'security_note': '安全限制: 禁止文件系统访问、网络请求等危险操作',
      'import_modules': '导入模块',
      'standard_libs': '等标准库',
      'kb_help': '知识库节点: 根据查询从知识库中检索相关知识片段',
      'kb_query_help': '查询文本: 可以手动输入或从上游节点获取',
      'structured_help': '结构化输入节点: 使用表格输入结构化数据，可以输出为多种格式',
      'json_key_value_info': '当输出格式为JSON时: 第一列作为键(key)，第二列作为值(value)，其他列作为附加属性',
      'start_help': '开始节点: 工作流的起点，提供输入文本',
      'end_help': '结束节点: 工作流的终点，汇总所有输入的结果',
      
      // 上游节点信息
      'upstream_info': '上游节点信息',
      'connected_node': '已连接一个上游节点',
      'connected_nodes': '已连接多个上游节点',
      'input_dict': 'input变量是一个字典',
      'contains_data': '包含该节点的数据',
      'contains_all_data': '包含所有上游节点的数据',
      'access_data': '访问节点数据',
      'available_keys': '可用的键名',
      'readonly_code': '已连接上游节点，代码只读',
      'edit_upstream': '如需修改代码，请断开连接或编辑上游节点',
      'unknown_node': '未知节点',
      'deleted': '已删除',
      'key_name': '键名',
      'upstream_node_id': '节点ID',
      'upstream_node_name': '节点名称',
      'upstream_node_type': '节点类型',
      'upstream_data_key': '数据键名',
      
      // 状态文本
      'status_idle': '待执行',
      'status_running': '运行中',
      'status_success': '成功',
      'status_error': '错误',
      
      // 拖拽提示
      'drag_to_add': '松开鼠标添加节点',
      'select_source': '选择源节点',
      'select_target': '选择目标节点',
      
      // 错误信息
      'reasoning_error': '推理错误',
      'execution_error': '执行错误',
      'fetch_error': '获取失败',
      'search_error': '搜索失败',
      'read_error': '读取失败',
      'retrieval_error': '检索失败',
      'structured_error': '结构化处理失败',
      'file_read_error': '读取文件失败',
      'kb_load_error': '加载知识库失败',
      'unknown_format': '无法识别文件格式',
      'model_not_selected': '请选择模型',
      'api_key_required': '需要API密钥',
      'model_offline': '模型离线，请检查连接',
      'connection_failed': '连接失败',
      'kb_file_required': '请选择知识库文件',
      'query_required': '请输入查询文本',
      'workflow_error': '工作流执行错误',
      'start_node_required': '需要开始节点',
      'end_node_required': '需要结束节点',
      'multiple_start_nodes': '只能有一个开始节点',
      'multiple_end_nodes': '只能有一个结束节点',
      'cyclic_dependency': '检测到循环依赖',
      'no_end_node': '工作流没有结束节点',
      'no_start_node': '工作流没有开始节点'
    },
    en: {
      // 新增开始节点相关文本
      'start_placeholder': 'Enter text or use format: prompt|file_path',
      'start_help_new': 'Start Node: You can enter a single text, or use "|" separator to pass two parameters in the format "prompt|file_path". The system will automatically read the file content and combine it with the prompt.',
      
      // 新增本地节点相关文本
      'file_processing_mode': 'Mode',
      'full_file_mode': 'Full File Mode',
      'template_mode': 'Template Match Mode',
      'full_file_mode_help': 'Full File Mode: Read the entire file content and output as a single string with one output port',
      'template_configuration': 'Template Configuration',
      'add_template': 'Add',
      'template_help': 'Configure match patterns and output names. The system will perform string matching and slicing based on the templates',
      'template_name': 'Template Name',
      'pattern': 'Match Pattern',
      'output_name': 'Output Name',
      'template_name_placeholder': 'e.g.: Chapter 1',
      'pattern_placeholder': 'e.g.: Chapter 1',
      'output_name_placeholder': 'e.g.: chapter_1',
      'delete_template': 'Delete Template',
      'no_templates_configured': 'No templates configured yet',
      'template_examples': 'Examples: Chapter 1, Chapter 2, Section 1, Chapter [One|Two|Three|Four], etc. Each matched string will be a slice, with content from that string to before the next match.',
      'local_node_help_new': 'Local File Node: Supports two processing modes. Full File Mode: Returns the entire file content. Template Match Mode: Performs string matching and slicing based on configured templates, each slice is returned through different output ports.',
      
      // 新增输出端口相关文本
      'output_ports_status': 'Output Ports Status',
      'refresh_ports': 'Refresh Ports',
      'port_name': 'Port Name',
      'default_port': 'Default',
      'full_file': 'Full File',
      'port_help': 'Each template matched slice will be passed to downstream nodes through the corresponding output port. Click on the port to connect.',
      
      // 其他已有文本...
      'mcp_node': 'MCP Node',
      // Decision node related
      'decision_node': 'Decision Node',
      'decision_mode': 'Decision Mode',
      'llm_decision': 'LLM Decision',
      'rule_decision': 'Rule Decision',
      'decision_prompt': 'Decision Prompt',
      'decision_prompt_placeholder': 'Enter decision prompt, e.g.: Based on input content, determine which category it belongs to...',
      'decision_rules': 'Decision Rules',
      'decision_rules_placeholder': 'Enter JSON format decision rules, e.g.: {"condition": "input.length > 10", "branch": "branch_1"}',
      'branch_management': 'Branch Management',
      'add_branch': 'Add Branch',
      'delete_branch': 'Delete Branch',
      'branch_name': 'Branch Name',
      'branch_description': 'Branch Description',
      'branch_description_placeholder': 'Branch description...',
      'branch_management_help': 'Decision node supports 2-10 branches, each branch can connect to different downstream nodes',
      'decision_result_mapping': 'Decision Result Mapping',
      'decision_result_mapping_help': 'Decision result will be mapped to corresponding branch, workflow will continue along selected branch',
      'rule_decision_help': 'Rule decision supports simple conditional expressions, defined in JSON format',
      'decision_node_help': 'Decision node can select different execution paths based on input content, supports intelligent LLM-based decision and simple rule-based decision',
      'waiting_decision': 'Waiting for decision',
      'running_decision': 'Making decision',
      'decision_error': 'Decision error',
      'selected_branch': 'Selected branch',
      
      // General
      'workflow': 'Workflow',
      'save': 'Save',
      'open': 'Open',
      'reset': 'Reset',
      'run': 'Run',
      'running': 'Running',
      'idle': 'Idle',
      'success': 'Success',
      'error': 'Error',
      'nodes': 'Nodes',
      'links': 'Links',
      'zoom': 'Zoom',
      'connect': 'Connect',
      'settings': 'Settings',
      'delete': 'Delete',
      'close': 'Close',
      'properties': 'Properties',
      'name': 'Name',
      'type': 'Type',
      'model': 'Model',
      'prompt': 'Prompt',
      'result': 'Result',
      'status': 'Status',
      'text': 'Text',
      'file': 'File',
      'search': 'Search',
      'webpage': 'Webpage',
      'reasoning': 'Reasoning',
      'code': 'Code',
      'python': 'Python',
      'select': 'Select',
      'input': 'Input',
      'output': 'Output',
      'upload': 'Upload',
      'drag': 'Drag',
      'drop': 'Drop',
      'knowledge': 'Knowledge Base',
      'structured': 'Structured',
      'start': 'Start',
      'end': 'End',
      'stop': 'Stop',
      'stop_workflow': 'Stop Workflow',
      
      // Node types
      'text_node': 'Text Node',
      'local_node': 'Local File Node',
      'web_node': 'Web Search',
      'webpage_node': 'Webpage Node',
      'reasoning_node': 'Reasoning Node',
      'python_node': 'Python Node',
      'knowledge_node': 'Knowledge Base Node',
      'structured_node': 'Structured Input Node',
      'start_node': 'Start Node',
      'end_node': 'End Node',
      
      // Structured node related
      'structured_input': 'Structured Input',
      'table_editor': 'Table Editor',
      'table_description': 'Table Description',
      'input_table_description': 'Enter table description...',
      'add_row': 'Add Row',
      'delete_row': 'Delete Row',
      'add_column': 'Add Column',
      'delete_column': 'Delete Column',
      'key_column': 'Key',
      'value_column': 'Value',
      'description_column': 'Description',
      'column_name': 'Column Name',
      'column_type': 'Column Type',
      'text_type': 'Text',
      'number_type': 'Number',
      'boolean_type': 'Boolean',
      'date_type': 'Date',
      'required': 'Required',
      'column': 'Column',
      'column_management': 'Column Management',
      'data_table': 'Data Table',
      'row_number': 'No.',
      'empty_table': 'Table is empty',
      'format_options': 'Format Options',
      'output_format': 'Output Format',
      'format_json': 'JSON Format',
      'format_markdown': 'Markdown Table',
      'format_text': 'Plain Text',
      'format_csv': 'CSV Format',
      'include_headers': 'Include Headers',
      'output_preview': 'Output Preview',
      
      // Prompts
      'no_model': 'No Model',
      'select_model': 'Please select a model',
      'input_prompt': 'Please enter prompt',
      'input_text': 'Please enter text content',
      'input_code': 'Please enter code',
      'input_url': 'Please enter URL',
      'input_search': 'Please enter search keywords',
      'select_file': 'Please select a file',
      'drag_file': 'Drag file here or click to select',
      'drag_kb_file': 'Drag knowledge base file (.kb)',
      'select_kb_file': 'Select knowledge base file',
      'waiting': 'Waiting',
      'waiting_search': 'Waiting for search',
      'waiting_fetch': 'Waiting to fetch',
      'waiting_reasoning': 'Waiting for reasoning',
      'waiting_execute': 'Waiting to execute',
      'waiting_retrieval': 'Waiting for retrieval',
      'waiting_structured': 'Waiting for structured input',
      'waiting_start': 'Waiting for input',
      'waiting_end': 'Waiting for summary',
      'running_reasoning': 'Reasoning...',
      'running_search': 'Searching...',
      'running_fetch': 'Fetching webpage content...',
      'running_read': 'Reading file...',
      'running_execute': 'Executing...',
      'running_python': 'Executing Python code...',
      'running_retrieval': 'Retrieving from knowledge base...',
      'running_structured': 'Generating structured output...',
      'running_start': 'Getting input...',
      'running_end': 'Summarizing output...',
      'no_execute': 'Not executed',
      
      // Button texts
      'run_workflow': 'Run Workflow',
      'run_all': 'Run All Nodes',
      'open_workflow': 'Open Workflow',
      'save_workflow': 'Save Workflow',
      'reset_workflow': 'Reset Workflow',
      'link_mode': 'Link Mode',
      'zoom_in': 'Zoom In',
      'zoom_out': 'Zoom Out',
      'reset_zoom': 'Reset Zoom',
      
      // Property panel
      'node_properties': 'Node Properties',
      'node_name': 'Name:',
      'node_type': 'Type:',
      'model_selection': 'Model:',
      'prompt_input': 'Prompt:',
      'file_path': 'File Path:',
      'file_type': 'File Type:',
      'search_term': 'Search Term:',
      'url_input': 'URL:',
      'python_code': 'Python Code:',
      'text_content': 'Text Content:',
      'kb_path': 'Knowledge Base Path:',
      'kb_config': 'Knowledge Base Config:',
      'query_input': 'Query Input:',
      'retrieval_options': 'Retrieval Options',
      'top_k': 'Top K:',
      'summary_weight': 'Summary Weight:',
      'use_reverse': 'Use Reverse:',
      'reverse_weight': 'Reverse Weight:',
      'embed_model': 'Embed Model:',
      'debug_mode': 'Debug Mode:',
      'retrieval_result': 'Retrieval Result',
      'structured_table': 'Structured Table:',
      'start_input': 'Input Text:',
      'end_output': 'Output Result:',
      
      // Model types
      'model_type': 'Model Type',
      'ollama': 'Ollama',
      'openai': 'OpenAI',
      'deepseek': 'DeepSeek',
      'anthropic': 'Anthropic Claude',
      'google': 'Google Gemini',
      'azure': 'Azure OpenAI',
      'custom': 'Custom',
      
      // Model config
      'model_name': 'Model Name',
      'api_key': 'API Key',
      'api_url': 'API URL',
      'base_url': 'Base URL',
      'endpoint': 'Endpoint',
      'deployment': 'Deployment',
      'api_version': 'API Version',
      'custom_config': 'Custom Configuration',
      
      // Help texts
      'available_vars': 'Available variables',
      'input_var': 'Upstream node result',
      'output_var': 'Output result',
      'log_func': 'Log function',
      'jina_api': 'Using Jina AI Reader API to fetch webpage content',
      'security_note': 'Security restrictions: Dangerous operations like file system access and network requests are prohibited',
      'import_modules': 'Import modules',
      'standard_libs': 'standard libraries',
      'kb_help': 'Knowledge Base Node: Retrieve relevant knowledge fragments based on query',
      'kb_query_help': 'Query text: Can be manually entered or obtained from upstream nodes',
      'structured_help': 'Structured Input Node: Input structured data using table, can output in multiple formats',
      'json_key_value_info': 'When output format is JSON: First column as key, second column as value, other columns as additional properties',
      'start_help': 'Start Node: The starting point of the workflow, provides input text',
      'end_help': 'End Node: The ending point of the workflow, summarizes all input results',
      
      // Upstream node info
      'upstream_info': 'Upstream Node Information',
      'connected_node': 'Connected to one upstream node',
      'connected_nodes': 'Connected to multiple upstream nodes',
      'input_dict': 'input is a dictionary',
      'contains_data': 'contains data from this node',
      'contains_all_data': 'contains data from all upstream nodes',
      'access_data': 'Access node data',
      'available_keys': 'Available keys',
      'readonly_code': 'Connected to upstream node, code is read-only',
      'edit_upstream': 'To modify code, disconnect or edit upstream node',
      'unknown_node': 'Unknown node',
      'deleted': 'Deleted',
      'key_name': 'Key name',
      'upstream_node_id': 'Node ID',
      'upstream_node_name': 'Name',
      'upstream_node_type': 'Type',
      'upstream_data_key': 'Data Key',
      
      // Status texts
      'status_idle': 'Idle',
      'status_running': 'Running',
      'status_success': 'Success',
      'status_error': 'Error',
      
      // Drag hints
      'drag_to_add': 'Release to add node',
      'select_source': 'Select source node',
      'select_target': 'Select target node',
      
      // Error messages
      'reasoning_error': 'Reasoning error',
      'execution_error': 'Execution error',
      'fetch_error': 'Fetch failed',
      'search_error': 'Search failed',
      'read_error': 'Read failed',
      'retrieval_error': 'Retrieval failed',
      'structured_error': 'Structured processing failed',
      'file_read_error': 'Failed to read file',
      'kb_load_error': 'Failed to load knowledge base',
      'unknown_format': 'Unknown file format',
      'model_not_selected': 'Please select a model',
      'api_key_required': 'API key required',
      'model_offline': 'Model offline, please check connection',
      'connection_failed': 'Connection failed',
      'kb_file_required': 'Please select knowledge base file',
      'query_required': 'Please enter query text',
      'workflow_error': 'Workflow execution error',
      'start_node_required': 'Start node required',
      'end_node_required': 'End node required',
      'multiple_start_nodes': 'Only one start node is allowed',
      'multiple_end_nodes': 'Only one end node is allowed',
      'cyclic_dependency': 'Cyclic dependency detected',
      'no_end_node': 'Workflow has no end node',
      'no_start_node': 'Workflow has no start node'
    }
  }
  
  const locale = store.locales || 'zh'
  const localeData = locales[locale] || locales.zh
  return localeData[key] || key
}

// 本地存储的key
const LOCAL_STORAGE_KEY = 'workflow'
const VIEW_STORAGE_KEY = 'workflow_view'

// 拖拽相关
interface Position {
  x: number
  y: number
}

let isDragging = false
const DRAG_THRESHOLD = 5

// 结构化数据接口
interface StructuredColumn {
  id: number
  name: string
  type: 'text' | 'number' | 'boolean' | 'date'
  required: boolean
}

interface StructuredRow {
  id: number
  columns: Record<string, string>
}

// 结构化配置接口
interface StructuredConfig {
  outputFormat: 'json' | 'markdown' | 'text' | 'csv'
  includeHeaders: boolean
  tableDescription: string
}

// 决策分支接口
interface DecisionBranch {
  id: string
  name: string
  description: string
  condition?: string // 规则决策的条件表达式
  dataTemplate?: string // 传递给下游的数据模板，默认 {input}
}

// 决策节点配置接口
interface DecisionConfig {
  mode: 'llm' | 'rule'
  prompt?: string
  rules?: string
  branches: DecisionBranch[]
  selectedBranch?: string
}

// 节点模板接口 - 更新本地节点模板
interface NodeTemplate {
  name: string
  type: NodeType
  model_type: string
  model: string
  prompt: string
  result: string
  width: number
  height: number
  status: 'idle' | 'running' | 'success' | 'error'
  fileMode?: FileMode
  fileTemplates?: FileTemplate[]
}

// MCP节点默认配置
const defaultMCPConfig: McpConfig = {
  transport: 'stdio',
  command: '',
  args: '',
  env: {},
  serverUrl: '',
  selectedTool: '',
  toolArguments: {},
  autoConnect: true,
  tools: []
}

// 知识库节点默认配置
const defaultKbOptions = {
  topK: 5,
  summaryWeight: 0.7,
  useReverseInference: false,
  reverseWeight: 0.3,
  embedModel: '',
  debug: false,
  missingModelStrategy: 'error' as 'error' | 'fallback',
  fallbackModels: ['nomic-embed-text:latest', 'all-minilm:latest']
}

// 结构化节点默认配置
const defaultStructuredConfig: StructuredConfig = {
  outputFormat: 'json',
  includeHeaders: true,
  tableDescription: ''
}

const defaultDecisionBranches: DecisionBranch[] = [
  { id: 'branch_1', name: '分支1', description: '第一条路径', dataTemplate: '{input}' },
  { id: 'branch_2', name: '分支2', description: '第二条路径', dataTemplate: '{input}' }
]

// 决策节点默认配置
const defaultDecisionConfig: DecisionConfig = {
  mode: 'llm',
  prompt: '请根据以下内容进行分析决策，从提供的分支中选择最合适的一个：\n\n输入内容：{input}\n\n可用分支：{branches}\n\n请只返回分支ID，不要包含其他内容。',
  rules: '',
  branches: defaultDecisionBranches
}

// 文件模板默认配置
const defaultFileTemplates: FileTemplate[] = [
  { name: 'chapter_1', pattern: 'chapter_1', outputName: 'chapter_1' },
  { name: 'chapter_2', pattern: 'chapter_2', outputName: 'chapter_2' },
  { name: 'chapter_3', pattern: 'chapter_3', outputName: 'chapter_3' }
]

// 节点模板 - 更新本地节点模板
const nodeTemplates: Record<NodeType, NodeTemplate> = {
  text: {
    name: t('text_node'),
    type: 'text',
    model_type: '',
    model: '',
    prompt: t('input_text') + '...',
    result: t('waiting'),
    width: 250,
    height: 70,
    status: 'idle'
  },
  local: {
    name: t('local_node'),
    type: 'local',
    model_type: '',
    model: '',
    prompt: t('drag_file'),
    result: t('waiting'),
    width: 250,
    height: 70,
    status: 'idle',
    fileMode: 'full',
    fileTemplates: [...defaultFileTemplates]
  },
  web: {
    name: t('web_node'),
    type: 'web',
    model_type: '',
    model: '',
    prompt: t('input_search') + '...',
    result: t('waiting_search'),
    width: 250,
    height: 70,
    status: 'idle'
  },
  webpage: {
    name: t('webpage_node'),
    type: 'webpage',
    model_type: '',
    model: '',
    prompt: 'https://',
    result: t('waiting_fetch'),
    width: 250,
    height: 70,
    status: 'idle'
  },
  reasoning: {
    name: t('reasoning_node'),
    type: 'reasoning',
    model_type: '',
    model: '',
    prompt: t('input_prompt') + '...',
    result: t('waiting_reasoning'),
    width: 250,
    height: 70,
    status: 'idle'
  },
  decision: {
    name: t('decision_node'),
    type: 'decision',
    model_type: 'ollama',
    model: '',
    prompt: t('decision_prompt_placeholder'),
    result: t('waiting_decision'),
    width: 250,
    height: 70,
    status: 'idle'
  },
  python: {
    name: t('python_node'),
    type: 'python',
    model_type: 'python',
    model: 'python',
    prompt: `# ${t('input_code')}
# ${t('available_vars')}: input, output, log()
output=input
print(output)`,
    result: t('waiting_execute'),
    width: 250,
    height: 70,
    status: 'idle'
  },
  knowledge: {
    name: t('knowledge_node'),
    type: 'knowledge',
    model_type: '',
    model: '',
    prompt: t('drag_kb_file'),
    result: t('waiting_retrieval'),
    width: 250,
    height: 70,
    status: 'idle'
  },
  structured: {
    name: t('structured_node'),
    type: 'structured',
    model_type: '',
    model: '',
    prompt: t('table_editor'),
    result: t('waiting_structured'),
    width: 250,
    height: 70,
    status: 'idle'
  },
  mcp: {
    name: t('mcp_node'),
    type: 'mcp',
    model_type: '',
    model: '',
    prompt: '',
    result: t('mcp_disconnected'),
    width: 250,
    height: 70,
    status: 'idle'
  },
  start: {
    name: t('start_node'),
    type: 'start',
    model_type: '',
    model: '',
    prompt: t('input_text') + '...',
    result: t('waiting_start'),
    width: 250,
    height: 70,
    status: 'idle',
  },
  end: {
    name: t('end_node'),
    type: 'end',
    model_type: '',
    model: '',
    prompt: '',
    result: t('waiting_end'),
    width: 250,
    height: 70,
    status: 'idle'
  }
}

// 响应式数据
const items: Ref<NodeData[]> = ref([])
const links: Ref<Link[]> = ref([])
const selectedNodeId = ref<number | null>(null)
const hoveredNodeId = ref<number | null>(null)
const operationMode = ref<'normal' | 'linking'>('normal')
const linkingSourceId = ref<number | null>(null)
const linkingSourceConnector = ref<'top' | 'bottom' | null>(null)
const linkingSourceBranchId = ref<string | null>(null)
const linkingSourcePortId = ref<string | null>(null)
const linkingSourceStartPort = ref<'prompt' | 'file' | null>(null)
const propertiesShow = ref<boolean>(false)

// 批量运行代码
const batchRunTimes = ref(10) // 默认运行10次
const isBatchRunning = ref(false)
const batchProgress = ref(0)
const batchResults = ref<any[]>([])

// 批量运行方法（不自动保存）
const runWorkflowBatch = async () => {
  if (!isWorkflowValid.value || runner?.value?.isRunning || isBatchRunning.value) {
    console.warn('工作流无效或正在运行中')
    return
  }
  
  // 确认批量运行
  const confirmMessage = `确定要运行工作流 ${batchRunTimes.value} 次吗？`
  if (!confirm(confirmMessage)) {
    return
  }
  
  isBatchRunning.value = true
  batchResults.value = []
  batchProgress.value = 0
  
  try {
    // 保存原始工作流数据，用于每次运行前重置
    const originalItems = JSON.parse(JSON.stringify(items.value))
    const originalLinks = JSON.parse(JSON.stringify(links.value))
    
    // 创建结果存储数组
    const allResults: any[] = []
    
    for (let i = 0; i < batchRunTimes.value; i++) {
      const roundStartTime = Date.now()
      console.log(`开始第 ${i + 1}/${batchRunTimes.value} 轮运行`)
      
      // 重置节点状态
      resetNodeStatusesForBatch()
      
      // 重新初始化运行器
      initWorkflowRunner()
      
      // 运行工作流
      const result = await runner.value!.run()
      
      const roundEndTime = Date.now()
      
      // 收集本轮结果
      const roundResult = {
        round: i + 1,
        timestamp: new Date().toISOString(),
        startTime: new Date(roundStartTime).toISOString(),
        endTime: new Date(roundEndTime).toISOString(),
        duration: roundEndTime - roundStartTime,
        success: result.success,
        result: result.result,
        aggregatedResults: result.aggregatedResults,
        executionStats: {
          totalNodes: result.executionStats?.totalNodes || 0,
          completedNodes: result.executionStats?.completedNodes || 0,
          failedNodes: result.executionStats?.failedNodes || 0,
          executionTime: result.executionStats?.executionTime || 0,
          errors: result.executionStats?.errors || [],
          executedNodes: result.executionStats?.executedNodes || []
        },
        nodeResults: collectNodeResults(),
        executionOrder: runner.value?.executionOrder || []
      }
      
      allResults.push(roundResult)
      batchResults.value = allResults
      batchProgress.value = ((i + 1) / batchRunTimes.value) * 100
      
      // 重置工作流数据到原始状态（用于下一轮）
      resetWorkflowToOriginal(originalItems, originalLinks)
      
      // 短暂延迟，避免过快的连续请求
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    console.log('批量运行完成', allResults)
    alert(`批量运行完成！\n成功: ${allResults.filter(r => r.success).length}/${batchRunTimes.value}\n请点击"保存结果"按钮保存到文件`)
    
  } catch (error: any) {
    console.error('批量运行失败:', error)
    alert(`批量运行失败: ${error.message}`)
  } finally {
    isBatchRunning.value = false
    batchProgress.value = 0
  }
}

// 保存批量运行结果到选中的文件夹（手动保存）- Excel 格式
const saveBatchResultsToFolder = async () => {
  if (batchResults.value.length === 0) {
    alert('没有批量运行结果可保存，请先运行批量测试')
    return
  }
  
  try {
    // 生成 Excel 内容
    const workbook = generateBatchResultsExcel()
    
    // 生成文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `batch_results_${timestamp}.xlsx`
    
    // 直接使用浏览器下载
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    
    return true
    
  } catch (error: any) {
    console.error('保存批量运行结果失败:', error)
    alert(`保存失败: ${error.message}`)
    return false
  }
}

// 生成批量运行结果的 Excel 文件（多个工作表）
const generateBatchResultsExcel = (): XLSX.WorkBook => {
  const workbook = XLSX.utils.book_new()
  
  // 1. 创建主数据表（每轮运行结果）
  const mainSheetData = generateMainSheetData()
  const mainSheet = XLSX.utils.aoa_to_sheet(mainSheetData)
  mainSheet['!cols'] = mainSheetData[0].map(() => ({ wch: 25 }))
  XLSX.utils.book_append_sheet(workbook, mainSheet, store.locales=='zh' ? '运行结果汇总' : 'Execution Results Summary')
  
  // 2. 创建统计信息表
  const statsSheetData = generateStatsSheetData()
  const statsSheet = XLSX.utils.aoa_to_sheet(statsSheetData)
  statsSheet['!cols'] = [{ wch: 20 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(workbook, statsSheet, store.locales=='zh' ? '统计信息' : 'Statistics')
  
  // 3. 创建节点详情表
  const detailsSheetData = generateDetailsSheetData()
  const detailsSheet = XLSX.utils.aoa_to_sheet(detailsSheetData)
  detailsSheet['!cols'] = [{ wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 50 }, { wch: 25 }]
  XLSX.utils.book_append_sheet(workbook, detailsSheet, store.locales=='zh' ? '节点详情' : 'Node Details')
  
  return workbook
}

// 生成主数据表
const generateMainSheetData = (): any[][] => {
  // 收集所有轮次中出现的所有节点ID
  const allNodeIds = new Set<number>()
  const nodeNameMap = new Map<number, string>() // 存储节点名称（使用第一次出现的名称）
  
  batchResults.value.forEach(result => {
    if (result.nodeResults) {
      result.nodeResults.forEach((nodeResult: any) => {
        allNodeIds.add(nodeResult.id)
        // 如果还没有记录这个节点的名称，则记录
        if (!nodeNameMap.has(nodeResult.id) && nodeResult.name) {
          nodeNameMap.set(nodeResult.id, nodeResult.name)
        }
      })
    }
  })
  
  // 转换为排序后的数组
  const executionOrder = Array.from(allNodeIds).sort((a, b) => a - b)
  
  // 构建表头
  const headers = ['Round', 'Timestamp', 'Status', 'Duration(ms)']
  executionOrder.forEach(nodeId => {
    const nodeName = nodeNameMap.get(nodeId) || `Node${nodeId}`
    headers.push(`${nodeName}(${nodeId})`)
  })
  
  const rows: any[][] = [headers]
  
  // 为每一轮填充数据
  batchResults.value.forEach(result => {
    const row: any[] = []
    
    row.push(result.round)
    row.push(result.timestamp)
    row.push(result.success ? 'Success' : 'Failed')
    row.push(result.duration || 0)
    
    // 构建当前轮次的节点结果映射
    const nodeResultMap = new Map()
    if (result.nodeResults) {
      result.nodeResults.forEach((nodeResult: any) => {
        nodeResultMap.set(nodeResult.id, nodeResult)
      })
    }
    
    // 按表头顺序填充数据
    executionOrder.forEach(nodeId => {
      const nodeResult = nodeResultMap.get(nodeId)
      
      if (nodeResult && nodeResult.result) {
        let resultContent = ''
        try {
          if (typeof nodeResult.result === 'string') {
            try {
              const parsed = JSON.parse(nodeResult.result)
              if (parsed && typeof parsed === 'object') {
                if (parsed.result !== undefined) {
                  resultContent = typeof parsed.result === 'string' ? parsed.result : JSON.stringify(parsed.result)
                } else {
                  resultContent = JSON.stringify(parsed)
                }
              } else {
                resultContent = nodeResult.result
              }
            } catch {
              resultContent = nodeResult.result
            }
          } else if (typeof nodeResult.result === 'object') {
            if (nodeResult.result.result !== undefined) {
              resultContent = typeof nodeResult.result.result === 'string' 
                ? nodeResult.result.result 
                : JSON.stringify(nodeResult.result.result)
            } else {
              resultContent = JSON.stringify(nodeResult.result)
            }
          } else {
            resultContent = String(nodeResult.result)
          }
          if (resultContent.length > 32000) {
            resultContent = resultContent.substring(0, 32000) + '...(truncated)'
          }
        } catch (e) {
          resultContent = String(nodeResult.result).substring(0, 32000)
        }
        row.push(resultContent)
      } else {
        // 如果该轮次中没有这个节点，填充空字符串
        row.push('')
      }
    })
    
    rows.push(row)
  })
  
  return rows
}

// 生成统计信息表
const generateStatsSheetData = (): any[][] => {
  const successfulRuns = batchResults.value.filter(r => r.success).length
  const failedRuns = batchResults.value.filter(r => !r.success).length
  const totalDuration = batchResults.value.reduce((sum, r) => sum + (r.duration || 0), 0)
  const averageDuration = batchResults.value.length > 0 ? totalDuration / batchResults.value.length : 0
  const minDuration = batchResults.value.length > 0 ? Math.min(...batchResults.value.map(r => r.duration || 0)) : 0
  const maxDuration = batchResults.value.length > 0 ? Math.max(...batchResults.value.map(r => r.duration || 0)) : 0
  
  const nodeStats = new Map<number, { name: string; success: number; total: number }>()
  
  batchResults.value.forEach(result => {
    if (result.nodeResults) {
      result.nodeResults.forEach((nodeResult: any) => {
        if (!nodeStats.has(nodeResult.id)) {
          nodeStats.set(nodeResult.id, {
            name: nodeResult.name || `Node${nodeResult.id}`,
            success: 0,
            total: 0
          })
        }
        const stats = nodeStats.get(nodeResult.id)!
        stats.total++
        if (nodeResult.status === 'success') {
          stats.success++
        }
      })
    }
  })
  
  const rows: any[][] = [
    ['Statistics', 'Value'],
    ['Total Runs', batchResults.value.length],
    ['Successful Runs', successfulRuns],
    ['Failed Runs', failedRuns],
    ['Success Rate', batchResults.value.length > 0 ? ((successfulRuns / batchResults.value.length) * 100).toFixed(2) + '%' : '0%'],
    ['Total Duration (ms)', totalDuration],
    ['Average Duration (ms)', averageDuration.toFixed(2)],
    ['Min Duration (ms)', minDuration],
    ['Max Duration (ms)', maxDuration],
    ['Start Time', batchResults.value[0]?.startTime || ''],
    ['End Time', batchResults.value[batchResults.value.length - 1]?.endTime || ''],
    [],
    ['Node Execution Statistics'],
    ['Node Name', 'Node ID', 'Success Count', 'Total Count', 'Success Rate']
  ]
  
  nodeStats.forEach((stats, nodeId) => {
    const successRate = stats.total > 0 ? ((stats.success / stats.total) * 100).toFixed(2) + '%' : '0%'
    rows.push([stats.name, nodeId, stats.success, stats.total, successRate])
  })
  
  return rows
}

// 生成节点详情表
const generateDetailsSheetData = (): any[][] => {
  const rows: any[][] = [
    ['Round', 'Node ID', 'Node Name', 'Node Type', 'Status', 'Result', 'Timestamp']
  ]
  
  batchResults.value.forEach(result => {
    if (result.nodeResults) {
      result.nodeResults.forEach((nodeResult: any) => {
        let resultContent = ''
        try {
          if (typeof nodeResult.result === 'string') {
            try {
              const parsed = JSON.parse(nodeResult.result)
              if (parsed && typeof parsed === 'object') {
                if (parsed.result !== undefined) {
                  resultContent = typeof parsed.result === 'string' ? parsed.result : JSON.stringify(parsed.result)
                } else {
                  resultContent = JSON.stringify(parsed)
                }
              } else {
                resultContent = nodeResult.result
              }
            } catch {
              resultContent = nodeResult.result
            }
          } else if (typeof nodeResult.result === 'object') {
            if (nodeResult.result.result !== undefined) {
              resultContent = typeof nodeResult.result.result === 'string' 
                ? nodeResult.result.result 
                : JSON.stringify(nodeResult.result.result)
            } else {
              resultContent = JSON.stringify(nodeResult.result)
            }
          } else {
            resultContent = String(nodeResult.result)
          }
          if (resultContent.length > 30000) {
            resultContent = resultContent.substring(0, 30000) + '...(truncated)'
          }
        } catch (e) {
          resultContent = String(nodeResult.result).substring(0, 30000)
        }
        
        rows.push([
          result.round,
          nodeResult.id,
          nodeResult.name,
          nodeResult.type,
          nodeResult.status,
          resultContent,
          nodeResult.timestamp || result.timestamp
        ])
      })
    }
  })
  
  return rows
}

// 清空批量运行结果
const clearBatchResults = () => {
  if (batchResults.value.length > 0) {
    if (confirm('确定要清空批量运行结果吗？')) {
      batchResults.value = []
      batchProgress.value = 0
    }
  }
}


// 重置节点状态（用于批量运行）
const resetNodeStatusesForBatch = () => {
  items.value.forEach(item => {
    item.status = 'idle'
    // 清空结果 - 使用国际化文本
    if (item.type !== 'start' && item.type !== 'end') {
      const template = nodeTemplates[item.type]
      if (template) {
        // 根据节点类型设置对应的等待状态文本
        const waitingTexts: Record<NodeType, string> = {
          'text': t('waiting'),
          'local': t('waiting'),
          'web': t('waiting_search'),
          'webpage': t('waiting_fetch'),
          'reasoning': t('waiting_reasoning'),
          'decision': t('waiting_decision'),
          'python': t('waiting_execute'),
          'knowledge': t('waiting_retrieval'),
          'structured': t('waiting_structured'),
          'mcp': t('waiting'),
          'start': t('waiting_start'),
          'end': t('waiting_end')
        }
        item.result = waitingTexts[item.type] || t('waiting')
      }
    }
    if (item.type === 'start') {
      item.result = t('waiting_start')
    }
    if (item.type === 'end') {
      item.result = t('waiting_end')
    }
  })
}

// 重置工作流到原始状态
const resetWorkflowToOriginal = (originalItems: any[], originalLinks: any[]) => {
  // 重置节点数据
  items.value = JSON.parse(JSON.stringify(originalItems))
  links.value = JSON.parse(JSON.stringify(originalLinks))
  
  // 重置节点状态 - 使用国际化文本
  items.value.forEach(item => {
    item.status = 'idle'
    const waitingTexts: Record<NodeType, string> = {
      'text': t('waiting'),
      'local': t('waiting'),
      'web': t('waiting_search'),
      'webpage': t('waiting_fetch'),
      'reasoning': t('waiting_reasoning'),
      'decision': t('waiting_decision'),
      'python': t('waiting_execute'),
      'knowledge': t('waiting_retrieval'),
      'structured': t('waiting_structured'),
      'mcp': t('waiting'),
      'start': t('waiting_start'),
      'end': t('waiting_end')
    }
    if (item.type !== 'start' && item.type !== 'end') {
      item.result = waitingTexts[item.type] || t('waiting')
    }
    if (item.type === 'start') {
      item.result = t('waiting_start')
    }
    if (item.type === 'end') {
      item.result = t('waiting_end')
    }
  })
}

// 收集所有节点的执行结果
const collectNodeResults = () => {
  const nodeResults: any[] = []
  
  // 获取执行顺序
  const executionOrder = runner.value?.executionOrder || []
  
  // 按照执行顺序收集结果
  for (const nodeId of executionOrder) {
    const node = items.value.find(n => n.id === nodeId)
    if (node) {
      nodeResults.push({
        id: node.id,
        name: node.name,
        type: node.type,
        status: node.status,
        result: parseNodeResult(node.result),
        timestamp: new Date().toISOString()
      })
    }
  }
  
  // 添加未在执行顺序中的节点（如果有）
  items.value.forEach(node => {
    if (!executionOrder.includes(node.id)) {
      nodeResults.push({
        id: node.id,
        name: node.name,
        type: node.type,
        status: node.status,
        result: parseNodeResult(node.result),
        timestamp: new Date().toISOString(),
        skipped: true
      })
    }
  })
  
  return nodeResults
}

// 解析节点结果
const parseNodeResult = (result: string): any => {
  if (!result) return null
  
  try {
    return JSON.parse(result)
  } catch {
    return result
  }
}


// 工作流运行器实例
const runner = ref<WorkflowRunner | null>(null)
const executionProgress = ref(0)

// D3相关
const flowsContainer = ref<HTMLElement>()
const svgRef = ref<SVGSVGElement>()
let svg: d3.Selection<SVGSVGElement, unknown, null, undefined>

// 缩放相关
const scale = ref(1)
const minScale = 0.1
const maxScale = 5
let zoom: d3.ZoomBehavior<SVGSVGElement, unknown>

// 视图变换
const viewTransform = ref({ x: 0, y: 0, k: 1 })

// 拖拽添加节点相关
const dragOverCanvas = ref(false)

// SVG 尺寸
const svgWidth = ref(2000)
const svgHeight = ref(2000)

// 计算属性
const selectedNode = computed(() => {
  return selectedNodeId.value !== null 
    ? items.value.find(item => item.id === selectedNodeId.value)
    : null
})

const nodesCount = computed(() => items.value.length)

// 获取当前节点的可用模型列表
const getAvailableModels = computed(() => {
  const node = selectedNode.value
  if (!node) return []
  
  switch (node.model_type) {
    case 'ollama':
      return store.AIconfig?.llm?.ollama?.available_models || []
    case 'lmstudio':
      return store.AIconfig?.llm?.lmstudio?.available_models || []
    case 'openai':
    case 'deepseek':
      return store.AIconfig?.llm?.openai?.available_models || []
    case 'anthropic':
      return ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229']
    case 'google':
      return ['gemini-pro', 'gemini-pro-vision']
    case 'azure':
      return []
    case 'custom':
      return []
    default:
      return []
  }
})

// 检查节点是否有上游代码输入
const hasUpstreamCodeInput = computed(() => {
  if (!selectedNode.value || selectedNode.value.type !== 'python') {
    return false
  }
  
  const sourceLinks = links.value.filter(link => link.target === selectedNode.value!.id)
  
  if (sourceLinks.length === 0) {
    return false
  }
  
  for (const link of sourceLinks) {
    const sourceNode = items.value.find(n => n.id === link.source)
    if (sourceNode) {
      if (sourceNode.type === 'python') {
        return true
      }
      
      if (sourceNode.type === 'local' && sourceNode.model) {
        const extension = sourceNode.model.toLowerCase()
        if (extension.includes('.py') || extension.includes('python') ||
            extension.includes('.md') || extension.includes('.txt')) {
          return true
        }
      }
    }
  }
  
  return false
})

// 检查工作流是否有效
const isWorkflowValid = computed(() => {
  const startNode = items.value.find(item => item.type === 'start')
  const endNode = items.value.find(item => item.type === 'end')
  const startCount = items.value.filter(item => item.type === 'start').length
  const endCount = items.value.filter(item => item.type === 'end').length
  
  return startCount === 1 && endCount === 1 && startNode && endNode
})

// 文本截断函数
const truncateText = (text: string, maxLength: number = 20): string => {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

// 获取节点图标
const getNodeIcon = (node: NodeData | null | undefined): string => {
  if (!node) return 'fa-circle'
  
  if (node.type === 'local') {
    const extension = node.model.startsWith('.') ? node.model : '.' + (node.model || '');
    const iconMap: Record<string, string> = {
      '.txt': 'fa-file-text-o',
      '.md': 'fa-file-text-o',
      '.pdf': 'fa-file-pdf-o',
      '.docx': 'fa-file-word-o',
      '.xlsx': 'fa-file-excel-o',
      '.json': 'fa-file-code-o',
      '.csv': 'fa-file-excel-o',
      '.html': 'fa-file-code-o',
      '.htm': 'fa-file-code-o',
      '.py': 'fa-file-code-o',
      '.python': 'fa-file-code-o'
    }
    return iconMap[extension] || 'fa-file'
  }
  
  if (node.type === 'reasoning') {
    const modelIcons: Record<string, string> = {
      'ollama': 'fa-microchip',
      'openai': 'fa-bolt',
      'deepseek': 'fa-rocket',
      'anthropic': 'fa-robot',
      'google': 'fa-google',
      'azure': 'fa-cloud',
      'custom': 'fa-cogs'
    }
    return modelIcons[node.model_type] || 'fa-microchip'
  }
  
  if (node.type === 'decision') {
    return 'fa-code-fork'
  }
  
  if (node.type === 'knowledge') {
    return 'fa-database'
  }
  
  if (node.type === 'structured') {
    return 'fa-table'
  }
  
  if (node.type === 'mcp') {
    return 'fa-plug'
  }
  
  if (node.type === 'start') {
    return 'fa-play-circle'
  }
  
  if (node.type === 'end') {
    return 'fa-flag-checkered'
  }
  
  const icons: Record<NodeType, string> = {
    'reasoning': 'fa-microchip',
    'decision': 'fa-code-fork',
    'local': 'fa-file-text',
    'web': 'fa-search',
    'text': 'fa-tag',
    'webpage': 'fa-globe',
    'python': 'fa-code',
    'knowledge': 'fa-database',
    'structured': 'fa-table',
    'mcp': 'fa-plug',
    'start': 'fa-play-circle',
    'end': 'fa-flag-checkered'
  }
  return icons[node.type] || 'fa-circle'
}

// 获取节点图标颜色
const getNodeIconColor = (node: NodeData | null | undefined): string => {
  if (!node) return '#757575'
  
  if (node.type === 'local') {
    const fileExtension = node.model || ''
    const extension = fileExtension.startsWith('.') ? fileExtension : '.' + fileExtension;
    
    if (!fileExtension || fileExtension === '.' || extension === '.') {
      return 'fa-file'
    }
    
    const iconMap: Record<string, string> = {
      '.txt': 'fa-file-text-o',
      '.md': 'fa-file-text-o',
      '.pdf': 'fa-file-pdf-o',
      '.docx': 'fa-file-word-o',
      '.xlsx': 'fa-file-excel-o',
      '.json': 'fa-file-code-o',
      '.csv': 'fa-file-excel-o',
      '.html': 'fa-file-code-o',
      '.htm': 'fa-file-code-o',
      '.py': 'fa-file-code-o',
      '.python': 'fa-file-code-o'
    }
    return iconMap[extension] || 'fa-file'
  }

  if (node.type === 'reasoning') {
    const modelColors: Record<string, string> = {
      'ollama': '#4CAF50',
      'openai': '#10A37F',
      'deepseek': '#0E76FD',
      'anthropic': '#FF6B35',
      'google': '#4285F4',
      'azure': '#0078D4',
      'custom': '#9C27B0'
    }
    return modelColors[node.model_type] || '#4CAF50'
  }
  
  if (node.type === 'decision') {
    return '#E91E63'
  }
  
  if (node.type === 'knowledge') {
    return '#9C27B0'
  }
  
  if (node.type === 'structured') {
    return '#673AB7'
  }
  
  if (node.type === 'mcp') {
    return '#00BCD4'
  }
  
  if (node.type === 'start') {
    return '#4CAF50'
  }
  
  if (node.type === 'end') {
    return '#f44336'
  }
  
  const colors: Record<NodeType, string> = {
    'reasoning': '#4CAF50',
    'decision': '#E91E63',
    'local': '#2196F3',
    'web': '#FF9800',
    'text': '#FF5722',
    'webpage': '#795548',
    'python': '#3776AB',
    'knowledge': '#9C27B0',
    'structured': '#673AB7',
    'mcp': '#00BCD4',
    'start': '#4CAF50',
    'end': '#f44336'
  }
  return colors[node.type] || '#757575'
}

const getFileName = (filePath: string): string => {
  if (!filePath) return ''
  
  // 提取文件名（支持Windows和Unix路径）
  const fileName = filePath.split(/[\\/]/).pop() || filePath
  return fileName
}

// 获取节点显示配置 - 添加本地节点处理模式显示
const getNodeDisplayConfig = (node: NodeData): string => {
  if (!node.result) return t('no_execute')
  
  try {
    const parsed = JSON.parse(node.result)
    if (parsed && typeof parsed === 'object') {
      if (node.type === 'local') {
        if (parsed.success) {
          const mode = parsed.mode || 'full'
          const fileName = getFileName(parsed.filePath || node.prompt || '')
          
          if (mode === 'full') {
            return `${t('full_file_mode')} | ${truncateText(fileName || '文件', 15)}`
          } else if (mode === 'template') {
            const slices = parsed.slices || {}
            const sliceCount = Object.keys(slices).length
            return `${t('template_mode')} | ${truncateText(fileName || '文件', 15)} | ${sliceCount}个切片`
          }
        }
      }
      
      if (node.type === 'knowledge' && parsed.type === 'knowledge_retrieval') {
        if (parsed.success) {
          const blocks = parsed.relevantBlocks || []
          const kbOptions = node.kbOptions || defaultKbOptions
          return `${blocks.length}/${kbOptions.topK || 5} | ${blocks.length > 0 ? (blocks[0].similarity * 100).toFixed(1) + '%' : 'N/A'}`
        } else {
          return t('retrieval_error')
        }
      }
      
      if (node.type === 'structured' && parsed.type === 'structured') {
        const rowCount = node.structuredData?.length || 0
        const columnCount = node.structuredColumns?.length || 0
        const format = node.structuredConfig?.outputFormat || 'json'
        return `${rowCount}行×${columnCount}列 | ${format.toUpperCase()}`
      }
      
      if (node.type === 'decision' && parsed.type === 'decision') {
        if (parsed.success) {
          const branchName = parsed.selectedBranchName || parsed.selectedBranch
          return `${t('selected_branch')}: ${branchName}`
        } else {
          return t('decision_error')
        }
      }
      
      if (node.type === 'mcp' && parsed.type === 'mcp') {
        if (parsed.success) {
          return `${t('mcp_connected')} | ${parsed.tool || '未选择工具'}`
        } else {
          return t('mcp_connection_error')
        }
      }
      
      if (node.type === 'start' && parsed.type === 'start') {
        return truncateText(parsed.result || node.prompt, 22)
      }
      
      if (node.type === 'end' && parsed.type === 'end') {
        return truncateText(parsed.result || '', 22)
      }
      
      if (parsed.result !== undefined) {
        const resultStr = typeof parsed.result === 'string' ? parsed.result : JSON.stringify(parsed.result)
        return truncateText(resultStr, 22)
      }
      return truncateText(node.result, 22)
    }
    return truncateText(node.result, 22)
  } catch {
    return truncateText(node.result, 22)
  }
}

// 获取状态颜色
const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    'running': '#2196F3',
    'success': '#4CAF50',
    'error': '#f44336'
  }
  return colors[status] || '#757575'
}

// 获取状态文本
const getStatusText = (status: string): string => {
  const texts: Record<string, string> = {
    'idle': t('status_idle'),
    'running': t('status_running'),
    'success': t('status_success'),
    'error': t('status_error')
  }
  return texts[status] || status
}

// 获取状态图标
const getStatusIcon = (status: string): string => {
  const icons: Record<string, string> = {
    'idle': 'fa-clock',
    'running': 'fa-spinner fa-spin',
    'success': 'fa-check-circle',
    'error': 'fa-exclamation-circle'
  }
  return icons[status] || 'fa-circle'
}

// 获取上游数据
const getUpstreamData = (nodeId: number): any => {
  const sourceLinks = links.value.filter(link => link.target === nodeId)
  
  if (sourceLinks.length === 0) {
    return null
  }
  
  const upstreamData: Record<string, any> = {}
  
  for (const link of sourceLinks) {
    const sourceNode = items.value.find(n => n.id === link.source)
    if (!sourceNode || !sourceNode.result) continue
    
    const key = `node_${sourceNode.id}`
    
    try {
      const parsed = JSON.parse(sourceNode.result)
      if (parsed && typeof parsed === 'object') {
        if ('result' in parsed) {
          upstreamData[key] = parsed.result
        } else {
          upstreamData[key] = parsed
        }
      } else {
        upstreamData[key] = parsed || sourceNode.result
      }
    } catch {
      upstreamData[key] = sourceNode.result
    }
  }
  
  return upstreamData
}

// 更新上游节点信息的计算属性
const upstreamNodeInfo = computed(() => {
  if (!selectedNode.value) return []
  
  return links.value
    .filter(link => link.target === selectedNode.value!.id)
    .map(link => {
      const sourceNode = items.value.find(n => n.id === link.source)
      return {
        node: sourceNode,
        exists: !!sourceNode,
        id: link.source,
        key: sourceNode ? `node_${sourceNode.id}` : `node_${link.source}`,
        name: sourceNode ? sourceNode.name : t('unknown_node'),
        type: sourceNode ? sourceNode.type : t('unknown_node'),
        icon: sourceNode ? getNodeIcon(sourceNode) : 'fa-question-circle',
        iconColor: sourceNode ? getNodeIconColor(sourceNode) : '#757575'
      }
    })
})

// 统一的连接点颜色计算函数 - 修改以支持开始节点
const getConnectorColor = (node: NodeData, type: 'top' | 'bottom' | 'branch' | 'default' | 'file-default' | 'file-port' | 'start-prompt' | 'start-file', branchId?: string, portId?: string): string => {
  const isActive = (() => {
    if (linkingSourceId.value === node.id) {
      if (type === 'branch') {
        return linkingSourceBranchId.value === branchId;
      } else if (type === 'file-port') {
        return linkingSourcePortId.value === portId;
      } else if (type === 'file-default') {
        return linkingSourcePortId.value === 'default';
      } else if (type === 'start-prompt') {
        return linkingSourceStartPort.value === 'prompt';
      } else if (type === 'start-file') {
        return linkingSourceStartPort.value === 'file';
      } else if (type === 'top') {
        return linkingSourceConnector.value === 'top';
      } else if (type === 'bottom' || type === 'default') {
        return linkingSourceConnector.value === 'bottom' && 
               linkingSourceBranchId.value === null && 
               linkingSourcePortId.value === null &&
               linkingSourceStartPort.value === null;
      }
    }
    return false;
  })();
  
  if (isActive) {
    return 'var(--fontActiveColor)';
  } else if (hoveredNodeId.value === node.id) {
    return 'var(--fontActiveColor)';
  } else {
    return 'rgba(var(--fontActiveColor-rgb, 33, 150, 243), 0.3)';
  }
}

// 获取文件节点的输出端口
const getFileNodeOutputPorts = (node: NodeData): Array<{id: string, name: string, description?: string}> => {
  if (node.type !== 'local' || node.fileMode !== 'template' || !node.fileTemplates) {
    return []
  }
  
  return node.fileTemplates.map((template, index) => ({
    id: `output${index + 1}`,  // 使用简单的端口ID
    name: `输出端口 ${index + 1}`,
    description: `模板: ${template.name} (模式: ${template.pattern})`
  }))
}

// 检查文件节点默认端口是否启用
const getFileNodeDefaultPortEnabled = (node: NodeData): boolean => {
  return node.type === 'local' && node.fileMode === 'template'
}

// 计算文件节点输出端口的变换位置（类似于决策节点）
const getFileNodePortTransform = (node: NodeData, portIndex: number): string => {
  const ports = getFileNodeOutputPorts(node)
  const defaultPort = getFileNodeDefaultPortEnabled(node) ? 1 : 0
  const totalPorts = ports.length + defaultPort
  
  // 在节点底部边界均匀分布所有端口
  const totalWidth = node.width
  const spacing = totalWidth / (totalPorts + 1)
  
  // 计算x位置（从左侧开始均匀分布）
  // 如果有默认端口，portIndex需要偏移
  const x = (portIndex + (defaultPort ? 2 : 1)) * spacing
  
  // y位置在节点底部
  const y = node.height
  
  return `translate(${x}, ${y})`
}

// 计算默认端口位置
const getFileNodeDefaultPortTransform = (node: NodeData): string => {
  const ports = getFileNodeOutputPorts(node)
  const defaultPort = getFileNodeDefaultPortEnabled(node) ? 1 : 0
  const totalPorts = ports.length + defaultPort
  const totalWidth = node.width
  const spacing = totalWidth / (totalPorts + 1)
  
  // 默认端口在第一个位置
  const x = spacing
  const y = node.height
  
  return `translate(${x}, ${y})`
}

// 计算决策分支连接点的变换（将默认连接点和分支连接点一起均匀分布）
const getBranchConnectorTransform = (node: NodeData, branchIndex: number): string => {
  const branchCount = node.decisionBranches?.length || 0
  
  // 计算总连接点数量（分支连接点 + 1个默认连接点）
  const totalConnectors = branchCount + 1
  
  // 在节点底部边界均匀分布所有连接点
  const totalWidth = node.width
  const spacing = totalWidth / (totalConnectors + 1)
  
  // 计算x位置（从左侧开始均匀分布）
  // 索引 +1 是为了跳过第一个位置给默认连接点
  const x = (branchIndex + 2) * spacing
  
  // y位置在节点底部
  const y = node.height
  
  return `translate(${x}, ${y})`
}

// 计算决策节点默认连接点位置（在底部左侧第一个位置）
const getDefaultConnectorTransform = (node: NodeData): string => {
  const branchCount = node.decisionBranches?.length || 0
  const totalConnectors = branchCount + 1
  const totalWidth = node.width
  const spacing = totalWidth / (totalConnectors + 1)
  
  // 默认连接点在第一个位置
  const x = spacing
  const y = node.height
  
  return `translate(${x}, ${y})`
}

// 提取Python代码块
const extractPythonCodeFromMarkdown = (markdown: string): string => {
  if (!markdown) return ''
  
  const lines = markdown.split('\n')
  const codeBlocks: string[] = []
  let currentBlock: string[] = []
  let inPythonCodeBlock = false
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedLine = line.trim()
    
    if (trimmedLine.startsWith('```python') || trimmedLine.startsWith('```py')) {
      inPythonCodeBlock = true
      currentBlock = []
      continue
    }
    
    if (trimmedLine === '```' && inPythonCodeBlock) {
      inPythonCodeBlock = false
      if (currentBlock.length > 0) {
        codeBlocks.push(currentBlock.join('\n'))
      }
      continue
    }
    
    if (inPythonCodeBlock) {
      currentBlock.push(line)
    }
  }
  
  if (inPythonCodeBlock && currentBlock.length > 0) {
    codeBlocks.push(currentBlock.join('\n'))
  }
  
  if (codeBlocks.length === 1) {
    return codeBlocks[0].trim()
  }
  
  if (codeBlocks.length > 1) {
    return codeBlocks.join('\n\n')
  }
  
  return ''
}

// 获取上游节点的代码内容
const getUpstreamCodeContent = (nodeId: number): string => {
  const sourceLinks = links.value.filter(link => link.target === nodeId)
  
  if (sourceLinks.length === 0) {
    return ''
  }
  
  const link = sourceLinks[0]
  const sourceNode = items.value.find(n => n.id === link.source)
  
  if (!sourceNode || !sourceNode.result) {
    return ''
  }
  
  try {
    let content = ''
    let parsedResult = null
    
    try {
      parsedResult = JSON.parse(sourceNode.result)
      
      if (parsedResult && typeof parsedResult === 'object') {
        if (parsedResult.result !== undefined) {
          content = parsedResult.result
        } else {
          content = sourceNode.result
        }
      } else {
        content = sourceNode.result
      }
    } catch {
      content = sourceNode.result
      parsedResult = null
    }
    
    if (sourceNode.type === 'text' || sourceNode.type === 'start') {
      if (parsedResult !== null) {
        if (typeof parsedResult === 'object') {
          return `# 上游文本节点提供了JSON数据: ${content.substring(0, 100)}...
# 数据已自动加载到input变量中
# 如果input是JSON字符串，请使用json.loads()解析

# 示例代码：
# import json
# data = json.loads(input) if isinstance(input, str) else input
# output = sum(data) if isinstance(data, (list, tuple)) else str(data)`
        } else {
          return `# 上游文本节点提供了数据: ${content.substring(0, 100)}...
# 数据已自动加载到input变量中
# output = str(input)  # 示例：将输入转换为字符串`
        }
      } else {
        const textContent = content
        return `# 上游文本节点提供了文本内容
# 文本内容已自动加载到input变量中
input = ${JSON.stringify(textContent)}
# 示例代码：
# output = f"处理后的文本: {input}"`
      }
    }
    
    if (sourceNode.type === 'local' && sourceNode.model) {
      const extension = sourceNode.model.toLowerCase()
      
      if (extension.includes('.py') || extension.includes('python')) {
        return content
      }
      
      if (extension.includes('.md')) {
        return extractPythonCodeFromMarkdown(content)
      }
      
      if (extension.includes('.txt')) {
        return extractPythonCodeFromMarkdown(content)
      }
    }
    
    if (sourceNode.type === 'python') {
      return sourceNode.prompt
    }
    
    if (sourceNode.type === 'structured') {
      return extractPythonCodeFromMarkdown(content)
    }
    
    return extractPythonCodeFromMarkdown(content)
    
  } catch (error) {
    console.error('提取上游代码失败:', error)
    return ''
  }
}

// 安全更新知识库选项的函数
const updateKbOption = (key: string, value: any): void => {
  if (!selectedNode.value || selectedNode.value.type !== 'knowledge') return
  
  if (!selectedNode.value.kbOptions) {
    selectedNode.value.kbOptions = { ...defaultKbOptions }
  }
  
  let typedValue: any = value
  if (key === 'topK') {
    typedValue = parseInt(value) || defaultKbOptions.topK
  } else if (key === 'summaryWeight' || key === 'reverseWeight') {
    typedValue = parseFloat(value) || defaultKbOptions[key]
  } else if (key === 'useReverseInference' || key === 'debug') {
    typedValue = Boolean(value)
  } else if (key === 'embedModel') {
    typedValue = String(value)
  }
  
  selectedNode.value.kbOptions = {
    ...selectedNode.value.kbOptions,
    [key]: typedValue
  }
  
  saveToLocalStorage()
}

// 结构化节点：更新配置
const updateStructuredConfig = (key: keyof StructuredConfig, value: any): void => {
  if (!selectedNode.value || selectedNode.value.type !== 'structured') return
  
  if (!selectedNode.value.structuredConfig) {
    selectedNode.value.structuredConfig = { ...defaultStructuredConfig }
  }
  
  selectedNode.value.structuredConfig = {
    ...selectedNode.value.structuredConfig,
    [key]: value
  }
  
  saveToLocalStorage()
}

// 结构化节点：添加列
const addStructuredColumn = (): void => {
  if (!selectedNode.value || selectedNode.value.type !== 'structured') return
  
  if (!selectedNode.value.structuredColumns) {
    selectedNode.value.structuredColumns = [
      { id: 0, name: t('key_column'), type: 'text', required: true },
      { id: 1, name: t('value_column'), type: 'text', required: true }
    ]
  }
  
  const newColumnId = selectedNode.value.structuredColumns.length > 0 
    ? Math.max(...selectedNode.value.structuredColumns.map(col => col.id)) + 1 
    : 0
  
  selectedNode.value.structuredColumns.push({
    id: newColumnId,
    name: t('column') + ' ' + (selectedNode.value.structuredColumns.length + 1),
    type: 'text',
    required: false
  })
  
  // 为所有现有行添加新列的空白值
  if (selectedNode.value.structuredData) {
    selectedNode.value.structuredData.forEach(row => {
      row.columns[newColumnId.toString()] = ''
    })
  }
  
  saveToLocalStorage()
}

// 结构化节点：删除列
const deleteStructuredColumn = (columnId: number): void => {
  if (!selectedNode.value || selectedNode.value.type !== 'structured' || !selectedNode.value.structuredColumns) return
  
  // 不能删除少于2列
  if (selectedNode.value.structuredColumns.length <= 2) {
    return
  }
  
  const index = selectedNode.value.structuredColumns.findIndex(col => col.id === columnId)
  if (index !== -1) {
    // 从列数组中删除
    selectedNode.value.structuredColumns.splice(index, 1)
    
    // 从所有行中删除该列的数据
    if (selectedNode.value.structuredData) {
      selectedNode.value.structuredData.forEach(row => {
        delete row.columns[columnId.toString()]
      })
    }
    
    saveToLocalStorage()
  }
}

// 结构化节点：更新列
const updateStructuredColumn = (columnId: number, field: keyof StructuredColumn, value: any): void => {
  if (!selectedNode.value || selectedNode.value.type !== 'structured' || !selectedNode.value.structuredColumns) return
  
  const column = selectedNode.value.structuredColumns.find(col => col.id === columnId)
  if (column) {
    (column[field] as any) = value
    saveToLocalStorage()
  }
}

// 结构化节点：添加行
const addStructuredRow = (): void => {
  if (!selectedNode.value || selectedNode.value.type !== 'structured') return
  
  if (!selectedNode.value.structuredData) {
    selectedNode.value.structuredData = []
  }
  
  if (!selectedNode.value.structuredColumns || selectedNode.value.structuredColumns.length === 0) {
    selectedNode.value.structuredColumns = [
      { id: 0, name: t('key_column'), type: 'text', required: true },
      { id: 1, name: t('value_column'), type: 'text', required: true }
    ]
  }
  
  const newRowId = selectedNode.value.structuredData.length > 0 
    ? Math.max(...selectedNode.value.structuredData.map(row => row.id)) + 1 
    : 0
  
  // 创建新行，为每一列初始化空值
  const newRow: StructuredRow = {
    id: newRowId,
    columns: {}
  }
  
  // 为每一列设置初始值
  selectedNode.value.structuredColumns.forEach(column => {
    newRow.columns[column.id.toString()] = ''
  })
  
  selectedNode.value.structuredData.push(newRow)
  
  saveToLocalStorage()
}

// 结构化节点：删除行
const deleteStructuredRow = (rowId: number): void => {
  if (!selectedNode.value || selectedNode.value.type !== 'structured' || !selectedNode.value.structuredData) return
  
  const index = selectedNode.value.structuredData.findIndex(row => row.id === rowId)
  if (index !== -1) {
    selectedNode.value.structuredData.splice(index, 1)
    saveToLocalStorage()
  }
}

// 结构化节点：更新行数据
const updateStructuredRow = (rowId: number, columnId: string, value: string): void => {
  if (!selectedNode.value || selectedNode.value.type !== 'structured' || !selectedNode.value.structuredData) return
  
  const row = selectedNode.value.structuredData.find(row => row.id === rowId)
  if (row) {
    row.columns[columnId] = value
    saveToLocalStorage()
  }
}

// 结构化节点：格式化输出
const formatStructuredOutput = (): string => {
  if (!selectedNode.value || selectedNode.value.type !== 'structured' || 
      !selectedNode.value.structuredData || !selectedNode.value.structuredColumns) {
    return ''
  }
  
  const config = selectedNode.value.structuredConfig || defaultStructuredConfig
  const rows = selectedNode.value.structuredData
  const columns = selectedNode.value.structuredColumns
  
  if (rows.length === 0) {
    return t('empty_table')
  }
  
  // 添加表格描述
  let description = ''
  if (config.tableDescription && config.tableDescription.trim() !== '') {
    description = `# ${config.tableDescription}\n\n`
  }
  
  switch (config.outputFormat) {
    case 'json':
      // 如果有两列或更多，第一列作为key，第二列作为value，其他列作为附加属性
      if (columns.length >= 2) {
        const jsonObj: Record<string, any> = {}
        rows.forEach(row => {
          const key = row.columns['0'] || ''
          const value = row.columns['1'] || ''
          
          if (key.trim() !== '') {
            // 如果只有两列，直接使用value
            if (columns.length === 2) {
              jsonObj[key.trim()] = value.trim()
            } else {
              // 如果有更多列，创建一个对象
              const itemObj: Record<string, any> = {
                value: value.trim()
              }
              
              // 添加其他列作为附加属性
              for (let i = 2; i < columns.length; i++) {
                const columnId = columns[i].id.toString()
                const columnName = columns[i].name || `column_${columns[i].id}`
                const columnValue = row.columns[columnId] || ''
                if (columnValue.trim() !== '') {
                  itemObj[columnName] = columnValue.trim()
                }
              }
              
              jsonObj[key.trim()] = itemObj
            }
          }
        })
        return description + JSON.stringify(jsonObj, null, 2)
      } else {
        // 只有一列的情况
        const jsonArray = rows.map(row => row.columns['0'] || '')
        return description + JSON.stringify(jsonArray, null, 2)
      }
    
    case 'markdown':
      let markdown = description
      if (config.includeHeaders) {
        markdown += '| ' + columns.map(col => col.name || `column_${col.id}`).join(' | ') + ' |\n'
        markdown += '| ' + columns.map(() => '---').join(' | ') + ' |\n'
      }
      rows.forEach(row => {
        const rowValues = columns.map(col => row.columns[col.id.toString()] || '')
        markdown += '| ' + rowValues.join(' | ') + ' |\n'
      })
      return markdown.trim()
    
    case 'csv':
      let csv = description
      if (config.includeHeaders) {
        csv += columns.map(col => `"${(col.name || `column_${col.id}`).replace(/"/g, '""')}"`).join(',') + '\n'
      }
      rows.forEach(row => {
        const rowValues = columns.map(col => `"${(row.columns[col.id.toString()] || '').replace(/"/g, '""')}"`)
        csv += rowValues.join(',') + '\n'
      })
      return csv.trim()
    
    case 'text':
    default:
      let text = description
      rows.forEach((row, rowIndex) => {
        text += `${rowIndex + 1}. `
        columns.forEach((col, colIndex) => {
          if (colIndex > 0) text += ' | '
          const columnName = col.name || `column_${col.id}`
          const value = row.columns[col.id.toString()] || ''
          if (config.includeHeaders) {
            text += `${columnName}: ${value}`
          } else {
            text += value
          }
        })
        text += '\n'
      })
      return text.trim()
  }
}

// 结构化节点：获取输出预览
const getStructuredOutputPreview = (): string => {
  const output = formatStructuredOutput()
  if (!output || output === t('empty_table')) return ''
  
  const config = selectedNode.value?.structuredConfig || defaultStructuredConfig
  const rowCount = selectedNode.value?.structuredData?.length || 0
  const columnCount = selectedNode.value?.structuredColumns?.length || 0
  
  let preview = `**${t('output_preview')}**\n\n`
  preview += `**${t('output_format')}**: ${config.outputFormat.toUpperCase()}\n`
  preview += `**${t('include_headers')}**: ${config.includeHeaders ? '是' : '否'}\n`
  preview += `**${t('row_number')}**: ${rowCount}\n`
  preview += `**列数**: ${columnCount}\n\n`
  
  // 添加JSON格式说明
  if (config.outputFormat === 'json' && columnCount >= 2) {
    preview += `**${t('json_key_value_info')}**\n\n`
  }
  
  const lines = output.split('\n')
  const previewLines = lines.slice(0, 10)
  previewLines.forEach(line => {
    preview += line + '\n'
  })
  
  if (lines.length > 10) {
    preview += `\n... (还有 ${lines.length - 10} 行)`
  }
  
  return preview
}


const testMcpConnection = async (nodeId: number): Promise<void> => {
  if (!runner.value) return
  try {
    await runner.value.testMcpConnection(nodeId)
  } catch (error: any) {
    console.error('MCP连接测试失败:', error)
  }
}

const connectMcpNode = async (nodeId: number): Promise<void> => {
  if (!runner.value) return
  try {
    await runner.value.connectMcpNode(nodeId)
  } catch (error: any) {
    console.error('MCP连接失败:', error)
  }
}

const disconnectMcpNode = async (nodeId: number): Promise<void> => {
  if (!runner.value) return
  try {
    await runner.value.disconnectMcpNode(nodeId)
  } catch (error: any) {
    console.error('MCP断开连接失败:', error)
  }
}

const refreshMcpTools = async (nodeId: number): Promise<void> => {
  if (!runner.value) return
  try {
    await runner.value.refreshMcpTools(nodeId)
  } catch (error: any) {
    console.error('刷新MCP工具失败:', error)
  }
}

// 决策节点：添加分支（修复版本）
const addDecisionBranch = (): void => {
  if (!selectedNode.value || selectedNode.value.type !== 'decision') {
    console.error('没有选中决策节点')
    return
  }
  
  console.log('添加分支前:', selectedNode.value.decisionBranches)
  
  // 确保 decisionBranches 存在
  if (!selectedNode.value.decisionBranches) {
    selectedNode.value.decisionBranches = []
  }
  
  const branchCount = selectedNode.value.decisionBranches.length
  if (branchCount >= 10) {
    console.warn('已达到最大分支数限制')
    return
  }
  
  // 生成新的分支ID和名称
  const newBranchId = `branch_${branchCount + 1}`
  const newBranch = {
    id: newBranchId,
    name: `${t('branch')} ${branchCount + 1}`,
    description: '',
    dataTemplate: '{input}'
  }
  
  // 添加到分支数组
  selectedNode.value.decisionBranches.push(newBranch)
  
  console.log('添加分支后:', selectedNode.value.decisionBranches)
  
  // 确保 decisionConfig 同步更新
  if (selectedNode.value.decisionConfig) {
    if (!selectedNode.value.decisionConfig.branches) {
      selectedNode.value.decisionConfig.branches = []
    }
    // 确保 decisionConfig.branches 同步
    selectedNode.value.decisionConfig.branches = [...selectedNode.value.decisionBranches]
  }
  
  // 保存到本地存储
  saveToLocalStorage()
  
  // 强制更新UI
  nextTick(() => {
    // 重新选择节点以刷新显示
    const currentId = selectedNodeId.value
    selectedNodeId.value = null
    nextTick(() => {
      selectedNodeId.value = currentId
    })
  })
}

// 决策节点：删除分支（修复版本）
const deleteDecisionBranch = (branchId: string): void => {
  if (!selectedNode.value || selectedNode.value.type !== 'decision') {
    console.error('没有选中决策节点')
    return
  }
  
  console.log('删除分支:', {
    branchId,
    decisionBranches: selectedNode.value.decisionBranches,
    decisionConfig: selectedNode.value.decisionConfig
  })
  
  // 确保 decisionBranches 存在
  if (!selectedNode.value.decisionBranches) {
    selectedNode.value.decisionBranches = []
  }
  
  // 不能删除少于2个分支
  if (selectedNode.value.decisionBranches.length <= 2) {
    console.warn('不能删除分支：至少需要保留2个分支')
    return
  }
  
  // 找到要删除的分支索引
  const branchIndex = selectedNode.value.decisionBranches.findIndex(branch => branch.id === branchId)
  if (branchIndex === -1) {
    console.warn('未找到要删除的分支:', branchId)
    return
  }
  
  console.log('找到分支，索引:', branchIndex)
  
  // 从分支数组中删除
  selectedNode.value.decisionBranches.splice(branchIndex, 1)
  
  // 同步到 decisionConfig（如果存在）
  if (selectedNode.value.decisionConfig) {
    if (!selectedNode.value.decisionConfig.branches) {
      selectedNode.value.decisionConfig.branches = []
    }
    // 确保同步删除
    const configIndex = selectedNode.value.decisionConfig.branches.findIndex(b => b.id === branchId)
    if (configIndex !== -1) {
      selectedNode.value.decisionConfig.branches.splice(configIndex, 1)
    }
  }
  
  // 删除连接到该分支的所有链接
  links.value = links.value.filter(link => {
    // 检查是否是决策节点分支的连接
    if (link.source === selectedNode.value!.id && link.branch === branchId) {
      console.log('删除连接到分支的连接:', link)
      return false
    }
    return true
  })
  
  console.log('删除后的分支列表:', selectedNode.value.decisionBranches)
  
  // 保存到本地存储
  saveToLocalStorage()
  
  // 强制刷新界面
  nextTick(() => {
    // 重新选择节点以刷新显示
    const currentId = selectedNodeId.value
    selectedNodeId.value = null
    nextTick(() => {
      selectedNodeId.value = currentId
    })
  })
}

// 决策节点：处理决策模式变更
const onDecisionModeChange = (): void => {
  if (!selectedNode.value || selectedNode.value.type !== 'decision') return
  
  if (selectedNode.value.decisionMode === 'rule' && !selectedNode.value.decisionRules) {
    selectedNode.value.decisionRules = `[
  {
    "condition": "input && input.length > 100",
    "branch": "branch_1"
  },
  {
    "condition": "input && input.includes('error')",
    "branch": "branch_2"
  },
  {
    "condition": "true",
    "branch": "branch_2"
  }
]`
  }
}

// 本地节点：处理文件模式变更
const onFileModeChange = (): void => {
  if (!selectedNode.value || selectedNode.value.type !== 'local') return
  
  if (!selectedNode.value.fileMode) {
    selectedNode.value.fileMode = 'full'
  }
  
  // 当切换到模板模式时，确保模板数组存在
  if (selectedNode.value.fileMode === 'template' && !selectedNode.value.fileTemplates) {
    selectedNode.value.fileTemplates = [...defaultFileTemplates]
  }
  
  // 确保输出端口配置存在
  if (selectedNode.value.fileMode === 'template') {
    if (!selectedNode.value.outputPorts) {
      selectedNode.value.outputPorts = {
        default: true,
        ports: getFileNodeOutputPorts(selectedNode.value).map(port => ({
          id: port.id,
          name: port.name,
          description: port.description,
          enabled: true
        }))
      }
    }
  }
  
  saveToLocalStorage()
}

// 本地节点：添加文件模板
const addFileTemplate = (): void => {
  if (!selectedNode.value || selectedNode.value.type !== 'local') return
  
  if (!selectedNode.value.fileTemplates) {
    selectedNode.value.fileTemplates = []
  }
  
  const templateCount = selectedNode.value.fileTemplates.length
  const newTemplate: FileTemplate = {
    name: `模板 ${templateCount + 1}`,
    pattern: '',
    outputName: `template_${templateCount + 1}`  // 保持这个字段，但不再用于端口ID
  }
  
  selectedNode.value.fileTemplates.push(newTemplate)
  
  // 更新输出端口
  if (selectedNode.value.fileMode === 'template') {
    if (!selectedNode.value.outputPorts) {
      selectedNode.value.outputPorts = {
        default: true,
        ports: []
      }
    }
    
    // 使用简单的端口ID: output1, output2, output3...
    const portId = `output${templateCount + 1}`
    
    selectedNode.value.outputPorts.ports.push({
      id: portId,  // 使用简单的端口ID
      name: `output ${templateCount + 1}`,
      description: newTemplate.name,
      enabled: true
    })
  }
  
  saveToLocalStorage()
}

// 本地节点：删除文件模板
const deleteFileTemplate = (index: number): void => {
  if (!selectedNode.value || selectedNode.value.type !== 'local' || !selectedNode.value.fileTemplates) return
  
  if (selectedNode.value.fileTemplates.length > 0) {
    const template = selectedNode.value.fileTemplates[index]
    selectedNode.value.fileTemplates.splice(index, 1)
    
    // 更新输出端口
    if (selectedNode.value.fileMode === 'template' && selectedNode.value.outputPorts) {
      // 删除对应索引的端口
      selectedNode.value.outputPorts.ports.splice(index, 1)
      
      // 重新分配端口ID，确保顺序一致
      selectedNode.value.outputPorts.ports.forEach((port, i) => {
        port.id = `output${i + 1}`
        port.name = `output ${i + 1}`
      })
      
      // 删除连接到该端口的所有连接
      links.value = links.value.filter(link => 
        !(link.source === selectedNode.value!.id && 
          link.sourcePort && 
          link.sourcePort.startsWith('output'))
      )
    }
    
    saveToLocalStorage()
  }
}

// 修改 handleFileNodeConnectorClick 函数
const handleFileNodeConnectorClick = (nodeId: number, portId: string, event: MouseEvent): void => {
  event.stopPropagation()
  event.preventDefault()
  
  selectedNodeId.value = nodeId
  propertiesShow.value = true
  
  if (operationMode.value === 'linking') {
    if (linkingSourceId.value === null) {
      // 从文件节点端口开始连接
      linkingSourceId.value = nodeId
      linkingSourcePortId.value = portId
      linkingSourceConnector.value = null
      linkingSourceBranchId.value = null
      linkingSourceStartPort.value = null
    } else if (linkingSourceId.value !== nodeId) {
      // 完成连接到其他节点
      const targetNode = items.value.find(n => n.id === linkingSourceId.value)
      if (targetNode && targetNode.type === 'decision') {
        // 决策节点作为源，连接到文件节点
        completeConnection(nodeId, 'top')
      } else {
        // 其他节点连接到文件节点
        completeConnection(nodeId, 'top')
      }
    } else {
      // 切换端口
      linkingSourcePortId.value = portId
      linkingSourceConnector.value = null
      linkingSourceBranchId.value = null
      linkingSourceStartPort.value = null
    }
  } else {
    // 进入连接模式
    operationMode.value = 'linking'
    linkingSourceId.value = nodeId
    linkingSourcePortId.value = portId
    linkingSourceConnector.value = null
    linkingSourceBranchId.value = null
    linkingSourceStartPort.value = null
  }
}

// 处理开始节点连接点点击
const handleStartNodeConnectorClick = (nodeId: number, portType: 'prompt' | 'file', event: MouseEvent): void => {
  event.stopPropagation()
  event.preventDefault()
  
  selectedNodeId.value = nodeId
  propertiesShow.value = true
  
  if (operationMode.value === 'linking') {
    if (linkingSourceId.value === null) {
      // 从开始节点端口开始连接
      linkingSourceId.value = nodeId
      linkingSourceStartPort.value = portType
      linkingSourceConnector.value = null
      linkingSourceBranchId.value = null
      linkingSourcePortId.value = null
    } else if (linkingSourceId.value !== nodeId) {
      // 不能从其他节点连接到开始节点
      alert('开始节点只能作为连接的起点，不能作为终点。')
      resetConnectionState()
    } else {
      // 切换端口
      linkingSourceStartPort.value = portType
      linkingSourceConnector.value = null
      linkingSourceBranchId.value = null
      linkingSourcePortId.value = null
    }
  } else {
    // 进入连接模式
    operationMode.value = 'linking'
    linkingSourceId.value = nodeId
    linkingSourceStartPort.value = portType
    linkingSourceConnector.value = null
    linkingSourceBranchId.value = null
    linkingSourcePortId.value = null
  }
}

// 刷新文件节点端口
const refreshFileNodePorts = (): void => {
  if (!selectedNode.value || selectedNode.value.type !== 'local') return
  
  // 重新生成端口配置（基于模板）
  if (selectedNode.value.fileTemplates && selectedNode.value.fileTemplates.length > 0) {
    // 确保有默认端口
    if (!selectedNode.value.outputPorts) {
      selectedNode.value.outputPorts = {
        default: true,
        ports: []
      }
    }
    
    // 清空并重新创建端口列表
    selectedNode.value.outputPorts.ports = []
    
    // 为每个模板创建一个端口，使用简单的 output1, output2, output3... 命名
    selectedNode.value.fileTemplates.forEach((template, index) => {
      const portId = `output${index + 1}`;
      
      selectedNode.value!.outputPorts!.ports.push({
        id: portId,  // 使用简单的端口ID: output1, output2, output3...
        name: `输出端口 ${index + 1}`,
        description: `模板: ${template.name} (模式: ${template.pattern})`,
        enabled: true,
        data: ''
      })
    })
    
    saveToLocalStorage()
    
    // 显示成功消息
    console.log(`刷新端口完成，创建了 ${selectedNode.value.outputPorts.ports.length} 个模板端口`)
  }
}

// 监听节点选中状态变化
watch(() => selectedNodeId.value, (newId, oldId) => {
  if (newId !== oldId) {
    const node = items.value.find(item => item.id === newId)
    if (node) {
      if (node.type === 'python') {
        nextTick(() => {
          const extractedCode = getUpstreamCodeContent(node.id)
          if (extractedCode && extractedCode.trim() !== '') {
            if (node.prompt !== extractedCode) {
              node.prompt = extractedCode
            }
          }
        })
      }
      
      if (node.type === 'knowledge') {
        if (!node.kbOptions) {
          node.kbOptions = { ...defaultKbOptions }
        }
        
        if (node.kbPath) {
          validateKnowledgeBaseNode(node.id)
        }
      }
      
      if (node.type === 'structured') {
        if (!node.structuredData) {
          node.structuredData = []
        }
        if (!node.structuredColumns) {
          node.structuredColumns = [
            { id: 0, name: t('key_column'), type: 'text', required: true },
            { id: 1, name: t('value_column'), type: 'text', required: true }
          ]
        }
        if (!node.structuredConfig) {
          node.structuredConfig = { ...defaultStructuredConfig }
        }
      }
      
      if (node.type === 'decision') {
        if (!node.decisionMode) {
          node.decisionMode = 'llm'
        }
        if (!node.decisionConfig) {
          node.decisionConfig = { ...defaultDecisionConfig }
        }
        if (!node.decisionBranches) {
          node.decisionBranches = node.decisionConfig.branches
        }
        if (!node.decisionPrompt && node.decisionMode === 'llm') {
          node.decisionPrompt = defaultDecisionConfig.prompt || ''
        }
        if (!node.decisionRules && node.decisionMode === 'rule') {
          node.decisionRules = defaultDecisionConfig.rules || ''
        }
      }
      
      if (node.type === 'mcp') {
        if (!node.mcpConfig) {
          node.mcpConfig = { ...defaultMCPConfig }
        }
        // 确保toolArguments是对象
        if (!node.mcpConfig.toolArguments || typeof node.mcpConfig.toolArguments !== 'object') {
          node.mcpConfig.toolArguments = {}
        }
      }
      
      if (node.type === 'local') {
        // 确保文件处理模式相关字段存在
        if (!node.fileMode) {
          node.fileMode = 'full'
        }
        if (!node.fileTemplates) {
          node.fileTemplates = [...defaultFileTemplates]
        }
        // 确保输出端口配置存在
        if (node.fileMode === 'template' && !node.outputPorts) {
          node.outputPorts = {
            default: true,
            ports: getFileNodeOutputPorts(node).map(port => ({
              id: port.id,
              name: port.name,
              description: port.description,
              enabled: true
            }))
          }
        }
      }
      
      if (node.type === 'start') {
        // 确保开始节点有正确的配置
        if (!node.startPorts) {
          node.startPorts = {
            prompt: true,
            file: true
          }
        }
      }
    }
  }
}, { immediate: true })

// 监听上游节点连接变化
watch(() => links.value, (newLinks, oldLinks) => {
  if (selectedNode.value) {
    if (selectedNode.value.type === 'python') {
      const extractedCode = getUpstreamCodeContent(selectedNode.value.id)
      if (extractedCode) {
        selectedNode.value.prompt = extractedCode
      }
    } else if (selectedNode.value.type === 'knowledge') {
      // 当有上游节点连接时，自动构建查询文本
      const queryText = getAllUpstreamQueryText(selectedNode.value.id)
      if (queryText && queryText.trim() !== '') {
        selectedNode.value.kbQuery = queryText
      }
    } else if (selectedNode.value.type === 'local') {
      // 当有上游节点连接时，可以自动从上游获取文件路径
      const upstreamFilePath = getUpstreamFilePath(selectedNode.value.id)
      if (upstreamFilePath && upstreamFilePath.trim() !== '') {
        selectedNode.value.prompt = upstreamFilePath
        // 尝试从文件路径中提取文件扩展名
        const fileExtension = '.' + upstreamFilePath.split('.').pop()?.toLowerCase()
        if (fileExtension && fileExtension !== '.') {
          selectedNode.value.model = fileExtension
        }
      }
    }
  }
}, { deep: true })

// 从上游节点获取文件路径
const getUpstreamFilePath = (nodeId: number): string => {
  const sourceLinks = links.value.filter(link => link.target === nodeId)
  
  if (sourceLinks.length === 0) {
    return ''
  }
  
  for (const link of sourceLinks) {
    const sourceNode = items.value.find(n => n.id === link.source)
    
    if (!sourceNode || !sourceNode.result) {
      continue
    }
    
    try {
      const parsed = JSON.parse(sourceNode.result)
      if (parsed && typeof parsed === 'object') {
        if (parsed.filePath) {
          return parsed.filePath
        } else if (parsed.result && typeof parsed.result === 'string') {
          // 尝试从结果中提取文件路径
          const pathMatch = parsed.result.match(/([A-Za-z]:[\\/][^"\n]*|\/[^"\n]*)/)
          if (pathMatch) {
            return pathMatch[0]
          }
        }
      }
    } catch {
      continue
    }
  }
  
  return ''
}

// 初始化工作流运行器
const initWorkflowRunner = () => {
  const workflowData: WorkflowData = {
    items: items.value,
    links: links.value
  }
  
  runner.value = new WorkflowRunner(workflowData, store, {
    onNodeStart: (nodeId, nodeName, nodeType) => {
      console.log(`节点开始执行: ${nodeName} (${nodeType})`)
    },
    onNodeComplete: (nodeId, nodeName, nodeType, status, result) => {
      console.log(`节点执行完成: ${nodeName} - ${status}`)
    },
    onMcpStatusChange: (nodeId, connected, tools) => {
      console.log(`MCP节点 ${nodeId} 连接状态: ${connected}，工具数: ${tools?.length || 0}`)
      const node = items.value.find(item => item.id === nodeId)
      if (node && node.type === 'mcp') {
        node.mcpConnected = connected
        if (tools) {
          node.mcpTools = tools
        }
      }
    },
    onProgress: (completed, total, currentNode) => {
      executionProgress.value = Math.round((completed / total) * 100)
    },
    onComplete: (success, finalResult) => {
      console.log(`工作流执行${success ? '成功' : '失败'}`)
      executionProgress.value = 0
    },
    onNodeStatusUpdate: (nodeId, status, result) => {
      const node = items.value.find(item => item.id === nodeId)
      if (node) {
        node.status = status
        if (result !== undefined) {
          node.result = result
        }
      }
    },
    onSaveWorkflow: () => {
      saveToLocalStorage()
    },
    onLog: (message, level) => {
      console.log(`[Workflow ${level}] ${message}`)
    }
  })
}

// 更新SVG尺寸
const updateSVGSize = (): void => {
  if (!flowsContainer.value) return
  
  const containerRect = flowsContainer.value.getBoundingClientRect()
  svgWidth.value = containerRect.width
  svgHeight.value = containerRect.height
}

// 初始化D3缩放
const initCanvas = (): void => {
  if (!svgRef.value) return

  svg = d3.select(svgRef.value)
  
  zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([minScale, maxScale])
    .on('zoom', (event) => {
      const transform = event.transform
      viewTransform.value = { x: transform.x, y: transform.y, k: transform.k }
      scale.value = transform.k
    })
  
  loadViewState()
  
  svg.call(zoom)
  
  window.addEventListener('resize', updateSVGSize)
}

// 保存视图状态到本地存储
const saveViewState = (): void => {
  try {
    const viewState = {
      transform: viewTransform.value,
      scale: scale.value,
      lastSaved: new Date().toISOString()
    }
    
    localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(viewState))
  } catch (error) {
    console.error('保存视图状态失败:', error)
  }
}

// 从本地存储加载视图状态
const loadViewState = (): void => {
  try {
    const savedView = localStorage.getItem(VIEW_STORAGE_KEY)
    if (savedView) {
      const viewState = JSON.parse(savedView)
      
      if (viewState.transform) {
        viewTransform.value = viewState.transform
        scale.value = viewState.scale || 1
        
        const transform = d3.zoomIdentity
          .translate(viewTransform.value.x, viewTransform.value.y)
          .scale(viewTransform.value.k)
        
        svg.call(zoom.transform, transform)
      }
    }
  } catch (error) {
    console.error('加载视图状态失败:', error)
  }
}

// 修正 getLinkPath 函数以支持文件节点端口连接和开始节点
const getLinkPath = (link: Link): string => {
  const source = items.value.find(n => n.id === link.source)
  const target = items.value.find(n => n.id === link.target)
  
  if (!source || !target) return ''
  
  // 判断节点类型
  const isDecisionNode = source.type === 'decision'
  const isFileNode = source.type === 'local' && source.fileMode === 'template'
  const isStartNode = source.type === 'start'
  
  // 计算起始位置
  let startX = 0
  let startY = 0
  let endX = target.x + target.width / 2
  let endY = target.y
  
  if (isStartNode && (link.sourcePort === 'prompt' || link.sourcePort === 'file')) {
    // 开始节点特殊处理
    if (link.sourcePort === 'prompt') {
      startX = source.x + source.width * 0.3
      startY = source.y + source.height
    } else if (link.sourcePort === 'file') {
      startX = source.x + source.width * 0.7
      startY = source.y + source.height
    }
  } else if (isDecisionNode) {
    const branchCount = source.decisionBranches?.length || 0
    const totalConnectors = branchCount + 1
    const totalWidth = source.width
    const spacing = totalWidth / (totalConnectors + 1)
    
    if (link.branch) {
      // 分支连接：从对应的分支连接点出发
      const branchIndex = source.decisionBranches?.findIndex(b => b.id === link.branch) || 0
      startX = source.x + (branchIndex + 2) * spacing
      startY = source.y + source.height
    } else {
      // 默认连接：从默认连接点出发
      startX = source.x + spacing
      startY = source.y + source.height
    }
  } else if (isFileNode && link.sourcePort) {
    // 文件节点端口连接
    const ports = getFileNodeOutputPorts(source)
    const defaultPort = getFileNodeDefaultPortEnabled(source) ? 1 : 0
    const totalPorts = ports.length + defaultPort
    const totalWidth = source.width
    const spacing = totalWidth / (totalPorts + 1)
    
    if (link.sourcePort === 'default') {
      // 默认端口位置
      startX = source.x + spacing
      startY = source.y + source.height
    } else {
      // 模板端口位置
      const portIndex = ports.findIndex(p => p.id === link.sourcePort)
      if (portIndex !== -1) {
        startX = source.x + (portIndex + (defaultPort ? 2 : 1)) * spacing
        startY = source.y + source.height
      } else {
        // 回退到中心位置
        startX = source.x + source.width / 2
        startY = source.y + source.height
      }
    }
  } else {
    // 普通节点连接
    startX = source.x + source.width / 2
    startY = source.y + source.height
  }
  
  // 使用平滑的贝塞尔曲线
  const controlOffset = Math.abs(endY - startY) / 2
  
  return `M ${startX},${startY} 
          C ${startX},${startY + controlOffset}
            ${endX},${endY - controlOffset}
            ${endX},${endY}`
}

// 修正 getLinkMidpoint 函数
const getLinkMidpoint = (link: Link): { x: number, y: number } => {
  const source = items.value.find(n => n.id === link.source)
  const target = items.value.find(n => n.id === link.target)
  
  if (!source || !target) return { x: 0, y: 0 }
  
  // 判断节点类型
  const isDecisionNode = source.type === 'decision'
  const isFileNode = source.type === 'local' && source.fileMode === 'template'
  const isStartNode = source.type === 'start'
  
  if (isStartNode && (link.sourcePort === 'prompt' || link.sourcePort === 'file')) {
    // 开始节点特殊处理
    let startX, startY
    if (link.sourcePort === 'prompt') {
      startX = source.x + source.width * 0.3
      startY = source.y + source.height
    } else if (link.sourcePort === 'file') {
      startX = source.x + source.width * 0.7
      startY = source.y + source.height
    } else {
      startX = source.x + source.width / 2
      startY = source.y + source.height
    }
    
    // 目标位置
    const endX = target.x + target.width / 2
    const endY = target.y
    
    // 贝塞尔曲线参数
    const t = 0.5
    const verticalDistance = endY - startY
    const controlX1 = startX
    const controlY1 = startY + Math.abs(verticalDistance) / 3
    const controlX2 = endX
    const controlY2 = endY - Math.abs(verticalDistance) / 3
    
    // 计算三次贝塞尔曲线上的点
    const x = Math.pow(1 - t, 3) * startX + 
              3 * Math.pow(1 - t, 2) * t * controlX1 + 
              3 * (1 - t) * Math.pow(t, 2) * controlX2 + 
              Math.pow(t, 3) * endX
    
    const y = Math.pow(1 - t, 3) * startY + 
              3 * Math.pow(1 - t, 2) * t * controlY1 + 
              3 * (1 - t) * Math.pow(t, 2) * controlY2 + 
              Math.pow(t, 3) * endY
    
    return { x, y }
  } else if (isDecisionNode) {
    const branchCount = source.decisionBranches?.length || 0
    const totalConnectors = branchCount + 1
    const totalWidth = source.width
    const spacing = totalWidth / (totalConnectors + 1)
    
    if (link.branch) {
      // 分支连接的中点计算
      const branchIndex = source.decisionBranches?.findIndex(b => b.id === link.branch) || 0
      const startX = source.x + (branchIndex + 2) * spacing
      const startY = source.y + source.height
      
      // 目标位置
      const endX = target.x + target.width / 2
      const endY = target.y
      
      // 贝塞尔曲线参数
      const t = 0.5
      const verticalDistance = endY - startY
      const controlX1 = startX
      const controlY1 = startY + Math.abs(verticalDistance) / 3
      const controlX2 = endX
      const controlY2 = endY - Math.abs(verticalDistance) / 3
      
      // 计算三次贝塞尔曲线上的点
      const x = Math.pow(1 - t, 3) * startX + 
                3 * Math.pow(1 - t, 2) * t * controlX1 + 
                3 * (1 - t) * Math.pow(t, 2) * controlX2 + 
                Math.pow(t, 3) * endX
      
      const y = Math.pow(1 - t, 3) * startY + 
                3 * Math.pow(1 - t, 2) * t * controlY1 + 
                3 * (1 - t) * Math.pow(t, 2) * controlY2 + 
                Math.pow(t, 3) * endY
      
      return { x, y }
    } else {
      // 默认连接的中点计算
      const startX = source.x + spacing
      const startY = source.y + source.height
      const endX = target.x + target.width / 2
      const endY = target.y
      
      const t = 0.5
      const verticalDistance = endY - startY
      const controlX1 = startX
      const controlY1 = startY + Math.abs(verticalDistance) / 3
      const controlX2 = endX
      const controlY2 = endY - Math.abs(verticalDistance) / 3
      
      const x = Math.pow(1 - t, 3) * startX + 
                3 * Math.pow(1 - t, 2) * t * controlX1 + 
                3 * (1 - t) * Math.pow(t, 2) * controlX2 + 
                Math.pow(t, 3) * endX
      
      const y = Math.pow(1 - t, 3) * startY + 
                3 * Math.pow(1 - t, 2) * t * controlY1 + 
                3 * (1 - t) * Math.pow(t, 2) * controlY2 + 
                Math.pow(t, 3) * endY
      
      return { x, y }
    }
  } else if (isFileNode) {
    // 文件节点端口连接的中点计算
    const ports = getFileNodeOutputPorts(source)
    const defaultPort = getFileNodeDefaultPortEnabled(source) ? 1 : 0
    const totalPorts = ports.length + defaultPort
    const totalWidth = source.width
    const spacing = totalWidth / (totalPorts + 1)
    
    let startX, startY
    
    if (link.sourcePort === 'default') {
      // 默认端口位置
      startX = source.x + spacing
      startY = source.y + source.height
    } else {
      // 模板端口位置
      const portIndex = ports.findIndex(p => p.id === link.sourcePort)
      if (portIndex !== -1) {
        startX = source.x + (portIndex + (defaultPort ? 2 : 1)) * spacing
        startY = source.y + source.height
      } else {
        // 回退到中心位置
        startX = source.x + source.width / 2
        startY = source.y + source.height
      }
    }
    
    // 目标位置
    const endX = target.x + target.width / 2
    const endY = target.y
    
    // 贝塞尔曲线参数
    const t = 0.5
    const verticalDistance = endY - startY
    const controlX1 = startX
    const controlY1 = startY + Math.abs(verticalDistance) / 3
    const controlX2 = endX
    const controlY2 = endY - Math.abs(verticalDistance) / 3
    
    const x = Math.pow(1 - t, 3) * startX + 
              3 * Math.pow(1 - t, 2) * t * controlX1 + 
              3 * (1 - t) * Math.pow(t, 2) * controlX2 + 
              Math.pow(t, 3) * endX
    
    const y = Math.pow(1 - t, 3) * startY + 
              3 * Math.pow(1 - t, 2) * t * controlY1 + 
              3 * (1 - t) * Math.pow(t, 2) * controlY2 + 
              Math.pow(t, 3) * endY
    
    return { x, y }
  } else {
    // 普通连接的中点计算
    const startX = source.x + source.width / 2
    const startY = source.y + source.height
    const endX = target.x + target.width / 2
    const endY = target.y
    
    const t = 0.5
    const verticalDistance = endY - startY
    const controlX1 = startX
    const controlY1 = startY + Math.abs(verticalDistance) / 3
    const controlX2 = endX
    const controlY2 = endY - Math.abs(verticalDistance) / 3
    
    const x = Math.pow(1 - t, 3) * startX + 
              3 * Math.pow(1 - t, 2) * t * controlX1 + 
              3 * (1 - t) * Math.pow(t, 2) * controlX2 + 
              Math.pow(t, 3) * endX
    
    const y = Math.pow(1 - t, 3) * startY + 
              3 * Math.pow(1 - t, 2) * t * controlY1 + 
              3 * (1 - t) * Math.pow(t, 2) * controlY2 + 
              Math.pow(t, 3) * endY
    
    return { x, y }
  }
}

// 修正 getLinkAngle 函数
const getLinkAngle = (link: Link): number => {
  const source = items.value.find(n => n.id === link.source)
  const target = items.value.find(n => n.id === link.target)
  
  if (!source || !target) return 0
  
  // 判断节点类型
  const isDecisionNode = source.type === 'decision'
  const isFileNode = source.type === 'local' && source.fileMode === 'template'
  const isStartNode = source.type === 'start'
  
  if (isStartNode && (link.sourcePort === 'prompt' || link.sourcePort === 'file')) {
    // 开始节点特殊处理
    let startX, startY
    if (link.sourcePort === 'prompt') {
      startX = source.x + source.width * 0.3
      startY = source.y + source.height
    } else if (link.sourcePort === 'file') {
      startX = source.x + source.width * 0.7
      startY = source.y + source.height
    } else {
      startX = source.x + source.width / 2
      startY = source.y + source.height
    }
    
    // 目标位置
    const endX = target.x + target.width / 2
    const endY = target.y
    
    // 贝塞尔曲线参数
    const t = 0.5
    const verticalDistance = endY - startY
    const controlX1 = startX
    const controlY1 = startY + Math.abs(verticalDistance) / 3
    const controlX2 = endX
    const controlY2 = endY - Math.abs(verticalDistance) / 3
    
    // 计算曲线在t点的切线方向
    const dx = 3 * Math.pow(1 - t, 2) * (controlX1 - startX) + 
               6 * (1 - t) * t * (controlX2 - controlX1) + 
               3 * Math.pow(t, 2) * (endX - controlX2)
    
    const dy = 3 * Math.pow(1 - t, 2) * (controlY1 - startY) + 
               6 * (1 - t) * t * (controlY2 - controlY1) + 
               3 * Math.pow(t, 2) * (endY - controlY2)
    
    const angle = Math.atan2(dy, dx) * (180 / Math.PI)
    return angle
  } else if (isDecisionNode) {
    const branchCount = source.decisionBranches?.length || 0
    const totalConnectors = branchCount + 1
    const totalWidth = source.width
    const spacing = totalWidth / (totalConnectors + 1)
    
    if (link.branch) {
      // 分支连接的角度计算
      const branchIndex = source.decisionBranches?.findIndex(b => b.id === link.branch) || 0
      const startX = source.x + (branchIndex + 2) * spacing
      const startY = source.y + source.height
      
      // 目标位置
      const endX = target.x + target.width / 2
      const endY = target.y
      
      // 贝塞尔曲线参数
      const t = 0.5
      const verticalDistance = endY - startY
      const controlX1 = startX
      const controlY1 = startY + Math.abs(verticalDistance) / 3
      const controlX2 = endX
      const controlY2 = endY - Math.abs(verticalDistance) / 3
      
      // 计算曲线在t点的切线方向
      const dx = 3 * Math.pow(1 - t, 2) * (controlX1 - startX) + 
                 6 * (1 - t) * t * (controlX2 - controlX1) + 
                 3 * Math.pow(t, 2) * (endX - controlX2)
      
      const dy = 3 * Math.pow(1 - t, 2) * (controlY1 - startY) + 
                 6 * (1 - t) * t * (controlY2 - controlY1) + 
                 3 * Math.pow(t, 2) * (endY - controlY2)
      
      const angle = Math.atan2(dy, dx) * (180 / Math.PI)
      return angle
    } else {
      // 默认连接的角度计算
      const startX = source.x + spacing
      const startY = source.y + source.height
      const endX = target.x + target.width / 2
      const endY = target.y
      
      const t = 0.5
      const verticalDistance = endY - startY
      const controlX1 = startX
      const controlY1 = startY + Math.abs(verticalDistance) / 3
      const controlX2 = endX
      const controlY2 = endY - Math.abs(verticalDistance) / 3
      
      const dx = 3 * Math.pow(1 - t, 2) * (controlX1 - startX) + 
                 6 * (1 - t) * t * (controlX2 - controlX1) + 
                 3 * Math.pow(t, 2) * (endX - controlX2)
      
      const dy = 3 * Math.pow(1 - t, 2) * (controlY1 - startY) + 
                 6 * (1 - t) * t * (controlY2 - controlY1) + 
                 3 * Math.pow(t, 2) * (endY - controlY2)
      
      const angle = Math.atan2(dy, dx) * (180 / Math.PI)
      return angle
    }
  } else if (isFileNode) {
    // 文件节点端口连接的角度计算
    const ports = getFileNodeOutputPorts(source)
    const defaultPort = getFileNodeDefaultPortEnabled(source) ? 1 : 0
    const totalPorts = ports.length + defaultPort
    const totalWidth = source.width
    const spacing = totalWidth / (totalPorts + 1)
    
    let startX, startY
    
    if (link.sourcePort === 'default') {
      // 默认端口位置
      startX = source.x + spacing
      startY = source.y + source.height
    } else {
      // 模板端口位置
      const portIndex = ports.findIndex(p => p.id === link.sourcePort)
      if (portIndex !== -1) {
        startX = source.x + (portIndex + (defaultPort ? 2 : 1)) * spacing
        startY = source.y + source.height
      } else {
        // 回退到中心位置
        startX = source.x + source.width / 2
        startY = source.y + source.height
      }
    }
    
    // 目标位置
    const endX = target.x + target.width / 2
    const endY = target.y
    
    // 贝塞尔曲线参数
    const t = 0.5
    const verticalDistance = endY - startY
    const controlX1 = startX
    const controlY1 = startY + Math.abs(verticalDistance) / 3
    const controlX2 = endX
    const controlY2 = endY - Math.abs(verticalDistance) / 3
    
    const dx = 3 * Math.pow(1 - t, 2) * (controlX1 - startX) + 
               6 * (1 - t) * t * (controlX2 - controlX1) + 
               3 * Math.pow(t, 2) * (endX - controlX2)
    
    const dy = 3 * Math.pow(1 - t, 2) * (controlY1 - startY) + 
               6 * (1 - t) * t * (controlY2 - controlY1) + 
               3 * Math.pow(t, 2) * (endY - controlY2)
    
    const angle = Math.atan2(dy, dx) * (180 / Math.PI)
    return angle
  } else {
    // 普通连接的角度计算
    const startX = source.x + source.width / 2
    const startY = source.y + source.height
    const endX = target.x + target.width / 2
    const endY = target.y
    
    const t = 0.5
    const verticalDistance = endY - startY
    const controlX1 = startX
    const controlY1 = startY + Math.abs(verticalDistance) / 3
    const controlX2 = endX
    const controlY2 = endY - Math.abs(verticalDistance) / 3
    
    const dx = 3 * Math.pow(1 - t, 2) * (controlX1 - startX) + 
               6 * (1 - t) * t * (controlX2 - controlX1) + 
               3 * Math.pow(t, 2) * (endX - controlX2)
    
    const dy = 3 * Math.pow(1 - t, 2) * (controlY1 - startY) + 
               6 * (1 - t) * t * (controlY2 - controlY1) + 
               3 * Math.pow(t, 2) * (endY - controlY2)
    
    const angle = Math.atan2(dy, dx) * (180 / Math.PI)
    return angle
  }
}

// 节点拖拽开始
const startNodeDrag = (nodeId: number, event: MouseEvent): void => {
  if (operationMode.value === 'linking') {
    event.stopPropagation()
    return
  }
  
  const node = items.value.find(item => item.id === nodeId)
  if (!node) return
  
  const startX = event.clientX
  const startY = event.clientY
  const startNodeX = node.x
  const startNodeY = node.y
  isDragging = false
  
  selectedNodeId.value = nodeId
  propertiesShow.value = true
  
  event.stopPropagation()
  event.preventDefault()
  
  const handleDragMove = (e: MouseEvent): void => {
    const deltaX = e.clientX - startX
    const deltaY = e.clientY - startY
    
    if (!isDragging && (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD)) {
      isDragging = true
    }
    
    if (isDragging) {
      const newX = startNodeX + deltaX / viewTransform.value.k
      const newY = startNodeY + deltaY / viewTransform.value.k
      
      node.x = newX
      node.y = newY
    }
  }
  
  const handleDragEnd = (e: MouseEvent): void => {
    if (isDragging) {
      saveToLocalStorage()
    }
    
    isDragging = false
    window.removeEventListener('mousemove', handleDragMove)
    window.removeEventListener('mouseup', handleDragEnd)
  }
  
  window.addEventListener('mousemove', handleDragMove)
  window.addEventListener('mouseup', handleDragEnd)
}

// 画布点击事件处理
const handleCanvasClick = (event: MouseEvent): void => {
  const target = event.target as Element
  
  const isConnector = target.classList?.contains('connector') || 
                     target.closest('.connector')
  const isNode = target.classList?.contains('node') || 
                target.closest('.node')
  const isLink = target.classList?.contains('link') || 
                target.closest('.link') ||
                target.classList?.contains('link-arrow') ||
                target.closest('.link-arrow')
  
  const isSVGElement = target.tagName === 'path' || 
                      target.tagName === 'circle' || 
                      target.tagName === 'rect' || 
                      target.tagName === 'text' || 
                      target.tagName === 'g' ||
                      target.tagName === 'foreignObject'
  const isTrueBlank = (target === svgRef.value || 
                      target.tagName === 'svg' ||
                      (target.classList && target.classList.contains('canvas')) ||
                      (flowsContainer.value && target === flowsContainer.value)) &&
                     !isConnector && !isNode && !isLink
  
  if (isTrueBlank) {
    // 点击了真正的空白区域
    selectedNodeId.value = null
    propertiesShow.value = false
    operationMode.value = 'normal'
    linkingSourceId.value = null
    linkingSourceConnector.value = null
    linkingSourceBranchId.value = null
    linkingSourcePortId.value = null
    linkingSourceStartPort.value = null
  }
}

// 修改 handleConnectorClick 函数
const handleConnectorClick = (nodeId: number, position: 'top' | 'bottom', event: MouseEvent): void => {
  event.stopPropagation()
  event.preventDefault()
  
  const node = items.value.find(item => item.id === nodeId)
  if (!node) return
  
  selectedNodeId.value = nodeId
  propertiesShow.value = true
  
  // 判断点击的是目标节点（顶部连接点）
  if (position === 'top') {
    if (operationMode.value === 'linking' && linkingSourceId.value !== null) {
      // 完成连接
      completeConnection(nodeId, position)
    } else {
      // 点击顶部连接点，提示只能作为目标
      console.log('顶部连接点只能接收连接')
    }
    return
  }
  
  // 处理底部连接点（作为源）
  if (operationMode.value === 'linking') {
    if (linkingSourceId.value === null) {
      // 开始新的连接
      linkingSourceId.value = nodeId
      linkingSourceConnector.value = position
      linkingSourceBranchId.value = null
      linkingSourcePortId.value = null
      linkingSourceStartPort.value = null
    } else if (linkingSourceId.value !== nodeId) {
      // 完成连接
      completeConnection(nodeId, position)
    } else {
      // 点击了同一个节点，取消连接
      resetConnectionState()
    }
  } else {
    // 进入连接模式
    operationMode.value = 'linking'
    linkingSourceId.value = nodeId
    linkingSourceConnector.value = position
    linkingSourceBranchId.value = null
    linkingSourcePortId.value = null
    linkingSourceStartPort.value = null
  }
}

// 完成连接 - 修复连接完成逻辑
const completeConnection = (targetNodeId: number, targetPosition: 'top' | 'bottom'): void => {
  if (linkingSourceId.value === null) {
    console.error('没有有效的源节点')
    return
  }
  
  const sourceNode = items.value.find(n => n.id === linkingSourceId.value)
  const targetNode = items.value.find(n => n.id === targetNodeId)
  
  if (!sourceNode || !targetNode) {
    console.error('找不到源节点或目标节点')
    resetConnectionState()
    return
  }
  
  // 构建连接数据
  const linkData: any = {
    source: linkingSourceId.value!,
    target: targetNodeId
  }
  
  // 添加分支信息（如果是决策节点）
  if (sourceNode.type === 'decision' && linkingSourceBranchId.value !== null) {
    linkData.branch = linkingSourceBranchId.value
  }
  
  // 添加端口信息（如果是文件节点）
  if (sourceNode.type === 'local' && sourceNode.fileMode === 'template' && linkingSourcePortId.value !== null) {
    linkData.sourcePort = linkingSourcePortId.value
  }
  
  // 添加端口信息（如果是开始节点）
  if (sourceNode.type === 'start' && linkingSourceStartPort.value !== null) {
    linkData.sourcePort = linkingSourceStartPort.value
  }
  
  // 检查连接是否已经存在
  const linkExists = links.value.some(link => {
    const sameSourceTarget = link.source === linkData.source && link.target === linkData.target
    
    // 如果有分支信息，需要比较分支
    if (link.branch && linkData.branch) {
      return sameSourceTarget && link.branch === linkData.branch
    } else if (link.sourcePort && linkData.sourcePort) {
      // 如果有端口信息，需要比较端口
      return sameSourceTarget && link.sourcePort === linkData.sourcePort
    } else if (!link.branch && !linkData.branch && !link.sourcePort && !linkData.sourcePort) {
      // 都没有额外信息
      return sameSourceTarget
    }
    return false
  })
  
  if (!linkExists) {
    links.value.push(linkData)
    console.log('添加连接:', linkData)
    saveToLocalStorage()
  } else {
    console.log('连接已存在:', linkData)
  }
  
  // 重置连接状态
  resetConnectionState()
}

// 修复端口连接数统计
const getPortConnectionCount = (nodeId: number, portId: string): number => {
  return links.value.filter(link => 
    link.source === nodeId && link.sourcePort === portId
  ).length
}

// 重置连接状态
const resetConnectionState = (): void => {
  linkingSourceId.value = null
  linkingSourceConnector.value = null
  linkingSourceBranchId.value = null
  linkingSourcePortId.value = null
  linkingSourceStartPort.value = null
  operationMode.value = 'normal'
}

// 修改决策分支连接点点击处理
const handleDecisionBranchConnectorClick = (nodeId: number, branchId: string, event: MouseEvent): void => {
  event.stopPropagation()
  event.preventDefault()
  
  selectedNodeId.value = nodeId
  propertiesShow.value = true
  
  if (operationMode.value === 'linking') {
    if (linkingSourceId.value === null) {
      // 从决策节点分支开始连接
      linkingSourceId.value = nodeId
      linkingSourceBranchId.value = branchId
      linkingSourceConnector.value = null // 清除普通连接点状态
      linkingSourcePortId.value = null // 清除端口状态
      linkingSourceStartPort.value = null // 清除开始节点端口状态
    } else if (linkingSourceId.value !== nodeId) {
      // 不能连接到决策分支
      alert('决策节点分支只能作为连接的起点，不能作为终点。')
      resetConnectionState()
    } else {
      // 切换分支
      linkingSourceBranchId.value = branchId
      linkingSourcePortId.value = null // 清除端口状态
      linkingSourceStartPort.value = null // 清除开始节点端口状态
    }
  } else {
    // 进入连接模式
    operationMode.value = 'linking'
    linkingSourceId.value = nodeId
    linkingSourceBranchId.value = branchId
    linkingSourceConnector.value = null // 确保普通连接点状态清除
    linkingSourcePortId.value = null // 清除端口状态
    linkingSourceStartPort.value = null // 清除开始节点端口状态
  }
}

// 添加辅助函数
const getLinkKey = (link: Link): string => {
  if (link.branch) {
    return `${link.source}-${link.target}-${link.branch}`
  } else if (link.sourcePort) {
    return `${link.source}-${link.target}-${link.sourcePort}`
  }
  return `${link.source}-${link.target}`
}

// 双击连接线删除
const handleLinkDoubleClick = (link: Link, event: MouseEvent): void => {
  event.stopPropagation()
  event.preventDefault()
  
  const index = links.value.findIndex(l => l.source === link.source && l.target === link.target)
  if (index !== -1) {
    links.value.splice(index, 1)
    saveToLocalStorage()
  }
}

// 从本地存储加载工作流数据
const loadFromLocalStorage = (): void => {
  try {
    const savedData = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (savedData) {
      const data = JSON.parse(savedData)
      
      if (data.items && Array.isArray(data.items)) {
        items.value = data.items
        
        items.value.forEach(item => {
          item.status = 'idle'
          
          if (!item.width || !item.height) {
            const template = nodeTemplates[item.type]
            if (template) {
              item.width = item.width || template.width
              item.height = item.height || template.height
            }
          }
          
          if (item.type === 'reasoning' && !item.model_type) {
            item.model_type = store.AIconfig?.llm?.type || 'ollama'
          }
          
          if (item.type === 'knowledge') {
            if (!item.kbOptions) {
              item.kbOptions = { ...defaultKbOptions }
            }
            if (!item.kbValidation) {
              item.kbValidation = {
                valid: false,
                issues: item.kbPath ? [] : [t('kb_file_required')]
              }
            }
          }
          
          if (item.type === 'structured') {
            if (!item.structuredData) {
              item.structuredData = []
            }
            if (!item.structuredColumns) {
              item.structuredColumns = [
                { id: 0, name: t('key_column'), type: 'text', required: true },
                { id: 1, name: t('value_column'), type: 'text', required: true }
              ]
            }
            if (!item.structuredConfig) {
              item.structuredConfig = { ...defaultStructuredConfig }
            }
          }
          
          if (item.type === 'decision') {
            if (!item.decisionMode) {
              item.decisionMode = 'llm'
            }
            if (!item.decisionConfig) {
              item.decisionConfig = { ...defaultDecisionConfig }
            }
            if (!item.decisionBranches) {
              item.decisionBranches = item.decisionConfig.branches || defaultDecisionConfig.branches
            }
            if (!item.decisionPrompt && item.decisionMode === 'llm') {
              item.decisionPrompt = defaultDecisionConfig.prompt || ''
            }
            if (!item.decisionRules && item.decisionMode === 'rule') {
              item.decisionRules = defaultDecisionConfig.rules || ''
            }
          }
          
          if (item.type === 'mcp') {
            if (!item.mcpConfig) {
              item.mcpConfig = { ...defaultMCPConfig }
            }
            // 确保toolArguments是对象
            if (!item.mcpConfig.toolArguments || typeof item.mcpConfig.toolArguments !== 'object') {
              item.mcpConfig.toolArguments = {}
            }
          }
          
          if (item.type === 'local') {
            // 确保文件处理模式相关字段存在
            if (!item.fileMode) {
              item.fileMode = 'full'
            }
            if (!item.fileTemplates) {
              item.fileTemplates = [...defaultFileTemplates]
            }
            // 确保输出端口配置存在
            if (item.fileMode === 'template' && !item.outputPorts) {
              item.outputPorts = {
                default: true,
                ports: getFileNodeOutputPorts(item).map(port => ({
                  id: port.id,
                  name: port.name,
                  description: port.description,
                  enabled: true
                }))
              }
            }
          }
          
          if (item.type === 'start') {
            // 确保开始节点有正确的配置
            if (!item.startPorts) {
              item.startPorts = {
                prompt: true,
                file: true
              }
            }
          }
        })
      }
      
      if (data.links && Array.isArray(data.links)) {
        links.value = data.links
      }
      
      // 初始化工作流运行器
      initWorkflowRunner()
    } else {
      console.log('没有找到本地存储的工作流数据')
    }
  } catch (error) {
    console.error('加载本地存储数据失败:', error)
    items.value = []
    links.value = []
  }
}

// 保存工作流数据到本地存储
const saveToLocalStorage = (): void => {
  try {
    const data = {
      items: items.value,
      links: links.value,
      lastSaved: new Date().toISOString()
    }
    
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data))
  } catch (error) {
    console.error('保存到本地存储失败:', error)
  }
}

// 添加节点 - 添加开始节点特殊处理
const addNode = (type: NodeType, event?: DragEvent | MouseEvent): void => {
  if (type === 'start' && items.value.some(item => item.type === 'start')) {
    alert(t('multiple_start_nodes'))
    return
  }
  
  if (type === 'end' && items.value.some(item => item.type === 'end')) {
    alert(t('multiple_end_nodes'))
    return
  }
  
  let x = 200
  let y = 200
  
  if (flowsContainer.value && event) {
    const rect = flowsContainer.value.getBoundingClientRect()
    
    // 获取鼠标相对于画布容器的坐标
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top
    
    // 转换为画布坐标系（考虑缩放和偏移）
    x = (mouseX - viewTransform.value.x) / viewTransform.value.k
    y = (mouseY - viewTransform.value.y) / viewTransform.value.k  // 修正：移除多余的 rect.top
    
    // 让节点中心对准鼠标位置
    x -= nodeTemplates[type].width / 2
    y -= nodeTemplates[type].height / 2
  } else if (flowsContainer.value) {
    // 如果没有事件，则放置在画布中心
    const rect = flowsContainer.value.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    
    x = (centerX - viewTransform.value.x) / viewTransform.value.k - nodeTemplates[type].width / 2
    y = (centerY - viewTransform.value.y) / viewTransform.value.k - nodeTemplates[type].height / 2
  }
  
  const newNode: NodeData = {
    ...nodeTemplates[type],
    id: items.value.length > 0 ? Math.max(...items.value.map(n => n.id)) + 1 : 0,
    x: x, 
    y: y
  }
  
  if (type === 'reasoning' && !newNode.model_type) {
    newNode.model_type = store.AIconfig?.llm?.type || 'ollama'
  }
  
  if (type === 'decision') {
    newNode.decisionMode = 'llm'
    newNode.decisionConfig = { ...defaultDecisionConfig }
    newNode.decisionBranches = [...defaultDecisionConfig.branches]
    newNode.decisionPrompt = defaultDecisionConfig.prompt || ''
    newNode.decisionRules = defaultDecisionConfig.rules || ''
    newNode.model_type = 'ollama'
  }
  
  if (type === 'knowledge') {
    newNode.kbOptions = { ...defaultKbOptions }
    newNode.kbQuery = t('input_search') + '...'
    newNode.kbValidation = {
      valid: false,
      issues: [t('kb_file_required')]
    }
  }
  
  if (type === 'structured') {
    newNode.structuredData = []
    newNode.structuredColumns = [
      { id: 0, name: t('key_column'), type: 'text', required: true },
      { id: 1, name: t('value_column'), type: 'text', required: true }
    ]
    newNode.structuredConfig = { ...defaultStructuredConfig }
  }
  
  if (type === 'mcp') {
    newNode.mcpConfig = { ...defaultMCPConfig }
    newNode.mcpConnected = false
    newNode.mcpTools = []
    newNode.result = t('mcp_disconnected')
  }
  
  if (type === 'local') {
    // 确保文件处理模式相关字段存在
    newNode.fileMode = 'full'
    newNode.fileTemplates = [...defaultFileTemplates]
  }
  
  if (type === 'start') {
    // 确保开始节点有正确的配置
    newNode.startPorts = {
      prompt: true,
      file: true
    }
  }
  
  items.value.push(newNode)
  
  // 更新工作流运行器的数据
  if (runner.value) {
    runner.value.setWorkflowData({
      items: items.value,
      links: links.value
    })
  }
  
  saveToLocalStorage()
}

// 删除节点
const deleteNode = (id: number): void => {
  links.value = links.value.filter(link => 
    link.source !== id && link.target !== id
  )
  
  const index = items.value.findIndex(item => item.id === id)
  if (index > -1) {
    items.value.splice(index, 1)
  }
  
  if (selectedNodeId.value === id) {
    selectedNodeId.value = null
    propertiesShow.value = false
  }
  
  // 更新工作流运行器的数据
  if (runner.value) {
    runner.value.setWorkflowData({
      items: items.value,
      links: links.value
    })
  }
  
  saveToLocalStorage()
}

// 获取所有上游节点的查询文本（用于知识库节点）
const getAllUpstreamQueryText = (nodeId: number): string => {
  const sourceLinks = links.value.filter(link => link.target === nodeId)
  
  if (sourceLinks.length === 0) {
    return ''
  }
  
  const queryParts: string[] = []
  
  for (const link of sourceLinks) {
    const sourceNode = items.value.find(n => n.id === link.source)
    
    if (!sourceNode || !sourceNode.result) {
      continue
    }
    
    try {
      const parsed = JSON.parse(sourceNode.result)
      if (parsed && typeof parsed === 'object') {
        if (parsed.result !== undefined) {
          const result = parsed.result
          if (typeof result === 'string') {
            queryParts.push(result)
          } else {
            queryParts.push(JSON.stringify(result))
          }
        } else if (parsed.content !== undefined) {
          const content = parsed.content
          if (typeof content === 'string') {
            queryParts.push(content)
          } else {
            queryParts.push(JSON.stringify(content))
          }
        } else {
          queryParts.push(JSON.stringify(parsed))
        }
      } else {
        queryParts.push(sourceNode.result)
      }
    } catch {
      queryParts.push(sourceNode.result)
    }
  }
  
  return queryParts.join('\n\n')
}

// 验证知识库节点
const validateKnowledgeBaseNode = async (nodeId: number): Promise<void> => {
  const node = items.value.find(item => item.id === nodeId)
  if (!node || node.type !== 'knowledge') return
  
  if (!node.kbPath) {
    node.kbValidation = {
      valid: false,
      issues: [t('kb_file_required')]
    }
    return
  }
  
  try {
    const validationResult = await validateKnowledgeBase(node.kbPath, {
      ollamaHost: store.AIconfig?.llm?.ollama?.model_url || 'http://127.0.0.1:11434',
      checkModelAvailability: true
    })
    
    node.kbValidation = validationResult
    
    if (validationResult.valid && validationResult.availableModel) {
      if (!node.kbOptions) {
        node.kbOptions = { ...defaultKbOptions }
      }
      if (!node.kbOptions.embedModel) {
        node.kbOptions.embedModel = validationResult.availableModel
      }
    }
    
    console.log('知识库验证结果:', validationResult)
  } catch (error: any) {
    console.error('知识库验证失败:', error)
    node.kbValidation = {
      valid: false,
      issues: [`验证失败: ${error.message}`]
    }
  }
}

// 处理文件拖入
const handleFileDrop = async (event: DragEvent): Promise<void> => {
  event.preventDefault()
  const files = event.dataTransfer?.files
  
  if (files && files.length > 0) {
    const file = files[0]
    const fileName = file.name.toLowerCase()
    
    const isKnowledgeBaseFile = fileName.endsWith('.kb') || 
                               (fileName.endsWith('.json') && fileName.includes('knowledge'))
    
    if (!flowsContainer.value) return
    
    const rect = flowsContainer.value.getBoundingClientRect()
    const x = (event.clientX - rect.left - viewTransform.value.x) / viewTransform.value.k
    const y = (event.clientY - rect.top - viewTransform.value.y) / viewTransform.value.k
    
    if (isKnowledgeBaseFile) {
      try {
        const content = await window.ipcRenderer.invoke('readFile', file.path)
        
        const newNode: NodeData = {
          ...nodeTemplates.knowledge,
          id: items.value.length > 0 ? Math.max(...items.value.map(n => n.id)) + 1 : 0,
          name: file.name.replace(/\.[^/.]+$/, ''),
          kbPath: file.path,
          kbQuery: t('input_search') + '...',
          kbOptions: { ...defaultKbOptions },
          result: JSON.stringify({
            result: t('waiting_retrieval'),
            type: 'knowledge_retrieval',
            success: false,
            timestamp: new Date().toISOString()
          }),
          x: Math.max(0, x),
          y: Math.max(0, y),
          status: 'idle'
        }
        
        items.value.push(newNode)
        
        await validateKnowledgeBaseNode(newNode.id)
        
        // 更新工作流运行器的数据
        if (runner.value) {
          runner.value.setWorkflowData({
            items: items.value,
            links: links.value
          })
        }
        
        saveToLocalStorage()
        
        console.log('知识库文件拖入成功:', file.path)
        
      } catch (error) {
        console.error('读取知识库文件失败:', error)
        
        const newNode: NodeData = {
          ...nodeTemplates.knowledge,
          id: items.value.length > 0 ? Math.max(...items.value.map(n => n.id)) + 1 : 0,
          name: file.name + ' (' + t('kb_load_error') + ')',
          kbPath: file.path,
          kbOptions: { ...defaultKbOptions },
          result: `${t('kb_load_error')}: ${error}`,
          x: Math.max(0, x),
          y: Math.max(0, y),
          status: 'error',
          kbValidation: {
            valid: false,
            issues: [`加载失败: ${error}`]
          }
        }
        
        items.value.push(newNode)
        
        // 更新工作流运行器的数据
        if (runner.value) {
          runner.value.setWorkflowData({
            items: items.value,
            links: links.value
          })
        }
        
        saveToLocalStorage()
      }
    } else {
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
      
      if (fileExtension) {
        try {
          const content = await window.ipcRenderer.invoke('readFile', file.path)
          
          const newNode: NodeData = {
            ...nodeTemplates.local,
            id: items.value.length > 0 ? Math.max(...items.value.map(n => n.id)) + 1 : 0,
            name: file.name,
            model: fileExtension,
            prompt: file.path,
            result: JSON.stringify({
              result: content,
              filename: file.name,
              extension: fileExtension,
              timestamp: new Date().toISOString(),
              type: 'file'
            }),
            x: Math.max(0, x),
            y: Math.max(0, y),
            status: 'success',
            fileMode: 'full', // 默认完整文件模式
            fileTemplates: [...defaultFileTemplates], // 默认模板
            outputPorts: {
              default: true,
              ports: getFileNodeOutputPorts({
                type: 'local',
                fileMode: 'template',
                fileTemplates: [...defaultFileTemplates]
              } as NodeData).map(port => ({
                id: port.id,
                name: port.name,
                description: port.description,
                enabled: true
              }))
            }
          }
          
          items.value.push(newNode)
          
          // 更新工作流运行器的数据
          if (runner.value) {
            runner.value.setWorkflowData({
              items: items.value,
              links: links.value
            })
          }
          
          saveToLocalStorage()
        } catch (error) {
          console.error('读取文件失败:', error)
          
          const newNode: NodeData = {
            ...nodeTemplates.local,
            id: items.value.length > 0 ? Math.max(...items.value.map(n => n.id)) + 1 : 0,
            name: file.name + ' (' + t('read_error') + ')',
            model: fileExtension,
            prompt: file.path,
            result: `${t('file_read_error')}: ${error}`,
            x: Math.max(0, x),
            y: Math.max(0, y),
            status: 'error',
            fileMode: 'full',
            fileTemplates: [...defaultFileTemplates]
          }
          
          items.value.push(newNode)
          
          // 更新工作流运行器的数据
          if (runner.value) {
            runner.value.setWorkflowData({
              items: items.value,
              links: links.value
            })
          }
          
          saveToLocalStorage()
        }
      } else {
        const newNode: NodeData = {
          ...nodeTemplates.local,
          id: items.value.length > 0 ? Math.max(...items.value.map(n => n.id)) + 1 : 0,
          name: file.name,
          model: '',
          prompt: file.path,
          result: `${t('unknown_format')}: ${file.name}`,
          x: Math.max(0, x),
          y: Math.max(0, y),
          status: 'error',
          fileMode: 'full',
          fileTemplates: [...defaultFileTemplates]
        }
        
        items.value.push(newNode)
        
        // 更新工作流运行器的数据
        if (runner.value) {
          runner.value.setWorkflowData({
            items: items.value,
            links: links.value
          })
        }
        
        saveToLocalStorage()
      }
    }
    
    dragOverCanvas.value = false
  }
}

// 从节点结果中提取要显示的内容 - 添加本地节点结果处理
const getResultContent = (result: string): string => {
  if (!result) return ''
  
  try {
    const parsed = JSON.parse(result)
    
    if (parsed && typeof parsed === 'object') {
      if (parsed.type === 'local') {
        if (parsed.success) {
          let content = `# ${t('local_node')}\n\n`
          content += `**文件路径**: ${parsed.filePath}\n`
          content += `**文件名**: ${parsed.filename}\n`
          content += `**文件扩展名**: ${parsed.extension}\n`
          content += `**处理模式**: ${parsed.mode === 'full' ? t('full_file_mode') : t('template_mode')}\n`
          
          if (parsed.mode === 'full') {
            content += `\n## 文件内容:\n\n`
            // 限制显示长度，避免过长的文件内容导致界面卡顿
            const maxDisplayLength = 10000
            if (parsed.content && parsed.content.length > maxDisplayLength) {
              content += `${parsed.content.substring(0, maxDisplayLength)}\n\n... (还有 ${parsed.content.length - maxDisplayLength} 个字符)`
            } else {
              content += parsed.content || ''
            }
          } else if (parsed.mode === 'template') {
            content += `\n## 模板切片:\n\n`
            const slices = parsed.slices || {}
            const templates = parsed.templates || []
            
            if (templates && templates.length > 0) {
              content += '### 模板配置:\n\n'
              templates.forEach((template: any, index: number) => {
                content += `${index + 1}. **${template.name}** (模式: \`${template.pattern}\`, 输出: \`${template.outputName}\`)\n`
              })
              content += '\n'
            }
            
            if (slices && Object.keys(slices).length > 0) {
              content += '### 切片结果:\n\n'
              Object.entries(slices).forEach(([sliceName, sliceContent], index) => {
                content += `#### ${index + 1}. ${sliceName}\n`
                // 限制切片内容显示长度
                const sliceStr = String(sliceContent)
                const maxSliceLength = 5000
                if (sliceStr.length > maxSliceLength) {
                  content += `${sliceStr.substring(0, maxSliceLength)}\n\n... (还有 ${sliceStr.length - maxSliceLength} 个字符)`
                } else {
                  content += `${sliceStr}\n`
                }
                content += '\n'
              })
            } else {
              content += '未找到匹配的切片\n'
            }
          }
          
          return content
        } else {
          return `**${t('read_error')}**: ${parsed.error || parsed.result}`
        }
      }
      
      if (parsed.type === 'knowledge_retrieval') {
        if (parsed.success) {
          let content = `# ${t('retrieval_result')}\n\n`
          content += `**查询**: ${parsed.query}\n\n`
          content += `**检索到的片段数**: ${parsed.relevantBlocks?.length || 0}\n\n`
          
          if (parsed.relevantBlocks && parsed.relevantBlocks.length > 0) {
            content += '## 相关片段:\n\n'
            parsed.relevantBlocks.forEach((block: any, index: number) => {
              content += `### ${index + 1}. ${block.label} (相似度: ${(block.similarity * 100).toFixed(1)}%)\n`
              content += `${block.content}\n\n`
            })
          }
          
          return content
        } else {
          return `**${t('retrieval_error')}**: ${parsed.error || parsed.result}`
        }
      }
      
      if (parsed.type === 'structured') {
        if (parsed.success) {
          let content = `# ${t('structured_input')}\n\n`
          content += `**输出格式**: ${parsed.format}\n`
          content += `**行数**: ${parsed.rowCount}\n`
          content += `**列数**: ${parsed.columnCount}\n\n`
          
          if (parsed.format === 'json') {
            content += '```json\n' + parsed.result + '\n```'
          } else if (parsed.format === 'markdown') {
            content += parsed.result
          } else {
            content += '```\n' + parsed.result + '\n```'
          }
          
          return content
        } else {
          return `**${t('structured_error')}**: ${parsed.error || parsed.result}`
        }
      }
      
      if (parsed.type === 'decision') {
        if (parsed.success) {
          let content = `# ${t('decision_node')}\n\n`
          content += `**决策模式**: ${parsed.mode === 'llm' ? t('llm_decision') : t('rule_decision')}\n`
          content += `**选定分支**: ${parsed.selectedBranchName || parsed.selectedBranch}\n`
          content += `**决策理由**: ${parsed.reason || '无'}\n\n`
          
          if (parsed.allBranches && parsed.allBranches.length > 0) {
            content += '## 所有分支:\n\n'
            parsed.allBranches.forEach((branch: any, index: number) => {
              const isSelected = branch.id === parsed.selectedBranch
              content += `${isSelected ? '**✓**' : '○'} ${branch.name} (ID: ${branch.id})\n`
              if (branch.description) {
                content += `  ${branch.description}\n`
              }
              content += '\n'
            })
          }
          
          return content
        } else {
          return `**${t('decision_error')}**: ${parsed.error || parsed.result}`
        }
      }
      
      if (parsed.type === 'mcp') {
        if (parsed.success) {
          let content = `# ${t('mcp_node')}\n\n`
          content += `**工具**: ${parsed.tool || '无'}\n`
          content += `**状态**: ${t('mcp_connected')}\n`
          content += `**执行时间**: ${parsed.timestamp ? new Date(parsed.timestamp).toLocaleString() : '未知'}\n\n`
          
          if (parsed.result) {
            content += '## 执行结果:\n\n'
            if (typeof parsed.result === 'string') {
              content += parsed.result
            } else {
              content += '```json\n' + JSON.stringify(parsed.result, null, 2) + '\n```'
            }
          }
          
          if (parsed.rawResult) {
            content += '\n## 原始结果:\n\n'
            content += '```json\n' + JSON.stringify(parsed.rawResult, null, 2) + '\n```'
          }
          
          return content
        } else {
          let content = `# ${t('mcp_node')}\n\n`
          content += `**状态**: ${t('mcp_connection_error')}\n`
          content += `**错误**: ${parsed.error || parsed.result}\n`
          
          if (parsed.details) {
            content += `**详情**: ${parsed.details}\n`
          }
          
          return content
        }
      }
      
      if (parsed.type === 'start') {
        if (parsed.success) {
          let content = `# ${t('start')}\n\n`
          content += `**提示词**: ${parsed.prompt}\n`
          if (parsed.filePath) {
            content += `**文件路径**: ${parsed.filePath}\n`
            content += `**文件内容长度**: ${parsed.fileContent ? parsed.fileContent.length : 0} 字符\n`
          }
          content += `\n## 输入内容:\n\n${parsed.result}`
          return content
        } else {
          return `**${t('start')} 错误**: ${parsed.error || parsed.result}`
        }
      }
      
      if (parsed.type === 'end') {
        if (parsed.success) {
          return parsed.result
        } else {
          return `**${t('end')} 错误**: ${parsed.error || parsed.result}`
        }
      }
      
      if (parsed.result !== undefined) {
        if (typeof parsed.result === 'string') {
          return parsed.result
        }
        try {
          if (parsed.result && typeof parsed.result === 'object') {
            return JSON.stringify(parsed.result, null, 2)
          }
          return String(parsed.result)
        } catch {
          return String(parsed.result)
        }
      }
      
      if (parsed.content !== undefined) {
        if (typeof parsed.content === 'string') {
          return parsed.content
        }
        try {
          return JSON.stringify(parsed.content, null, 2)
        } catch {
          return String(parsed.content)
        }
      }
      
      const displayableKeys = ['data', 'text', 'output', 'message', 'content']
      for (const key of displayableKeys) {
        if (parsed[key] !== undefined) {
          if (typeof parsed[key] === 'string') {
            return parsed[key]
          }
          try {
            return JSON.stringify(parsed[key], null, 2)
          } catch {
            return String(parsed[key])
          }
        }
      }
      
      return JSON.stringify(parsed, null, 2)
    }
    
    return result
  } catch {
    return result
  }
}

// 运行工作流（从头执行到结束）
const runWorkflow = async (): Promise<void> => {
  if (!runner.value) {
    initWorkflowRunner()
  }
  
  try {
    const result = await runner.value!.run()
    
    if (result.success) {
      console.log('工作流执行成功:', result)
    } else {
      console.error('工作流执行失败:', result)
    }
  } catch (error: any) {
    console.error('工作流执行异常:', error)
  }
}

// 停止工作流
const stopWorkflow = (): void => {
  if (runner.value) {
    runner.value.stop()
  }
}

// 运行单个节点
const runSingleNode = async (): Promise<void> => {
  if (selectedNodeId.value === null || !runner.value) return
  
  try {
    const success = await runner.value.executeSingleNode(selectedNodeId.value)
    
    if (success) {
      console.log(`节点 ${selectedNodeId.value} 执行成功`)
    } else {
      console.error(`节点 ${selectedNodeId.value} 执行失败`)
    }
  } catch (error: any) {
    console.error(`节点 ${selectedNodeId.value} 执行异常:`, error)
  }
}

// 处理节点拖拽开始
const handleNodeDragStart = (type: NodeType, event: DragEvent): void => {
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', type)
    event.dataTransfer.effectAllowed = 'copy'
    
    const iconClass = type === 'local' ? 'fa-file-text' : getNodeIcon({ type } as NodeData)
    const iconColor = getNodeIconColor({ type } as NodeData)
    
    const preview = document.createElement('div')
    preview.style.position = 'absolute'
    preview.style.left = '-1000px'
    preview.style.top = '-1000px'
    preview.style.padding = '8px'
    preview.style.background = 'var(--backgroundColor)'
    preview.style.border = `1px solid ${iconColor}`
    preview.style.borderRadius = '6px'
    preview.style.color = iconColor
    preview.innerHTML = `<i class="fa fa-fw ${iconClass}"></i> ${nodeTemplates[type].name}`
    
    document.body.appendChild(preview)
    event.dataTransfer.setDragImage(preview, 10, 10)
    
    setTimeout(() => {
      if (document.body.contains(preview)) {
        document.body.removeChild(preview)
      }
    }, 0)
  }
}

// 处理画布拖拽进入
const handleCanvasDragOver = (event: DragEvent): void => {
  event.preventDefault()
  dragOverCanvas.value = true
  
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

// 处理画布拖拽离开
const handleCanvasDragLeave = (): void => {
  dragOverCanvas.value = false
}

// 处理画布拖拽放下
const handleCanvasDrop = (event: DragEvent): void => {
  event.preventDefault()
  dragOverCanvas.value = false
  
  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    handleFileDrop(event)
    return
  }
  
  const nodeType = event.dataTransfer?.getData('text/plain') as NodeType
  if (nodeType && nodeTemplates[nodeType]) {
    addNode(nodeType, event)
  }
}

// 缩放控制
const zoomIn = (): void => {
  if (svg) {
    const transition = svg.transition().duration(250).call(zoom.scaleBy, 1.2)
  }
}

const zoomOut = (): void => {
  if (svg) {
    const transition = svg.transition().duration(250).call(zoom.scaleBy, 0.8)
  }
}

const resetZoom = (): void => {
  if (svg && flowsContainer.value) {
    svg.transition().duration(250).call(zoom.transform, d3.zoomIdentity)
  }
}

// 切换连接模式
const toggleLinkMode = (): void => {
  if (operationMode.value === 'linking') {
    operationMode.value = 'normal'
    linkingSourceId.value = null
    linkingSourceConnector.value = null
    linkingSourceBranchId.value = null
    linkingSourcePortId.value = null
    linkingSourceStartPort.value = null
  } else {
    operationMode.value = 'linking'
  }
}

// 重置工作流
const resetWorkflow = (): void => {
  items.value = []
  links.value = []
  selectedNodeId.value = null
  propertiesShow.value = false
  hoveredNodeId.value = null
  operationMode.value = 'normal'
  linkingSourceId.value = null
  linkingSourceConnector.value = null
  linkingSourceBranchId.value = null
  linkingSourcePortId.value = null
  linkingSourceStartPort.value = null
  
  // 重新初始化工作流运行器
  initWorkflowRunner()
  
  saveToLocalStorage()
}

// 保存工作流
const saveWorkflow = (): void => {
  const data = {
    items: items.value,
    links: links.value
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${t('workflow')}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.flow`
  a.click()
  URL.revokeObjectURL(url)
}

// 打开工作流
const openWorkflow = async (): Promise<void> => {
  try {
    const result = await window.ipcRenderer.invoke('openFile')
    if (result.content) {
      const data = JSON.parse(result.content)
      items.value = data.items || []
      links.value = data.links || []
      
      items.value.forEach(async (item, index) => {
        if (item.type === 'knowledge' && item.kbPath) {
          await validateKnowledgeBaseNode(item.id)
        }
        
        // 确保本地节点有文件处理模式相关字段
        if (item.type === 'local') {
          if (!item.fileMode) {
            item.fileMode = 'full'
          }
          if (!item.fileTemplates) {
            item.fileTemplates = [...defaultFileTemplates]
          }
          // 确保输出端口配置存在
          if (item.fileMode === 'template' && !item.outputPorts) {
            item.outputPorts = {
              default: true,
              ports: getFileNodeOutputPorts(item).map(port => ({
                id: port.id,
                name: port.name,
                description: port.description,
                enabled: true
              }))
            }
          }
        }
        
        // 确保开始节点有正确的配置
        if (item.type === 'start') {
          if (!item.startPorts) {
            item.startPorts = {
              prompt: true,
              file: true
            }
          }
        }
      })
      
      // 重新初始化工作流运行器
      initWorkflowRunner()
      
      saveToLocalStorage()
    }
  } catch (error) {
    console.error('打开工作流失败:', error)
  }
}

// 选择文件
const selectFile = async (): Promise<void> => {
  if (!selectedNode.value || selectedNode.value.type !== 'local') return
  
  try {
    const result = await window.ipcRenderer.invoke('selectFile')
    if (result) {
      selectedNode.value.prompt = result
      const fileExtension = '.' + result.split('.').pop()?.toLowerCase()
      if (fileExtension) {
        selectedNode.value.model = fileExtension
      }
    }
  } catch (error) {
    console.error('选择文件失败:', error)
  }
}

// 选择知识库文件
const selectKnowledgeBaseFile = async (): Promise<void> => {
  if (!selectedNode.value || selectedNode.value.type !== 'knowledge') return
  
  try {
    const result = await window.ipcRenderer.invoke('selectFile', {
      filters: [
        { name: '知识库文件', extensions: ['kb', 'json'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    
    if (result && result.length > 0) {
      const kbPath = result
      selectedNode.value.kbPath = kbPath
      
      await validateKnowledgeBaseNode(selectedNode.value.id)
      
      const fileName = kbPath.split('/').pop()?.split('\\').pop() || '知识库'
      selectedNode.value.name = fileName
      
      console.log('选择知识库文件:', kbPath)
    }
  } catch (error) {
    console.error('选择知识库文件失败:', error)
  }
}

// 监听模型类型变化
watch(() => selectedNode.value?.model_type, (newType, oldType) => {
  if (selectedNode.value && newType !== oldType) {
    const node = selectedNode.value
    
    if (oldType && newType) {
      const oldModelList = getModelListForType(oldType)
      const newModelList = getModelListForType(newType)
      
      if (node.model && node.model.trim() !== '') {
        if (!newModelList.includes(node.model)) {
          node.model = ''
        }
      }
    }
  }
})

const getModelListForType = (modelType: string | undefined): string[] => {
  if (!modelType) return []
  
  switch (modelType) {
    case 'ollama':
      return store.AIconfig?.llm?.ollama?.available_models || []
    case 'lmstudio':
      return store.AIconfig?.llm?.lmstudio?.available_models || []
    case 'openai':
    case 'deepseek':
      return store.AIconfig?.llm?.openai?.available_models || []
    case 'anthropic':
      return ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229']
    case 'google':
      return ['gemini-pro', 'gemini-pro-vision']
    case 'azure':
      return []
    case 'custom':
      return []
    default:
      return []
  }
}

// 重置所有节点状态（不清除位置和连接）
const resetNodeStatuses = (): void => {
  if (items.value.length === 0) {
    return
  }
  
  // 确认提示
  if (!confirm(t('reset_status_confirm'))) {
    return
  }
  runner.value?.resetNodes()
  // 保存到本地存储
  saveToLocalStorage()
  
  console.log('所有节点状态已重置')
}
onMounted(async (): Promise<void> => {
  loadFromLocalStorage()
  
  initCanvas()
  
  nextTick(() => {
    updateSVGSize()
  })
  
  store.getAIconfig()
})

onBeforeUnmount((): void => {
  saveToLocalStorage()
  saveViewState()
  store.saveConfig()
  if (svg) {
    svg.on('.zoom', null)
  }
  window.removeEventListener('resize', updateSVGSize)
})
</script>

<style scoped>
.workflow-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--backgroundColor);
  overflow: hidden;
}

.top-toolbar {
  height: 40px;
  border-bottom: 1px solid var(--borderColor);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 5px;
  flex-shrink: 0;
}

.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toolbar-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--fontColor);
}

.stats {
  display: flex;
  gap: 5px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  opacity: 0.8;
}

.stat-item.running {
  color: #2196F3;
  font-weight: bold;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 2px;
  padding-left: 5px;
  border-left: 1px solid var(--borderColor);
}

.toolbar-group:first-child {
  border-left: none;
  padding-left: 0;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  font-size: 12px;
  margin: 2px;
  border-radius: 5px;
  background: var(--backgroundColor);
  border: 1px solid var(--borderColor);
  color: var(--fontColor);
  cursor: pointer;
  width:30px;
  height:30px;
  text-align: center;
  font-size: 16px;
}

.toolbar-btn:hover, .toolbar-btn.active {
  border-color: var(--fontActiveColor);
  color: var(--fontActiveColor);
}

.toolbar-btn.active {
  background-color: var(--fontActiveColor);
  color: var(--backgroundColor);
}

.toolbar-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toolbar-btn.disabled:hover {
  border-color: var(--borderColor);
  color: var(--fontColor);
}

.toolbar-btn.danger:hover {
  border-color: #f44336;
  color: #f44336;
}

.editor-main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.left-panel {
  width: 78px;
  border-right: 1px solid var(--borderColor);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.panel-content {
  flex: 1;
  padding: 5px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 5px;
  overflow-y: auto;
  align-content: start;
}

.node-tool {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 7px 5px;
  background-color: var(--backgroundColor);
  border: 1px solid var(--borderColor);
  border-radius: 5px;
  cursor: move;
  transition: all 0.2s;
  user-select: none;
  -webkit-user-drag: element;
}

.node-tool:hover {
  border-color: var(--fontActiveColor);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.node-tool:active {
  opacity: 0.8;
}

.canvas-container {
  flex: 1;
  overflow: hidden;
  position: relative;
  background-color: var(--backgroundColor);
  transition: background-color 0.2s;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

.canvas-container.drag-over {
  background-color: rgba(var(--fontActiveColor-rgb, 33, 150, 243), 0.05);
}

.canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: default;
}

.canvas-status {
  position: absolute;
  top: 5px;
  right: 5px;
  color: white;
  padding: 0px;
  font-size: 11px;
  z-index: 100;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
}

.drop-indicator {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  pointer-events: none;
}

.drop-indicator-content {
  background-color: rgba(33, 150, 243, 0.9);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.link {
  pointer-events: visibleStroke;
  cursor: pointer;
  transition: stroke 0.2s;
  stroke: var(--borderColor);
}

.link:hover {
  stroke: var(--fontActiveColor);
  stroke-width: 3;
}

.branch-link {
  stroke-dasharray: 5, 5;
  stroke-linecap: round;
  stroke: var(--borderColor) !important;
}

.branch-link:hover {
  stroke-width: 3;
  stroke-dasharray: none;
  stroke: var(--fontActiveColor) !important;
}

.connector circle {
  pointer-events: all;
  transition: fill 0.2s;
}

.connector:hover circle {
  fill: var(--fontActiveColor) !important;
}

.connector.start-prompt circle,
.connector.start-file circle {
  fill: rgba(76, 175, 80, 0.3) !important;
  opacity: 0.7;
}

.connector.start-prompt:hover circle,
.connector.start-file:hover circle {
  fill: #4CAF50 !important;
  opacity: 1;
  transform: scale(1.2);
}

.connector.start-prompt text,
.connector.start-file text {
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s;
}

.connector.start-prompt:hover text,
.connector.start-file:hover text {
  opacity: 1;
}

.connector.branch circle {
  fill: rgba(var(--fontActiveColor-rgb, 33, 150, 243), 0.3) !important;
  opacity: 0.7;
}

.connector.branch:hover circle {
  fill: var(--fontActiveColor) !important;
  opacity: 1;
  transform: scale(1.2);
}

.connector.branch text {
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s;
}

.connector.branch:hover text {
  opacity: 1;
}

/* 文件节点端口样式 */
.connector.file-default circle,
.connector.file-port circle {
  fill: rgba(33, 150, 243, 0.3) !important;
  opacity: 0.7;
}

.connector.file-default:hover circle,
.connector.file-port:hover circle {
  fill: #2196F3 !important;
  opacity: 1;
  transform: scale(1.2);
}

.connector.file-port text,
.connector.file-default text {
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s;
}

.connector.file-port:hover text,
.connector.file-default:hover text {
  opacity: 1;
}

.delete-btn {
  opacity: 0;
  transition: opacity 0.2s;
}

.node * {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

.node:hover .delete-btn {
  opacity: 1;
}

.connector, .delete-btn {
  user-select: auto;
}

.right-panel {
  width: 320px;
  border-left: 1px solid var(--borderColor);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  background-color: var(--backgroundColor);
}

.right-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 10px;
  border-bottom: 1px solid var(--borderColor);
  flex-shrink: 0;
}

.right-panel-header h3 {
  margin: 0;
  font-size: 14px;
  color: var(--fontActiveColor);
  display: flex;
  align-items: center;
  gap: 8px;
}

.close-btn {
  background: none;
  border: none;
  color: var(--fontColor);
  cursor: pointer;
  font-size: 14px;
  padding: 4px;
}

.right-panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 5px;
  display: flex;
  flex-direction: column;
}

.property-group {
  margin-bottom: 5px;
  border-bottom: 1px solid var(--borderColor);
}

.property-row {
  display: flex;
  flex-direction: row;
  gap: 5px
}

.property-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--fontColor);
  opacity: 0.9;
  width: 70px;
}

.property-input {
  flex:1;
  text-align: center;
  line-height: 30px;
}

input{
  margin: 5px 0px;
  width:calc(100% - 6px);
}
select{
  margin: 5px 0px;
  width:100%;
  background-color: var(--backgroundColor);
}
.code-textarea {
  min-height: 120px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  line-height: 1.4;
  resize: vertical;
  width:calc(100% - 12px)
}

.code-help {
  margin-top: 8px;
  font-size: 11px;
  color: var(--fontColor);
  opacity: 0.7;
}

.code-help code {
  background-color: rgba(0, 0, 0, 0.1);
  padding: 2px 5px;
  border-radius: 3px;
  font-size: 10px;
  margin: 0 2px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 5px;
  font-size: 11px;
  color: white;
}

.status-badge.idle { background-color: #757575; }
.status-badge.running { background-color: #2196F3; }
.status-badge.success { background-color: #4CAF50; }
.status-badge.error { background-color: #f44336; }

.property-btn {
  flex: 1;
  padding: 5px 10px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  height:  30px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.property-btn.primary {
  background-color: var(--fontActiveColor);
  color: var(--backgroundColor);
}

.property-btn.primary:hover:not(:disabled) {
  background-color: var(--fontActiveColor);
  opacity: 0.9;
}

.property-btn.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.property-btn.danger {
  background-color: #f44336;
  color: white;
  flex: 0;
  padding: 10px 12px;
}

.property-btn.danger:hover {
  background-color: #d32f2f;
}

.upstream-info {
  margin-bottom: 10px;
  overflow: hidden;
}

.upstream-header {
  padding: 6px 10px;
  background-color: rgba(0, 0, 0, 0.05);
  font-size: 12px;
  color: var(--fontColor);
  display: flex;
  align-items: center;
  gap: 6px;
}

.upstream-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  border-bottom: 1px solid var(--borderColor);
}

.upstream-table th {
  background-color: rgba(0, 0, 0, 0.03);
  padding: 4px 6px;
  text-align: left;
  border-bottom: 1px solid var(--borderColor);
  font-weight: 500;
  color: var(--fontColor);
  white-space: nowrap;
}

.upstream-table td {
  padding: 4px 6px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  vertical-align: middle;
}

.upstream-table tr:last-child td {
  border-bottom: none;
}

.upstream-table td code {
  background-color: rgba(0, 0, 0, 0.05);
  padding: 1px 4px;
  border-radius: 3px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 10px;
}

.readonly-textarea {
  background-color: rgba(0, 0, 0, 0.05);
  cursor: not-allowed;
  opacity: 0.8;
}

.readonly-textarea:focus {
  outline: none;
  border-color: var(--borderColor);
}

.kb-validation {
  margin: 0;
  padding: 8px;
  border-radius: 5px;
  background-color: rgba(0, 0, 0, 0.02);
  border: 1px solid var(--borderColor);
}

.validation-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 5px;
}

.validation-status.valid {
  color: #4CAF50;
}

.validation-status.invalid {
  color: #f44336;
}

.validation-issues {
  padding-left: 20px;
}

.validation-issues small {
  display: block;
  margin: 3px 0;
  color: #f44336;
  font-size: 11px;
}

.property-btn.small {
  font-size: 11px;
  padding: 3px 6px;
  height: auto;
}

.columns-table th,
.columns-table td,
.data-table th,
.data-table td,
.branches-table th,
.branches-table td,
.templates-table th,
.templates-table td {
  border: 1px solid var(--borderColor);
}

.columns-table input,
.columns-table select,
.data-table input,
.branches-table input,
.templates-table input {
  margin: 0;
  background-color: var(--backgroundColor);
  color: var(--fontColor);
  border: 1px solid var(--borderColor);
  border-radius: 3px;
}

.columns-table input:focus,
.columns-table select:focus,
.data-table input:focus,
.branches-table input:focus,
.templates-table input:focus {
  outline: 1px solid var(--fontActiveColor);
}

.required-error {
  border-color: #f44336 !important;
  background-color: rgba(244, 67, 54, 0.1) !important;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.status-indicator.connected {
  background-color: rgba(76, 175, 80, 0.1);
  color: #4CAF50;
}

.status-indicator:not(.connected) {
  background-color: rgba(158, 158, 158, 0.1);
  color: #757575;
}

.tool-count {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--fontColor);
  opacity: 0.7;
}

.tool-parameters {
  border: 1px solid var(--borderColor);
  border-radius: 5px;
  overflow: hidden;
}

.tool-parameters .parameter-header {
  padding: 6px 10px;
  background-color: rgba(0, 0, 0, 0.03);
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--fontColor);
}

.tool-parameters .parameter-fields {
  padding: 8px;
}

.tool-parameters .parameter-fields-scroll {
  max-height: 150px;
  overflow-y: auto;
}

.tool-parameters .parameter-field {
  margin-bottom: 8px;
}

.tool-parameters .parameter-field label {
  display: block;
  margin-bottom: 3px;
  font-size: 11px;
  color: var(--fontColor);
  opacity: 0.8;
}

.tool-parameters .parameter-field .parameter-input input {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid var(--borderColor);
  border-radius: 3px;
  background-color: var(--backgroundColor);
  color: var(--fontColor);
  font-size: 11px;
}

.tool-parameters .no-schema-info {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px;
  color: var(--fontColor);
  opacity: 0.6;
  font-size: 11px;
  justify-content: center;
}
</style>