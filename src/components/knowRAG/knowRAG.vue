<!-- /knowRAG.vue -->
<script setup lang="ts">
import {onMounted,onBeforeUnmount,ref, nextTick,computed, watch, reactive} from 'vue'
import {Ollama} from 'ollama/dist/browser.mjs'
import block_md from '../block_md.vue'
import md_read from '../knowFile/view/md_read.vue'
import pdf_preview from '../other/pdf_preview.vue'
import testManager from './testManager.vue'
import configManager from './configManager.vue'

import OntologyViewer from './OntologyViewer.vue'
const ontologyData = ref<{
  nodes: any[],
  edges: any[]
}>({
  nodes: [],
  edges: []
})

let idCounters = {
    block: 0,
    entity: 0,
    relation: 0
}

// 生成简短ID
const shortId = (type: 'block' | 'entity' | 'relation'): string => {
    idCounters[type]++
    const prefix = type === 'block' ? 'b' : (type === 'entity' ? 'e' : 'r')
    return `${prefix}${idCounters[type]}`
}

// 重置ID计数器（构建本体前调用）
const resetIdCounters = () => {
    idCounters = { block: 0, entity: 0, relation: 0 }
}

const handleNodeClick = (node:any) => {
  console.log('点击节点:', node)
}

import * as d3 from 'd3';
import { Matrix,SingularValueDecomposition } from 'ml-matrix'
import {usestore} from '../../store'
const store=usestore()

let files = ref([]) as any
const selectedFileIndex = ref(-1) as any
let documents = ref([{name:'全部'}]) as any
let documentName = ref("全部") as any
let blocks = ref([]) as any
let panel = ref("管理")
let viewMode = ref('file')
let prompt = ref("")
let result = ref(store.locales=="zh"?"未推理":"Unreasoned")
let kb_state = ref("")
let knowledgeBases = ref([]) as any
let selectedKbIndex = ref(0) as any

let ollama = null as any
let model = ref({
    url:"http://127.0.0.1:11434",
    list:[] as any,
    think:false,
    embed:"nomic-embed-text:latest",
    process:store.AIconfig.llm.ollama.model,
    processPrompt:store.locales=="zh"?"请根据如下资料，提出这些资料能够解答的若干个问题，不要返回其他表述。资料如下：":"Based on the following information, please raise several questions that these materials can answer. Do not return any other expressions. The information is as follows:",
    searchMethod:"CS",
    searchMode:"按数量",
    matchRatio:0.58,
    searchNum:10,
    searchCharacter:2500,
    chat:store.AIconfig.llm.ollama.model,
    sliceStrategy:"默认",
    mdsIterations: 50,
    mdsEpsilon: 0.1,
    pcaComponents: 2,
    tsnePerplexity: 30,
    tsneIterations: 1000,
    tsneLearningRate: 200,
    umapNeighbors: 15,
    umapMinDist: 0.1,
    umapSpread: 1.0,
    summaryWeight: 0.0,
    sliceWeight: 1.0,
    useReverseInference: false,
    reverseInferenceWeight: 0.3,
    // BM25相关配置
    bm25Enabled: false,
    bm25Weight: 0.3,
    bm25K1: 1.5,
    bm25B: 0.75,
    cosineWeight: 0.7,
    // 本体构建配置
    ontologyBatchSize: 8,
    autoBuildOntology: false,
    // 本体检索增强权重（仅实体）
    entityBoostWeight: 1.5,
})

// ==================== 手动添加实体相关状态 ====================
const showAddEntityModal = ref(false)
const newEntityName = ref('')
const isAddingEntity = ref(false)
const addEntityError = ref('')

// 新增：实时匹配统计
const matchStats = ref({
    matchedBlocksCount: 0,
    isDuplicate: false,
    duplicateName: '',
    matchedFilePaths: [] as string[]
})

// 新增：实时搜索匹配切片
const searchMatchingBlocks = () => {
    const name = newEntityName.value.trim()
    
    if (!name) {
        matchStats.value = {
            matchedBlocksCount: 0,
            isDuplicate: false,
            duplicateName: '',
            matchedFilePaths: []
        }
        addEntityError.value = ''
        return
    }
    
    if (name.length > 100) {
        matchStats.value = {
            matchedBlocksCount: 0,
            isDuplicate: false,
            duplicateName: '',
            matchedFilePaths: []
        }
        addEntityError.value = store.locales === 'zh' ? '实体名称不能超过100个字符' : 'Entity name cannot exceed 100 characters'
        return
    }
    
    // 检查是否重复
    const key = name.toLowerCase()
    const isDuplicate = globalEntities.value.has(key)
    const duplicateName = isDuplicate ? globalEntities.value.get(key)?.name || '' : ''
    
    if (blocks.value.length === 0) {
        matchStats.value = {
            matchedBlocksCount: 0,
            isDuplicate,
            duplicateName,
            matchedFilePaths: []
        }
        addEntityError.value = store.locales === 'zh' ? '没有切片数据，请先处理文件' : 'No slice data, please process files first'
        return
    }
    
    // 搜索匹配的切片
    const matchedBlockIds: string[] = []
    const matchedFilePaths: string[] = []
    
    for (const block of blocks.value) {
        let isMatched = false
        
        // 在切片内容中搜索
        if (block.A && block.A.includes(name)) {
            isMatched = true
        }
        
        // 在问题中搜索
        if (!isMatched && block.Q && block.Q !== '问题未推理' && block.Q.includes(name)) {
            isMatched = true
        }
        
        if (isMatched) {
            if (!matchedBlockIds.includes(block.id)) {
                matchedBlockIds.push(block.id)
            }
            if (!matchedFilePaths.includes(block.filePath)) {
                matchedFilePaths.push(block.filePath)
            }
        }
    }
    
    matchStats.value = {
        matchedBlocksCount: matchedBlockIds.length,
        isDuplicate,
        duplicateName,
        matchedFilePaths
    }
    
    // 清除之前的错误（如果没有问题的话）
    if (matchedBlockIds.length === 0) {
        addEntityError.value = store.locales === 'zh' ? 
            `未找到包含"${name}"的切片` : 
            `No blocks containing "${name}" found`
    } else if (isDuplicate) {
        addEntityError.value = store.locales === 'zh' ? 
            `实体"${name}"已存在，添加将更新关联切片` : 
            `Entity "${name}" already exists, adding will update associations`
    } else {
        addEntityError.value = ''
    }
}

// 监听实体名称变化，实时更新匹配统计
watch(newEntityName, () => {
    searchMatchingBlocks()
})

// 打开模态框时重置并清空统计
const openAddEntityModal = () => {
    newEntityName.value = ''
    addEntityError.value = ''
    matchStats.value = {
        matchedBlocksCount: 0,
        isDuplicate: false,
        duplicateName: '',
        matchedFilePaths: []
    }
    showAddEntityModal.value = true
    // 下一帧聚焦输入框
    nextTick(() => {
        const input = document.getElementById('newEntityNameInput')
        if (input) input.focus()
    })
}

// 关闭模态框
const closeAddEntityModal = () => {
    if (isAddingEntity.value) return // 正在添加中不允许关闭
    showAddEntityModal.value = false
    newEntityName.value = ''
    addEntityError.value = ''
}

// 手动添加实体
const addEntityManually = async () => {
    const name = newEntityName.value.trim()
    
    // 验证
    if (!name) {
        addEntityError.value = store.locales === 'zh' ? '请输入实体名称' : 'Please enter entity name'
        return
    }
    
    if (name.length > 100) {
        addEntityError.value = store.locales === 'zh' ? '实体名称不能超过100个字符' : 'Entity name cannot exceed 100 characters'
        return
    }
    
    // 检查是否已存在
    const key = name.toLowerCase()
    if (globalEntities.value.has(key)) {
        addEntityError.value = store.locales === 'zh' ? 
            `实体"${name}"已存在` : 
            `Entity "${name}" already exists`
        return
    }
    
    if (blocks.value.length === 0) {
        addEntityError.value = store.locales === 'zh' ? 
            '没有切片数据，请先处理文件' : 
            'No slice data, please process files first'
        return
    }
    
    isAddingEntity.value = true
    addEntityError.value = ''
    kb_state.value = store.locales === 'zh' ? 
        `正在添加实体"${name}"...` : 
        `Adding entity "${name}"...`
    
    try {
        // 查找所有匹配的切片
        const matchedBlocks: any[] = []
        const matchedBlockIds: string[] = []
        const matchedFilePaths: string[] = []
        
        for (const block of blocks.value) {
            let isMatched = false
            
            // 在切片内容中搜索
            if (block.A && block.A.includes(name)) {
                isMatched = true
            }
            
            // 在问题中搜索
            if (!isMatched && block.Q && block.Q !== '问题未推理' && block.Q.includes(name)) {
                isMatched = true
            }
            
            if (isMatched) {
                matchedBlocks.push(block)
                if (!matchedBlockIds.includes(block.id)) {
                    matchedBlockIds.push(block.id)
                }
                if (!matchedFilePaths.includes(block.filePath)) {
                    matchedFilePaths.push(block.filePath)
                }
            }
        }
        
        if (matchedBlocks.length === 0) {
            addEntityError.value = store.locales === 'zh' ? 
                `未找到包含"${name}"的切片，请检查实体名称` : 
                `No blocks containing "${name}" found, please check entity name`
            isAddingEntity.value = false
            return
        }
        
        // 创建新实体
        const newEntity: OntologyEntity = {
            id: shortId('entity'),
            name: name,
            type: 'entity',
            nodeType: 'entity',
            layer: 'data',
            description: '',
            associatedBlocks: matchedBlockIds,
            associatedFiles: matchedFilePaths
        }
        
        // 添加到全局实体
        globalEntities.value.set(key, newEntity)
        
        // 更新索引
        if (!entityToBlocksIndex.value.has(key)) {
            entityToBlocksIndex.value.set(key, new Set())
        }
        for (const blockId of matchedBlockIds) {
            entityToBlocksIndex.value.get(key)!.add(blockId)
        }
        
        // 更新视图
        updateOntologyViewer()
        updateEntityCards()
        
        kb_state.value = store.locales === 'zh' ? 
            `实体"${name}"已添加，关联${matchedBlockIds.length}个切片，正在生成描述...` : 
            `Entity "${name}" added, associated with ${matchedBlockIds.length} blocks, generating description...`
        
        // 生成描述
        await reasonEntityDescription(newEntity)
        
        // 刷新卡片视图
        updateEntityCards()
        handleCardSearch()
        
        // 更新本体视图
        updateOntologyViewer()
        
        kb_state.value = store.locales === 'zh' ? 
            `实体"${name}"添加完成！关联${matchedBlockIds.length}个切片` : 
            `Entity "${name}" added successfully! Associated with ${matchedBlockIds.length} blocks`
        
        // 关闭模态框
        showAddEntityModal.value = false
        newEntityName.value = ''
        
    } catch (error) {
        console.error('添加实体失败:', error)
        addEntityError.value = store.locales === 'zh' ? 
            `添加失败: ${error}` : 
            `Failed to add: ${error}`
        kb_state.value = store.locales === 'zh' ? 
            `添加实体"${name}"失败` : 
            `Failed to add entity "${name}"`
    } finally {
        isAddingEntity.value = false
    }
}

// 编辑实体描述
const isEditingDescription = ref(false)
const saveDescriptionToGlobal = () => {
    if (!selectedEntityForCards.value) return
    const key = selectedEntityForCards.value.name.toLowerCase()
    const existing = globalEntities.value.get(key)
    if (existing) {
        existing.description = selectedEntityForCards.value.description
        globalEntities.value.set(key, existing)
        updateEntityCards()
        updateOntologyViewer()
    }
}
// 文件摘要信息存储
let fileSummaries = ref(new Map()) as any

// 保证 summaryWeight 和 sliceWeight 和为 1
watch(() => model.value.summaryWeight, (val) => {
    const v = Number(val) || 0
    model.value.sliceWeight = Math.max(0, Math.min(1, 1 - v))
})

// 保证 cosineWeight 和 bm25Weight 和为 1
watch(() => model.value.bm25Weight, (val) => {
    const v = Number(val) || 0
    model.value.cosineWeight = Math.max(0, Math.min(1, 1 - v))
})

const filteredBlocks = computed(() => {
    if (documentName.value === '全部') {
        return blocks.value;
    } else {
        return blocks.value.filter((block: any) => block.label === documentName.value);
    }
});

// ========== 滚动加载（无限滚动）相关状态 ==========
const LOAD_CHUNK_SIZE = 40
const displayedCount = ref(LOAD_CHUNK_SIZE)
const isLoadingMore = ref(false)
const hasMoreBlocks = computed(() => {
    return displayedCount.value < filteredBlocks.value.length
})

const displayedBlocks = computed(() => {
    return filteredBlocks.value.slice(0, displayedCount.value)
})

function loadMoreBlocks() {
    if (isLoadingMore.value || !hasMoreBlocks.value) return
    
    isLoadingMore.value = true
    
    requestAnimationFrame(() => {
        setTimeout(() => {
            const nextCount = Math.min(
                displayedCount.value + LOAD_CHUNK_SIZE, 
                filteredBlocks.value.length
            )
            displayedCount.value = nextCount
            isLoadingMore.value = false
        }, 50)
    })
}

function handleScroll(event: Event) {
    const container = event.target as HTMLElement
    if (!container) return
    
    const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    
    if (scrollBottom < 200 && hasMoreBlocks.value && !isLoadingMore.value) {
        loadMoreBlocks()
    }
}

function resetScrollLoad() {
    displayedCount.value = LOAD_CHUNK_SIZE
    isLoadingMore.value = false
}

watch(() => documentName.value, () => {
    resetScrollLoad()
})

watch(() => blocks.value.length, () => {
    resetScrollLoad()
})

// ==================== 问题提取状态管理 ====================
interface ExtractProgress {
    isRunning: boolean
    isPaused: boolean
    currentIndex: number
    totalCount: number
    startTime: number | null
}

const extractProgress = ref<ExtractProgress>({
    isRunning: false,
    isPaused: false,
    currentIndex: 0,
    totalCount: 0,
    startTime: null
})

const saveExtractProgress = () => {
    const progressToSave = {
        currentIndex: extractProgress.value.currentIndex,
        totalCount: extractProgress.value.totalCount,
        startTime: extractProgress.value.startTime
    }
    localStorage.setItem('extractProgress', JSON.stringify(progressToSave))
}

const loadExtractProgress = () => {
    const saved = localStorage.getItem('extractProgress')
    if (saved) {
        try {
            const progress = JSON.parse(saved)
            if (progress.startTime && Date.now() - progress.startTime < 3600000) {
                extractProgress.value.currentIndex = progress.currentIndex
                extractProgress.value.totalCount = progress.totalCount
                extractProgress.value.isPaused = true
                return true
            }
        } catch (e) {}
    }
    return false
}

const clearExtractProgress = () => {
    localStorage.removeItem('extractProgress')
    extractProgress.value = {
        isRunning: false,
        isPaused: false,
        currentIndex: 0,
        totalCount: 0,
        startTime: null
    }
}

const extractProgressPercent = computed(() => {
    if (extractProgress.value.totalCount === 0) return 0
    return Math.round((extractProgress.value.currentIndex / extractProgress.value.totalCount) * 100)
})

const extractProgressText = computed(() => {
    return `提取问题: ${extractProgress.value.currentIndex}/${extractProgress.value.totalCount} (${extractProgressPercent.value}%)`
})

const pauseExtract = () => {
    if (extractProgress.value.isRunning && !extractProgress.value.isPaused) {
        extractProgress.value.isPaused = true
        saveExtractProgress()
        kb_state.value = store.locales === 'zh' ? '问题提取已暂停，点击"继续"按钮恢复' : 'Extraction paused, click "Resume" to continue'
    }
}

// ==================== 本体构建独立状态管理 ====================
interface BuildProgress {
    isRunning: boolean
    isPaused: boolean
    currentBatchIndex: number
    totalBatches: number
    currentFileIndex: number
    totalFiles: number
    currentBatchInFile: number
    totalBatchesInFile: number
    startTime: number | null
    savedOntologyState: {
        entities: any[]
        relations: any[]
        entityToBlocksIndex: any[]
    } | null
}

const buildProgress = ref<BuildProgress>({
    isRunning: false,
    isPaused: false,
    currentBatchIndex: 0,
    totalBatches: 0,
    currentFileIndex: 0,
    totalFiles: 0,
    currentBatchInFile: 0,
    totalBatchesInFile: 0,
    startTime: null,
    savedOntologyState: null
})

const saveBuildProgress = () => {
    const ontologyState = {
        entities: Array.from(globalEntities.value.entries()).map(([key, entity]) => ({
            key: key,
            id: entity.id,
            name: entity.name,
            type: entity.type,
            nodeType: entity.nodeType,
            layer: entity.layer,
            description: entity.description,
            associatedBlocks: entity.associatedBlocks,
            associatedFiles: entity.associatedFiles
        })),
        relations: Array.from(globalRelations.value.entries()).map(([key, relation]) => ({
            key: key,
            id: relation.id,
            source: relation.source,
            target: relation.target,
            type: relation.type,
            layer: relation.layer,
            description: relation.description,
            sourceBlocks: relation.sourceBlocks
        })),
        entityToBlocksIndex: Array.from(entityToBlocksIndex.value.entries()).map(([entityName, blockIds]) => ({
            entityName: entityName,
            blockIds: Array.from(blockIds)
        }))
    }
    
    const progressToSave = {
        currentBatchIndex: buildProgress.value.currentBatchIndex,
        totalBatches: buildProgress.value.totalBatches,
        currentFileIndex: buildProgress.value.currentFileIndex,
        totalFiles: buildProgress.value.totalFiles,
        currentBatchInFile: buildProgress.value.currentBatchInFile,
        totalBatchesInFile: buildProgress.value.totalBatchesInFile,
        startTime: buildProgress.value.startTime,
        savedOntologyState: ontologyState
    }
    localStorage.setItem('buildProgressV3', JSON.stringify(progressToSave))
}

const loadBuildProgress = () => {
    const saved = localStorage.getItem('buildProgressV3')
    if (saved) {
        try {
            const progress = JSON.parse(saved)
            if (progress.startTime && Date.now() - progress.startTime < 3600000) {
                buildProgress.value.currentBatchIndex = progress.currentBatchIndex
                buildProgress.value.totalBatches = progress.totalBatches
                buildProgress.value.currentFileIndex = progress.currentFileIndex
                buildProgress.value.totalFiles = progress.totalFiles
                buildProgress.value.currentBatchInFile = progress.currentBatchInFile
                buildProgress.value.totalBatchesInFile = progress.totalBatchesInFile
                buildProgress.value.isPaused = true
                buildProgress.value.savedOntologyState = progress.savedOntologyState
                return true
            }
        } catch (e) {}
    }
    return false
}

