// store/index.ts 

import { defineStore } from "pinia"
import { nextTick } from "vue"
import { TTSManager, createTTSManager } from '../utils/tts-manager'
import { AIUtils } from '../utils/ai-utils'

export const usestore = defineStore('data', {
    // 创建state
    state: () => ({
        root: "" as string, // 仓库位置
        path: "" as string, // 当前路径
        skillsPath: "" as string, // 技能文件夹路径
        tree: [] as any, // 目录结构
        data: [] as any, // 打开的文件数据
        index: null as any, // 打开的文件序号
        view: [] as any, // 视图
        mainPanel: "主页" as any, // 主面板
        locales: 'zh', // 语言
        TrustedPython: false, // 是否为可信环境？
        UI: {
            theme: '浅蓝色',
            backgroundColor: "#ffffff",
            borderColor: "#d0d7de",
            menuColor: "#f6f8fa",
            menuActiveColor: "#9ec4f0",
            fontColor: "#1f2328",
            fontActiveColor: "#03254d",
            layout: 'horizontal',
        }, // 主题颜色
        AIconfig: {
            // 大模型配置
            llm: {
                // 支持的模型类型
                types: ['llama','ollama', 'openai', 'deepseek', 'anthropic', 'google', 'azure', 'custom'],
                type: 'ollama', // 当前使用的类型
                // llama 配置，使用本地GGUF文件推理
                llama: {
                    modelsDir:'', // GGUF 模型文件夹路径
                    modelPath: '', // GGUF 文件路径
                    modelName: '', // 模型名称（用于显示）
                    availableModels: [] as Array<{
                        name: string;
                        path: string;
                    }>, // 可用的 GGUF 模型列表
                    // llama.cpp 配置参数
                    contextSize: 8192, // 上下文大小
                    gpuLayers: 0, // GPU 层数，0表示只用CPU，-1表示自动
                    threads: 0, // 线程数，0表示自动
                    temperature: 0.7,
                    maxTokens: 8192,
                    topP: 0.9,
                    topK: 40,
                },
                // Ollama 配置
                ollama: {
                    model_url: 'http://127.0.0.1:11434',
                    model: '',
                    available_models: [] as any[],
                },
                
                // OpenAI 兼容 API 配置 (包括 DeepSeek, OpenAI, 其他兼容API)
                openai: {
                    api_key: '',
                    base_url: 'https://api.deepseek.com', // DeepSeek默认地址
                    model: 'deepseek-chat', // 默认模型
                    available_models: [] as string[], // 可用的模型列表
                },
                
                // Anthropic Claude 配置
                anthropic: {
                    api_key: '',
                    model: 'claude-3-haiku-20240307',
                    api_version: '2023-06-01',
                },
                
                // Google Gemini 配置
                google: {
                    api_key: '',
                    model: 'gemini-pro',
                },
                
                // Azure OpenAI 配置
                azure: {
                    api_key: '',
                    endpoint: '',
                    deployment: '',
                    api_version: '2024-02-15-preview',
                },
                
                // 自定义API配置
                custom: {
                    api_url: '',
                    api_key: '',
                    model: '',
                    headers: {} as Record<string, string>,
                    request_body: {} as any, // 自定义请求体
                },
                
                // 通用配置
                online: false,
                temperature: 0.7,
                max_tokens: 8000,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0,
                stream: true,
            },
            
            // TTS配置 - 添加Qwen3-TTS类型
            tts: {
                type: '本地' as '本地' | 'indexTTS2' | 'Qwen3-TTS',
                url: 'http://localhost:9880/',
                voice: '四川方言', // 默认使用四川方言
                language: 'zh',
                audio: null as HTMLAudioElement | null,
                rate: 1.0,
                pitch: 1.0,
                emo: '正常',
                weight: 0.5,
                // Qwen3-TTS特定配置
                qwen3: {
                    available_voices: [] as string[], // 可用声音列表
                    connected: false, // 连接状态
                    speed: 1.0, // 语速
                    pitch: 1.0, // 音调
                    voices_url: 'http://localhost:7862/gradio_api/call/update_voices', // 刷新音色API地址
                }
            },
        },
        
        // TTS管理器实例
        ttsManager: null as TTSManager | null,
        
        // 多模态支持：存储图片数据
        imageAttachments: [] as Array<{
            id: string;
            data: string | Uint8Array | ArrayBuffer;
            type: string;
            name?: string;
        }>,
    }),
    
    // 计算属性
    getters: {
        // 获取当前模型的配置
        currentLLMConfig: (state) => {
            switch(state.AIconfig.llm.type) {
                case 'ollama':
                    return state.AIconfig.llm.ollama;
                case 'openai':
                case 'deepseek':
                    return state.AIconfig.llm.openai;
                case 'anthropic':
                    return state.AIconfig.llm.anthropic;
                case 'google':
                    return state.AIconfig.llm.google;
                case 'azure':
                    return state.AIconfig.llm.azure;
                case 'custom':
                    return state.AIconfig.llm.custom;
                default:
                    return state.AIconfig.llm.ollama;
            }
        },
        
        // 检查是否有API密钥
        hasAPIKey: (state) => {
            const config = state.AIconfig.llm;
            switch(config.type) {
                case 'ollama':
                    return true;
                case 'openai':
                case 'deepseek':
                    return !!config.openai.api_key;
                case 'anthropic':
                    return !!config.anthropic.api_key;
                case 'google':
                    return !!config.google.api_key;
                case 'azure':
                    return !!config.azure.api_key;
                case 'custom':
                    return !!config.custom.api_key;
                default:
                    return true;
            }
        },
        
        // 获取当前模型的API端点
        currentAPIEndpoint: (state) => {
            const config = state.AIconfig.llm;
            switch(config.type) {
                case 'ollama':
                    return `${config.ollama.model_url}/api/chat`;
                case 'openai':
                case 'deepseek':
                    return `${config.openai.base_url}/v1/chat/completions`;
                case 'anthropic':
                    return 'https://api.anthropic.com/v1/messages';
                case 'google':
                    return `https://generativelanguage.googleapis.com/v1beta/models/${config.google.model}:generateContent`;
                case 'azure':
                    return `${config.azure.endpoint}/openai/deployments/${config.azure.deployment}/chat/completions?api-version=${config.azure.api_version}`;
                case 'custom':
                    return config.custom.api_url;
                default:
                    return '';
            }
        },
        
        // 检查TTS是否连接
        isTTSConnected: (state) => {
            const ttsConfig = state.AIconfig.tts;
            if (ttsConfig.type === 'Qwen3-TTS') {
                return ttsConfig.qwen3.connected;
            }
            return true; // 本地和indexTTS2默认认为已连接
        },
        
        // 获取TTS类型列表
        ttsTypes: () => {
            return ['本地', 'indexTTS2', 'Qwen3-TTS'];
        },
        
        // 获取Qwen3-TTS可用声音列表
        qwen3TTSVoices: (state) => {
            if (state.AIconfig.tts.type === 'Qwen3-TTS') {
                return state.AIconfig.tts.qwen3.available_voices;
            }
            return [];
        },
        
        // 获取图片附件
        imageAttachmentsCount: (state) => {
            return state.imageAttachments.length;
        },
    },
    
    // 方法
    actions: {
        init() {
            // 初始化TTS管理器
            this.ttsManager = createTTSManager(
                this.AIconfig.tts,
                (state:any) => {
                    // 状态变化回调，可以在这里处理TTS状态变化
                }
            );
        },
        
        // 重新缩放
        async resize() {
            await nextTick()
            if (document.createEvent) {
                var event = document.createEvent("HTMLEvents");
                event.initEvent("resize", true, true);
                window.dispatchEvent(event);
            }
        },
        
        // 初始化配置
        initConfig() {
            localStorage.clear()
            window.ipcRenderer.send('closeWindow')
        },
        
        // 储存配置信息
        saveConfig() {
            localStorage.setItem('root', JSON.stringify(this.root))
            localStorage.setItem('path', JSON.stringify(this.path))
            localStorage.setItem('skillsPath', JSON.stringify(this.skillsPath))
            localStorage.setItem('data', JSON.stringify(this.data))
            localStorage.setItem('index', JSON.stringify(this.index))
            localStorage.setItem('view', JSON.stringify(this.view))
            localStorage.setItem('mainPanel', JSON.stringify(this.mainPanel))
            localStorage.setItem('locales', JSON.stringify(this.locales))
            localStorage.setItem('AIconfig', JSON.stringify(this.AIconfig))
            localStorage.setItem('UI', JSON.stringify(this.UI))
            // 注意：图片附件不保存到localStorage，因为可能很大
        },
        
        // 读取配置信息
        loadConfig() {
            if (localStorage.getItem('root') !== null) {
                this.root = JSON.parse(localStorage.getItem('root')!)
            }
            if (localStorage.getItem('path') !== null) {
                this.path = JSON.parse(localStorage.getItem('path')!)
            }
            if (localStorage.getItem('skillsPath') !== null) {
                this.skillsPath = JSON.parse(localStorage.getItem('skillsPath')!)
            }
            if (localStorage.getItem('data') !== null) {
                this.data = JSON.parse(localStorage.getItem('data')!)
            }
            if (localStorage.getItem('index') !== null) {
                this.index = JSON.parse(localStorage.getItem('index')!)
            }
            if (localStorage.getItem('view') !== null) {
                this.view = JSON.parse(localStorage.getItem('view')!)
            }
            if (localStorage.getItem('mainPanel') !== null) {
                this.mainPanel = JSON.parse(localStorage.getItem('mainPanel')!)
            }
            if (localStorage.getItem('locales') !== null) {
                this.locales = JSON.parse(localStorage.getItem('locales')!)
            }
            if (localStorage.getItem('AIconfig') !== null) {
                // 保存当前选中的模型，避免被覆盖
                const savedConfig = JSON.parse(localStorage.getItem('AIconfig')!)
                
                // 如果是Ollama配置，先保存选中的模型
                if (savedConfig.llm.type === 'ollama' && savedConfig.llm.ollama.model) {
                    savedConfig.llm.ollama.model = savedConfig.llm.ollama.model;
                }
                
                this.AIconfig = savedConfig
            }
            if (localStorage.getItem('UI') !== null) {
                this.UI = JSON.parse(localStorage.getItem('UI')!)
                this.setTheme()
            }
        },
        
        async addTab(data: any) {
            let existIndex = null
            let i = 0
            while (i < this.data.length) {
                if (this.data[i].path == data.path) existIndex = i
                i++;
            }
            if (existIndex == null) {
                const fileContent = await window.ipcRenderer.invoke('readFile', data.path)
                const attributes = await window.ipcRenderer.invoke('getConfig', data.path)
                this.data.push({
                    ...data, // 使用对象展开语法将原始数据的属性展开到新的对象中
                    attributes: attributes, // 添加属性
                    content: fileContent // 添加内容
                })
                this.index = this.data.length - 1
            } else {
                this.index = existIndex
            }
            // 设定打开的路径
            if (data.type == 'file') {
                this.path = data.path.substring(0, data.path.lastIndexOf('\\'));
            } else {
                this.path = data.path
            }
        },
        
        backPath() {
            // 如果当前路径已经是 root 目录，则不执行任何操作
            if (this.path === this.root || this.path === "") {
                return;
            }

            // 如果当前路径在 root 目录下，则向上一级
            if (this.path.startsWith(this.root)) {
                const parentPath = this.path.substring(0, this.path.lastIndexOf("\\"));

                // 如果上一级目录是 root 目录，则将路径设置为 root
                if (parentPath === this.root) {
                    this.path = this.root;
                } else {
                    this.path = parentPath;
                }
            } else {
                // 如果当前路径不在 root 目录下，则不执行任何操作
                return;
            }
        },
        
        toggleView(str: string) {
            if (this.view.indexOf(str) == -1) {
                this.view[this.view.length] = str
            } else {
                this.view.splice(this.view.indexOf(str), 1)
            }
            this.resize()
        },
        
        isView(str: string) {
            if (this.view.indexOf(str) == -1) {
                return false
            } else {
                return true
            }
        },
        
        changeTheme() {
            if (this.UI.theme == "浅蓝色") {
                this.UI = {
                    theme: '浅蓝色',
                    backgroundColor: "#ffffff",
                    borderColor: "#d0d7de",
                    menuColor: "#f6f8fa",
                    menuActiveColor: "#9ec4f0",
                    fontColor: "#1f2328",
                    fontActiveColor: "#03254d",
                    layout: this.UI.layout
                }
            } else if (this.UI.theme == "浅红色") {
                this.UI = {
                    theme: '浅红色',
                    backgroundColor: "#ffffff",
                    borderColor: "#888888",
                    menuColor: "#E9E9E9",
                    menuActiveColor: "#ECD7D6",
                    fontColor: "#111111",
                    fontActiveColor: "#990000",
                    layout: this.UI.layout
                }
            } else if (this.UI.theme == "暖色调") {
                this.UI = {
                    theme: '暖色调',
                    backgroundColor: "#fef6e4",
                    borderColor: "#ff8a8a",
                    menuColor: "#f2e7d5",
                    menuActiveColor: "#fd6d6d",
                    fontColor: "#172c66",
                    fontActiveColor: "#621601",
                    layout: this.UI.layout
                }
            } else if (this.UI.theme == "午夜蓝") {
                this.UI = {
                    theme: '午夜蓝',
                    backgroundColor: "#1a1b26",
                    borderColor: "#414868",
                    menuColor: "#24283b",
                    menuActiveColor: "#06318d",
                    fontColor: "#c0caf5",
                    fontActiveColor: "#eaf556",
                    layout: this.UI.layout
                }
            } else if (this.UI.theme == "深色") {
                this.UI = {
                    theme: '深色',
                    backgroundColor: "#0D1117",
                    borderColor: "#30363D",
                    menuColor: "#161617",
                    menuActiveColor: "#24272E",
                    fontColor: "#ffffff",
                    fontActiveColor: "#CCA700",
                    layout: this.UI.layout
                }
            } else if (this.UI.theme == "灰色") {
                this.UI = {
                    theme: '灰色',
                    backgroundColor: "#1e1e1e",
                    borderColor: "#444444",
                    menuColor: "#303030",
                    menuActiveColor: "#4c4c4c",
                    fontColor: "#ffffff",
                    fontActiveColor: "#ffff00",
                    layout: this.UI.layout
                }
            } else if (this.UI.theme == "极简灰") {
                this.UI = {
                     theme: '极简灰',
                    backgroundColor: "#ffffff",
                    borderColor: "#dddddd",
                    menuColor: "#f5f5f5",
                    menuActiveColor: "#e0e0e0",
                    fontColor: "#333333",
                    fontActiveColor: "#000000",
                    layout: this.UI.layout
                }
            } else if (this.UI.theme == "暗夜紫") {
                this.UI = {
                    theme: '暗夜紫',
                    backgroundColor: "#1a142b",
                    borderColor: "#4a3f6e",
                    menuColor: "#2a1f3a",
                    menuActiveColor: "#5a4a8a",
                    fontColor: "#d4c5ff",
                    fontActiveColor: "#b794f4",
                    layout: this.UI.layout
                }
            } else if (this.UI.theme == "奶茶色") {
                this.UI = {
                    theme: '奶茶色',
                    backgroundColor: "#f9f1e7",
                    borderColor: "#d9b99b",
                    menuColor: "#f3e5d5",
                    menuActiveColor: "#e6c9af",
                    fontColor: "#6b4f3c",
                    fontActiveColor: "#aa7a5c",
                    layout: this.UI.layout
                }
            }
            this.setTheme()
        },
        
        setTheme() {
            document.documentElement.style.setProperty("--backgroundColor", this.UI.backgroundColor);
            document.documentElement.style.setProperty("--menuColor", this.UI.menuColor);
            document.documentElement.style.setProperty("--menuActiveColor", this.UI.menuActiveColor);
            document.documentElement.style.setProperty("--fontColor", this.UI.fontColor);
            document.documentElement.style.setProperty("--fontActiveColor", this.UI.fontActiveColor);
            document.documentElement.style.setProperty("--borderColor", this.UI.borderColor);
        },
        
        // TTS函数 - 使用TTS管理器
        tts(text: string) {
            if (!this.ttsManager) {
                this.init();
            }
            this.ttsManager?.play(text);
        },
        
        // 停止TTS
        stopTTS() {
            this.ttsManager?.stop();
        },
        
        // 获取TTS状态
        getTTSState() {
            if (!this.ttsManager) {
                this.init();
            }
            return this.ttsManager?.getTTSState() || {
                isSpeaking: false,
                isPaused: false,
                queueLength: 0,
                type: 'unknown'
            };
        },
        
        // 暂停/恢复TTS
        toggleTTS() {
            if (!this.ttsManager) {
                this.init();
            }
            this.ttsManager?.togglePause();
        },
        
        // 清理TTS资源
        cleanupTTSResources() {
            // 清理所有blob URL
            document.querySelectorAll('audio[src^="blob:"]').forEach(audio => {
                try {
                    const audioElement = audio as HTMLAudioElement;
                    audioElement.pause();
                    audioElement.src = '';
                } catch (error) {
                    console.error("清理音频资源时出错:", error);
                }
            });
        },
        
        // 更新TTS配置
        updateTTSConfig(config: any) {
            this.AIconfig.tts = { ...this.AIconfig.tts, ...config };
            if (this.ttsManager) {
                this.ttsManager.updateConfig(this.AIconfig.tts);
            }
        },
        
        // 测试Qwen3-TTS连接
        async testQwen3TTSConnection(): Promise<{
            success: boolean;
            message: string;
            details?: any;
        }> {
            if (!this.ttsManager) {
                this.init();
            }
            
            try {
                const result = await this.ttsManager?.testQwen3TTSConnection() || { 
                    success: false, 
                    message: 'TTS管理器未初始化' 
                };
                
                // 根据结果中的 success 字段设置连接状态
                this.AIconfig.tts.qwen3.connected = result.success;
                
                return result;
            } catch (error) {
                console.error("测试Qwen3-TTS连接失败:", error);
                this.AIconfig.tts.qwen3.connected = false;
                return {
                    success: false,
                    message: `测试连接失败: ${error instanceof Error ? error.message : String(error)}`
                };
            }
        },
        
        // 设置Qwen3-TTS URL
        setQwen3TTSUrl(url: string) {
            this.AIconfig.tts.url = url;
            if (this.ttsManager) {
                this.ttsManager.updateConfig(this.AIconfig.tts);
            }
        },
        
        // 设置Qwen3-TTS声音
        setQwen3TTSVoice(voice: string) {
            this.AIconfig.tts.voice = voice;
            if (this.ttsManager) {
                this.ttsManager.updateConfig(this.AIconfig.tts);
            }
        },
        
        // 设置Qwen3-TTS语速
        setQwen3TTSSpeed(speed: number) {
            this.AIconfig.tts.qwen3.speed = speed;
            this.AIconfig.tts.rate = speed; // 同时更新通用语速设置
            if (this.ttsManager) {
                this.ttsManager.updateConfig(this.AIconfig.tts);
            }
        },
        
        // 设置Qwen3-TTS音调
        setQwen3TTSPitch(pitch: number) {
            this.AIconfig.tts.qwen3.pitch = pitch;
            this.AIconfig.tts.pitch = pitch; // 同时更新通用音调设置
            if (this.ttsManager) {
                this.ttsManager.updateConfig(this.AIconfig.tts);
            }
        },
        
        // 获取AI配置
        async getAIconfig() {
            const llmConfig = this.AIconfig.llm;
            
            switch (llmConfig.type) {
                case 'llama':
                    // 检查本地模型是否存在
                    const llamaResult = await AIUtils.checkLlamaConnection(this.AIconfig.llm.llama);
                    this.AIconfig.llm.online = llamaResult.online;
                    this.AIconfig.llm.llama.availableModels = llamaResult.availableModels;
                    break;
                case 'ollama':
                    // 保存当前选中的模型
                    const currentModel = llmConfig.ollama.model;
                    const currentUrl = llmConfig.ollama.model_url;
                    
                    // 从localStorage获取保存的模型（始终执行，不判断currentModel是否为空）
                    let savedModel = null;
                    try {
                        const savedConfig = localStorage.getItem('AIconfig');
                        if (savedConfig) {
                            const parsed = JSON.parse(savedConfig);
                            if (parsed.llm?.type === 'ollama' && parsed.llm.ollama?.model) {
                                savedModel = parsed.llm.ollama.model;
                            }
                        }
                    } catch (e) {
                        console.error('从localStorage读取模型失败:', e);
                    }
                    
                    const ollamaResult = await AIUtils.checkOllamaConnection(llmConfig.ollama);
                    this.AIconfig.llm.online = ollamaResult.online;
                    this.AIconfig.llm.ollama.available_models = ollamaResult.available_models;
                    
                    // 决定要恢复哪个模型：优先顺序：savedModel > currentModel > 默认模型
                    let modelToRestore = savedModel || currentModel;
                    
                    // 重要：恢复之前选中的模型
                    if (modelToRestore && ollamaResult.available_models.includes(modelToRestore)) {
                        this.AIconfig.llm.ollama.model = modelToRestore;
                    } else if (ollamaResult.model) {
                        // 如果没有选中或选中的模型不可用，使用默认的
                        this.AIconfig.llm.ollama.model = ollamaResult.model;
                    } else {
                        this.AIconfig.llm.ollama.model = '';
                    }
                    
                    // 恢复URL（防止被覆盖）
                    if (currentUrl) {
                        this.AIconfig.llm.ollama.model_url = currentUrl;
                    }
                    
                    // 保存配置
                    this.saveConfig();
                    break;
                    
                case 'openai':
                case 'deepseek':
                case 'custom':
                    const openaiResult = await AIUtils.checkOpenAIConnection(llmConfig.openai);
                    this.AIconfig.llm.online = openaiResult.online;
                    this.AIconfig.llm.openai.available_models = openaiResult.available_models;
                    break;
                    
                case 'anthropic':
                    const anthropicResult = await AIUtils.checkAnthropicConnection(llmConfig.anthropic);
                    this.AIconfig.llm.online = anthropicResult.online;
                    break;
                    
                case 'google':
                    const googleResult = await AIUtils.checkGoogleConnection(llmConfig.google);
                    this.AIconfig.llm.online = googleResult.online;
                    break;
            }
        },
        
        // 发送消息到AI（统一入口）- 支持多模态
        async sendToAI(messages: any[], options?: {
            onStream?: (chunk: string) => void,
            onComplete?: (content: string) => void,
            onError?: (error: Error) => void,
            signal?: AbortSignal  // 添加这一行
        }) {
            const llmConfig = this.AIconfig.llm;
            
            if (!this.AIconfig.llm.online) {
                const error = new Error('AI服务未连接，请先检查配置');
                options?.onError?.(error);
                throw error;
            }
            
            // 应用功能配置
            let finalMessages = [...messages];
            
            try {
                switch (llmConfig.type) {
                    case 'llama':
                        return await AIUtils.sendToLlama(
                            this.AIconfig.llm.llama, 
                            this.AIconfig.llm, 
                            finalMessages, 
                            {
                                ...options,
                                signal: options?.signal
                            }
                        );
                    case 'ollama':
                        // 将 signal 传递给 AIUtils.sendToOllama
                        return await AIUtils.sendToOllama(llmConfig.ollama, llmConfig, finalMessages, {
                            ...options,
                            signal: options?.signal
                        });
                        
                    case 'openai':
                    case 'deepseek':
                        return await this.sendToOpenAI(finalMessages, options);
                        
                    case 'anthropic':
                        return await this.sendToAnthropic(finalMessages, options);
                        
                    case 'google':
                        return await this.sendToGoogle(finalMessages, options);
                        
                    case 'azure':
                        return await this.sendToAzure(finalMessages, options);
                        
                    case 'custom':
                        return await this.sendToCustom(finalMessages, options);
                        
                    default:
                        const error = new Error(`不支持的模型类型: ${llmConfig.type}`);
                        options?.onError?.(error);
                        throw error;
                }
            } catch (error) {
                console.error('AI请求失败:', error);
                options?.onError?.(error as Error);
                throw error;
            }
        },
        
        // 发送到OpenAI兼容API - 支持多模态
        async sendToOpenAI(messages: any[], options?: any) {
            const openaiConfig = this.AIconfig.llm.openai;
            const llmConfig = this.AIconfig.llm;
            
            // 构建请求体，支持多模态
            const requestBody = AIUtils.buildOpenAIRequest(openaiConfig, llmConfig, messages);
            const endpoint = `${openaiConfig.base_url}/v1/chat/completions`;
            const headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${openaiConfig.api_key}`
            };
            
            return AIUtils.makeAPIRequest(endpoint, requestBody, headers, options);
        },
        
        // 发送到Anthropic Claude - 支持多模态（Claude 3+支持图片）
        async sendToAnthropic(messages: any[], options?: any) {
            const anthropicConfig = this.AIconfig.llm.anthropic;
            const llmConfig = this.AIconfig.llm;
            
            // 转换消息格式，支持多模态
            const anthropicMessages = messages.map(msg => {
                const formattedMsg: any = {
                    role: msg.role === 'assistant' ? 'assistant' : 'user',
                    content: []
                };
                
                // 添加文本内容
                if (msg.content) {
                    formattedMsg.content.push({
                        type: "text",
                        text: msg.content
                    });
                }
                
                // 添加图片内容（如果支持）
                if (msg.images && msg.images.length > 0) {
                    msg.images.forEach((image: string) => {
                        formattedMsg.content.push({
                            type: "image",
                            source: {
                                type: "base64",
                                media_type: "image/jpeg",
                                data: image
                            }
                        });
                    });
                }
                
                return formattedMsg;
            });
            
            const requestBody = {
                model: anthropicConfig.model,
                messages: anthropicMessages,
                max_tokens: llmConfig.max_tokens,
                temperature: llmConfig.temperature,
                top_p: llmConfig.top_p,
                stream: llmConfig.stream,
            };
            
            const endpoint = 'https://api.anthropic.com/v1/messages';
            const headers = {
                'x-api-key': anthropicConfig.api_key,
                'anthropic-version': anthropicConfig.api_version,
                'Content-Type': 'application/json'
            };
            
            return AIUtils.makeAPIRequest(endpoint, requestBody, headers, options);
        },
        
        // 发送到Google Gemini - 支持多模态
        async sendToGoogle(messages: any[], options?: any) {
            const googleConfig = this.AIconfig.llm.google;
            const llmConfig = this.AIconfig.llm;
            
            // 转换消息格式，支持多模态
            const contents = messages.map(msg => {
                const parts: any[] = [];
                
                // 添加文本内容
                if (msg.content) {
                    parts.push({ text: msg.content });
                }
                
                // 添加图片内容
                if (msg.images && msg.images.length > 0) {
                    msg.images.forEach((image: string) => {
                        parts.push({
                            inline_data: {
                                mime_type: "image/jpeg",
                                data: image
                            }
                        });
                    });
                }
                
                return {
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: parts
                };
            });
            
            const requestBody = {
                contents: contents,
                generationConfig: {
                    temperature: llmConfig.temperature,
                    topP: llmConfig.top_p,
                    maxOutputTokens: llmConfig.max_tokens,
                }
            };
            
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${googleConfig.model}:generateContent?key=${googleConfig.api_key}`;
            const headers = {
                'Content-Type': 'application/json'
            };
            
            return AIUtils.makeAPIRequest(endpoint, requestBody, headers, options);
        },
        
        // 发送到Azure OpenAI - 支持多模态（如果模型支持）
        async sendToAzure(messages: any[], options?: any) {
            const azureConfig = this.AIconfig.llm.azure;
            const llmConfig = this.AIconfig.llm;
            
            // Azure OpenAI可能需要不同的格式
            // 这里简化处理，实际使用时需要根据Azure的文档调整
            const requestBody = {
                messages: messages,
                stream: llmConfig.stream,
                temperature: llmConfig.temperature,
                max_tokens: llmConfig.max_tokens,
                top_p: llmConfig.top_p,
                frequency_penalty: llmConfig.frequency_penalty,
                presence_penalty: llmConfig.presence_penalty,
            };
            
            const endpoint = `${azureConfig.endpoint}/openai/deployments/${azureConfig.deployment}/chat/completions?api-version=${azureConfig.api_version}`;
            const headers = {
                'api-key': azureConfig.api_key,
                'Content-Type': 'application/json'
            };
            
            return AIUtils.makeAPIRequest(endpoint, requestBody, headers, options);
        },
        
        // 发送到自定义API - 支持多模态
        async sendToCustom(messages: any[], options?: any) {
            const customConfig = this.AIconfig.llm.custom;
            const llmConfig = this.AIconfig.llm;
            
            const endpoint = customConfig.api_url;
            
            // 检查是否是智谱API（根据URL判断）
            const isGLM = endpoint.includes('bigmodel.cn') ||
                endpoint.includes('open.bigmodel.cn');
            
            let requestBody;
            let headers;
            
            if (isGLM) {
                // 智谱API专用格式 - 需要根据实际情况调整
                requestBody = {
                    model: customConfig.model || 'glm-4', // 默认使用glm-4
                    messages: messages,
                    stream: llmConfig.stream,
                    temperature: llmConfig.temperature,
                    max_tokens: llmConfig.max_tokens,
                    // 智谱API可能需要的额外参数
                    ...(customConfig.request_body || {})
                };
                
                // 智谱API需要特定的Authorization格式
                headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${customConfig.api_key}`,
                    ...(customConfig.headers || {})
                };
            } else {
                // 通用格式
                requestBody = customConfig.request_body || {
                    model: customConfig.model,
                    messages: messages,
                    stream: llmConfig.stream,
                    temperature: llmConfig.temperature,
                    max_tokens: llmConfig.max_tokens,
                };
                
                headers = {
                    'Content-Type': 'application/json',
                    ...(customConfig.api_key && { 'Authorization': `Bearer ${customConfig.api_key}` }),
                    ...customConfig.headers
                };
            }
            
            return AIUtils.makeAPIRequest(endpoint, requestBody, headers, options);
        },
        
        // 多模态相关方法
        
        // 添加图片附件
        async addImageAttachment(file: File | string): Promise<string> {
            let imageData: string | Uint8Array | ArrayBuffer;
            let imageType = 'image/jpeg';
            let imageName = '';
            
            if (typeof file === 'string') {
                // 如果是URL或base64字符串
                if (file.startsWith('http')) {
                    imageData = await AIUtils.imageUrlToBase64(file);
                } else {
                    imageData = file;
                }
                imageName = 'image_' + Date.now() + '.jpg';
            } else {
                // 如果是File对象
                imageData = await AIUtils.imageToBase64(file);
                imageType = file.type;
                imageName = file.name;
            }
            
            const id = 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            this.imageAttachments.push({
                id,
                data: imageData,
                type: imageType,
                name: imageName
            });
            
            return id;
        },
        
        // 移除图片附件
        removeImageAttachment(id: string) {
            const index = this.imageAttachments.findIndex(img => img.id === id);
            if (index !== -1) {
                this.imageAttachments.splice(index, 1);
            }
        },
        
        // 清除所有图片附件
        clearImageAttachments() {
            this.imageAttachments = [];
        },
        
        // 创建包含图片的消息
        createImageMessage(role: string, content: string, imageIds?: string[]) {
            const images: Array<string | Uint8Array> = [];
            
            if (imageIds && imageIds.length > 0) {
                imageIds.forEach(id => {
                    const attachment = this.imageAttachments.find(img => img.id === id);
                    if (attachment) {
                        if (typeof attachment.data === 'string') {
                            images.push(attachment.data);
                        } else if (attachment.data instanceof Uint8Array) {
                            images.push(attachment.data);
                        } else if (attachment.data instanceof ArrayBuffer) {
                            images.push(new Uint8Array(attachment.data));
                        }
                    }
                });
            }
            
            return AIUtils.createImageMessage(role, content, images);
        },
        
        copyToClipboard(text: string) {
            const tempTextArea = document.createElement('textarea')
            tempTextArea.value = text
            document.body.appendChild(tempTextArea)
            tempTextArea.select()
            document.execCommand('copy')
            document.body.removeChild(tempTextArea)
        },
        
        // 使用系统默认应用打开文件
        openByApp: async (path: string) => {
            await window.ipcRenderer.invoke('openByApp', path)
        },
        
        StampToDate(date?: any) {
            if (date == undefined || !(date instanceof Date)) date = new Date()
            const year = date.getFullYear();
            const month = ('0' + (date.getMonth() + 1)).slice(-2);
            const day = ('0' + date.getDate()).slice(-2);
            const hour = ('0' + date.getHours()).slice(-2);
            const min = ('0' + date.getMinutes()).slice(-2);
            const sec = ('0' + date.getSeconds()).slice(-2);
            return `${year}-${month}-${day} ${hour}:${min}:${sec}`;
        },
        
        // 图标
        icon: function (extension: any) {
            let c = "fa fa-th"
            switch (extension) {
                case "folder":
                    c = "fa fa-folder";
                    break;
                case ".md":
                    c = "fa fa-file-text-o";
                    break;
                case ".txt":
                    c = "fa fa-file-text-o";
                    break;
                case ".ini":
                    c = "fa fa-file-text-o";
                    break;
                case ".pptx":
                    c = "fa fa-file-powerpoint-o";
                    break;
                case ".ppt":
                    c = "fa fa-file-powerpoint-o";
                    break;
                case ".doc":
                    c = "fa fa-file-word-o";
                    break;
                case ".docx":
                    c = "fa fa-file-word-o";
                    break;
                case ".xls":
                    c = "fa fa-file-excel-o";
                    break;
                case ".xlsx":
                    c = "fa fa-file-excel-o";
                    break;
                case ".zip":
                    c = "fa fa-file-archive-o";
                    break;
                case ".rar":
                    c = "fa fa-file-archive-o";
                    break;
                case ".png":
                    c = "fa fa-file-image-o ";
                    break;
                case ".jpg":
                    c = "fa fa-file-image-o ";
                    break;
                case ".jpeg":
                    c = "fa fa-file-image-o ";
                    break;
                case ".webp":
                    c = "fa fa-file-image-o ";
                    break;
                case ".pdf":
                    c = "fa fa-file-pdf-o";
                    break;
                case ".html":
                    c = "fa fa-file-code-o";
                    break;
                case ".js":
                    c = "fa fa-file-code-o";
                    break;
                case ".css":
                    c = "fa fa-file-code-o";
                    break;
                case ".json":
                    c = "fa fa-file-code-o";
                    break;
                case ".ts":
                    c = "fa fa-file-code-o";
                    break;
                case ".mp4":
                    c = "fa fa-file-video-o";
                    break;
                case ".wmv":
                    c = "fa fa-file-video-o";
                    break;
                case ".avi":
                    c = "fa fa-file-video-o";
                    break;
                case "flv":
                    c = "fa fa-file-video-o";
                    break;
                case ".mp3":
                    c = "fa fa-file-audio-o";
                    break;
                case ".m4a":
                    c = "fa fa-file-audio-o";
                    break;
                case ".wb":
                    c = "fa fa-file-o";
                    break;
                case ".exe":
                    c = "fa fa-windows"
                default:
                    c = "fa fa-th";
            }
            return c
        },
        
        // 切换模型类型
        switchLLMType(type: string) {
            if (this.AIconfig.llm.types.includes(type)) {
                this.AIconfig.llm.type = type;
                this.AIconfig.llm.online = false;
            }
        },
        
        // 设置OpenAI兼容API配置
        setOpenAIConfig(config: {
            api_key: string;
            base_url?: string;
            model?: string;
        }) {
            if (config.api_key) {
                this.AIconfig.llm.openai.api_key = config.api_key;
            }
            if (config.base_url) {
                this.AIconfig.llm.openai.base_url = config.base_url;
            }
            if (config.model) {
                this.AIconfig.llm.openai.model = config.model;
            }
        },
        
        // 重置配置
        resetLLMConfig(type: string) {
            switch (type) {
                case 'ollama':
                    this.AIconfig.llm.ollama = {
                        model_url: 'http://127.0.0.1:11434',
                        model: '',
                        available_models: [],
                    };
                    break;
                case 'openai':
                case 'deepseek':
                    this.AIconfig.llm.openai = {
                        api_key: '',
                        base_url: 'https://api.deepseek.com',
                        model: 'deepseek-chat',
                        available_models: [],
                    };
                    break;
                case 'anthropic':
                    this.AIconfig.llm.anthropic = {
                        api_key: '',
                        model: 'claude-3-haiku-20240307',
                        api_version: '2023-06-01',
                    };
                    break;
                case 'google':
                    this.AIconfig.llm.google = {
                        api_key: '',
                        model: 'gemini-pro',
                    };
                    break;
                case 'azure':
                    this.AIconfig.llm.azure = {
                        api_key: '',
                        endpoint: '',
                        deployment: '',
                        api_version: '2024-02-15-preview',
                    };
                    break;
                case 'custom':
                    this.AIconfig.llm.custom = {
                        api_url: '',
                        api_key: '',
                        model: '',
                        headers: {},
                        request_body: {},
                    };
                    break;
            }
            this.AIconfig.llm.online = false;
        },
        
        // 测试API连接
        async testConnection() {
            try {
                await this.getAIconfig();
                return this.AIconfig.llm.online;
            } catch (error) {
                console.error('测试连接失败:', error);
                return false;
            }
        },
        
        // 设置TTS语速
        setTTSRate(rate: number) {
            this.AIconfig.tts.rate = rate;
            // 如果是Qwen3-TTS，同时更新特定配置
            if (this.AIconfig.tts.type === 'Qwen3-TTS') {
                this.AIconfig.tts.qwen3.speed = rate;
            }
            if (this.ttsManager) {
                this.ttsManager.setRate(rate);
            }
        },
        
        // 设置TTS音高
        setTTSPitch(pitch: number) {
            this.AIconfig.tts.pitch = pitch;
            // 如果是Qwen3-TTS，同时更新特定配置
            if (this.AIconfig.tts.type === 'Qwen3-TTS') {
                this.AIconfig.tts.qwen3.pitch = pitch;
            }
            if (this.ttsManager) {
                this.ttsManager.setPitch(pitch);
            }
        },
        
        // 设置TTS声音
        setTTSVoice(voice: string) {
            this.AIconfig.tts.voice = voice;
            if (this.ttsManager) {
                this.ttsManager.setVoice(voice);
            }
        },
        
        // 设置TTS语言
        setTTSLanguage(language: string) {
            this.AIconfig.tts.language = language;
            if (this.ttsManager) {
                this.ttsManager.setLanguage(language);
            }
        },
        
        // 设置TTS情感
        setTTSEmotion(emo: string) {
            this.AIconfig.tts.emo = emo;
            if (this.ttsManager) {
                this.ttsManager.setEmotion(emo);
            }
        },
        
        // 设置TTS权重
        setTTSWeight(weight: number) {
            this.AIconfig.tts.weight = weight;
            if (this.ttsManager) {
                this.ttsManager.setWeight(weight);
            }
        }
    }
})