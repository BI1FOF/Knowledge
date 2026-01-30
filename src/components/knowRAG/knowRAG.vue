<script setup lang="ts">
    import {onMounted,onBeforeUnmount,ref, nextTick,computed, watch, reactive} from 'vue'
    import {Ollama} from 'ollama/dist/browser.mjs'
    import block_md from '../block_md.vue'
    import md_read from '../knowFile/view/md_read.vue'
    import pdf_preview from '../other/pdf_preview.vue'
    import {usestore} from '../../store'
    import testManager from './testManager.vue'
    import knowAtlas from './knowAtlas.vue'
    import configManager from './configManager.vue'
    import * as d3 from 'd3';
    import { Matrix,SingularValueDecomposition  } from 'ml-matrix'

    const store=usestore()
    let files = ref([]) as any //知识库文件信息
    const selectedFileIndex = ref(-1) as any // 选中文件索引
    let documents = ref([{name:'全部'}]) as any //知识库文档信息
    let documentName = ref("全部") as any //选定的文档
    let blocks = ref([]) as any //知识库片段信息
    let panel = ref("管理") //显示模式，"管理"时显示知识库，"混合"时显示两个，"聊天"时只显示聊天
    let viewMode = ref('file') // 显示子模式：'file' 文件视图 / 'slice' 切片视图
    let prompt = ref("") //默认问题
    let result = ref(store.locales=="zh"?"未推理":"Unreasoned") //推理结果
    let kb_state = ref("") //支持库处理状态
    let knowledgeBases = ref([]) as any // 所有知识库文件列表
    let selectedKbIndex = ref(0) as any // 选中的知识库索引
    let ollama = null as any //服务
    let model = ref({
        url:"http://127.0.0.1:11434", //模型地址
        list:[] as any,
        think:false,
        embed:"nomic-embed-text:latest", //嵌入模型
        process:store.AIconfig.llm.ollama.model, //知识库处理模型
        processPrompt:store.locales=="zh"?"请根据如下资料，提出这些资料能够解答的若干个问题，不要返回其他表述。资料如下：":"Based on the following information, please raise several questions that these materials can answer. Do not return any other expressions. The information is as follows:", //知识库处理提示词
        searchMethod:"CS", //按数量检索时，返回的知识片段个数
        searchMode:"按数量", //检索模式：按数量/按匹配率
        matchRatio:0.58, //按匹配率检索时，返回的知识片段匹配率阈值
        searchNum:5, //按数量检索时，返回的知识片段个数
        searchCharacter:2500, //按字符检索时，限制的字符数量
        chat:store.AIconfig.llm.ollama.model, //聊天模型
        mdsIterations: 50, // MDS迭代次数
        mdsEpsilon: 0.1, // MDS收敛阈值
        pcaComponents: 2, // PCA主成分数量
        tsnePerplexity: 30, // t-SNE 困惑度（通常建议5-50）
        tsneIterations: 1000, // t-SNE 迭代次数
        tsneLearningRate: 200, // t-SNE 学习率
        umapNeighbors: 15, // UMAP 近邻数
        umapMinDist: 0.1, // UMAP 最小距离
        umapSpread: 1.0, // UMAP 分布参数
        summaryWeight: 0.0, //摘要权重
        sliceWeight: 1.0, //切片权重
        useReverseInference: false, // 是否使用反推计算相似度
        reverseInferenceWeight: 0.3, // 反推相似度权重
    })

    // 文件摘要信息存储
    let fileSummaries = ref(new Map()) as any // 存储文件摘要向量和内容

    // 保证 summaryWeight 和 sliceWeight 和为 1：当 summary 改变时自动更新 slice
    watch(() => model.value.summaryWeight, (val) => {
        const v = Number(val) || 0
        model.value.sliceWeight = Math.max(0, Math.min(1, 1 - v))
    })

    const filteredBlocks = computed(() => {
        if (documentName.value === '全部') {
            return blocks.value;
        } else {
            return blocks.value.filter((block: any) => block.label === documentName.value);
        }
    });
    //获取模型
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
        // 切换到文件视图并清空旧数据
        viewMode.value = 'file'
        files.value = []
        previewContent.value = ''
        documents.value = [{name: '全部'}]
        documentName.value = '全部'
        blocks.value = []
        fileSummaries.value.clear()

        const root = rootPath || store.root
        if (!root) {
            kb_state.value = '未选择文件夹'
            return
        }

        kb_state.value = '正在读取文件列表...'

        // 获取文件列表（包含子目录）
        const result = await window.ipcRenderer.invoke('getFilesRelation', root, 3)
        if (!result || !result.fileList) {
            kb_state.value = '获取文件列表失败'
            return
        }

        // 过滤掉 .kb 文件，只显示可预览的文件
        const fileList = result.fileList.filter((f: any) => 
            f.type === 'file' && !f.path.toLowerCase().endsWith('.kb')
        )

        // 将文件基本信息放入 files.value
        files.value = fileList.map((f: any) => ({
            label: f.label,
            path: f.path,
            extension: f.extension,
            size: f.size || 0,
            content: '',
            attributes: f.attributes || {}
        }))

        // 填充 documents 列表（文件名去掉扩展名）
        for (const f of files.value) {
            const name = f.label && f.label.lastIndexOf('.') > 0 ? f.label.substring(0, f.label.lastIndexOf('.')) : f.label
            documents.value.push({ name })
        }

        // 异步读取每个文件的内容（顺序读取以避免并发导致的问题）
        kb_state.value = `读取到 ${files.value.length} 个文件，正在读取内容...`
        
        // 统计需要读取的文件数量（排除PDF）
        const nonPdfFiles = files.value.filter((f:any) => !isPdfFile(f.extension))
        kb_state.value = `读取到 ${files.value.length} 个文件，正在读取 ${nonPdfFiles.length} 个非PDF文件内容...`
        
        for (let i = 0; i < files.value.length; i++) {
            try {
                // 如果是PDF文件，跳过内容读取
                if (isPdfFile(files.value[i].extension)) {
                    files.value[i].content = '[PDF文件 - 使用预览功能查看]'
                    continue
                }
                
                // 只读取非PDF文件的内容
                const content = await window.ipcRenderer.invoke('readFile', files.value[i].path)
                files.value[i].content = content ?? ''
                
                // 从文件内容中提取摘要（从元信息中）
                extractFileSummary(files.value[i])
            } catch (err) {
                const errorMessage = getErrorMessage(err)
                console.error('读取文件内容失败', files.value[i].path, errorMessage)
                
                // 对于PDF文件，错误信息更友好
                if (isPdfFile(files.value[i].extension)) {
                    files.value[i].content = '[PDF文件 - 预览时加载]'
                } else {
                    files.value[i].content = store.locales == 'zh' ? 
                        `读取失败: ${errorMessage}` : 
                        `Read failed: ${errorMessage}`
                }
            }
        }

        kb_state.value = `已处理 ${files.value.length} 个文件`;

        // 如果有文件，默认预览第一个
        if (files.value.length > 0) {
            // 如果第一个文件是PDF，显示预览提示
            if (isPdfFile(files.value[0].extension)) {
                previewContent.value = store.locales == 'zh' ? 
                    'PDF文件 - 使用右侧预览功能查看内容' : 
                    'PDF file - Use the preview function on the right to view content'
            } else {
                // 在展示时移除 YAML frontmatter，但保留 files.value 中的原始内容
                previewContent.value = stripFrontmatter(files.value[0].content || '')
            }
            selectedFileIndex.value = 0
        }

        // 扫描知识库文件
        await scanKnowledgeBases()
        return files.value
    }
    
    // 从文件内容中提取摘要信息
    function extractFileSummary(file: any) {
        if (!file.content || typeof file.content !== 'string') return
        
        // 尝试从YAML frontmatter中提取摘要
        const yamlMatch = file.content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/)
        if (yamlMatch) {
            const yamlContent = yamlMatch[1]
            // 查找摘要字段（支持中文"摘要"、英文"summary"、"abstract"）
            const summaryMatch = yamlContent.match(/^(摘要|summary|abstract):\s*(.+)$/mi)
            if (summaryMatch && summaryMatch[2]) {
                const summary = summaryMatch[2].trim()
                fileSummaries.value.set(file.path, {
                    content: summary,
                    vector: null // 将在使用时计算
                })
                return
            }
        }
        
        // 如果没有找到YAML摘要，尝试从文件属性中获取
        if (file.attributes && (file.attributes.summary || file.attributes.摘要 || file.attributes.abstract)) {
            const summary = file.attributes.summary || file.attributes.摘要 || file.attributes.abstract
            fileSummaries.value.set(file.path, {
                content: summary.toString().trim(),
                vector: null
            })
        }
    }
    
    // 获取文件摘要向量（如果未计算则进行计算）
    async function getFileSummaryVector(filePath: string) {
        const summaryInfo = fileSummaries.value.get(filePath)
        if (!summaryInfo || !summaryInfo.content) return null
        
        // 如果已计算过向量，直接返回
        if (summaryInfo.vector) return summaryInfo.vector
        
        // 计算向量
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
    // 去除文本开头的 YAML frontmatter（以 `---` 包围）以便预览时不显示元数据
    function stripFrontmatter(content: string) {
        if (!content || typeof content !== 'string') return content
        // 匹配以可选空白开头，然后三个短横线和换行，直到下一个三个短横线
        const fmRegex = /^\s*---\r?\n[\s\S]*?\r?\n---\r?\n?/;
        if (fmRegex.test(content)) {
            return content.replace(fmRegex, '').replace(/^\s+/, '')
        }
        return content
    }
    //选择知识库所在的文件夹
    const openFolder = async function() {
        try {
            // 打开选择文件夹对话框并委托给 loadFolderFiles 去完成读取与初始化
            store.root = await window.ipcRenderer.invoke('openFolderDialog')
            if (!store.root) {
                kb_state.value = '未选择文件夹'
                return
            }

            // 使用已有的通用函数加载文件和填充状态
            await loadFolderFiles(store.root)

            // 同步加载已有的 .kb（如果需要）
            await loadKnowledgeBases()
        } catch (error) {
            console.error('打开文件夹失败', error)
            kb_state.value = '打开文件夹失败'
        }
    }
    
    // 知识切片和向量化
    const process = async function() {
        try {
            ollama = new Ollama({ host: model.value.url });
            // 获取文件信息
            let { fileList, relationList } = await window.ipcRenderer.invoke("getFilesRelation", store.root, 3);
            
            // 过滤掉文件夹和 .kb 文件
            files.value = fileList
                .filter((obj: any) => obj.type === 'file' && !obj.path.toLowerCase().endsWith('.kb'))
                .map((obj: any, index: number) => {
                    return { ...obj };
                });
            console.log(files.value)
            kb_state.value = "读取到" + files.value.length + "个文件。正在处理...";
            documents.value = [{name:'全部'}];
            blocks.value = [];
            fileSummaries.value.clear();
            
            // 读取每个文件的数据
            for (let i = 0; i < files.value.length; i++) {
                try {
                    let result = await window.ipcRenderer.invoke('readFile', files.value[i].path);
                    if (result != undefined) {
                        files.value[i].content = result;
                        // 提取文件摘要
                        extractFileSummary(files.value[i]);
                        // 记录文档信息
                        documents.value.push({
                            name: files.value[i].label.substring(0, files.value[i].label.lastIndexOf('.')), // 记录文件名
                        });
                        
                        // 在切片前去除 YAML frontmatter
                        let contentWithoutYaml = stripFrontmatter(result);
                        
                        // 按两行切分（使用处理后的内容）
                        let block = contentWithoutYaml.split(/(?:\r?\n){3,}/);
                        
                        // 过滤掉空段落
                        block = block.filter((para: string) => para.trim().length > 0);
                        
                        kb_state.value = "读取到" + files.value.length + "个文件，正在切分第" + (i + 1) + "个文件并向量化。";
                        
                        // 如果有段落内容，才进行向量化
                        if (block.length > 0) {
                            // 生成向量
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
                                        filePath: files.value[i].path, // 保存文件路径用于关联摘要
                                        label: files.value[i].label.substring(0, files.value[i].label.lastIndexOf('.')), // 记录文件名
                                        path: files.value[i].path, // 记录文件路径
                                        extension: files.value[i].extension, // 记录文件扩展名
                                        A: string, // 文本段落（已去除YAML）
                                        A_vector: emb,
                                        Q: '问题未推理', // 文本对应的问题
                                        Q_vector: [],
                                        p: 0, // 文本的匹配度
                                        state: false, // 段落的匹配状态
                                        show: 'A',
                                    });
                                    // 每个切片向量化完成后调度增量刷新（视图会在 atlas 模式下更新）
                                    scheduleRefreshAtlas(120)
                                }
                            } catch (embedError) {
                                console.error("向量化处理失败:", embedError);
                                kb_state.value = `文件 ${files.value[i].label} 向量化失败`;
                                continue; // 跳过当前文件，继续处理下一个
                            }
                        } else {
                            kb_state.value = `文件 ${files.value[i].label} 没有可切片的内容`;
                        }
                    }
                } catch (fileError) {
                    console.error("文件读取失败:", fileError);
                    kb_state.value = `文件 ${files.value[i].label} 读取失败`;
                    continue; // 跳过当前文件，继续处理下一个
                }
            }
            kb_state.value = "";
            // 切片（处理）完成后自动切换到切片视图
            viewMode.value = 'slice'
        } catch (globalError) {
            console.error("处理过程中发生全局错误:", globalError);
            kb_state.value = `处理失败`;
        }
    }

    // 预览文件内容（文件视图使用）
    let previewContent = ref('') as any
    // 判断是否为PDF文件
    function isPdfFile(extension: string) {
        return extension?.toLowerCase() === '.pdf'
    }

    // 修改previewFile函数，移除PDF处理逻辑
    const previewFile = async function(i: number) {
        // 标记为已选择
        selectedFileIndex.value = i
        try {
            // 如果是PDF文件，直接返回，由pdf_preview组件处理
            if (isPdfFile(files.value[i]?.extension)) {
                previewContent.value = ''
                return
            }

            // 原有文本文件处理逻辑：如果已缓存原始内容，则在展示前去除 frontmatter
            if (files.value[i] && files.value[i].content !== undefined && files.value[i].content !== '') {
                previewContent.value = stripFrontmatter(files.value[i].content)
                return
            }

            const content = await window.ipcRenderer.invoke('readFile', files.value[i].path)
            // 预览时移除 YAML frontmatter，但将原始内容保存在 files 中以便后续操作（例如编辑元数据）
            previewContent.value = stripFrontmatter(content ?? '')
            // 缓存原始内容到 files 中
            if (files.value[i]) files.value[i].content = content ?? ''
            // 提取文件摘要
            extractFileSummary(files.value[i])
        } catch (err) {
            console.error('预览文件失败', err)
            previewContent.value = store.locales=='zh' ? '读取文件失败' : 'Failed to read file'
        }
    }
    // 推理单个切片问题
    const reasoning = async function(i: number) {
        blocks.value[i].Q = '正在推理';
        let history = [{role: 'user', content: model.value.processPrompt + blocks.value[i].A}];
        const ollama = new Ollama({host: model.value.url});
        
        try {
            // 获取问题推理结果
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

            // 向量化处理
            const embedResponse = await ollama.embed({
                model: model.value.embed,
                input: blocks.value[i].Q,
                truncate: true,
                keep_alive: "1h"
            });
            
            if (!embedResponse?.embeddings?.[0]) {
                throw new Error("向量化处理错误");
            }
            
            // 检查向量维度一致性
            if (blocks.value[i].A_vector?.length !== embedResponse.embeddings[0].length) {
                console.warn(`向量维度不一致: A_vector=${blocks.value[i].A_vector?.length}, Q_vector=${embedResponse.embeddings[0].length}`);
            }
            
            blocks.value[i].Q_vector = embedResponse.embeddings[0];
            // 单个切片向量化完成后也调度视图刷新
            try { scheduleRefreshAtlas(120) } catch (e) {}
        } catch (error) {
            console.error("处理失败:", error);
            blocks.value[i].Q_vector = [];
        }
    }

    // 推理所有切片问题
    const reasonings = async function() {
        console.log(`开始推理，共找到${blocks.value.length}个知识片段。`);
        for (let i = 0; i < blocks.value.length; i++) {
            if (blocks.value[i].Q !== '问题未推理' && blocks.value[i].Q !== '') continue;
            console.log(`开始推理第${i}个知识片段。`);
            await reasoning(i);
        }
    }
    //开始聊天
    const chat = async function(prompt: string) {
        ollama = new Ollama({ host: model.value.url });
        result.value = store.locales == 'zh' ? "正在思考..." : 'Thinking...'
        
        // 计算问题的向量
        const queryResponse = await ollama.embed({
            model: model.value.embed,
            input: prompt,
            truncate: true,
            keep_alive: "1h",
        });
        const queryEmbedding = queryResponse.embeddings?.[0];
        
        // ----- 两阶段检索（文件摘要优先 -> 切片次之 -> 反推补充）
        try {
            // 获取配置参数
            const SUMMARY_WEIGHT = (model.value.summaryWeight !== undefined) ? model.value.summaryWeight : 0.7
            const SLICE_WEIGHT = 1 - SUMMARY_WEIGHT
            const USE_REVERSE_INFERENCE = model.value.useReverseInference || false
            const REVERSE_WEIGHT = model.value.reverseInferenceWeight || 0.3
            
            // 批量计算文件摘要向量
            const fileSummaryPromises = [] as any[]
            const filePaths = [] as string[]
            
            // 收集所有需要计算的文件路径
            for (let i = 0; i < blocks.value.length; i++) {
                const filePath = blocks.value[i].filePath
                if (!filePaths.includes(filePath)) {
                    filePaths.push(filePath)
                }
            }
            
            // 批量计算文件摘要向量
            for (const filePath of filePaths) {
                fileSummaryPromises.push(getFileSummaryVector(filePath))
            }
            
            const fileSummaryVectors = await Promise.all(fileSummaryPromises)
            const fileSummaryMap = new Map()
            for (let i = 0; i < filePaths.length; i++) {
                fileSummaryMap.set(filePaths[i], fileSummaryVectors[i])
            }
            
            // 计算每个块的摘要相似度、切片相似度和反推相似度，合成最终评分
            for (let i = 0; i < blocks.value.length; i++) {
                const b = blocks.value[i]
                let fileSummaryScore = 0
                let sliceScore = 0
                let reverseScore = 0
                
                // 计算文件摘要相似度
                const fileSummaryVector = fileSummaryMap.get(b.filePath)
                if (fileSummaryVector && queryEmbedding) {
                    try { 
                        fileSummaryScore = cosineSimilarity(queryEmbedding, fileSummaryVector) 
                    } catch (e) { 
                        fileSummaryScore = 0 
                        console.warn(`文件摘要相似度计算失败: ${e}`)
                    }
                }
                
                // 计算切片相似度
                if (b.A_vector && queryEmbedding) {
                    try { 
                        sliceScore = cosineSimilarity(queryEmbedding, b.A_vector) 
                    } catch (e) { 
                        sliceScore = 0 
                        console.warn(`切片相似度计算失败: ${e}`)
                    }
                }
                
                // 计算反推相似度（如果有反推向量）
                if (USE_REVERSE_INFERENCE && b.Q_vector && b.Q_vector.length > 0 && queryEmbedding) {
                    try { 
                        reverseScore = cosineSimilarity(queryEmbedding, b.Q_vector) 
                    } catch (e) { 
                        reverseScore = 0 
                        console.warn(`反推相似度计算失败: ${e}`)
                    }
                }
                
                b.fileSummaryScore = fileSummaryScore
                b.sliceScore = sliceScore
                b.reverseScore = reverseScore
                
                // 综合评分计算
                if (USE_REVERSE_INFERENCE && b.Q_vector && b.Q_vector.length > 0) {
                    // 使用三元权重：文件摘要、切片、反推
                    const remainingWeight = 1 - REVERSE_WEIGHT
                    const adjustedSummaryWeight = SUMMARY_WEIGHT * remainingWeight
                    const adjustedSliceWeight = SLICE_WEIGHT * remainingWeight
                    
                    b.p = (adjustedSummaryWeight * fileSummaryScore + 
                        adjustedSliceWeight * sliceScore + 
                        REVERSE_WEIGHT * reverseScore)
                } else {
                    // 使用二元权重：文件摘要和切片
                    b.p = SUMMARY_WEIGHT * fileSummaryScore + SLICE_WEIGHT * sliceScore
                }
                
                // 记录文件摘要内容（用于调试）
                const summaryInfo = fileSummaries.value.get(b.filePath)
                b.fileSummaryContent = summaryInfo?.content || ''
            }

            // 初步按综合评分排序（高到低），后续根据检索模式再截取
            blocks.value.sort((a:any,b:any) => (b.p||0) - (a.p||0))
        } catch (err) {
            console.error('相似度计算失败:', err)
            // 如果两阶段检索失败，回退到基础相似度计算
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

        // 准备所有向量（包括问题和Q_vectors）
        const allVectors = [];
        const allBlocks = [] as Array<{ 
            originalIndex: number, 
            type: 'A' | 'Q', 
            label: string, 
            content: string 
        }>;
        
        // 构建向量集合（添加唯一标识）
        blocks.value.forEach((b: any, index: number) => {
            // 添加A向量
            allVectors.push(b.A_vector);
            allBlocks.push({
                originalIndex: index,
                type: 'A',
                label: b.label,
                content: b.A
            });
            
            // 如果有有效Q，也添加Q向量
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
        
        // 最后添加问题向量
        allVectors.push(queryEmbedding);
        
        // 计算相似度
        if (model.value.searchMethod === "MDS") {
            // MDS降维
            const mdsResult = computeMDS(allVectors, model.value.mdsIterations, model.value.mdsEpsilon);
            processDimensionalityReductionResults(mdsResult);
        } else if(model.value.searchMethod === "MDS(M)") {
            // 合并A和Q内容并计算嵌入向量
            const mergedVectors = await computeMergedEmbeddings();
            // 添加问题向量
            mergedVectors.push(queryEmbedding);
            // MDS降维
            const mdsResult = computeMDS(mergedVectors, model.value.mdsIterations, model.value.mdsEpsilon);
            processMergedDimensionalityReductionResults(mdsResult);
        } else if(model.value.searchMethod === "PCA") {
            // PCA降维
            const pcaResult = computePCA(allVectors);
            processDimensionalityReductionResults(pcaResult);
        } else if (model.value.searchMethod === "CS(M)") {
            // 合并A和Q内容并计算嵌入向量
            const mergedVectors = await computeMergedEmbeddings();
            
            // 计算余弦相似度
            for(let i = 0; i < blocks.value.length; i++) {
                blocks.value[i].p = cosineSimilarity(queryEmbedding, mergedVectors[i]);
            }
        } else {
            // 传统的余弦相似度计算（已经在前面的两阶段检索中计算过了）
            // 这里不需要重复计算，直接使用之前计算的综合评分
        }
        
        // 统一排序（确保最终排序正确）
        blocks.value.sort((a: any, b: any) => b.p - a.p);
        
        // 绘制图表（如果是降维方法）
        if (model.value.searchMethod === "MDS" || model.value.searchMethod === "PCA") {
            drawVisualization();
        }
        
        // 知识片段召回
        let history = [];
        let content = prompt + ((store.locales == "zh") ? 
            '。请根据参考资料解决以上问题，如果不相关可以忽略后续资料。' : 
            '. Please solve the above problems based on the reference materials. If they are not relevant, you can ignore the subsequent materials.');
        let num = 0;
        
        // 重置所有片段的匹配状态
        blocks.value.forEach((b:any) => b.state = false);
        
        // 按不同模式匹配
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
            // 短暂延迟确保数据更新完成
            setTimeout(() => {
                atlasModuleRef.value.refreshAtlas()
            }, 100)
        }
        }
        result.value = store.locales == 'zh' ? 
            `正在思考，查询到${num}个资料。` : 
            `Thinking and found ${num} pieces of data.`;
        
        // 发送到ollama服务
        history.push({ role: 'user', content: content });
        ollama = new Ollama({ host: model.value.url });
        const response = await ollama.chat({ 
            model: model.value.chat, 
            messages: history, 
            think: model.value.think,
            stream: true 
        });
        
        // 流式输出
        result.value = "";
        for await (const part of response) {
            result.value += part.message.content;
        }
        
        return true;

        // 辅助函数：处理降维结果
        function processDimensionalityReductionResults(points: number[][]) {
            const queryPoint = points[points.length - 1]; // 最后一个是查询点
            const blockSimilarities = new Map<number, number[]>(); // 原始索引 -> 相似度数组
            
            // 计算每个block的相似度（不包括查询点）
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
            
            // 更新blocks.value中的相似度（取平均值）
            blocks.value.forEach((block:any, index:any) => {
                const similarities = blockSimilarities.get(index) || [];
                block.p = similarities.length > 0 ? 
                    similarities.reduce((a, b) => a + b, 0) / similarities.length : 
                    0;
            });
        }
        
        // 辅助函数：绘制可视化
        function drawVisualization() {
            nextTick(() => {
                const container = document.getElementById('mds-chart');
                if (!container) return;
                
                // 准备前50个block的数据
                const pointsToDraw = blocks.value.slice(0, 50).map((block:any) => ({
                    x: block.A_vector[0], // 注意：实际应该使用降维后的坐标
                    y: block.A_vector[1], // 这里简化处理，实际应用需要存储降维坐标
                    label: block.label,
                    p: block.p,
                    content: block.A
                }));
                
                // 添加查询点
                pointsToDraw.push({
                    x: 0, // 应该使用实际的查询点坐标
                    y: 0,
                    label: "Q",
                    p: 1,
                    isQuery: true
                });
                
                drawScatterPlot(container, pointsToDraw);
            });
        }
        
        // 添加辅助函数：计算合并后的嵌入向量
        async function computeMergedEmbeddings() {
            const mergedVectors = [];
            for (const block of blocks.value) {
                // 合并A和Q内容
                const mergedContent = block.A + (block.Q.length > 0 && block.Q !== "问题未推理" ? " " + block.Q : "");
                // 计算合并内容的嵌入向量
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

        // 添加辅助函数：处理合并后的降维结果
        function processMergedDimensionalityReductionResults(points: number[][]) {
            const queryPoint = points[points.length - 1]; // 最后一个是查询点
                
            // 计算每个block的相似度（不包括查询点）
            for(let i = 0; i < blocks.value.length; i++) {
                const point = points[i];
                const dx = point[0] - queryPoint[0];
                const dy = point[1] - queryPoint[1];
                const distance = Math.sqrt(dx * dx + dy * dy);
                blocks.value[i].p = 1 / (1 + distance); // 直接使用距离的倒数作为相似度
            }
        }
    }
    
    // 计算余弦相似度
    function cosineSimilarity(vecA:number[], vecB:number[]) {
        // 确保向量长度相同
        if (vecA.length !== vecB.length) {
            throw new Error(vecA.length+"/"+vecB.length+"向量维度不匹配");
        }

        // 计算点积
        let dotProduct = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
        }

        // 计算模长
        const magnitudeA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
        const magnitudeB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));

        // 避免除以零
        if (magnitudeA === 0 || magnitudeB === 0) {
            return 0;
        }

        return dotProduct / (magnitudeA * magnitudeB);
    }
    // 添加MDS计算函数
    function computeMDS(vectors: number[][], iterations: number, epsilon: number): number[][] {
        const n = vectors.length;
        if (n === 0) return [];
        
        // 计算距离矩阵
        const distances = Matrix.zeros(n, n);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                distances.set(i, j, 1 - cosineSimilarity(vectors[i], vectors[j]));
            }
        }
        
        // 经典MDS算法
        const H = Matrix.eye(n).sub(Matrix.ones(n, n).mul(1 / n));
        
        // 计算D²：不使用map，改用循环
        const D2 = Matrix.zeros(n, n);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                const val = distances.get(i, j);
                D2.set(i, j, val * val);
            }
        }
        
        // B = -0.5 * H * D² * H
        const B = H.mmul(D2).mmul(H).mul(-0.5);
        
        // 计算SVD
        const svd = new SingularValueDecomposition(B);
        const U = svd.leftSingularVectors;
        const s = svd.diagonal;
        
        // 创建 sqrt(S) 对角矩阵
        const sqrtS = Matrix.zeros(n, n);
        for (let i = 0; i < s.length; i++) {
            sqrtS.set(i, i, Math.sqrt(Math.max(s[i], 0))); // 确保非负
        }
        
        // X = U * sqrt(S)
        const X = U.mmul(sqrtS);
        
        // 取前2维
        const result: number[][] = [];
        for (let i = 0; i < n; i++) {
            result.push([X.get(i, 0), X.get(i, 1)]);
        }
        
        return result;
    }
    // 添加PCA计算函数
    function computePCA(vectors: number[][]): number[][] {
        const n = vectors.length;
        if (n === 0) return [];
        
        // 创建矩阵
        const matrix = new Matrix(vectors);
        
        // 中心化数据（减去均值）
        const means = [];
        for (let j = 0; j < matrix.columns; j++) {
            let sum = 0;
            for (let i = 0; i < matrix.rows; i++) {
                sum += matrix.get(i, j);
            }
            means[j] = sum / matrix.rows;
        }
        
        // 减去均值
        for (let i = 0; i < matrix.rows; i++) {
            for (let j = 0; j < matrix.columns; j++) {
                matrix.set(i, j, matrix.get(i, j) - means[j]);
            }
        }
        
        // 计算协方差矩阵
        const covMatrix = matrix.transpose().mmul(matrix).mul(1 / (matrix.rows - 1));
        
        // 计算特征值和特征向量
        const svd = new SingularValueDecomposition(covMatrix);
        const eigenvectors = svd.leftSingularVectors;
        
        // 取前两个主成分
        const result: number[][] = [];
        for (let i = 0; i < matrix.rows; i++) {
            const row = matrix.getRow(i);
            const pc1 = row.reduce((sum, val, j) => sum + val * eigenvectors.get(j, 0), 0);
            const pc2 = row.reduce((sum, val, j) => sum + val * eigenvectors.get(j, 1), 0);
            result.push([pc1, pc2]);
        }
        
        return result;
    }
    // 添加绘制散点图函数
    function drawScatterPlot(container: HTMLElement, points: {x: number, y: number, label: string, p: number, isQuery?: boolean, content?: string}[]) {
        // 清空容器
        container.innerHTML = '';
        const width = container.clientWidth;
        const height = container.clientHeight;
        const margin = {top: 20, right: 20, bottom: 20, left: 40};
        
        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);
        
        // 计算包含所有点的范围（包括问题点）
        const xExtent = d3.extent(points, d => d.x) as [number, number];
        const yExtent = d3.extent(points, d => d.y) as [number, number];
        
        const x = d3.scaleLinear()
            .domain(xExtent)
            .range([margin.left, width - margin.right]);
        
        const y = d3.scaleLinear()
            .domain(yExtent)
            .range([height - margin.bottom, margin.top]);
        
        // 添加坐标轴
        svg.append('g')
            .attr('transform', `translate(0,${height - margin.bottom})`)
            .call(d3.axisBottom(x));
        
        svg.append('g')
            .attr('transform', `translate(${margin.left},0)`)
            .call(d3.axisLeft(y));
        
        // 添加连接线（从问题点到其他点）
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
        
        // 创建工具提示div
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
        
        // 添加知识片段点
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
                // 显示工具提示
                tooltip.style('visibility', 'visible')
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 10) + 'px')
                    .html(`
                        <div><strong>${d.label}</strong></div>
                        <div>${store.locales=='zh'?'相似度':'Similarity'}: ${(d.p*100).toFixed(1)}%</div>
                        <hr style="margin:5px 0;border-color:var(--borderColor);">
                        <div>${d.content || '无内容'}</div>
                    `);
                
                // 高亮当前点
                d3.select(this)
                    .attr('r', 6)
                    .attr('stroke-width', 1.5);
            })
            .on('mouseout', function() {
                // 隐藏工具提示
                tooltip.style('visibility', 'hidden');
                
                // 恢复默认大小
                d3.select(this)
                    .attr('r', 4)
                    .attr('stroke-width', 0.5);
            });
        
        // 添加问题点（特殊标记）
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

    // 知识库加工后的片段数
    const processNum = computed(()=>{
        return blocks.value.filter((item:any) => item.Q !== '问题未推理').length
    })
    // 保存处理后的知识库
    const save = async function(){
        // 获取当前时间并格式化为文件名
        const now = new Date();
        const timestamp = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}-${now.getSeconds().toString().padStart(2, '0')}`;
        
        // 准备文件摘要信息
        const fileSummaryData = {} as any
        fileSummaries.value.forEach((value: any, key: string) => {
            fileSummaryData[key] = {
                content: value.content,
                vector: value.vector // 保存向量
            }
        })
        
        // 创建保存对象，包含配置信息和文件摘要
        const saveData = {
            // 保存配置信息
            config: {
                embedModel: model.value.embed, // 保存嵌入模型
                timestamp: new Date().toISOString(),
                version: "2.0", // 版本号升级，支持文件摘要
                summaryWeight: model.value.summaryWeight,
                sliceWeight: model.value.sliceWeight
            },
            // 保存文件摘要信息
            fileSummaries: fileSummaryData,
            // 保存知识库数据
            blocks: blocks.value.map((block: any) => {
                // 只保存必要的信息，去除临时计算的分数
                const { fileSummaryScore, sliceScore, reverseScore, fileSummaryContent, ...rest } = block
                return rest
            })
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
    // 读取处理后的知识库
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
            
            // 检查版本
            const version = saveData.config?.version || "1.0"
            
            if (version === "1.0") {
                // 旧版本格式，不包含文件摘要信息
                if (!saveData.blocks || !saveData.config) {
                    throw new Error('知识库文件格式错误')
                }
                
                // 加载知识库数据
                blocks.value = saveData.blocks
                
                // 恢复嵌入模型配置
                if (saveData.config.embedModel) {
                    model.value.embed = saveData.config.embedModel
                }
                
                // 清空文件摘要信息
                fileSummaries.value.clear()
                
                kb_state.value = (store.locales === 'zh' ? 
                    `已加载知识库(旧版本): ${kbFile.label}` : 
                    `Loaded knowledge base(old version): ${kbFile.label}`)
            } else if (version === "2.0") {
                // 新版本格式，包含文件摘要信息
                if (!saveData.blocks || !saveData.config || !saveData.fileSummaries) {
                    throw new Error('知识库文件格式错误')
                }
                
                // 加载文件摘要信息
                fileSummaries.value.clear()
                Object.entries(saveData.fileSummaries).forEach(([key, value]: [string, any]) => {
                    fileSummaries.value.set(key, {
                        content: value.content,
                        vector: value.vector
                    })
                })
                
                // 加载知识库数据
                blocks.value = saveData.blocks
                
                // 恢复配置
                if (saveData.config.embedModel) {
                    model.value.embed = saveData.config.embedModel
                }
                if (saveData.config.summaryWeight !== undefined) {
                    model.value.summaryWeight = saveData.config.summaryWeight
                }
                if (saveData.config.sliceWeight !== undefined) {
                    model.value.sliceWeight = saveData.config.sliceWeight
                }
                
                kb_state.value = (store.locales === 'zh' ? 
                    `已加载知识库: ${kbFile.label}` : 
                    `Loaded knowledge base: ${kbFile.label}`)
            } else {
                throw new Error(`不支持的知识库版本: ${version}`)
            }
            
            // 切换到切片视图
            viewMode.value = 'slice'
        } catch (error:any) {
            console.error('加载知识库出错:', error)
            kb_state.value = store.locales === 'zh' ? 
                `加载知识库出错: ${error.message}` : 
                `Error loading knowledge base: ${error.message}`
        }
    }
    // 扫描知识库文件
    const scanKnowledgeBases = async function() {
        if (!store.root) return
        
        try {
            const result = await window.ipcRenderer.invoke("getFilesRelation", store.root, 1)
            if (!result) return

            const { fileList = [] } = result
            knowledgeBases.value = fileList.filter((file: any) => file.path.endsWith('.kb'))
            
            // 按修改时间排序，最新的在前面
            knowledgeBases.value.sort((a: any, b: any) => {
                return (b.mtime || 0) - (a.mtime || 0)
            })
            
            // 默认选择最新的
            if (knowledgeBases.value.length > 0) {
                selectedKbIndex.value = 0
            }
        } catch (error) {
            console.error('扫描知识库出错:', error)
        }
    }
    const init = async function() {
        // 如果已有根目录，优先加载文件列表和内容以恢复界面状态
        if (store.root) {
            try {
                await loadFolderFiles(store.root)
            } catch (e) {
                console.warn('加载文件夹失败或无内容:', e)
            }
        }

        // 扫描知识库文件但不自动加载
        await scanKnowledgeBases()
        await getModel()
    }
    

    const atlasModuleRef = ref()
    function scheduleRefreshAtlas(delay = 180) {
        if (viewMode.value === 'atlas' && atlasModuleRef.value) {
            atlasModuleRef.value.scheduleRefreshAtlas(delay)
        }
    }

    // 处理加载知识库
    const handleLoadKnowledgeBase = async (index: number) => {
        await loadKnowledgeBases(index)
    }

    // 在onMounted中添加图谱初始化
    onMounted(async () => {
        await init() // 确保异步初始化完成
        await nextTick() // 确保 DOM 更新
    })

    onBeforeUnmount(() => {
        if (atlasModuleRef.value) {
            atlasModuleRef.value.cleanupAtlas()
        }
        store.saveConfig()
    })

</script>
    
<template>
    <div class="main">
        <div v-if="panel=='聊天'||panel=='混合'" style="display: flex;flex-direction: column;min-width:265px;flex:1;border-right: 1px var(--borderColor) solid;">
            <div style="display: flex;width:calc(100% - 5px);padding-right: 5px;">
                <input style="flex:2;margin-right: 0px;" phace v-model="prompt" :placeholder="store.locales=='zh'?'请输入问题':'Please enter your question'"/>
                <div style="display:flex;align-items:center;gap:6px;margin-left:6px;">
                    <div class="button" @click="chat(prompt)"><i class="fa fa-send"></i> </div>
                </div>
                <div class="button" title="打开对话界面" @click="panel=='混合'?panel='聊天':panel='混合'" :class="{active:panel=='混合'}">
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
                <div style="display: flex;flex-direction:row">
                    <div class="button" title="打开对话界面" @click="panel=='管理'?panel='混合':panel='管理'" :class="{active:panel=='混合'}">
                        <i class="fa fa-comment-o" ></i>
                    </div>
                    <div class="button" title="文件" @click="viewMode='file'" :class="{active:viewMode=='file'}">
                        <i class="fa fa-book" ></i>
                    </div>
                    <div class="button" title="切片" @click="viewMode='slice'" :class="{active:viewMode=='slice'}">
                        <i class="fa fa-file-text-o" ></i>
                    </div>
                    <div class="button" title="图谱" @click="viewMode='atlas'" :class="{active:viewMode=='atlas'}">
                        <i class="iconfont">&#xe662;</i>
                    </div>
                    <div class="button" title="测试" @click="viewMode='test'" :class="{active:viewMode=='test'}">
                        <i class="fa fa-th"></i>
                    </div>
                    <div class="button" title="设置" @click="viewMode='set'" :class="{active:viewMode=='set'}">
                        <i class="fa fa-cog"></i>
                    </div>
                    <div class="button" @click="openFolder" title="打开文件夹"><i class="fa fa-folder-open"></i> </div>
                    <div style="padding:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{store.root}}</div>
                </div>
            </div>
            <div style="height:calc(100% - 41px);display: flex;">
                <div class="scoll" style="max-width: 100%;flex:2;height:100%;overflow-y: auto;">
                    <!-- 文件视图 -->
                    <div v-if="viewMode=='file'" style="display:flex;gap:8px;padding:8px;height:100%;box-sizing:border-box;align-items:stretch;">
                        <div class="scoll" style="width:240px;height:100%; overflow:auto; border:1px solid var(--borderColor); border-radius:5px; padding:6px; box-sizing:border-box;">
                            <div v-if="files.length===0" style="color:var(--borderColor);">无文件</div>
                            <div v-for="(file, idx) in files" :key="idx" :class="{active: selectedFileIndex===idx}" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;padding:4px;border-radius:4px;">
                                <div @click="previewFile(Number(idx))" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;"> <i :class="store.icon(file.extension)"></i> {{file.label}} </div>
                            </div>
                        </div>
                        <div style="flex:1; height:100%; border:1px solid var(--borderColor); border-radius:5px; padding:6px; overflow:auto; box-sizing:border-box;">
                            <pdf_preview 
                                v-if="isPdfFile(files[selectedFileIndex]?.extension)"
                                :file-path="files[selectedFileIndex]?.path"
                                :file-name="files[selectedFileIndex]?.label"
                            />
                            <md_read v-else :content="files[selectedFileIndex]?.content" :path="files[selectedFileIndex]?.path"/>
                        </div>
                    </div>

                    <!-- 切片视图 -->
                    <div style="display: flex;flex-direction:row" v-if="viewMode=='slice'">
                        <select v-model="selectedKbIndex" style="flex:1;height:32px;margin: 5px 0px 5px 5px;" @change="loadKnowledgeBases(selectedKbIndex)" title="选择知识库版本">
                            <option v-for="(kb, index) in knowledgeBases" :key="index" :value="index">
                                {{ kb.label }} 
                            </option>
                        </select>
                        <select v-model="documentName"style="flex:1;height:32px;margin: 5px 0px 5px 5px;" title="选择文档切片">
                            <option 
                                v-for="(option, index) in documents" 
                                :key="index" 
                                :value="option.name"
                            >
                                {{ option.name }}
                            </option>
                        </select>
                         <div class="button" title="读取知识库" @click="loadKnowledgeBases(selectedKbIndex)">
                            <i class="fa fa-history"></i>
                        </div>
                        <div class="button" title="保存知识库" @click="save">
                            <i class="fa fa-floppy-o"></i>
                        </div>
                        <div style="padding: 8px 2px;white-space: nowrap;overflow: hidden;text-overflow: ellipsis"> <i class="iconfont">&#xe65d;</i>{{store.locales=='zh'?'&nbsp;嵌入':'Embed'}} {{processNum}}/{{blocks.length}}</div>
                        <div class="button" title="读取文件和切片" @click="process"><i class="fa fa-cut"></i></div>
                        <div class="button" style="margin-right: 5px;" title="提取信息" @click="reasonings()"><i class="fa fa-question"></i> </div>
                    </div>
                    <div v-if="viewMode=='slice'" class="blocks scoll" @dragover.prevent>
                        <div v-for="(block, index) in filteredBlocks" :key="index" class="block scoll">
                            <div class="label">
                                <span class="ellipsis" :style="{color:block.state?'var(--fontActiveColor)':''}" :title="block.label">
                                    <i :class="store.icon(block.extension)"></i> 
                                    {{block.label}}
                                </span>
                                <div style="display:flex;font-size:10px;align-items:flex-end;">
                                    <span>{{(block.p*100).toFixed(1)+"%"}}</span>
                                </div>
                                <button @click="block.show='A'" :style="{color:block.show!='Q'?'var(--fontActiveColor)':''}" :title="block.A_vector?.length > 0 ? block.A_vector?.length + '维向量' : '向量未计算'"><i class="fa fa-file-text-o"></i> </button>
                                <button @click="block.show='Q'" :style="{color:block.show=='Q'?'var(--fontActiveColor)':''}" :title="block.Q_vector?.length > 0 ? block.Q_vector?.length + '维向量'  : '向量未计算'"><i :class="block.Q!='问题未推理'?'fa fa-commenting-o':'fa fa-comment-o'"></i> </button>
                                <button @click="reasoning(Number(index))"><i class="fa fa-question"></i> </button>
                            </div>
                            <hr />
                            <block_md v-if="block.show!='Q'" :content="block.A" :fontSize="'8px'" :maxHeight="'170px'"/>
                            <textarea class="scoll" style="font-size: 8px;" v-if="block.show=='Q'" v-model="block.Q"></textarea>
                        </div>
                    </div>

                    <!-- 图谱视图 -->
                    <knowAtlas
                        v-if="viewMode=='atlas'"
                        ref="atlasModuleRef"
                        :store="store"
                        :files="files"
                        :blocks="blocks"
                        :kb_state="kb_state"
                        @updateState="(state:any) => kb_state = state"
                        @scheduleRefresh="(delay:any) => scheduleRefreshAtlas(delay)"
                    />

                    <!-- 测试视图 -->
                    <div v-if="viewMode=='test'" style="display:flex;height:100%;width:100%;">
                        <testManager
                            :store="store"
                            :blocks="blocks"
                            :files="files"
                            :model="model"
                            :getModel="getModel"
                            :cosineSimilarity="cosineSimilarity"
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
    }
    .message{
        display:block;
        position:fixed;
        right:5px;
        top:8px;
        font-size: 10px;
        background-color: var(--backgroundColor);
        border: 1px var(--borderColor) solid;
        padding:5px;
        border-radius: 5px;
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
        height:fit-content;
        max-height:calc(100% - 48px);
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
        width:29px;
        padding:0px;
        line-height:29px;
    }
    
</style>