const clearBuildProgress = () => {
    localStorage.removeItem('buildProgressV3')
    buildProgress.value = {
        isRunning: false,
        isPaused: false,
        currentBatchIndex: 0,
        totalBatches: 0,
        currentFileIndex: 0,
        totalFiles: 0,
        currentBatchInFile: 0,
        totalBatchesInFile: 0,
        startTime: null,
        savedOntologyState: null
    }
}

const buildProgressPercent = computed(() => {
    if (buildProgress.value.totalBatches === 0) return 0
    return Math.round((buildProgress.value.currentBatchIndex / buildProgress.value.totalBatches) * 100)
})

const buildProgressText = computed(() => {
    return `构建本体: ${buildProgress.value.currentBatchIndex}/${buildProgress.value.totalBatches} (${buildProgressPercent.value}%)`
})

const pauseBuildOntology = () => {
    if (buildProgress.value.isRunning && !buildProgress.value.isPaused) {
        buildProgress.value.isPaused = true
        saveBuildProgress()
        kb_state.value = store.locales === 'zh' ? '本体构建已暂停，点击"继续"按钮恢复' : 'Ontology building paused, click "Resume" to continue'
    }
}

const stopBuildOntology = () => {
    buildProgress.value.isRunning = false
    buildProgress.value.isPaused = false
    clearBuildProgress()
    kb_state.value = store.locales === 'zh' ? '本体构建已停止' : 'Ontology building stopped'
}

const setOntologyBatchSize = (size: number) => {
    model.value.ontologyBatchSize = Math.max(1, Math.min(50, size))
}

function computeBM25Score(query: string, documents: string[], k1: number = 1.5, b: number = 0.75): number[] {
    const avgDocLength = documents.reduce((sum, doc) => sum + doc.length, 0) / documents.length;
    const scores: number[] = [];
    
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    
    const docFreq: {[term: string]: number} = {};
    const termFreqs: {[term: string]: number}[] = [];
    
    for (const doc of documents) {
        const terms = doc.toLowerCase().split(/\s+/);
        const tf: {[term: string]: number} = {};
        const seenTerms = new Set<string>();
        
        for (const term of terms) {
            tf[term] = (tf[term] || 0) + 1;
            if (!seenTerms.has(term)) {
                docFreq[term] = (docFreq[term] || 0) + 1;
                seenTerms.add(term);
            }
        }
        termFreqs.push(tf);
    }
    
    const N = documents.length;
    
    for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        const tf = termFreqs[i];
        let score = 0;
        const docLength = doc.length;
        
        for (const term of queryTerms) {
            if (docFreq[term] && tf[term]) {
                const idf = Math.log((N - (docFreq[term] || 0) + 0.5) / ((docFreq[term] || 0) + 0.5) + 1);
                const termFreq = tf[term] || 0;
                const numerator = termFreq * (k1 + 1);
                const denominator = termFreq + k1 * (1 - b + b * docLength / avgDocLength);
                score += idf * numerator / denominator;
            }
        }
        scores.push(score);
    }
    
    const maxScore = Math.max(...scores, 1);
    return scores.map(s => s / maxScore);
}

async function getModel(){
    let ollama = new Ollama({host: model.value.url})
    try {
        let result = await ollama.list()
        if (result && result.models) {
            model.value.list = JSON.parse(JSON.stringify(result.models))
        }
    } catch (error) {
        console.error('Fetch error:', error);
        kb_state.value="ollama未在运行"
    }
}

async function loadFolderFiles(rootPath?: string) {
    viewMode.value = 'file'
    files.value = []
    previewContent.value = ''
    documents.value = [{name: '全部'}]
    documentName.value = '全部'
    blocks.value = []
    fileSummaries.value.clear()
    resetScrollLoad()
    clearExtractProgress()
    clearBuildProgress()

    const root = rootPath || store.root
    if (!root) {
        kb_state.value = '未选择文件夹'
        return
    }

    kb_state.value = '正在读取文件列表...'

    const result = await window.ipcRenderer.invoke('getFilesRelation', root, 3)
    if (!result || !result.fileList) {
        kb_state.value = '获取文件列表失败'
        return
    }

    const fileList = result.fileList.filter((f: any) => 
        f.type === 'file' && !f.path.toLowerCase().endsWith('.kb')
    )

    files.value = fileList.map((f: any) => ({
        label: f.label,
        path: f.path,
        extension: f.extension,
        size: f.size || 0,
        content: '',
        attributes: f.attributes || {}
    }))

    for (const f of files.value) {
        const name = f.label && f.label.lastIndexOf('.') > 0 ? f.label.substring(0, f.label.lastIndexOf('.')) : f.label
        documents.value.push({ name })
    }

    kb_state.value = `读取到 ${files.value.length} 个文件，正在读取内容...`
    
    const nonPdfFiles = files.value.filter((f:any) => !isPdfFile(f.extension))
    kb_state.value = `读取到 ${files.value.length} 个文件，正在读取 ${nonPdfFiles.length} 个非PDF文件内容...`
    
    for (let i = 0; i < files.value.length; i++) {
        try {
            const file = files.value[i]
            const ext = file.extension?.toLowerCase()
            
            if (isPdfFile(ext)) {
                file.content = '[PDF文件 - 使用预览功能查看]'
                continue
            }
            
            if (isWordFile(ext)) {
                const result = await window.ipcRenderer.invoke('readFile', file.path)
                
                if (typeof result === 'object' && result !== null) {
                    if (result.success === false) {
                        file.content = result.content || `[Word文档读取失败]`
                    } else {
                        file.content = result.content || ''
                    }
                } else {
                    file.content = result ?? ''
                }
                
                extractFileSummary(file)
                continue
            }
            
            const content = await window.ipcRenderer.invoke('readFile', file.path)
            file.content = content ?? ''
            
            extractFileSummary(file)
        } catch (err) {
            const errorMessage = getErrorMessage(err)
            console.error('读取文件内容失败', files.value[i].path, errorMessage)
            
            if (isPdfFile(files.value[i].extension)) {
                files.value[i].content = '[PDF文件 - 预览时加载]'
            } else if (isWordFile(files.value[i].extension)) {
                files.value[i].content = store.locales == 'zh' ? 
                    `[Word文档读取失败: ${errorMessage}]` : 
                    `[Word document read failed: ${errorMessage}]`
            } else {
                files.value[i].content = store.locales == 'zh' ? 
                    `读取失败: ${errorMessage}` : 
                    `Read failed: ${errorMessage}`
            }
        }
    }

    kb_state.value = `已处理 ${files.value.length} 个文件`;

    if (files.value.length > 0) {
        if (isPdfFile(files.value[0].extension)) {
            previewContent.value = store.locales == 'zh' ? 
                'PDF文件 - 使用右侧预览功能查看内容' : 
                'PDF file - Use the preview function on the right to view content'
        } else {
            previewContent.value = stripFrontmatter(files.value[0].content || '')
        }
        selectedFileIndex.value = 0
    }

    await scanKnowledgeBases()
    return files.value
}

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

