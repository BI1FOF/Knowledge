<!-- /knowOntology.vue -->
<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, nextTick, computed, watch } from 'vue'
import 'highlight.js/styles/github-dark.css'
import { usestore } from '../../../store'
import * as d3 from 'd3'

const store = usestore()

interface Emits {
  updateGraph: [graphData: any]
  filterGraph: [filter: any]
  [key: string]: any[]
}
const emit = defineEmits<Emits>()

// 输入状态
let input = ref("")

// 配置状态
let config = ref({
    selectedModel: '',
})

// 本体相关状态
let ontologyState = ref({
    buildMode: 'replace' as 'replace' | 'append',
    isBuilding: false,
    buildingStep: 0,
    currentResponse: '', // 存储当前AI响应
    showAttributes: true, // 控制属性节点是否显示
    selectedNode: null as GraphNode | null, // 当前选中的节点
    showNodeDetail: false, // 是否显示节点详情面板（覆盖整个左侧）
    showManualPanel: false, // 是否显示手动输入面板
    editingNode: null as GraphNode | null, // 正在编辑的节点
    activeTab: 'nlp' as 'nlp' | 'manual' | 'info', // 左侧标签页
    layoutMode: 'force' as 'force' | 'hierarchical', // 布局模式：力导向或层次布局
    autoReasoningStage: 'none' as 'none' | 'entity' | 'attribute' | 'logic' | 'decision' | 'complete', // 四阶段推理状态
    customPrompt: `你是一个本体构建专家。请将用户的自然语言描述解析为结构化本体，包含以下多层结构：

1. **数据层**：
   - 实体（Entities）：包含属性和关联规则
   - 属性（Attributes）：实体的具体特征，可以展开为节点
   - 关系（Relationships）：实体之间的连接

2. **逻辑层**：
   - 规则（Rules）：必须关联到具体的数据实体或属性
   - 约束（Constraints）：针对数据实体的限制条件
   - 推理（Inferences）：基于数据的逻辑推导

3. **决策层**：
   - 决策规则（Decision Rules）：必须基于数据实体或逻辑规则
   - 策略（Strategies）：决策的组合和优先级
   - 行动（Actions）：具体的执行步骤

重要要求：
1. 每个数据实体必须包含具体的属性列表
2. 每个规则和决策必须明确关联到具体的数据实体或属性
3. 属性可以作为独立的节点存在，与实体关联

请以JSON格式返回，结构如下：
{
  "dataLayer": {
    "entities": [
      {
        "id": "string", 
        "name": "string", 
        "type": "string", 
        "attributes": [
          {"name": "string", "type": "string", "description": "string"}
        ], 
        "description": "string",
        "relatedRules": ["rule_id"],
        "relatedDecisions": ["decision_id"]
      }
    ],
    "relationships": [
      {"source": "entity_id", "target": "entity_id", "type": "string", "description": "string"}
    ]
  },
  "logicLayer": {
    "rules": [
      {
        "id": "string", 
        "name": "string",
        "condition": "string", 
        "action": "string", 
        "description": "string",
        "relatedEntities": ["entity_id"],
        "relatedAttributes": ["attribute_name"]
      }
    ],
    "constraints": [
      {
        "entity": "entity_id", 
        "constraint": "string", 
        "description": "string",
        "relatedAttributes": ["attribute_name"]
      }
    ]
  },
  "decisionLayer": {
    "decisionRules": [
      {
        "id": "string", 
        "name": "string",
        "condition": "string", 
        "decision": "string", 
        "priority": "string", 
        "description": "string",
        "relatedEntities": ["entity_id"],
        "relatedRules": ["rule_id"]
      }
    ],
    "strategies": [
      {
        "name": "string", 
        "description": "string", 
        "actions": ["string"],
        "relatedDecisions": ["decision_id"]
      }
    ]
  }
}` // 自定义提示词
})

// 定义节点和边的接口
interface GraphNode {
    id: string;
    name: string;
    type: 'data' | 'logic' | 'decision' | 'attribute';
    layer: 'data' | 'logic' | 'decision' | 'attribute';
    attributes: string[];
    description: string;
    entityType?: string;
    rule?: any;
    constraint?: any;
    strategy?: any;
    color: string;
    size: number;
    label: string;
    userInput?: string;
    parentNode?: string;
    x?: number;
    y?: number;
    fx?: number | null;
    fy?: number | null;
    relatedEntities?: string[];
    relatedRules?: string[];
    relatedAttributes?: string[];
    relatedDecisions?: string[];
    [key: string]: any;
}

interface GraphEdge {
    id: string;
    source: string | GraphNode;
    target: string | GraphNode;
    type: string;
    layer: 'data' | 'logic' | 'decision' | 'attribute';
    label: string;
    description: string;
    color: string;
    width: number;
    dashes?: number[];
    markerEnd?: string; // 箭头标记
    [key: string]: any;
}

interface GraphLayer {
    nodes: GraphNode[];
    edges: GraphEdge[];
}

// 图谱相关状态
let ontologyGraph = ref({
    nodes: [] as GraphNode[],
    edges: [] as GraphEdge[],
    version: 0,
    layers: {
        data: { nodes: [] as GraphNode[], edges: [] as GraphEdge[] },
        logic: { nodes: [] as GraphNode[], edges: [] as GraphEdge[] },
        decision: { nodes: [] as GraphNode[], edges: [] as GraphEdge[] },
        attribute: { nodes: [] as GraphNode[], edges: [] as GraphEdge[] },
        all: { nodes: [] as GraphNode[], edges: [] as GraphEdge[] }
    } as Record<string, GraphLayer>
})

// 图谱筛选状态
let graphFilter = ref({
    visibleLayers: {
        data: true,
        logic: true,
        decision: true,
        attribute: true
    },
    showLabels: true,
    highlightRelations: true,
    showArrows: true // 是否显示箭头
})

// D3图谱相关
let d3Svg = ref<SVGSVGElement | null>(null)
let d3Simulation: any = null
let d3Zoom: any = null
let d3Initialized = ref(false)

// 手动输入面板状态
let manualInput = ref({
    nodeType: 'data' as 'data' | 'logic' | 'decision' | 'attribute',
    nodeName: '',
    nodeDescription: '',
    attributes: [''] as string[], // 属性列表
    entityType: '',
    ruleCondition: '',
    ruleAction: '',
    ruleDecision: '',
    rulePriority: 'medium',
    constraintText: '',
    strategyActions: [''] as string[],
    selectedLayer: 'data' as 'data' | 'logic' | 'decision' | 'attribute',
    sourceNode: '', // 源节点ID
    targetNode: '', // 目标节点ID
    edgeType: 'related_to', // 关系类型
    edgeDescription: '',
    connectingNodes: false, // 是否正在连接节点
})

// 模型相关计算属性
const availableModels = computed(() => {
    const llmType = store.AIconfig.llm.type;
    switch (llmType) {
        case 'ollama':
            return store.AIconfig.llm.ollama.available_models || [];
        case 'openai':
        case 'deepseek':
            return store.AIconfig.llm.openai.available_models || [];
        case 'anthropic':
            return ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'];
        case 'google':
            return ['gemini-pro', 'gemini-pro-vision', 'gemini-ultra'];
        case 'azure':
            return store.AIconfig.llm.azure.deployment ? [store.AIconfig.llm.azure.deployment] : [];
        case 'custom':
            return store.AIconfig.llm.custom.model ? [store.AIconfig.llm.custom.model] : [];
        default:
            return [];
    }
});

const isModelsAvailable = computed(() => {
    return availableModels.value.length > 0;
});

const selectModel = (modelName: string) => {
    config.value.selectedModel = modelName;
    
    const llmType = store.AIconfig.llm.type;
    switch (llmType) {
        case 'ollama':
            store.AIconfig.llm.ollama.model = modelName;
            break;
        case 'openai':
        case 'deepseek':
            store.AIconfig.llm.openai.model = modelName;
            break;
        case 'anthropic':
            store.AIconfig.llm.anthropic.model = modelName;
            break;
        case 'google':
            store.AIconfig.llm.google.model = modelName;
            break;
        case 'azure':
            store.AIconfig.llm.azure.deployment = modelName;
            break;
        case 'custom':
            store.AIconfig.llm.custom.model = modelName;
            break;
    }
};

const refreshModels = async () => {
    try {
        await store.getAIconfig();
        if (availableModels.value.length > 0) {
            const firstModel = availableModels.value[0];
            if (!config.value.selectedModel || !availableModels.value.includes(config.value.selectedModel)) {
                selectModel(firstModel);
            }
        }
    } catch (error) {
        console.error('刷新模型列表失败:', error);
    }
};

const clearGraph = function () {
    ontologyGraph.value = {
        nodes: [] as GraphNode[],
        edges: [] as GraphEdge[],
        version: 0,
        layers: {
            data: { nodes: [] as GraphNode[], edges: [] as GraphEdge[] },
            logic: { nodes: [] as GraphNode[], edges: [] as GraphEdge[] },
            decision: { nodes: [] as GraphNode[], edges: [] as GraphEdge[] },
            attribute: { nodes: [] as GraphNode[], edges: [] as GraphEdge[] },
            all: { nodes: [] as GraphNode[], edges: [] as GraphEdge[] }
        }
    };
    ontologyState.value.currentResponse = '';
    ontologyState.value.selectedNode = null;
    ontologyState.value.showNodeDetail = false;
    ontologyState.value.autoReasoningStage = 'none';
    cleanupD3Graph();
    // 清空后重新渲染
    nextTick(() => {
        renderD3Graph();
    });
}

let textarea = ref<HTMLTextAreaElement | null>(null)
const enter = async function (e: KeyboardEvent) {
    if (e.keyCode === 13 && document.activeElement === textarea.value) {
        e.preventDefault()
        generate()
    }
}

const buildSystemPrompt = () => {
    return ontologyState.value.customPrompt;
}

const extractExistingStructure = (): string => {
    const structure = {
        dataLayer: {
            entities: ontologyGraph.value.layers.data.nodes.map(n => ({
                name: n.name,
                type: n.entityType || 'entity',
                attributes: n.attributes || [],
                description: n.description || '',
                relatedRules: n.relatedRules || [],
                relatedDecisions: n.relatedDecisions || []
            })),
            relationships: ontologyGraph.value.layers.data.edges.map(e => ({
                source: e.source,
                target: e.target,
                type: e.type,
                description: e.description || ''
            }))
        },
        logicLayer: {
            rules: ontologyGraph.value.layers.logic.nodes.filter(n => n.rule).map(n => ({
                ...n.rule,
                description: n.description || '',
                relatedEntities: n.relatedEntities || [],
                relatedAttributes: n.relatedAttributes || []
            })),
            constraints: ontologyGraph.value.layers.logic.nodes.filter(n => n.constraint).map(n => ({
                ...n.constraint,
                description: n.description || ''
            }))
        },
        decisionLayer: {
            decisionRules: ontologyGraph.value.layers.decision.nodes.filter(n => n.rule).map(n => ({
                ...n.rule,
                description: n.description || '',
                relatedEntities: n.relatedEntities || [],
                relatedRules: n.relatedRules || []
            })),
            strategies: ontologyGraph.value.layers.decision.nodes.filter(n => n.strategy).map(n => ({
                ...n.strategy,
                description: n.description || ''
            }))
        }
    };

    return JSON.stringify(structure, null, 2);
}

const toggleBuildMode = () => {
    ontologyState.value.buildMode = ontologyState.value.buildMode === 'replace' ? 'append' : 'replace';
}

const toggleLayerVisibility = (layer: 'data' | 'logic' | 'decision' | 'attribute') => {
    graphFilter.value.visibleLayers[layer] = !graphFilter.value.visibleLayers[layer];
    renderD3Graph();
}

const toggleAllLayers = () => {
    const allVisible = Object.values(graphFilter.value.visibleLayers).every(v => v);
    const newState = !allVisible;
    
    graphFilter.value.visibleLayers.data = newState;
    graphFilter.value.visibleLayers.logic = newState;
    graphFilter.value.visibleLayers.decision = newState;
    graphFilter.value.visibleLayers.attribute = newState;
    
    renderD3Graph();
}

const allLayersVisible = computed(() => {
    return Object.values(graphFilter.value.visibleLayers).every(v => v);
});

const allLayersHidden = computed(() => {
    return Object.values(graphFilter.value.visibleLayers).every(v => !v);
});

// 四阶段自动化推理
const fourStageReasoningPrompts = {
    entity: `请进行实体推理阶段：识别核心实体和基本关系
分析用户输入，识别：
1. 核心实体（人、物、事件、概念）
2. 实体的基本类型和分类
3. 实体间的基本关系
4. 数据层的基本结构

重要要求：
- 优先识别最重要、最核心的实体
- 避免过度细化，保持实体粒度的适当性
- 关注实体之间的主从关系、包含关系、依赖关系

返回格式：
{
  "stage": "entity",
  "coreEntities": [
    {
      "name": "实体名称",
      "type": "实体类型",
      "description": "实体描述",
      "importance": "high/medium/low"
    }
  ],
  "basicRelationships": [
    {
      "source": "源实体名称",
      "target": "目标实体名称", 
      "type": "关系类型",
      "description": "关系描述"
    }
  ],
  "summary": "实体推理阶段总结"
}`,
    
    attribute: `请进行属性推理阶段：识别和丰富实体属性
基于实体推理阶段的结果，分析：
1. 每个实体的关键属性（特征、状态、度量）
2. 属性的数据类型和约束
3. 属性间的关联和依赖
4. 属性的业务意义和取值范围

重要要求：
- 为每个实体识别3-5个核心属性
- 区分必填属性和可选属性
- 考虑属性的数据类型（字符串、数字、日期、布尔值等）
- 识别属性的业务约束（唯一性、范围、格式等）

返回格式：
{
  "stage": "attribute",
  "entityAttributes": [
    {
      "entityName": "实体名称",
      "attributes": [
        {
          "name": "属性名称",
          "type": "数据类型",
          "description": "属性描述",
          "required": true/false,
          "constraints": ["约束条件"]
        }
      ]
    }
  ],
  "attributeRelations": [
    {
      "sourceAttribute": "属性名称",
      "targetAttribute": "目标属性名称",
      "type": "关联类型",
      "description": "关联描述"
    }
  ],
  "summary": "属性推理阶段总结"
}`,
    
    logic: `请进行逻辑推理阶段：构建逻辑规则和约束
基于前两个阶段的结果，分析：
1. 实体和属性之间的业务规则
2. 条件和动作的逻辑关系
3. 业务约束和验证规则
4. 状态转换和流程逻辑

重要要求：
- 每条规则必须关联到具体的实体和属性
- 规则应具备明确的触发条件和执行动作
- 约束应具体且有可操作性
- 考虑规则的优先级和冲突解决

返回格式：
{
  "stage": "logic",
  "businessRules": [
    {
      "name": "规则名称",
      "condition": "触发条件",
      "action": "执行动作",
      "description": "规则描述",
      "relatedEntities": ["相关实体"],
      "relatedAttributes": ["相关属性"],
      "priority": "high/medium/low"
    }
  ],
  "businessConstraints": [
    {
      "entity": "实体名称",
      "constraint": "约束条件",
      "description": "约束描述",
      "relatedAttributes": ["相关属性"],
      "severity": "error/warning/info"
    }
  ],
  "logicFlows": [
    {
      "name": "逻辑流名称",
      "steps": ["步骤1", "步骤2"],
      "description": "流程描述"
    }
  ],
  "summary": "逻辑推理阶段总结"
}`,
    
    decision: `请进行决策推理阶段：制定决策策略和行动计划
基于前三个阶段的结果，分析：
1. 决策点和决策规则
2. 策略组合和执行路径
3. 优先级和优化方案
4. 风险评估和应对措施

重要要求：
- 每个决策规则必须基于具体的业务规则和数据
- 决策应有明确的决策标准和评估指标
- 策略应包含具体的行动步骤
- 考虑决策的时效性和执行成本

返回格式：
{
  "stage": "decision",
  "decisionRules": [
    {
      "name": "决策规则名称",
      "condition": "决策条件",
      "decision": "决策结果",
      "description": "规则描述",
      "relatedEntities": ["相关实体"],
      "relatedRules": ["相关业务规则"],
      "priority": "high/medium/low",
      "confidence": "high/medium/low"
    }
  ],
  "strategies": [
    {
      "name": "策略名称",
      "description": "策略描述",
      "actions": ["具体行动1", "具体行动2"],
      "relatedDecisions": ["相关决策规则"],
      "successCriteria": ["成功标准"],
      "risks": ["潜在风险"]
    }
  ],
  "actionPlans": [
    {
      "name": "行动计划名称",
      "steps": ["步骤描述1", "步骤描述2"],
      "timeline": "时间要求",
      "responsibility": "责任主体"
    }
  ],
  "summary": "决策推理阶段总结"
}`
};

// 四阶段推理函数
const performEntityReasoning = async (userInput: string) => {
    await performStageReasoning(userInput, 'entity', '正在识别核心实体...');
}

const performAttributeReasoning = async (userInput: string) => {
    await performStageReasoning(userInput, 'attribute', '正在分析实体属性...');
}

const performLogicReasoning = async (userInput: string) => {
    await performStageReasoning(userInput, 'logic', '正在构建逻辑规则...');
}

const performDecisionReasoning = async (userInput: string) => {
    await performStageReasoning(userInput, 'decision', '正在制定决策策略...');
}

const performStageReasoning = async (userInput: string, stage: 'entity' | 'attribute' | 'logic' | 'decision', loadingText: string) => {
    if (!store.AIconfig.llm.online || (!config.value.selectedModel && store.AIconfig.llm.type !== 'anthropic')) {
        alert(store.locales === 'zh' ? '请确保模型已连接并选择！' : 'Please ensure model is connected and selected!');
        return;
    }
    
    ontologyState.value.isBuilding = true;
    ontologyState.value.autoReasoningStage = stage;
    ontologyState.value.currentResponse = loadingText;
    
    let systemPrompt = ontologyState.value.customPrompt;
    
    // 如果是后续阶段，添加已存在的结构作为上下文
    if (stage !== 'entity') {
        const existingStructure = extractExistingStructure();
        systemPrompt += `\n\n当前已存在的本体结构：\n${existingStructure}`;
    }
    
    // 添加阶段特定的提示词
    systemPrompt += `\n\n${fourStageReasoningPrompts[stage]}`;
    
    try {
        await store.sendToAI(
            [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: `推理阶段：${stage}
用户输入：${userInput}

${stage === 'entity' ? '请开始实体推理' : 
  stage === 'attribute' ? '请开始属性推理' :
  stage === 'logic' ? '请开始逻辑推理' : '请开始决策推理'}`
                }
            ],
            {
                onStream: (chunk: string) => {
                    ontologyState.value.currentResponse += chunk;
                },
                onComplete: (fullContent: string) => {
                    ontologyState.value.currentResponse = fullContent;
                    parseAndUpdateStageResult(fullContent, stage);
                    ontologyState.value.isBuilding = false;
                    ontologyState.value.autoReasoningStage = 'complete';
                },
                onError: (error: Error) => {
                    ontologyState.value.currentResponse = "抱歉，推理失败，请重试";
                    console.error(`${stage}推理错误:`, error)
                    ontologyState.value.isBuilding = false;
                    ontologyState.value.autoReasoningStage = 'none';
                }
            }
        )
    } catch (error) {
        ontologyState.value.currentResponse = "抱歉，请求失败，请重试";
        console.error(`${stage}推理错误:`, error)
        ontologyState.value.isBuilding = false;
        ontologyState.value.autoReasoningStage = 'none';
    }
}

