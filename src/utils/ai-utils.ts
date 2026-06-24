// utils/ai-utils.ts

import { Ollama } from 'ollama/dist/browser.mjs';
// 注意：node-llama-cpp 需要在 Node.js 环境中运行，不能在浏览器环境中
// 所以需要通过 IPC 调用来使用

// 定义消息类型
interface Message {
    role: string;
    content: string;
    images?: any[];
    tool_calls?: any[];
    tool_name?: string;
}

// 定义配置类型
interface OllamaConfig {
    model_url: string;
    model: string;
}

// Llama 配置类型
interface LlamaConfig {
    modelPath: string;
    modelName: string;
    availableModels: Array<{ name: string; path: string }>;
    modelsDir: string;
    contextSize: number;
    gpuLayers: number;
    threads: number;
    temperature: number;
    maxTokens: number;
    topP: number;
    topK: number;
}

// LM Studio 配置类型
interface LMStudioConfig {
    base_url: string;
    model: string;
    available_models: string[];
    api_key?: string; // LM Studio 默认不需要 API key，但保留以兼容
}

interface LLMConfig {
    stream: boolean;
    temperature: number;
    top_p: number;
    max_tokens: number;
    format?: string;
    think?: boolean | string;
    logprobs?: boolean;
    top_logprobs?: number;
    keep_alive?: string | number;
    tools?: any[];
    options?: any;
}

// AI API工具函数
export class AIUtils {
    // 检查Ollama连接
    static async checkOllamaConnection(ollamaConfig: any) {
        try {
            const ollama = new Ollama({ host: ollamaConfig.model_url });
            const result = await ollama.list();
            
            if (result && result.models) {
                const online = true;
                const available_models = result.models.map((model: any) => model.name);
                
                // 如果没有选择模型，使用第一个可用的模型
                let model = ollamaConfig.model;
                if (!model && result.models.length > 0) {
                    model = result.models[0].name;
                }
                
                return { online, available_models, model };
            } else {
                return { online: false, available_models: [], model: ollamaConfig.model };
            }
        } catch (error) {
            console.error('Ollama连接错误:', error);
            return { online: false, available_models: [], model: ollamaConfig.model };
        }
    }

    // 检查 llama.cpp 连接和可用模型
    static async checkLlamaConnection(llamaConfig: any): Promise<{
        online: boolean;
        availableModels: Array<{ name: string; path: string }>;
    }> {
        try {
            // 通过 IPC 调用主进程来扫描 GGUF 文件
            // 注意：这里需要 window.ipcRenderer，如果在浏览器环境需要特殊处理
            if (typeof window !== 'undefined' && window.ipcRenderer) {
                const result = await window.ipcRenderer.invoke('scanLlamaModels', {
                    modelsDir: llamaConfig.modelsDir || './models'
                });
                
                if (result.success) {
                    const availableModels = result.models || [];
                    const online = availableModels.length > 0;
                    
                    // 验证当前选择的模型是否还存在
                    if (llamaConfig.modelPath && !availableModels.find((m: any) => m.path === llamaConfig.modelPath)) {
                        // 模型文件不存在，清除选择
                        llamaConfig.modelPath = '';
                        llamaConfig.modelName = '';
                    }
                    
                    return { online, availableModels };
                } else {
                    return { online: false, availableModels: [] };
                }
            } else {
                // 降级方案：无法扫描，返回已有的模型列表
                return {
                    online: llamaConfig.modelPath ? true : false,
                    availableModels: llamaConfig.availableModels || []
                };
            }
        } catch (error) {
            console.error('检查llama连接失败:', error);
            return { online: false, availableModels: [] };
        }
    }

