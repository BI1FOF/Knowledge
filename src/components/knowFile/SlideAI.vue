<script setup lang="ts">
    import {onMounted,onBeforeUnmount,ref, nextTick,computed,watch} from 'vue'
    import MarkdownIt from 'markdown-it'
    import hljs from 'highlight.js'
    import 'highlight.js/styles/github-dark.css'
    import block_md from '../block_md.vue'
    import {usestore} from '../../store'
    const store=usestore()
    
    // 为每个聊天创建独立配置（配置隔离）
    interface ChatConfig {
        llmType: string
        model: string
        temperature: number
        maxTokens: number
        stream: boolean
        think: boolean
        ifSpeak: boolean
    }

    // 当前聊天的独立配置
    let chatConfig = ref<ChatConfig>({
        llmType: store.AIconfig.llm.type,
        model: '',
        temperature: store.AIconfig.llm.temperature,
        maxTokens: store.AIconfig.llm.max_tokens,
        stream: store.AIconfig.llm.stream,
        think: false,
        ifSpeak: false
    })

    let input = ref("") //输入的消息
    let history = ref([]) as any //历史聊天记录
    let weblink = ref([]) as any//互联网资料 
    let funcIndex = ref(0) //功能序数
    let prompt = ref("") //提示词
    let recording = ref<boolean>(false)

    // 可用模型列表（根据当前模型类型）
    const availableModels = computed(() => {
        const llmType = chatConfig.value.llmType;
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

    // 模型是否可用
    const isModelsAvailable = computed(() => {
        return availableModels.value.length > 0;
    });

    // 当前模型类型显示名称
    const currentModelTypeDisplay = computed(() => {
        const type = chatConfig.value.llmType;
        switch (type) {
            case 'ollama': return 'Ollama';
            case 'openai': return 'OpenAI';
            case 'deepseek': return 'DeepSeek';
            case 'anthropic': return 'Anthropic';
            case 'google': return 'Google';
            case 'azure': return 'Azure';
            case 'custom': return '自定义';
            default: return type.charAt(0).toUpperCase() + type.slice(1);
        }
    });

    // 辅助函数：保存当前配置到本地配置
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

    // 辅助函数：恢复原始配置
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

    // 获取当前模型名称（从store）
    const getCurrentModelFromStore = (type: string): string => {
        const llmConfig = store.AIconfig.llm
        
        switch(type) {
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

    // 改变模型服务类型
    function changeLLMServe() {
        console.log('模型服务已更新:', chatConfig.value.llmType)
        // 清空当前选择的模型
        chatConfig.value.model = ''
    }

    // 选择模型
    const selectModel = (modelName: string) => {
        chatConfig.value.model = modelName;
    };

    // 刷新可用模型列表
    const refreshModels = async () => {
        try {
            // 临时保存原始配置
            const originalType = store.AIconfig.llm.type
            const originalModel = getCurrentModelFromStore(originalType)
            
            // 临时切换到当前聊天的配置来刷新
            store.AIconfig.llm.type = chatConfig.value.llmType
            updateStoreModelConfig(chatConfig.value)
            
            await store.getAIconfig();
            
            // 恢复原始配置
            store.AIconfig.llm.type = originalType
            restoreStoreModelConfig(originalType, originalModel)
            
            // 如果可用模型列表有数据，默认选择第一个
            if (availableModels.value.length > 0) {
                const firstModel = availableModels.value[0];
                if (!chatConfig.value.model || !availableModels.value.includes(chatConfig.value.model)) {
                    selectModel(firstModel);
                }
            }
        } catch (error) {
            console.error('刷新模型列表失败:', error);
        }
    };

    //渲染库设置
    const md = new MarkdownIt({
        html: true,
        linkify: true,
        highlight: function (str:any, lang:any) {
        if (lang && hljs.getLanguage(lang)) {
            try {
            return '<pre class="hljs"><code>' +
                hljs.highlight(str,{language: lang, ignoreIllegals: true }).value +
                '</code></pre>';
            } catch (__) {}
        }
        return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
        },
    }) as any
    const RenderMarkdown= function(str:string) {
        return md.render(str)
    }
    
    //清空历史
    const trash = function(){
        history.value=[];
        nextTick();
    }
    //监听回车键
    let textarea = ref(null)
    const enter = async function(e:any) {
        if (e.keyCode == "13"&&document.activeElement === textarea.value) {
            e.preventDefault()
            chat()
        }
    }
    
    //开始聊天（使用配置隔离）
    const chat=async function(){
        let isFirstChunk = true  // 在 chat 函数开始处定义
        prompt.value = input.value
        if(prompt.value=='') return
        
        // 检查是否选择了模型
        if (!chatConfig.value.model && chatConfig.value.llmType !== 'anthropic') {
            alert(store.locales === 'zh' ? '请先选择一个模型！' : 'Please select a model first!')
            return
        }
        
        // 保存原始配置
        const originalType = store.AIconfig.llm.type
        const originalModel = getCurrentModelFromStore(originalType)
        const originalTemperature = store.AIconfig.llm.temperature
        const originalMaxTokens = store.AIconfig.llm.max_tokens
        const originalStream = store.AIconfig.llm.stream
        
        // 临时切换到当前聊天的配置
        store.AIconfig.llm.type = chatConfig.value.llmType
        updateStoreModelConfig(chatConfig.value)
        
        // 检查模型连接
        if (!store.AIconfig.llm.online) {
            try {
                await store.getAIconfig()
                if (!store.AIconfig.llm.online) {
                    alert(store.locales === 'zh' ? '模型连接失败，请检查配置！' : 'Model connection failed, please check configuration!')
                    
                    // 恢复原始配置
                    store.AIconfig.llm.type = originalType
                    restoreStoreModelConfig(originalType, originalModel)
                    store.AIconfig.llm.temperature = originalTemperature
                    store.AIconfig.llm.max_tokens = originalMaxTokens
                    store.AIconfig.llm.stream = originalStream
                    return
                }
            } catch (error) {
                console.error('模型连接检查失败:', error)
                alert(store.locales === 'zh' ? '模型连接检查失败！' : 'Model connection check failed!')
                
                // 恢复原始配置
                store.AIconfig.llm.type = originalType
                restoreStoreModelConfig(originalType, originalModel)
                store.AIconfig.llm.temperature = originalTemperature
                store.AIconfig.llm.max_tokens = originalMaxTokens
                store.AIconfig.llm.stream = originalStream
                return
            }
        }
        
        //普通聊天模式
        history.value.push({
            role:'user',
            content:prompt.value,
            prep:prompt.value,
        })
        input.value=""
        prompt.value=""
        const messagesForAPI = [...history.value]
        history.value.push({
            role:'assistant',
            content:store.locales === 'zh' ? '正在思考...' : 'Thinking...',
            prep:store.locales === 'zh' ? '正在思考...' : 'Thinking...',
            weblink:JSON.parse(JSON.stringify(weblink.value)),
            model: chatConfig.value.model, // 添加当前聊天的模型信息
            modelType: chatConfig.value.llmType // 添加模型类型信息
        })
        
        nextTick()
        var element = document.getElementById("AI_messages")! //滑动聊天
        element.scrollTop = element.scrollHeight
        
        try {
            // 使用统一的AI接口发送消息（此时store已经切换到当前聊天的配置）
            await store.sendToAI(
                messagesForAPI,
                {
                    onStream: (chunk: string) => {
                        const lastMessage = history.value[history.value.length-1]
                        
                        if (isFirstChunk) {
                            lastMessage.content = chunk  // 直接赋值为第一个 chunk，而不是追加
                            isFirstChunk = false
                        } else {
                            lastMessage.content += chunk  // 后续的 chunk 追加
                        }
                        
                        lastMessage.prep = RenderMarkdown(lastMessage.content)
                        element.scrollTop = element.scrollHeight
                    },
                    onComplete: (fullContent: string) => {
                        history.value[history.value.length-1].content = fullContent
                        history.value[history.value.length-1].prep = RenderMarkdown(fullContent)
                        if (chatConfig.value.ifSpeak) store.tts(fullContent)
                    },
                    onError: (error: Error) => {
                        history.value[history.value.length-1].content = "抱歉，请求失败，请重试"
                        history.value[history.value.length-1].prep = "抱歉，请求失败，请重试"
                        console.error("Chat error:", error)
                    }
                }
            )
            
            // 清空功能索引
            funcIndex.value=0
        } catch (error) {
            history.value[history.value.length-1].content = "抱歉，请求失败，请重试"
            history.value[history.value.length-1].prep = "抱歉，请求失败，请重试"
            console.error("Chat error:", error)
        } finally {
            // 恢复原始配置
            store.AIconfig.llm.type = originalType
            restoreStoreModelConfig(originalType, originalModel)
            store.AIconfig.llm.temperature = originalTemperature
            store.AIconfig.llm.max_tokens = originalMaxTokens
            store.AIconfig.llm.stream = originalStream
        }
    }
    
    // 停止生成
    const stop=async function(){
        if (history.value.length > 0 && history.value[history.value.length-1].content === '正在思考...') {
            history.value[history.value.length-1].content = '已停止'
            history.value[history.value.length-1].prep = '已停止'
        }
    }
    
    // 监听模型类型变化
    watch(() => chatConfig.value.llmType, async (newType: string) => {
        // 模型类型改变时，清空当前选择的模型
        chatConfig.value.model = '';
        
        // 如果是已连接的模型类型，尝试刷新模型列表
        // 注意：这里不直接修改store，只刷新列表
        await refreshModels();
    }, { immediate: true });

    // 监听可用模型列表变化
    watch(availableModels, (newModels: any[]) => {
        // 当模型列表更新时，如果当前选择的模型不在列表中，则选择第一个
        if (newModels.length > 0) {
            if (!chatConfig.value.model || !newModels.includes(chatConfig.value.model)) {
                const firstModel = newModels[0];
                selectModel(firstModel);
            }
        } else {
            chatConfig.value.model = '';
        }
    }, { immediate: true });
    
    // 初始化
    onMounted(async ()=>{
        if (localStorage.getItem('history')!= null) {
            history.value=JSON.parse(localStorage.getItem("history")!)
        }else{
            history.value=[]
        }
        
        // 加载保存的配置
        if (localStorage.getItem('chatConfig')!= null) {
            const savedConfig = JSON.parse(localStorage.getItem("chatConfig")!)
            chatConfig.value = {
                ...chatConfig.value,
                ...savedConfig
            }
        }
        
        window.addEventListener('keydown', enter)
        
        // 检查初始连接状态
        if (store.AIconfig.llm.type && !store.AIconfig.llm.online) {
            await store.getAIconfig()
        }
        
        // 如果已连接，刷新模型列表
        if (store.AIconfig.llm.online) {
            await refreshModels();
        }
    })
    
    // 关闭该模块时
    onBeforeUnmount(() => {
        window.removeEventListener('keydown', enter)
        localStorage.setItem("history",JSON.stringify(history.value))
        localStorage.setItem("chatConfig",JSON.stringify({
            llmType: chatConfig.value.llmType,
            model: chatConfig.value.model,
            temperature: chatConfig.value.temperature,
            maxTokens: chatConfig.value.maxTokens,
            stream: chatConfig.value.stream,
            think: chatConfig.value.think,
            ifSpeak: chatConfig.value.ifSpeak
        }))
    })
</script>
    
<template>
    <div class="bg">
        <div class="header">
            <!-- 模型类型选择 - 绑定到本地配置 -->
            <select v-model="chatConfig.llmType" 
                    style="flex:1;margin: 5px 0px 5px 5px;flex:1" 
                    :class="{active:store.AIconfig.llm.online, offline:!store.AIconfig.llm.online}"
                    @change="changeLLMServe()">
                <option v-for="(option, index) in store.AIconfig.llm.types" :key="index" :value="option">
                    {{ option.charAt(0).toUpperCase() + option.slice(1) }}
                </option>
            </select>
            
            <!-- 模型选择下拉框 - 绑定到本地配置 -->
            <select v-model="chatConfig.model" 
                    style="flex:1;margin: 5px 0px 5px 5px;flex:1"
                    :class="{active:store.AIconfig.llm.online, offline:!store.AIconfig.llm.online}"
                    :disabled="!isModelsAvailable"
                    @change="selectModel(chatConfig.model)"
                    @click="refreshModels">
                <option value="" disabled>
                    {{ store.locales=='zh' ? '选择模型...' : 'Select model...' }}
                </option>
                <option v-for="(model, index) in availableModels" :key="index" :value="model">
                    {{ model }}
                </option>
            </select>
            
            <!-- 深度思考选项 - 绑定到本地配置 -->
            <input type="checkbox" 
                   style="width:20px;height:20px;margin: 5px 0px 5px 5px;" 
                   v-model="chatConfig.think"  
                   :title="store.locales=='zh'?'深度思考':'Thinking'"
                   v-if="chatConfig.llmType === 'ollama'"/>
            
            <!-- 连接状态指示器 -->
            <div :title="store.AIconfig.llm.online ? 
                (store.locales=='zh' ? '已连接' : 'Connected') : 
                (store.locales=='zh' ? '未连接' : 'Disconnected')" 
                 style="margin: 5px;width:12px;height:12px;border-radius: 6px;"
                 :style="{backgroundColor: store.AIconfig.llm.online ? '#2ecc71' : '#e74c3c'}">
            </div>
            
            <!-- 清空聊天历史 -->
            <div title="删除聊天历史" @click="trash()" style="margin-right: 8px;"> 
                <i class="fa fa-trash"></i>
            </div>
        </div>
        
        <!-- 聊天消息区域 -->
        <div class="message scoll" id="AI_messages">
            <div v-for="(item,index) in history" 
                 class="item" 
                 :class="{me_message:item.role=='user', ai_message:item.role=='assistant'}">
                <!-- 模型信息显示（仅助手消息）- 显示本地配置的模型信息 -->
                <div v-if="item.role === 'assistant'" 
                     style="font-size: 10px; color: var(--fontActiveColor); margin-bottom: 2px; display: flex; gap: 5px;">
                    <span>{{ item.modelType || chatConfig.llmType }}: {{ item.model || chatConfig.model }}</span>
                </div>
                <block_md :content="item.prep || item.content"/>
                <div class="set">
                    <a :title="link.description+link.link" 
                       :href="link.link" 
                       target="_blank" 
                       v-for="(link,i) in item.weblink">
                        {{ link.title }}
                    </a>
                    <i class="fa fa-times" @click="history.splice(index,1)"></i>
                </div>
            </div>
        </div>
        
        <!-- 输入区域 -->
        <div class="input-container">
            <textarea ref="textarea" 
                      class="scoll" 
                      v-model="input" 
                      :placeholder="prompt"
                      :disabled="!store.AIconfig.llm.online || (!chatConfig.model && chatConfig.llmType !== 'anthropic')">
            </textarea>
        </div>
        
        <!-- 底部工具栏 -->
        <div class="footer">            
            <!-- 发送按钮 -->
            <div class="button" @click="chat()" 
                 :class="{disabled: !store.AIconfig.llm.online || (!chatConfig.model && chatConfig.llmType !== 'anthropic')}">
                <i class="fa fa-send"></i>
            </div>
            
            <!-- 停止按钮 -->
            <div class="button" @click="stop()">
                <i class="fa fa-stop"></i>
            </div>
        </div>
    </div>
</template>
    
<style scoped>
    .bg{
        position: relative;
        height: 100%;
        display: flex;
        flex-direction: column;
    }
    .header{
        width: calc(100%);
        border-bottom: var(--borderColor) 1px solid;
        display: flex;
        align-items: center;
        flex-shrink: 0; /* 禁止收缩 */
        height: 40px; /* 固定高度 */
        padding: 0 4px;
    }
    .message{
        padding: 5px;
        flex-direction: column;
        flex: 1; /* 可伸缩 */
        min-height: 0; /* 关键：允许压缩 */
        overflow-y: auto;
        background-color: var(--backgroundColor);
    }
    .input-container{
        height: 100px; /* 固定高度 */
        display: flex;
        padding: 5px 5px 0px 5px;
        border-top: 1px solid var(--borderColor);
    }
    .footer{
        display: flex;
        padding: 0px 5px ;
        align-items: center;
        gap: 5px;
        height:40px
    }

    .header select.active {
        background-color: var(--menuColor) !important;
        border-color: #2ecc71;
    }
    .header select.offline {
        border-color: #e74c3c;
    }
    
    .message .item{
        margin-bottom:3px
    }
    .message .item .set{
        font-size: 10px;
        text-align: right;
        height:0px;
        overflow: hidden;
        transition: 0.5s;
        border-top:0px solid var(--borderColor) ;
    }
    .set a{
        display: inline-block; /* 或者 block，取决于具体需求 */
        width: 60px; /* 设置固定宽度 */
        white-space: nowrap; /* 确保文本在一行内显示 */
        overflow: hidden; /* 隐藏超出部分 */
        text-overflow: ellipsis; /* 超出部分显示省略号 */
        border:1px solid var(--borderColor);
        margin-right:5px;
        padding:2px;
        color:var(--fontColor);
        font-size:8px;
    }
    .message .item:hover .set{
        height:fit-content;
        z-index: 999;
        margin-top: 3px;
        padding-top: 3px;
        padding-right: 5px;
        border-top:1px solid var(--borderColor) ;
        color:var(--fontColor);
    }
    .ai_message{
        border: 1px solid var(--borderColor);
        width:fit-content;
        max-width:calc(100% - 20px);
        border-radius: 3px;
        padding: 5px;
    }
    .me_message{
        border: 1px solid var(--borderColor);
        color:var(--fontActiveColor);
        border-radius: 3px;
        width:fit-content;
        max-width:calc(100% - 20px);
        margin-left: auto;
        padding: 5px;
    }
    
    .button{
        cursor: pointer;
        border: 1px solid var(--borderColor);
        border-radius: 5px;
        text-align: center;
        padding: 3px;
        width:30px;
        background-color: var(--backgroundColor);
        margin:0px;
        transition: all 0.2s;
    }
    .button:hover{
        background-color: var(--menuActiveColor);
        transform: scale(1.05);
    }
    .button.disabled {
        cursor: not-allowed;
        opacity: 0.5;
        background-color: var(--borderColor);
    }
    .button.disabled:hover {
        background-color: var(--borderColor);
        transform: none;
    }
    textarea{
        padding: 5px;
        border: 1px solid var(--borderColor);
        border-radius: 3px;
        color: var(--fontColor);
        resize: none;
        font-family: inherit;
        height:calc(100% - 10px);
        width: 100%;
    }
    textarea:focus{
        outline: none;
        border-color: var(--fontActiveColor);
    }
    textarea:disabled {
        background-color: var(--menuColor);
        cursor: not-allowed;
    }
</style>