const parseAndUpdateStageResult = (response: string, stage: 'entity' | 'attribute' | 'logic' | 'decision') => {
    try {
        const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                         response.match(/```\n([\s\S]*?)\n```/) ||
                         response.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
            console.warn(`未找到JSON格式的${stage}推理结果`);
            return;
        }
        
        const jsonStr = jsonMatch[0].replace(/```json\n|```\n|```/g, '');
        const reasoningResult = JSON.parse(jsonStr);
        
        console.log(`${stage}推理结果:`, reasoningResult);
        
        // 根据阶段处理结果
        switch (stage) {
            case 'entity':
                updateEntityReasoningResult(reasoningResult);
                break;
            case 'attribute':
                updateAttributeReasoningResult(reasoningResult);
                break;
            case 'logic':
                updateLogicReasoningResult(reasoningResult);
                break;
            case 'decision':
                updateDecisionReasoningResult(reasoningResult);
                break;
        }
        
    } catch (error) {
        console.error(`解析${stage}推理结果失败:`, error, response);
    }
}

const updateEntityReasoningResult = (result: any) => {
    const newNodes: GraphNode[] = [];
    const newEdges: GraphEdge[] = [];
    
    // 处理核心实体
    if (result.coreEntities && Array.isArray(result.coreEntities)) {
        result.coreEntities.forEach((entity: any, index: number) => {
            // 检查重复实体
            const existingEntity = ontologyGraph.value.nodes.find(n => 
                n.type === 'data' && n.name === entity.name
            );
            
            if (existingEntity) {
                console.log(`实体 "${entity.name}" 已存在，跳过`);
                return;
            }
            
            const nodeId = `data-${entity.name || `entity${index}`}-${Date.now()}-${index}`;
            const entityNode: GraphNode = {
                id: nodeId,
                name: entity.name || `实体${index+1}`,
                type: 'data',
                layer: 'data',
                entityType: entity.type || 'entity',
                attributes: [],
                description: entity.description || `核心实体: ${entity.name}`,
                size: 22,
                color: '#2196F3',
                label: entity.name || `实体${index+1}`,
                reasoningStage: 'entity',
                importance: entity.importance || 'medium'
            };
            newNodes.push(entityNode);
        });
    }
    
    // 处理基本关系
    if (result.basicRelationships && Array.isArray(result.basicRelationships)) {
        result.basicRelationships.forEach((rel: any, index: number) => {
            const sourceNode = newNodes.find(n => n.name === rel.source) || 
                             ontologyGraph.value.nodes.find(n => n.name === rel.source);
            const targetNode = newNodes.find(n => n.name === rel.target) || 
                             ontologyGraph.value.nodes.find(n => n.name === rel.target);
            
            if (sourceNode && targetNode) {
                // 检查重复关系
                const existingEdge = ontologyGraph.value.edges.find(e => 
                    (e.source === sourceNode.id || e.source === sourceNode) &&
                    (e.target === targetNode.id || e.target === targetNode) &&
                    e.type === rel.type
                );
                
                if (!existingEdge) {
                    newEdges.push({
                        id: `edge-entity-${index}-${Date.now()}`,
                        source: sourceNode.id,
                        target: targetNode.id,
                        type: rel.type || 'related_to',
                        layer: 'data',
                        label: rel.type || '关系',
                        description: rel.description || `${rel.source} → ${rel.target}`,
                        color: '#2196F3',
                        width: 1.5,
                        markerEnd: 'url(#arrowhead)',
                        reasoningStage: 'entity'
                    });
                }
            }
        });
    }
    
    // 更新图谱
    updateGraphWithIncrementalData(newNodes, newEdges);
}

const updateAttributeReasoningResult = (result: any) => {
    const newNodes: GraphNode[] = [];
    const newEdges: GraphEdge[] = [];
    
    // 处理实体属性
    if (result.entityAttributes && Array.isArray(result.entityAttributes)) {
        result.entityAttributes.forEach((entityAttr: any) => {
            const entityNode = ontologyGraph.value.nodes.find(n => 
                n.type === 'data' && n.name === entityAttr.entityName
            );
            
            if (!entityNode) {
                console.warn(`实体 "${entityAttr.entityName}" 不存在，跳过属性添加`);
                return;
            }
            
            if (entityAttr.attributes && Array.isArray(entityAttr.attributes)) {
                entityAttr.attributes.forEach((attr: any, attrIndex: number) => {
                    // 检查重复属性
                    const existingAttribute = ontologyGraph.value.nodes.find(n => 
                        n.type === 'attribute' && 
                        n.name === attr.name &&
                        n.parentNode === entityNode.id
                    );
                    
                    if (existingAttribute) {
                        console.log(`属性 "${attr.name}" 已存在于实体 "${entityAttr.entityName}"，跳过`);
                        return;
                    }
                    
                    const attrId = `attr-${entityAttr.entityName}-${attr.name || attrIndex}-${Date.now()}`;
                    
                    const attributeNode: GraphNode = {
                        id: attrId,
                        name: attr.name,
                        type: 'attribute',
                        layer: 'attribute',
                        attributes: [],
                        description: `属性: ${attr.name} (${attr.type}) - ${attr.description || '无描述'}`,
                        entityType: attr.type,
                        size: 10,
                        color: '#9C27B0',
                        label: attr.name,
                        parentNode: entityNode.id,
                        reasoningStage: 'attribute',
                        required: attr.required,
                        constraints: attr.constraints
                    };
                    newNodes.push(attributeNode);
                    
                    // 属性到实体的有向边
                    newEdges.push({
                        id: `edge-attr-${entityAttr.entityName}-${attrIndex}-${Date.now()}`,
                        source: attrId,
                        target: entityNode.id,
                        type: 'belongs_to',
                        layer: 'attribute',
                        label: '属于',
                        description: `属性${attr.name}属于实体${entityAttr.entityName}`,
                        color: '#9C27B0',
                        width: 1.5,
                        markerEnd: 'url(#arrowhead)',
                        reasoningStage: 'attribute'
                    });
                });
                
                // 更新实体的属性列表
                entityNode.attributes = [
                    ...entityNode.attributes,
                    ...entityAttr.attributes.map((attr: any) => attr.name)
                ];
            }
        });
    }
    
    // 处理属性关联
    if (result.attributeRelations && Array.isArray(result.attributeRelations)) {
        result.attributeRelations.forEach((rel: any, index: number) => {
            // 这里需要更复杂的逻辑来查找属性节点
            // 由于属性可能有重复名称，需要结合父实体来查找
            const sourceAttributeNode = findAttributeNode(rel.sourceAttribute, rel.sourceEntity);
            const targetAttributeNode = findAttributeNode(rel.targetAttribute, rel.targetEntity);
            
            if (sourceAttributeNode && targetAttributeNode) {
                newEdges.push({
                    id: `edge-attr-rel-${index}-${Date.now()}`,
                    source: sourceAttributeNode.id,
                    target: targetAttributeNode.id,
                    type: rel.type || 'related_to',
                    layer: 'attribute',
                    label: rel.type || '关联',
                    description: rel.description || `${rel.sourceAttribute} → ${rel.targetAttribute}`,
                    color: '#9C27B0',
                    width: 1,
                    dashes: [2, 2],
                    reasoningStage: 'attribute'
                });
            }
        });
    }
    
    updateGraphWithIncrementalData(newNodes, newEdges);
}

// 辅助函数：查找属性节点
const findAttributeNode = (attributeName: string, entityName?: string): GraphNode | null => {
    if (entityName) {
        // 如果指定了实体名称，先找到实体
        const entityNode = ontologyGraph.value.nodes.find(n => 
            n.type === 'data' && n.name === entityName
        );
        if (entityNode) {
            return ontologyGraph.value.nodes.find(n => 
                n.type === 'attribute' && 
                n.name === attributeName &&
                n.parentNode === entityNode.id
            ) || null;
        }
    }
    
    // 如果没有指定实体或没找到，返回第一个匹配的属性
    return ontologyGraph.value.nodes.find(n => 
        n.type === 'attribute' && n.name === attributeName
    ) || null;
}

const updateLogicReasoningResult = (result: any) => {
    const newNodes: GraphNode[] = [];
    const newEdges: GraphEdge[] = [];
    
    // 处理业务规则
    if (result.businessRules && Array.isArray(result.businessRules)) {
        result.businessRules.forEach((rule: any, index: number) => {
            // 检查重复规则
            const existingRule = ontologyGraph.value.nodes.find(n => 
                n.type === 'logic' && 
                n.rule?.condition === rule.condition && 
                n.rule?.action === rule.action
            );
            
            if (existingRule) {
                console.log(`规则 "${rule.name}" 已存在，跳过`);
                return;
            }
            
            const nodeId = `logic-rule-${rule.name || `rule${index}`}-${Date.now()}`;
            const ruleNode: GraphNode = {
                id: nodeId,
                name: rule.name || `规则${index+1}`,
                type: 'logic',
                layer: 'logic',
                rule: rule,
                attributes: [],
                description: rule.description || `条件: ${rule.condition} → 动作: ${rule.action}`,
                size: 18,
                color: '#4CAF50',
                label: rule.name || `规则${index+1}`,
                reasoningStage: 'logic',
                priority: rule.priority
            };
            newNodes.push(ruleNode);
            
            // 创建与相关实体的连接
            if (rule.relatedEntities && Array.isArray(rule.relatedEntities)) {
                rule.relatedEntities.forEach((entityName: string) => {
                    const entityNode = ontologyGraph.value.nodes.find(n => 
                        n.type === 'data' && n.name === entityName
                    );
                    if (entityNode) {
                        newEdges.push({
                            id: `edge-entity-rule-${entityName}-${index}-${Date.now()}`,
                            source: entityNode.id,
                            target: nodeId,
                            type: 'used_in_rule',
                            layer: 'logic',
                            label: '用于规则',
                            description: `实体${entityName}用于规则${rule.name}`,
                            color: '#4CAF50',
                            width: 1.5,
                            dashes: [3, 3],
                            markerEnd: 'url(#arrowhead)',
                            reasoningStage: 'logic'
                        });
                    }
                });
            }
            
            // 创建与相关属性的连接
            if (rule.relatedAttributes && Array.isArray(rule.relatedAttributes)) {
                rule.relatedAttributes.forEach((attrName: string) => {
                    const attrNode = findAttributeNode(attrName);
                    if (attrNode) {
                        newEdges.push({
                            id: `edge-attr-rule-${attrName}-${index}-${Date.now()}`,
                            source: attrNode.id,
                            target: nodeId,
                            type: 'affects_rule',
                            layer: 'logic',
                            label: '影响规则',
                            description: `属性${attrName}影响规则${rule.name}`,
                            color: '#9C27B0',
                            width: 1.5,
                            dashes: [2, 2],
                            markerEnd: 'url(#arrowhead)',
                            reasoningStage: 'logic'
                        });
                    }
                });
            }
        });
    }
    
    // 处理业务约束
    if (result.businessConstraints && Array.isArray(result.businessConstraints)) {
        result.businessConstraints.forEach((constraint: any, index: number) => {
            const nodeId = `logic-constraint-${index}-${Date.now()}`;
            const constraintNode: GraphNode = {
                id: nodeId,
                name: constraint.entity ? `约束-${constraint.entity}` : `约束${index+1}`,
                type: 'logic',
                layer: 'logic',
                constraint: constraint,
                attributes: [],
                description: constraint.description || `约束: ${constraint.constraint}`,
                size: 16,
                color: '#4CAF50',
                label: constraint.entity ? `约束-${constraint.entity}` : `约束${index+1}`,
                reasoningStage: 'logic',
                severity: constraint.severity
            };
            newNodes.push(constraintNode);
            
            // 连接到相关实体
            if (constraint.entity) {
                const entityNode = ontologyGraph.value.nodes.find(n => 
                    n.type === 'data' && n.name === constraint.entity
                );
                if (entityNode) {
                    newEdges.push({
                        id: `edge-constraint-${constraint.entity}-${index}-${Date.now()}`,
                        source: entityNode.id,
                        target: nodeId,
                        type: 'has_constraint',
                        layer: 'logic',
                        label: '有约束',
                        description: constraint.description || `约束: ${constraint.constraint}`,
                        color: '#4CAF50',
                        width: 1.5,
                        dashes: [5, 5],
                        markerEnd: 'url(#arrowhead)',
                        reasoningStage: 'logic'
                    });
                }
            }
        });
    }
    
    updateGraphWithIncrementalData(newNodes, newEdges);
}

const updateDecisionReasoningResult = (result: any) => {
    const newNodes: GraphNode[] = [];
    const newEdges: GraphEdge[] = [];
    
    // 处理决策规则
    if (result.decisionRules && Array.isArray(result.decisionRules)) {
        result.decisionRules.forEach((rule: any, index: number) => {
            // 检查重复决策规则
            const existingDecision = ontologyGraph.value.nodes.find(n => 
                n.type === 'decision' && 
                n.rule?.condition === rule.condition && 
                n.rule?.decision === rule.decision
            );
            
            if (existingDecision) {
                console.log(`决策规则 "${rule.name}" 已存在，跳过`);
                return;
            }
            
            const nodeId = `decision-rule-${rule.name || `decision${index}`}-${Date.now()}`;
            const decisionNode: GraphNode = {
                id: nodeId,
                name: rule.name || `决策${index+1}`,
                type: 'decision',
                layer: 'decision',
                rule: rule,
                attributes: [],
                description: rule.description || `条件: ${rule.condition} → 决策: ${rule.decision}`,
                size: 20,
                color: '#FF9800',
                label: rule.name || `决策${index+1}`,
                reasoningStage: 'decision',
                priority: rule.priority,
                confidence: rule.confidence
            };
            newNodes.push(decisionNode);
            
            // 连接到相关实体
            if (rule.relatedEntities && Array.isArray(rule.relatedEntities)) {
                rule.relatedEntities.forEach((entityName: string) => {
                    const entityNode = ontologyGraph.value.nodes.find(n => 
                        n.type === 'data' && n.name === entityName
                    );
                    if (entityNode) {
                        newEdges.push({
                            id: `edge-entity-decision-${entityName}-${index}-${Date.now()}`,
                            source: entityNode.id,
                            target: nodeId,
                            type: 'affects_decision',
                            layer: 'decision',
                            label: '影响决策',
                            description: `实体${entityName}影响决策${rule.name}`,
                            color: '#FF9800',
                            width: 1.5,
                            dashes: [3, 3],
                            markerEnd: 'url(#arrowhead)',
                            reasoningStage: 'decision'
                        });
                    }
                });
            }
            
            // 连接到相关规则
            if (rule.relatedRules && Array.isArray(rule.relatedRules)) {
                rule.relatedRules.forEach((ruleName: string) => {
                    const logicNode = ontologyGraph.value.nodes.find(n => 
                        n.type === 'logic' && n.name === ruleName
                    );
                    if (logicNode) {
                        newEdges.push({
                            id: `edge-rule-decision-${ruleName}-${index}-${Date.now()}`,
                            source: logicNode.id,
                            target: nodeId,
                            type: 'leads_to_decision',
                            layer: 'decision',
                            label: '导向决策',
                            description: `规则${ruleName}导向决策${rule.name}`,
                            color: '#4CAF50',
                            width: 2,
                            markerEnd: 'url(#arrowhead)',
                            reasoningStage: 'decision'
                        });
                    }
                });
            }
        });
    }
    
    // 处理策略
    if (result.strategies && Array.isArray(result.strategies)) {
        result.strategies.forEach((strategy: any, index: number) => {
            const nodeId = `decision-strategy-${strategy.name || `strategy${index}`}-${Date.now()}`;
            const strategyNode: GraphNode = {
                id: nodeId,
                name: strategy.name || `策略${index+1}`,
                type: 'decision',
                layer: 'decision',
                strategy: strategy,
                attributes: [],
                description: strategy.description || `策略: ${strategy.actions?.join(' → ') || '未定义'}`,
                size: 22,
                color: '#FF9800',
                label: strategy.name || `策略${index+1}`,
                reasoningStage: 'decision'
            };
            newNodes.push(strategyNode);
        });
    }
    
    updateGraphWithIncrementalData(newNodes, newEdges);
}

// 检查重复节点的辅助函数
const checkDuplicateNode = (newNode: GraphNode, existingNodes: GraphNode[]): boolean => {
    // 对于数据实体，检查名称和类型
    if (newNode.type === 'data') {
        return existingNodes.some(n => 
            n.type === 'data' && 
            n.name === newNode.name &&
            n.entityType === newNode.entityType
        );
    }
    
    // 对于逻辑规则，检查条件和动作
    if (newNode.type === 'logic' && newNode.rule) {
        return existingNodes.some(n => 
            n.type === 'logic' && 
            n.rule?.condition === newNode.rule?.condition &&
            n.rule?.action === newNode.rule?.action
        );
    }
    
    // 对于决策规则，检查条件和决策
    if (newNode.type === 'decision' && newNode.rule) {
        return existingNodes.some(n => 
            n.type === 'decision' && 
            n.rule?.condition === newNode.rule?.condition &&
            n.rule?.decision === newNode.rule?.decision
        );
    }
    
    // 对于属性节点，检查名称和父节点
    if (newNode.type === 'attribute') {
        return existingNodes.some(n => 
            n.type === 'attribute' && 
            n.name === newNode.name &&
            n.parentNode === newNode.parentNode
        );
    }
    
    return false;
}

// 检查重复边的辅助函数
const checkDuplicateEdge = (newEdge: GraphEdge, existingEdges: GraphEdge[]): boolean => {
    const sourceId = typeof newEdge.source === 'object' ? (newEdge.source as GraphNode).id : newEdge.source;
    const targetId = typeof newEdge.target === 'object' ? (newEdge.target as GraphNode).id : newEdge.target;
    
    return existingEdges.some(e => {
        const existingSourceId = typeof e.source === 'object' ? (e.source as GraphNode).id : e.source;
        const existingTargetId = typeof e.target === 'object' ? (e.target as GraphNode).id : e.target;
        
        return existingSourceId === sourceId && 
               existingTargetId === targetId && 
               e.type === newEdge.type;
    });
}

const updateGraphWithIncrementalData = (newNodes: GraphNode[], newEdges: GraphEdge[]) => {
    // 在追加模式下，过滤掉重复的节点
    const uniqueNewNodes = ontologyState.value.buildMode === 'append' 
        ? newNodes.filter(newNode => !checkDuplicateNode(newNode, ontologyGraph.value.nodes))
        : newNodes;
    
    // 过滤掉重复的边
    const uniqueNewEdges = newEdges.filter(newEdge => !checkDuplicateEdge(newEdge, ontologyGraph.value.edges));
    
    console.log(`新增节点: ${uniqueNewNodes.length}, 新增边: ${uniqueNewEdges.length}`);
    
    if (uniqueNewNodes.length === 0 && uniqueNewEdges.length === 0) {
        console.log('没有新的节点或边需要添加');
        return;
    }
    
    const allNodes = ontologyState.value.buildMode === 'replace' 
        ? uniqueNewNodes 
        : [...ontologyGraph.value.nodes, ...uniqueNewNodes];
    
    const allEdges = ontologyState.value.buildMode === 'replace'
        ? uniqueNewEdges
        : [...ontologyGraph.value.edges, ...uniqueNewEdges];
    
    ontologyGraph.value = {
        nodes: allNodes,
        edges: allEdges,
        version: ontologyGraph.value.version + 1,
        layers: {
            data: { 
                nodes: allNodes.filter(n => n.layer === 'data'), 
                edges: allEdges.filter(e => e.layer === 'data') 
            },
            logic: { 
                nodes: allNodes.filter(n => n.layer === 'logic'), 
                edges: allEdges.filter(e => e.layer === 'logic') 
            },
            decision: { 
                nodes: allNodes.filter(n => n.layer === 'decision'), 
                edges: allEdges.filter(e => e.layer === 'decision') 
            },
            attribute: {
                nodes: allNodes.filter(n => n.layer === 'attribute'),
                edges: allEdges.filter(e => e.layer === 'attribute')
            },
            all: { nodes: allNodes, edges: allEdges }
        }
    };
    
    renderD3Graph();
}

const generate = async function () {
    if (input.value.trim() === '') return
    
    if (!store.AIconfig.llm.online) {
        try {
            await store.getAIconfig()
            if (!store.AIconfig.llm.online) {
                alert(store.locales === 'zh' ? '模型连接失败，请检查配置！' : 'Model connection failed, please check configuration!')
                return
            }
        } catch (error) {
            console.error('模型连接检查失败:', error)
            alert(store.locales === 'zh' ? '模型连接检查失败！' : 'Model connection check failed!')
            return
            }
        }
    
    if (!config.value.selectedModel && store.AIconfig.llm.type !== 'anthropic') {
        alert(store.locales === 'zh' ? '请先选择一个模型！' : 'Please select a model first!')
        return
    }
    
    const userInput = input.value;
    
    ontologyState.value.isBuilding = true;
    ontologyState.value.buildingStep = 1;
    ontologyState.value.currentResponse = '正在构建本体...';
    ontologyState.value.showNodeDetail = false;
    
    try {
        const systemPrompt = buildSystemPrompt();
        
        await store.sendToAI(
            [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: `构建模式：${ontologyState.value.buildMode === 'replace' ? '重新构建（替换现有本体）' : '增量构建（追加到现有本体）'}
        用户输入：${userInput}`
                }
            ],
            {
                onStream: (chunk: string) => {
                    ontologyState.value.currentResponse += chunk;
                },
                onComplete: (fullContent: string) => {
                    ontologyState.value.currentResponse = fullContent;
                    parseAndUpdateOntology(fullContent, userInput);
                    ontologyState.value.isBuilding = false;
                    ontologyState.value.buildingStep = 0;
                },
                onError: (error: Error) => {
                    ontologyState.value.currentResponse = "抱歉，本体构建失败，请重试";
                    console.error("本体构建错误:", error)
                    ontologyState.value.isBuilding = false;
                    ontologyState.value.buildingStep = 0;
                }
            }
        )
    } catch (error) {
        ontologyState.value.currentResponse = "抱歉，请求失败，请重试";
        console.error("Chat error:", error)
        ontologyState.value.isBuilding = false;
        ontologyState.value.buildingStep = 0;
    }
}

const stop = async function () {
    ontologyState.value.currentResponse = '已停止';
    ontologyState.value.isBuilding = false;
    ontologyState.value.buildingStep = 0;
    ontologyState.value.autoReasoningStage = 'none';
}

const parseAndUpdateOntology = (response: string, userInput: string) => {
    try {
        const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                         response.match(/```\n([\s\S]*?)\n```/) ||
                         response.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
            console.warn('未找到JSON格式的本体数据');
            return;
        }
        
        const jsonStr = jsonMatch[0].replace(/```json\n|```\n|```/g, '');
        const ontologyData = JSON.parse(jsonStr);
        
        console.log('解析到的本体数据:', ontologyData);
        updateOntologyGraph(ontologyData, userInput);
        
    } catch (error) {
        console.error('解析本体数据失败:', error, response);
    }
}

