<script setup lang="ts">
    import {onMounted,onBeforeUnmount,ref, nextTick,computed} from 'vue'
    import {Ollama} from 'ollama/dist/browser.mjs'
    import block_md from './block_md.vue'
    import {usestore} from '../store'

    const store=usestore()
    let files = ref([]) as any //知识库文件信息
    let blocks = ref([]) as any //知识库片段信息
    let panel = ref("管理") //显示模式，“管理”时显示知识库，“混合”时显示两个，“聊天”时只显示聊天
    let prompt = ref("") //默认问题
    let result = ref("未推理") //推理结果
    let kb_state = ref("") //支持库处理状态
    let ollama=null as any //服务
    let model = ref({
        url:"http://127.0.0.1:11434", //模型地址
        list:[] as any,
        embed:"nomic-embed-text:latest", //嵌入模型
        process:"qwen2.5:latest", //知识库处理模型
        chat:"qwen2.5:latest" //聊天模型
    })

    //改变Ollama服务地址
    function changeOllamaServe() {
        ollama = new Ollama({host: model.value.url})
    }
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
    //选择知识库所在的文件夹
    const openFolder = async function() {
        store.root = await window.ipcRenderer.invoke('openFolderDialog')
        load()
    }
    
    // 知识切片和向量化
    const process = async function() {
    try {
        ollama = new Ollama({ host: model.value.url });
        // 获取文件信息
        let { fileList, relationList } = await window.ipcRenderer.invoke("getFilesRelation", store.root, 3);
        
        files.value = fileList
            .filter((obj: any) => !obj.path.toLowerCase().endsWith('.kb'))
            .map((obj: any, index: number) => {
                return { ...obj };
            });
        
        kb_state.value = "读取到" + files.value.length + "个文件。正在处理...";
        blocks.value = [];
        
        // 读取每个文件的数据
        for (let i = 0; i < files.value.length; i++) {
            try {
                let result = await window.ipcRenderer.invoke('readFile', files.value[i].path);
                if (result != undefined) {
                    files.value[i].content = result;
                    // 按两行切分
                    let block = files.value[i].content.split('\r\n\r\n\r\n');
                    kb_state.value = "读取到" + files.value.length + "个文件，正在切分第" + (i + 1) + "个文件并向量化。";
                    
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

                        block.forEach((string: string, index: number) => {
                            blocks.value.push({
                                label: files.value[i].label.split('.').shift(), // 记录文件名
                                path: files.value[i].path, // 记录文件路径
                                extension: files.value[i].extension, // 记录文件扩展名
                                A: string, // 文本段落
                                A_vector: response.embeddings[index],
                                Q: '问题未推理', // 文本对应的问题
                                Q_vector: [],
                                p: 0, // 文本的匹配度
                                state: false, // 段落的处理状态
                                show: 'A',
                            });
                        });
                    } catch (embedError) {
                        console.error("向量化处理失败:", embedError);
                        kb_state.value = `文件 ${files.value[i].label} 向量化失败`;
                        continue; // 跳过当前文件，继续处理下一个
                    }
                }
            } catch (fileError) {
                console.error("文件读取失败:", fileError);
                kb_state.value = `文件 ${files.value[i].label} 读取失败`;
                continue; // 跳过当前文件，继续处理下一个
            }
        }
        kb_state.value = "";
    } catch (globalError) {
        console.error("处理过程中发生全局错误:", globalError);
        kb_state.value = `处理失败`;
    }
};
    // 推理切片问题
    const getQuestion = async function(){
        for(let i = 0; i < blocks.value.length; i++){
            if(blocks.value[i].state) continue
            let history = []
            //更新对话提示
            history.push({role:'user',content:'请根据如下资料，提出这些资料能够解答的若干个问题。资料如下：'+blocks.value[i].A+'。仅返回问题，不要返回其他表述。'})
            //发送到ollama服务
            ollama = new Ollama({host:  model.value.url})
            const response = await ollama.chat({ model: model.value.process, messages: history, stream: true })
            blocks.value[i].Q = ""
            //流式输出
            for await (const part of response) {
                blocks.value[i].Q=blocks.value[i].Q+part.message.content
            }
            blocks.value[i].state=true
        }
    }
    //开始聊天
    const chat=async function(propmt:string){
        result.value="正在思考..."
        // 计算问题的向量
        const queryResponse = await ollama.embed({
            model: model.value.embed,
            input: propmt,
            truncate: true,
            keep_alive: "1h",
        });
        // 调试：打印响应结构和向量维度
        const queryEmbedding = queryResponse.embeddings?.[0];

        // 从资料库中读取段落，并计算问题和知识库对应向量的相似度
        
        for(let i = 0; i < blocks.value.length; i++){
            // 计算原文和提问的相似度
            blocks.value[i].p=cosineSimilarity(queryEmbedding, blocks.value[i].A_vector)
            console.log(queryEmbedding,blocks.value[i].A_vector,blocks.value[i].p)
            // 计算生成的问题和提问的相似度
            if(blocks.value[i].Q_vector.length>0){
                blocks.value[i].p=(blocks.value[i].p+cosineSimilarity(queryEmbedding, blocks.value[i].Q_vector))/2
            }
        }
        blocks.value.sort((a:any, b:any) =>  b.p - a.p);
        let history = []
        let content = propmt+'。请根据参考资料解决以上问题，如果不相关可以忽略后续资料。'
        for (let i = 0; i < 5; i++) {
            content += "《" + blocks.value[i].label + "》："
            content += blocks.value[i].A + "。";
        }
        result.value="正在思考，查询到5个资料。"
        //更新对话提示
        history.push({role:'user',content:content})
        //发送到ollama服务
        ollama = new Ollama({host: model.value.url})
        const response = await ollama.chat({ model: model.value.chat, messages: history, stream: true })
        result.value = ""
        //流式输出
        for await (const part of response) {
            result.value=result.value+part.message.content
        }
        return true
    }
    
    // 计算余弦相似度
    function cosineSimilarity(vecA:number[], vecB:number[]) {
        // 确保向量长度相同
        if (vecA.length !== vecB.length) {
            throw new Error("向量维度不匹配");
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
    // 知识库加工后的片段数
    const processNum = computed(()=>{
        return blocks.value.filter((item:any) => item.state === true).length
    })
    // 保存处理后的知识库
    const save = function(){
        window.ipcRenderer.invoke('saveFile', store.root+'/'+Date.now()+'.kb', JSON.stringify(blocks.value))
            .then((success) => {
                if (success) {
                    console.log('文件保存成功');
                } else {
                    console.log('文件保存失败');
                }
            })
            .catch((error) => {
                console.error(error);
            })
    }
    // 读取处理后的知识库,默认在打开的文件夹中的最新的kb后缀的文件
    const load = async function(){
        //获取文件信息
        if(store.root=='') return
        let { fileList, relationList } = await window.ipcRenderer.invoke("getFilesRelation", store.root, 1)
        const kbs = fileList.filter((file:any)=>file.path.endsWith('.kb'))
        const numericFiles = kbs.filter((file:any) => {
            // 获取文件名（假设文件路径类似 '/path/to/file/file123.kb'）
            let fileName = file.label.split('/').pop(); // 获取文件名部分
            fileName = fileName.split('.').slice(0, -1).join('.') // 去除后缀名
            // 使用 isNaN() 判断文件名是否全为数字
            return !isNaN(fileName)
        })
        if(numericFiles.length>0){
            let content = await window.ipcRenderer.invoke('readFile', numericFiles[0].path)
            blocks.value=JSON.parse(content)
        }
    }
    const init= async function() {
        load()
        getModel()
    }
    //初始化
    onMounted(()=>{
        init()
    })
    //关闭该模块时
    onBeforeUnmount(() => {
    })
</script>
    
<template>
    <div class="main">
        <div v-if="panel=='聊天'||panel=='混合'" style="min-width:300px;flex:1;border-right: 1px var(--borderColor) solid;-webkit-app-region: drag;">
            <div style="display: flex;width:calc(100% - 5px);padding-right: 5px;">
                <select v-model="model.chat" style="flex:1;height:32px;margin: 5px 0px 5px 5px;-webkit-app-region: no-drag;" @click="getModel()">
                    <option v-for="(option, index) in model.list" :key="index" :value="option.name">{{ option.name }} ({{ (option.size/1024/1024/1024).toFixed(2)+'GB' }})</option>
                </select>
                <input style="flex:2;margin-right: 0px;-webkit-app-region: no-drag;" phace v-model="prompt" placeholder="请输入问题"/>
                <div class="button" @click="chat(prompt)"><i class="fa fa-send"></i> </div>
                <div class="button" title="打开对话界面" @click="panel=='混合'?panel='聊天':panel='混合'" :class="{active:panel=='混合'}">
                    <i class="fa fa-stack-overflow" ></i>
                </div>
            </div>
            <div class="scoll" style="height:calc(100% - 50px);overflow-y: auto;border: 1px solid var(--borderColor);margin: 0px 5px;border-radius: 5px;">
                <block_md :content="result" :fontSize="'12px'"/>
            </div>
        </div>
        <div class="panel scoll" v-if="panel=='管理'||panel=='混合'">
            <div style="display: flex;flex-direction:column;width:calc(100%);border-bottom: 1px solid var(--borderColor);background-color: var(--menuColor);-webkit-app-region: drag;">
                <div style="display: flex;flex-direction:row">
                    <div class="button" title="打开对话界面" @click="panel=='管理'?panel='混合':panel='管理'" :class="{active:panel=='混合'}">
                        <i class="fa fa-comment-o" ></i>
                    </div>
                    <div class="button" @click="openFolder" title="打开文件夹"><i class="fa fa-folder-open"></i> </div>
                    <input style="flex:2;margin-right: 0px;-webkit-app-region: no-drag;" placeholder="知识库位置" title="知识库位置" v-model="store.root"/>
                    <input style="flex:1;margin-right: 5px;-webkit-app-region: no-drag;" placeholder="AI服务的地址" title="AI服务的地址" v-model="model.url" @change="changeOllamaServe"/>
                </div>
                <div style="display: flex;flex-direction:row">
                    <div style="padding: 8px 2px;white-space: nowrap;overflow: hidden;text-overflow: ellipsis">
                        <i class="fa fa-file-text"></i> {{files.length}} <i class="fa fa-file-text-o"></i> {{blocks.length}} <i class="iconfont">&#xe65d;</i> {{processNum}}/{{blocks.length}}
                    </div>
                    <div style="padding: 8px 2px;white-space: nowrap;overflow: hidden;text-overflow: ellipsis">&nbsp;&nbsp;嵌入:</div>
                    <select v-model="model.embed" style="flex:1;height:32px;margin: 5px 0px 5px 5px;-webkit-app-region: no-drag;" @click="getModel()">
                        <option v-for="(option, index) in model.list" :key="index" :value="option.name">{{ option.name }} ({{ (option.size/1024/1024/1024).toFixed(2)+'GB' }})</option>
                    </select>
                    <div style="padding: 8px 2px;white-space: nowrap;overflow: hidden;text-overflow: ellipsis">&nbsp;&nbsp;提问:</div>
                    <select v-model="model.process" style="flex:2;height:32px;margin: 5px 0px 5px 5px;-webkit-app-region: no-drag;" @click="getModel()">
                        <option v-for="(option, index) in model.list" :key="index" :value="option.name">{{ option.name }} ({{ (option.size/1024/1024/1024).toFixed(2)+'GB' }})</option>
                    </select>
                    <div class="button" title="读取文件和切片" @click="process"><i class="fa fa-cut"></i></div>
                    <div class="button" title="处理问题" @click="getQuestion"><i class="fa fa-question"></i>&nbsp; </div>
                    <div class="button" title="读取知识库" @click="load"><i class="fa fa-file-text-o"></i> </div>
                    <div class="button" style="margin-right:5px;" title="保存知识库" @click="save"><i class="fa fa-floppy-o"></i> </div>
                </div>
            </div>
            <div style="height:calc(100% - 83px);display: flex;">
                <div class="scoll" style="max-width: 100%;flex:2;height:100%;overflow-y: auto;">
                    <div class="blocks scoll" @dragover.prevent >
                        <div v-for="(block, index) in blocks" :key="index" class="block scoll">
                            <div class="label">
                                <span class="ellipsis"> <i :class="store.icon(block.extension)"></i> 
                                {{block.label}}</span>
                                <span>{{(block.p*100).toFixed(2)+"%"}}</span>
                                <button @click="block.show='A'" :style="{color:block.show!='Q'?'var(--fontActiveColor)':''}" :title="block.A_vector?.length > 0 ? block.A_vector?.length + '维向量' : '向量未计算'"><i class="fa fa-file-text-o"></i> </button>
                                <button @click="block.show='Q'" :style="{color:block.show=='Q'?'var(--fontActiveColor)':''}" :title="block.Q_vector?.length > 0 ? block.Q_vector?.length + '维向量'  : '向量未计算'"><i :class="block.state?'fa fa-commenting-o':'fa fa-comment-o'"></i> </button>
                            </div>
                            <hr />
                            <block_md v-if="block.show!='Q'" :content="block.A" :fontSize="'8px'" :maxHeight="'170px'"/>
                            <textarea class="scoll" style="font-size: 8px;" v-if="block.show=='Q'" v-model="block.Q"></textarea>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div style="display:block;position:fixed;right:5px;bottom:5px;font-size: 10px;">{{kb_state}}</div>
    </div>
</template>
    
<style scoped>
    .main{
        display:flex;
        width:100%;
        height:calc(100% - 1px)
    }
    .header{
        width: calc(100%);
        display: flex;
        background-color: var(--menuColor);
    }
    .panel{
        padding: 0px;
        overflow-y:auto;
        flex:2;
        height:100%;
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
    .config{
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        border-radius: 5px;
        border: var(--borderColor) 1px solid;
        background-color: var(--backgroundColor);
        width:calc(50% + 120px);
        max-width: 90%;
        max-height: calc(100% - 100px);
        user-select: none;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }
    .body{
        padding:5px;
        flex-grow: 1;
        overflow-y: auto;
    }
    .tabs{
        display: flex;
    }
    .config button{
        flex: 1;
        margin: 2px;
        border-radius: 5px;
    }
    .config table{
        width: 100%;
        margin: 2px 0px;
    }
    .config table tr td{
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        text-align: center;
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
        max-height:calc(100% - 5px);
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
        flex-direction: column; /* 垂直方向排列 */
        justify-content: space-between; /* 元素在容器中垂直分布 */
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
        flex: 1; /* Allow this span to take up remaining space */
    }
</style>
    