async function getFileSummaryVector(filePath: string) {
    const summaryInfo = fileSummaries.value.get(filePath)
    if (!summaryInfo || !summaryInfo.content) return null
    
    if (summaryInfo.vector) return summaryInfo.vector
    
    try {
        ollama = new Ollama({ host: model.value.url });
        const embedResponse = await ollama.embed({
            model: model.value.embed,
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

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message
    } else if (typeof error === 'string') {
        return error
    } else if (error && typeof error === 'object' && 'message' in error) {
        return String((error as any).message)
    } else {
        return '未知错误'
    }
}

function stripFrontmatter(content: string) {
    if (!content || typeof content !== 'string') return content
    const fmRegex = /^\s*---\r?\n[\s\S]*?\r?\n---\r?\n?/;
    if (fmRegex.test(content)) {
        return content.replace(fmRegex, '').replace(/^\s+/, '')
    }
    return content
}

const openFolder = async function() {
    try {
        store.root = await window.ipcRenderer.invoke('openFolderDialog')
        if (!store.root) {
            kb_state.value = '未选择文件夹'
            return
        }

        await loadFolderFiles(store.root)
        await loadKnowledgeBases()
    } catch (error) {
        console.error('打开文件夹失败', error)
        kb_state.value = '打开文件夹失败'
    }
}

const process = async function() {
    try {
        ollama = new Ollama({ host: model.value.url });
        let { fileList, relationList } = await window.ipcRenderer.invoke("getFilesRelation", store.root, 3);
        
        files.value = fileList
            .filter((obj: any) => obj.type === 'file' && !obj.path.toLowerCase().endsWith('.kb'))
            .map((obj: any, index: number) => {
                return { ...obj };
            });
        kb_state.value = "读取到" + files.value.length + "个文件。正在处理...";
        documents.value = [{name:'全部'}];
        blocks.value = [];
        fileSummaries.value.clear();
        resetScrollLoad();
        clearExtractProgress();
        clearBuildProgress();
        
        for (let i = 0; i < files.value.length; i++) {
            try {
                let result = await window.ipcRenderer.invoke('readFile', files.value[i].path);
                
                let fileContent = result;
                if (typeof result === 'object' && result !== null) {
                    if (result.success === false) {
                        kb_state.value = `文件 ${files.value[i].label} 读取失败: ${result.error}`;
                        continue;
                    }
                    fileContent = result.content || '';
                }
                
                if (fileContent != undefined) {
                    files.value[i].content = fileContent;
                    extractFileSummary(files.value[i]);
                    documents.value.push({
                        name: files.value[i].label.substring(0, files.value[i].label.lastIndexOf('.')),
                    });
                    
                    let contentWithoutYaml = stripFrontmatter(fileContent);
                    
                    let block = [];
                    
                    if (model.value.sliceStrategy === '智能') {
                        block = splitByHeadings(contentWithoutYaml);
                        kb_state.value = `文件 ${files.value[i].label} 使用智能策略，识别到 ${block.length} 个一级标题段落`;
                    } else {
                        block = contentWithoutYaml.split(/(?:\r?\n){3,}/);
                        kb_state.value = `文件 ${files.value[i].label} 使用默认策略，切分为 ${block.length} 个段落`;
                    }
                    
                    block = block.filter((para: string) => para.trim().length > 0);
                    
                    kb_state.value = "读取到" + files.value.length + "个文件，正在切分第" + (i + 1) + "个文件并向量化。";
                    
                    if (block.length > 0) {
                        try {
                            const response = await ollama.embed({
                                model: model.value.embed,
                                input: block,
                                truncate: true,
                                keep_alive: "1h",
                            });

                            if (!response || !response.embeddings) {
                                throw new Error("向量化处理错误，请检查ollama的embed模型。");
                            }

                            for (let bi = 0; bi < block.length; bi++) {
                                const string = block[bi]
                                const emb = response.embeddings[bi]
                                blocks.value.push({
                                    id: shortId('block'),
                                    filePath: files.value[i].path,
                                    label: files.value[i].label.substring(0, files.value[i].label.lastIndexOf('.')),
                                    path: files.value[i].path,
                                    extension: files.value[i].extension,
                                    A: string,
                                    A_vector: emb,
                                    Q: '问题未推理',
                                    Q_vector: [],
                                    p: 0,
                                    state: false,
                                    show: 'A',
                                });
                                scheduleRefreshAtlas(120)
                            }
                        } catch (embedError) {
                            console.error("向量化处理失败:", embedError);
                            kb_state.value = `文件 ${files.value[i].label} 向量化失败`;
                            continue;
                        }
                    } else {
                        kb_state.value = `文件 ${files.value[i].label} 没有可切片的内容`;
                    }
                }
            } catch (fileError) {
                console.error("文件读取失败:", fileError);
                kb_state.value = `文件 ${files.value[i].label} 读取失败`;
                continue;
            }
        }
        kb_state.value = "";
        
        viewMode.value = 'slice'
    } catch (globalError) {
        console.error("处理过程中发生全局错误:", globalError);
        kb_state.value = `处理失败`;
    }
}

function splitByHeadings(content: string): string[] {
    if (!content) return [];
    
    const headingPatterns = [
        /^第[一二三四五六七八九十百千万\d]+章\s+/gm,
        /^第[一二三四五六七八九十百千万\d]+条\s+/gm,
        /^[一二三四五六七八九十]+、\s*/gm,
        /^\(\d+\)\s*/gm,
        /^\d+\.\s*/gm,
        /^[A-Z]\.\s*/gm,
        /^【[^】]+】\s*/gm,
        /^第[一二三四五六七八九十百千万\d]+节\s+/gm,
        /^[IVX]+\.\s*/gm,
    ];
    
    const lines = content.split(/\r?\n/);
    const sections: string[] = [];
    let currentSection: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        const isHeading = headingPatterns.some(pattern => {
            const regex = new RegExp(pattern);
            return regex.test(line);
        });
        
        if (isHeading) {
            if (currentSection.length > 0) {
                sections.push(currentSection.join('\n'));
                currentSection = [];
            }
            currentSection.push(lines[i]);
        } else {
            currentSection.push(lines[i]);
        }
    }
    
    if (currentSection.length > 0) {
        sections.push(currentSection.join('\n'));
    }
    
    if (sections.length <= 1) {
        console.log('智能切分未识别到一级标题，回退到默认切分');
        return content.split(/(?:\r?\n){3,}/);
    }
    
    return sections;
}

let previewContent = ref('') as any

function isPdfFile(extension: string) {
    return extension?.toLowerCase() === '.pdf'
}

function isWordFile(extension: string) {
    return extension?.toLowerCase() === '.docx' || extension?.toLowerCase() === '.doc'
}

const previewFile = async function(i: number) {
    selectedFileIndex.value = i
    try {
        const file = files.value[i]
        if (!file) return
        
        if (isPdfFile(file?.extension)) {
            previewContent.value = ''
            return
        }
        
        if (isWordFile(file?.extension)) {
            if (file.content && file.content !== '') {
                previewContent.value = file.content
                return
            }
            
            const result = await window.ipcRenderer.invoke('readFile', file.path)
            
            if (typeof result === 'object' && result !== null) {
                if (result.success === false) {
                    previewContent.value = result.content || `读取Word文档失败: ${result.error || '未知错误'}`
                } else {
                    previewContent.value = result.content || ''
                }
            } else {
                previewContent.value = result || ''
            }
            
            file.content = previewContent.value
            extractFileSummary(file)
            return
        }

        if (file && file.content !== undefined && file.content !== '') {
            previewContent.value = stripFrontmatter(file.content)
            return
        }

        const content = await window.ipcRenderer.invoke('readFile', file.path)
        previewContent.value = stripFrontmatter(content ?? '')
        if (file) file.content = content ?? ''
        extractFileSummary(file)
    } catch (err) {
        console.error('预览文件失败', err)
        previewContent.value = store.locales=='zh' ? '读取文件失败' : 'Failed to read file'
    }
}

const reasoning = async function(i: number) {
    blocks.value[i].Q = '正在推理';
    let history = [{role: 'user', content: model.value.processPrompt + blocks.value[i].A}];
    const ollama = new Ollama({host: model.value.url});
    
    try {
        const response = await ollama.chat({
            model: model.value.process,
            messages: history,
            think:false,
            stream: true
        });
        
        blocks.value[i].Q = "";
        for await (const part of response) {
            blocks.value[i].Q += part.message.content;
        }

        const embedResponse = await ollama.embed({
            model: model.value.embed,
            input: blocks.value[i].Q,
            truncate: true,
            keep_alive: "1h"
        });
        
        if (!embedResponse?.embeddings?.[0]) {
            throw new Error("向量化处理错误");
        }
        
        if (blocks.value[i].A_vector?.length !== embedResponse.embeddings[0].length) {
            console.warn(`向量维度不一致: A_vector=${blocks.value[i].A_vector?.length}, Q_vector=${embedResponse.embeddings[0].length}`);
        }
        
        blocks.value[i].Q_vector = embedResponse.embeddings[0];
        try { scheduleRefreshAtlas(120) } catch (e) {}
    } catch (error) {
        console.error("处理失败:", error);
        blocks.value[i].Q_vector = [];
    }
}

const extractQuestionsWithProgress = async function(startIndex: number = 0) {
    const totalBlocks = blocks.value.length
    extractProgress.value.totalCount = totalBlocks
    extractProgress.value.isRunning = true
    extractProgress.value.isPaused = false
    
    for (let i = startIndex; i < totalBlocks; i++) {
        while (extractProgress.value.isPaused) {
            await new Promise(resolve => setTimeout(resolve, 100))
            if (!extractProgress.value.isRunning) return
        }
        
        if (blocks.value[i].Q !== '问题未推理' && blocks.value[i].Q !== '') continue
        
        extractProgress.value.currentIndex = i + 1
        saveExtractProgress()
        
        kb_state.value = store.locales === 'zh' ?
            `提取问题: ${i+1}/${totalBlocks} (${Math.round((i+1)/totalBlocks*100)}%)` :
            `Extracting: ${i+1}/${totalBlocks} (${Math.round((i+1)/totalBlocks*100)}%)`
        
        await reasoning(i)
    }
    
    extractProgress.value.isRunning = false
    extractProgress.value.isPaused = false
    clearExtractProgress()
    kb_state.value = store.locales === 'zh' ? '问题提取完成！' : 'Extraction complete!'
    
    if (model.value.autoBuildOntology) {
        await startBuildOntology()
    }
}

const continueExtract = async () => {
    if (extractProgress.value.isPaused) {
        extractProgress.value.isPaused = false
        extractProgress.value.isRunning = true
        await extractQuestionsWithProgress(extractProgress.value.currentIndex)
    } else if (loadExtractProgress()) {
        kb_state.value = store.locales === 'zh' ? 
            `从保存的进度恢复问题提取: ${extractProgressText.value}` : 
            `Resuming extraction from saved progress: ${extractProgressText.value}`
        await extractQuestionsWithProgress(extractProgress.value.currentIndex)
    } else {
        kb_state.value = store.locales === 'zh' ? '没有可恢复的问题提取进度，请重新开始' : 'No extraction progress to resume'
    }
}

const startExtract = async () => {
    if (extractProgress.value.isRunning) {
        kb_state.value = store.locales === 'zh' ? '问题提取已在运行中' : 'Extraction already running'
        return
    }
    clearExtractProgress()
    extractProgress.value.startTime = Date.now()
    await extractQuestionsWithProgress(0)
}

const stopExtract = () => {
    extractProgress.value.isRunning = false
    extractProgress.value.isPaused = false
    clearExtractProgress()
    kb_state.value = store.locales === 'zh' ? '问题提取已停止' : 'Extraction stopped'
}

const chat = async function(prompt: string, boostCallback?: (scores: Map<number, number>) => Map<number, number>) {
    ollama = new Ollama({ host: model.value.url });
    result.value = store.locales == 'zh' ? "正在思考..." : 'Thinking...'
    
    const queryResponse = await ollama.embed({
        model: model.value.embed,
        input: prompt,
        truncate: true,
        keep_alive: "1h",
    });
    const queryEmbedding = queryResponse.embeddings?.[0];
    
    try {
        const SUMMARY_WEIGHT = (model.value.summaryWeight !== undefined) ? model.value.summaryWeight : 0.7
        const SLICE_WEIGHT = 1 - SUMMARY_WEIGHT
        const USE_REVERSE_INFERENCE = model.value.useReverseInference || false
        const REVERSE_WEIGHT = model.value.reverseInferenceWeight || 0.3
        const USE_BM25 = model.value.bm25Enabled || false
        const BM25_WEIGHT = model.value.bm25Weight || 0.3
        const COSINE_WEIGHT = USE_BM25 ? (1 - BM25_WEIGHT) : 1
        
        const fileSummaryPromises = [] as any[]
        const filePaths = [] as string[]
        
        for (let i = 0; i < blocks.value.length; i++) {
            const filePath = blocks.value[i].filePath
            if (!filePaths.includes(filePath)) {
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
        
        let bm25Scores: number[] = []
        if (USE_BM25 && blocks.value.length > 0) {
            const documents = blocks.value.map((b: any) => b.A)
            bm25Scores = computeBM25Score(prompt, documents, model.value.bm25K1, model.value.bm25B)
        }
        
        for (let i = 0; i < blocks.value.length; i++) {
            const b = blocks.value[i]
            let fileSummaryScore = 0
            let sliceScore = 0
            let reverseScore = 0
            let cosineScore = 0
            let bm25Score = USE_BM25 ? (bm25Scores[i] || 0) : 0
            
            const fileSummaryVector = fileSummaryMap.get(b.filePath)
            if (fileSummaryVector && queryEmbedding) {
                try { 
                    fileSummaryScore = cosineSimilarity(queryEmbedding, fileSummaryVector) 
                } catch (e) { 
                    fileSummaryScore = 0 
                }
            }
            
            if (b.A_vector && queryEmbedding) {
                try { 
                    sliceScore = cosineSimilarity(queryEmbedding, b.A_vector) 
                } catch (e) { 
                    sliceScore = 0 
                }
            }
            
            if (USE_REVERSE_INFERENCE && b.Q_vector && b.Q_vector.length > 0 && queryEmbedding) {
                try { 
                    reverseScore = cosineSimilarity(queryEmbedding, b.Q_vector) 
                } catch (e) { 
                    reverseScore = 0 
                }
            }
            
            b.fileSummaryScore = fileSummaryScore
            b.sliceScore = sliceScore
            b.reverseScore = reverseScore
            b.bm25Score = bm25Score
            
            if (USE_REVERSE_INFERENCE && b.Q_vector && b.Q_vector.length > 0) {
                const remainingWeight = 1 - REVERSE_WEIGHT
                const adjustedSummaryWeight = SUMMARY_WEIGHT * remainingWeight
                const adjustedSliceWeight = SLICE_WEIGHT * remainingWeight
                
                cosineScore = adjustedSummaryWeight * fileSummaryScore + adjustedSliceWeight * sliceScore
                
                if (USE_BM25) {
                    b.p = COSINE_WEIGHT * (cosineScore * (1 - REVERSE_WEIGHT) + REVERSE_WEIGHT * reverseScore) + BM25_WEIGHT * bm25Score
                } else {
                    b.p = cosineScore * (1 - REVERSE_WEIGHT) + REVERSE_WEIGHT * reverseScore
                }
            } else {
                cosineScore = SUMMARY_WEIGHT * fileSummaryScore + SLICE_WEIGHT * sliceScore
                
                if (USE_BM25) {
                    b.p = COSINE_WEIGHT * cosineScore + BM25_WEIGHT * bm25Score
                } else {
                    b.p = cosineScore
                }
            }
            
            const summaryInfo = fileSummaries.value.get(b.filePath)
            b.fileSummaryContent = summaryInfo?.content || ''
        }
        
        if (boostCallback) {
            const scoresMap = new Map<number, number>()
            for (let i = 0; i < blocks.value.length; i++) {
                scoresMap.set(i, blocks.value[i].p)
            }
            const boostedScores = boostCallback(scoresMap)
            for (let i = 0; i < blocks.value.length; i++) {
                if (boostedScores.has(i)) {
                    blocks.value[i].p = boostedScores.get(i)!
                }
            }
        }

        blocks.value.sort((a:any,b:any) => (b.p||0) - (a.p||0))
    } catch (err) {
        console.error('相似度计算失败:', err)
        for (let i = 0; i < blocks.value.length; i++) {
            if (blocks.value[i].A_vector && queryEmbedding) {
                try {
                    blocks.value[i].p = cosineSimilarity(queryEmbedding, blocks.value[i].A_vector)
                } catch (e) {
                    blocks.value[i].p = 0
                }
            } else {
                blocks.value[i].p = 0
            }
        }
        blocks.value.sort((a:any,b:any) => (b.p||0) - (a.p||0))
    }

    const allVectors = [];
    const allBlocks = [] as Array<{ 
        originalIndex: number, 
        type: 'A' | 'Q', 
        label: string, 
        content: string 
    }>;
    
    blocks.value.forEach((b: any, index: number) => {
        allVectors.push(b.A_vector);
        allBlocks.push({
            originalIndex: index,
            type: 'A',
            label: b.label,
            content: b.A
        });
        
        if(b.Q.length > 0 && b.Q !== "问题未推理") {
            allVectors.push(b.Q_vector);
            allBlocks.push({
                originalIndex: index,
                type: 'Q',
                label: b.label,
                content: b.Q
            });
        }
    });
    
    allVectors.push(queryEmbedding);
    
    if (model.value.searchMethod === "MDS") {
        const mdsResult = computeMDS(allVectors, model.value.mdsIterations, model.value.mdsEpsilon);
        processDimensionalityReductionResults(mdsResult);
    } else if(model.value.searchMethod === "MDS(M)") {
        const mergedVectors = await computeMergedEmbeddings();
        mergedVectors.push(queryEmbedding);
        const mdsResult = computeMDS(mergedVectors, model.value.mdsIterations, model.value.mdsEpsilon);
        processMergedDimensionalityReductionResults(mdsResult);
    } else if(model.value.searchMethod === "PCA") {
        const pcaResult = computePCA(allVectors);
        processDimensionalityReductionResults(pcaResult);
    } else if (model.value.searchMethod === "CS(M)") {
        const mergedVectors = await computeMergedEmbeddings();
        for(let i = 0; i < blocks.value.length; i++) {
            blocks.value[i].p = cosineSimilarity(queryEmbedding, mergedVectors[i]);
        }
    }
    
    blocks.value.sort((a: any, b: any) => b.p - a.p);
    
    if (model.value.searchMethod === "MDS" || model.value.searchMethod === "PCA") {
        drawVisualization();
    }
    
    let history = [];
    let content = prompt + ((store.locales == "zh") ? 
        '。请根据参考资料解决以上问题，如果不相关可以忽略后续资料。' : 
        '. Please solve the above problems based on the reference materials. If they are not relevant, you can ignore the subsequent materials.');
    let num = 0;
    
    blocks.value.forEach((b:any) => b.state = false);
    
    if(model.value.searchMode == "按数量"){
        for (let i = 0; i < Math.min(model.value.searchNum, blocks.value.length); i++) {
            content += "《" + blocks.value[i].label + "》：";
            content += blocks.value[i].A + "。";
            blocks.value[i].state = true;
            num++;
        }
    } else if(model.value.searchMode == "按匹配率"){
        for (let i = 0; i < blocks.value.length; i++) {
            if(blocks.value[i].p >= model.value.matchRatio) {
                content += "《" + blocks.value[i].label + "》：";
                content += blocks.value[i].A + "。";
                blocks.value[i].state = true;
                num++;
            } else {
                break;
            }
        }
    } else if(model.value.searchMode == "按字符"){
        let currentLength = content.length;
        for (let i = 0; i < blocks.value.length; i++) {
            const blockContent = "《" + blocks.value[i].label + "》：" + blocks.value[i].A + "。";
            if (currentLength + blockContent.length <= model.value.searchCharacter) {
                content += blockContent;
                currentLength += blockContent.length;
                blocks.value[i].state = true;
                num++;
            } else {
                break;
            }
        }
    }
    
    console.log(content);
    if (viewMode.value === 'atlas') {
        if (atlasModuleRef.value) {
            setTimeout(() => {
                atlasModuleRef.value.refreshAtlas()
            }, 100)
        }
    }
    result.value = store.locales == 'zh' ? 
        `正在思考，查询到${num}个资料。` : 
        `Thinking and found ${num} pieces of data.`;
    
    history.push({ role: 'user', content: content });
    ollama = new Ollama({ host: model.value.url });
    const response = await ollama.chat({ 
        model: model.value.chat, 
        messages: history, 
        think: model.value.think,
        stream: true 
    });
    
    result.value = "";
    for await (const part of response) {
        result.value += part.message.content;
    }
    
    return true;

    function processDimensionalityReductionResults(points: number[][]) {
        const queryPoint = points[points.length - 1];
        const blockSimilarities = new Map<number, number[]>();
        
        for(let i = 0; i < allBlocks.length; i++) {
            const originalIndex = allBlocks[i].originalIndex;
            const point = points[i];
            
            const dx = point[0] - queryPoint[0];
            const dy = point[1] - queryPoint[1];
            const distance = Math.sqrt(dx * dx + dy * dy);
            const similarity = 1 / (1 + distance);
            
            if(!blockSimilarities.has(originalIndex)) {
                blockSimilarities.set(originalIndex, []);
            }
            blockSimilarities.get(originalIndex)!.push(similarity);
        }
        
        blocks.value.forEach((block:any, index:any) => {
            const similarities = blockSimilarities.get(index) || [];
            block.p = similarities.length > 0 ? 
                similarities.reduce((a, b) => a + b, 0) / similarities.length : 
                0;
        });
    }
    
    function drawVisualization() {
        nextTick(() => {
            const container = document.getElementById('mds-chart');
            if (!container) return;
            
            const pointsToDraw = blocks.value.slice(0, 50).map((block:any) => ({
                x: block.A_vector[0],
                y: block.A_vector[1],
                label: block.label,
                p: block.p,
                content: block.A
            }));
            
            pointsToDraw.push({
                x: 0,
                y: 0,
                label: "Q",
                p: 1,
                isQuery: true
            });
            
            drawScatterPlot(container, pointsToDraw);
        });
    }
    
    async function computeMergedEmbeddings() {
        const mergedVectors = [];
        for (const block of blocks.value) {
            const mergedContent = block.A + (block.Q.length > 0 && block.Q !== "问题未推理" ? " " + block.Q : "");
            const embedResponse = await ollama.embed({
                model: model.value.embed,
                input: mergedContent,
                truncate: true,
                keep_alive: "1h",
            });
            mergedVectors.push(embedResponse.embeddings?.[0]);
        }
        return mergedVectors;
    }

    function processMergedDimensionalityReductionResults(points: number[][]) {
        const queryPoint = points[points.length - 1];
            
        for(let i = 0; i < blocks.value.length; i++) {
            const point = points[i];
            const dx = point[0] - queryPoint[0];
            const dy = point[1] - queryPoint[1];
            const distance = Math.sqrt(dx * dx + dy * dy);
            blocks.value[i].p = 1 / (1 + distance);
        }
    }
}

function cosineSimilarity(vecA:number[], vecB:number[]) {
    if (vecA.length !== vecB.length) {
        throw new Error(vecA.length+"/"+vecB.length+"向量维度不匹配");
    }

    let dotProduct = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
    }

    const magnitudeA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));

    if (magnitudeA === 0 || magnitudeB === 0) {
        return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
}

function computeMDS(vectors: number[][], iterations: number, epsilon: number): number[][] {
    const n = vectors.length;
    if (n === 0) return [];
    
    const distances = Matrix.zeros(n, n);
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            distances.set(i, j, 1 - cosineSimilarity(vectors[i], vectors[j]));
        }
    }
    
    const H = Matrix.eye(n).sub(Matrix.ones(n, n).mul(1 / n));
    
    const D2 = Matrix.zeros(n, n);
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const val = distances.get(i, j);
            D2.set(i, j, val * val);
        }
    }
    
    const B = H.mmul(D2).mmul(H).mul(-0.5);
    
    const svd = new SingularValueDecomposition(B);
    const U = svd.leftSingularVectors;
    const s = svd.diagonal;
    
    const sqrtS = Matrix.zeros(n, n);
    for (let i = 0; i < s.length; i++) {
        sqrtS.set(i, i, Math.sqrt(Math.max(s[i], 0)));
    }
    
    const X = U.mmul(sqrtS);
    
    const result: number[][] = [];
    for (let i = 0; i < n; i++) {
        result.push([X.get(i, 0), X.get(i, 1)]);
    }
    
    return result;
}

function computePCA(vectors: number[][]): number[][] {
    const n = vectors.length;
    if (n === 0) return [];
    
    const matrix = new Matrix(vectors);
    
    const means = [];
    for (let j = 0; j < matrix.columns; j++) {
        let sum = 0;
        for (let i = 0; i < matrix.rows; i++) {
            sum += matrix.get(i, j);
        }
        means[j] = sum / matrix.rows;
    }
    
    for (let i = 0; i < matrix.rows; i++) {
        for (let j = 0; j < matrix.columns; j++) {
            matrix.set(i, j, matrix.get(i, j) - means[j]);
        }
    }
    
    const covMatrix = matrix.transpose().mmul(matrix).mul(1 / (matrix.rows - 1));
    
    const svd = new SingularValueDecomposition(covMatrix);
    const eigenvectors = svd.leftSingularVectors;
    
    const result: number[][] = [];
    for (let i = 0; i < matrix.rows; i++) {
        const row = matrix.getRow(i);
        const pc1 = row.reduce((sum, val, j) => sum + val * eigenvectors.get(j, 0), 0);
        const pc2 = row.reduce((sum, val, j) => sum + val * eigenvectors.get(j, 1), 0);
        result.push([pc1, pc2]);
    }
    
    return result;
}
// PCA 包装方法 - 供 testManager 调用
const computePCAWrapper = (vectors: number[][]): number[][] => {
    if (!vectors || vectors.length === 0) return []
    
    try {
        // 调用现有的 computePCA 方法
        const pcaResult = computePCA(vectors)
        return pcaResult
    } catch (error) {
        console.error('PCA计算失败:', error)
        // 返回默认的二维坐标（基于原向量的前两维）
        return vectors.map(vec => [vec[0] || 0, vec[1] || 0])
    }
}