const createAttributeNodes = (entity: any, entityNode: GraphNode, newNodes: GraphNode[], newEdges: GraphEdge[], index: number) => {
    if (entity.attributes && Array.isArray(entity.attributes)) {
        entity.attributes.forEach((attr: any, attrIndex: number) => {
            const attrName = typeof attr === 'string' ? attr : attr.name;
            
            // 检查重复属性
            const existingAttribute = ontologyGraph.value.nodes.find(n => 
                n.type === 'attribute' && 
                n.name === attrName &&
                n.parentNode === entityNode.id
            );
            
            if (existingAttribute && ontologyState.value.buildMode === 'append') {
                console.log(`属性 "${attrName}" 已存在于实体 "${entity.name}"，跳过`);
                return;
            }
            
            const attrId = `attr-${entity.id || entity.name}-${attrName || attrIndex}-${Date.now()}`;
            
            const attributeNode: GraphNode = {
                id: attrId,
                name: attrName,
                type: 'attribute',
                layer: 'attribute',
                attributes: [],
                description: typeof attr === 'string' ? `属性: ${attr}` : `属性: ${attr.name} (${attr.type}) - ${attr.description || '无描述'}`,
                entityType: typeof attr === 'string' ? 'property' : attr.type,
                size: 10,
                color: '#9C27B0',
                label: attrName,
                parentNode: entityNode.id
            };
            newNodes.push(attributeNode);
            
            // 属性到实体的有向边
            const edgeId = `edge-attr-${entity.id || entity.name}-${attrIndex}-${Date.now()}`;
            if (!checkDuplicateEdge({
                id: edgeId,
                source: attrId,
                target: entityNode.id,
                type: 'belongs_to',
                layer: 'attribute',
                label: '属于',
                description: `属性${attrName}属于实体${entity.name}`,
                color: '#9C27B0',
                width: 1.5,
                markerEnd: 'url(#arrowhead)'
            }, newEdges)) {
                newEdges.push({
                    id: edgeId,
                    source: attrId,
                    target: entityNode.id,
                    type: 'belongs_to',
                    layer: 'attribute',
                    label: '属于',
                    description: `属性${attrName}属于实体${entity.name}`,
                    color: '#9C27B0',
                    width: 1.5,
                    markerEnd: 'url(#arrowhead)'
                });
            }
        });
    }
}

const createRuleEdges = (ruleNode: GraphNode, ruleData: any, newNodes: GraphNode[], newEdges: GraphEdge[], index: number) => {
    if (ruleData.relatedEntities && Array.isArray(ruleData.relatedEntities)) {
        ruleData.relatedEntities.forEach((entityName: string, relIndex: number) => {
            const entityNode = newNodes.find(n => n.name === entityName) || 
                             ontologyGraph.value.nodes.find(n => n.name === entityName);
            if (entityNode) {
                const edgeId = `edge-entity-rule-${index}-${relIndex}-${Date.now()}`;
                if (!checkDuplicateEdge({
                    id: edgeId,
                    source: entityNode.id,
                    target: ruleNode.id,
                    type: 'used_in_rule',
                    layer: 'logic',
                    label: '用于规则',
                    description: `实体${entityName}用于规则${ruleData.id || ruleData.name}`,
                    color: '#4CAF50',
                    width: 1.5,
                    dashes: [3, 3],
                    markerEnd: 'url(#arrowhead)'
                }, newEdges)) {
                    newEdges.push({
                        id: edgeId,
                        source: entityNode.id,
                        target: ruleNode.id,
                        type: 'used_in_rule',
                        layer: 'logic',
                        label: '用于规则',
                        description: `实体${entityName}用于规则${ruleData.id || ruleData.name}`,
                        color: '#4CAF50',
                        width: 1.5,
                        dashes: [3, 3],
                        markerEnd: 'url(#arrowhead)'
                    });
                }
            }
        });
    }
    
    if (ruleData.relatedAttributes && Array.isArray(ruleData.relatedAttributes)) {
        ruleData.relatedAttributes.forEach((attrName: string, attrIndex: number) => {
            const attrNode = newNodes.find(n => 
                n.type === 'attribute' && 
                (n.name === attrName || n.label === attrName)
            ) || ontologyGraph.value.nodes.find(n => 
                n.type === 'attribute' && 
                (n.name === attrName || n.label === attrName)
            );
            if (attrNode) {
                const edgeId = `edge-attr-rule-${index}-${attrIndex}-${Date.now()}`;
                if (!checkDuplicateEdge({
                    id: edgeId,
                    source: attrNode.id,
                    target: ruleNode.id,
                    type: 'affects_rule',
                    layer: 'logic',
                    label: '影响规则',
                    description: `属性${attrName}影响规则${ruleData.id || ruleData.name}`,
                    color: '#9C27B0',
                    width: 1.5,
                    dashes: [2, 2],
                    markerEnd: 'url(#arrowhead)'
                }, newEdges)) {
                    newEdges.push({
                        id: edgeId,
                        source: attrNode.id,
                        target: ruleNode.id,
                        type: 'affects_rule',
                        layer: 'logic',
                        label: '影响规则',
                        description: `属性${attrName}影响规则${ruleData.id || ruleData.name}`,
                        color: '#9C27B0',
                        width: 1.5,
                        dashes: [2, 2],
                        markerEnd: 'url(#arrowhead)'
                    });
                }
            }
        });
    }
}

const createDecisionEdges = (decisionNode: GraphNode, decisionData: any, newNodes: GraphNode[], newEdges: GraphEdge[], index: number) => {
    if (decisionData.relatedEntities && Array.isArray(decisionData.relatedEntities)) {
        decisionData.relatedEntities.forEach((entityName: string, relIndex: number) => {
            const entityNode = newNodes.find(n => n.name === entityName) || 
                             ontologyGraph.value.nodes.find(n => n.name === entityName);
            if (entityNode) {
                const edgeId = `edge-entity-decision-${index}-${relIndex}-${Date.now()}`;
                if (!checkDuplicateEdge({
                    id: edgeId,
                    source: entityNode.id,
                    target: decisionNode.id,
                    type: 'affects_decision',
                    layer: 'decision',
                    label: '影响决策',
                    description: `实体${entityName}影响决策${decisionData.id || decisionData.name}`,
                    color: '#FF9800',
                    width: 1.5,
                    dashes: [3, 3],
                    markerEnd: 'url(#arrowhead)'
                }, newEdges)) {
                    newEdges.push({
                        id: edgeId,
                        source: entityNode.id,
                        target: decisionNode.id,
                        type: 'affects_decision',
                        layer: 'decision',
                        label: '影响决策',
                        description: `实体${entityName}影响决策${decisionData.id || decisionData.name}`,
                        color: '#FF9800',
                        width: 1.5,
                        dashes: [3, 3],
                        markerEnd: 'url(#arrowhead)'
                    });
                }
            }
        });
    }
    
    if (decisionData.relatedRules && Array.isArray(decisionData.relatedRules)) {
        decisionData.relatedRules.forEach((ruleId: string, ruleIndex: number) => {
            const ruleNode = newNodes.find(n => 
                n.type === 'logic' && 
                (n.rule?.id === ruleId || n.name === ruleId)
            ) || ontologyGraph.value.nodes.find(n => 
                n.type === 'logic' && 
                (n.rule?.id === ruleId || n.name === ruleId)
            );
            if (ruleNode) {
                const edgeId = `edge-rule-decision-${index}-${ruleIndex}-${Date.now()}`;
                if (!checkDuplicateEdge({
                    id: edgeId,
                    source: ruleNode.id,
                    target: decisionNode.id,
                    type: 'leads_to_decision',
                    layer: 'decision',
                    label: '导向决策',
                    description: `规则${ruleId}导向决策${decisionData.id || decisionData.name}`,
                    color: '#4CAF50',
                    width: 2,
                    markerEnd: 'url(#arrowhead)'
                }, newEdges)) {
                    newEdges.push({
                        id: edgeId,
                        source: ruleNode.id,
                        target: decisionNode.id,
                        type: 'leads_to_decision',
                        layer: 'decision',
                        label: '导向决策',
                        description: `规则${ruleId}导向决策${decisionData.id || decisionData.name}`,
                        color: '#4CAF50',
                        width: 2,
                        markerEnd: 'url(#arrowhead)'
                    });
                }
            }
        });
    }
}

const updateOntologyGraph = (ontologyData: any, userInput: string) => {
    const newNodes: GraphNode[] = [];
    const newEdges: GraphEdge[] = [];
    
    if (ontologyData.dataLayer?.entities) {
        ontologyData.dataLayer.entities.forEach((entity: any, index: number) => {
            // 检查重复实体
            const existingEntity = ontologyGraph.value.nodes.find(n => 
                n.type === 'data' && n.name === entity.name
            );
            
            if (existingEntity && ontologyState.value.buildMode === 'append') {
                console.log(`实体 "${entity.name}" 已存在，跳过`);
                return;
            }
            
            const nodeId = `data-${entity.id || entity.name}-${Date.now()}-${index}`;
            const entityNode: GraphNode = {
                id: nodeId,
                name: entity.name,
                type: 'data',
                layer: 'data',
                entityType: entity.type || 'entity',
                attributes: Array.isArray(entity.attributes) ? entity.attributes.map((a: any) => typeof a === 'string' ? a : a.name) : [],
                description: entity.description || '',
                size: 20,
                color: '#2196F3',
                label: entity.name,
                relatedRules: entity.relatedRules || [],
                relatedDecisions: entity.relatedDecisions || []
            };
            newNodes.push(entityNode);
            
            createAttributeNodes(entity, entityNode, newNodes, newEdges, index);
        });
    }
    
    if (ontologyData.dataLayer?.relationships) {
        ontologyData.dataLayer.relationships.forEach((rel: any, index: number) => {
            const sourceNode = newNodes.find(n => n.name === rel.source) || 
                             ontologyGraph.value.nodes.find(n => n.name === rel.source);
            const targetNode = newNodes.find(n => n.name === rel.target) || 
                             ontologyGraph.value.nodes.find(n => n.name === rel.target);
            
            if (sourceNode && targetNode) {
                const edgeId = `edge-data-${index}-${Date.now()}`;
                if (!checkDuplicateEdge({
                    id: edgeId,
                    source: sourceNode.id,
                    target: targetNode.id,
                    type: 'related_to',
                    layer: 'data',
                    label: rel.type,
                    description: rel.description || '',
                    color: '#2196F3',
                    width: 2,
                    markerEnd: 'url(#arrowhead)'
                }, newEdges)) {
                    newEdges.push({
                        id: edgeId,
                        source: sourceNode.id,
                        target: targetNode.id,
                        type: 'related_to',
                        layer: 'data',
                        label: rel.type,
                        description: rel.description || '',
                        color: '#2196F3',
                        width: 2,
                        markerEnd: 'url(#arrowhead)'
                    });
                }
            }
        });
    }
    
    if (ontologyData.logicLayer?.rules) {
        ontologyData.logicLayer.rules.forEach((rule: any, index: number) => {
            // 检查重复规则
            const existingRule = ontologyGraph.value.nodes.find(n => 
                n.type === 'logic' && 
                n.rule?.condition === rule.condition && 
                n.rule?.action === rule.action
            );
            
            if (existingRule && ontologyState.value.buildMode === 'append') {
                console.log(`规则 "${rule.name}" 已存在，跳过`);
                return;
            }
            
            const nodeId = `logic-rule-${rule.id || rule.name || index}-${Date.now()}`;
            const ruleNode: GraphNode = {
                id: nodeId,
                name: rule.id || rule.name || `规则${index+1}`,
                type: 'logic',
                layer: 'logic',
                rule: rule,
                attributes: [],
                description: rule.description || `条件: ${rule.condition} → 动作: ${rule.action}`,
                size: 16,
                color: '#4CAF50',
                label: rule.id || rule.name || `规则${index+1}`,
                relatedEntities: rule.relatedEntities || [],
                relatedAttributes: rule.relatedAttributes || []
            };
            newNodes.push(ruleNode);
            
            createRuleEdges(ruleNode, rule, newNodes, newEdges, index);
        });
    }
    
    if (ontologyData.logicLayer?.constraints) {
        ontologyData.logicLayer.constraints.forEach((constraint: any, index: number) => {
            const nodeId = `logic-constraint-${index}-${Date.now()}`;
            const constraintNode: GraphNode = {
                id: nodeId,
                name: `约束${index+1}`,
                type: 'logic',
                layer: 'logic',
                constraint: constraint,
                attributes: [],
                description: constraint.description || `约束: ${constraint.constraint}`,
                size: 14,
                color: '#4CAF50',
                label: `约束${index+1}`,
                relatedAttributes: constraint.relatedAttributes || []
            };
            newNodes.push(constraintNode);
            
            if (constraint.entity) {
                const entityNode = newNodes.find(n => n.name === constraint.entity) || 
                                 ontologyGraph.value.nodes.find(n => n.name === constraint.entity);
                if (entityNode) {
                    const edgeId = `edge-logic-${index}-${Date.now()}`;
                    if (!checkDuplicateEdge({
                        id: edgeId,
                        source: entityNode.id,
                        target: constraintNode.id,
                        type: 'has_constraint',
                        layer: 'logic',
                        label: '有约束',
                        description: constraint.description || `约束: ${constraint.constraint}`,
                        color: '#4CAF50',
                        width: 1.5,
                        dashes: [5, 5],
                        markerEnd: 'url(#arrowhead)'
                    }, newEdges)) {
                        newEdges.push({
                            id: edgeId,
                            source: entityNode.id,
                            target: constraintNode.id,
                            type: 'has_constraint',
                            layer: 'logic',
                            label: '有约束',
                            description: constraint.description || `约束: ${constraint.constraint}`,
                            color: '#4CAF50',
                            width: 1.5,
                            dashes: [5, 5],
                            markerEnd: 'url(#arrowhead)'
                        });
                    }
                }
            }
        });
    }
    
    if (ontologyData.decisionLayer?.decisionRules) {
        ontologyData.decisionLayer.decisionRules.forEach((rule: any, index: number) => {
            // 检查重复决策规则
            const existingDecision = ontologyGraph.value.nodes.find(n => 
                n.type === 'decision' && 
                n.rule?.condition === rule.condition && 
                n.rule?.decision === rule.decision
            );
            
            if (existingDecision && ontologyState.value.buildMode === 'append') {
                console.log(`决策规则 "${rule.name}" 已存在，跳过`);
                return;
            }
            
            const nodeId = `decision-rule-${rule.id || rule.name || index}-${Date.now()}`;
            const decisionNode: GraphNode = {
                id: nodeId,
                name: rule.id || rule.name || `决策${index+1}`,
                type: 'decision',
                layer: 'decision',
                rule: rule,
                attributes: [],
                description: rule.description || `条件: ${rule.condition} → 决策: ${rule.decision} (优先级: ${rule.priority})`,
                size: 18,
                color: '#FF9800',
                label: rule.id || rule.name || `决策${index+1}`,
                relatedEntities: rule.relatedEntities || [],
                relatedRules: rule.relatedRules || []
            };
            newNodes.push(decisionNode);
            
            createDecisionEdges(decisionNode, rule, newNodes, newEdges, index);
        });
    }
    
    if (ontologyData.decisionLayer?.strategies) {
        ontologyData.decisionLayer.strategies.forEach((strategy: any, index: number) => {
            const nodeId = `decision-strategy-${strategy.name || index}-${Date.now()}`;
            const strategyNode: GraphNode = {
                id: nodeId,
                name: strategy.name || `策略${index+1}`,
                type: 'decision',
                layer: 'decision',
                strategy: strategy,
                attributes: [],
                description: strategy.description || `策略: ${strategy.actions?.join(' → ') || '未定义行动'}`,
                size: 20,
                color: '#FF9800',
                label: strategy.name || `策略${index+1}`,
                relatedDecisions: strategy.relatedDecisions || []
            };
            newNodes.push(strategyNode);
        });
    }
    
    // 确保边中存储的是节点ID而不是对象
    const edgesWithIds = newEdges.map(edge => {
        const sourceId = typeof edge.source === 'object' ? (edge.source as GraphNode).id : edge.source;
        const targetId = typeof edge.target === 'object' ? (edge.target as GraphNode).id : edge.target;
        
        return {
            ...edge,
            source: sourceId,
            target: targetId
        };
    });
    
    updateGraphWithIncrementalData(newNodes, edgesWithIds);
}