    static async checkLMStudioConnection(lmstudioConfig: {
        base_url: string;
        model?: string;
    }): Promise<{
        online: boolean;
        available_models: string[];
        model?: string;
    }> {
        if (!lmstudioConfig.base_url) {
            return { online: false, available_models: [], model: '' };
        }

        try {
            // LM Studio 使用 OpenAI 兼容的 /v1/models 端点
            const response = await fetch(`${lmstudioConfig.base_url}/v1/models`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                const available_models = data.data.map((model: any) => model.id);
                
                // 检查当前选择的模型是否在可用列表中
                let model = lmstudioConfig.model;
                if (model && !available_models.includes(model)) {
                    model = available_models.length > 0 ? available_models[0] : '';
                }
                if (!model && available_models.length > 0) {
                    model = available_models[0];
                }

                return { online: true, available_models, model };
            } else {
                console.error('LM Studio API连接失败:', response.statusText);
                return { online: false, available_models: [], model: lmstudioConfig.model };
            }
        } catch (error) {
            console.error('LM Studio连接错误:', error);
            return { online: false, available_models: [], model: lmstudioConfig.model };
        }
    }

    static async sendToLMStudio(
        lmstudioConfig: LMStudioConfig,
        llmConfig: LLMConfig,
        messages: Message[],
        options?: {
            onStream?: (chunk: string) => void;
            onComplete?: (content: string) => void;
            onError?: (error: Error) => void;
            signal?: AbortSignal;
        }
    ): Promise<string> {
        if (!lmstudioConfig.model) {
            const error = new Error('请先在AI配置中选择一个LM Studio模型');
            options?.onError?.(error);
            throw error;
        }

        if (!lmstudioConfig.base_url) {
            const error = new Error('请先配置LM Studio服务地址');
            options?.onError?.(error);
            throw error;
        }

        try {
            // 构建符合 OpenAI 格式的请求体
            const requestBody = {
                model: lmstudioConfig.model,
                messages: messages.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                stream: llmConfig.stream && !!options?.onStream,
                temperature: llmConfig.temperature || 0.7,
                max_tokens: llmConfig.max_tokens || 2048,
                top_p: llmConfig.top_p || 1,
            };

            const endpoint = `${lmstudioConfig.base_url}/v1/chat/completions`;
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };

            // 如果有 API key（LM Studio 默认不需要，但保留兼容）
            if (lmstudioConfig.api_key) {
                headers['Authorization'] = `Bearer ${lmstudioConfig.api_key}`;
            }

            // 使用通用的流式/非流式请求处理
            if (llmConfig.stream && options?.onStream) {
                return await AIUtils.makeStreamingRequest(endpoint, requestBody, headers, {
                    ...options,
                    // 添加 OpenAI 特定的响应解析
                    parseResponse: (parsed: any) => {
                        let content = '';
                        if (parsed.choices && parsed.choices[0]) {
                            const delta = parsed.choices[0].delta;
                            if (delta && delta.content) {
                                content = delta.content;
                            }
                        }
                        return content;
                    }
                });
            } else {
                // 非流式请求
                const controller = new AbortController();
                if (options?.signal) {
                    options.signal.addEventListener('abort', () => controller.abort());
                }

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(requestBody),
                    signal: controller.signal
                });