// MDS 包装方法 - 供 testManager 调用
const computeMDSWrapper = (vectors: number[][], iterations?: number, epsilon?: number): number[][] => {
    if (!vectors || vectors.length === 0) return []
    
    try {
        // 使用模型配置中的参数，如果没有则使用默认值
        const mdsIterations = iterations || model.value.mdsIterations || 50
        const mdsEpsilon = epsilon || model.value.mdsEpsilon || 0.1
        
        // 调用现有的 computeMDS 方法
        const mdsResult = computeMDS(vectors, mdsIterations, mdsEpsilon)
        return mdsResult
    } catch (error) {
        console.error('MDS计算失败:', error)
        // 返回默认的二维坐标（基于原向量的前两维）
        return vectors.map(vec => [vec[0] || 0, vec[1] || 0])
    }
}
function drawScatterPlot(container: HTMLElement, points: {x: number, y: number, label: string, p: number, isQuery?: boolean, content?: string}[]) {
    container.innerHTML = '';
    const width = container.clientWidth;
    const height = container.clientHeight;
    const margin = {top: 20, right: 20, bottom: 20, left: 40};
    
    const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height);
    
    const xExtent = d3.extent(points, d => d.x) as [number, number];
    const yExtent = d3.extent(points, d => d.y) as [number, number];
    
    const x = d3.scaleLinear()
        .domain(xExtent)
        .range([margin.left, width - margin.right]);
    
    const y = d3.scaleLinear()
        .domain(yExtent)
        .range([height - margin.bottom, margin.top]);
    
    svg.append('g')
        .attr('transform', `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x));
    
    svg.append('g')
        .attr('transform', `translate(${margin.left},0)`)
        .call(d3.axisLeft(y));
    
    const queryPoint = points.find(p => p.isQuery);
    if (queryPoint) {
        points.filter(p => !p.isQuery).forEach(targetPoint => {
            svg.append('line')
                .attr('x1', x(queryPoint.x))
                .attr('y1', y(queryPoint.y))
                .attr('x2', x(targetPoint.x))
                .attr('y2', y(targetPoint.y))
                .attr('stroke', 'rgba(200, 200, 200, 0.3)')
                .attr('stroke-width', 0.5);
        });
    }
    
    const tooltip = d3.select(container)
        .append('div')
        .attr('class', 'scatter-tooltip')
        .style('position', 'absolute')
        .style('visibility', 'hidden')
        .style('background', 'var(--backgroundColor)')
        .style('border', '1px solid var(--borderColor)')
        .style('border-radius', '5px')
        .style('padding', '8px')
        .style('max-width', '300px')
        .style('max-height', '200px')
        .style('overflow', 'auto')
        .style('z-index', '1000')
        .style('font-size', '12px');
    
    svg.selectAll('circle.point')
        .data(points.filter(p => !p.isQuery))
        .enter()
        .append('circle')
        .attr('class', 'point')
        .attr('cx', d => x(d.x))
        .attr('cy', d => y(d.y))
        .attr('r', 4)
        .attr('fill', d => d3.interpolateRdYlGn(d.p))
        .attr('stroke', '#666')
        .attr('stroke-width', 0.5)
        .on('mouseover', function(event, d) {
            tooltip.style('visibility', 'visible')
                .style('left', (event.pageX + 10) + 'px')
                .style('top', (event.pageY - 10) + 'px')
                .html(`
                    <div><strong>${d.label}</strong></div>
                    <div>${store.locales=='zh'?'相似度':'Similarity'}: ${(d.p*100).toFixed(1)}%</div>
                    <hr style="margin:5px 0;border-color:var(--borderColor);">
                    <div>${d.content || '无内容'}</div>
                `);
            
            d3.select(this)
                .attr('r', 6)
                .attr('stroke-width', 1.5);
        })
        .on('mouseout', function() {
            tooltip.style('visibility', 'hidden');
            
            d3.select(this)
                .attr('r', 4)
                .attr('stroke-width', 0.5);
        });
    
    if (queryPoint) {
        svg.append('circle')
            .attr('cx', x(queryPoint.x))
            .attr('cy', y(queryPoint.y))
            .attr('r', 8)
            .attr('fill', 'none')
            .attr('stroke', 'red')
            .attr('stroke-width', 2);
        
        svg.append('circle')
            .attr('cx', x(queryPoint.x))
            .attr('cy', y(queryPoint.y))
            .attr('r', 4)
            .attr('fill', 'red');
        
        svg.append('text')
            .attr('x', x(queryPoint.x) + 10)
            .attr('y', y(queryPoint.y) - 10)
            .text('Q')
            .attr('font-size', '12px')
            .attr('fill', 'red');
    }
}

const processNum = computed(()=>{
    return blocks.value.filter((item:any) => item.Q !== '问题未推理').length
})

const save = async function(){
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}-${now.getSeconds().toString().padStart(2, '0')}`;
    
    const fileSummaryData = {} as any
    fileSummaries.value.forEach((value: any, key: string) => {
        fileSummaryData[key] = {
            content: value.content,
            vector: value.vector
        }
    })
    
    const extractProgressData = extractProgress.value.isPaused ? {
        currentIndex: extractProgress.value.currentIndex,
        totalCount: extractProgress.value.totalCount,
        startTime: extractProgress.value.startTime,
        isPaused: true
    } : (extractProgress.value.isRunning ? {
        currentIndex: extractProgress.value.currentIndex,
        totalCount: extractProgress.value.totalCount,
        startTime: extractProgress.value.startTime,
        isRunning: true
    } : null)
    
    const buildProgressData = (buildProgress.value.isPaused || buildProgress.value.isRunning) ? {
        currentBatchIndex: buildProgress.value.currentBatchIndex,
        totalBatches: buildProgress.value.totalBatches,
        currentFileIndex: buildProgress.value.currentFileIndex,
        totalFiles: buildProgress.value.totalFiles,
        currentBatchInFile: buildProgress.value.currentBatchInFile,
        totalBatchesInFile: buildProgress.value.totalBatchesInFile,
        startTime: buildProgress.value.startTime,
        isPaused: buildProgress.value.isPaused,
        isRunning: buildProgress.value.isRunning,
        savedOntologyState: {
            entities: Array.from(globalEntities.value.entries()).map(([key, entity]) => ({
                key: key,
                id: entity.id,
                name: entity.name,
                type: entity.type,
                nodeType: entity.nodeType,
                layer: entity.layer,
                description: entity.description,
                associatedBlocks: entity.associatedBlocks,
                associatedFiles: entity.associatedFiles
            })),
            relations: Array.from(globalRelations.value.entries()).map(([key, relation]) => ({
                key: key,
                id: relation.id,
                source: relation.source,
                target: relation.target,
                type: relation.type,
                layer: relation.layer,
                description: relation.description,
                sourceBlocks: relation.sourceBlocks
            })),
            entityToBlocksIndex: Array.from(entityToBlocksIndex.value.entries()).map(([entityName, blockIds]) => ({
                entityName: entityName,
                blockIds: Array.from(blockIds)
            }))
        }
    } : null
    
    const ontologySaveData = {
        entities: Array.from(globalEntities.value.entries()).map(([key, entity]) => ({
            key: key,
            id: entity.id,
            name: entity.name,
            type: entity.type,
            nodeType: entity.nodeType,
            layer: entity.layer,
            description: entity.description,
            associatedBlocks: entity.associatedBlocks,
            associatedFiles: entity.associatedFiles
        })),
        relations: Array.from(globalRelations.value.entries()).map(([key, relation]) => ({
            key: key,
            id: relation.id,
            source: relation.source,
            target: relation.target,
            type: relation.type,
            layer: relation.layer,
            description: relation.description,
            sourceBlocks: relation.sourceBlocks
        })),
        entityToBlocksIndex: Array.from(entityToBlocksIndex.value.entries()).map(([entityName, blockIds]) => ({
            entityName: entityName,
            blockIds: Array.from(blockIds)
        }))
    }
    
    const saveData = {
        config: {
            embedModel: model.value.embed,
            timestamp: new Date().toISOString(),
            version: "3.0",
            summaryWeight: model.value.summaryWeight,
            sliceWeight: model.value.sliceWeight,
            ontologyBatchSize: model.value.ontologyBatchSize,
            searchConfig: {
                bm25Enabled: model.value.bm25Enabled,
                bm25Weight: model.value.bm25Weight,
                bm25K1: model.value.bm25K1,
                bm25B: model.value.bm25B,
                cosineWeight: model.value.cosineWeight,
                useReverseInference: model.value.useReverseInference,
                reverseInferenceWeight: model.value.reverseInferenceWeight,
                searchMethod: model.value.searchMethod,
                searchMode: model.value.searchMode,
                searchNum: model.value.searchNum,
                matchRatio: model.value.matchRatio,
                searchCharacter: model.value.searchCharacter,
            }
        },
        fileSummaries: fileSummaryData,
        blocks: blocks.value.map((block: any) => {
            const { fileSummaryScore, sliceScore, reverseScore, bm25Score, fileSummaryContent, ...rest } = block
            return rest
        }),
        ontology: ontologySaveData,
        extractProgress: extractProgressData,
        buildProgress: buildProgressData
    };
    
    window.ipcRenderer.invoke('saveFile', `${store.root}/${timestamp}.kb`, JSON.stringify(saveData))
        .then((success) => {
            if (success) {
                kb_state.value = `文件 ${timestamp}.kb 保存成功`;
            } else {
                kb_state.value = '文件保存失败';
            }
        })
        .catch((error) => {
            console.error(error);
            kb_state.value = '文件保存出错';
        })
    await scanKnowledgeBases()
}

const loadKnowledgeBases = async function(index?: number) {
    const loadIndex = index !== undefined ? index : selectedKbIndex.value
    
    if (knowledgeBases.value.length === 0 || loadIndex < 0 || loadIndex >= knowledgeBases.value.length) {
        kb_state.value = store.locales === 'zh' ? '没有可用的知识库文件' : 'No knowledge base files available'
        return
    }

    try {
        const kbFile = knowledgeBases.value[loadIndex]
        const content = await window.ipcRenderer.invoke('readFile', kbFile.path)
        const saveData = JSON.parse(content)
        
        const version = saveData.config?.version || "1.0"
        
        if (version !== "3.0" && version !== "2.5" && version !== "2.4") {
            throw new Error(`不支持的知识库版本: ${version}，请使用版本 2.4+ 的知识库文件`)
        }
        
        if (!saveData.blocks || !saveData.config || !saveData.fileSummaries) {
            throw new Error('知识库文件格式错误')
        }
        
        fileSummaries.value.clear()
        Object.entries(saveData.fileSummaries).forEach(([key, value]: [string, any]) => {
            fileSummaries.value.set(key, {
                content: value.content,
                vector: value.vector
            })
        })
        
        blocks.value = saveData.blocks
        resetScrollLoad()
        
        if (saveData.config.embedModel) {
            model.value.embed = saveData.config.embedModel
        }
        if (saveData.config.summaryWeight !== undefined) {
            model.value.summaryWeight = saveData.config.summaryWeight
        }
        if (saveData.config.sliceWeight !== undefined) {
            model.value.sliceWeight = saveData.config.sliceWeight
        }
        if (saveData.config.ontologyBatchSize !== undefined) {
            model.value.ontologyBatchSize = saveData.config.ontologyBatchSize
        }
        
        if (saveData.config.searchConfig) {
            const sc = saveData.config.searchConfig
            if (sc.bm25Enabled !== undefined) model.value.bm25Enabled = sc.bm25Enabled
            if (sc.bm25Weight !== undefined) model.value.bm25Weight = sc.bm25Weight
            if (sc.bm25K1 !== undefined) model.value.bm25K1 = sc.bm25K1
            if (sc.bm25B !== undefined) model.value.bm25B = sc.bm25B
            if (sc.cosineWeight !== undefined) model.value.cosineWeight = sc.cosineWeight
            if (sc.useReverseInference !== undefined) model.value.useReverseInference = sc.useReverseInference
            if (sc.reverseInferenceWeight !== undefined) model.value.reverseInferenceWeight = sc.reverseInferenceWeight
            if (sc.searchMethod !== undefined) model.value.searchMethod = sc.searchMethod
            if (sc.searchMode !== undefined) model.value.searchMode = sc.searchMode
            if (sc.searchNum !== undefined) model.value.searchNum = sc.searchNum
            if (sc.matchRatio !== undefined) model.value.matchRatio = sc.matchRatio
            if (sc.searchCharacter !== undefined) model.value.searchCharacter = sc.searchCharacter
        }
        
        if (saveData.ontology) {
            globalEntities.value.clear()
            globalRelations.value.clear()
            entityToBlocksIndex.value.clear()
            
            for (const entityData of saveData.ontology.entities) {
                const entity: OntologyEntity = {
                    id: entityData.id,
                    name: entityData.name,
                    type: entityData.type || 'entity',
                    nodeType: entityData.nodeType || entityData.type || 'entity',
                    layer: entityData.layer || 'data',
                    description: entityData.description,
                    associatedBlocks: entityData.associatedBlocks,
                    associatedFiles: entityData.associatedFiles
                }
                globalEntities.value.set(entityData.key || entityData.name.toLowerCase(), entity)
            }
            
            for (const relationData of saveData.ontology.relations) {
                const relation: OntologyRelation = {
                    id: relationData.id,
                    source: relationData.source,
                    target: relationData.target,
                    type: relationData.type,
                    layer: relationData.layer,
                    description: relationData.description,
                    sourceBlocks: relationData.sourceBlocks || []
                }
                globalRelations.value.set(relationData.key, relation)
            }
            
            for (const indexData of saveData.ontology.entityToBlocksIndex || []) {
                entityToBlocksIndex.value.set(indexData.entityName, new Set(indexData.blockIds))
            }
            
            updateOntologyViewer()
            updateEntityCards()
            
            kb_state.value = (store.locales === 'zh' ? 
                `已加载知识库(含本体)，${globalEntities.value.size}节点，${globalRelations.value.size}关系` : 
                `Loaded knowledge base (with ontology), ${globalEntities.value.size} nodes, ${globalRelations.value.size} relations`)
        } else {
            kb_state.value = (store.locales === 'zh' ? 
                `已加载知识库: ${kbFile.label}` : 
                `Loaded knowledge base: ${kbFile.label}`)
        }
        
        if (saveData.extractProgress && saveData.extractProgress.currentIndex > 0 && saveData.extractProgress.currentIndex < saveData.extractProgress.totalCount) {
            extractProgress.value = {
                isRunning: false,
                isPaused: true,
                currentIndex: saveData.extractProgress.currentIndex,
                totalCount: saveData.extractProgress.totalCount,
                startTime: saveData.extractProgress.startTime
            }
            saveExtractProgress()
            kb_state.value += (store.locales === 'zh' ? 
                `，检测到未完成的问题提取进度，可点击"继续"恢复` : 
                `, unfinished extraction progress detected, click "Resume" to continue`)
        } else {
            clearExtractProgress()
        }
        
        if (saveData.buildProgress && saveData.buildProgress.currentBatchIndex > 0 && saveData.buildProgress.currentBatchIndex < saveData.buildProgress.totalBatches) {
            if (saveData.buildProgress.savedOntologyState) {
                globalEntities.value.clear()
                globalRelations.value.clear()
                entityToBlocksIndex.value.clear()
                
                for (const entityData of saveData.buildProgress.savedOntologyState.entities) {
                    const entity: OntologyEntity = {
                        id: entityData.id,
                        name: entityData.name,
                        type: entityData.type || 'entity',
                        nodeType: entityData.nodeType || entityData.type || 'entity',
                        layer: entityData.layer || 'data',
                        description: entityData.description,
                        associatedBlocks: entityData.associatedBlocks,
                        associatedFiles: entityData.associatedFiles
                    }
                    globalEntities.value.set(entityData.key, entity)
                }
                
                for (const relationData of saveData.buildProgress.savedOntologyState.relations) {
                    const relation: OntologyRelation = {
                        id: relationData.id,
                        source: relationData.source,
                        target: relationData.target,
                        type: relationData.type,
                        layer: relationData.layer,
                        description: relationData.description,
                        sourceBlocks: relationData.sourceBlocks
                    }
                    globalRelations.value.set(relationData.key, relation)
                }
                
                for (const indexData of saveData.buildProgress.savedOntologyState.entityToBlocksIndex) {
                    entityToBlocksIndex.value.set(indexData.entityName, new Set(indexData.blockIds))
                }
                
                updateOntologyViewer()
                updateEntityCards()
            }
            
            const isPaused = saveData.buildProgress.isPaused !== undefined ? saveData.buildProgress.isPaused : true
            const isRunning = saveData.buildProgress.isRunning !== undefined ? saveData.buildProgress.isRunning : false
            
            buildProgress.value = {
                isRunning: isRunning,
                isPaused: isPaused,
                currentBatchIndex: saveData.buildProgress.currentBatchIndex,
                totalBatches: saveData.buildProgress.totalBatches,
                currentFileIndex: saveData.buildProgress.currentFileIndex,
                totalFiles: saveData.buildProgress.totalFiles,
                currentBatchInFile: saveData.buildProgress.currentBatchInFile,
                totalBatchesInFile: saveData.buildProgress.totalBatchesInFile,
                startTime: saveData.buildProgress.startTime,
                savedOntologyState: saveData.buildProgress.savedOntologyState
            }
            saveBuildProgress()
            
            if (isRunning && !isPaused) {
                kb_state.value += (store.locales === 'zh' ? 
                    `，检测到正在运行的本体构建进度 (${buildProgress.value.currentBatchIndex}/${buildProgress.value.totalBatches} 批次)，正在自动继续...` : 
                    `, detected running ontology build progress (${buildProgress.value.currentBatchIndex}/${buildProgress.value.totalBatches} batches), auto-resuming...`)
                setTimeout(() => {
                    continueBuildOntology()
                }, 500)
            } else {
                kb_state.value += (store.locales === 'zh' ? 
                    `，检测到未完成的本体构建进度 (${buildProgress.value.currentBatchIndex}/${buildProgress.value.totalBatches} 批次)，可点击"继续"恢复` : 
                    `, unfinished build progress detected (${buildProgress.value.currentBatchIndex}/${buildProgress.value.totalBatches} batches), click "Resume" to continue`)
            }
        } else {
            clearBuildProgress()
        }
    } catch (error:any) {
        console.error('加载知识库出错:', error)
        kb_state.value = store.locales === 'zh' ? 
            `加载知识库出错: ${error.message}` : 
            `Error loading knowledge base: ${error.message}`
    }
}

const scanKnowledgeBases = async function() {
    if (!store.root) return
    
    try {
        const result = await window.ipcRenderer.invoke("getFilesRelation", store.root, 1)
        if (!result) return

        const { fileList = [] } = result
        knowledgeBases.value = fileList.filter((file: any) => file.path.endsWith('.kb'))
        
        knowledgeBases.value.sort((a: any, b: any) => {
            return (b.mtime || 0) - (a.mtime || 0)
        })
        
        if (knowledgeBases.value.length > 0) {
            selectedKbIndex.value = 0
        }
    } catch (error) {
        console.error('扫描知识库出错:', error)
    }
}

const init = async function() {
    if (store.root) {
        try {
            await loadFolderFiles(store.root)
        } catch (e) {
            console.warn('加载文件夹失败或无内容:', e)
        }
    }

    await scanKnowledgeBases()
    await getModel()
}

const atlasModuleRef = ref()
function scheduleRefreshAtlas(delay = 180) {
    if (viewMode.value === 'atlas' && atlasModuleRef.value) {
        atlasModuleRef.value.scheduleRefreshAtlas(delay)
    }
}

const handleLoadKnowledgeBase = async (index: number) => {
    await loadKnowledgeBases(index)
}

function cleanupScrollListener() {
    const container = document.querySelector('.blocks')
    if (container) {
        container.removeEventListener('scroll', handleScroll)
    }
}

// ==================== 本体构建模块 ====================

interface OntologyEntity {
  id: string
  name: string
  type: string
  nodeType: string
  layer: string
  description: string
  associatedBlocks: string[]
  associatedFiles: string[]
}

interface OntologyRelation {
  id: string
  source: string
  target: string
  type: string
  layer: string
  description: string
  sourceBlocks: string[]
}

const globalEntities = ref<Map<string, OntologyEntity>>(new Map())
const globalRelations = ref<Map<string, OntologyRelation>>(new Map())
const entityToBlocksIndex = ref<Map<string, Set<string>>>(new Map())

// ==================== 卡片视图相关 ====================
const entityCards = ref<Array<{
  id: string
  name: string
  description: string
  layer: string
  associatedBlocks: string[]
  associatedFiles: string[]
}>>([])

const selectedEntityForCards = ref<OntologyEntity | null>(null)
const entityCardDetailBlocks = ref<any[]>([])
const showEntityCardDetail = ref(false)

// ==================== 卡片搜索和推理功能 ====================
const cardSearchKeyword = ref('')
const filteredEntityCards = ref<Array<any>>([])

// 批量推理相关状态
const isBatchReasoning = ref(false)
const batchReasoningQueue = ref<Array<any>>([])
const batchReasoningCurrentIndex = ref(0)
const batchReasoningProgress = computed(() => {
    if (batchReasoningQueue.value.length === 0) return 0
    return Math.round((batchReasoningCurrentIndex.value / batchReasoningQueue.value.length) * 100)
})
const batchReasoningProgressText = computed(() => {
    return `${batchReasoningCurrentIndex.value}/${batchReasoningQueue.value.length} (${batchReasoningProgress.value}%)`
})

// 正在推理的卡片ID集合
const reasoningCardsSet = ref<Set<string>>(new Set())
const isReasoningDetail = ref(false)

// 搜索处理
const handleCardSearch = () => {
    const keyword = cardSearchKeyword.value.trim().toLowerCase()
    if (!keyword) {
        filteredEntityCards.value = [...entityCards.value]
        return
    }
    
    filteredEntityCards.value = entityCards.value.filter(card => 
        card.name.toLowerCase().includes(keyword) || 
        card.description.toLowerCase().includes(keyword)
    )
}