// ========== 手动添加节点功能 ==========
const toggleManualPanel = () => {
    ontologyState.value.showManualPanel = !ontologyState.value.showManualPanel;
    if (ontologyState.value.showManualPanel) {
        resetManualInput();
    }
}

const resetManualInput = () => {
    manualInput.value = {
        nodeType: 'data',
        nodeName: '',
        nodeDescription: '',
        attributes: [''],
        entityType: '',
        ruleCondition: '',
        ruleAction: '',
        ruleDecision: '',
        rulePriority: 'medium',
        constraintText: '',
        strategyActions: [''],
        selectedLayer: 'data',
        sourceNode: '',
        targetNode: '',
        edgeType: 'related_to',
        edgeDescription: '',
        connectingNodes: false
    };
}

const addAttributeField = () => {
    manualInput.value.attributes.push('');
}

const removeAttributeField = (index: number) => {
    if (manualInput.value.attributes.length > 1) {
        manualInput.value.attributes.splice(index, 1);
    }
}

const addStrategyActionField = () => {
    manualInput.value.strategyActions.push('');
}

const removeStrategyActionField = (index: number) => {
    if (manualInput.value.strategyActions.length > 1) {
        manualInput.value.strategyActions.splice(index, 1);
    }
}

const createManualNode = () => {
    if (!manualInput.value.nodeName.trim()) {
        alert(store.locales === 'zh' ? '请输入节点名称！' : 'Please enter node name!');
        return;
    }
    
    // 检查重复节点
    const existingNode = ontologyGraph.value.nodes.find(n => {
        if (n.name === manualInput.value.nodeName && n.type === manualInput.value.nodeType) {
            if (n.type === 'data' && n.entityType === manualInput.value.entityType) return true;
            if (n.type === 'logic' && n.rule?.condition === manualInput.value.ruleCondition) return true;
            if (n.type === 'decision' && n.rule?.condition === manualInput.value.ruleCondition) return true;
            if (n.type === 'attribute') {
                // 对于属性，还需要检查父节点
                return n.parentNode === manualInput.value.targetNode;
            }
        }
        return false;
    });
    
    if (existingNode) {
        alert(store.locales === 'zh' ? '该节点已存在！' : 'This node already exists!');
        return;
    }
    
    const nodeId = `manual-${manualInput.value.nodeType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const filteredAttributes = manualInput.value.attributes.filter(attr => attr.trim() !== '');
    
    let nodeColor = '#2196F3';
    let nodeSize = 20;
    let description = manualInput.value.nodeDescription || '';
    
    // 根据节点类型设置颜色和大小
    switch (manualInput.value.nodeType) {
        case 'data':
            nodeColor = '#2196F3';
            nodeSize = 20;
            description = manualInput.value.nodeDescription || `数据实体: ${manualInput.value.nodeName}`;
            if (manualInput.value.entityType) {
                description += ` (${manualInput.value.entityType})`;
            }
            break;
        case 'logic':
            nodeColor = '#4CAF50';
            nodeSize = 16;
            if (manualInput.value.ruleCondition || manualInput.value.ruleAction) {
                description = manualInput.value.nodeDescription || 
                    `规则: ${manualInput.value.ruleCondition} → ${manualInput.value.ruleAction}`;
            } else if (manualInput.value.constraintText) {
                description = manualInput.value.nodeDescription || 
                    `约束: ${manualInput.value.constraintText}`;
            } else {
                description = manualInput.value.nodeDescription || `逻辑节点: ${manualInput.value.nodeName}`;
            }
            break;
        case 'decision':
            nodeColor = '#FF9800';
            nodeSize = 18;
            if (manualInput.value.ruleCondition || manualInput.value.ruleDecision) {
                description = manualInput.value.nodeDescription || 
                    `决策规则: ${manualInput.value.ruleCondition} → ${manualInput.value.ruleDecision}`;
            } else if (manualInput.value.strategyActions.length > 0) {
                description = manualInput.value.nodeDescription || 
                    `策略: ${manualInput.value.strategyActions.filter(a => a.trim()).join(' → ')}`;
            } else {
                description = manualInput.value.nodeDescription || `决策节点: ${manualInput.value.nodeName}`;
            }
            break;
        case 'attribute':
            nodeColor = '#9C27B0';
            nodeSize = 12;
            description = manualInput.value.nodeDescription || `属性: ${manualInput.value.nodeName}`;
            break;
    }
    
    const newNode: GraphNode = {
        id: nodeId,
        name: manualInput.value.nodeName,
        type: manualInput.value.nodeType,
        layer: manualInput.value.selectedLayer,
        attributes: filteredAttributes,
        description: description,
        size: nodeSize,
        color: nodeColor,
        label: manualInput.value.nodeName,
        userInput: '手动添加'
    };
    
    // 添加特定类型的数据
    if (manualInput.value.nodeType === 'data') {
        newNode.entityType = manualInput.value.entityType;
    } else if (manualInput.value.nodeType === 'logic') {
        if (manualInput.value.ruleCondition || manualInput.value.ruleAction) {
            newNode.rule = {
                condition: manualInput.value.ruleCondition,
                action: manualInput.value.ruleAction
            };
        }
        if (manualInput.value.constraintText) {
            newNode.constraint = {
                constraint: manualInput.value.constraintText
            };
        }
    } else if (manualInput.value.nodeType === 'decision') {
        if (manualInput.value.ruleCondition || manualInput.value.ruleDecision) {
            newNode.rule = {
                condition: manualInput.value.ruleCondition,
                decision: manualInput.value.ruleDecision,
                priority: manualInput.value.rulePriority
            };
        }
        if (manualInput.value.strategyActions.length > 0) {
            newNode.strategy = {
                actions: manualInput.value.strategyActions.filter(a => a.trim())
            };
        }
    } else if (manualInput.value.nodeType === 'attribute') {
        newNode.parentNode = manualInput.value.targetNode;
    }
    
    // 添加到图谱
    ontologyGraph.value.nodes.push(newNode);
    ontologyGraph.value.version += 1;
    
    // 更新图层数据
    ontologyGraph.value.layers[newNode.layer].nodes.push(newNode);
    ontologyGraph.value.layers.all.nodes.push(newNode);
    
    // 如果是属性节点，创建连接到父实体的边
    if (manualInput.value.nodeType === 'attribute' && manualInput.value.targetNode) {
        const edgeId = `manual-edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newEdge: GraphEdge = {
            id: edgeId,
            source: nodeId,
            target: manualInput.value.targetNode,
            type: 'belongs_to',
            layer: 'attribute',
            label: '属于',
            description: `属性${manualInput.value.nodeName}属于实体`,
            color: '#9C27B0',
            width: 1.5,
            markerEnd: 'url(#arrowhead)'
        };
        ontologyGraph.value.edges.push(newEdge);
        ontologyGraph.value.layers.attribute.edges.push(newEdge);
        ontologyGraph.value.layers.all.edges.push(newEdge);
    }
    
    // 重置输入
    resetManualInput();
    
    // 重新渲染图谱
    renderD3Graph();
    
    alert(store.locales === 'zh' ? '节点添加成功！' : 'Node added successfully!');
}

const createManualEdge = () => {
    if (!manualInput.value.sourceNode || !manualInput.value.targetNode) {
        alert(store.locales === 'zh' ? '请选择源节点和目标节点！' : 'Please select source and target nodes!');
        return;
    }
    
    // 检查重复边
    const existingEdge = ontologyGraph.value.edges.find(e => {
        const sourceId = typeof e.source === 'object' ? (e.source as GraphNode).id : e.source;
        const targetId = typeof e.target === 'object' ? (e.target as GraphNode).id : e.target;
        return sourceId === manualInput.value.sourceNode && 
               targetId === manualInput.value.targetNode &&
               e.type === manualInput.value.edgeType;
    });
    
    if (existingEdge) {
        alert(store.locales === 'zh' ? '该边已存在！' : 'This edge already exists!');
        return;
    }
    
    const sourceNode = ontologyGraph.value.nodes.find(n => n.id === manualInput.value.sourceNode);
    const targetNode = ontologyGraph.value.nodes.find(n => n.id === manualInput.value.targetNode);
    
    if (!sourceNode || !targetNode) {
        alert(store.locales === 'zh' ? '选择的节点不存在！' : 'Selected nodes do not exist!');
        return;
    }
    
    // 确定边的层级（取源节点和目标节点的层级中较高的一个）
    const layerOrder = { 'attribute': 1, 'data': 2, 'logic': 3, 'decision': 4 };
    const sourceLayer = layerOrder[sourceNode.layer as keyof typeof layerOrder] || 0;
    const targetLayer = layerOrder[targetNode.layer as keyof typeof layerOrder] || 0;
    const edgeLayer = sourceLayer >= targetLayer ? sourceNode.layer : targetNode.layer;
    
    // 根据连接类型确定边的颜色
    let edgeColor = '#999';
    if (sourceNode.type === 'attribute' && targetNode.type === 'data') {
        edgeColor = '#9C27B0'; // 属性到实体
    } else if (sourceNode.type === 'data' && targetNode.type === 'logic') {
        edgeColor = '#2196F3'; // 实体到逻辑
    } else if (sourceNode.type === 'logic' && targetNode.type === 'decision') {
        edgeColor = '#4CAF50'; // 逻辑到决策
    } else if (sourceNode.type === 'attribute' && targetNode.type === 'logic') {
        edgeColor = '#9C27B0'; // 属性到逻辑
    } else if (sourceNode.type === 'data' && targetNode.type === 'decision') {
        edgeColor = '#2196F3'; // 实体到决策
    }
    
    const edgeId = `manual-edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newEdge: GraphEdge = {
        id: edgeId,
        source: manualInput.value.sourceNode,
        target: manualInput.value.targetNode,
        type: manualInput.value.edgeType,
        layer: edgeLayer as any,
        label: manualInput.value.edgeType.replace('_', ' '),
        description: manualInput.value.edgeDescription || `${sourceNode.name} → ${targetNode.name}`,
        color: edgeColor,
        width: 2,
        markerEnd: 'url(#arrowhead)'
    };
    
    // 添加到图谱
    ontologyGraph.value.edges.push(newEdge);
    ontologyGraph.value.version += 1;
    
    // 更新图层数据
    ontologyGraph.value.layers[edgeLayer].edges.push(newEdge);
    ontologyGraph.value.layers.all.edges.push(newEdge);
    
    // 重置连接状态
    manualInput.value.connectingNodes = false;
    manualInput.value.sourceNode = '';
    manualInput.value.targetNode = '';
    
    // 重新渲染图谱
    renderD3Graph();
    
    alert(store.locales === 'zh' ? '边添加成功！' : 'Edge added successfully!');
}

const startConnectingNodes = () => {
    manualInput.value.connectingNodes = true;
    alert(store.locales === 'zh' ? '请在图谱中选择源节点和目标节点' : 'Please select source and target nodes on the graph');
}

const selectNodeForConnection = (nodeId: string) => {
    if (!manualInput.value.connectingNodes) return;
    
    if (!manualInput.value.sourceNode) {
        manualInput.value.sourceNode = nodeId;
        alert(store.locales === 'zh' ? `已选择源节点: ${nodeId}` : `Source node selected: ${nodeId}`);
    } else if (!manualInput.value.targetNode) {
        manualInput.value.targetNode = nodeId;
        alert(store.locales === 'zh' ? `已选择目标节点: ${nodeId}` : `Target node selected: ${nodeId}`);
    }
}

// ========== 节点编辑功能 ==========
const editNode = (node: GraphNode) => {
    ontologyState.value.editingNode = JSON.parse(JSON.stringify(node));
    ontologyState.value.showNodeDetail = true;
}

const saveNodeChanges = () => {
    if (!ontologyState.value.editingNode) return;
    
    // 找到并更新节点
    const index = ontologyGraph.value.nodes.findIndex(n => n.id === ontologyState.value.editingNode!.id);
    if (index !== -1) {
        // 更新图层数据
        const oldLayer = ontologyGraph.value.nodes[index].layer;
        const newLayer = ontologyState.value.editingNode.layer;
        
        if (oldLayer !== newLayer) {
            // 从旧图层移除
            ontologyGraph.value.layers[oldLayer].nodes = ontologyGraph.value.layers[oldLayer].nodes.filter(
                n => n.id !== ontologyState.value.editingNode!.id
            );
            // 添加到新图层
            ontologyGraph.value.layers[newLayer].nodes.push(ontologyState.value.editingNode);
        } else {
            // 更新图层中的节点
            const layerIndex = ontologyGraph.value.layers[oldLayer].nodes.findIndex(
                n => n.id === ontologyState.value.editingNode!.id
            );
            if (layerIndex !== -1) {
                ontologyGraph.value.layers[oldLayer].nodes[layerIndex] = ontologyState.value.editingNode;
            }
        }
        
        // 更新全部图层
        const allIndex = ontologyGraph.value.layers.all.nodes.findIndex(
            n => n.id === ontologyState.value.editingNode!.id
        );
        if (allIndex !== -1) {
            ontologyGraph.value.layers.all.nodes[allIndex] = ontologyState.value.editingNode;
        }
        
        // 更新主节点列表
        ontologyGraph.value.nodes[index] = ontologyState.value.editingNode;
        ontologyGraph.value.version += 1;
        
        // 重新渲染图谱
        renderD3Graph();
        
        alert(store.locales === 'zh' ? '节点更新成功！' : 'Node updated successfully!');
    }
    
    ontologyState.value.editingNode = null;
}

const cancelEdit = () => {
    ontologyState.value.editingNode = null;
}

const deleteNode = (nodeId: string) => {
    if (!confirm(store.locales === 'zh' ? '确定要删除这个节点吗？' : 'Are you sure you want to delete this node?')) {
        return;
    }
    
    // 删除节点
    const node = ontologyGraph.value.nodes.find(n => n.id === nodeId);
    if (node) {
        // 从主节点列表移除
        ontologyGraph.value.nodes = ontologyGraph.value.nodes.filter(n => n.id !== nodeId);
        
        // 从图层移除
        ontologyGraph.value.layers[node.layer].nodes = ontologyGraph.value.layers[node.layer].nodes.filter(
            n => n.id !== nodeId
        );
        
        // 从全部图层移除
        ontologyGraph.value.layers.all.nodes = ontologyGraph.value.layers.all.nodes.filter(
            n => n.id !== nodeId
        );
        
        // 删除相关的边
        ontologyGraph.value.edges = ontologyGraph.value.edges.filter(e => {
            const sourceId = typeof e.source === 'object' ? (e.source as GraphNode).id : e.source;
            const targetId = typeof e.target === 'object' ? (e.target as GraphNode).id : e.target;
            return sourceId !== nodeId && targetId !== nodeId;
        });
        
        // 更新图层中的边
        Object.keys(ontologyGraph.value.layers).forEach(layer => {
            if (layer !== 'all') {
                ontologyGraph.value.layers[layer].edges = ontologyGraph.value.layers[layer].edges.filter(e => {
                    const sourceId = typeof e.source === 'object' ? (e.source as GraphNode).id : e.source;
                    const targetId = typeof e.target === 'object' ? (e.target as GraphNode).id : e.target;
                    return sourceId !== nodeId && targetId !== nodeId;
                });
            }
        });
        
        // 更新全部图层中的边
        ontologyGraph.value.layers.all.edges = ontologyGraph.value.layers.all.edges.filter(e => {
            const sourceId = typeof e.source === 'object' ? (e.source as GraphNode).id : e.source;
            const targetId = typeof e.target === 'object' ? (e.target as GraphNode).id : e.target;
            return sourceId !== nodeId && targetId !== nodeId;
        });
        
        ontologyGraph.value.version += 1;
        
        // 重新渲染图谱
        renderD3Graph();
        
        alert(store.locales === 'zh' ? '节点删除成功！' : 'Node deleted successfully!');
    }
}

// ========== 文件导入导出功能 ==========
const exportOntology = () => {
    if (ontologyGraph.value.nodes.length === 0) {
        alert(store.locales === 'zh' ? '没有本体数据可以导出！' : 'No ontology data to export!');
        return;
    }
    
    const exportData = {
        metadata: {
            exportDate: new Date().toISOString(),
            version: ontologyGraph.value.version,
            nodeCount: ontologyGraph.value.nodes.length,
            edgeCount: ontologyGraph.value.edges.length
        },
        graph: {
            nodes: ontologyGraph.value.nodes,
            edges: ontologyGraph.value.edges
        },
        layers: ontologyGraph.value.layers,
        customPrompt: ontologyState.value.customPrompt
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `ontology-export-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    alert(store.locales === 'zh' ? '本体数据导出成功！' : 'Ontology data exported successfully!');
}

const importOntology = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    
    const file = input.files[0];
    const reader = new FileReader();
    
    reader.onload = (e) => {
        try {
            const content = e.target?.result as string;
            const importData = JSON.parse(content);
            
            if (!importData.graph || !importData.graph.nodes || !importData.graph.edges) {
                alert(store.locales === 'zh' ? '无效的本体文件格式！' : 'Invalid ontology file format!');
                return;
            }
            
            // 确认导入
            if (!confirm(store.locales === 'zh' ? 
                `确定要导入本体数据吗？\n节点数量: ${importData.graph.nodes.length}\n边数量: ${importData.graph.edges.length}` : 
                `Are you sure you want to import ontology data?\nNodes: ${importData.graph.nodes.length}\nEdges: ${importData.graph.edges.length}`)) {
                return;
            }
            
            // 更新图谱数据
            ontologyGraph.value = {
                nodes: importData.graph.nodes,
                edges: importData.graph.edges,
                version: ontologyGraph.value.version + 1,
                layers: importData.layers || {
                    data: { 
                        nodes: importData.graph.nodes.filter((n: GraphNode) => n.layer === 'data'), 
                        edges: importData.graph.edges.filter((e: GraphEdge) => e.layer === 'data') 
                    },
                    logic: { 
                        nodes: importData.graph.nodes.filter((n: GraphNode) => n.layer === 'logic'), 
                        edges: importData.graph.edges.filter((e: GraphEdge) => e.layer === 'logic') 
                    },
                    decision: { 
                        nodes: importData.graph.nodes.filter((n: GraphNode) => n.layer === 'decision'), 
                        edges: importData.graph.edges.filter((e: GraphEdge) => e.layer === 'decision') 
                    },
                    attribute: {
                        nodes: importData.graph.nodes.filter((n: GraphNode) => n.layer === 'attribute'),
                        edges: importData.graph.edges.filter((e: GraphEdge) => e.layer === 'attribute')
                    },
                    all: { nodes: importData.graph.nodes, edges: importData.graph.edges }
                }
            };
            
            // 导入自定义提示词
            if (importData.customPrompt) {
                ontologyState.value.customPrompt = importData.customPrompt;
            }
            
            // 重新渲染图谱
            renderD3Graph();
            
            alert(store.locales === 'zh' ? '本体数据导入成功！' : 'Ontology data imported successfully!');
            
        } catch (error) {
            console.error('导入失败:', error);
            alert(store.locales === 'zh' ? '本体文件解析失败！' : 'Failed to parse ontology file!');
        }
    };
    
    reader.readAsText(file);
    input.value = ''; // 清空输入
}

const triggerFileInput = () => {
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    if (fileInput) fileInput.click();
}