                if (!response.ok) {
                    throw new Error(`LM Studio API错误: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                let content = '';

                // 解析 OpenAI 兼容的响应格式
                if (data.choices && data.choices[0]) {
                    if (data.choices[0].message && data.choices[0].message.content) {
                        content = data.choices[0].message.content;
                    } else if (data.choices[0].text) {
                        content = data.choices[0].text;
                    }
                }

                options?.onComplete?.(content);
                return content;
            }
        } catch (error) {
            console.error('[AIUtils] LM Studio请求失败:', error);
            options?.onError?.(error as Error);
            throw error;
        }
    }

    // 发送到 llama.cpp
    static async sendToLlama(
        llamaConfig: LlamaConfig,
        llmConfig: LLMConfig,
        messages: Message[],
        options?: {
            onStream?: (chunk: string) => void;
            onComplete?: (content: string) => void;
            onError?: (error: Error) => void;
            signal?: AbortSignal;
        }
    ): Promise<string> {
        if (!llamaConfig.modelPath) {
            const error = new Error('请先在AI配置中选择一个GGUF模型文件');
            options?.onError?.(error);
            throw error;
        }

        try {
            if (typeof window !== 'undefined' && window.ipcRenderer) {
                // 构建提示词
                let prompt = '';
                const systemMessage = messages.find(m => m.role === 'system');
                const userMessages = messages.filter(m => m.role !== 'system');
                
                if (systemMessage && systemMessage.content) {
                    prompt += `System: ${systemMessage.content}\n\n`;
                }
                
                for (const msg of userMessages) {
                    if (msg.role === 'user') {
                        prompt += `User: ${msg.content}\n`;
                    } else if (msg.role === 'assistant') {
                        prompt += `Assistant: ${msg.content}\n`;
                    }
                }
                prompt += `Assistant: `;
                
                const inferenceParams = {
                    modelPath: llamaConfig.modelPath,
                    prompt: prompt,
                    temperature: llmConfig.temperature || llamaConfig.temperature || 0.7,
                    maxTokens: llmConfig.max_tokens || llamaConfig.maxTokens || 2048,
                    topP: llmConfig.top_p || llamaConfig.topP || 0.9,
                    topK: llamaConfig.topK || 40,
                    contextSize: llamaConfig.contextSize || 2048,
                    gpuLayers: llamaConfig.gpuLayers || 0,
                    threads: llamaConfig.threads || 2,
                    stream: llmConfig.stream && !!options?.onStream
                };
                
                if (inferenceParams.stream) {
                    // 流式响应
                    return new Promise((resolve, reject) => {
                        let fullContent = '';
                        let requestId: string | null = null;
                        let isCompleted = false;
                        let timeoutId: NodeJS.Timeout;
                        
                        // 设置超时（5分钟）
                        timeoutId = setTimeout(() => {
                            if (!isCompleted) {
                                console.error('[AIUtils] 流式推理超时');
                                cleanup();
                                const error = new Error('流式推理超时');
                                options?.onError?.(error);
                                reject(error);
                            }
                        }, 300000);
                        
                        // 处理数据块
                        const chunkHandler = (event: any, data: any) => {
                            
                            // 处理数据块
                            if (data.chunk && data.chunk !== '') {
                                fullContent += data.chunk;
                                
                                if (options?.onStream) {
                                    options.onStream(data.chunk);
                                }
                            }
                            
                            // 处理完成
                            if (data.done) {
                                isCompleted = true;
                                clearTimeout(timeoutId);
                                
                                if (options?.onComplete) {
                                    options.onComplete(fullContent);
                                }
                                
                                cleanup();
                                resolve(fullContent);
                            }
                            
                            // 处理错误
                            if (data.error) {
                                console.error('[AIUtils] 流式错误:', data.error);
                                isCompleted = true;
                                clearTimeout(timeoutId);
                                
                                const error = new Error(data.error);
                                if (options?.onError) {
                                    options.onError(error);
                                }
                                
                                cleanup();
                                reject(error);
                            }
                        };
                        
                        // 处理IPC错误
                        const errorHandler = (event: any, error: any) => {
                            console.error('[AIUtils] IPC错误:', error);
                            isCompleted = true;
                            clearTimeout(timeoutId);
                            
                            const err = new Error(typeof error === 'string' ? error : 'IPC通信错误');
                            if (options?.onError) {
                                options.onError(err);
                            }
                            
                            cleanup();
                            reject(err);
                        };
                        
                        // 清理监听器
                        const cleanup = () => {
                            try {
                                if (window.ipcRenderer) {
                                    // 尝试多种清理方法
                                    if (typeof window.ipcRenderer.off === 'function') {
                                        window.ipcRenderer.off('llamaStreamChunk', chunkHandler);
                                        window.ipcRenderer.off('llamaStreamError', errorHandler);
                                    } else if (typeof window.ipcRenderer.removeListener === 'function') {
                                        window.ipcRenderer.removeListener('llamaStreamChunk', chunkHandler);
                                        window.ipcRenderer.removeListener('llamaStreamError', errorHandler);
                                    } else if (typeof window.ipcRenderer.removeAllListeners === 'function') {
                                        window.ipcRenderer.removeAllListeners('llamaStreamChunk');
                                        window.ipcRenderer.removeAllListeners('llamaStreamError');
                                    }
                                }
                            } catch (error) {
                                console.error('[AIUtils] 清理监听器失败:', error);
                            }
                        };
                        
                        // 注册事件监听器
                        if (typeof window.ipcRenderer.on === 'function') {
                            window.ipcRenderer.on('llamaStreamChunk', chunkHandler);
                            window.ipcRenderer.on('llamaStreamError', errorHandler);
                            
                            // 发送推理请求
                            window.ipcRenderer.invoke('llamaStreamInference', inferenceParams)
                                .then((result: any) => {
                                    requestId = result.requestId;
                                })
                                .catch((error: any) => {
                                    console.error('[AIUtils] 启动流式推理失败:', error);
                                    cleanup();
                                    const err = new Error(error.message || '启动流式推理失败');
                                    if (options?.onError) {
                                        options.onError(err);
                                    }
                                    reject(err);
                                });
                        } else {
                            console.error('[AIUtils] ipcRenderer.on 不可用');
                            const error = new Error('ipcRenderer.on 不可用');
                            if (options?.onError) {
                                options.onError(error);
                            }
                            reject(error);
                        }
                        
                        // 处理中止信号
                        if (options?.signal) {
                            options.signal.addEventListener('abort', () => {
                                console.log('[AIUtils] 流式推理被中止');
                                if (!isCompleted && requestId) {
                                    window.ipcRenderer.invoke('llamaStreamAbort', { requestId })
                                        .catch(console.error);
                                }
                                cleanup();
                                const error = new Error('请求被中止');
                                if (options?.onError) {
                                    options.onError(error);
                                }
                                reject(error);
                            });
                        }
                    });
                } else {
                    // 非流式响应
                    const result = await window.ipcRenderer.invoke('llamaInference', inferenceParams);
                    
                    if (result.success) {
                        const content = result.content || '';
                        if (options?.onComplete) {
                            options.onComplete(content);
                        }
                        return content;
                    } else {
                        const error = new Error(result.error || '推理失败');
                        if (options?.onError) {
                            options.onError(error);
                        }
                        throw error;
                    }
                }
            } else {
                throw new Error('llama.cpp 推理需要在 Electron 主进程中运行');
            }
        } catch (error) {
            console.error('[AIUtils] llama.cpp请求失败:', error);
            if (options?.onError) {
                options.onError(error as Error);
            }
            throw error;
        }
    }

    // 获取 llama 模型加载状态
    static async getLlamaModelStatus(modelPath: string): Promise<{
        loaded: boolean;
        memoryUsage?: number;
        contextSize?: number;
    }> {
        try {
            if (typeof window !== 'undefined' && window.ipcRenderer) {
                const result = await window.ipcRenderer.invoke('getLlamaModelStatus', { modelPath });
                return result;
            }
            return { loaded: false };
        } catch (error) {
            console.error('获取模型状态失败:', error);
            return { loaded: false };
        }
    }

    // 卸载 llama 模型（释放内存）
    static async unloadLlamaModel(modelPath: string): Promise<boolean> {
        try {
            if (typeof window !== 'undefined' && window.ipcRenderer) {
                const result = await window.ipcRenderer.invoke('unloadLlamaModel', { modelPath });
                return result.success;
            }
            return false;
        } catch (error) {
            console.error('卸载模型失败:', error);
            return false;
        }
    }

    // 检查OpenAI兼容API连接
    static async checkOpenAIConnection(openaiConfig: any) {
        if (!openaiConfig.api_key && !openaiConfig.base_url?.includes('localhost')) {
            // 对于 LM Studio 等本地服务，允许没有 API key
            if (!openaiConfig.base_url) {
                return { online: false, available_models: [] };
            }
        }
        
        try {
            const response = await fetch(`${openaiConfig.base_url}/v1/models`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${openaiConfig.api_key || 'not-needed'}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                const available_models = data.data.map((model: any) => model.id);
                return { online: true, available_models };
            } else {
                console.error('OpenAI API连接失败:', response.statusText);
                return { online: false, available_models: [] };
            }
        } catch (error) {
            console.error('OpenAI API连接错误:', error);
            return { online: false, available_models: [] };
        }
    }

    // 检查Anthropic连接
    static async checkAnthropicConnection(anthropicConfig: any) {
        if (!anthropicConfig.api_key) {
            return { online: false };
        }
        
        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': anthropicConfig.api_key,
                    'anthropic-version': anthropicConfig.api_version,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: anthropicConfig.model,
                    max_tokens: 1,
                    messages: [{ role: 'user', content: 'test' }]
                })
            });
            
            return { online: response.ok };
        } catch (error) {
            console.error('Anthropic API连接错误:', error);
            return { online: false };
        }
    }

    // 检查Google连接
    static async checkGoogleConnection(googleConfig: any) {
        if (!googleConfig.api_key) {
            return { online: false };
        }
        
        try {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${googleConfig.model}:generateContent?key=${googleConfig.api_key}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: 'test' }]
                        }]
                    })
                }
            );
            
            return { online: response.ok };
        } catch (error) {
            console.error('Google Gemini API连接错误:', error);
            return { online: false };
        }
    }

    // 发送到Ollama
    static async sendToOllama(ollamaConfig: OllamaConfig, llmConfig: LLMConfig, messages: Message[], options?: {
        onStream?: (chunk: string) => void,
        onComplete?: (content: string) => void,
        onError?: (error: Error) => void,
        signal?: AbortSignal  // 添加 signal 参数
    }) {
        // 检查模型是否已选择
        if (!ollamaConfig.model) {
            const error = new Error('请先在AI配置中选择一个Ollama模型');
            options?.onError?.(error);
            throw error;
        }
        
        try {
            const ollama = new Ollama({ host: ollamaConfig.model_url });
            
            // 格式化消息，确保包含多模态支持
            const formattedMessages = messages.map(message => {
                const formattedMessage: any = {
                    role: message.role,
                    content: message.content || ''
                };
                
                // 如果有图片数据，添加到消息中
                if (message.images && message.images.length > 0) {
                    formattedMessage.images = message.images.map((img: any) => {
                        // 如果图片是base64字符串，直接使用
                        if (typeof img === 'string') {
                            // 如果已经是完整的data URL，提取base64部分
                            if (img.startsWith('data:')) {
                                const parts = img.split(',');
                                return parts.length > 1 ? parts[1] : img;
                            }
                            return img;
                        }
                        // 如果图片是Uint8Array，转换为base64
                        else if (img instanceof Uint8Array) {
                            const binary = Array.from(img).map(byte => String.fromCharCode(byte)).join('');
                            return btoa(binary);
                        }
                        // 如果图片是ArrayBuffer，转换为Uint8Array再转base64
                        else if (img instanceof ArrayBuffer) {
                            const uint8Array = new Uint8Array(img);
                            const binary = Array.from(uint8Array).map(byte => String.fromCharCode(byte)).join('');
                            return btoa(binary);
                        }
                        // Blob对象
                        else if (img instanceof Blob) {
                            console.warn('Blob对象需要先转换为base64或ArrayBuffer');
                            return '';
                        }
                        // 其他格式，尝试转换
                        else {
                            console.warn('未知的图片格式:', typeof img, img);
                            return '';
                        }
                    }).filter((img: string) => img); // 过滤掉空值
                }
                
                // 如果有工具调用结果
                if (message.tool_calls) {
                    formattedMessage.tool_calls = message.tool_calls;
                }
                
                // 如果有工具执行结果
                if (message.tool_name) {
                    formattedMessage.tool_name = message.tool_name;
                }
                
                return formattedMessage;
            });
            
            // 构建请求参数
            const requestParams: any = {
                model: ollamaConfig.model,
                messages: formattedMessages,
                stream: llmConfig.stream,
                options: {
                    temperature: llmConfig.temperature,
                    top_p: llmConfig.top_p,
                    num_predict: llmConfig.max_tokens,
                }
            };
            
            // 添加可选参数
            if (llmConfig.format === 'json') {
                requestParams.format = 'json';
            }
            
            if (llmConfig.think) {
                requestParams.think = llmConfig.think;
            }
            
            if (llmConfig.logprobs) {
                requestParams.logprobs = llmConfig.logprobs;
                if (llmConfig.top_logprobs) {
                    requestParams.top_logprobs = llmConfig.top_logprobs;
                }
            }
            
            if (llmConfig.keep_alive) {
                requestParams.keep_alive = llmConfig.keep_alive;
            }
            
            if (llmConfig.tools && llmConfig.tools.length > 0) {
                requestParams.tools = llmConfig.tools;
            }
            
            // 如果有其他运行时选项
            if (llmConfig.options) {
                requestParams.options = {
                    ...requestParams.options,
                    ...llmConfig.options
                };
            }
            
            if (llmConfig.stream && options?.onStream) {
                // 流式响应
                let fullContent = '';
                
                // 创建 AbortController 来处理中止
                const controller = new AbortController();
                
                // 如果提供了 signal，监听它的中止事件
                if (options.signal) {
                    options.signal.addEventListener('abort', () => {
                        controller.abort();
                    });
                }
                
                try {
                    // 使用 fetch 直接调用 Ollama API，而不是通过 ollama 库
                    const response = await fetch(`${ollamaConfig.model_url}/api/chat`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            ...requestParams,
                            stream: true
                        }),
                        signal: controller.signal  // 使用我们的 controller.signal
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    if (!response.body) {
                        throw new Error('响应体为空');
                    }
                    
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        
                        // 解码并解析每一行
                        const chunk = decoder.decode(value);
                        const lines = chunk.split('\n').filter(line => line.trim());
                        
                        for (const line of lines) {
                            try {
                                const data = JSON.parse(line);
                                if (data.message?.content) {
                                    const content = data.message.content;
                                    fullContent += content;
                                    options.onStream(content);
                                }
                            } catch (e) {
                                console.warn('解析JSON失败:', line, e);
                            }
                        }
                    }
                    
                    options?.onComplete?.(fullContent);
                    return fullContent;
                    
                } catch (error: any) {
                    // 如果是中止错误，不调用 onError
                    if (error.name === 'AbortError') {
                        console.log('请求被用户中止');
                        return '';
                    }
                    throw error;
                }
                
            } else {
                // 非流式响应 - 使用 fetch 并支持中止
                try {
                    const controller = new AbortController();
                    
                    if (options?.signal) {
                        options.signal.addEventListener('abort', () => {
                            controller.abort();
                        });
                    }
                    
                    const response = await fetch(`${ollamaConfig.model_url}/api/chat`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            ...requestParams,
                            stream: false
                        }),
                        signal: controller.signal
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    const data = await response.json();
                    const content = data.message?.content || '';
                    options?.onComplete?.(content);
                    return content;
                    
                } catch (error: any) {
                    if (error.name === 'AbortError') {
                        console.log('请求被用户中止');
                        return '';
                    }
                    throw error;
                }
            }
            
        } catch (error) {
            console.error('Ollama请求失败:', error);
            options?.onError?.(error as Error);
            throw error;
        }
    }

    // 辅助函数：将图片转换为base64格式
    static async imageToBase64(imageFile: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                // 移除data URL前缀（如"data:image/jpeg;base64,"）
                const base64String = (reader.result as string).split(',')[1];
                resolve(base64String);
            };
            reader.onerror = reject;
            reader.readAsDataURL(imageFile);
        });
    }

    // 辅助函数：将图片URL转换为base64格式
    static async imageUrlToBase64(imageUrl: string): Promise<string> {
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64String = (reader.result as string).split(',')[1];
                    resolve(base64String);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('图片URL转换失败:', error);
            throw error;
        }
    }

    // 辅助函数：创建包含图片的消息
    static createImageMessage(role: string, content: string, images: Array<string | Uint8Array> = []): Message {
        return {
            role,
            content,
            images
        };
    }

    // 构建OpenAI请求体
    static buildOpenAIRequest(openaiConfig: any, llmConfig: any, messages: any[]) {
        // 处理包含图片的消息（如果OpenAI API支持多模态）
        const formattedMessages = messages.map(message => {
            const formattedMessage: any = {
                role: message.role,
                content: []
            };

            // 添加文本内容
            if (message.content) {
                formattedMessage.content.push({
                    type: "text",
                    text: message.content
                });
            }

            // 添加图片内容（如果API支持）
            if (message.images && message.images.length > 0) {
                message.images.forEach((image: string) => {
                    formattedMessage.content.push({
                        type: "image_url",
                        image_url: {
                            url: `data:image/jpeg;base64,${image}`
                        }
                    });
                });
            }

            return formattedMessage;
        });

        return {
            model: openaiConfig.model,
            messages: formattedMessages,
            stream: llmConfig.stream,
            temperature: llmConfig.temperature,
            max_tokens: llmConfig.max_tokens,
            top_p: llmConfig.top_p,
            frequency_penalty: llmConfig.frequency_penalty,
            presence_penalty: llmConfig.presence_penalty,
            response_format: { type: "text" },
            stop: null,
            stream_options: llmConfig.stream ? { include_usage: true } : null,
            thinking: { type: "disabled" }
        };
    }

    // 通用的API请求函数
    static async makeAPIRequest(endpoint: string, body: any, headers: Record<string, string>, options?: any) {
        const stream = body.stream && options?.onStream;
        
        // 检测 API 类型
        const isDeepSeek = endpoint.includes('deepseek.com');
        const isOpenAI = endpoint.includes('openai.com') || endpoint.includes('api.openai.com');
        const isOllama = endpoint.includes('localhost') || endpoint.includes('127.0.0.1');
        if (stream) {
            // 流式响应 - 根据 API 类型选择不同的处理方式
            if (isDeepSeek) {
                // DeepSeek 使用 SSE 格式，但内容格式不同
                return await AIUtils.makeDeepSeekStreamingRequest(endpoint, body, headers, options);
            } else if (isOpenAI || isOllama) {
                // OpenAI 和 Ollama 使用标准的 SSE 格式
                return await AIUtils.makeStreamingRequest(endpoint, body, headers, options);
            } else {
                // 默认使用标准流式处理
                return await AIUtils.makeStreamingRequest(endpoint, body, headers, options);
            }
        } else {
            // 非流式响应
            return await AIUtils.makeStandardRequest(endpoint, body, headers, options);
        }
    }

    static async makeDeepSeekStreamingRequest(endpoint: string, body: any, headers: Record<string, string>, options?: any) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3600000); // 1小时超时
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP错误! 状态码: ${response.status}`);
            }
            
            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('无法获取响应流');
            }
            
            const decoder = new TextDecoder('utf-8');
            let fullContent = '';
            let buffer = '';
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;
                
                // 处理 SSE 格式的数据行
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // 保留最后一个不完整的行
                
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) continue;
                    
                    // 处理 data: 前缀
                    if (trimmedLine.startsWith('data: ')) {
                        const data = trimmedLine.substring(6);
                        
                        // 检查是否是结束标记
                        if (data === '[DONE]') continue;
                        
                        try {
                            // 解析 JSON 数据
                            const parsed = JSON.parse(data);
                            
                            // 从 DeepSeek 的响应格式中提取内容
                            if (parsed.choices && parsed.choices[0]) {
                                const delta = parsed.choices[0].delta;
                                if (delta && delta.content) {
                                    const content = delta.content;
                                    fullContent += content;
                                    options?.onStream?.(content);
                                }
                            }
                        } catch (e) {
                            // 如果解析失败，记录错误但继续
                            console.warn('解析 DeepSeek 流式数据失败:', e, '原始数据:', data);
                        }
                    }
                }
            }
            
            options?.onComplete?.(fullContent);
            return fullContent;
            
        } catch (error) {
            console.error('DeepSeek流式请求失败:', error);
            options?.onError?.(error as Error);
            throw error;
        }
    }

    // 标准请求（非流式）
    static async makeStandardRequest(endpoint: string, body: any, headers: Record<string, string>, options?: any) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3600000);
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP错误! 状态码: ${response.status}`);
            }
            
            const contentType = response.headers.get('content-type') || '';
            let content = '';
            
            if (contentType.includes('application/json')) {
                const data = await response.json();
                
                // 尝试多种可能的响应格式
                if (data.choices && data.choices[0]) {
                    // OpenAI/DeepSeek 格式
                    if (data.choices[0].message && data.choices[0].message.content) {
                        content = data.choices[0].message.content;
                    } else if (data.choices[0].text) {
                        content = data.choices[0].text;
                    }
                } else if (data.content && data.content[0]?.text) {
                    // Anthropic 格式
                    content = data.content[0].text;
                } else if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
                    // Google 格式
                    content = data.candidates[0].content.parts[0].text;
                } else if (data.message?.content) {
                    // Ollama 格式
                    content = data.message.content;
                } else if (data.response) {
                    // 其他格式
                    content = data.response;
                } else if (typeof data === 'string') {
                    content = data;
                } else {
                    // 尝试将整个响应作为字符串
                    content = JSON.stringify(data);
                }
            } else {
                // 纯文本响应
                content = await response.text();
            }
            
            options?.onComplete?.(content);
            return content;
            
        } catch (error) {
            console.error('API请求失败:', error);
            options?.onError?.(error as Error);
            throw error;
        }
    }

    // 流式请求
    static async makeStreamingRequest(endpoint: string, body: any, headers: Record<string, string>, options?: any) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3600000);
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP错误! 状态码: ${response.status}`);
            }
            
            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('无法获取响应流');
            }
            
            const decoder = new TextDecoder('utf-8');
            let fullContent = '';
            let buffer = '';
            
            // 获取自定义解析函数
            const parseResponse = options?.parseResponse || ((parsed: any) => {
                let content = '';
                if (parsed.choices && parsed.choices[0]) {
                    const delta = parsed.choices[0].delta;
                    if (delta && delta.content) {
                        content = delta.content;
                    }
                } else if (parsed.message && parsed.message.content) {
                    content = parsed.message.content;
                } else if (parsed.delta && parsed.delta.text) {
                    content = parsed.delta.text;
                } else if (parsed.candidates && parsed.candidates[0]?.content?.parts[0]?.text) {
                    content = parsed.candidates[0].content.parts[0].text;
                }
                return content;
            });
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;
                
                // 处理 SSE 格式的数据行
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) continue;
                    
                    // 处理 data: 前缀
                    if (trimmedLine.startsWith('data: ')) {
                        const data = trimmedLine.substring(6);
                        if (data === '[DONE]') continue;
                        
                        try {
                            const parsed = JSON.parse(data);
                            const content = parseResponse(parsed);
                            if (content) {
                                fullContent += content;
                                options?.onStream?.(content);
                            }
                        } catch (e) {
                            // 忽略 JSON 解析错误
                            console.debug('解析流式数据失败:', e);
                        }
                    } else {
                        // 尝试直接解析 JSON（某些 API 不遵循 SSE 格式）
                        try {
                            const parsed = JSON.parse(trimmedLine);
                            const content = parseResponse(parsed);
                            if (content) {
                                fullContent += content;
                                options?.onStream?.(content);
                            }
                        } catch (e) {
                            // 忽略
                        }
                    }
                }
            }
            
            options?.onComplete?.(fullContent);
            return fullContent;
            
        } catch (error) {
            console.error('流式请求失败:', error);
            options?.onError?.(error as Error);
            throw error;
        }
    }
}