// 批量推理所有卡片
const batchReasoningAllCards = async () => {
    if (isBatchReasoning.value) {
        kb_state.value = store.locales === 'zh' ? '批量推理正在进行中' : 'Batch reasoning is in progress'
        return
    }
    
    // 收集所有需要推理的卡片（描述为"无描述"或为空的）
    batchReasoningQueue.value = filteredEntityCards.value.filter(card => 
        !card.description || card.description === '无描述'
    )
    
    if (batchReasoningQueue.value.length === 0) {
        kb_state.value = store.locales === 'zh' ? '所有卡片都已有描述' : 'All cards already have descriptions'
        return
    }
    
    isBatchReasoning.value = true
    batchReasoningCurrentIndex.value = 0
    
    kb_state.value = store.locales === 'zh' ?
        `开始批量推理 ${batchReasoningQueue.value.length} 个卡片...` :
        `Starting batch reasoning for ${batchReasoningQueue.value.length} cards...`
    
    for (let i = 0; i < batchReasoningQueue.value.length; i++) {
        if (!isBatchReasoning.value) break
        
        batchReasoningCurrentIndex.value = i + 1
        
        const card = batchReasoningQueue.value[i]
        const fullEntity = globalEntities.value.get(card.name.toLowerCase())
        
        if (fullEntity) {
            await reasonEntityDescription(fullEntity, card)
        }
        
        // 等待一小段时间避免请求过快
        await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    isBatchReasoning.value = false
    batchReasoningQueue.value = []
    batchReasoningCurrentIndex.value = 0
    
    updateEntityCards()
    handleCardSearch()
    
    kb_state.value = store.locales === 'zh' ?
        `批量推理完成！共处理 ${batchReasoningCurrentIndex.value} 个卡片` :
        `Batch reasoning completed! Processed ${batchReasoningCurrentIndex.value} cards`
}

// 停止批量推理
const stopBatchReasoning = () => {
    isBatchReasoning.value = false
    reasoningCardsSet.value.clear()
    kb_state.value = store.locales === 'zh' ? '批量推理已停止' : 'Batch reasoning stopped'
}

// 推理单个卡片
const reasonSingleCard = async (card: any) => {
    if (reasoningCardsSet.value.has(card.id)) {
        kb_state.value = store.locales === 'zh' ? '正在推理中，请稍后' : 'Reasoning in progress, please wait'
        return
    }
    
    const fullEntity = globalEntities.value.get(card.name.toLowerCase())
    if (!fullEntity) {
        kb_state.value = store.locales === 'zh' ? '未找到实体数据' : 'Entity data not found'
        return
    }
    
    await reasonEntityDescription(fullEntity, card)
    updateEntityCards()
    handleCardSearch()
}

// 从详情页推理
const reasonSingleCardFromDetail = async () => {
    if (!selectedEntityForCards.value || isReasoningDetail.value) return
    await reasonEntityDescription(selectedEntityForCards.value)
    updateEntityCards()
    handleCardSearch()
    
    // 更新详情页显示
    const updatedEntity = globalEntities.value.get(selectedEntityForCards.value.name.toLowerCase())
    if (updatedEntity) {
        selectedEntityForCards.value = updatedEntity
        const relatedBlocks = []
        for (const blockId of updatedEntity.associatedBlocks || []) {
            const block = blocks.value.find((b: any) => b.id === blockId)
            if (block) {
                relatedBlocks.push({
                    ...block,
                    preview: block.A?.substring(0, 200) + (block.A?.length > 200 ? '...' : '')
                })
            }
        }
        entityCardDetailBlocks.value = relatedBlocks
    }
}

// 推理实体描述（基于所有关联切片）
const reasonEntityDescription = async (entity: OntologyEntity, card?: any) => {
    const entityId = entity.id
    const cardId = card?.id || entityId
    
    reasoningCardsSet.value.add(cardId)
    if (selectedEntityForCards.value?.id === entity.id) {
        isReasoningDetail.value = true
    }
    
    try {
        // 获取所有关联切片的内容
        const associatedBlocksContent: string[] = []
        for (const blockId of entity.associatedBlocks || []) {
            const block = blocks.value.find((b: any) => b.id === blockId)
            if (block && block.A) {
                associatedBlocksContent.push(block.A)
            }
        }
        
        if (associatedBlocksContent.length === 0) {
            entity.description = store.locales === 'zh' ? '无关联切片，无法生成描述' : 'No associated blocks, cannot generate description'
            globalEntities.value.set(entity.name.toLowerCase(), entity)
            kb_state.value = store.locales === 'zh' ?
                `实体"${entity.name}"没有关联切片` :
                `Entity "${entity.name}" has no associated blocks`
            return
        }
        
        // 合并内容并限制长度
        let combinedContent = associatedBlocksContent.join('\n\n---\n\n')
        if (combinedContent.length > 8000) {
            combinedContent = combinedContent.substring(0, 8000) + '...'
        }
        
        // 构建提示词
        const systemPrompt = `你是一个知识图谱专家。请根据提供的文本内容，为实体"${entity.name}"生成一个准确、完整的描述。

要求：
1. 描述应基于提供的文本内容，不要添加外部知识
2. 描述应概括该实体的核心特征、定义或作用
3. 如果文本中有多个方面的信息，应综合概括
4. 只返回描述文本，不要有任何其他内容`

        const userPrompt = `请根据以下文本内容，为实体"${entity.name}"生成描述：

${combinedContent}`

        const ollamaClient = new Ollama({ host: model.value.url })
        const response = await ollamaClient.chat({
            model: model.value.process,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            stream: false
        })
        
        let description = response.message.content.trim()
        description = description.replace(/^["']|["']$/g, '').trim()
        
        if (description.length > 500) {
            description = description.substring(0, 500) + '...'
        }
        
        entity.description = description
        globalEntities.value.set(entity.name.toLowerCase(), entity)
        
        kb_state.value = store.locales === 'zh' ?
            `成功为"${entity.name}"生成描述 (基于${associatedBlocksContent.length}个切片)` :
            `Successfully generated description for "${entity.name}" (based on ${associatedBlocksContent.length} blocks)`
            
    } catch (error) {
        console.error('推理实体描述失败:', error)
        entity.description = store.locales === 'zh' ? '描述生成失败，请重试' : 'Description generation failed, please retry'
        globalEntities.value.set(entity.name.toLowerCase(), entity)
        kb_state.value = store.locales === 'zh' ?
            `为"${entity.name}"生成描述失败: ${error}` :
            `Failed to generate description for "${entity.name}": ${error}`
    } finally {
        reasoningCardsSet.value.delete(cardId)
        if (selectedEntityForCards.value?.id === entity.id) {
            isReasoningDetail.value = false
        }
    }
}

const updateEntityCards = () => {
  const cards = []
  for (const entity of globalEntities.value.values()) {
    cards.push({
      id: entity.id,
      name: entity.name,
      description: entity.description || '无描述',
      layer: entity.layer,
      associatedBlocks: entity.associatedBlocks || [],
      associatedFiles: entity.associatedFiles || []
    })
  }
  entityCards.value = cards
  handleCardSearch()
}

const selectEntityCard = (entity: any) => {
  const fullEntity = globalEntities.value.get(entity.name.toLowerCase())
  if (fullEntity) {
    selectedEntityForCards.value = fullEntity
    
    const relatedBlocks = []
    for (const blockId of fullEntity.associatedBlocks || []) {
      const block = blocks.value.find((b: any) => b.id === blockId)
      if (block) {
        relatedBlocks.push({
          ...block,
          preview: block.A?.substring(0, 200) + (block.A?.length > 200 ? '...' : '')
        })
      }
    }
    entityCardDetailBlocks.value = relatedBlocks
    showEntityCardDetail.value = true
  }
}

const closeEntityCardDetail = () => {
  showEntityCardDetail.value = false
  selectedEntityForCards.value = null
  entityCardDetailBlocks.value = []
}

const deleteEntity = (entity: OntologyEntity) => {
    if (!entity) return
    
    const entityName = entity.name
    const key = entityName.toLowerCase()
    
    // 确认对话框
    const confirmMessage = store.locales === 'zh' ? 
        `确定要删除实体"${entityName}"及其所有关联关系吗？\n\n这将删除：\n- 实体节点: ${entityName}\n- 关联切片: ${entity.associatedBlocks?.length || 0} 个\n- 关联文件: ${entity.associatedFiles?.length || 0} 个\n- 相关关系连接` :
        `Are you sure you want to delete entity "${entityName}" and all its associations?\n\nThis will delete:\n- Entity node: ${entityName}\n- Associated blocks: ${entity.associatedBlocks?.length || 0}\n- Associated files: ${entity.associatedFiles?.length || 0}\n- Related relationship connections`
    
    if (!confirm(confirmMessage)) {
        return
    }
    
    // 1. 删除与该实体相关的所有关系
    const relationsToDelete: string[] = []
    for (const [relKey, relation] of globalRelations.value.entries()) {
        if (relation.source === entity.id || relation.target === entity.id) {
            relationsToDelete.push(relKey)
        }
    }
    for (const relKey of relationsToDelete) {
        globalRelations.value.delete(relKey)
    }
    
    // 2. 从全局实体中删除
    globalEntities.value.delete(key)
    
    // 3. 从索引中删除
    entityToBlocksIndex.value.delete(key)
    
    // 4. 如果当前选中的实体是被删除的，关闭详情页
    if (selectedEntityForCards.value?.id === entity.id) {
        closeEntityCardDetail()
    }
    
    // 5. 更新所有视图
    updateOntologyViewer()
    updateEntityCards()
    handleCardSearch()
    
    kb_state.value = store.locales === 'zh' ? 
        `已删除实体"${entityName}"及其 ${relationsToDelete.length} 个关联关系` : 
        `Deleted entity "${entityName}" and its ${relationsToDelete.length} associated relationships`
    
    console.log(`已删除实体: ${entityName}, 关联关系: ${relationsToDelete.length} 个`)
}

const getBlockFileInfo = (block: any) => {
  const file = files.value.find((f: any) => f.path === block.filePath)
  return {
    name: block.label || file?.label || '未知文件',
    extension: block.extension || file?.extension || ''
  }
}

const getFileIcon = (extension: string): string => {
  const icons: Record<string, string> = {
    '.md': 'fa fa-file-text-o',
    '.txt': 'fa fa-file-text-o',
    '.pdf': 'fa fa-file-pdf-o',
    '.docx': 'fa fa-file-word-o',
    '.doc': 'fa fa-file-word-o'
  }
  return icons[extension] || 'fa fa-file-o'
}

const viewBlockContent = (block: any) => {
  viewMode.value = 'slice'
  const blockIndex = blocks.value.findIndex((b: any) => b.id === block.id)
  if (blockIndex !== -1) {
    setTimeout(() => {
      const blockElements = document.querySelectorAll('.block')
      if (blockElements[blockIndex]) {
        blockElements[blockIndex].scrollIntoView({ behavior: 'smooth', block: 'center' })
        ;(blockElements[blockIndex] as HTMLElement).style.border = '2px solid #2196F3'
        setTimeout(() => {
          ;(blockElements[blockIndex] as HTMLElement).style.border = ''
        }, 2000)
      }
    }, 100)
  }
}

const getCurrentOntologyContext = () => {
  const entities = Array.from(globalEntities.value.values()).map(e => ({
    name: e.name,
    type: e.nodeType,
    description: e.description.substring(0, 100)
  }))
  
  const relations = Array.from(globalRelations.value.values()).map(r => {
    let sourceName = r.source
    let targetName = r.target
    for (const [name, entity] of globalEntities.value.entries()) {
      if (entity.id === r.source) sourceName = name
      if (entity.id === r.target) targetName = name
    }
    return { source: sourceName, target: targetName, type: r.type }
  })
  
  return { entities, relations }
}

const buildOntologyFromKnowledgeBase = async () => {
    if (blocks.value.length === 0) {
        kb_state.value = store.locales === 'zh' ? '没有切片数据，请先处理文件' : 'No slice data, please process files first';
        return;
    }
    
    resetIdCounters()

    const filePaths: string[] = Array.from(new Set(blocks.value.map((b: any) => String(b.filePath))))
    buildProgress.value.totalFiles = filePaths.length
    buildProgress.value.isRunning = true
    buildProgress.value.isPaused = false
    buildProgress.value.startTime = Date.now()
    
    if (buildProgress.value.totalBatches === 0) {
        let totalBatches = 0
        for (let i = buildProgress.value.currentFileIndex; i < filePaths.length; i++) {
            const filePath = filePaths[i]
            const fileBlocks = blocks.value.filter((b: any) => b.filePath === filePath)
            const numBatches = Math.ceil(fileBlocks.length / model.value.ontologyBatchSize)
            totalBatches += numBatches
        }
        buildProgress.value.totalBatches = totalBatches
    }
    
    saveBuildProgress()
    
    let batchCounter = buildProgress.value.currentBatchIndex
    
    for (let i = buildProgress.value.currentFileIndex; i < filePaths.length; i++) {
        while (buildProgress.value.isPaused) {
            await new Promise(resolve => setTimeout(resolve, 100))
            if (!buildProgress.value.isRunning) return
        }
        
        const filePath = filePaths[i]
        buildProgress.value.currentFileIndex = i
        await processSingleFileWithBatchProgress(filePath, i, filePaths.length, batchCounter)
        
        const fileBlocks = blocks.value.filter((b: any) => b.filePath === filePath)
        const numBatches = Math.ceil(fileBlocks.length / model.value.ontologyBatchSize)
        batchCounter += numBatches
        buildProgress.value.currentBatchIndex = batchCounter
        saveBuildProgress()
    }
    
    updateOntologyViewer()
    updateEntityCards()
    
    buildProgress.value.isRunning = false
    buildProgress.value.isPaused = false
    clearBuildProgress()
    
    kb_state.value = store.locales === 'zh' ?
        `本体构建完成！共 ${globalEntities.value.size} 个实体节点，${globalRelations.value.size} 个关系` :
        `Ontology built! ${globalEntities.value.size} entity nodes, ${globalRelations.value.size} relations`
}

const processSingleFileWithBatchProgress = async (filePath: string, fileIndex: number, totalFiles: number, startBatchIndex: number) => {
    const fileName = filePath.split('/').pop() || filePath
    const fileBlocks = blocks.value.filter((b: any) => b.filePath === filePath)
    
    if (fileBlocks.length === 0) {
        console.warn(`文件 ${fileName} 没有切片`)
        return
    }
    
    const BATCH_SIZE = model.value.ontologyBatchSize
    const batches = []
    for (let i = 0; i < fileBlocks.length; i += BATCH_SIZE) {
        batches.push(fileBlocks.slice(i, i + BATCH_SIZE))
    }
    
    buildProgress.value.totalBatchesInFile = batches.length
    buildProgress.value.currentBatchInFile = 0
    
    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        while (buildProgress.value.isPaused) {
            await new Promise(resolve => setTimeout(resolve, 100))
            if (!buildProgress.value.isRunning) return
        }
        
        buildProgress.value.currentBatchInFile = batchIdx + 1
        buildProgress.value.currentBatchIndex = startBatchIndex + batchIdx
        saveBuildProgress()
        
        kb_state.value = store.locales === 'zh' ?
            `构建本体: 文件 ${fileIndex+1}/${totalFiles} (${fileName}) - 批次 ${batchIdx+1}/${batches.length}` :
            `Building ontology: file ${fileIndex+1}/${totalFiles} (${fileName}) - batch ${batchIdx+1}/${batches.length}`
        
        const batch = batches[batchIdx]
        
        const batchContent = batch.map((b: any) => b.A).join('\n\n---\n\n')
        const currentContext = getCurrentOntologyContext()
        const batchResult = await extractOntologyFromBatch(batchContent, batch, currentContext)
        
        if (batchResult.entities.length > 0) {
            await mergeEntitiesToGlobal(batchResult.entities, filePath, batch)
        }
        
        if (batchResult.relations.length > 0) {
            await mergeRelationsToGlobal(batchResult.relations, filePath)
        }
        
        if (batchResult.entities.length > 0 || batchResult.relations.length > 0) {
            updateOntologyViewer()
            updateEntityCards()
        }
    }
}

const extractOntologyFromBatch = async (content: string, blocks: any[], contextOntology?: { entities: any[], relations: any[] }) => {
    if (!content.trim()) return { entities: [], relations: [] }
    
    const ollamaClient = new Ollama({ host: model.value.url })
    
    let contextPrompt = ''
    if (contextOntology && (contextOntology.entities.length > 0 || contextOntology.relations.length > 0)) {
        const topEntities = contextOntology.entities.slice(0, 50)
        const topRelations = contextOntology.relations.slice(0, 30)
        
        contextPrompt = `
## 已构建的本体（请在此基础上扩展）

### 已有实体节点：
${topEntities.map((e: any) => `- ${e.name}`).join('\n')}

### 已有关系：
${topRelations.map((r: any) => `- ${r.source} → ${r.target} (${r.type})`).join('\n')}

### 要求：
1. 如果遇到与已有节点相似的实体，请使用相同的名称
2. 不要创建重复的节点
3. 新节点可以与已有节点建立关系
`
    }
    
    const systemPrompt = `你是一个本体构建专家。请从给定的文本中提取实体节点以及它们之间的关系。

实体是文本中出现的：概念、对象、事物、主体、人物、组织、地点等。

关系类型说明：
- **is_a**：继承关系。例如："医疗保险" is_a "保险合同"
- **part_of**：组成关系。例如："保险条款" part_of "保险合同"
- **depends_on**：依赖关系。例如："理赔" depends_on "保险合同"
- **related_to**：一般关联关系
- **contains**：包含关系

${contextPrompt}

返回JSON格式：
{
  "entities": [
    {"name": "实体名称", "description": "描述"}
  ],
  "relations": [
    {"source": "源实体名称", "target": "目标实体名称", "type": "is_a", "description": "关系描述"}
  ]
}

注意：
1. 只提取实体节点，不要提取属性
2. 每个节点只需要名称和描述
3. 只返回JSON，不要有任何其他内容。`

    try {
        const response = await ollamaClient.chat({
            model: model.value.process,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: content.substring(0, 6000) }
            ],
            stream: false
        })
        
        const jsonMatch = response.message.content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0])
            
            const validEntities = (result.entities || []).filter((e: any) => 
                e.name && typeof e.name === 'string' && e.name.trim().length > 0
            )
            
            const validRelations = (result.relations || []).filter((r: any) => 
                r.source && typeof r.source === 'string' && r.source.trim().length > 0 &&
                r.target && typeof r.target === 'string' && r.target.trim().length > 0
            )
            
            return {
                entities: validEntities.map((e: any) => ({ ...e, type: 'entity' })),
                relations: validRelations.map((r: any) => ({ ...r }))
            }
        }
    } catch (error) {
        console.error('批次提取失败:', error)
    }
    
    return { entities: [], relations: [] }
}

const calculateStringSimilarity = (str1: string, str2: string): number => {
    if (str1 === str2) return 1.0
    if (str1.includes(str2) || str2.includes(str1)) return 0.8
    
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1
    
    if (longer.length === 0) return 1.0
    
    const editDistance = (a: string, b: string): number => {
        const matrix = []
        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i]
        }
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j
        }
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1]
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    )
                }
            }
        }
        return matrix[b.length][a.length]
    }
    
    const distance = editDistance(longer, shorter)
    return (longer.length - distance) / longer.length
}