// ========== D3.js 图谱渲染 ==========
const initD3Graph = () => {
    if (!d3Svg.value) return;
    
    const svg = d3.select(d3Svg.value);
    svg.selectAll("*").remove();
    
    // 定义箭头标记
    const defs = svg.append("defs");
    
    // 普通箭头
    defs.append("marker")
        .attr("id", "arrowhead")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 8)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#999");
    
    // 数据层箭头（蓝色）
    defs.append("marker")
        .attr("id", "arrowhead-data")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 8)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#2196F3");
    
    // 逻辑层箭头（绿色）
    defs.append("marker")
        .attr("id", "arrowhead-logic")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 8)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#4CAF50");
    
    // 决策层箭头（橙色）
    defs.append("marker")
        .attr("id", "arrowhead-decision")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 8)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#FF9800");
    
    // 属性层箭头（紫色）
    defs.append("marker")
        .attr("id", "arrowhead-attribute")
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 8)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#9C27B0");
    
    d3Zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on("zoom", (event: any) => {
            svg.select("g").attr("transform", event.transform);
        });
    
    svg.call(d3Zoom as any);
    svg.append("g");
    d3Initialized.value = true;
}

const cleanupD3Graph = () => {
    if (d3Simulation) {
        d3Simulation.stop();
        d3Simulation = null;
    }
    d3Initialized.value = false;
}

// 拖动事件处理函数
const dragstarted = (event: any, d: any) => {
    if (!event.active) d3Simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
}

const dragged = (event: any, d: any) => {
    d.fx = event.x;
    d.fy = event.y;
}

const dragended = (event: any, d: any) => {
    if (!event.active) d3Simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
}

