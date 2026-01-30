<script setup lang="ts">
    import {onMounted,onBeforeUnmount,ref, nextTick,computed,watch} from 'vue'
    import MarkdownIt from 'markdown-it'
    import hljs from 'highlight.js'
    import 'highlight.js/styles/github-dark.css'
    import block_md from '../block_md.vue'
    import {usestore} from '../../store'
    const store=usestore()
    
    let input = ref("") //输入的消息
    let history = ref([]) as any //历史聊天记录
    let config = ref({
        memoryType:'无', //记忆类型
        memory:'' as string, //记忆文本
        memoryList:[] as any, //{name:'',path:'',content:''}名称、地址、内容
        image:null as any,
        ifSpeak:false, //自动朗读
        think:false
    })

    // 改变模型服务地址
    function changeLLMServe() {
        // 在新的store结构中，不需要手动创建实例，直接使用store的方法
        console.log('模型服务已更新:', store.AIconfig.llm.type)
    }

    let weblink = ref([]) as any//互联网资料 
    let funcIndex = ref(0) //功能序数
    let prompt = ref("") //提示词

    let strlimit = ref(4000) //知识库字数限制
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
        nextTick()
    }
    //监听回车键
    let textarea = ref(null)
    const enter = async function(e:any) {
        if (e.keyCode == "13"&&document.activeElement === textarea.value) {
            e.preventDefault()
            chat()
        }
    }
    //更新提示词
    let updatePrompt = ()=>{
        //合成后的提示词：角色、场景、指令、参考资料、具体需求
        let str = (store.AIconfig.functions[funcIndex.value].prompt!='') ? store.AIconfig.functions[funcIndex.value].prompt + '。' : ''
        prompt.value = str+input.value+config.value.memory
    }
    //上传知识库文件
    const handleFileDrop = async function(event:any){
        event.preventDefault();
        const files = event.dataTransfer.files
        for (const file of files) {
            // 执行上传操作，例如通过API发送文件给服务器
            const fileExtension = file.name.split('.').pop().toLowerCase();
            if (fileExtension === 'docx' || fileExtension === 'pdf' || fileExtension === 'md') {
                let content = await window.ipcRenderer.invoke('readFile', file.path)
                config.value.memoryList.push(
                    {
                        name:file.name,
                        path:file.path,
                        content:content,
                    }
                )
            }       
        }
        updatePrompt()
    }
    //上传图片
    const handleImageDrop = async function(event:any){
        event.preventDefault();
        const files = event.dataTransfer.files
        for (const file of files) {
            // 执行上传操作，例如通过API发送文件给服务器
            const fileExtension = file.name.split('.').pop().toLowerCase();
            if (fileExtension === 'jpg'||fileExtension === 'png'||fileExtension === 'webp') {
                config.value.image=file
            }       
        }
        const reader = new FileReader();
        reader.onloadend = function() {
            if (typeof reader.result === 'string') {
                const base64String = reader.result.split(',')[1];
                config.value.image.base64=base64String
            } else {
                console.log('error')
            }
        }
        reader.readAsDataURL(config.value.image);
    }
    //删除记忆
    const delMemory = function(index: number | string){
        const numericIndex = typeof index === 'string' ? Number(index) : index;
        
        if(confirm("取消该资料关联吗？")){
            config.value.memoryList.splice(numericIndex,1)
            updatePrompt()
        }
    }
    //开始聊天
    const chat=async function(){
        //判断是否关联知识库
        if(config.value.memoryType=='本地'){
            config.value.memory=''
            config.value.memory='参考资料如下：'
            for (const item of config.value.memoryList) {
                config.value.memory=config.value.memory+item.content+"。"
            }
        }else{
            config.value.memory=''
        }
        updatePrompt()
        if(prompt.value=='') return
        
        //检查模型连接
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
        
        //界面更新
        if(config.value.memoryType=='多模态'){ 
            // 注意：多模态功能需要根据具体模型支持进行调整
            // 由于不同API对多模态的支持不同，这里先简化处理
            history.value.push({
                role:'user',
                content:prompt.value,
                prep:prompt.value,
                image:config.value.image?.path,
            })
            history.value.push({role:'assistant',content:'正在思考...',prep:'正在思考...'})
            
            nextTick()
            var element = document.getElementById("AI_messages")! //滑动聊天
            element.scrollTop = element.scrollHeight
            
            try {
                // 构建消息
                const messages = [
                    {
                        role: 'user',
                        content: prompt.value,
                        // 注意：不同API的多模态格式不同，这里需要根据实际API调整
                    }
                ]
                
                // 使用统一的AI接口发送消息
                await store.sendToAI(
                    messages,
                    store.AIconfig.functions[funcIndex.value],
                    {
                        onStream: (chunk: string) => {
                            history.value[history.value.length-1].content += chunk
                            history.value[history.value.length-1].prep = RenderMarkdown(history.value[history.value.length-1].content)
                            element.scrollTop = element.scrollHeight
                        },
                        onComplete: (fullContent: string) => {
                            history.value[history.value.length-1].content = fullContent
                            history.value[history.value.length-1].prep = RenderMarkdown(fullContent)
                            if (config.value.ifSpeak) store.tts(fullContent)
                        },
                        onError: (error: Error) => {
                            history.value[history.value.length-1].content = "抱歉，请求失败，请重试"
                            history.value[history.value.length-1].prep = "抱歉，请求失败，请重试"
                            console.error("Chat error:", error)
                        }
                    }
                )
            } catch (error) {
                history.value[history.value.length-1].content = "抱歉，多模态功能暂不支持当前模型"
                history.value[history.value.length-1].prep = "抱歉，多模态功能暂不支持当前模型"
                console.error("Multimodal chat error:", error)
            }
        } else {
            //普通聊天模式
            history.value.push({
                role:'user',
                content:prompt.value,
                prep:prompt.value,
            })
            input.value=""
            prompt.value=""
            const messagesForAPI = [...history.value]
            history.value.push({role:'assistant',content:'正在思考...',prep:'正在思考...',weblink:JSON.parse(JSON.stringify(weblink.value))})
            
            nextTick()
            var element = document.getElementById("AI_messages")! //滑动聊天
            element.scrollTop = element.scrollHeight
            
            try {
                // 使用统一的AI接口发送消息
                await store.sendToAI(
                    messagesForAPI,
                    store.AIconfig.functions[funcIndex.value],
                    {
                        onStream: (chunk: string) => {
                            history.value[history.value.length-1].content += chunk
                            history.value[history.value.length-1].prep = RenderMarkdown(history.value[history.value.length-1].content)
                            element.scrollTop = element.scrollHeight
                        },
                        onComplete: (fullContent: string) => {
                            history.value[history.value.length-1].content = fullContent
                            history.value[history.value.length-1].prep = RenderMarkdown(fullContent)
                            if (config.value.ifSpeak) store.tts(fullContent)
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
            }
        }
    }
    
    // 停止生成 - 这个功能需要根据具体API支持来实现
    const stop=async function(){
        // 在新的store结构中，停止功能需要根据具体实现
        // 目前我们可以清空当前正在生成的响应
        if (history.value.length > 0 && history.value[history.value.length-1].content === '正在思考...') {
            history.value[history.value.length-1].content = '已停止'
            history.value[history.value.length-1].prep = '已停止'
        }
    }
    
    const recording = ref<boolean>(false);
    
    // 检查模型是否支持多模态
    const isMultimodalSupported = computed(() => {
        const llm = store.AIconfig.llm
        // 简单判断：某些模型可能支持多模态
        // 这里可以根据实际情况调整
        return llm.type === 'ollama' || llm.type === 'openai' || llm.type === 'azure'
    })
    
    // 监听模型类型变化
    watch(() => store.AIconfig.llm.type, (newType:string) => {
        // 如果选择了多模态但当前模型不支持，切换到无
        if (config.value.memoryType === '多模态' && !isMultimodalSupported.value) {
            config.value.memoryType = '无'
            alert(store.locales === 'zh' ? '当前模型不支持多模态功能' : 'Current model does not support multimodal')
        }
    })
    
    //初始化
    onMounted(()=>{
        if (localStorage.getItem('history')!= null) {
            history.value=JSON.parse(localStorage.getItem("history")!)
        }else{
            history.value=[]
        }
        if (localStorage.getItem('config')!= null) {
            config.value=JSON.parse(localStorage.getItem("config")!)
        }
        window.addEventListener('keydown', enter)
        
        // 检查初始连接状态
        if (store.AIconfig.llm.type && !store.AIconfig.llm.online) {
            store.getAIconfig()
        }
    })
    //关闭该模块时
    onBeforeUnmount(() => {
        window.removeEventListener('keydown', enter)
        localStorage.setItem("history",JSON.stringify(history.value))
        localStorage.setItem("config",JSON.stringify(config.value))
    })
</script>
    
<template>
    <div class="bg">
        <div class="header">
            <select v-model="store.AIconfig.llm.type" style="flex:1;margin: 5px 0px 5px 5px;flex:1" 
                    :class="{active:store.AIconfig.llm.online, offline:!store.AIconfig.llm.online}"
                    @change="changeLLMServe(); store.getAIconfig()">
                <option v-for="(option, index) in store.AIconfig.llm.types" :key="index" :value="option">
                    {{ option.charAt(0).toUpperCase() + option.slice(1) }}
                </option>
            </select>
            <input type="checkbox" style="width:30px;height:30px;margin: 5px 0px 5px 5px;" 
                   v-model="config.think"  
                   :title="store.locales=='zh'?'深度思考':'Thinking'"
                   v-if="store.AIconfig.llm.type === 'ollama'"/>
            <div :title="store.AIconfig.llm.online ? (store.locales=='zh'?'已连接':'Connected') : (store.locales=='zh'?'未连接':'Disconnected')" 
                 style="margin: 5px;width:12px;height:12px;border-radius: 6px;"
                 :style="{backgroundColor: store.AIconfig.llm.online ? '#2ecc71' : '#e74c3c'}">
            </div>
            <div title="删除聊天历史" @click="trash()" style="margin-right: 8px;"> 
                <i class="fa fa-trash"></i>
            </div>
        </div>
        <div class="message scoll" id="AI_messages">
            <div v-for="(item,index) in history" class="item" :class="{me_message:item.role=='user', ai_message:item.role=='assistant'}">
                <block_md :content="item.prep || item.content"/>
                <img v-if="item.image!=undefined" :src="item.image"  style="width: 100%;height: 60px;object-fit: cover;"/>
                <div class="set">
                    <a :title="link.description+link.link" :href="link.link" target="_blank" v-for="(link,i) in item.weblink">{{link.title}}</a>
                    <i class="fa fa-times" @click="history.splice(index,1)"></i>
                </div>
            </div>
        </div>
        <div class="input-container">
            <div class="scoll" style="height:100%;width:100px;font-size: 10px;overflow-y: auto;" v-if="config.memoryType=='本地'&&config.memoryList.length>0">
                <div v-for="(item,index) in config.memoryList" style="margin: 0px 5px;white-space: nowrap;max-width: 100px;overflow: hidden;text-overflow: ellipsis;cursor: pointer;" @click="delMemory(index)">
                    <i class="fa fa-file-text-o"></i> {{item.name}}/{{ item.content.length+'字' }}
                </div>
            </div>
            <div class="scoll" style="width:100px;max-height: 60px;overflow: hidden;border: 1px solid var(--borderColor);" 
                 v-if="config.memoryType=='多模态'&&config.image!=null" 
                 @dragover.prevent @drop="handleImageDrop">
                <img style="width: 100%;height: 100%;object-fit: cover;" :src="config.image.path">
            </div>
            <textarea ref="textarea" class="scoll" v-model="input" :placeholder="prompt"></textarea>
        </div>
        <div class="footer">
            <div v-if="config.memoryType=='本地'" @dragover.prevent @drop="handleFileDrop" 
                 title="拖动到此处，上传文件进行对话">
                <i class="fa fa-file-text-o"></i>
            </div>
            <div v-if="config.memoryType=='多模态' && isMultimodalSupported" 
                 @dragover.prevent @drop="handleImageDrop" 
                 title="拖动到此处，上传图片进行对话">
                <i class="fa fa-file-image-o"></i>
            </div>
            <select v-model="config.memoryType" :disabled="config.memoryType === '多模态' && !isMultimodalSupported">
                <option value="无">无</option>
                <option value="本地">本地</option>
                <option value="多模态" :disabled="!isMultimodalSupported">
                    多模态{{ !isMultimodalSupported ? ' (不支持)' : '' }}
                </option>
            </select>
            <select v-model="funcIndex" @change="updatePrompt">
                <option v-for="(option, index) in store.AIconfig.functions" :key="index" :value="index">{{ option.title }}</option>
            </select>
            <div class="button" @click="chat()" >
                <i class="fa fa-send"></i>
            </div>
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
    }
    .me_message{
        border: 1px solid var(--borderColor);
        color:var(--fontActiveColor);
        border-radius: 3px;
        width:fit-content;
        max-width:calc(100% - 20px);
        margin-left: auto;
    }
    
    .footer select{
        flex:2;
        margin:4px 0px;
        border-radius: 5px;
        background-color: var(--backgroundColor);
        color: var(--fontColor);
        border: 1px solid var(--borderColor);
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
    }
    .button:hover{
        background-color: var(--menuActiveColor);
    }
    textarea{
        padding: 5px;
        border: 1px solid var(--borderColor);
        border-radius: 3px;
        color: var(--fontColor);
        resize: none;
        font-family: inherit;
        height:80px;
    }
    textarea:focus{
        outline: none;
        border-color: var(--fontActiveColor);
    }
</style>