const mergeEntitiesToGlobal = async (newEntities: any[], filePath: string, fileBlocks: any[]): Promise<number> => {
    let addedCount = 0
    
    for (const newEntity of newEntities) {
        if (!newEntity.name || typeof newEntity.name !== 'string') {
            console.warn(`实体名称无效，跳过:`, newEntity)
            continue
        }
        
        const key = newEntity.name.toLowerCase()
        const existing = globalEntities.value.get(key)
        
        const matchedBlockIds: string[] = []
        for (const block of fileBlocks) {
            if (block.A && block.A.includes(newEntity.name)) {
                matchedBlockIds.push(block.id)
            }
            if (block.Q && block.Q !== '问题未推理' && block.Q.includes(newEntity.name)) {
                if (!matchedBlockIds.includes(block.id)) {
                    matchedBlockIds.push(block.id)
                }
            }
        }
        
        if (matchedBlockIds.length === 0) {
            console.warn(`实体 "${newEntity.name}" 未在文本中找到，跳过`)
            continue
        }
        
        if (!existing) {
            const entity: OntologyEntity = {
                id: shortId('entity'),
                name: newEntity.name,
                type: newEntity.type || 'class',
                nodeType: 'entity',
                layer: newEntity.layer || 'data',
                description: newEntity.description || '',
                associatedBlocks: matchedBlockIds,
                associatedFiles: [filePath]
            }
            globalEntities.value.set(key, entity)
            addedCount++
            console.log(`✓ 实体 "${newEntity.name}" 关联到 ${matchedBlockIds.length} 个切片`)
        } else {
            let newAssociations = 0
            for (const blockId of matchedBlockIds) {
                if (!existing.associatedBlocks.includes(blockId)) {
                    existing.associatedBlocks.push(blockId)
                    newAssociations++
                }
            }
            
            if (!existing.associatedFiles.includes(filePath)) {
                existing.associatedFiles.push(filePath)
            }
            
            if (newEntity.description && newEntity.description.length > existing.description.length) {
                existing.description = newEntity.description
            }
            
            globalEntities.value.set(key, existing)
            
            if (newAssociations > 0) {
                console.log(`✓ 更新实体 "${newEntity.name}"，新增 ${newAssociations} 个切片关联`)
            }
        }
        
        if (!entityToBlocksIndex.value.has(key)) {
            entityToBlocksIndex.value.set(key, new Set())
        }
        for (const blockId of matchedBlockIds) {
            entityToBlocksIndex.value.get(key)!.add(blockId)
        }
    }
    
    return addedCount
}

const mergeRelationsToGlobal = async (newRelations: any[], filePath: string): Promise<number> => {
    let addedCount = 0
    
    for (const newRel of newRelations) {
        const sourceKey = newRel.source?.toLowerCase()
        const targetKey = newRel.target?.toLowerCase()
        
        let sourceEntity = globalEntities.value.get(sourceKey)
        let targetEntity = globalEntities.value.get(targetKey)
        
        if (!sourceEntity) {
            for (const [name, entity] of globalEntities.value.entries()) {
                if (calculateStringSimilarity(name, sourceKey) > 0.7) {
                    sourceEntity = entity
                    break
                }
            }
        }
        
        if (!targetEntity) {
            for (const [name, entity] of globalEntities.value.entries()) {
                if (calculateStringSimilarity(name, targetKey) > 0.7) {
                    targetEntity = entity
                    break
                }
            }
        }
        
        if (!sourceEntity || !targetEntity) {
            continue
        }
        
        const relKey = `${sourceEntity.id}|${targetEntity.id}|${newRel.type}`
        
        if (!globalRelations.value.has(relKey)) {
            const relation: OntologyRelation = {
                id: shortId('relation'),
                source: sourceEntity.id,
                target: targetEntity.id,
                type: newRel.type || 'related_to',
                layer: newRel.layer || 'data',
                description: newRel.description || '',
                sourceBlocks: newRel.sourceBlocks || []
            }
            globalRelations.value.set(relKey, relation)
            addedCount++
        }
    }
    
    return addedCount}

const updateOntologyViewer = () => {
    const nodes: any[] = []
    const edges: any[] = []
    
    for (const entity of globalEntities.value.values()) {
        nodes.push({
            id: entity.id,
            name: entity.name,
            type: entity.nodeType,
            layer: entity.layer,
            description: entity.description,
            associatedBlocks: entity.associatedBlocks || [],
            associatedFiles: entity.associatedFiles || [],
            size: 20,
            x: Math.random() * 800,
            y: Math.random() * 600
        })
    }
    
    for (const relation of globalRelations.value.values()) {
        edges.push({
            id: relation.id,
            source: relation.source,
            target: relation.target,
            type: relation.type,
            layer: relation.layer,
            description: relation.description || ''
        })
    }
    
    ontologyData.value.nodes = nodes
    ontologyData.value.edges = edges
}

const clearOntology = () => {
    globalEntities.value.clear()
    globalRelations.value.clear()
    entityToBlocksIndex.value.clear()
    ontologyData.value.nodes = []
    ontologyData.value.edges = []
    entityCards.value = []
    filteredEntityCards.value = []
    kb_state.value = store.locales === 'zh' ? '本体已清空' : 'Ontology cleared'
}

const continueBuildOntology = async () => {
    if (buildProgress.value.isPaused) {
        buildProgress.value.isPaused = false
        buildProgress.value.isRunning = true
        saveBuildProgress()
        
        if (buildProgress.value.savedOntologyState) {
            kb_state.value = store.locales === 'zh' ? 
                `恢复本体状态: ${buildProgress.value.savedOntologyState.entities.length}个实体节点, ${buildProgress.value.savedOntologyState.relations.length}个关系` : 
                `Restoring ontology state: ${buildProgress.value.savedOntologyState.entities.length} entity nodes, ${buildProgress.value.savedOntologyState.relations.length} relations`
        }
        
        await buildOntologyFromKnowledgeBase()
    } else if (loadBuildProgress()) {
        kb_state.value = store.locales === 'zh' ? 
            `从保存的进度恢复本体构建: ${buildProgressText.value}` : 
            `Resuming ontology building from saved progress: ${buildProgressText.value}`
        await buildOntologyFromKnowledgeBase()
    } else {
        kb_state.value = store.locales === 'zh' ? '没有可恢复的本体构建进度，请重新开始' : 'No ontology building progress to resume'
    }
}

const startBuildOntology = async () => {
    if (buildProgress.value.isRunning) {
        kb_state.value = store.locales === 'zh' ? '本体构建已在运行中' : 'Ontology building already running'
        return
    }
    clearBuildProgress()
    buildProgress.value.startTime = Date.now()
    await buildOntologyFromKnowledgeBase()
}

const understandQueryWithOntology = async (query: string) => {
    if (globalEntities.value.size === 0) {
        return null
    }
    
    const matchedEntities: { name: string }[] = []
    
    for (const [name, entity] of globalEntities.value.entries()) {
        if (query.includes(entity.name) || entity.name.includes(query)) {
            matchedEntities.push({ name: entity.name })
        }
    }
    
    if (matchedEntities.length === 0) {
        const ollamaClient = new Ollama({ host: model.value.url })
        const entityNames = Array.from(globalEntities.value.keys())
        
        const prompt = `用户查询: "${query}"
        
已知实体列表: ${entityNames.join(', ')}

请找出查询中可能关联的实体，返回JSON格式：
{
  "matchedEntities": ["实体1", "实体2"]
}`

        try {
            const response = await ollamaClient.chat({
                model: model.value.process,
                messages: [{ role: 'user', content: prompt }],
                stream: false
            })
            const jsonMatch = response.message.content.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0])
                for (const name of (result.matchedEntities || [])) {
                    const key = name.toLowerCase()
                    const entity = globalEntities.value.get(key)
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

const chatWithOntology = async (userPrompt: string) => {
    const queryContext = await understandQueryWithOntology(userPrompt)
    
    const boostCallback = (scores: Map<number, number>): Map<number, number> => {
        const boostedScores = new Map<number, number>()
        
        if (!queryContext || !queryContext.matchedEntities || queryContext.matchedEntities.length === 0) {
            kb_state.value = store.locales === 'zh' ? 
                '未匹配到本体实体，使用普通检索' : 
                'No ontology entities matched, using normal search'
            return scores
        }
        
        const entityBoost = model.value.entityBoostWeight
        
        const boostedSet = new Map<number, number>()
        
        for (let i = 0; i < blocks.value.length; i++) {
            const block = blocks.value[i]
            let maxBoost = 1.0
            
            for (const entity of queryContext.matchedEntities) {
                if ((block.A && block.A.includes(entity.name)) || 
                    (block.Q && block.Q.includes(entity.name))) {
                    maxBoost = Math.max(maxBoost, entityBoost)
                }
            }
            
            if (maxBoost > 1.0) {
                boostedSet.set(i, maxBoost)
            }
        }
        
        kb_state.value = store.locales === 'zh' ?
            `本体匹配: ${queryContext.matchedEntities.length}个实体, 增强 ${boostedSet.size} 个切片` :
            `Ontology matched: ${queryContext.matchedEntities.length} entities, boosting ${boostedSet.size} slices`
        
        console.log(`本体增强: 实体权重${entityBoost}, 增强 ${boostedSet.size} 个切片`)
        
        for (let i = 0; i < blocks.value.length; i++) {
            const originalScore = scores.get(i) || 0
            const boost = boostedSet.get(i)
            if (boost) {
                boostedScores.set(i, originalScore * boost)
            } else {
                boostedScores.set(i, originalScore)
            }
        }
        
        return boostedScores
    }
    
    return await chat(userPrompt, boostCallback)
}

const blocksWithId = computed(() => {
  return blocks.value.map((block: any) => ({
    ...block,
    preview: block.A?.substring(0, 150) + (block.A?.length > 150 ? '...' : ''),
    fileName: block.label || block.filePath?.split('/').pop() || '未知文件'
  }))
})

const handleBlockClick = (block: any) => {
    console.log('点击切片:', block)
    const index = blocks.value.findIndex((b: any) => b.id === block.id)
    if (index !== -1) {
        const blockElements = document.querySelectorAll('.block')
        if (blockElements[index]) {
            blockElements[index].scrollIntoView({ behavior: 'smooth', block: 'center' })
            ;(blockElements[index] as HTMLElement).style.border = '2px solid #2196F3'
            setTimeout(() => {
                ;(blockElements[index] as HTMLElement).style.border = ''
            }, 2000)
        }
    }
}

// 键盘事件处理：在模态框中按Enter键提交
const handleModalKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !isAddingEntity.value) {
        event.preventDefault()
        addEntityManually()
    } else if (event.key === 'Escape') {
        closeAddEntityModal()
    }
}

onMounted(async () => {
    await init()
    await nextTick()
})

onBeforeUnmount(() => {
    if (atlasModuleRef.value) {
        atlasModuleRef.value.cleanupAtlas()
    }
    cleanupScrollListener()
    store.saveConfig()
})
</script>
    