const renderD3Graph = () => {
    nextTick(() => {
        if (!d3Svg.value) return;
        
        if (!d3Initialized.value) {
            initD3Graph();
        }
        
        const svg = d3.select(d3Svg.value);
        const g = svg.select("g");
        const width = d3Svg.value.clientWidth || 800;
        const height = d3Svg.value.clientHeight || 600;
        
        g.selectAll("*").remove();
        
        if (ontologyGraph.value.nodes.length === 0) {
            g.append("text")
                .attr("x", width / 2)
                .attr("y", height / 2)
                .attr("text-anchor", "middle")
                .attr("fill", "var(--fontColor)")
                .text(store.locales === 'zh' ? '等待构建本体...' : 'Waiting for ontology construction...')
                .style("font-size", "14px");
            return;
        }
        
        // 根据是否显示属性节点来过滤
        let filteredNodes = ontologyGraph.value.nodes;
        let filteredEdges = ontologyGraph.value.edges;
        
        if (!ontologyState.value.showAttributes) {
            filteredNodes = ontologyGraph.value.nodes.filter(n => n.type !== 'attribute');
            filteredEdges = ontologyGraph.value.edges.filter(e => e.layer !== 'attribute');
        }
        
        // 应用层级过滤
        filteredNodes = filteredNodes.filter(n => graphFilter.value.visibleLayers[n.layer]);
        
        // 创建可见节点ID集合
        const visibleNodeIds = new Set(filteredNodes.map(n => n.id));
        
        // 过滤边：只有当源节点和目标节点都可见时才显示
        filteredEdges = filteredEdges.filter(e => {
            const sourceId = typeof e.source === 'object' ? (e.source as GraphNode).id : e.source;
            const targetId = typeof e.target === 'object' ? (e.target as GraphNode).id : e.target;
            
            const sourceVisible = visibleNodeIds.has(sourceId);
            const targetVisible = visibleNodeIds.has(targetId);
            
            return sourceVisible && targetVisible;
        });
        
        // 为连线准备数据 - 找到对应的节点对象
        const nodeMap = new Map(filteredNodes.map(n => [n.id, n]));
        const processedEdges = filteredEdges.map(edge => {
            const sourceId = typeof edge.source === 'object' ? (edge.source as GraphNode).id : edge.source;
            const targetId = typeof edge.target === 'object' ? (edge.target as GraphNode).id : edge.target;
            
            const sourceNode = nodeMap.get(sourceId);
            const targetNode = nodeMap.get(targetId);
            
            if (sourceNode && targetNode) {
                return {
                    ...edge,
                    source: sourceNode,
                    target: targetNode
                };
            } else {
                console.warn(`处理连线 ${edge.id}: source=${sourceId}, target=${targetId} - 节点未找到`);
                return null;
            }
        }).filter(edge => edge !== null) as any[];
        
        // 重置节点位置属性
        filteredNodes.forEach(node => {
            // 为层次布局设置初始位置
            if (ontologyState.value.layoutMode === 'hierarchical') {
                // 根据层级设置初始X位置
                const layerXPositions = {
                    'attribute': width * 0.15,
                    'data': width * 0.35,
                    'logic': width * 0.65,
                    'decision': width * 0.85
                };
                
                const layer = node.layer as keyof typeof layerXPositions;
                const baseX = layerXPositions[layer] || width / 2;
                
                // 在层次内随机分布Y位置
                const sameLayerNodes = filteredNodes.filter(n => n.layer === node.layer);
                const nodeIndex = sameLayerNodes.findIndex(n => n.id === node.id);
                const verticalSpacing = Math.min(height * 0.7 / sameLayerNodes.length, 80);
                const baseY = height / 2 + (nodeIndex - sameLayerNodes.length / 2) * verticalSpacing;
                
                node.x = baseX //+ (Math.random() - 0.5) * 30; 
                node.y = baseY //+ (Math.random() - 0.5) * 30;
                
                // 固定位置，防止力导向移动
                node.fx = node.x;
                node.fy = node.y;
            } else {
                // 力导向布局：随机初始位置
                if (node.x === undefined || node.x === null) {
                    node.x = Math.random() * width;
                }
                if (node.y === undefined || node.y === null) {
                    node.y = Math.random() * height;
                }
                // 取消固定位置
                node.fx = null;
                node.fy = null;
            }
        });
        
        if (d3Simulation) {
            d3Simulation.stop();
        }
        
        if (ontologyState.value.layoutMode === 'force') {
            // 力导向布局
            d3Simulation = d3.forceSimulation(filteredNodes as any)
                .force("link", d3.forceLink(processedEdges)
                    .id((d: any) => d.id)
                    .distance((d: any) => {
                        if (d.type === 'belongs_to') return 60;
                        if (d.layer === 'attribute') return 80;
                        if (d.layer === 'data') return 100;
                        if (d.layer === 'logic') return 120;
                        return 150;
                    })
                    .strength(0.2))
                .force("charge", d3.forceManyBody()
                    .strength((d: any) => {
                        if (d.layer === 'data') return -300;
                        if (d.layer === 'attribute') return -80;
                        if (d.layer === 'logic') return -200;
                        return -150;
                    }))
                .force("center", d3.forceCenter(width / 2, height / 2))
                .force("collision", d3.forceCollide().radius((d: any) => d.size + 8))
                .force("x", d3.forceX(width / 2).strength(0.05))
                .force("y", d3.forceY(height / 2).strength(0.05));
        } else {
            // 层次布局 - 使用不同的力配置
            const layerXPositions = {
                'attribute': width * 0.15,
                'data': width * 0.35,
                'logic': width * 0.65,
                'decision': width * 0.85
            };
            
            d3Simulation = d3.forceSimulation(filteredNodes as any)
                .force("link", d3.forceLink(processedEdges)
                    .id((d: any) => d.id)
                    .distance(100) // 固定的距离
                    .strength(0.8)) // 更强的连接力
                .force("charge", d3.forceManyBody()
                    .strength(-50) // 更弱的电荷力
                    .distanceMax(100)) // 限制电荷力的影响范围
                .force("x", d3.forceX((d: any) => {
                    const layer = d.layer as keyof typeof layerXPositions;
                    return layerXPositions[layer] || width / 2;
                }).strength(0.8)) // 更强的X位置约束力
                .force("y", d3.forceY(height / 2).strength(0.3)) // 中等强度的Y位置约束力
                .force("collision", d3.forceCollide().radius((d: any) => d.size + 5)) // 较弱的碰撞力
                // 在层次布局中禁用中心力，避免把节点拉到中心
                // .force("center", null)
                ;
            
            // 为层次布局添加额外的力：将同层节点在Y轴上均匀分布
            d3Simulation.force("layerY", d3.forceY((d: any) => {
                const sameLayerNodes = filteredNodes.filter(n => n.layer === d.layer);
                const nodeIndex = sameLayerNodes.findIndex(n => n.id === d.id);
                const verticalSpacing = Math.min(height * 0.6 / sameLayerNodes.length, 60);
                return height / 2 + (nodeIndex - sameLayerNodes.length / 2) * verticalSpacing;
            }).strength(0.4));
        }
        
        // 添加连线
        const link = g.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(processedEdges)
            .enter()
            .append("line")
            .attr("stroke", (d: any) => d.color || "#999")
            .attr("stroke-width", (d: any) => d.width || 1.5)
            .attr("stroke-dasharray", (d: any) => d.dashes ? d.dashes.join(',') : null)
            .attr("stroke-opacity", 0.6)
            .attr("marker-end", (d: any) => graphFilter.value.showArrows ? 
                (d.color === '#2196F3' ? 'url(#arrowhead-data)' : 
                 d.color === '#4CAF50' ? 'url(#arrowhead-logic)' :
                 d.color === '#FF9800' ? 'url(#arrowhead-decision)' :
                 d.color === '#9C27B0' ? 'url(#arrowhead-attribute)' :
                 'url(#arrowhead)') : null);
        
        // 添加连线标签
        const edgeLabels = g.append("g")
            .attr("class", "edge-labels")
            .selectAll("text")
            .data(processedEdges.filter((d: any) => d.label && graphFilter.value.showLabels))
            .enter()
            .append("text")
            .attr("font-size", "10px")
            .attr("fill", "#666")
            .attr("text-anchor", "middle")
            .attr("pointer-events", "none")
            .text((d: any) => d.label);
        
        // 创建拖动行为
        const dragBehavior = d3.drag()
            .on("start", function(event: any, d: any) {
                if (!event.active) d3Simulation.alphaTarget(0.3).restart();
                // 在层次布局中，拖动时释放固定位置
                if (ontologyState.value.layoutMode === 'hierarchical') {
                    d.fx = null;
                    d.fy = null;
                }
                d.fx = d.x;
                d.fy = d.y;
            })
            .on("drag", function(event: any, d: any) {
                d.fx = event.x;
                d.fy = event.y;
            })
            .on("end", function(event: any, d: any) {
                if (!event.active) d3Simulation.alphaTarget(0);
                // 在层次布局中，拖动结束后重新固定位置
                if (ontologyState.value.layoutMode === 'hierarchical') {
                    d.fx = d.x;
                    d.fy = d.y;
                }
            });
        
        // 添加节点
        const node = g.append("g")
            .attr("class", "nodes")
            .selectAll("circle")
            .data(filteredNodes)
            .enter()
            .append("circle")
            .attr("r", (d: any) => d.size)
            .attr("fill", (d: any) => d.color)
            .attr("stroke", "#fff")
            .attr("stroke-width", 2)
            .call(dragBehavior as any);
        
        // 添加节点点击事件
        node.on("click", function(event: any, d: any) {
            event.stopPropagation();
            
            if (manualInput.value.connectingNodes) {
                selectNodeForConnection(d.id);
                return;
            }
            
            ontologyState.value.selectedNode = d;
            ontologyState.value.showNodeDetail = true;
        });
        
        node.on("mouseover", function(event: any, d: any) {
            d3.select(this)
                .attr("stroke-width", 3)
                .attr("stroke", "#FF5722");
            
            if (graphFilter.value.highlightRelations) {
                link.attr("stroke-opacity", (l: any) => 
                    (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.2
                );
                
                node.attr("opacity", (n: any) => {
                    const isConnected = processedEdges.some((l: any) => 
                        (l.source.id === d.id && l.target.id === n.id) ||
                        (l.target.id === d.id && l.source.id === n.id)
                    );
                    return isConnected || n.id === d.id ? 1 : 0.3;
                });
            }
            
            const tooltip = document.getElementById("graph-tooltip");
            if (tooltip) {
                let tooltipContent = `
                    <div class="tooltip-header">
                        <strong>${d.name}</strong>
                        <span class="tooltip-layer ${d.layer}">${d.layer === 'data' ? '数据' : d.layer === 'logic' ? '逻辑' : d.layer === 'decision' ? '决策' : '属性'}</span>
                    </div>
                    <div class="tooltip-type">类型: ${d.entityType || d.type}</div>
                    <div class="tooltip-description">${d.description || '无描述'}</div>
                `;
                
                if (d.attributes && d.attributes.length > 0) {
                    tooltipContent += `<div class="tooltip-attributes">
                        <div class="tooltip-subtitle">属性:</div>
                        <ul>${d.attributes.map((attr: string) => `<li>${attr}</li>`).join('')}</ul>
                    </div>`;
                }
                
                tooltip.innerHTML = tooltipContent;
                tooltip.style.display = "block";
                tooltip.style.left = event.clientX + 10 + "px";
                tooltip.style.top = event.clientY + 10 + "px";
            }
        })
        .on("mouseout", function() {
            d3.select(this)
                .attr("stroke-width", 2)
                .attr("stroke", "#fff");
            
            link.attr("stroke-opacity", 0.6);
            node.attr("opacity", 1);
            
            const tooltip = document.getElementById("graph-tooltip");
            if (tooltip) {
                tooltip.style.display = "none";
            }
        })
        .on("mousemove", function(event: any) {
            const tooltip = document.getElementById("graph-tooltip");
            if (tooltip) {
                tooltip.style.left = event.clientX + 10 + "px";
                tooltip.style.top = event.clientY + 10 + "px";
            }
        });
        
        // 添加节点标签
        const nodeLabels = g.append("g")
            .attr("class", "node-labels")
            .selectAll("text")
            .data(filteredNodes)
            .enter()
            .append("text")
            .text((d: any) => d.label || d.name)
            .attr("font-size", "11px")
            .attr("fill", "var(--fontColor)")
            .attr("text-anchor", "middle")
            .attr("dy", (d: any) => -d.size - 5)
            .attr("pointer-events", "none");
        
        // 如果是层次布局，添加层级背景和标签
        if (ontologyState.value.layoutMode === 'hierarchical') {
            const layerBackgrounds = {
                'attribute': { x: width * 0.05, width: width * 0.18, color: 'rgba(156, 39, 176, 0.1)' },
                'data': { x: width * 0.25, width: width * 0.18, color: 'rgba(33, 150, 243, 0.1)' },
                'logic': { x: width * 0.55, width: width * 0.18, color: 'rgba(76, 175, 80, 0.1)' },
                'decision': { x: width * 0.75, width: width * 0.18, color: 'rgba(255, 152, 0, 0.1)' }
            };
            
            Object.entries(layerBackgrounds).forEach(([layer, bg]) => {
                g.append("rect")
                    .attr("x", bg.x)
                    .attr("y", 20)
                    .attr("width", bg.width)
                    .attr("height", height - 40)
                    .attr("fill", bg.color)
                    .attr("stroke", bg.color.replace('0.1', '0.3'))
                    .attr("stroke-width", 1)
                    .attr("rx", 5)
                    .attr("ry", 5)
                    .lower();
                
                g.append("text")
                    .attr("x", bg.x + bg.width / 2)
                    .attr("y", 15)
                    .attr("text-anchor", "middle")
                    .attr("font-size", "12px")
                    .attr("fill", "var(--fontColor)")
                    .attr("font-weight", "bold")
                    .text(layer === 'data' ? '数据层' : 
                          layer === 'logic' ? '逻辑层' : 
                          layer === 'decision' ? '决策层' : '属性层');
            });
        }
        
        // 更新图形位置的函数
        function ticked() {
            link
                .attr("x1", (d: any) => d.source.x)
                .attr("y1", (d: any) => d.source.y)
                .attr("x2", (d: any) => d.target.x)
                .attr("y2", (d: any) => d.target.y);
            
            edgeLabels
                .attr("x", (d: any) => (d.source.x + d.target.x) / 2)
                .attr("y", (d: any) => (d.source.y + d.target.y) / 2);
            
            node
                .attr("cx", (d: any) => d.x)
                .attr("cy", (d: any) => d.y);
            
            nodeLabels
                .attr("x", (d: any) => d.x)
                .attr("y", (d: any) => d.y);
        }
        
        d3Simulation.on("tick", ticked);
        
        // 在层次布局中，运行一段时间后停止模拟
        if (ontologyState.value.layoutMode === 'hierarchical') {
            setTimeout(() => {
                if (d3Simulation) {
                    d3Simulation.alpha(0).stop();
                    
                    // 固定所有节点的最终位置
                    filteredNodes.forEach(node => {
                        node.fx = node.x;
                        node.fy = node.y;
                    });
                }
            }, 1000);
        }
        
        // 点击画布空白处取消节点选择
        svg.on("click", (event: any) => {
            if (event.target.tagName === 'svg') {
                ontologyState.value.selectedNode = null;
                ontologyState.value.showNodeDetail = false;
                if (manualInput.value.connectingNodes) {
                    manualInput.value.connectingNodes = false;
                    manualInput.value.sourceNode = '';
                    manualInput.value.targetNode = '';
                }
            }
        });
        
        // 延迟居中
        setTimeout(() => {
            centerGraph();
        }, 500);
    });
}

const centerGraph = () => {
    if (!d3Svg.value || !d3Zoom) return;
    const svg = d3.select(d3Svg.value);
    svg.transition()
        .duration(500)
        .call(d3Zoom.transform as any, d3.zoomIdentity);
}

const zoomInGraph = () => {
    if (!d3Svg.value || !d3Zoom) return;
    const svg = d3.select(d3Svg.value);
    svg.transition()
        .duration(300)
        .call(d3Zoom.scaleBy as any, 1.2);
}

const zoomOutGraph = () => {
    if (!d3Svg.value || !d3Zoom) return;
    const svg = d3.select(d3Svg.value);
    svg.transition()
        .duration(300)
        .call(d3Zoom.scaleBy as any, 0.8);
}

// 切换布局模式
const toggleLayoutMode = () => {
    ontologyState.value.layoutMode = ontologyState.value.layoutMode === 'force' ? 'hierarchical' : 'force';
    renderD3Graph();
}

// 重置推理状态
const resetReasoning = () => {
    ontologyState.value.autoReasoningStage = 'none';
    ontologyState.value.currentResponse = '';
}

// 保存自定义提示词
const saveCustomPrompt = () => {
    localStorage.setItem('ontologyCustomPrompt', ontologyState.value.customPrompt);
    alert(store.locales === 'zh' ? '提示词已保存！' : 'Prompt saved!');
}

// 重置为默认提示词
const resetToDefaultPrompt = () => {
    ontologyState.value.customPrompt = `你是一个本体构建专家。请将用户的自然语言描述解析为结构化本体，包含以下多层结构：

1. **数据层**：
   - 实体（Entities）：包含属性和关联规则
   - 属性（Attributes）：实体的具体特征，可以展开为节点
   - 关系（Relationships）：实体之间的连接

2. **逻辑层**：
   - 规则（Rules）：必须关联到具体的数据实体或属性
   - 约束（Constraints）：针对数据实体的限制条件
   - 推理（Inferences）：基于数据的逻辑推导

3. **决策层**：
   - 决策规则（Decision Rules）：必须基于数据实体或逻辑规则
   - 策略（Strategies）：决策的组合和优先级
   - 行动（Actions）：具体的执行步骤

重要要求：
1. 每个数据实体必须包含具体的属性列表
2. 每个规则和决策必须明确关联到具体的数据实体或属性
3. 属性可以作为独立的节点存在，与实体关联

请以JSON格式返回，结构如下：
{
  "dataLayer": {
    "entities": [
      {
        "id": "string", 
        "name": "string", 
        "type": "string", 
        "attributes": [
          {"name": "string", "type": "string", "description": "string"}
        ], 
        "description": "string",
        "relatedRules": ["rule_id"],
        "relatedDecisions": ["decision_id"]
      }
    ],
    "relationships": [
      {"source": "entity_id", "target": "entity_id", "type": "string", "description": "string"}
    ]
  },
  "logicLayer": {
    "rules": [
      {
        "id": "string", 
        "name": "string",
        "condition": "string", 
        "action": "string", 
        "description": "string",
        "relatedEntities": ["entity_id"],
        "relatedAttributes": ["attribute_name"]
      }
    ],
    "constraints": [
      {
        "entity": "entity_id", 
        "constraint": "string", 
        "description": "string",
        "relatedAttributes": ["attribute_name"]
      }
    ]
  },
  "decisionLayer": {
    "decisionRules": [
      {
        "id": "string", 
        "name": "string",
        "condition": "string", 
        "decision": "string", 
        "priority": "string", 
        "description": "string",
        "relatedEntities": ["entity_id"],
        "relatedRules": ["rule_id"]
      }
    ],
    "strategies": [
      {
        "name": "string", 
        "description": "string", 
        "actions": ["string"],
        "relatedDecisions": ["decision_id"]
      }
    ]
  }
}`;
    alert(store.locales === 'zh' ? '已恢复默认提示词！' : 'Default prompt restored!');
}

// 点击画布空白处恢复面板
const resetResponsePanel = () => {
    if (!ontologyState.value.showNodeDetail) return;
    ontologyState.value.selectedNode = null;
    ontologyState.value.showNodeDetail = false;
    ontologyState.value.editingNode = null;
}

// 切换标签页
const switchTab = (tab: 'nlp' | 'manual' | 'info') => {
    ontologyState.value.activeTab = tab;
    ontologyState.value.editingNode = null;
}

// 监听模型类型变化
watch(() => store.AIconfig.llm.type, async (newType: string) => {
    config.value.selectedModel = '';
    if (store.AIconfig.llm.online) {
        await refreshModels();
    }
}, { immediate: true });

// 监听连接状态变化
watch(() => store.AIconfig.llm.online, async (isOnline: boolean) => {
    if (isOnline) {
        await refreshModels();
    } else {
        config.value.selectedModel = '';
    }
});

// 监听可用模型列表变化
watch(availableModels, (newModels: string[]) => {
    if (newModels.length > 0) {
        if (!config.value.selectedModel || !newModels.includes(config.value.selectedModel)) {
            const firstModel = newModels[0];
            selectModel(firstModel);
        }
    } else {
        config.value.selectedModel = '';
    }
}, { immediate: true });

// 监听图谱数据变化
watch(() => ontologyGraph.value.version, () => {
    if (ontologyGraph.value.nodes.length > 0) {
        renderD3Graph();
    }
});

watch(() => graphFilter.value.visibleLayers, () => {
    renderD3Graph();
}, { deep: true });

watch(() => graphFilter.value.showLabels, () => {
    renderD3Graph();
});

watch(() => ontologyState.value.showAttributes, () => {
    renderD3Graph();
});

watch(() => ontologyState.value.layoutMode, () => {
    renderD3Graph();
});

onMounted(async () => {
    if (localStorage.getItem('ontologyGraph') != null) {
        try {
            ontologyGraph.value = JSON.parse(localStorage.getItem("ontologyGraph")!)
            nextTick(() => {
                initD3Graph();
                renderD3Graph();
            });
        } catch (e) {
            console.error('加载本地存储的本体数据失败:', e);
        }
    }
    
    // 加载自定义提示词
    const savedPrompt = localStorage.getItem('ontologyCustomPrompt');
    if (savedPrompt) {
        ontologyState.value.customPrompt = savedPrompt;
    }
    
    window.addEventListener('keydown', enter)
    
    if (store.AIconfig.llm.type && !store.AIconfig.llm.online) {
        await store.getAIconfig()
    }
    
    if (store.AIconfig.llm.online) {
        await refreshModels();
    }
})

onBeforeUnmount(() => {
    window.removeEventListener('keydown', enter)
    localStorage.setItem("ontologyConfig", JSON.stringify(config.value))
    localStorage.setItem("ontologyGraph", JSON.stringify(ontologyGraph.value))
    localStorage.setItem("ontologyCustomPrompt", ontologyState.value.customPrompt)
    cleanupD3Graph();
})
</script>

<template>
    <div class="ontology-container">
        <!-- 左侧：控制界面 -->
        <div class="control-panel">
            <!-- 标签页切换 -->
            <div class="panel-tabs">
                <button @click="switchTab('nlp')" 
                        class="tab-btn"
                        :class="{active: ontologyState.activeTab === 'nlp'}">
                    <i class="fa fa-comment"></i>
                    {{ store.locales === 'zh' ? '识别' : 'Recognition' }}
                </button>
                <button @click="switchTab('manual')" 
                        class="tab-btn"
                        :class="{active: ontologyState.activeTab === 'manual'}">
                    <i class="fa fa-edit"></i>
                    {{ store.locales === 'zh' ? '输入' : 'Input' }}
                </button>
                <button @click="switchTab('info')" 
                        class="tab-btn"
                        :class="{active: ontologyState.activeTab === 'info'}">
                    <i class="fa fa-cog"></i>
                    {{ store.locales === 'zh' ? '设置' : 'Settings' }}
                </button>
            </div>
            
            <!-- 标签页内容 -->
            <div class="tab-content">
                <!-- 通用节点详情面板（在所有标签页都显示） -->
                <div class="node-detail-full" v-if="ontologyState.showNodeDetail">
                    <div class="node-detail-header">
                        <h3 v-if="ontologyState.editingNode">
                            {{ store.locales === 'zh' ? '编辑节点' : 'Edit Node' }}
                        </h3>
                        <h3 v-else>
                            {{ ontologyState.selectedNode?.name }}
                        </h3>
                        <button @click="ontologyState.showNodeDetail = false" class="close-btn">
                            <i class="fa fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="node-detail-content scoll">
                        <!-- 编辑模式 -->
                        <div v-if="ontologyState.editingNode" class="edit-mode">
                            <div class="manual-section">
                                <label>{{ store.locales === 'zh' ? '节点名称' : 'Node Name' }}</label>
                                <input type="text" v-model="ontologyState.editingNode.name" class="manual-input">
                            </div>
                            
                            <div class="manual-section">
                                <label>{{ store.locales === 'zh' ? '节点类型' : 'Node Type' }}</label>
                                <select v-model="ontologyState.editingNode.type" class="manual-select">
                                    <option value="data">{{ store.locales === 'zh' ? '数据' : 'Data' }}</option>
                                    <option value="logic">{{ store.locales === 'zh' ? '逻辑' : 'Logic' }}</option>
                                    <option value="decision">{{ store.locales === 'zh' ? '决策' : 'Decision' }}</option>
                                    <option value="attribute">{{ store.locales === 'zh' ? '属性' : 'Attribute' }}</option>
                                </select>
                            </div>
                            
                            <div class="manual-section">
                                <label>{{ store.locales === 'zh' ? '所属层级' : 'Layer' }}</label>
                                <select v-model="ontologyState.editingNode.layer" class="manual-select">
                                    <option value="data">{{ store.locales === 'zh' ? '数据层' : 'Data Layer' }}</option>
                                    <option value="logic">{{ store.locales === 'zh' ? '逻辑层' : 'Logic Layer' }}</option>
                                    <option value="decision">{{ store.locales === 'zh' ? '决策层' : 'Decision Layer' }}</option>
                                    <option value="attribute">{{ store.locales === 'zh' ? '属性层' : 'Attribute Layer' }}</option>
                                </select>
                            </div>
                            
                            <div class="manual-section">
                                <label>{{ store.locales === 'zh' ? '描述' : 'Description' }}</label>
                                <textarea v-model="ontologyState.editingNode.description" 
                                          class="manual-textarea"
                                          rows="3"></textarea>
                            </div>
                            
                            <div class="manual-section" v-if="ontologyState.editingNode.type === 'data'">
                                <label>{{ store.locales === 'zh' ? '实体类型' : 'Entity Type' }}</label>
                                <input type="text" v-model="ontologyState.editingNode.entityType" class="manual-input">
                            </div>
                            
                            <div class="manual-section">
                                <label>{{ store.locales === 'zh' ? '属性列表' : 'Attributes' }}</label>
                                <div class="attributes-edit">
                                    <div v-for="(attr, index) in ontologyState.editingNode.attributes" 
                                         :key="index" class="attribute-item">
                                        <input type="text" v-model="ontologyState.editingNode.attributes[index]" 
                                               class="manual-input attribute-input">
                                        <button @click="ontologyState.editingNode.attributes.splice(index, 1)" 
                                                class="remove-btn">
                                            <i class="fa fa-times"></i>
                                        </button>
                                    </div>
                                    <button @click="ontologyState.editingNode.attributes.push('')" 
                                            class="add-btn">
                                        <i class="fa fa-plus"></i>
                                        {{ store.locales === 'zh' ? '添加属性' : 'Add Attribute' }}
                                    </button>
                                </div>
                            </div>
                            
                            <div class="manual-actions">
                                <button @click="saveNodeChanges" class="btn btn-primary">
                                    <i class="fa fa-save"></i>
                                    {{ store.locales === 'zh' ? '保存' : 'Save' }}
                                </button>
                                <button @click="cancelEdit" class="btn btn-clear">
                                    <i class="fa fa-times"></i>
                                    {{ store.locales === 'zh' ? '取消' : 'Cancel' }}
                                </button>
                                <button @click="deleteNode(ontologyState.editingNode.id)" 
                                        class="btn btn-danger">
                                    <i class="fa fa-trash"></i>
                                    {{ store.locales === 'zh' ? '删除' : 'Delete' }}
                                </button>
                            </div>
                        </div>
                        
                        <!-- 查看模式 -->
                        <div v-else-if="ontologyState.selectedNode" class="view-mode">
                            <div class="detail-section">
                                <h4>{{ store.locales === 'zh' ? '节点信息' : 'Node Information' }}</h4>
                                <div class="detail-item">
                                    <span>{{ store.locales === 'zh' ? '名称' : 'Name' }}:</span>
                                    <span>{{ ontologyState.selectedNode.name }}</span>
                                </div>
                                <div class="detail-item">
                                    <span>{{ store.locales === 'zh' ? '类型' : 'Type' }}:</span>
                                    <span>{{ ontologyState.selectedNode.entityType || ontologyState.selectedNode.type }}</span>
                                </div>
                                <div class="detail-item">
                                    <span>{{ store.locales === 'zh' ? '层级' : 'Layer' }}:</span>
                                    <span>{{ ontologyState.selectedNode.layer }}</span>
                                </div>
                                <div class="detail-item">
                                    <span>{{ store.locales === 'zh' ? '描述' : 'Description' }}:</span>
                                    <span>{{ ontologyState.selectedNode.description }}</span>
                                </div>
                            </div>
                            
                            <div class="detail-section" v-if="ontologyState.selectedNode.attributes && ontologyState.selectedNode.attributes.length > 0">
                                <h4>{{ store.locales === 'zh' ? '属性列表' : 'Attributes' }}</h4>
                                <ul class="attributes-list">
                                    <li v-for="(attr, index) in ontologyState.selectedNode.attributes" :key="index">
                                        {{ attr }}
                                    </li>
                                </ul>
                            </div>
                            
                            <div class="manual-actions">
                                <button @click="editNode(ontologyState.selectedNode)" class="btn btn-primary">
                                    <i class="fa fa-edit"></i>
                                    {{ store.locales === 'zh' ? '编辑' : 'Edit' }}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 智能识别标签页 -->
                <div v-if="ontologyState.activeTab === 'nlp' && !ontologyState.showNodeDetail" class="tab-panel">
                    <!-- 自然语言理解面板 -->
                    <div class="normal-control-panel">
                        <!-- 配置栏 -->
                        <div class="config-bar">
                            <select v-model="store.AIconfig.llm.type" 
                                    class="model-select"
                                    :class="{active:store.AIconfig.llm.online, offline:!store.AIconfig.llm.online}"
                                    @change="store.getAIconfig()">
                                <option v-for="(option, index) in store.AIconfig.llm.types" :key="index" :value="option">
                                    {{ option.charAt(0).toUpperCase() + option.slice(1) }}
                                </option>
                            </select>
                            
                            <select v-model="config.selectedModel" 
                                    class="model-select"
                                    :class="{active:store.AIconfig.llm.online, offline:!store.AIconfig.llm.online}"
                                    :disabled="!isModelsAvailable"
                                    @click="refreshModels"
                                    @change="selectModel(config.selectedModel)">
                                <option value="" disabled>
                                    {{ store.locales=='zh' ? '选择模型...' : 'Select model...' }}
                                </option>
                                <option v-for="(model, index) in availableModels" :key="index" :value="model">
                                    {{ model }}
                                </option>
                            </select>
                            <label class="mode-option" :class="{active: ontologyState.buildMode === 'replace'}">
                                <input type="radio" v-model="ontologyState.buildMode" value="replace">
                                <i class="fa fa-refresh"></i>
                            </label>
                            <label class="mode-option" :class="{active: ontologyState.buildMode === 'append'}">
                                <input type="radio" v-model="ontologyState.buildMode" value="append">
                                <i class="fa fa-plus"></i>
                            </label>
                        </div>
                        
                        <!-- 输入区域 -->
                        <div class="input-area">
                            <textarea ref="textarea" 
                                      class="input-text scoll"
                                      v-model="input" 
                                      :placeholder="store.locales === 'zh' ? 
                                      '请输入自然语言描述来构建本体...' : 
                                      'Enter natural language description to build ontology...'"
                                      :disabled="!store.AIconfig.llm.online || (!config.selectedModel && store.AIconfig.llm.type !== 'anthropic') || ontologyState.isBuilding">
                            </textarea>
                        </div>
                        
                        <!-- 四阶段推理控制按钮 -->
                        <div class="four-stage-controls">
                            <div class="stage-buttons-row">
                                <button @click="performEntityReasoning(input)" 
                                        class="btn btn-entity"
                                        :disabled="!store.AIconfig.llm.online || (!config.selectedModel && store.AIconfig.llm.type !== 'anthropic') || ontologyState.isBuilding" :title="store.locales === 'zh' ? '实体推理' : 'Entity Reasoning'">
                                    <i class="fa fa-cube"></i>
                                </button>
                                
                                <button @click="performAttributeReasoning(input)" 
                                        class="btn btn-attribute"
                                        :disabled="!store.AIconfig.llm.online || (!config.selectedModel && store.AIconfig.llm.type !== 'anthropic') || ontologyState.isBuilding" :title="store.locales === 'zh' ? '属性推理' : 'Attribute Reasoning'">
                                    <i class="fa fa-tags"></i>
                                </button>
                                
                                <button @click="performLogicReasoning(input)" 
                                        class="btn btn-logic"
                                        :disabled="!store.AIconfig.llm.online || (!config.selectedModel && store.AIconfig.llm.type !== 'anthropic') || ontologyState.isBuilding" :title="store.locales === 'zh' ? '逻辑推理' : 'Logic Reasoning'">
                                    <i class="fa fa-code"></i>
                                </button>
                                
                                <button @click="performDecisionReasoning(input)" 
                                        class="btn btn-decision"
                                        :disabled="!store.AIconfig.llm.online || (!config.selectedModel && store.AIconfig.llm.type !== 'anthropic') || ontologyState.isBuilding" :title="store.locales === 'zh' ? '决策推理' : 'Decision Reasoning'">
                                    <i class="fa fa-flag-checkered"></i>
                                </button>
                            </div>
                        </div>
                        
                        <!-- 控制按钮 -->
                        <div class="control-buttons">
                            <button @click="generate()" 
                                    class="btn btn-primary"
                                    :disabled="!store.AIconfig.llm.online || (!config.selectedModel && store.AIconfig.llm.type !== 'anthropic') || ontologyState.isBuilding">
                                <i class="fa" :class="ontologyState.isBuilding ? 'fa-spinner fa-spin' : 'fa-sitemap'"></i>
                                <span>{{ ontologyState.isBuilding ? 
                                    (store.locales === 'zh' ? '构建中...' : 'Building...') : 
                                    (store.locales === 'zh' ? '构建本体' : 'Build') }}</span>
                            </button>
                            
                            <button @click="stop()" 
                                    class="btn btn-stop"
                                    v-if="ontologyState.isBuilding">
                                <i class="fa fa-stop"></i>
                                <span>{{ store.locales === 'zh' ? '停止' : 'Stop' }}</span>
                            </button>
                            
                            <button @click="clearGraph()" 
                                    class="btn btn-clear"
                                    :disabled="ontologyGraph.nodes.length === 0">
                                <i class="fa fa-trash"></i>
                                <span>{{ store.locales === 'zh' ? '清空图谱' : 'Clear Graph' }}</span>
                            </button>
                        </div>
                        
                        <!-- 响应显示 -->
                        <div class="response-area scoll" v-if="ontologyState.currentResponse">
                            {{ ontologyState.currentResponse }}
                        </div>
                    </div>
                </div>
                
                <!-- 手动输入标签页 -->
                <div v-if="ontologyState.activeTab === 'manual' && !ontologyState.showNodeDetail" class="tab-panel">
                    <!-- 手动输入面板 -->
                    <div class="manual-panel">
                        <div class="manual-content scoll">
                            <!-- 节点类型选择 -->
                            <div class="manual-section">
                                <label>{{ store.locales === 'zh' ? '节点类型' : 'Node Type' }}</label>
                                <select v-model="manualInput.nodeType" class="manual-select">
                                    <option value="data">{{ store.locales === 'zh' ? '数据实体' : 'Data Entity' }}</option>
                                    <option value="logic">{{ store.locales === 'zh' ? '逻辑规则' : 'Logic Rule' }}</option>
                                    <option value="decision">{{ store.locales === 'zh' ? '决策节点' : 'Decision Node' }}</option>
                                    <option value="attribute">{{ store.locales === 'zh' ? '属性节点' : 'Attribute Node' }}</option>
                                </select>
                            </div>
                            
                            <!-- 所属层级 -->
                            <div class="manual-section">
                                <label>{{ store.locales === 'zh' ? '所属层级' : 'Layer' }}</label>
                                <select v-model="manualInput.selectedLayer" class="manual-select">
                                    <option value="data">{{ store.locales === 'zh' ? '数据层' : 'Data Layer' }}</option>
                                    <option value="logic">{{ store.locales === 'zh' ? '逻辑层' : 'Logic Layer' }}</option>
                                    <option value="decision">{{ store.locales === 'zh' ? '决策层' : 'Decision Layer' }}</option>
                                    <option value="attribute">{{ store.locales === 'zh' ? '属性层' : 'Attribute Layer' }}</option>
                                </select>
                            </div>
                            
                            <!-- 基本信息 -->
                            <div class="manual-section">
                                <label>{{ store.locales === 'zh' ? '节点名称' : 'Node Name' }} *</label>
                                <input type="text" v-model="manualInput.nodeName" class="manual-input" 
                                       :placeholder="store.locales === 'zh' ? '输入节点名称' : 'Enter node name'">
                            </div>
                            
                            <div class="manual-section">
                                <label>{{ store.locales === 'zh' ? '节点描述' : 'Description' }}</label>
                                <textarea v-model="manualInput.nodeDescription" class="manual-textarea" 
                                          :placeholder="store.locales === 'zh' ? '输入节点描述' : 'Enter node description'"
                                          rows="3"></textarea>
                            </div>
                            
                            <!-- 数据实体特定字段 -->
                            <div class="manual-section" v-if="manualInput.nodeType === 'data'">
                                <label>{{ store.locales === 'zh' ? '实体类型' : 'Entity Type' }}</label>
                                <input type="text" v-model="manualInput.entityType" class="manual-input" 
                                       :placeholder="store.locales === 'zh' ? '例如：用户、产品、订单' : 'e.g., User, Product, Order'">
                            </div>
                            
                            <!-- 逻辑规则特定字段 -->
                            <div class="manual-section" v-if="manualInput.nodeType === 'logic'">
                                <div class="manual-subsection">
                                    <label>{{ store.locales === 'zh' ? '规则条件' : 'Rule Condition' }}</label>
                                    <input type="text" v-model="manualInput.ruleCondition" class="manual-input" 
                                           :placeholder="store.locales === 'zh' ? '输入规则条件' : 'Enter rule condition'">
                                </div>
                                <div class="manual-subsection">
                                    <label>{{ store.locales === 'zh' ? '规则动作' : 'Rule Action' }}</label>
                                    <input type="text" v-model="manualInput.ruleAction" class="manual-input" 
                                           :placeholder="store.locales === 'zh' ? '输入规则动作' : 'Enter rule action'">
                                </div>
                                <div class="manual-subsection">
                                    <label>{{ store.locales === 'zh' ? '约束条件' : 'Constraint' }}</label>
                                    <input type="text" v-model="manualInput.constraintText" class="manual-input" 
                                           :placeholder="store.locales === 'zh' ? '输入约束条件' : 'Enter constraint'">
                                </div>
                            </div>
                            
                            <!-- 决策节点特定字段 -->
                            <div class="manual-section" v-if="manualInput.nodeType === 'decision'">
                                <div class="manual-subsection">
                                    <label>{{ store.locales === 'zh' ? '决策条件' : 'Decision Condition' }}</label>
                                    <input type="text" v-model="manualInput.ruleCondition" class="manual-input" 
                                           :placeholder="store.locales === 'zh' ? '输入决策条件' : 'Enter decision condition'">
                                </div>
                                <div class="manual-subsection">
                                    <label>{{ store.locales === 'zh' ? '决策结果' : 'Decision Result' }}</label>
                                    <input type="text" v-model="manualInput.ruleDecision" class="manual-input" 
                                           :placeholder="store.locales === 'zh' ? '输入决策结果' : 'Enter decision result'">
                                </div>
                                <div class="manual-subsection">
                                    <label>{{ store.locales === 'zh' ? '优先级' : 'Priority' }}</label>
                                    <select v-model="manualInput.rulePriority" class="manual-select">
                                        <option value="high">{{ store.locales === 'zh' ? '高' : 'High' }}</option>
                                        <option value="medium">{{ store.locales === 'zh' ? '中' : 'Medium' }}</option>
                                        <option value="low">{{ store.locales === 'zh' ? '低' : 'Low' }}</option>
                                    </select>
                                </div>
                                <div class="manual-subsection">
                                    <label>{{ store.locales === 'zh' ? '策略行动' : 'Strategy Actions' }}</label>
                                    <div class="strategy-actions">
                                        <div v-for="(action, index) in manualInput.strategyActions" 
                                             :key="index" class="action-item">
                                            <input type="text" v-model="manualInput.strategyActions[index]" 
                                                   class="manual-input action-input"
                                                   :placeholder="store.locales === 'zh' ? '输入行动步骤' : 'Enter action step'">
                                            <button @click="removeStrategyActionField(index)" 
                                                    class="remove-btn"
                                                    v-if="manualInput.strategyActions.length > 1">
                                                <i class="fa fa-times"></i>
                                            </button>
                                        </div>
                                        <button @click="addStrategyActionField" class="add-btn">
                                            <i class="fa fa-plus"></i>
                                            {{ store.locales === 'zh' ? '添加行动' : 'Add Action' }}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- 属性列表 -->
                            <div class="manual-section">
                                <label>{{ store.locales === 'zh' ? '属性列表' : 'Attributes' }}</label>
                                <div class="attributes-input">
                                    <div v-for="(attr, index) in manualInput.attributes" 
                                         :key="index" class="attribute-item">
                                        <input type="text" v-model="manualInput.attributes[index]" 
                                               class="manual-input attribute-input"
                                               :placeholder="store.locales === 'zh' ? '输入属性' : 'Enter attribute'">
                                        <button @click="removeAttributeField(index)" 
                                                class="remove-btn"
                                                v-if="manualInput.attributes.length > 1">
                                            <i class="fa fa-times"></i>
                                        </button>
                                    </div>
                                    <button @click="addAttributeField" class="add-btn">
                                        <i class="fa fa-plus"></i>
                                        {{ store.locales === 'zh' ? '添加属性' : 'Add Attribute' }}
                                    </button>
                                </div>
                            </div>
                            
                            <!-- 添加节点按钮 -->
                            <div class="manual-actions">
                                <button @click="createManualNode" class="btn btn-primary">
                                    <i class="fa fa-plus"></i>
                                    {{ store.locales === 'zh' ? '添加节点' : 'Add Node' }}
                                </button>
                            </div>
                            
                            <!-- 分割线 -->
                            <div class="manual-divider">
                                {{ store.locales === 'zh' ? '或' : 'OR' }}
                            </div>
                            
                            <!-- 添加边 -->
                            <div class="manual-section">
                                <h4>{{ store.locales === 'zh' ? '添加关系边' : 'Add Relationship Edge' }}</h4>
                                
                                <div class="manual-subsection">
                                    <label>{{ store.locales === 'zh' ? '关系类型' : 'Edge Type' }}</label>
                                    <select v-model="manualInput.edgeType" class="manual-select">
                                        <option value="belongs_to">{{ store.locales === 'zh' ? '属于' : 'Belongs To' }}</option>
                                        <option value="used_in_rule">{{ store.locales === 'zh' ? '用于规则' : 'Used in Rule' }}</option>
                                        <option value="affects_rule">{{ store.locales === 'zh' ? '影响规则' : 'Affects Rule' }}</option>
                                        <option value="leads_to_decision">{{ store.locales === 'zh' ? '导向决策' : 'Leads to Decision' }}</option>
                                        <option value="affects_decision">{{ store.locales === 'zh' ? '影响决策' : 'Affects Decision' }}</option>
                                        <option value="related_to">{{ store.locales === 'zh' ? '相关' : 'Related To' }}</option>
                                        <option value="has_constraint">{{ store.locales === 'zh' ? '有约束' : 'Has Constraint' }}</option>
                                    </select>
                                </div>
                                
                                <div class="manual-subsection">
                                    <label>{{ store.locales === 'zh' ? '关系描述' : 'Edge Description' }}</label>
                                    <input type="text" v-model="manualInput.edgeDescription" class="manual-input"
                                           :placeholder="store.locales === 'zh' ? '输入关系描述' : 'Enter edge description'">
                                </div>
                                
                                <div class="connection-controls">
                                    <div class="connection-info" v-if="manualInput.sourceNode">
                                        <span>{{ store.locales === 'zh' ? '源节点' : 'Source Node' }}:</span>
                                        <span class="node-id">{{ manualInput.sourceNode }}</span>
                                    </div>
                                    <div class="connection-info" v-if="manualInput.targetNode">
                                        <span>{{ store.locales === 'zh' ? '目标节点' : 'Target Node' }}:</span>
                                        <span class="node-id">{{ manualInput.targetNode }}</span>
                                    </div>
                                    
                                    <button @click="startConnectingNodes" 
                                            class="btn btn-connect"
                                            :class="{connecting: manualInput.connectingNodes}">
                                        <i class="fa" :class="manualInput.connectingNodes ? 'fa-link' : 'fa-unlink'"></i>
                                        {{ manualInput.connectingNodes ? 
                                            (store.locales === 'zh' ? '选择节点中...' : 'Selecting nodes...') : 
                                            (store.locales === 'zh' ? '连接节点' : 'Connect Nodes') }}
                                    </button>
                                    
                                    <button @click="createManualEdge" 
                                            class="btn btn-primary"
                                            :disabled="!manualInput.sourceNode || !manualInput.targetNode">
                                        <i class="fa fa-link"></i>
                                        {{ store.locales === 'zh' ? '添加边' : 'Add Edge' }}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 设置标签页 -->
                <div v-if="ontologyState.activeTab === 'info' && !ontologyState.showNodeDetail" class="tab-panel">
                    <!-- 设置面板 -->
                    <div class="info-panel-full">
                        
                        <div class="info-content scoll">
                            <!-- 统计信息 -->
                            <div class="stats-section">
                                <div class="stats-title">
                                    {{ store.locales === 'zh' ? '统计信息' : 'Statistics' }}
                                </div>
                                <div class="stats-item">
                                    <span>{{ store.locales === 'zh' ? '总节点数' : 'Total Nodes' }}:</span>
                                    <span class="stats-value">{{ ontologyGraph.nodes.length }}</span>
                                </div>
                                <div class="stats-item">
                                    <span>{{ store.locales === 'zh' ? '总边数' : 'Total Edges' }}:</span>
                                    <span class="stats-value">{{ ontologyGraph.edges.length }}</span>
                                </div>
                                <div class="stats-item">
                                    <span>{{ store.locales === 'zh' ? '本体版本' : 'Ontology Version' }}:</span>
                                    <span class="stats-value">{{ ontologyGraph.version }}</span>
                                </div>
                                
                                <div class="layer-stats">
                                    <div class="layer-stat-title">
                                        {{ store.locales === 'zh' ? '各层节点分布' : 'Node Distribution by Layer' }}
                                    </div>
                                    <div class="layer-stat">
                                        <span class="layer-dot data-dot"></span>
                                        {{ store.locales === 'zh' ? '数据层' : 'Data Layer' }}: {{ ontologyGraph.layers.data.nodes.length }}
                                    </div>
                                    <div class="layer-stat">
                                        <span class="layer-dot logic-dot"></span>
                                        {{ store.locales === 'zh' ? '逻辑层' : 'Logic Layer' }}: {{ ontologyGraph.layers.logic.nodes.length }}
                                    </div>
                                    <div class="layer-stat">
                                        <span class="layer-dot decision-dot"></span>
                                        {{ store.locales === 'zh' ? '决策层' : 'Decision Layer' }}: {{ ontologyGraph.layers.decision.nodes.length }}
                                    </div>
                                    <div class="layer-stat">
                                        <span class="layer-dot attribute-dot"></span>
                                        {{ store.locales === 'zh' ? '属性层' : 'Attribute Layer' }}: {{ ontologyGraph.layers.attribute.nodes.length }}
                                    </div>
                                </div>
                            </div>
                            
                            <!-- 图例 -->
                            <div class="legend-section">
                                <div class="legend-title">
                                    {{ store.locales === 'zh' ? '图例' : 'Legend' }}
                                </div>
                                <div class="legend-item">
                                    <div class="legend-icon data-legend"></div>
                                    {{ store.locales === 'zh' ? '数据实体' : 'Data Entity' }}
                                </div>
                                <div class="legend-item">
                                    <div class="legend-icon logic-legend"></div>
                                    {{ store.locales === 'zh' ? '逻辑规则' : 'Logic Rule' }}
                                </div>
                                <div class="legend-item">
                                    <div class="legend-icon decision-legend"></div>
                                    {{ store.locales === 'zh' ? '决策节点' : 'Decision Node' }}
                                </div>
                                <div class="legend-item">
                                    <div class="legend-icon attribute-legend"></div>
                                    {{ store.locales === 'zh' ? '属性节点' : 'Attribute Node' }}
                                </div>
                                <div class="legend-item">
                                    <div class="legend-line data-line"></div>
                                    {{ store.locales === 'zh' ? '数据关系' : 'Data Relation' }}
                                </div>
                                <div class="legend-item">
                                    <div class="legend-line logic-line"></div>
                                    {{ store.locales === 'zh' ? '逻辑约束' : 'Logic Constraint' }}
                                </div>
                                <div class="legend-item">
                                    <div class="legend-line attribute-line"></div>
                                    {{ store.locales === 'zh' ? '属性关联' : 'Attribute Relation' }}
                                </div>
                                <div class="legend-item">
                                    <div class="legend-arrow"></div>
                                    {{ store.locales === 'zh' ? '有向边' : 'Directed Edge' }}
                                </div>
                            </div>
                            
                            <!-- 布局设置 -->
                            <div class="layout-section">
                                <div class="layout-title">
                                    {{ store.locales === 'zh' ? '布局设置' : 'Layout Settings' }}
                                </div>
                                <div class="layout-options">
                                    <button 
                                        type="button"
                                        :class="{ active: ontologyState.layoutMode === 'force' }"
                                        @click="ontologyState.layoutMode = 'force'"
                                    >
                                        {{ store.locales === 'zh' ? '力导向布局' : 'Force Layout' }}
                                    </button>
                                    
                                    <button 
                                        type="button"
                                        :class="{ active: ontologyState.layoutMode === 'hierarchical' }"
                                        @click="ontologyState.layoutMode = 'hierarchical'"
                                    >
                                        {{ store.locales === 'zh' ? '层次布局' : 'Hierarchical Layout' }}
                                    </button>
                                </div>
                            </div>
                            
                            <!-- 自定义提示词 -->
                            <div class="prompt-section">
                                <div class="prompt-title">
                                    {{ store.locales === 'zh' ? '自定义提示词' : 'Custom Prompt' }}
                                </div>
                                <div class="prompt-hint">
                                    {{ store.locales === 'zh' ? '修改提示词以控制AI如何构建本体' : 'Modify the prompt to control how AI builds ontology' }}
                                </div>
                                <textarea v-model="ontologyState.customPrompt" 
                                          class="prompt-textarea scoll"
                                          :placeholder="store.locales === 'zh' ? '输入自定义提示词...' : 'Enter custom prompt...'"
                                          rows="10"></textarea>
                                <div class="prompt-actions">
                                    <button @click="saveCustomPrompt" class="btn btn-primary">
                                        <i class="fa fa-save"></i>
                                        {{ store.locales === 'zh' ? '保存提示词' : 'Save Prompt' }}
                                    </button>
                                    <button @click="resetToDefaultPrompt" class="btn btn-clear">
                                        <i class="fa fa-refresh"></i>
                                        {{ store.locales === 'zh' ? '恢复默认' : 'Reset to Default' }}
                                    </button>
                                </div>
                            </div>
                            
                            <!-- 文件操作 -->
                            <div class="file-section">
                                <div class="file-title">
                                    {{ store.locales === 'zh' ? '文件操作' : 'File Operations' }}
                                </div>
                                <div class="file-actions">
                                    <button @click="exportOntology" 
                                            class="btn btn-primary file-btn"
                                            :disabled="ontologyGraph.nodes.length === 0">
                                        <i class="fa fa-download"></i>
                                        {{ store.locales === 'zh' ? '导出本体' : 'Export Ontology' }}
                                    </button>
                                    
                                    <button @click="triggerFileInput" 
                                            class="btn btn-clear file-btn">
                                        <i class="fa fa-upload"></i>
                                        {{ store.locales === 'zh' ? '导入本体' : 'Import Ontology' }}
                                    </button>
                                    <input type="file" id="file-input" accept=".json" @change="importOntology" style="display: none">
                                </div>
                                <div class="file-hint">
                                    {{ store.locales === 'zh' ? '支持JSON格式的本体文件' : 'Supports JSON format ontology files' }}
                                </div>
                            </div>
                            
                            <!-- 显示选项 -->
                            <div class="display-section">
                                <div class="display-title">
                                    {{ store.locales === 'zh' ? '显示设置' : 'Display Settings' }}
                                </div>
                                <div class="display-options">
                                    <label class="option-item">
                                        <input type="checkbox" v-model="ontologyState.showAttributes">
                                        {{ store.locales === 'zh' ? '显示属性节点' : 'Show Attribute Nodes' }}
                                    </label>
                                    <label class="option-item">
                                        <input type="checkbox" v-model="graphFilter.showLabels">
                                        {{ store.locales === 'zh' ? '显示标签' : 'Show Labels' }}
                                    </label>
                                    <label class="option-item">
                                        <input type="checkbox" v-model="graphFilter.highlightRelations">
                                        {{ store.locales === 'zh' ? '高亮关联' : 'Highlight Relations' }}
                                    </label>
                                    <label class="option-item">
                                        <input type="checkbox" v-model="graphFilter.showArrows">
                                        {{ store.locales === 'zh' ? '显示箭头' : 'Show Arrows' }}
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- 右侧：图谱展示界面 -->
        <div class="graph-panel" @click="resetResponsePanel">
            <!-- 图谱控制栏 -->
            <div class="graph-controls">
                <div class="graph-title">
                    {{ store.locales === 'zh' ? '本体图谱' : 'Ontology Graph' }}
                    <span class="layout-badge" :class="ontologyState.layoutMode">
                        {{ ontologyState.layoutMode === 'force' ? (store.locales === 'zh' ? '力导向' : 'Force') : (store.locales === 'zh' ? '层次' : 'Hierarchical') }}
                    </span>
                </div>
                
                <!-- 筛选器 -->
                <div class="filter-controls">
                    <button @click="toggleAllLayers" 
                            class="filter-btn"
                            :class="{active: allLayersVisible, 'all-hidden': allLayersHidden}">
                        {{ store.locales === 'zh' ? '全部' : 'All' }}
                    </button>
                    <button @click="toggleLayerVisibility('attribute')" 
                            class="filter-btn attribute-btn"
                            :class="{active: graphFilter.visibleLayers.attribute}">
                        {{ store.locales === 'zh' ? '属性层' : 'Attributes' }}
                    </button>
                    <button @click="toggleLayerVisibility('data')" 
                            class="filter-btn data-btn"
                            :class="{active: graphFilter.visibleLayers.data}">
                        {{ store.locales === 'zh' ? '数据层' : 'Data' }}
                    </button>
                    <button @click="toggleLayerVisibility('logic')" 
                            class="filter-btn logic-btn"
                            :class="{active: graphFilter.visibleLayers.logic}">
                        {{ store.locales === 'zh' ? '逻辑层' : 'Logic' }}
                    </button>
                    <button @click="toggleLayerVisibility('decision')" 
                            class="filter-btn decision-btn"
                            :class="{active: graphFilter.visibleLayers.decision}">
                        {{ store.locales === 'zh' ? '决策层' : 'Decision' }}
                    </button>
                </div>
                
                <!-- 控制按钮 -->
                <div class="view-controls">
                    <button @click="toggleLayoutMode" class="view-btn" :title="store.locales === 'zh' ? '切换布局' : 'Toggle Layout'">
                        <i class="fa" :class="ontologyState.layoutMode === 'force' ? 'fa-random' : 'fa-th'"></i>
                    </button>
                    <button @click="centerGraph" class="view-btn" title="居中视图">
                        <i class="fa fa-crosshairs"></i>
                    </button>
                    <button @click="zoomInGraph" class="view-btn" title="放大">
                        <i class="fa fa-search-plus"></i>
                    </button>
                    <button @click="zoomOutGraph" class="view-btn" title="缩小">
                        <i class="fa fa-search-minus"></i>
                    </button>
                </div>
            </div>
            
            <!-- 图谱容器 -->
            <div class="graph-container">
                <!-- D3图谱容器 -->
                <svg ref="d3Svg" width="100%" height="100%" class="graph-svg"></svg>
                
                <!-- 工具提示 -->
                <div id="graph-tooltip" class="graph-tooltip"></div>
                
                <!-- 连接模式提示 -->
                <div v-if="manualInput.connectingNodes" class="connection-mode-hint">
                    <div class="hint-content">
                        <i class="fa fa-link hint-icon"></i>
                        <div class="hint-text">
                            {{ store.locales === 'zh' ? '连接模式已启用' : 'Connection mode enabled' }}
                        </div>
                        <div class="hint-subtext">
                            {{ store.locales === 'zh' ? '请在图谱上选择源节点和目标节点' : 'Please select source and target nodes on the graph' }}
                        </div>
                        <div class="hint-info" v-if="manualInput.sourceNode">
                            {{ store.locales === 'zh' ? '已选择源节点' : 'Source node selected' }}
                        </div>
                        <div class="hint-info" v-if="manualInput.targetNode">
                            {{ store.locales === 'zh' ? '已选择目标节点' : 'Target node selected' }}
                        </div>
                    </div>
                </div>
                
                <!-- 空状态 -->
                <div class="empty-state" v-if="ontologyGraph.nodes.length === 0">
                    <i class="fa fa-sitemap empty-icon"></i>
                    <div class="empty-title">
                        {{ store.locales === 'zh' ? '等待构建本体...' : 'Waiting for ontology construction...' }}
                    </div>
                    <div class="empty-hint">
                        {{ store.locales === 'zh' ? '在左侧输入自然语言描述来构建本体' : 'Enter natural language description on the left to build ontology' }}
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.ontology-container {
    display: flex;
    height: 100%;
    width: 100%;
    background-color: var(--backgroundColor);
    color: var(--fontColor);
}

/* 左侧控制面板样式 */
.control-panel {
    width: 250px;
    border-right: 1px solid var(--borderColor);
    display: flex;
    flex-direction: column;
    background-color: var(--menuColor);
}

/* 标签页切换 */
.panel-tabs {
    display: flex;
    border-bottom: 1px solid var(--borderColor);
    background-color: var(--backgroundColor);
}

.tab-btn {
    flex: 1;
    padding: 10px;
    border: none;
    background: none;
    color: var(--fontColor);
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    border-bottom: 1px solid transparent;
    transition: all 0.2s;
}

.tab-btn:hover {
    background-color: var(--borderColor);
}

.tab-btn.active {
    border-bottom-color: var(--fontActiveColor);
    color: var(--fontActiveColor);
}

.tab-content {
    flex: 1;
    overflow: hidden;
}

.tab-panel {
    height: 100%;
    display: flex;
    flex-direction: column;
}

/* 节点详情面板（在所有标签页都显示） */
.node-detail-full {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.node-detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px;
    background-color: var(--backgroundColor);
    border-bottom: 1px solid var(--borderColor);
    flex-shrink: 0;
}

.node-detail-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: bold;
    color: var(--fontColor);
}

