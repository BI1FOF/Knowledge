<script setup lang="ts">
  import { usestore } from '../../../store'
  import { ref,watch,onMounted,onBeforeUnmount,computed } from 'vue'
  import ImageZoom from './view_image.vue' // 导入图片组件

  import MarkdownIt from 'markdown-it'
  import yaml from 'js-yaml'
  import mathjax3 from 'markdown-it-mathjax3'
  import tocAndAnchor from 'markdown-it-toc-and-anchor'
  import mark from 'markdown-it-mark'
  import hljs from 'highlight.js'
  import 'highlight.js/styles/nnfx-dark.min.css'

  //读取并解构数据
  const store=usestore()

  const props = defineProps<{
    path?: string;
    content?: string;
  }>()

  // Word文档内容缓存
  const wordContent = ref('')

  const data = computed(() => {
    const content = props.content ?? ''
    const path = props.path ?? ''
    
    let extension = ''
    if (path) {
      const lastDotIndex = path.lastIndexOf('.')
      if (lastDotIndex !== -1) {
        extension = path.slice(lastDotIndex).toLowerCase()
      }
    } else if (content) {
      // 如果没有路径但有内容，尝试从内容推断
      if (/^\s*#/.test(content)) {
        extension = '.md'
      }
    }
    
    const isMd = extension === '.md' || (extension === '' && /^\s*#/.test(content))
    const isWord = extension === '.docx' || extension === '.doc'
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'].includes(extension)
    const isVideo = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm'].includes(extension)
    const isTxt = extension === '.txt'
    
    return { 
      content, 
      path, 
      extension, 
      isMd, 
      isWord,
      isImage, 
      isVideo, 
      isTxt,
      isMedia: isImage || isVideo || isTxt
    }
  })
  
  let prep = ref("") //预览
  let iftoc=ref(false) //是否显示目录
  let toc=ref([] as any) //目录
  let metaVisible = ref(false)
  let metaForm = ref([] as any)
  let isLoadingWord = ref(false) // Word文档加载状态
  let wordError = ref('') // Word文档错误信息
  
  const md: MarkdownIt = new MarkdownIt({
    html: true,
    linkify: true,
    highlight: function (str:any, lang:any) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return '<pre class="hljs scoll"><code>' +
            hljs.highlight(str,{language: lang, ignoreIllegals: true }).value +
            '</code></pre>';
        } catch (__) {}
      }
      return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
    },
  }).use(mathjax3)
  .use(tocAndAnchor, { anchorLink:false })
  .use(mark)

  // 加载Word文档内容
  const loadWordContent = async function() {
    const cur = data.value
    if (!cur.path || !cur.isWord) return
    
    isLoadingWord.value = true
    wordError.value = ''
    
    try {
      const result = await window.ipcRenderer.invoke('readFile', cur.path)
      
      // 处理后端返回的对象格式
      let content = ''
      if (typeof result === 'object' && result !== null) {
        if (result.success === false) {
          wordError.value = result.content || result.error || '读取Word文档失败'
          content = ''
        } else {
          content = result.content || ''
        }
      } else {
        content = result || ''
      }
      
      wordContent.value = content
      
      // 如果有内容，渲染为Markdown
      if (content) {
        await RenderMarkdown(content)
      }
    } catch (err: any) {
      console.error('加载Word文档失败:', err)
      wordError.value = err.message || '加载Word文档失败'
    } finally {
      isLoadingWord.value = false
    }
  }

  //更新目录和预览
  const init=async function(){
    prep.value=''
    // 如果没有通过 props 传入数据，则不处理
    const hasProp = props.content !== undefined || props.path !== undefined
    if (!hasProp) return;
    
    const cur = data.value
    if (!cur) return;
    
    // 如果是Word文档，加载Word内容
    if (cur.isWord) {
      await loadWordContent()
      return
    }
    
    const content = cur.content ?? ''
    if (cur.isMd){
      RenderMarkdown(content)
    }
  }
  
  //渲染markdown
  const RenderMarkdown= async function(content?: string) {
    const cur = data.value
    const mdContent = content ?? (cur && cur.content) ?? ''
    if(mdContent!=''){
      // 在渲染前去除 YAML frontmatter
      const stripped = stripFrontmatter(mdContent)
      prep.value = md.render(stripped)
      //计算目录
      toc.value=Array.from(stripped.matchAll(/^(#{2,6})(\s+)(<a\s+.*><\/a>)?(.+)(\r?\n)?/gm))
      for(let i = 0;i<toc.value.length;i++){
        toc.value[i][6]=toc.value[i][4]//记录原始标题
        toc.value[i][4]=toc.value[i][4].toLocaleLowerCase() //大写转小写
        toc.value[i][4]=toc.value[i][4].replace(" ","-") //替换空格
        toc.value[i][4]=toc.value[i][4].replace("（","")
        toc.value[i][4]=toc.value[i][4].replace("）","")
        toc.value[i][4]=toc.value[i][4].replace(".","")
        toc.value[i][4]=toc.value[i][4].replace(/\u3001/g,"-") //替换、
        toc.value[i][4]=toc.value[i][4].replace(/\u3002/g,"") //删除。
        toc.value[i][4]=toc.value[i][4].replace(/\uFF1F/g,"") //删除。
      }
    }
  }
  
  // 去除文本开头的 YAML frontmatter（以 `---` 包围）以便预览时不显示元数据
  function stripFrontmatter(content: string) {
    if (!content || typeof content !== 'string') return content
    const fmRegex = /^\s*---\r?\n[\s\S]*?\r?\n---\r?\n?/
    if (fmRegex.test(content)) {
      return content.replace(fmRegex, '').replace(/^\s+/, '')
    }
    return content
  }
  
  let selectedText = ref("");
  
  //发声
  async function speak() {
    let text = "";
    const cur = data.value
    
    if (cur.isWord) {
      text = wordContent.value || '';
    } else {
      text = cur.content || '';
    }
    
    if(selectedText.value!=""){
      text = selectedText.value;
    }
    store.tts(text)
  }
  
  //获取选中的文字
  const handleSelection=function() {
    selectedText.value = window.getSelection()?.toString()||'';
  }
  
  //当点击保存后刷新本页
  async function save(e:any) {
    if (e.keyCode == 83 && (navigator.platform.match("Mac") ? e.metaKey : e.ctrlKey)){
      e.preventDefault();
      await sleep(10)
      init()
    }
  }
  
  function sleep(interval:any){
    return new Promise((resolve)=>    
      setTimeout(resolve, interval)
    )
  }
  
  let ifMenu=ref(false)

  const openMetaEditor = async function(e?: any){
    if (e && e.stopPropagation) e.stopPropagation()
    const path = data.value.path
    console.log('md_read.openMetaEditor path=', path)
    if (!path) return
    try {
      let cfg = await window.ipcRenderer.invoke('getConfig', path)
      // 如果 getConfig 未返回有效元数据，尝试从文件 frontmatter 回退解析
      if (!cfg || Object.keys(cfg).length === 0) {
        try {
          const content = await window.ipcRenderer.invoke('readFile', path)
          const fmMatch = (content || '').match(/^\s*---\r?\n([\s\S]*?)\r?\n---\r?\n?/) 
          if (fmMatch && fmMatch[1]) {
            try {
              const parsed = yaml.load(fmMatch[1])
              if (parsed && typeof parsed === 'object') cfg = parsed
            } catch (e) {
              console.warn('yaml parse failed', e)
            }
          }
        } catch (e) {
        }
      }
      
      const entries: any[] = []
      if (cfg && typeof cfg === 'object') {
        for (const [k, v] of Object.entries(cfg)) {
          let valueStr = ''
          if (v === null || v === undefined) {
            valueStr = ''
          } else if (typeof v === 'object') {
            try {
              valueStr = JSON.stringify(v)
            } catch {
              valueStr = String(v)
            }
          } else {
            valueStr = String(v)
          }
          entries.push({ key: String(k), value: valueStr })
        }
      }
      
      const idx = entries.findIndex((e2: any) => e2.key === 'summary')
      if (idx > -1) entries.unshift(entries.splice(idx, 1)[0])
      
      // 确保使用响应式方式更新
      metaForm.value = entries
      
    } catch (err) {
      metaForm.value = []
    }
    metaVisible.value = true
  }

  // 保存元数据（写回 frontmatter）
  const saveMeta = async function() {
    const path = data.value.path
    if (!path) return
    try {
      const obj: any = {}
      for (const entry of metaForm.value) {
        if (!entry || !entry.key) continue
        const key = String(entry.key)
        let val: any = entry.value
        try {
          const parsed = JSON.parse(entry.value)
          val = parsed
        } catch (e) {
          val = entry.value
        }
        obj[key] = val
      }
      const ok = await window.ipcRenderer.invoke('saveFileMetadata', path, obj)
      if (ok) {
        metaVisible.value = false
        // 尝试刷新当前渲染（如果内容来自磁盘则重新读取）
        if (!props.content && props.path) {
          const content = await window.ipcRenderer.invoke('readFile', props.path)
          await RenderMarkdown(content)
        } else {
          await init()
        }
      }
    } catch (e) {
      console.error('保存元数据失败', e)
    }
  }

  const openToc = async function(){
    const cur = data.value
    let content = ''
    
    if (cur.isWord) {
      content = wordContent.value || ''
    } else {
      content = cur?.content ?? ''
    }
    
    await RenderMarkdown(content)
    iftoc.value = true
  }
  
  // 监听图片缩放变化
  const onScaleChange = (scale: number) => {
    console.log('图片缩放比例:', scale)
  }
  
  // 监听图片重置
  const onImageReset = () => {
    console.log('图片已重置')
  }
  
  // 监听 props 的变化以刷新渲染
  watch(()=>[props.content, props.path], ()=>{
    init()
  })
  
  onMounted(()=>{
    init()
    window.addEventListener('keydown', save)
  })
  
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', save)
  })
</script>

<template >
  <div class="md">
    <div class="nav resize" v-if="iftoc&&(data.isMd || (data.isWord && wordContent) || toc.length>0)">
      <div style="position: absolute;width:100%;height:100%;display: flex;flex-direction: column;">
        <div class="toc scoll">
          <ul>
            <li v-for="(t,index) in toc" :key="index" >
              <a :href="'#'+t[4]" target="_self" style="color:var(--fontColor)">
                <div style="width:100%">
                  <span v-for="item,index in t[1].length-2" style="width:10px"> </span>
                  {{t[6]}}
                </div>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
    
    <div class="content">
      <!-- 菜单按钮只对 Markdown 和 Word 文件显示 -->
      <div v-if="data && (data.isMd || data.isWord)" class="button" style="position: absolute;right:10px;z-index:999" @click="ifMenu=!ifMenu">
        <i class="fa fa-angle-down"></i>
      </div>
      <div v-if="ifMenu && (data.isMd || data.isWord)" class="menus" @mouseleave="ifMenu=false">
        <div @click="openToc" v-if="!iftoc"><i class="fa fa-bars"></i> {{store.locales=='zh'?'打开目录':'Open Table of Contents'}}</div>
        <div @click="iftoc=false" v-if="iftoc"><i class="fa fa-bars"></i> {{store.locales=='zh'?'关闭目录':'Close Table of Contents'}}</div>
        <div @click="speak"><i class="fa fa-volume-up"></i> {{store.locales=='zh'?'朗读文章':'Read Article'}}</div>
        <div @click="store.copyToClipboard(data.isWord ? wordContent : data.content)"><i class="fa fa-copy"></i> {{store.locales=='zh'?'复制全文':'Copy Full Text'}}</div>
        <div @click="store.openByApp(data.path)"><i class="fa fa-certificate"></i> {{store.locales=='zh'?'软件打开':'Open with App'}}</div>
        <div @click="openMetaEditor" v-if="data.path&&data.isMd"><i class="fa fa-edit"></i> {{store.locales=='zh'?'编辑标签':'Edit Metadata'}} </div>
      </div>
      
      <!-- 空内容提示 -->
      <div class="nodata" v-if="!data.isWord && data.content=='' && !data.isImage && !data.isVideo">
        <h5 style="width: 100%;text-align: center;">{{store.locales=='zh'?'文件无内容和数据':'No Data'}}</h5>
      </div>
      
      <!-- Word文档加载状态 -->
      <div v-if="data.isWord && isLoadingWord" class="loading-state">
        <i class="fa fa-spinner fa-spin"></i>
        <span>{{store.locales=='zh'?'正在加载Word文档...':'Loading Word document...'}}</span>
      </div>
      
      <!-- Word文档错误信息 -->
      <div v-else-if="data.isWord && wordError" class="error-state">
        <i class="fa fa-exclamation-triangle"></i>
        <span>{{ wordError }}</span>
        <button @click="loadWordContent" class="retry-btn">
          <i class="fa fa-refresh"></i> {{store.locales=='zh'?'重试':'Retry'}}
        </button>
      </div>
      
      <!-- Word文档内容（渲染为Markdown） -->
      <div v-else-if="data.isWord && wordContent && prep!=''" class="prep scoll" v-html="prep" @mouseup="handleSelection" @keyup="handleSelection">
      </div>
      
      <!-- 视频文件显示 -->
      <div v-if="data.isVideo" class="nodata">
        <video style="width: 100%;height: 100%;object-fit: contain;" controls :src="data.path"></video>
      </div>
      
      <!-- 图片文件显示 - 使用独立的图片组件 -->
      <div v-if="data.isImage && data.path" class="nodata">
        <ImageZoom 
          :path="data.path" 
          :enable-dragging="true"
          :min-scale="0.1"
          :max-scale="8"
          :wheel-step="0.05"
          :show-controls="true"
          @scale-change="onScaleChange"
        />
      </div>
      
      <!-- 纯文本文件显示 -->
      <div v-if="data.isTxt&&data.content!=''" class="prep scoll" v-html="data.content" @mouseup="handleSelection" @keyup="handleSelection">
      </div>
      
      <!-- Markdown 文件显示 -->
      <div v-if="data.isMd&&prep!=''" class="prep scoll" v-html="prep" @mouseup="handleSelection" @keyup="handleSelection">
      </div>
      
      <!-- 其他格式文件处理 -->
      <div class="nodata" v-if="!data.isMd && !data.isWord && !data.isImage && !data.isVideo && !data.isTxt && data.content!=''">
        <button @click="store.openByApp(data.path)">外部打开</button>
      </div>
    </div>
    
    <!-- 元数据编辑弹窗 -->
    <div v-if="metaVisible" style="z-index:9999;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:80%">
      <div style="display:flex;align-items:center;padding:6px;background:var(--menuColor)">
        <div style="flex:1;font-weight:600">{{store.locales=='zh'?'编辑元数据':'Edit Metadata'}}</div>
        <div style="padding-left:6px;"><button @click="metaVisible=false">{{store.locales=='zh'?'关闭':'Close'}}</button></div>
      </div>
      <div style="padding:5px;max-height:60vh;overflow:auto;background:var(--backgroundColor);border:1px solid var(--borderColor)">
        <div v-if="metaForm.length===0" style="color:var(--borderColor);margin-bottom:8px;">{{store.locales=='zh'?'暂无元数据':'No metadata'}}</div>
        <div v-for="(entry, idx) in metaForm" :key="idx" style="display:flex;margin-bottom:3px;align-items:center;">
          <input v-model="entry.key" placeholder="key" style="width:25%;margin-left: 0px;" :style="(entry.key === 'summary' || entry.key === '摘要' || entry.key === 'abstract') ? { height: '68px' } : {}" />
          <template v-if="entry.key === 'summary' || entry.key === '摘要' || entry.key === 'abstract'">
            <textarea 
              v-model="entry.value" 
              placeholder="摘要内容..."
              style="flex:1;min-height:60px;resize:vertical;margin:2px;"
              rows="3"
            ></textarea>
          </template>
          <template v-else>
            <input 
              v-model="entry.value" 
              placeholder="value" 
              style="flex:1;margin-right:5px;" 
            />
          </template>
          <div style="margin-left: 3px;" @click="metaForm.splice(idx,1)" title="删除"><i class="fa fa-trash"></i></div>
        </div>
        <div style="margin-bottom:5px;">
          <button @click="metaForm.push({key:'',value:''})">{{store.locales=='zh'?'添加字段':'Add field'}}</button>
        </div>
        <div style="display:flex;gap:5px;justify-content:flex-end;">
          <button @click="metaVisible=false">{{store.locales=='zh'?'取消':'Cancel'}}</button>
          <button @click="saveMeta">{{store.locales=='zh'?'保存':'Save'}}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .md{
    width:100%;
    height: 100%;
    position:relative;
    margin: 0px;
    display: flex;
    flex:1;
  }
  .iftoc:hover{
    opacity: 1;
  }
  ul{
    list-style: none;
    margin: 0px;
    padding:5px;
    padding-top:5px;
    margin-block-end:0px;
  }
  li{
    color:var(--fontColor);
    clear:both;
    height:24px;
    cursor:pointer;
    line-height:28px;
    position: relative;
    white-space:nowrap;
  }
  td{
    padding: 0px;
    text-align: center;
  }
  li:hover{
    color: var(--fontActiveColor);
  }
  li:hover .del{
    display: inline-block;
    text-shadow: 1px 1px 2px black;
  }

  .content{
    position:absolute;
    width:calc(100%);
    height:calc(100%);
    color:var(--fontColor);
    padding: 0px;
    position: relative;
    display: inline-block;
  }
  .Columns{
    position: relative;
    height: 100%;
    display: flex;
    flex-wrap:nowrap;
    flex-direction:row
  }
  .Column{
    width: calc(100% - 2px);
    height:calc(100%);
    position: relative;
    display: inline-block;
    border-right:1px solid var(--borderColor);
    overflow-y: auto;
    overflow-x: hidden;
  }
  .Column::-webkit-scrollbar {
    display: none;
  }
  .prep{
    position: absolute;
    float: left;
    width:calc(100% - 20px);
    height:calc(100% - 20px);
    color:var(--fontColor);
    overflow-y: auto;
    overflow-x: hidden;
    padding: 10px;
    font-size: 16px;
  }
  .nav{
    width:300px;
    min-width:205px;
    max-width:350px;
    height:calc(100%);
    position: relative;
    border-right:1px solid var(--borderColor)
  }
  .nav::-webkit-scrollbar {
    display: none;
  }
  .info{
    padding:5px;
    width:calc(100% - 10px);
    border-bottom: 1px solid var(--borderColor);
    height: fit-content;
    max-height: 200px;
    overflow-y: auto;
  }
  .info table tr td{
    white-space: nowrap;
    overflow: none;
    width:calc(100%);
    max-width: 90px;
    text-overflow: ellipsis;
    font-size: 12px;
    padding: 0px;
    height:20px
  }
  .toc{
    overflow: hidden;
    overflow-y: auto;
  }
  .img{
    text-align: center;
    width:100%;
    height: 100%;
  }
  .img img{
    display: table-cell;
    width: 100%;
    height: 100%;
    object-fit:contain;
    z-index:-100;
  }
  button{
    width: 100%;
  }
  input{
    border-color: 1px solid var(--borderColor);
  }
  .menus{
    z-index:100;
    background-color: var(--backgroundColor);
    position: absolute;
    right:10px;
    z-index:999;
    display: flex;
    flex-direction: column;
    margin: 5px;
    border: 1px solid var(--borderColor);
    border-radius: 5px;
    padding: 5px;
    cursor: pointer;
  }
  .menus .menu{
    display: flex;
  }
  .menu .button{
    padding:5px 10px;
    margin-right: 5px;
    border: 1px solid var(--borderColor);
    border-radius: 5px;
    text-align: center;
  }
  .menu input{
    width: 135px;
    border: 1px solid var(--borderColor);
  }
  .active{
    background-color: var(--menuColor);
  }
  .loading{
    background-color: var(--backgroundColor);
    padding:5px;
    border: 1px solid var(--borderColor);
  }
  hr{
    background-color:var(--fontColor);
  }
  .nodata{
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100%;
    user-select: none;
    overflow: hidden;
  }
  .nodata .panel {
    height:fit-content;
    width:150px;
    font-size: 16px;
    text-align: center;
  }
  .nodata button {
    height:35px;
    border-radius: 5px;
    width:150px;
    margin: 5px;
    background-color: var(--menuColor);
    border: 1px solid var(--borderColor);
    font-size: 16px;
  }
  .loading-state, .error-state {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100%;
    gap: 15px;
    color: var(--fontColor);
  }
  .loading-state i {
    font-size: 30px;
    margin-bottom: 10px;
  }
  .error-state i {
    font-size: 40px;
    color: #ff6b6b;
    margin-bottom: 10px;
  }
  .retry-btn {
    width: auto;
    padding: 8px 16px;
    margin-top: 10px;
    cursor: pointer;
  }
  .retry-btn i {
    font-size: 14px;
    margin-right: 5px;
  }
  input{
    border-radius: 5px;
    margin: 2px;
    border: 1px solid var(--borderColor);
  }
</style>