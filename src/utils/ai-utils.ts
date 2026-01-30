// utils/ai-utils.ts

import { Ollama } from 'ollama/dist/browser.mjs';

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

    // 检查OpenAI兼容API连接
    static async checkOpenAIConnection(openaiConfig: any) {
        if (!openaiConfig.api_key) {
            return { online: false, available_models: [] };
        }
        
        try {
            const response = await fetch(`${openaiConfig.base_url}/v1/models`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${openaiConfig.api_key}`,
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
    static async sendToOllama(ollamaConfig: any, llmConfig: any, messages: any[], options?: any) {
        // 检查模型是否已选择
        if (!ollamaConfig.model) {
            const error = new Error('请先在AI配置中选择一个Ollama模型');
            options?.onError?.(error);
            throw error;
        }
        
        try {
            const ollama = new Ollama({ host: ollamaConfig.model_url });
            
            if (llmConfig.stream && options?.onStream) {
                // 流式响应
                let fullContent = '';
                
                const response = await ollama.chat({
                    model: ollamaConfig.model,
                    messages: messages,
                    stream: true,
                    options: {
                        temperature: llmConfig.temperature,
                        top_p: llmConfig.top_p,
                        num_predict: llmConfig.max_tokens,
                    }
                });
                
                // 遍历异步迭代器
                for await (const chunk of response) {
                    // 根据 Ollama 类型定义，chunk 应该包含 message 属性
                    if (chunk.message?.content) {
                        fullContent += chunk.message.content;
                        options.onStream(chunk.message.content);
                    }
                }
                
                options?.onComplete?.(fullContent);
                return fullContent;
                
            } else {
                // 非流式响应
                const response = await ollama.chat({
                    model: ollamaConfig.model,
                    messages: messages,
                    stream: false,
                    options: {
                        temperature: llmConfig.temperature,
                        top_p: llmConfig.top_p,
                        num_predict: llmConfig.max_tokens,
                    }
                });
                
                const content = response.message?.content || '';
                options?.onComplete?.(content);
                return content;
            }
            
        } catch (error) {
            console.error('Ollama请求失败:', error);
            options?.onError?.(error as Error);
            throw error;
        }
    }

    // 构建OpenAI请求体
    static buildOpenAIRequest(openaiConfig: any, llmConfig: any, messages: any[]) {
        return {
            model: openaiConfig.model,
            messages: messages,
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
        
        if (stream) {
            // 流式响应
            return await AIUtils.makeStreamingRequest(endpoint, body, headers, options);
        } else {
            // 非流式响应
            return await AIUtils.makeStandardRequest(endpoint, body, headers, options);
        }
    }

    // 标准请求（非流式）
    static async makeStandardRequest(endpoint: string, body: any, headers: Record<string, string>, options?: any) {
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
            
            const data = await response.json();
            
            // 根据不同API响应格式提取内容
            let content = '';
            if (data.choices && data.choices[0]?.message?.content) {
                // OpenAI格式
                content = data.choices[0].message.content;
            } else if (data.content && data.content[0]?.text) {
                // Anthropic格式
                content = data.content[0].text;
            } else if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
                // Google格式
                content = data.candidates[0].content.parts[0].text;
            } else if (data.message?.content) {
                // Ollama格式
                content = data.message.content;
            } else if (data.response) {
                // 其他格式
                content = data.response;
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
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.trim());
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.substring(6);
                        if (data === '[DONE]') continue;
                        
                        try {
                            const parsed = JSON.parse(data);
                            let content = '';
                            
                            if (parsed.message?.content) {
                                // Ollama格式
                                content = parsed.message.content;
                            } else if (parsed.choices?.[0]?.delta?.content) {
                                // OpenAI格式
                                content = parsed.choices[0].delta.content;
                            } else if (parsed.delta?.text) {
                                // Anthropic格式
                                content = parsed.delta.text;
                            } else if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
                                // Google格式
                                content = parsed.candidates[0].content.parts[0].text;
                            }
                            
                            if (content) {
                                fullContent += content;
                                options?.onStream?.(content);
                            }
                        } catch (e) {
                            // 忽略JSON解析错误
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