.node-detail-content {
    flex: 1;
    overflow-y: auto;
    padding: 5px;
    font-size: 12px;
}

/* 编辑模式样式 */
.edit-mode {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

/* 查看模式样式 */
.view-mode {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.detail-section {
    margin-bottom: 5px;
}

.detail-section h4 {
    margin: 0 0 5px 0;
    font-size: 13px;
    font-weight: bold;
    color: var(--fontActiveColor);
    padding-bottom: 5px;
    border-bottom: 1px solid var(--borderColor);
}

.detail-item {
    display: flex;
    margin-bottom: 8px;
    line-height: 1.5;
}

.detail-item span:first-child {
    flex: 0 0 80px;
    font-weight: 500;
    color: #666;
    font-size: 11px;
}

.detail-item span:last-child {
    flex: 1;
    word-break: break-word;
}

.attributes-list {
    list-style: none;
    padding: 0;
    margin: 0;
}

.attributes-list li {
    padding: 5px 8px;
    margin-bottom: 4px;
    background-color: var(--backgroundColor);
    border-radius: 4px;
    border-left: 3px solid #2196F3;
    font-size: 11px;
}

/* 手动输入面板通用样式 */
.manual-section {
    margin-bottom: 5px;
}

.manual-section label {
    display: block;
    font-weight: 500;
    color: var(--fontColor);
    font-size: 11px;
    line-height: 20px;
}

.manual-input,
.manual-select,
.manual-textarea {
    width: 100%;
    padding: 6px;
    border: 1px solid var(--borderColor);
    border-radius: 4px;
    background-color: var(--backgroundColor);
    color: var(--fontColor);
    font-size: 12px;
    box-sizing: border-box;
    margin: 0px;
}

.manual-textarea {
    resize: vertical;
    min-height: 60px;
}

.manual-subsection {
    margin-bottom: 5px;
}

.strategy-actions,
.attributes-input {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.action-item,
.attribute-item {
    display: flex;
    gap: 5px;
    align-items: center;
}

.action-input,
.attribute-input {
    flex: 1;
}

.manual-actions {
    display: flex;
    gap: 5px;
    margin-top: 5px;
    padding-top: 5px;
    border-top: 1px solid var(--borderColor);
}

.remove-btn {
    padding: 4px 8px;
    border: 1px solid var(--borderColor);
    background-color: var(--backgroundColor);
    color: var(--fontColor);
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
}

.remove-btn:hover {
    background-color: #f44336;
    color: white;
    border-color: #f44336;
}

.add-btn {
    padding: 6px;
    border: 1px dashed var(--borderColor);
    background-color: var(--backgroundColor);
    color: var(--fontColor);
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    margin-top: 5px;
}

.add-btn:hover {
    border-color: var(--fontActiveColor);
    color: var(--fontActiveColor);
}

.manual-divider {
    text-align: center;
    margin: 5px 0;
    position: relative;
    color: var(--borderColor);
    font-size: 11px;
}

.manual-divider::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 1px;
    background-color: var(--borderColor);
    z-index: 1;
}

.manual-divider span {
    background-color: var(--menuColor);
    padding: 0 10px;
    position: relative;
    z-index: 2;
}

.manual-section h4 {
    margin: 0 0 10px 0;
    font-size: 13px;
    font-weight: bold;
    color: var(--fontActiveColor);
}

.connection-controls {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 10px;
    padding: 10px;
    background-color: var(--backgroundColor);
    border-radius: 4px;
    border: 1px solid var(--borderColor);
}

.connection-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
}

.node-id {
    font-family: monospace;
    color: #4CAF50;
    font-size: 10px;
    background-color: rgba(76, 175, 80, 0.1);
    padding: 2px 6px;
    border-radius: 3px;
}

/* 自然语言控制面板 */
.normal-control-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.config-bar {
    display: flex;
    align-items: center;
    padding: 5px;
    gap: 5px;
    border-bottom: 1px solid var(--borderColor);
    background-color: var(--backgroundColor);
    flex-shrink: 0;
}

.model-select {
    flex: 1;
    padding: 5px;
    margin: 0px;
    border-radius: 4px;
    border: 1px solid var(--borderColor);
    background-color: var(--menuColor);
    color: var(--fontColor);
    font-size: 12px;
    height: 32px;
}

.model-select.active {
    border-color: #4CAF50;
}

.model-select.offline {
    border-color: #e74c3c;
}

.mode-option {
    width: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    border-radius: 4px;
    border: 1px solid var(--borderColor);
    background-color: var(--backgroundColor);
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
}

.mode-option:hover {
    background-color: var(--borderColor);
}

.mode-option.active {
    background-color: var(--borderColor);
    border-color: var(--fontActiveColor);
    color: var(--fontActiveColor);
}

.mode-option input {
    display: none;
}

.mode-option i {
    font-size: 11px;
}

.input-area {
    padding: 5px;
    border-bottom: 1px solid var(--borderColor);
    flex-shrink: 0;
}

.input-text {
    width: calc(100% - 12px);
    height: 100px;
    padding: 5px;
    margin: 0px;
    border-radius: 4px;
    border: 1px solid var(--borderColor);
    background-color: var(--backgroundColor);
    color: var(--fontColor);
    resize: none;
    font-family: inherit;
    font-size: 13px;
}

.input-text:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

/* 四阶段推理控制 */
.four-stage-controls {
    padding: 5px;
    border-bottom: 1px solid var(--borderColor);
    flex-shrink: 0;
}

.stage-buttons-row {
    display: flex;
    gap: 5px;
}

.stage-buttons-row .btn {
    flex: 1;
    padding: 8px;
    font-size: 11px;
}

.btn-entity {
    background-color: #2196F3;
    color: white;
    border-color: #2196F3;
}

.btn-entity:hover:not(:disabled) {
    background-color: #1976D2;
}

.btn-attribute {
    background-color: #9C27B0;
    color: white;
    border-color: #9C27B0;
}

.btn-attribute:hover:not(:disabled) {
    background-color: #7B1FA2;
}

.btn-logic {
    background-color: #4CAF50;
    color: white;
    border-color: #4CAF50;
}

.btn-logic:hover:not(:disabled) {
    background-color: #388E3C;
}

.btn-decision {
    background-color: #FF9800;
    color: white;
    border-color: #FF9800;
}

.btn-decision:hover:not(:disabled) {
    background-color: #F57C00;
}

.control-buttons {
    display: flex;
    padding: 5px;
    gap: 5px;
    border-bottom: 1px solid var(--borderColor);
    flex-shrink: 0;
}

.btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    border-radius: 4px;
    border: 1px solid transparent;
    cursor: pointer;
    font-size: 12px;
    gap: 5px;
    transition: all 0.2s;
}

