// electron/llama-service.mjs
import { getLlama, LlamaChatSession } from 'node-llama-cpp';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

let llamaModelCache = new Map();
let llamaStreamRequests = new Map();
let activeContexts = new Set(); // 跟踪活跃的 context

async function validateModelFile(modelPath) {
    if (!fs.existsSync(modelPath)) {
        throw new Error(`模型文件不存在: ${modelPath}`);
    }
    const stats = fs.statSync(modelPath);
    const sizeMB = stats.size / 1024 / 1024;
    console.log(`[llama-service] 文件大小: ${sizeMB.toFixed(2)} MB`);
    return true;
}

async function getLlamaModel(modelPath, options) {
    if (llamaModelCache.has(modelPath)) {
        console.log('[llama-service] 使用缓存的模型');
        return llamaModelCache.get(modelPath);
    }
    
    try {
        await validateModelFile(modelPath);
        
        const llama = await getLlama();
        const threads = 2;
        const gpuLayers = 0;
        const contextSize = 2048;
        
        const model = await llama.loadModel({
            modelPath: modelPath,
            gpuLayers: gpuLayers,
            threads: threads,
            contextSize: contextSize
        });
        
        llamaModelCache.set(modelPath, model);
        console.log('[llama-service] 模型加载成功');
        return model;
    } catch (error) {
        console.error('[llama-service] 加载模型失败:', error);
        throw error;
    }
}

// 释放 context 资源
async function releaseContext(context) {
    if (context && !context.isReleased) {
        try {
            // 尝试释放 context 资源
            if (typeof context.release === 'function') {
                await context.release();
            }
            activeContexts.delete(context);
            console.log('[llama-service] Context 已释放');
        } catch (error) {
            console.error('[llama-service] 释放 context 失败:', error);
        }
    }
}

// 清理所有资源
async function cleanup() {
    console.log('[llama-service] 开始清理资源...');
    
    // 释放所有活跃的 context
    for (const context of activeContexts) {
        await releaseContext(context);
    }
    activeContexts.clear();
    
    // 清理流式请求
    for (const [id, request] of llamaStreamRequests) {
        if (request.controller) {
            request.controller.abort();
        }
    }
    llamaStreamRequests.clear();
    
    // 注意：不清缓存模型，以便下次快速使用
    console.log('[llama-service] 资源清理完成');
}

async function scanModels(modelsDir) {
    const resolvedDir = path.resolve(modelsDir || './models');
    const availableModels = [];
    
    if (!fs.existsSync(resolvedDir)) {
        fs.mkdirSync(resolvedDir, { recursive: true });
        return { success: true, models: availableModels };
    }
    
    const files = fs.readdirSync(resolvedDir);
    for (const file of files) {
        const fullPath = path.join(resolvedDir, file);
        const stat = fs.statSync(fullPath);
        
        if (!stat.isDirectory() && (file.endsWith('.gguf') || file.endsWith('.GGUF'))) {
            const name = file.replace(/\.gguf$/i, '');
            availableModels.push({ name, path: fullPath });
        }
    }
    
    return { success: true, models: availableModels };
}

async function runInference(params) {
    const { modelPath, prompt, temperature, maxTokens } = params;
    let context = null;
    let session = null;
    
    try {
        const safeMaxTokens = Math.min(maxTokens, 2048);
        
        const model = await getLlamaModel(modelPath, {});
        context = await model.createContext();
        activeContexts.add(context); // 跟踪 context
        
        session = new LlamaChatSession({ contextSequence: context.getSequence() });
        
        const response = await session.prompt(prompt, {
            temperature: temperature || 0.7,
            maxTokens: safeMaxTokens,
            topP: 0.9,
            topK: 40
        });
        
        return { success: true, content: response };
        
    } catch (error) {
        console.error('[llama-service] 推理失败:', error);
        return { success: false, error: error.message };
        
    } finally {
        // ✅ 关键：释放 session 和 context
        if (session) {
            session = null;
        }
        
        if (context) {
            await releaseContext(context);
        }
        
        // 可选：触发垃圾回收（如果需要）
        if (global.gc) {
            global.gc();
        }
    }
}

async function runStreamInference(id, params) {
    const { modelPath, prompt, temperature, maxTokens } = params;
    const requestId = randomUUID();
    let context = null;
    let session = null;
    const controller = new AbortController();
    
    llamaStreamRequests.set(requestId, { controller });
    
    try {
        const safeMaxTokens = Math.min(maxTokens, 2048);
        
        const model = await getLlamaModel(modelPath, {});
        context = await model.createContext();
        activeContexts.add(context);
        
        session = new LlamaChatSession({ contextSequence: context.getSequence() });
        
        process.send({ type: 'streamStart', id, requestId });
        
        let fullResponse = '';
        
        await session.prompt(prompt, {
            temperature: temperature || 0.7,
            maxTokens: safeMaxTokens,
            topP: 0.9,
            topK: 40,
            onTextChunk: (chunk) => {
                if (controller.signal.aborted) return;
                if (chunk) {
                    fullResponse += chunk;
                    process.send({ type: 'streamChunk', id, requestId, chunk });
                }
            }
        });
        
        process.send({ type: 'streamComplete', id, requestId, fullContent: fullResponse });
        
    } catch (error) {
        console.error('[llama-service] 流式推理失败:', error);
        process.send({ type: 'streamError', id, requestId, error: error.message });
        
    } finally {
        // ✅ 关键：释放资源
        if (session) {
            session = null;
        }
        
        if (context) {
            await releaseContext(context);
        }
        
        // 清理请求记录
        llamaStreamRequests.delete(requestId);
        
        // 触发垃圾回收
        if (global.gc) {
            global.gc();
        }
    }
}

// 处理进程退出信号
process.on('SIGTERM', async () => {
    console.log('[llama-service] 收到 SIGTERM 信号');
    await cleanup();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('[llama-service] 收到 SIGINT 信号');
    await cleanup();
    process.exit(0);
});

process.on('message', async (message) => {
    const { type, id, params } = message;
    console.log('[llama-service] 收到消息:', type);
    
    try {
        switch (type) {
            case 'scan':
                const result = await scanModels(params.modelsDir);
                process.send({ type: 'scanResult', id, result });
                break;
                
            case 'inference':
                const inferenceResult = await runInference(params);
                process.send({ type: 'inferenceResult', id, result: inferenceResult });
                break;
                
            case 'streamInference':
                await runStreamInference(id, params);
                break;
                
            case 'abort':
                const info = llamaStreamRequests.get(params.requestId);
                if (info && info.controller) {
                    info.controller.abort();
                }
                process.send({ type: 'abortResult', id, result: { success: true } });
                break;
                
            case 'cleanup':
                await cleanup();
                process.send({ type: 'cleanupResult', id, result: { success: true } });
                break;
        }
    } catch (error) {
        console.error('[llama-service] 处理失败:', error);
        process.send({ type: `${type}Result`, id, error: error.message });
    }
});

console.log('[llama-service] 服务已启动，使用保守配置');