<template>
    <div class="main">
        <div v-if="panel=='聊天'||panel=='混合'" style="display: flex;flex-direction: column;min-width:265px;flex:1;border-right: 1px var(--borderColor) solid;">
            <div style="display: flex;width:calc(100% - 5px);padding-right: 5px;">
                <input style="flex:2;margin-right: 0px;" v-model="prompt" :placeholder="store.locales=='zh'?'请输入问题':'Please enter your question'"/>
                <div style="display:flex;align-items:center;gap:6px;" :title="store.locales=='zh'?'相似度问答':'Similarity-based Q&A'">
                    <div class="button" @click="chat(prompt)"><i class="fa fa-send"></i> </div>
                </div>
                <div style="display:flex;align-items:center;gap:6px;" :title="store.locales=='zh'?'本体问答（实体增强）':'Ontology-based Q&A'">
                    <div class="button" @click="chatWithOntology(prompt)"><i class="fa fa-github-alt"></i> </div>
                </div>
                <div class="button" :title="store.locales=='zh'?'打开对话界面':'Open Chat Interface'" @click="panel=='混合'?panel='聊天':panel='混合'" :class="{active:panel=='混合'}">
                    <i class="fa fa-stack-overflow" ></i>
                </div>
            </div>
            <div id="mds-chart-container" v-if="model.searchMethod=='MDS'" style="width:100%;height:200px;overflow: hidden; display: flex; justify-content: center; align-items: center;">
                <div id="mds-chart" style="width: 100%; height: 100%;"></div>
            </div>
            <div class="scoll" style="flex:1;overflow-y: auto;border: 1px solid var(--borderColor);margin: 0px 5px 5px 5px;border-radius: 5px;">
                <block_md :content="result" :fontSize="'12px'"/>
            </div>
        </div>
        <div class="panel scoll" v-if="panel=='管理'||panel=='混合'">
            <div style="display: flex;flex-direction:column;width:calc(100%);border-bottom: 1px solid var(--borderColor);">
                <div style="display: flex;flex-direction:row;align-items: center; width: 100%; overflow: hidden;">
                    <div class="button" :title="store.locales=='zh'?'打开对话界面':'Open Chat Interface'" @click="panel=='管理'?panel='混合':panel='管理'" :class="{active:panel=='混合'}" style="flex-shrink: 0;">
                        <i class="fa fa-comment-o"></i>
                    </div>
                    <div class="button" :title="store.locales=='zh'?'文件':'File'" @click="viewMode='file'" :class="{active:viewMode=='file'}" style="flex-shrink: 0;">
                        <i class="fa fa-book"></i>
                    </div>
                    <div class="button" :title="store.locales=='zh'?'切片':'Slice'" @click="viewMode='slice'" :class="{active:viewMode=='slice'}" style="flex-shrink: 0;">
                        <i class="fa fa-file-text-o"></i>
                    </div>
                    <div class="button" :title="store.locales=='zh'?'本体':'Ontology'" @click="viewMode='ontology'" :class="{active:viewMode=='ontology'}" style="flex-shrink: 0;">
                        <i class="fa fa-eercast"></i>
                    </div>     
                    <div class="button" :title="store.locales=='zh'?'卡片':'Card'" @click="viewMode='card'" :class="{active:viewMode=='card'}" style="flex-shrink: 0;">
                        <i class="fa fa-cubes"></i>
                    </div>                
                    <div class="button" :title="store.locales=='zh'?'测试':'Test'" @click="viewMode='test'" :class="{active:viewMode=='test'}" style="flex-shrink: 0;">
                        <i class="fa fa-th"></i>
                    </div>
                    <div class="button" :title="store.locales=='zh'?'设置':'Settings'" @click="viewMode='set'" :class="{active:viewMode=='set'}" style="flex-shrink: 0;">
                        <i class="fa fa-cog"></i>
                    </div>
                    
                    <div class="button" @click="openFolder" title="打开文件夹" style="padding:0px 8px; display: flex; flex:1; align-items: center; flex-shrink: 1; min-width: 40px; overflow: hidden;">
                        <i class="fa fa-folder-open" style="flex-shrink: 0;"></i>
                        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-left: 4px;">{{store.root}}</span>
                    </div>
                    
                    <select v-model="selectedKbIndex" style="width:160px;height:30px;margin: 5px 0px 5px 5px;background-color: var(--backgroundColor);flex-shrink: 0;" @change="loadKnowledgeBases(selectedKbIndex)" title="选择知识库版本">
                        <option v-for="(kb, index) in knowledgeBases" :key="index" :value="index">
                            {{ kb.label }} 
                        </option>
                    </select>
                    <div class="button" title="读取知识库" @click="loadKnowledgeBases(selectedKbIndex)" style="flex-shrink: 0;">
                        <i class="fa fa-history"></i>
                    </div>
                    <div class="button" title="保存知识库" @click="save" style="margin-right:5px; flex-shrink: 0;">
                        <i class="fa fa-floppy-o"></i>
                    </div>
                </div>
            </div>
            <div style="height:calc(100% - 41px);display: flex;">
                <div class="scoll" style="max-width: 100%;flex:2;height:100%;overflow-y: auto;">
                    <!-- 文件视图 -->
                    <div v-if="viewMode=='file'" style="display:flex;gap:5px;padding:5px;height:100%;box-sizing:border-box;align-items:stretch;">
                        <div class="scoll" style="width:240px;height:100%; overflow:auto; border:1px solid var(--borderColor); border-radius:5px; padding:6px; box-sizing:border-box;">
                            <div v-if="files.length===0" style="color:var(--borderColor);">无文件</div>
                            <div v-for="(file, idx) in files" :key="idx" :class="{active: selectedFileIndex===idx}" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;padding:4px;border-radius:4px;">
                                <div @click="previewFile(Number(idx))" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;"> 
                                    <i :class="store.icon(file.extension)"></i> {{file.label}} 
                                </div>
                            </div>
                        </div>
                        <div style="flex:1; height:100%; border:1px solid var(--borderColor); border-radius:5px; padding:6px; overflow:auto; box-sizing:border-box;">
                            <pdf_preview 
                                v-if="isPdfFile(files[selectedFileIndex]?.extension)"
                                :file-path="files[selectedFileIndex]?.path"
                                :file-name="files[selectedFileIndex]?.label"
                            />
                            <md_read 
                                v-else-if="isWordFile(files[selectedFileIndex]?.extension)"
                                :content="previewContent"
                                :path="files[selectedFileIndex]?.path"
                            />
                            <md_read v-else :content="previewContent" :path="files[selectedFileIndex]?.path"/>
                        </div>
                    </div>

                    <!-- 切片视图 -->
                    <div style="display: flex;flex-direction:row;flex-wrap:wrap;align-items:center;" v-if="viewMode=='slice'">
                        <select v-model="documentName" style="flex:1;min-width:100px;height:32px;margin: 5px 0px 5px 5px;" title="选择文档切片">
                            <option v-for="(option, index) in documents" :key="index" :value="option.name">
                                {{ option.name }}
                            </option>
                        </select>
                        <select v-model="model.sliceStrategy" style="width:80px;height:32px;margin: 5px 0px 5px 5px;" title="切片策略">
                            <option value="默认">{{store.locales=='zh'?'默认':'default'}}</option>
                            <option value="智能">{{store.locales=='zh'?'智能':'smart'}}</option>
                        </select>
                        <div class="button" :title="store.locales == 'zh' ? '读取文件和切片' : 'Read File and Slice'" @click="process">
                            <i class="fa fa-cut"></i>
                        </div>
                        
                        <template v-if="extractProgress.isRunning && !extractProgress.isPaused">
                            <div class="button" :title="store.locales == 'zh' ? '暂停提取问题' : 'Pause Question Extraction'" @click="pauseExtract">
                                <i class="fa fa-pause"></i>
                            </div>
                            <div class="button" :title="store.locales == 'zh' ? '停止提取问题' : 'Stop Question Extraction'" @click="stopExtract">
                                <i class="fa fa-stop"></i>
                            </div>
                        </template>
                        <template v-else-if="extractProgress.isPaused">
                            <div class="button" :title="store.locales == 'zh' ? '开始提取问题' : 'Start Question Extraction'" @click="startExtract">
                                <i class="fa fa-play"></i>
                            </div>
                            <div class="button" :title="store.locales == 'zh' ? '继续提取问题' : 'Continue Question Extraction'" @click="continueExtract" style="background-color: var(--menuColor);color: var(--fontActiveColor);">
                                <i class="fa fa-repeat"></i>
                            </div>
                        </template>
                        <template v-else>
                            <div class="button" :title="store.locales == 'zh' ? '开始提取问题' : 'Start Question Extraction'" @click="startExtract">
                                <i class="fa fa-play"></i>
                            </div>
                            <div class="button" :title="store.locales == 'zh' ? '继续提取问题' : 'Continue Question Extraction'" @click="continueExtract" :class="{disabled: true}" style="opacity:0.5;pointer-events:none;">
                                <i class="fa fa-repeat"></i>
                            </div>
                        </template>
                        
                        <div v-if="extractProgress.isRunning || extractProgress.isPaused" style="margin-left:8px;font-size:11px;color:#FF9800;display:flex;align-items:center;gap:5px;">
                            <div class="progress-bar" style="width:100px;height:4px;background:var(--borderColor);border-radius:2px;overflow:hidden;">
                                <div class="progress-fill" :style="{width: extractProgressPercent + '%', height:'100%', background:'#FF9800'}"></div>
                            </div>
                            <span>{{ extractProgressText }}</span>
                            <span v-if="extractProgress.isPaused" style="color:#FF5722;">(已暂停 - 点击继续)</span>
                            <i class="fa fa-spinner fa-spin" v-if="extractProgress.isRunning && !extractProgress.isPaused"></i>
                        </div>
                        
                        <span style="margin:0px 5px">{{processNum}}/{{blocks.length}} </span>
                    </div>

                    <div v-if="viewMode=='slice'" class="blocks scoll" @dragover.prevent @scroll="handleScroll">
                        <div v-for="(block, index) in displayedBlocks" :key="index" class="block scoll">
                            <div class="label">
                                <span class="ellipsis" :style="{color:block.state?'var(--fontActiveColor)':''}" :title="block.label">
                                    <i :class="store.icon(block.extension)"></i> 
                                    {{block.label}}
                                </span>
                                <div style="display:flex;font-size:10px;align-items:flex-end;">
                                    <span :title="'余弦: '+(block.sliceScore*100).toFixed(1)+'%' + (block.bm25Score !== undefined ? ' | BM25: '+(block.bm25Score*100).toFixed(1)+'%' : '')">{{(block.p*100).toFixed(1)+"%"}}</span>
                                </div>
                                <button @click="block.show='A'" :style="{color:block.show!='Q'?'var(--fontActiveColor)':''}" :title="block.A_vector?.length > 0 ? block.A_vector?.length + '维向量' : '向量未计算'"><i class="fa fa-file-text-o"></i> </button>
                                <button @click="block.show='Q'" :style="{color:block.show=='Q'?'var(--fontActiveColor)':''}" :title="block.Q_vector?.length > 0 ? block.Q_vector?.length + '维向量'  : '向量未计算'"><i :class="block.Q!='问题未推理'?'fa fa-commenting-o':'fa fa-comment-o'"></i> </button>
                                <button @click="reasoning(blocks.value.findIndex((b:any) => b.filePath === block.filePath && b.A === block.A))"><i class="fa fa-question"></i> </button>
                            </div>
                            <hr />
                            <block_md v-if="block.show!='Q'" :content="block.A" :fontSize="'8px'" :maxHeight="'170px'"/>
                            <textarea class="scoll" style="font-size: 8px;" v-if="block.show=='Q'" v-model="block.Q"></textarea>
                        </div>
                        
                        <div v-if="isLoadingMore" style="grid-column:1/-1;text-align:center;padding:5px;color:var(--borderColor);">
                            <i class="fa fa-spinner fa-spin"></i> {{store.locales=='zh'?'正在加载...':'Loading...'}}
                        </div>
                        <div v-else-if="!hasMoreBlocks && filteredBlocks.length > LOAD_CHUNK_SIZE" style="grid-column:1/-1;text-align:center;padding:5px;color:var(--borderColor);">
                            <i class="fa fa-check-circle"></i> {{store.locales=='zh'?'已显示全部 ':'All '}}{{filteredBlocks.length}} {{store.locales=='zh'?'个切片':'slices loaded'}}
                        </div>
                        <div v-else-if="hasMoreBlocks" style="grid-column:1/-1;text-align:center;padding:5px;font-size:11px;color:var(--borderColor);">
                            {{displayedCount}} / {{filteredBlocks.length}} · {{store.locales=='zh'?'向下滚动加载更多':'scroll to load more'}}
                        </div>
                    </div>
                    
                    <!-- 本体视图 -->
                    <div v-if="viewMode=='ontology'" style="display: flex;flex-direction: column;height:100%;">
                        <div style="display: flex;flex-direction:row;flex-wrap:wrap;align-items:center;border-bottom:1px solid var(--borderColor);">
                            <template v-if="buildProgress.isRunning && !buildProgress.isPaused">
                                <div class="button" :title="store.locales == 'zh' ? '暂停构建本体' : 'Pause Ontology Building'" @click="pauseBuildOntology">
                                    <i class="fa fa-pause"></i>
                                </div>
                                <div class="button" :title="store.locales == 'zh' ? '停止构建本体' : 'Stop Ontology Building'" @click="stopBuildOntology">
                                    <i class="fa fa-stop"></i>
                                </div>
                            </template>
                            <template v-else-if="buildProgress.isPaused">
                                <div class="button" :title="store.locales == 'zh' ? '开始构建本体' : 'Start Ontology Building'" @click="startBuildOntology">
                                    <i class="fa fa-play"></i>
                                </div>
                                <div class="button" :title="store.locales == 'zh' ? '继续构建本体' : 'Continue Ontology Building'" @click="continueBuildOntology" style="background-color: var(--menuColor);color: var(--fontActiveColor);">
                                    <i class="fa fa-repeat"></i>
                                </div>
                            </template>
                            <template v-else>
                                <div class="button" :title="store.locales == 'zh' ? '开始构建本体' : 'Start Ontology Building'" @click="startBuildOntology">
                                    <i class="fa fa-play"></i>
                                </div>
                                <div class="button" :title="store.locales == 'zh' ? '继续构建本体' : 'Continue Ontology Building'" @click="continueBuildOntology" :class="{disabled: true}" style="opacity:0.5;pointer-events:none;">
                                    <i class="fa fa-repeat"></i>
                                </div>
                            </template>
                            
                            <div class="button" title="清空本体" @click="clearOntology">
                                <i class="fa fa-trash"></i>
                            </div>
                            <div style="display:flex;align-items:center;margin-left:8px;">
                                <input type="number" v-model.number="model.ontologyBatchSize" :title="store.locales == 'zh' ? '设置本体构建的批量大小，建议设置为10-20以平衡速度和准确性' : 'Set the batch size for ontology building, recommended value is 10-20 to balance speed and accuracy'"
                                    style="width:50px;height:26px;margin:0;padding:2px 4px;border:1px solid var(--borderColor);border-radius:4px;background:var(--backgroundColor);color:var(--fontColor);"
                                    min="1" max="50" step="1"
                                    @change="setOntologyBatchSize(model.ontologyBatchSize)" />
                            </div>
                            
                            <div v-if="buildProgress.isRunning || buildProgress.isPaused" style="margin-left:8px;font-size:11px;color:#FF9800;display:flex;align-items:center;gap:5px;flex:1;">
                                <div class="progress-bar" style="width:120px;height:4px;background:var(--borderColor);border-radius:2px;overflow:hidden;">
                                    <div class="progress-fill" :style="{width: buildProgressPercent + '%', height:'100%', background:'#FF9800'}"></div>
                                </div>
                                <span>{{ buildProgressText }}</span>
                                <span v-if="buildProgress.isPaused" style="color:#FF5722;">({{ store.locales == 'zh' ? '已暂停 - 点击继续' : 'Paused - Click to Resume' }})</span>
                                <i class="fa fa-spinner fa-spin" v-if="buildProgress.isRunning && !buildProgress.isPaused"></i>
                            </div>
                        </div>
                        <OntologyViewer
                            :ontology-data="ontologyData"
                            :blocks="blocksWithId"
                            :files="files"
                            @node-click="handleNodeClick"
                            @block-click="handleBlockClick"
                            style="flex:1;overflow: hidden;"
                        />
                    </div>

                    <!-- 卡片视图 -->
                    <div v-if="viewMode=='card'" style="display: flex; flex-direction: column; height: 100%;">
                        <!-- 搜索和操作栏 -->
                        <div style="display: flex; flex-direction: row; flex-wrap: wrap; align-items: center; border-bottom: 1px solid var(--borderColor);padding-right: 5px;">
                            <div style="display: flex; flex: 1; min-width: 150px;">
                                <input 
                                    v-model="cardSearchKeyword" 
                                    :placeholder="store.locales == 'zh' ? '搜索实体名称或描述...' : 'Search entity name or description...'"
                                    style="flex: 1; margin-right: 0px; height: 28px;"
                                    @input="handleCardSearch"
                                />
                            </div>
                            
                            <!-- 新增：手动添加实体按钮 -->
                            <div class="button" :title="store.locales == 'zh' ? '手动添加实体' : 'Add Entity Manually'" @click="openAddEntityModal">
                                <i class="fa fa-plus"></i> 
                            </div>
                            
                            <div class="button" :title="store.locales == 'zh' ? '批量推理所有卡片' : 'Batch reasoning for all cards'" @click="batchReasoningAllCards">
                                <i class="fa fa-certificate"></i> 
                                <span></span>
                            </div>
                            
                            <div class="button" :title="store.locales == 'zh' ? '停止批量推理' : 'Stop batch reasoning'" @click="stopBatchReasoning" v-if="isBatchReasoning">
                                <i class="fa fa-stop"></i>
                            </div>
                            
                            <span v-if="filteredEntityCards.length !== entityCards.length" style="font-size: 11px; color: var(--borderColor);">
                                {{store.locales == 'zh' ? `显示 ${filteredEntityCards.length}/${entityCards.length}` : `Showing ${filteredEntityCards.length}/${entityCards.length}`}}
                            </span>
                            
                            <div v-if="isBatchReasoning" style="font-size: 11px; color: #FF9800; display: flex; align-items: center; gap: 5px;">
                                <div class="progress-bar" style="width: 80px; height: 4px; background: var(--borderColor); border-radius: 2px; overflow: hidden;">
                                    <div class="progress-fill" :style="{width: batchReasoningProgress + '%', height:'100%', background:'#FF9800'}"></div>
                                </div>
                                <span>{{ batchReasoningProgressText }}</span>
                                <i class="fa fa-spinner fa-spin"></i>
                            </div>
                        </div>
                        
                        <!-- 卡片内容区域 -->
                        <div style="display: flex; height: calc(100% - 44px); width: 100%;">
                            <!-- 左侧卡片列表 - 可滚动 -->
                            <div class="cards-container scoll" @dragover.prevent style="flex: 1; overflow-y: auto; height: 100%;">
                                <div class="cards-grid">
                                    <div 
                                        v-for="entity in filteredEntityCards" 
                                        :key="entity.id" 
                                        class="entity-card"
                                        @click="selectEntityCard(entity)"
                                    >
                                        <div class="card-header">
                                            <i class="fa fa-cube"></i>
                                            <span class="card-title">{{ entity.name }}</span>
                                            <span class="card-layer" :class="entity.layer">
                                                {{ store.locales == 'zh' ? '数据' : 'Data' }}
                                            </span>
                                        </div>
                                        <div class="card-description" :class="{ 'reasoning-pulse': reasoningCardsSet.has(entity.id) }">
                                            <div v-if="reasoningCardsSet.has(entity.id)" class="reasoning-indicator">
                                                <i class="fa fa-spinner fa-spin"></i> {{store.locales == 'zh' ? '推理中...' : 'Reasoning...'}}
                                            </div>
                                            <div style="display: -webkit-box;-webkit-line-clamp: 5;-webkit-box-orient: vertical;overflow: hidden;height:70px" v-else>
                                                {{entity.description}}
                                            </div>
                                        </div>
                                        <div class="card-footer">
                                            <span class="card-stat">
                                                <i class="fa fa-file-text-o"></i> {{ entity.associatedBlocks?.length || 0 }} {{store.locales == 'zh' ? "个切片" : "blocks"}}
                                            </span>
                                            <span class="card-stat">
                                                <i class="fa fa-file-o"></i> {{ entity.associatedFiles?.length || 0 }} {{store.locales == 'zh' ? "个文件" : "files"}}
                                            </span>
                                            <span v-if="entity.description && entity.description !== '无描述'" class="card-stat" style="color: #4CAF50;">
                                                <i class="fa fa-check-circle"></i> {{store.locales == 'zh' ? '已推理' : 'Reasoned'}}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div v-if="filteredEntityCards.length === 0" class="cards-empty">
                                    <i class="fa fa-cubes empty-icon"></i>
                                    <div>{{store.locales == 'zh' ? "暂无本体数据" : "No Ontology Data Available"}}</div>
                                    <div class="empty-hint">{{store.locales == 'zh' ? "请先构建本体或加载包含本体的知识库" : "Please build an ontology or load a knowledge base containing an ontology"}}</div>
                                    <div v-if="cardSearchKeyword" class="empty-hint">{{store.locales == 'zh' ? `没有找到包含 "${cardSearchKeyword}" 的卡片` : `No cards found containing "${cardSearchKeyword}"`}}</div>
                                </div>
                            </div>
                            
                            <!-- 卡片详情侧边栏 -->
                            <div v-if="showEntityCardDetail && selectedEntityForCards" class="card-detail-sidebar" @click.stop>
                                <div class="detail-header">
                                    <div class="detail-title">
                                        <i class="fa fa-cube"></i>
                                        <span>{{ selectedEntityForCards.name }}</span>
                                    </div>
                                    <button class="detail-close" :title="store.locales == 'zh' ? '删除实体' : 'Delete Entity'" @click="deleteEntity(selectedEntityForCards)">
                                        <i class="fa fa-trash-o"></i>
                                    </button>
                                    <button class="detail-close" @click="closeEntityCardDetail">
                                        <i class="fa fa-times"></i>
                                    </button>
                                </div>
                                
                                <div class="detail-body scoll">
                                    <div class="detail-section">
                                        <div class="section-title">
                                            <span style="flex:1;">
                                                <i class="fa fa-info-circle"></i> {{store.locales == 'zh' ? "描述" : "Description"}}
                                            </span>
                                            <div style="cursor: pointer;" @click="reasonSingleCardFromDetail" :disabled="isReasoningDetail">
                                                <i class="fa fa-bullseye"></i> {{store.locales == 'zh' ? '重新推理' : 'Re-reason'}}
                                            </div>
                                            <div style="cursor: pointer;" @click="isEditingDescription?saveDescriptionToGlobal():isEditingDescription=true" :disabled="isReasoningDetail">
                                                <i class="fa" :class="isEditingDescription ? 'fa-save' : 'fa-edit'"></i> 
                                                {{ isEditingDescription ? (store.locales == 'zh' ? '保存' : 'Save') : (store.locales == 'zh' ? '编辑' : 'Edit') }}
                                            </div>
                                            <div style="cursor: pointer;" @click="isEditingDescription=false" v-if="isEditingDescription">
                                                <i class="fa fa-sign-out"></i> 
                                                {{ (store.locales == 'zh' ? '退出' : 'Exit') }}
                                            </div>
                                        </div>
                                        <div class="section-content">
                                            <!-- 显示模式 -->
                                            <div v-if="!isEditingDescription" class="description-display">
                                                {{ selectedEntityForCards.description || (store.locales == 'zh' ? '无描述' : 'No description') }}
                                            </div>
                                            
                                            <!-- 编辑模式 -->
                                            <div v-else class="description-edit">
                                                <textarea 
                                                    v-model="selectedEntityForCards.description" 
                                                    :placeholder="store.locales == 'zh' ? '输入描述...' : 'Enter description...'" 
                                                    style="padding:5px; resize: vertical; overflow: auto; width: calc(100% - 12px); font-size: 10px; border: 1px solid var(--borderColor); border-radius: 4px; background: var(--backgroundColor); color: var(--fontColor);"
                                                    rows="8"
                                                    @blur="saveDescriptionToGlobal"
                                                ></textarea>
                                            </div>
                                        </div>
                                        <div v-if="isReasoningDetail" style="margin-top: 8px; font-size: 10px; color: #FF9800;">
                                            <i class="fa fa-spinner fa-spin"></i> {{store.locales == 'zh' ? '推理中...' : 'Reasoning...'}}
                                        </div>
                                    </div>
                                    
                                    <div class="detail-section">
                                        <div class="section-title">
                                            <i class="fa fa-tag"></i> {{store.locales == 'zh' ? "元信息" : "Metadata"}}
                                        </div>
                                        <div class="meta-grid">
                                            <div class="meta-item">
                                                <span class="meta-label">{{store.locales == 'zh' ? "层级:" : "Layer:"}}</span>
                                                <span class="meta-value">
                                                    {{ store.locales == 'zh' ? "数据" : "Data" }}
                                                </span>
                                            </div>
                                            <div class="meta-item">
                                                <span class="meta-label">ID:</span>
                                                <span class="meta-value mono">{{ selectedEntityForCards.id }}</span>
                                            </div>
                                            <div class="meta-item">
                                                <span class="meta-label">{{store.locales == 'zh' ? "关联切片:" : "Associated Blocks:"}}</span>
                                                <span class="meta-value">{{ entityCardDetailBlocks.length }} 个</span>
                                            </div>
                                            <div class="meta-item">
                                                <span class="meta-label">{{store.locales == 'zh' ? "关联文件:" : "Associated Files:"}}</span>
                                                <span class="meta-value">{{ selectedEntityForCards.associatedFiles?.length || 0 }} 个</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="detail-section" v-if="entityCardDetailBlocks.length > 0">
                                        <div class="section-title">
                                            <i class="fa fa-file-text-o"></i> {{store.locales == 'zh' ? "关联切片" : "Associated Blocks"}}
                                        </div>
                                        <div class="blocks-list">
                                            <div 
                                                v-for="block in entityCardDetailBlocks" 
                                                :key="block.id" 
                                                class="detail-block-card"
                                                @click="viewBlockContent(block)"
                                            >
                                                <div class="block-header">
                                                    <i :class="getFileIcon(getBlockFileInfo(block).extension)"></i>
                                                    <span class="block-name">{{ getBlockFileInfo(block).name }}</span>
                                                </div>
                                                <div class="block-preview">{{ block.preview }}</div>
                                                <div class="block-footer">
                                                    <span class="block-size">{{ block.A?.length || 0 }} {{store.locales == 'zh' ? "字符" : "characters"}}</span>
                                                    <span class="view-link">{{store.locales == 'zh' ? "查看详情 →" : "View Details →"}}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 测试视图 -->
                    <div v-if="viewMode=='test'" style="display:flex;height:100%;width:100%;">
                        <testManager
                            :store="store"
                            :blocks="blocks"
                            :files="files"
                            :model="model"
                            :getModel="getModel"
                            :cosineSimilarity="cosineSimilarity"
                            :globalEntities="globalEntities"
                            :getCurrentOntologyContext="getCurrentOntologyContext"
                            :chatWithOntology="chatWithOntology"
                            :computePCA="computePCAWrapper"
                            :computeMDS="computeMDSWrapper"
                            @updateState="(state:any) => kb_state = state"
                        />
                    </div>

                    <!-- 设置视图 -->
                    <div v-if="viewMode=='set'" style="display:flex;height:100%;width:100%;">
                        <configManager
                            :store="store"
                            :model="model"
                            :getModel="getModel"
                            :cosineSimilarity="cosineSimilarity"
                            @updateState="(state:any) => kb_state = state"
                            @loadKnowledgeBase="handleLoadKnowledgeBase"
                        />
                    </div>

                </div>
            </div>
        </div>

        <div class="message" v-if="kb_state!=''">
            {{kb_state}} 
            <i class="fa fa-times" @click="kb_state=''" style="font-size: 12px;"></i>
        </div>
        
        <!-- 手动添加实体模态框 -->
        <div v-if="showAddEntityModal" class="modal-overlay" @click.self="closeAddEntityModal">
            <div class="modal-content" @keydown="handleModalKeydown">
                <div class="modal-header">
                    <h3>{{ store.locales == 'zh' ? '手动添加实体' : 'Add Entity Manually' }}</h3>
                    <button class="modal-close" @click="closeAddEntityModal" :disabled="isAddingEntity">
                        <i class="fa fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="modal-description">
                        {{ store.locales == 'zh' ? 
                            '输入实体名称，系统将自动在所有切片中搜索匹配的内容，关联相关切片，并生成描述。' : 
                            'Enter entity name, the system will automatically search all slices for matching content, associate relevant slices, and generate a description.' 
                        }}
                    </div>
                    <div class="modal-input-group">
                        <label for="newEntityNameInput">
                            {{ store.locales == 'zh' ? '实体名称：' : 'Entity Name:' }}
                        </label>
                        <input 
                            id="newEntityNameInput"
                            v-model="newEntityName" 
                            type="text"
                            :placeholder="store.locales == 'zh' ? '例如：装备、人物等...' : 'e.g., AI, Machine Learning, Contract Terms...'"
                            :disabled="isAddingEntity"
                            autocomplete="off"
                        />
                    </div>
                    
                    <!-- 新增：匹配统计显示 -->
                    <div v-if="newEntityName.trim()" class="match-stats">
                        <div class="match-stats-header">
                            <i class="fa fa-search"></i>
                            {{ store.locales == 'zh' ? '匹配结果' : 'Match Results' }}
                        </div>
                        <div class="match-stats-item" :class="{ 'match-warning': matchStats.matchedBlocksCount === 0, 'match-success': matchStats.matchedBlocksCount > 0 }">
                            <i class="fa fa-file-text-o"></i>
                            <span>{{ store.locales == 'zh' ? `匹配切片: ${matchStats.matchedBlocksCount} 个` : `Matched blocks: ${matchStats.matchedBlocksCount}` }}</span>
                        </div>
                        <div class="match-stats-item" :class="{ 'match-warning': matchStats.isDuplicate, 'match-success': !matchStats.isDuplicate && matchStats.matchedBlocksCount > 0 }">
                            <i class="fa" :class="matchStats.isDuplicate ? 'fa-exclamation-triangle' : 'fa-check-circle'"></i>
                            <span v-if="matchStats.isDuplicate">
                                {{ store.locales == 'zh' ? `实体已存在: "${matchStats.duplicateName}"，添加将更新关联切片` : `Entity already exists: "${matchStats.duplicateName}", adding will update associations` }}
                            </span>
                            <span v-else>
                                {{ store.locales == 'zh' ? '新实体，可直接添加' : 'New entity, ready to add' }}
                            </span>
                        </div>
                        <div v-if="matchStats.matchedFilePaths.length > 0" class="match-stats-item match-files">
                            <i class="fa fa-folder-open"></i>
                            <span>{{ store.locales == 'zh' ? `关联文件: ${matchStats.matchedFilePaths.length} 个` : `Associated files: ${matchStats.matchedFilePaths.length}` }}</span>
                            <div class="match-file-list" v-if="matchStats.matchedFilePaths.length <= 5">
                                <span v-for="filePath in matchStats.matchedFilePaths" :key="filePath" class="match-file-item">
                                    {{ filePath.split('/').pop() }}
                                </span>
                            </div>
                            <div v-else class="match-file-list">
                                <span class="match-file-item">{{ matchStats.matchedFilePaths.length }} {{ store.locales == 'zh' ? '个文件' : 'files' }}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div v-if="addEntityError && !(matchStats.matchedBlocksCount === 0 && newEntityName.trim())" class="modal-error">
                        <i class="fa fa-exclamation-triangle"></i> {{ addEntityError }}
                    </div>
                    <div v-if="isAddingEntity" class="modal-loading">
                        <i class="fa fa-spinner fa-spin"></i> 
                        {{ store.locales == 'zh' ? '正在搜索切片并生成描述...' : 'Searching slices and generating description...' }}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="modal-btn modal-btn-cancel" @click="closeAddEntityModal" :disabled="isAddingEntity">
                        {{ store.locales == 'zh' ? '取消' : 'Cancel' }}
                    </button>
                    <button class="modal-btn modal-btn-confirm" @click="addEntityManually" :disabled="isAddingEntity || !newEntityName.trim() || matchStats.matchedBlocksCount === 0">
                        <i class="fa fa-plus"></i> 
                        {{ matchStats.isDuplicate ? (store.locales == 'zh' ? '更新并生成描述' : 'Update & Generate Description') : (store.locales == 'zh' ? '添加并生成描述' : 'Add & Generate Description') }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
    
<style scoped>
    .main{
        display:flex;
        width:100%;
        height:calc(100% - 0px)
    }
    .header{
        width: calc(100%);
        display: flex;
        background-color: var(--menuColor);
    }
    .panel{
        flex:3;
        height:calc(100% - 0px);
        width:100%;
    }
    .message{
        display:block;
        position:fixed;
        right:5px;
        bottom:5px;
        font-size: 10px;
        background-color: var(--backgroundColor);
        border: 1px var(--borderColor) solid;
        padding:5px;
        border-radius: 5px;
        z-index:999
    }
    .table{
        padding: 0px;
    }
    tr{
        padding: 0px;
    }
    td{
        padding: 0px;
        vertical-align: top;
    }
    textarea{
        height:calc(100% - 10px);
        width:calc(100% - 12px);
        border:0px
    }
    .body{
        padding:5px;
        flex-grow: 1;
        overflow-y: auto;
    }
    .tabs{
        display: flex;
    }
    .active{
        background-color: var(--menuColor);
        color:var(--fontActiveColor)
    }
    hr{
        width: calc(100% - 6px);
        border-color:var(--borderColor);
        margin:2px;
    }
    .blocks{
        width:calc(100% - 5px);
        height:calc(100% - 48px);
        overflow-y: auto;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        align-items: start;
        padding:5px 0px 0px 5px;
    }
    .block{
        position: relative;
        word-wrap: break-word;
        border: 1px solid var(--borderColor);
        margin:0px 5px 5px 0px;
        border-radius: 5px;
        height:200px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }
    .block .label{
        font-size: 10px;
        width:calc(100% - 6px);
        margin:3px;
        display: flex;
        align-items: center;
    }
    .ellipsis {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1;
    }
    .button{
        background-color: var(--backgroundColor);
        height:29px;
        min-width:29px;
        padding:0px;
        line-height:29px;
    }
    .button.disabled {
        opacity: 0.5;
        pointer-events: none;
    }
    .progress-bar {
        width: 80px;
        height: 4px;
        background: var(--borderColor);
        border-radius: 2px;
        overflow: hidden;
    }
    .progress-fill {
        height: 100%;
        background: #FF9800;
        border-radius: 2px;
        transition: width 0.3s ease;
    }
    
    /* ==================== 模态框样式 ==================== */
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        backdrop-filter: blur(2px);
    }
    
    .modal-content {
        background: var(--backgroundColor);
        border: 1px solid var(--borderColor);
        border-radius: 8px;
        width: 450px;
        max-width: 90vw;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        animation: modalSlideIn 0.3s ease;
    }
    
    @keyframes modalSlideIn {
        from {
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
        }
        to {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
    }
    
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 8px;
        border-bottom: 1px solid var(--borderColor);
    }
    
    .modal-header h3 {
        margin: 0;
        font-size: 14px;
        color: var(--fontColor);
        display: flex;
        align-items: center;
        gap: 8px;
    }
    
    .modal-header h3::before {
        content: '\f067';
        font-family: FontAwesome;
        color: var(--fontActiveColor);
        font-size: 12px;
    }
    
    .modal-close {
        background: none;
        border: none;
        color: var(--borderColor);
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 16px;
        transition: all 0.2s;
    }
    
    .modal-close:hover {
        background: rgba(244, 67, 54, 0.1);
        color: #f44336;
    }
    
    .modal-close:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    .modal-body {
        padding: 8px;
    }
    
    .modal-description {
        font-size: 11px;
        color: var(--borderColor);
        line-height: 1.5;
        padding: 8px 12px;
        background: rgba(33, 150, 243, 0.05);
        border-radius: 6px;
        border-left: 3px solid var(--fontActiveColor);
    }
    
    .modal-input-group {
        margin-bottom: 5px;
    }
    
    .modal-input-group label {
        display: block;
        font-size: 12px;
        color: var(--fontColor);
        font-weight: 500;
    }
    
    .modal-input-group input {
        width: 100%;
        margin: 0px;
        padding: 8px 12px;
        border: 1px solid var(--borderColor);
        border-radius: 6px;
        background: var(--backgroundColor);
        color: var(--fontColor);
        font-size: 13px;
        box-sizing: border-box;
        transition: border-color 0.2s;
    }
    
    .modal-input-group input:focus {
        outline: none;
        border-color: #2196F3;
        box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
    }
    
    .modal-input-group input:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    
    .modal-error {
        font-size: 11px;
        color: #f44336;
        padding: 8px 12px;
        background: rgba(244, 67, 54, 0.05);
        border-radius: 6px;
        border-left: 3px solid #f44336;
        margin-top: 5px;
        display: flex;
        align-items: center;
        gap: 6px;
    }
    
    .modal-loading {
        font-size: 11px;
        color: #FF9800;
        padding: 8px 12px;
        background: rgba(255, 152, 0, 0.05);
        border-radius: 6px;
        border-left: 3px solid #FF9800;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 6px;
    }
    
    .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 6px 8px;
        border-top: 1px solid var(--borderColor);
    }
    
    .modal-btn {
        padding: 8px 16px;
        border: 1px solid var(--borderColor);
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 6px;
        background: var(--backgroundColor);
        color: var(--fontColor);
    }
    
    .modal-btn:hover:not(:disabled) {
        transform: translateY(-1px);
    }
    
    .modal-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    .modal-btn-cancel:hover:not(:disabled) {
        background: rgba(158, 158, 158, 0.1);
    }
    
    .modal-btn-confirm {
        background: var(--fontActiveColor);
        color: white;
        border-color: var(--borderColor);
    }
    
    .modal-btn-confirm:hover:not(:disabled) {
        background: #1976D2;
        border-color: #1976D2;
        box-shadow: 0 2px 8px rgba(33, 150, 243, 0.3);
    }
    
    .match-stats {
        background: var(--backgroundColor);
        border: 1px solid var(--borderColor);
        border-radius: 6px;
        padding: 8px 12px;
    }

    .match-stats-header {
        font-size: 11px;
        font-weight: 500;
        color: #2196F3;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
        padding-bottom: 4px;
        border-bottom: 1px solid var(--borderColor);
    }

    .match-stats-item {
        font-size: 10px;
        padding: 4px 0;
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .match-stats-item i {
        width: 14px;
        font-size: 10px;
    }

    .match-stats-item.match-warning {
        color: #FF9800;
    }

    .match-stats-item.match-success {
        color: #4CAF50;
    }

    .match-stats-item.match-files {
        color: var(--fontColor);
        flex-wrap: wrap;
    }

    .match-file-list {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-left: 20px;
    }

    .match-file-item {
        font-size: 9px;
        background: rgba(33, 150, 243, 0.1);
        padding: 2px 6px;
        border-radius: 10px;
        color: var(--fontColor);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    /* ==================== 卡片视图样式 ==================== */
    .cards-container {
        height: 100%;
        overflow-y: auto;
        display: block;
        flex: 1;
    }
    .cards-grid {
        display: grid;
        flex:1;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 5px;
        padding: 4px;
        align-content: start;
    }
    
    .entity-card {
        background: var(--backgroundColor);
        border: 1px solid var(--borderColor);
        border-radius: 5px;
        padding: 5px;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .entity-card:hover {
        border-color: #2196F3;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(33, 150, 243, 0.1);
    }
    
    .card-header {
        display: flex;
        align-items: center;
        gap: 5px;
        margin-bottom: 5px;
    }
    
    .card-header i {
        color: var(--fontActiveColor);
        font-size: 14px;
    }
    
    .card-title {
        font-weight: 500;
        font-size: 13px;
        color: var(--fontColor);
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    
    .card-layer {
        font-size: 9px;
        padding: 2px 4px;
        border-radius: 5px;
        background: rgba(33, 150, 243, 0.1);
        color: var(--fontActiveColor);
    }
    
    .card-description {
        font-size: 10px;
        color: var(--borderColor);
        line-height: 1.4;
        min-height: 42px;
    }
    
    .card-footer {
        display: flex;
        gap: 5px;
        padding-top: 5px;
        border-top: 1px solid var(--borderColor);
    }
    
    .card-stat {
        font-size: 9px;
        color: var(--borderColor);
        display: flex;
        align-items: center;
        gap: 4px;
    }
    
    .card-stat i {
        font-size: 9px;
    }
    
    .cards-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 200px;
        color: var(--borderColor);
        text-align: center;
    }
    
    .empty-icon {
        font-size: 40px;
        margin-bottom: 10px;
    }
    
    .empty-hint {
        font-size: 10px;
        margin-top: 5px;
        opacity: 0.7;
    }
    
    /* 卡片操作按钮样式 */
    .card-action-btn {
        background: transparent;
        border: none;
        color: var(--borderColor);
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 10px;
        transition: all 0.2s;
    }
    
    .card-action-btn:hover {
        background: rgba(33, 150, 243, 0.1);
        color: #2196F3;
    }
    
    .card-action-btn:active {
        transform: scale(0.95);
    }
    
    /* 推理脉冲动画 */
    .reasoning-pulse {
        position: relative;
    }
    
    .reasoning-indicator {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #FF9800;
        font-size: 10px;
        height: 70px
    }
    
    .reasoning-indicator i {
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    
    /* 卡片详情侧边栏 */
    .card-detail-sidebar {
        width: 250px;
        background: var(--backgroundColor);
        border-left: 1px solid var(--borderColor);
        display: flex;
        flex-direction: column;
        z-index: 100;
        box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
        animation: slideInRight 0.3s ease;
    }
    
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
        }
        to {
            transform: translateX(0);
        }
    }
    
    .detail-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 2px 5px;
        border-bottom: 1px solid var(--borderColor);
    }
    
    .detail-title {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 14px;
        font-weight: 500;
        color: var(--fontColor);
        flex:1;
    }
    
    .detail-title i {
        color: #2196F3;
    }
    
    .detail-close {
        background: none;
        border: none;
        color: var(--borderColor);
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        width:25px;
    }
    
    .detail-body {
        flex: 1;
        overflow-y: auto;
        padding: 5px;
    }
    
    .detail-section {
        margin-bottom: 5px;
    }
    
    .section-title {
        font-size: 11px;
        font-weight: 500;
        color: #2196F3;
        margin-bottom: 5px;
        display: flex;
        align-items: center;
        gap: 5px;
        padding-bottom: 4px;
        border-bottom: 1px solid var(--borderColor);
    }
    
    .section-content {
        font-size: 10px;
        color: var(--fontColor);
        line-height: 1.5;
        padding: 5px;
        background: var(--backgroundColor);
        border-radius: 5px;
    }
    
    .meta-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 5px;
    }
    
    .meta-item {
        display: flex;
        flex-direction: row;
        gap: 2px;
        padding: 2px;
        background: var(--backgroundColor);
        border-radius: 5px;
    }
    
    .meta-label {
        font-size: 8px;
        color: var(--borderColor);
    }
    
    .meta-value {
        font-size: 8px;
        color: var(--fontColor);
    }
    
    .meta-value.data {
        color: #2196F3;
    }
    
    .meta-value.mono {
        font-family: monospace;
        font-size: 9px;
    }
    
    .blocks-list {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }
    
    .detail-block-card {
        background: var(--backgroundColor);
        border: 1px solid var(--borderColor);
        border-radius: 6px;
        padding: 8px;
        cursor: pointer;
        transition: all 0.2s;
    }
    
    .detail-block-card:hover {
        border-color: #2196F3;
        background: rgba(33, 150, 243, 0.05);
    }
    
    .detail-block-card .block-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 6px;
        font-size: 10px;
        font-weight: 500;
        color: #FF5722;
    }
    
    .detail-block-card .block-preview {
        font-size: 9px;
        color: var(--fontColor);
        line-height: 1.3;
        margin-bottom: 6px;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 4;
        -webkit-box-orient: vertical;
    }
    
    .detail-block-card .block-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 8px;
        color: var(--borderColor);
    }
    
    .view-link {
        color: #2196F3;
    }
    
    ::-webkit-scrollbar {
        width: 4px;
        height: 4px;
    }
    
    ::-webkit-scrollbar-track {
        background: var(--backgroundColor);
    }
    
    ::-webkit-scrollbar-thumb {
        background: var(--borderColor);
        border-radius: 2px;
    }
</style>