.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-primary {
    background-color: #2196F3;
    color: white;
    border-color: #2196F3;
}

.btn-primary:hover:not(:disabled) {
    background-color: #1976D2;
}

.btn-stop {
    background-color: #FF5722;
    color: white;
    border-color: #FF5722;
}

.btn-stop:hover:not(:disabled) {
    background-color: #E64A19;
}

.btn-clear {
    background-color: var(--menuColor);
    color: var(--fontColor);
    border-color: var(--borderColor);
}

.btn-clear:hover:not(:disabled) {
    background-color: var(--borderColor);
}

.btn-danger {
    background-color: #f44336;
    color: white;
    border-color: #f44336;
}

.btn-danger:hover:not(:disabled) {
    background-color: #d32f2f;
}

/* 推理状态指示器 */
.reasoning-status {
    padding: 5px;
    border-bottom: 1px solid var(--borderColor);
    background-color: rgba(156, 39, 176, 0.1);
}

.reasoning-progress {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.progress-stages {
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: relative;
}

.stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    z-index: 1;
    flex: 1;
}

.stage-dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background-color: #ccc;
    border: 2px solid white;
    transition: all 0.3s;
}

.stage.active .stage-dot {
    background-color: #9C27B0;
    transform: scale(1.2);
}

.stage.active {
    color: #9C27B0;
    font-weight: bold;
}

.stage-line {
    flex: 1;
    height: 2px;
    background-color: #ccc;
    position: relative;
    top: -8px;
}

.stage.active ~ .stage-line {
    background-color: #9C27B0;
}

.reasoning-stage-text {
    text-align: center;
    font-size: 11px;
    color: #9C27B0;
    font-weight: 500;
}

.response-area {
    flex: 1;
    border-top: 1px solid var(--borderColor);
    min-height: 0;
    overflow-y: auto;
    padding: 10px;
    line-height: 1.5;
    font-size: 12px;
    white-space: pre-wrap;
    word-break: break-word;
}

/* 手动输入面板样式 */
.manual-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.manual-content {
    flex: 1;
    overflow-y: auto;
    padding: 5px;
    font-size: 12px;
}

.btn-connect {
    background-color: var(--backgroundColor);
    color: var(--fontColor);
    border: 1px solid var(--borderColor);
}

.btn-connect:hover:not(:disabled) {
    background-color: var(--borderColor);
}

.btn-connect.connecting {
    background-color: #4CAF50;
    color: white;
    border-color: #4CAF50;
}

.btn-connect.connecting:hover {
    background-color: #388E3C;
}

/* 设置面板样式 */
.info-panel-full {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.info-content {
    flex: 1;
    overflow-y: auto;
    padding: 5px;
    font-size: 12px;
}

.stats-section {
    margin-bottom: 5px;
    padding-bottom: 5px;
    border-bottom: 1px solid var(--borderColor);
}

.stats-title {
    font-weight: bold;
    margin-bottom: 5px;
    color: var(--fontColor);
    font-size: 13px;
}

.stats-item {
    display: flex;
    justify-content: space-between;
    margin-bottom: 5px;
    color: var(--fontColor);
}

.stats-value {
    font-weight: bold;
    color: #2196F3;
}

.layer-stats {
    margin-top: 12px;
}

.layer-stat-title {
    font-weight: 500;
    margin-bottom: 5px;
    color: #666;
    font-size: 11px;
}

.layer-stat {
    display: flex;
    align-items: center;
    margin-bottom: 5px;
    font-size: 11px;
    color: #666;
}

.layer-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 5px;
}

.data-dot {
    background-color: #2196F3;
}

.logic-dot {
    background-color: #4CAF50;
}

.decision-dot {
    background-color: #FF9800;
}

.attribute-dot {
    background-color: #9C27B0;
}

.legend-section {
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid var(--borderColor);
}

.legend-title {
    font-weight: bold;
    margin-bottom: 12px;
    color: var(--fontColor);
    font-size: 13px;
}

.legend-item {
    display: flex;
    align-items: center;
    margin-bottom: 8px;
    color: var(--fontColor);
    font-size: 11px;
}

.legend-icon {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    margin-right: 10px;
    flex-shrink: 0;
}

.data-legend {
    background-color: #2196F3;
}

.logic-legend {
    background-color: #4CAF50;
}

.decision-legend {
    background-color: #FF9800;
}

.attribute-legend {
    background-color: #9C27B0;
}

.legend-line {
    width: 20px;
    height: 2px;
    margin-right: 10px;
    flex-shrink: 0;
}

.data-line {
    background-color: #2196F3;
}

.logic-line {
    background-color: #4CAF50;
    border-top: 1px dashed #4CAF50;
}

.attribute-line {
    background-color: #9C27B0;
    border-top: 1px solid #9C27B0;
}

.legend-arrow {
    width: 20px;
    height: 10px;
    margin-right: 5px;
    flex-shrink: 0;
    position: relative;
}

.legend-arrow::before {
    content: '';
    position: absolute;
    left: 0;
    right: 5px;
    top: 50%;
    height: 1px;
    background-color: #999;
}

.legend-arrow::after {
    content: '';
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 0;
    height: 0;
    border-left: 5px solid #999;
    border-top: 3px solid transparent;
    border-bottom: 3px solid transparent;
}

/* 布局设置 */
.layout-section {
    margin-bottom: 5px;
    padding-bottom: 5px;
    border-bottom: 1px solid var(--borderColor);
}

.layout-title {
    font-weight: bold;
    margin-bottom: 5px;
    color: var(--fontColor);
    font-size: 13px;
}

.layout-options {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

/* 提示词设置 */
.prompt-section {
    margin-bottom: 5px;
    padding-bottom: 5px;
    border-bottom: 1px solid var(--borderColor);
}

.prompt-title {
    font-weight: bold;
    margin-bottom: 5px;
    color: var(--fontColor);
    font-size: 13px;
}

.prompt-hint {
    font-size: 10px;
    color: #666;
    margin-bottom: 8px;
}

.prompt-textarea {
    width: 100%;
    padding: 5px;
    border: 1px solid var(--borderColor);
    border-radius: 4px;
    background-color: var(--backgroundColor);
    color: var(--fontColor);
    font-size: 11px;
    font-family: monospace;
    resize: vertical;
    min-height: 150px;
    margin-bottom: 8px;
    box-sizing: border-box;
}

.prompt-actions {
    display: flex;
    gap: 5px;
}

.file-section {
    margin-bottom: 5px;
    padding-bottom: 5px;
    border-bottom: 1px solid var(--borderColor);
}

.file-title {
    font-weight: bold;
    margin-bottom: 5px;
    color: var(--fontColor);
    font-size: 13px;
}

.file-actions {
    display: flex;
    gap: 5px;
    margin-bottom: 5px;
}

.file-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
}

.file-hint {
    font-size: 10px;
    color: #666;
    text-align: center;
}

.display-section {
    margin-bottom: 5px;
}

.display-title {
    font-weight: bold;
    margin-bottom: 12px;
    color: var(--fontColor);
    font-size: 13px;
}

.display-options {
    display: flex;
    flex-direction: column;
    gap: 0px;
}

.option-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    cursor: pointer;
}

.option-item input {
    margin: 0;
}

/* 右侧图谱面板样式 */
.graph-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    background-color: var(--backgroundColor);
}

.graph-controls {
    display: flex;
    align-items: center;
    padding: 6px;
    border-bottom: 1px solid var(--borderColor);
    gap: 5px;
    flex-shrink: 0;
}

.graph-title {
    font-weight: bold;
    font-size: 14px;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 8px;
}

.layout-badge {
    padding: 2px 6px;
    border-radius: 10px;
    font-size: 10px;
    font-weight: normal;
}

.layout-badge.force {
    background-color: #2196F3;
    color: white;
}

.layout-badge.hierarchical {
    background-color: #9C27B0;
    color: white;
}

.filter-controls {
    display: flex;
    gap: 4px;
}

.filter-btn {
    padding: 4px 10px;
    border-radius: 4px;
    border: 1px solid var(--borderColor);
    background-color: var(--backgroundColor);
    color: var(--fontColor);
    cursor: pointer;
    font-size: 11px;
    transition: all 0.2s;
}

.filter-btn:hover {
    background-color: var(--borderColor);
}

.filter-btn.active {
    color: white;
}

.filter-btn.active.data-btn {
    background-color: #2196F3;
    border-color: #2196F3;
}

.filter-btn.active.logic-btn {
    background-color: #4CAF50;
    border-color: #4CAF50;
}

.filter-btn.active.decision-btn {
    background-color: #FF9800;
    border-color: #FF9800;
}

.filter-btn.active.attribute-btn {
    background-color: #9C27B0;
    border-color: #9C27B0;
}

.filter-btn.all-hidden {
    background-color: #f44336;
    border-color: #f44336;
    color: white;
}

.filter-btn.active:not(.all-hidden) {
    opacity: 1;
}

.filter-btn:not(.active) {
    opacity: 0.6;
}

.view-controls {
    display: flex;
    gap: 4px;
    margin-left: auto;
}

.view-btn {
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid var(--borderColor);
    background-color: var(--backgroundColor);
    color: var(--fontColor);
    cursor: pointer;
    font-size: 11px;
    transition: all 0.2s;
}

.view-btn:hover {
    background-color: var(--borderColor);
}

.graph-container {
    flex: 1;
    position: relative;
    overflow: hidden;
}

.graph-svg {
    display: block;
    background-color: var(--backgroundColor);
}

.graph-tooltip {
    display: none;
    position: fixed;
    background: var(--menuColor);
    border: 1px solid var(--borderColor);
    border-radius: 4px;
    padding: 8px;
    font-size: 12px;
    max-width: 300px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    z-index: 1000;
    pointer-events: none;
}

.graph-tooltip div {
    margin-bottom: 2px;
}

.graph-tooltip strong {
    color: #333;
}

/* 连接模式提示 */
.connection-mode-hint {
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(76, 175, 80, 0.9);
    color: white;
    padding: 10px 15px;
    border-radius: 4px;
    z-index: 1000;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
}

.hint-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
}

.hint-icon {
    font-size: 18px;
}

.hint-text {
    font-weight: bold;
    font-size: 12px;
}

.hint-subtext {
    font-size: 11px;
    opacity: 0.9;
}

.hint-info {
    font-size: 10px;
    background-color: rgba(255,255,255,0.2);
    padding: 3px 8px;
    border-radius: 3px;
    margin-top: 3px;
}

/* 空状态 */
.empty-state {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: var(--fontColor);
}

.empty-icon {
    font-size: 48px;
    color: var(--borderColor);
    margin-bottom: 12px;
}

.empty-title {
    font-size: 14px;
    margin-bottom: 6px;
    color: var(--fontColor);
}

.empty-hint {
    font-size: 12px;
    color: var(--borderColor);
}

.close-btn {
    padding: 4px 8px;
    border: none;
    background: none;
    color: var(--fontColor);
    cursor: pointer;
    border-radius: 4px;
}

.close-btn:hover {
    background-color: var(--borderColor);
}
</style>