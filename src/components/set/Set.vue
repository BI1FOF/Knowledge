<!-- src/components/set/set.vue -->
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { usestore } from '../../store'
import Help from './Help.vue'
import SkillsSettings from './SkillsSettings.vue'  // 导入新组件

const store = usestore()

// 定义导航分类
const navItems = ref([
  { id: 'general', icon: 'fa fa-cog', title_zh: '通用设置', title_en: 'General' },
  { id: 'view', icon: 'fa fa-eye', title_zh: '视图设置', title_en: 'View' },
  { id: 'llm', icon: 'fa fa-comments', title_zh: '模型设置', title_en: 'LLM' },
  { id: 'skills', icon: 'fa fa-cubes', title_zh: '技能设置', title_en: 'Skills' },
  { id: 'Python', icon: 'fa fa-code', title_zh: '环境设置', title_en: 'Python' },
  { id: 'tts', icon: 'fa fa-volume-up', title_zh: '语音设置', title_en: 'TTS' },
  { id: 'help', icon: 'fa fa-question-circle', title_zh: '软件帮助', title_en: 'Help' }
])

// 当前激活的导航项
const activeNav = ref('general')

// 帮助和功能函数
const help = function() {
  window.open("https://github.com/whl1207/Knowledge", "_blank");
}
const openConsole = function() {
  window.ipcRenderer.send('dev',{})
}
let serveState = ref(false)

if(window.ipcRenderer!=undefined){
  window.ipcRenderer.on('server-status', (event, status) => {
    console.log(status)
    serveState.value = status
  })  
}

const openFolder = async function() {
  let path = await window.ipcRenderer.invoke('openFolderDialog')
  if(path!=null){
    store.root = path
    store.tree = await window.ipcRenderer.invoke('getDirectoryTree',path)
    store.path = path
  }
}
const openSkillsFolder = async function() {
  let path = await window.ipcRenderer.invoke('openFolderDialog')
  if(path!=null){
    store.skillsPath = path
  }
}
// 计算属性：根据当前语言获取标题
const getTitle = (item:any) => {
  return store.locales === 'zh' ? item.title_zh : item.title_en
}

// 计算属性：获取视图按钮数据
const viewButtons = computed(() => [
  { id: '浏览', icon: 'fa fa-book', title_zh: '浏览', title_en: 'Browse' },
  { id: '编辑', icon: 'fa fa-code', title_zh: '编辑', title_en: 'Edit' },
  { id: '导图', icon: 'fa fa-map-o', title_zh: '导图', title_en: 'Mindmap' },
  { id: '演示', icon: 'fa fa-television', title_zh: '演示', title_en: 'Presentation' },
  { id: '文件', icon: 'fa fa-folder', title_zh: '文件', title_en: 'Files' },
  { id: '看板', icon: 'fa fa-list-ul', title_zh: '看板', title_en: 'Kanban' },
  { id: '图谱', icon: 'fa fa-xing', title_zh: '图谱', title_en: 'Graph' },
  { id: '甘特', icon: 'fa fa-list-alt', title_zh: '甘特', title_en: 'Gantt' },
  { id: '月历', icon: 'fa fa-calendar-o', title_zh: '月历', title_en: 'Month Calendar' },
  { id: '年历', icon: 'fa fa-calendar-o', title_zh: '年历', title_en: 'Year Calendar' },
  { id: '地图', icon: 'fa fa-location-arrow', title_zh: '地图', title_en: 'Map' },
  { id: '表格', icon: 'fa fa-table', title_zh: '表格', title_en: 'Table' }
])

// TTS语音类型选项
const ttsTypes = computed(() => [
  { value: '本地', label_zh: '本地语音合成', label_en: 'Local TTS' },
  { value: 'indexTTS2', label_zh: 'IndexTTS2', label_en: 'IndexTTS2' },
  { value: 'Qwen3-TTS', label_zh: 'Qwen3-TTS', label_en: 'Qwen3-TTS' }
])

// 获取当前语言下的TTS类型标签
const getTTSLabel = (type: string) => {
  const ttsType = ttsTypes.value.find(t => t.value === type)
  if (!ttsType) return type
  return store.locales === 'zh' ? ttsType.label_zh : ttsType.label_en
}

// 监听模型类型变化，重置连接状态
watch(() => store.AIconfig.llm.type, (newType, oldType) => {
  store.AIconfig.llm.online = false
  // 只有在真正切换类型时才清空，而不是在初始化时
  if (oldType && oldType !== newType) {
    switch(newType) {
      case 'ollama':
        // 不要清空模型，只清空可用列表
        store.AIconfig.llm.ollama.available_models = []
        break
      case 'openai':
      case 'deepseek':
        store.AIconfig.llm.openai.available_models = []
        break
    }
  }
})

// 获取当前配置的帮助文本
const getCurrentConfigHelp = computed(() => {
  const type = store.AIconfig.llm.type
  const config = store.AIconfig.llm

  switch(type) {
    case 'ollama':
      return store.locales === 'zh' 
        ? 'Ollama是本地运行的AI模型服务。请确保Ollama服务已启动。'
        : 'Ollama is a local AI model service. Make sure Ollama service is running.'
    case 'openai':
      return store.locales === 'zh'
        ? 'OpenAI官方API配置。需要有效的API密钥。'
        : 'OpenAI official API configuration. Requires valid API key.'
    case 'deepseek':
      return store.locales === 'zh'
        ? 'DeepSeek AI API配置。需要DeepSeek API密钥。'
        : 'DeepSeek AI API configuration. Requires DeepSeek API key.'
    case 'anthropic':
      return store.locales === 'zh'
        ? 'Anthropic Claude API配置。需要Claude API密钥。'
        : 'Anthropic Claude API configuration. Requires Claude API key.'
    case 'google':
      return store.locales === 'zh'
        ? 'Google Gemini API配置。需要Google AI密钥。'
        : 'Google Gemini API configuration. Requires Google AI key.'
    case 'azure':
      return store.locales === 'zh'
        ? 'Azure OpenAI服务配置。需要Azure API密钥和部署信息。'
        : 'Azure OpenAI service configuration. Requires Azure API key and deployment info.'
    case 'custom':
      return store.locales === 'zh'
        ? '自定义API配置。请填写您的API端点和配置信息。'
        : 'Custom API configuration. Please fill in your API endpoint and configuration.'
    default:
      return ''
  }
})

// 测试连接
const testConnection = async () => {
  try {
    const success = await store.testConnection()
  } catch (error) {
    console.error('测试连接时出错:', error)
    if (store.locales === 'zh') {
      alert('测试连接时出错！')
    } else {
      alert('Error testing connection!')
    }
  }
}

// 测试TTS功能
const testTTS = () => {
  const testText = store.locales === 'zh' ? '这是一个语音合成测试。' : 'This is a TTS test.'
  store.tts(testText)
}

// ================ Python环境设置相关代码 ================

// 当前选择的Python环境
const selectedPythonEnvironment = ref('safe')

// Python安装状态
const pythonInstallation = ref({
  installed: false,
  version: null,
  command: null
})

// Python包列表
const pythonPackages = ref<any[]>([])
const isLoadingPackages = ref(false)

// 包安装状态
const packageInstallation = ref({
  installing: false,
  currentPackage: ''
})

// 测试执行状态
const testExecutionStatus = ref({
  running: false,
  result: '',
  error: '',
  success: false
})

// 检查Python安装状态
const checkPythonInstallation = async () => {
  try {
    const result = await window.ipcRenderer.invoke('checkPythonInstallation')
    pythonInstallation.value = result
    return result
  } catch (error) {
    console.error('检查Python安装失败:', error)
    return {
      installed: false,
      version: null,
      command: null
    }
  }
}

// 获取Python包列表
const fetchPythonPackages = async () => {
  isLoadingPackages.value = true
  try {
    const result = await window.ipcRenderer.invoke('listPythonPackagesWithEnvironment', store.TrustedPython)
    if (result.success && result.packages) {
      pythonPackages.value = result.packages
    } else {
      pythonPackages.value = []
    }
  } catch (error) {
    console.error('获取Python包列表失败:', error)
    pythonPackages.value = []
  } finally {
    isLoadingPackages.value = false
  }
}

// 安装Python包
const installPythonPackage = async (packageName: string) => {
  if (packageInstallation.value.installing) {
    return
  }

  packageInstallation.value = {
    installing: true,
    currentPackage: packageName
  }

  try {
    const result = await window.ipcRenderer.invoke('installPythonPackageWithEnvironment', {
      packageName: packageName,
      environment: store.TrustedPython
    })
    
    if (result.success) {
      // 刷新包列表
      await fetchPythonPackages()
    }
  } catch (error: any) {
    console.error('安装包失败:', error)
  } finally {
    packageInstallation.value = {
      installing: false,
      currentPackage: ''
    }
  }
}

// 安装必要包（pulp, numpy等）
const installRequiredPackages = async () => {
  if (store.locales === 'zh') {
    if (!confirm('将要安装 pulp 和 numpy 等必要的Python包，确定要继续吗？')) {
      return
    }
  } else {
    if (!confirm('Will install required Python packages like pulp and numpy. Continue?')) {
      return
    }
  }

  packageInstallation.value = {
    installing: true,
    currentPackage: 'required-packages'
  }

  try {
    const result = await window.ipcRenderer.invoke('installRequiredPackages')
    
    if (result.success) {
      // 刷新包列表
      await fetchPythonPackages()
    }
  } catch (error: any) {
    console.error('安装必要包失败:', error)
  } finally {
    packageInstallation.value = {
      installing: false,
      currentPackage: ''
    }
  }
}

// 搜索包
const searchPackage = ref('')
const filteredPackages = computed(() => {
  if (!searchPackage.value.trim()) {
    return pythonPackages.value
  }
  
  const searchTerm = searchPackage.value.toLowerCase()
  return pythonPackages.value.filter(pkg => 
    pkg.name.toLowerCase().includes(searchTerm)
  )
})

// 环境切换
const handleEnvironmentChange = async (envType: boolean) => {
  store.TrustedPython = envType
  
  // 刷新包列表
  await fetchPythonPackages()
}

// 执行Python测试代码
const executeTestCode = async () => {
  const testCode = `print("Hello from Python!")
print("Environment: ${store.TrustedPython}")
print("Python version check:")
import sys
print(f"Python {sys.version}")
print("Test successful!")`
  
  testExecutionStatus.value = {
    running: true,
    result: '',
    error: '',
    success: false
  }
  
  try {
    const result = await window.ipcRenderer.invoke('executePython', {
      code: testCode,
      environment: store.TrustedPython
    })
    
    if (result.success) {
      testExecutionStatus.value = {
        running: false,
        result: result.result || result.output || '',
        error: '',
        success: true
      }
    } else {
      testExecutionStatus.value = {
        running: false,
        result: '',
        error: result.error || 'Unknown error',
        success: false
      }
    }
  } catch (error: any) {
    console.error('执行测试代码失败:', error)
    testExecutionStatus.value = {
      running: false,
      result: '',
      error: error.message,
      success: false
    }
  }
}
const handleOllamaUrlChange = async () => {
  // URL改变时，自动刷新模型列表
  await refreshOllamaModels()
}

const handleOllamaModelChange = () => {
  // 模型改变时，立即保存配置
  store.saveConfig()
}

const refreshOllamaModels = async () => {
  await store.getAIconfig()
  // 刷新后确保保存配置
  store.saveConfig()
}

// llama.cpp 相关状态
const llamaModelsDir = ref('')

// 选择模型文件夹
const selectModelsFolder = async () => {
    const result = await window.ipcRenderer.invoke('openFolderDialog')
    if (result) {
        llamaModelsDir.value = result
        // 保存到配置
        if (!store.AIconfig.llm.llama.modelsDir) {
            store.AIconfig.llm.llama.modelsDir = result
        }
        await refreshLlamaModels()
    }
}

// 刷新 llama 模型列表
const refreshLlamaModels = async () => {
    // 设置模型目录
    if (llamaModelsDir.value) {
        store.AIconfig.llm.llama.modelsDir = llamaModelsDir.value
    }
    
    await store.getAIconfig()
    store.saveConfig()
}

// 模型选择事件
const onModelSelect = () => {
    store.saveConfig()
}

// 获取模型显示名称
const getModelName = (modelPath: string) => {
    const model = store.AIconfig.llm.llama.availableModels.find(m => m.path === modelPath)
    if (model) return model.name
    
    // 手动实现 basename 功能，不依赖 Node.js path 模块
    const basename = (path: string) => {
        // 处理 Windows 和 Unix 路径分隔符
        const normalizedPath = path.replace(/\\/g, '/')
        const parts = normalizedPath.split('/')
        const fileName = parts[parts.length - 1]
        // 移除 .gguf 扩展名
        return fileName.replace(/\.gguf$/i, '')
    }
    
    return basename(modelPath)
}

// 组件挂载时初始化
onMounted(async () => {
    // 检查Python安装状态
    await checkPythonInstallation()
    
    // 获取包列表
    await fetchPythonPackages()
    
    if (store.AIconfig.llm.type === 'ollama') {
        // 先尝试从 localStorage 直接读取保存的模型
        try {
            const savedConfig = localStorage.getItem('AIconfig')
            if (savedConfig) {
                const parsed = JSON.parse(savedConfig)
                if (parsed.llm?.type === 'ollama' && parsed.llm.ollama?.model) {
                    const savedModel = parsed.llm.ollama.model
                    // 直接设置到 store
                    store.AIconfig.llm.ollama.model = savedModel
                }
            }
        } catch (e) {
            console.error('恢复模型失败:', e)
        }
        
        // 延迟刷新模型列表，但不覆盖已选择的模型
        setTimeout(async () => {
            await refreshOllamaModels()
        }, 100)
    }

    // 初始化 llama 模型目录
    if (store.AIconfig.llm.llama.modelsDir) {
        llamaModelsDir.value = store.AIconfig.llm.llama.modelsDir
        await refreshLlamaModels()
    }
    
    // 设置默认模型目录
    if (!store.AIconfig.llm.llama.modelsDir) {
        llamaModelsDir.value = './models'
        store.AIconfig.llm.llama.modelsDir = './models'
    }
})
onBeforeUnmount(() => {
  store.saveConfig()
})
</script>

<template>
  <div class="settings-container">
    <!-- 左侧导航栏 -->
    <div class="settings-nav scoll">
      <div 
        v-for="item in navItems" 
        :key="item.id"
        class="nav-item"
        :class="{ active: activeNav === item.id }"
        @click="activeNav = item.id"
        :title="getTitle(item)"
      >
        <i :class="item.icon"></i>
        <span>{{ getTitle(item) }}</span>
      </div>
    </div>

    <!-- 右侧设置内容 -->
    <div class="settings-content scoll">
      <!-- 通用设置 -->
      <div v-if="activeNav === 'general'" class="settings-section">
        <!-- 文件设置 -->
        <div class="settings-group">
          <h3>{{ store.locales=='zh'?'知识库设置' : 'Knowledge base Settings' }}</h3>
          <div class="form-group">
            <label>{{ store.locales=='zh'?'知识库路径' : 'Knowledge Path' }}</label>
            <div class="input-with-button">
              <input v-model="store.root" :placeholder="store.locales=='zh'?'请输入文件路径' : 'Enter file path'"/>
              <div class="button" style="width:20px;height:18px;margin-top:6px;margin-right:6px" @click="openFolder" :title="store.locales=='zh'?'选择文件夹' : 'Select Folder'">
                <i class="fa fa-folder-open"></i>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label>{{ store.locales=='zh'?'语言' : 'Language' }}</label>
            <select v-model="store.locales">
              <option value="zh">{{ store.locales=='zh'?'中文' : 'Chinese' }}</option>
              <option value="en">{{ store.locales=='zh'?'英文' : 'English' }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>{{ store.locales=='zh'?'主题' : 'Theme' }}</label>
            <select v-model="store.UI.theme" @change="store.changeTheme()">
              <option value="浅红色">{{ store.locales=='zh'?'浅红色' : 'Light Red' }}</option>
              <option value="浅蓝色">{{ store.locales=='zh'?'浅蓝色' : 'Light Blue' }}</option>
              <option value="极简灰">{{ store.locales=='zh'?'极简灰' : 'Minimal Gray' }}</option>
              <option value="暖色调">{{ store.locales=='zh'?'暖色调' : 'Warm Tones' }}</option>
              <option value="奶茶色">{{ store.locales=='zh'?'奶茶色' : 'Milk Tea Color' }}</option>
              <option value="午夜蓝">{{ store.locales=='zh'?'午夜蓝' : 'Midnight Blue' }}</option>
              <option value="暗夜紫">{{ store.locales=='zh'?'暗夜紫' : 'Dark Purple' }}</option>
              <option value="灰色">{{ store.locales=='zh'?'灰色' : 'Gray' }}</option>
              <option value="深色">{{ store.locales=='zh'?'深色' : 'Dark' }}</option>
              <option value="自定义">{{ store.locales=='zh'?'自定义' : 'Custom' }}</option>
            </select>
          </div>

          <div v-if="store.UI.theme=='自定义'" class="color-settings">
            <div class="color-settings-header">
              <h4>{{ store.locales=='zh'?'自定义主题颜色' : 'Custom Theme Colors' }}</h4>
              <p class="color-description">{{ store.locales=='zh'?'点击颜色框选择您喜欢的颜色' : 'Click color boxes to select your preferred colors' }}</p>
            </div>
            
            <div class="form-group">
              <label>{{ store.locales=='zh'?'背景颜色' : 'Background Color' }}</label>
              <div class="color-input-wrapper">
                <input type="color" v-model="store.UI.backgroundColor" @change="store.changeTheme"/>
                <span class="color-value">{{ store.UI.backgroundColor }}</span>
              </div>
            </div>
            <div class="form-group">
              <label>{{ store.locales=='zh'?'菜单颜色' : 'Menu Color' }}</label>
              <div class="color-input-wrapper">
                <input type="color" v-model="store.UI.menuColor" @change="store.changeTheme"/>
                <span class="color-value">{{ store.UI.menuColor }}</span>
              </div>
            </div>
            <div class="form-group">
              <label>{{ store.locales=='zh'?'菜单激活色' : 'Active Menu Color' }}</label>
              <div class="color-input-wrapper">
                <input type="color" v-model="store.UI.menuActiveColor" @change="store.changeTheme"/>
                <span class="color-value">{{ store.UI.menuActiveColor }}</span>
              </div>
            </div>
            <div class="form-group">
              <label>{{ store.locales=='zh'?'字体颜色' : 'Text Color' }}</label>
              <div class="color-input-wrapper">
                <input type="color" v-model="store.UI.fontColor" @change="store.changeTheme"/>
                <span class="color-value">{{ store.UI.fontColor }}</span>
              </div>
            </div>
            <div class="form-group">
              <label>{{ store.locales=='zh'?'激活字体色' : 'Active Text Color' }}</label>
              <div class="color-input-wrapper">
                <input type="color" v-model="store.UI.fontActiveColor" @change="store.changeTheme"/>
                <span class="color-value">{{ store.UI.fontActiveColor }}</span>
              </div>
            </div>
            <div class="form-group">
              <label>{{ store.locales=='zh'?'边框颜色' : 'Border Color' }}</label>
              <div class="color-input-wrapper">
                <input type="color" v-model="store.UI.borderColor" @change="store.changeTheme"/>
                <span class="color-value">{{ store.UI.borderColor }}</span>
              </div>
            </div>
          </div>
        </div>
        

        <!-- 系统功能 -->
        <div class="settings-group">
          <h3>{{ store.locales=='zh'?'系统' : 'System' }}</h3>
          <div class="form-group">
            <label>{{ store.locales=='zh'?'常用操作' : 'Common Actions' }}</label>
            <div class="action-grid">
              <div class="button" @click="store.initConfig" :title="store.locales=='zh'?'初始化' : 'initialization'">
                <i class="fa fa-refresh"></i> {{ store.locales=='zh'?'初始化' : 'initialization' }}
              </div>
              <div class="button" @click="openConsole()" :title="store.locales=='zh'?'开发者工具' : 'Developer Tools'">
                <i class="fa fa-terminal"></i> {{ store.locales=='zh'?'控制台' : 'Console' }}
              </div>
              <div class="button" @click="help" :title="store.locales=='zh'?'帮助文档' : 'Help Documentation'">
                <i class="fa fa-question"></i> {{ store.locales=='zh'?'帮助' : 'Help' }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 视图设置 -->
      <div v-if="activeNav === 'view'" class="settings-section">
        <!-- 可用视图设置 -->
        <div class="settings-group">
          <h3>{{ store.locales=='zh'?'可用视图' : 'Available Views' }}</h3>
          <div class="form-group">
            <label>{{ store.locales=='zh'?'选择视图' : 'Select Views' }}</label>
            <div class="button-grid">
              <div 
                v-for="view in viewButtons"
                :key="view.id"
                class="view-button" 
                :class="{ active: store.isView(view.id) }" 
                @click="store.toggleView(view.id)"
                :title="store.locales=='zh' ? view.title_zh : view.title_en"
              >
                <i :class="view.icon"></i>
                <span>{{ store.locales=='zh' ? view.title_zh : view.title_en }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 布局设置 -->
        <div class="settings-group">
          <h3>{{ store.locales=='zh'?'布局设置' : 'Layout Settings' }}</h3>
          <div class="form-group">
            <label>{{ store.locales=='zh'?'布局方向' : 'Layout Direction' }}</label>
            <select v-model="store.UI.layout">
              <option value="horizontal">{{ store.locales=='zh'?'横向' : 'Horizontal' }}</option>
              <option value="vertical">{{ store.locales=='zh'?'纵向' : 'Vertical' }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- 大模型设置 -->
      <div v-if="activeNav === 'llm'" class="settings-section">
        <!-- 模型类型配置 -->
        <div class="settings-group">
          <h3>{{ store.locales=='zh'?'大语言模型设置' : 'Large Language Model Settings' }}</h3>
          
          <!-- 模型类型选择 -->
          <div class="form-group">
            <label>{{ store.locales=='zh'?'AI类型' : 'AI Type' }}</label>
            <select v-model="store.AIconfig.llm.type">
              <option v-for="(option, index) in store.AIconfig.llm.types" :key="index" :value="option">
                {{ option.charAt(0).toUpperCase() + option.slice(1) }}
              </option>
            </select>
            <div class="config-description">
              {{ getCurrentConfigHelp }}
            </div>
          </div>

          <!-- llama.cpp 配置 -->
          <div v-if="store.AIconfig.llm.type === 'llama'">
              <div class="form-group">
                  <label>{{ store.locales=='zh'?'模型文件夹' : 'Models Directory' }}</label>
                  <div class="input-with-button">
                      <input v-model="llamaModelsDir" 
                            :placeholder="store.locales=='zh'?'选择包含GGUF文件的文件夹' : 'Select folder containing GGUF files'"/>
                      <div class="button" style="width:20px;height:18px;margin-top:4px" @click="selectModelsFolder" 
                          :title="store.locales=='zh'?'选择文件夹' : 'Select Folder'">
                          <i class="fa fa-folder-open"></i>
                      </div>
                  </div>
              </div>
              
              <div class="form-group">
                  <label>{{ store.locales=='zh'?'选择模型' : 'Select Model' }}</label>
                  <div class="input-with-button">
                      <select v-model="store.AIconfig.llm.llama.modelPath" @change="onModelSelect">
                          <option value="">{{ store.locales=='zh'?'请选择GGUF模型文件' : 'Select GGUF model file' }}</option>
                          <option v-for="model in store.AIconfig.llm.llama.availableModels" 
                                  :key="model.path" 
                                  :value="model.path">
                              {{ model.name }}
                          </option>
                      </select>
                      <div class="button" style="width:15px;height:18px;margin-top:4px" @click="refreshLlamaModels" 
                          :title="store.locales=='zh'?'刷新模型列表' : 'Refresh model list'">
                          <i class="fa fa-refresh"></i>
                      </div>
                  </div>
              </div>
              
              <!-- 模型信息显示 -->
              <div v-if="store.AIconfig.llm.llama.modelPath" class="model-info">
                  <div class="info-item">
                      <i class="fa fa-info-circle"></i>
                      <span>{{ store.locales=='zh'?'当前模型: ' : 'Current model: ' }}{{ getModelName(store.AIconfig.llm.llama.modelPath) }}</span>
                  </div>
              </div>
              
              <!-- llama.cpp 高级设置 -->
              <div class="form-group">
                  <label>{{ store.locales=='zh'?'上下文大小' : 'Context Size' }}</label>
                  <div class="input-with-slider">
                      <input type="range" v-model="store.AIconfig.llm.llama.contextSize" min="512" max="8192" step="512" />
                      <span class="slider-value">{{ store.AIconfig.llm.llama.contextSize }}</span>
                  </div>
              </div>
              
              <div class="form-group">
                  <label>{{ store.locales=='zh'?'GPU层数' : 'GPU Layers' }}</label>
                  <div class="input-with-slider">
                      <input type="range" v-model="store.AIconfig.llm.llama.gpuLayers" min="-1" max="100" step="1" />
                      <span class="slider-value">
                          {{ store.AIconfig.llm.llama.gpuLayers === -1 ? (store.locales=='zh'?'自动' : 'Auto') : store.AIconfig.llm.llama.gpuLayers }}
                      </span>
                  </div>
                  <div class="config-description">
                      {{ store.locales=='zh'?'GPU加速层数，-1表示自动，0表示仅CPU' : 'GPU layers for acceleration, -1 for auto, 0 for CPU only' }}
                  </div>
              </div>
              
              <div class="form-group">
                  <label>{{ store.locales=='zh'?'线程数' : 'Threads' }}</label>
                  <div class="input-with-slider">
                      <input type="range" v-model="store.AIconfig.llm.llama.threads" min="0" max="32" step="1" />
                      <span class="slider-value">
                          {{ store.AIconfig.llm.llama.threads === 0 ? (store.locales=='zh'?'自动' : 'Auto') : store.AIconfig.llm.llama.threads }}
                      </span>
                  </div>
              </div>
          </div>

          <!-- Ollama配置 -->
          <div v-if="store.AIconfig.llm.type === 'ollama'">
            <div class="form-group">
              <label>{{ store.locales=='zh'?'模型地址' : 'Model URL' }}</label>
              <div class="input-with-button">
                <input :title="store.locales=='zh'?'例如: http://127.0.0.1:11434' : 'Example: http://127.0.0.1:11434'" 
                      v-model="store.AIconfig.llm.ollama.model_url" 
                      :placeholder="store.locales=='zh'?'请输入模型地址' : 'Enter model URL'"
                      @change="handleOllamaUrlChange"/>
              </div>
            </div>
            
            <div class="form-group">
              <label>{{ store.locales=='zh'?'模型类型' : 'Model Type' }}</label>
              <div class="input-with-button">
                <select v-model="store.AIconfig.llm.ollama.model" @change="handleOllamaModelChange">
                  <option value="">{{ store.locales=='zh'?'请选择模型' : 'Select model' }}</option>
                  <option v-for="(model, index) in store.AIconfig.llm.ollama.available_models" :key="index" :value="model">
                    {{ model }}
                  </option>
                </select>
                <div class="button" style="width:15px;height:18px;margin-top:4px" @click="refreshOllamaModels" 
                    :title="store.locales=='zh'?'刷新模型列表' : 'Refresh model list'">
                  <i class="fa fa-refresh"></i>
                </div>
              </div>
            </div>
          </div>
          
          <!-- OpenAI/DeepSeek配置 -->
          <div v-if="store.AIconfig.llm.type === 'openai' || store.AIconfig.llm.type === 'deepseek'">
            <div class="form-group">
              <label>{{ store.locales=='zh'?'API密钥' : 'API Key' }}</label>
              <input type="password" v-model="store.AIconfig.llm.openai.api_key" 
                     :placeholder="store.locales=='zh'?'请输入API密钥' : 'Enter API key'"/>
            </div>
            
            <div class="form-group">
              <label>{{ store.locales=='zh'?'API地址' : 'API URL' }}</label>
              <input v-model="store.AIconfig.llm.openai.base_url" 
                     :placeholder="store.locales=='zh'?'例如: https://api.openai.com/v1' : 'Example: https://api.openai.com/v1'"/>
            </div>
            
            <div class="form-group">
              <label>{{ store.locales=='zh'?'模型名称' : 'Model Name' }}</label>
              <div class="input-with-button">
                <input v-model="store.AIconfig.llm.openai.model" 
                       :placeholder="store.locales=='zh'?'例如: gpt-3.5-turbo' : 'Example: gpt-3.5-turbo'"/>
                <div class="button" style="width:30px;margin-top:6px" @click="store.getAIconfig()" 
                     :title="store.locales=='zh'?'获取可用模型' : 'Get available models'">
                  <i class="fa fa-refresh"></i>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Anthropic配置 -->
          <div v-if="store.AIconfig.llm.type === 'anthropic'">
            <div class="form-group">
              <label>{{ store.locales=='zh'?'API密钥' : 'API Key' }}</label>
              <input type="password" v-model="store.AIconfig.llm.anthropic.api_key" 
                     :placeholder="store.locales=='zh'?'请输入Claude API密钥' : 'Enter Claude API key'"/>
            </div>
            
            <div class="form-group">
              <label>{{ store.locales=='zh'?'模型名称' : 'Model Name' }}</label>
              <input v-model="store.AIconfig.llm.anthropic.model" 
                     :placeholder="store.locales=='zh'?'例如: claude-3-haiku-20240307' : 'Example: claude-3-haiku-20240307'"/>
            </div>
          </div>
          
          <!-- Google配置 -->
          <div v-if="store.AIconfig.llm.type === 'google'">
            <div class="form-group">
              <label>{{ store.locales=='zh'?'API密钥' : 'API Key' }}</label>
              <input type="password" v-model="store.AIconfig.llm.google.api_key" 
                     :placeholder="store.locales=='zh'?'请输入Google AI密钥' : 'Enter Google AI key'"/>
            </div>
            
            <div class="form-group">
              <label>{{ store.locales=='zh'?'模型名称' : 'Model Name' }}</label>
              <input v-model="store.AIconfig.llm.google.model" 
                     :placeholder="store.locales=='zh'?'例如: gemini-pro' : 'Example: gemini-pro'"/>
            </div>
          </div>
          
          <!-- Azure配置 -->
          <div v-if="store.AIconfig.llm.type === 'azure'">
            <div class="form-group">
              <label>{{ store.locales=='zh'?'API密钥' : 'API Key' }}</label>
              <input type="password" v-model="store.AIconfig.llm.azure.api_key" 
                     :placeholder="store.locales=='zh'?'请输入Azure API密钥' : 'Enter Azure API key'"/>
            </div>
            
            <div class="form-group">
              <label>{{ store.locales=='zh'?'端点地址' : 'Endpoint' }}</label>
              <input v-model="store.AIconfig.llm.azure.endpoint" 
                     :placeholder="store.locales=='zh'?'例如: https://your-resource.openai.azure.com' : 'Example: https://your-resource.openai.azure.com'"/>
            </div>
            
            <div class="form-group">
              <label>{{ store.locales=='zh'?'部署名称' : 'Deployment' }}</label>
              <input v-model="store.AIconfig.llm.azure.deployment" 
                     :placeholder="store.locales=='zh'?'部署名称' : 'Deployment name'"/>
            </div>
            
            <div class="form-group">
              <label>{{ store.locales=='zh'?'API版本' : 'API Version' }}</label>
              <input v-model="store.AIconfig.llm.azure.api_version" 
                     :placeholder="store.locales=='zh'?'例如: 2024-02-15-preview' : 'Example: 2024-02-15-preview'"/>
            </div>
          </div>
          
          <!-- 自定义配置 -->
          <div v-if="store.AIconfig.llm.type === 'custom'">
            <div class="form-group">
              <label>{{ store.locales=='zh'?'API地址' : 'API URL' }}</label>
              <input v-model="store.AIconfig.llm.custom.api_url" 
                     :placeholder="store.locales=='zh'?'完整的API端点地址' : 'Full API endpoint URL'"/>
            </div>
            
            <div class="form-group">
              <label>{{ store.locales=='zh'?'API密钥' : 'API Key' }}</label>
              <input type="password" v-model="store.AIconfig.llm.custom.api_key" 
                     :placeholder="store.locales=='zh'?'可选的API密钥' : 'Optional API key'"/>
            </div>
            
            <div class="form-group">
              <label>{{ store.locales=='zh'?'模型名称' : 'Model Name' }}</label>
              <input v-model="store.AIconfig.llm.custom.model" 
                     :placeholder="store.locales=='zh'?'模型标识符' : 'Model identifier'"/>
            </div>
          </div>
          
          <!-- 通用参数配置 -->
          <div class="form-group">
            <label>{{ store.locales=='zh'?'温度' : 'Temperature' }}</label>
            <div class="input-with-slider">
              <input type="range" v-model="store.AIconfig.llm.temperature" min="0" max="2" step="0.1" />
              <span class="slider-value">{{ store.AIconfig.llm.temperature }}</span>
            </div>
          </div>
          
          <div class="form-group">
            <label>{{ store.locales=='zh'?'最大令牌数' : 'Max Tokens' }}</label>
            <input type="number" v-model="store.AIconfig.llm.max_tokens" min="100" max="30000" />
          </div>
          
          <div class="form-group">
            <label>{{ store.locales=='zh'?'流式响应' : 'Stream Response' }}</label>
            <input type="checkbox" v-model="store.AIconfig.llm.stream" 
                   :title="store.locales=='zh'?'启用流式响应' : 'Enable stream response'"/>
          </div>
          
          <!-- 连接状态和测试 -->
          <div class="form-group">
            <label>{{ store.locales=='zh'?'连接状态' : 'Connection Status' }}</label>
            <div class="status-indicator" :class="{ online: store.AIconfig.llm.online, offline: !store.AIconfig.llm.online }">
              <i :class="store.AIconfig.llm.online ? 'fa fa-check-circle' : 'fa fa-times-circle'"></i>
              <span>{{ store.AIconfig.llm.online ? (store.locales=='zh'?'已连接' : 'Connected') : (store.locales=='zh'?'未连接' : 'Disconnected') }}</span>
            </div>
          </div>
          
          <div class="form-group">
            <label>{{ store.locales=='zh'?'操作' : 'Actions' }}</label>
            <div class="button-group">
              <div class="button" @click="testConnection" :title="store.locales=='zh'?'测试连接' : 'Test Connection'">
                <i class="fa fa-plug"></i> {{ store.locales=='zh'?'测试连接' : 'Test' }}
              </div>
              <div class="button" @click="store.getAIconfig()" :title="store.locales=='zh'?'刷新状态' : 'Refresh Status'">
                <i class="fa fa-refresh"></i> {{ store.locales=='zh'?'刷新' : 'Refresh' }}
              </div>
            </div>
          </div>
        </div>

        
      </div>

      <!-- 技能设置 - 使用新组件 -->
      <div v-if="activeNav === 'skills'" class="settings-section">
        <SkillsSettings />
      </div>

      <!-- 语音设置 -->
      <div v-if="activeNav === 'tts'" class="settings-section">
        <div class="settings-group">
          <h3>{{ store.locales=='zh'?'语音合成设置' : 'Text-to-Speech Settings' }}</h3>
          
          <!-- TTS类型选择 -->
          <div class="form-group">
            <label>{{ store.locales=='zh'?'语音类型' : 'TTS Type' }}</label>
            <select v-model="store.AIconfig.tts.type">
              <option v-for="ttsType in ttsTypes" :key="ttsType.value" :value="ttsType.value">
                {{ getTTSLabel(ttsType.value) }}
              </option>
            </select>
          </div>
          
          <!-- 本地TTS设置 -->
          <div v-if="store.AIconfig.tts.type === '本地'">
            <div class="form-group">
              <label>{{ store.locales=='zh'?'语音设置' : 'Voice Settings' }}</label>
              <div class="voice-settings">
                <div class="form-group">
                  <label>{{ store.locales=='zh'?'语速' : 'Speech Rate' }}</label>
                  <input type="range" v-model="store.AIconfig.tts.rate" min="0.5" max="2" step="0.1" />
                  <span class="range-value">{{ store.AIconfig.tts.rate || 1.0 }}</span>
                </div>
                <div class="form-group">
                  <label>{{ store.locales=='zh'?'音高' : 'Pitch' }}</label>
                  <input type="range" v-model="store.AIconfig.tts.pitch" min="0.5" max="2" step="0.1" />
                  <span class="range-value">{{ store.AIconfig.tts.pitch || 1.0 }}</span>
                </div>
              </div>
            </div>
          </div>
          <!-- indexTTS2设置 -->
          <div v-if="store.AIconfig.tts.type === 'indexTTS2'">
            <div class="form-group">
              <label>{{ store.locales=='zh'?'TTS服务地址' : 'TTS Service URL' }}</label>
              <input v-model="store.AIconfig.tts.url" :title="(store.locales=='zh'?'IndexTTS2服务地址，默认为http://localhost:9880/' : 'IndexTTS2 service URL')" :placeholder="store.locales=='zh'?'请输入TTS服务地址' : 'Enter TTS service URL'"/>
            </div>
            <div class="form-group">
              <label>{{ store.locales=='zh'?'音色' : 'Voice' }}</label>
              <input v-model="store.AIconfig.tts.voice" :title="store.locales=='zh'?'例如: mazhao, zh-CN-YunxiNeural 等' : 'Example: mazhao, zh-CN-YunxiNeural, etc.'" :placeholder="store.locales=='zh'?'请输入音色名称' : 'Enter voice name'"/>
            </div>
            <div class="form-group">
              <label>{{ store.locales=='zh'?'语言' : 'Language' }}</label>
              <input v-model="store.AIconfig.tts.language" :placeholder="store.locales=='zh'?'例如: zh, en 等' : 'Example: zh, en, etc.'"/>
            </div>
            <div v-if="store.AIconfig.tts.type === 'indexTTS2'" class="form-group">
              <label>{{ store.locales=='zh'?'情感参数' : 'Emotion Parameter' }}</label>
              <input v-model="store.AIconfig.tts.emo" :placeholder="store.locales=='zh'?'可选情感参数' : 'Optional emotion parameter'"/>
            </div>
            <div v-if="store.AIconfig.tts.type === 'indexTTS2'" class="form-group">
              <label>{{ store.locales=='zh'?'权重参数' : 'Weight Parameter' }}</label>
              <input type="number" v-model="store.AIconfig.tts.weight" min="0" max="1" step="0.1" :placeholder="store.locales=='zh'?'0-1之间的权重' : 'Weight between 0-1'"/>
            </div>
          </div>
          <!-- Qwen3-TTS设置 -->
          <div v-if="store.AIconfig.tts.type === 'Qwen3-TTS'">
            <div class="form-group">
              <label>{{ store.locales=='zh'?'TTS服务地址' : 'TTS Service URL' }}</label>
              <input v-model="store.AIconfig.tts.url" :title="(store.locales=='zh'?'Qwen3-TTS服务地址，默认为http://localhost:9880/' : 'Qwen3-TTS service URL')" :placeholder="store.locales=='zh'?'请输入TTS服务地址' : 'Enter TTS service URL'"/>
            </div>
            <div class="form-group">
              <label>{{ store.locales=='zh'?'音色' : 'Voice' }}</label>
              <input v-model="store.AIconfig.tts.voice" :title="store.locales=='zh'?'例如: mazhao, zh-CN-YunxiNeural 等' : 'Example: mazhao, zh-CN-YunxiNeural, etc.'" :placeholder="store.locales=='zh'?'请输入音色名称' : 'Enter voice name'"/>
            </div><div class="form-group">
              <label>{{ store.locales=='zh'?'语言' : 'Language' }}</label>
              <input v-model="store.AIconfig.tts.language" :placeholder="store.locales=='zh'?'例如: zh, en 等' : 'Example: zh, en, etc.'"/>
            </div>
          </div>

          <!-- 测试按钮 -->
          <div class="form-group">
            <label>{{ store.locales=='zh'?'测试功能' : 'Test Function' }}</label>
            <div class="button-group">
              <div class="button" @click="testTTS" :title="store.locales=='zh'?'测试语音合成' : 'Test TTS function'">
                <i class="fa fa-volume-up"></i> {{ store.locales=='zh'?'测试语音' : 'Test TTS' }}
              </div>
              <div class="button" @click="store.stopTTS" :title="store.locales=='zh'?'停止当前语音' : 'Stop current TTS'">
                <i class="fa fa-stop"></i> {{ store.locales=='zh'?'停止语音' : 'Stop TTS' }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 帮助 -->
      <div v-if="activeNav === 'help'" class="settings-section">
        <div class="settings-group">
          <div class="form-group">
            <Help />
          </div>
        </div>
      </div>

      <!-- 高级设置 -->
      <div v-if="activeNav === 'Python'" class="settings-section">
        <!-- Python环境设置 -->
        <div class="settings-group">
          <h3>{{ store.locales=='zh'?'Python环境设置' : 'Python Environment Settings' }}</h3>
          
          <!-- Python安装状态 -->
          <div class="form-group">
            <label>{{ store.locales=='zh'?'Python状态' : 'Python Status' }}</label>
            <div class="python-status" :class="{ installed: pythonInstallation.installed, 'not-installed': !pythonInstallation.installed }">
              <i :class="pythonInstallation.installed ? 'fa fa-check-circle' : 'fa fa-times-circle'"></i>
              <span>
                {{ pythonInstallation.installed ? 
                  (store.locales=='zh' ? `已安装 (${pythonInstallation.version})` : `Installed (${pythonInstallation.version})`) : 
                  (store.locales=='zh' ? '未安装' : 'Not installed')
                }}
              </span>
            </div>
          </div>
          
          <!-- Python环境选择 -->
          <div class="form-group">
            <label>{{ store.locales=='zh'?'执行环境' : 'Execution Environment' }}</label>
            <div class="environment-selector">
              <div 
                class="environment-option"
                :class="{ active: !store.TrustedPython }"
                @click="handleEnvironmentChange(false)"
                :title="store.locales=='zh' ? '有限制的执行环境，有代码安全检查' : 'Restricted execution environment with code safety checks'"
              >
                <i class="fa fa-shield"></i>
                <span>{{ store.locales=='zh' ? '安全环境' : 'Safe Environment' }}</span>
              </div>
              <div 
                class="environment-option"
                :class="{ active: store.TrustedPython }"
                @click="handleEnvironmentChange(true)"
                :title="store.locales=='zh' ? '无限制执行环境，直接运行Python代码' : 'Unrestricted execution environment, directly runs Python code'"
              >
                <i class="fa fa-unlock"></i>
                <span>{{ store.locales=='zh' ? '可信环境' : 'Trusted Environment' }}</span>
              </div>
            </div>
          </div>
          <div v-if="store.TrustedPython" class="environment-warning">
            <i class="fa fa-exclamation-triangle"></i>
            <span>{{ store.locales=='zh' ? '警告：此环境无安全限制，请确保代码来源可信' : 'Warning: This environment has no safety restrictions, ensure code is from trusted sources' }}</span>
          </div>
          <!-- 环境测试 -->
          <div class="form-group">
            <label>{{ store.locales=='zh'?'环境测试' : 'Environment Test' }}</label>
            <div class="environment-test">
              <div class="test-controls">
                <div class="button" @click="executeTestCode" :title="store.locales=='zh'?'执行测试代码' : 'Execute test code'" :disabled="testExecutionStatus.running">
                  <i v-if="!testExecutionStatus.running" class="fa fa-play"></i>
                  <i v-else class="fa fa-spinner fa-spin"></i>
                  {{ store.locales=='zh'?'测试执行' : 'Test Execute' }}
                </div>
                <div class="button" @click="checkPythonInstallation" :title="store.locales=='zh'?'检查Python安装' : 'Check Python installation'">
                  <i class="fa fa-refresh"></i> {{ store.locales=='zh'?'检查Python' : 'Check Python' }}
                </div>
              </div>
              
              <!-- 测试结果 -->
              <div v-if="testExecutionStatus.result" class="test-result success">
                <div class="result-header">
                  <i class="fa fa-check-circle"></i>
                  <strong>{{ store.locales=='zh'?'测试成功' : 'Test successful' }}</strong>
                </div>
                <div class="result-content scoll">
                  <pre>{{ testExecutionStatus.result }}</pre>
                </div>
              </div>
              
              <div v-if="testExecutionStatus.error" class="test-result error">
                <div class="result-header">
                  <i class="fa fa-times-circle"></i>
                  <strong>{{ store.locales=='zh'?'测试失败' : 'Test failed' }}</strong>
                </div>
                <div class="result-content scoll">
                  <pre>{{ testExecutionStatus.error }}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Python包管理 -->
        <div class="settings-group">
          <h3>{{ store.locales=='zh'?'Python包管理' : 'Python Package Management' }}</h3>
          
          <!-- 包安装状态 -->
          <div v-if="packageInstallation.installing" class="form-group">
            <label>{{ store.locales=='zh'?'安装状态' : 'Installation Status' }}</label>
            <div class="installation-status">
              <i class="fa fa-spinner fa-spin"></i>
              <span>{{ store.locales=='zh' ? `正在安装 ${packageInstallation.currentPackage}...` : `Installing ${packageInstallation.currentPackage}...` }}</span>
            </div>
          </div>
          
          <!-- 包列表 -->
          <div class="form-group">
            <label>{{ store.locales=='zh'?'已安装包' : 'Installed Packages' }}</label>
            <div class="package-management">
              <!-- 搜索框 -->
              <div class="package-search">
                <input 
                  v-model="searchPackage" 
                  :placeholder="store.locales=='zh'?'搜索包...' : 'Search packages...'"
                />
                <i class="fa fa-search"></i>
              </div>
              
              <!-- 包列表 -->
              <div class="package-list-container scoll" v-if="!isLoadingPackages">
                <div v-if="filteredPackages.length === 0" class="empty-packages">
                  <i class="fa fa-box"></i>
                  <span>{{ store.locales=='zh'?'没有找到包' : 'No packages found' }}</span>
                </div>
                <div 
                  v-for="pkg in filteredPackages" 
                  :key="pkg.name"
                  class="package-item"
                >
                  <div class="package-info">
                    <div class="package-name">{{ pkg.name }}</div>
                    <div class="package-version">{{ pkg.version }}</div>
                  </div>
                  <div class="package-actions">
                    <div 
                      class="button small"
                      @click="installPythonPackage(pkg.name)"
                      :title="store.locales=='zh'?'重新安装此包' : 'Reinstall this package'"
                      :disabled="packageInstallation.installing"
                    >
                      <i v-if="packageInstallation.installing && packageInstallation.currentPackage === pkg.name" class="fa fa-spinner fa-spin"></i>
                      <i v-else class="fa fa-download"></i>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- 加载中 -->
              <div v-else class="loading-packages">
                <i class="fa fa-spinner fa-spin"></i>
                <span>{{ store.locales=='zh'?'加载中...' : 'Loading...' }}</span>
              </div>
              
              <!-- 包数量信息 -->
              <div class="package-count">
                <i class="fa fa-cube"></i>
                <span>{{ store.locales=='zh' ? `共 ${filteredPackages.length} 个包` : `${filteredPackages.length} packages total` }}</span>
              </div>
            </div>
          </div>
          
          <!-- 包操作 -->
          <div class="form-group">
            <label>{{ store.locales=='zh'?'包操作' : 'Package Operations' }}</label>
            <div class="button-group">
              <div class="button" @click="installRequiredPackages" :title="store.locales=='zh'?'安装必要的Python包' : 'Install required Python packages'" :disabled="packageInstallation.installing">
                <i v-if="packageInstallation.installing && packageInstallation.currentPackage === 'required-packages'" class="fa fa-spinner fa-spin"></i>
                <i v-else class="fa fa-download"></i>
                {{ store.locales=='zh'?'安装必要包' : 'Install Required' }}
              </div>
              <div class="button" @click="fetchPythonPackages" :title="store.locales=='zh'?'刷新包列表' : 'Refresh package list'" :disabled="isLoadingPackages">
                <i v-if="isLoadingPackages" class="fa fa-spinner fa-spin"></i>
                <i v-else class="fa fa-refresh"></i>
                {{ store.locales=='zh'?'刷新列表' : 'Refresh List' }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 样式保持不变 */
.settings-container {
  display: flex;
  height: calc(100% - 0px);
  background-color: var(--backgroundColor);
  border: 1px solid var(--borderColor);
}

.settings-nav {
  width: 110px;
  height: calc(100% - 10px);
  background-color: var(--menuColor);
  border-right: 1px solid var(--borderColor);
  display: flex;
  flex-direction: column;
  padding: 5px 5px;
  user-select: none;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  margin-bottom: 5px;
  color: var(--fontColor);
  cursor: pointer;
  border-radius: 5px;
  transition: all 0.2s ease;
  gap: 10px;
}

.nav-item:hover {
  background-color: var(--menuActiveColor);
}

.nav-item.active {
  background-color: var(--menuActiveColor);
  color: var(--fontActiveColor);
}

.nav-item i {
  font-size: 16px;
  width: 20px;
  text-align: center;
}

.nav-item span {
  font-size: 14px;
  white-space: nowrap;
}

.settings-content {
  flex: 1;
  overflow-x: hidden;
  overflow-y: auto;
  height: calc(100% - 10px);
  padding: 5px;
}

.settings-group {
  margin-bottom: 10px;
  padding-bottom: 5px;
  border-bottom: 1px solid var(--borderColor);
}

.settings-group:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.settings-group h3 {
  color: var(--fontActiveColor);
  margin: 0 0 5px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--borderColor);
  font-size: 16px;
  font-weight: 600;
}

/* 表单组样式 */
.form-group {
  display: flex;
  align-items: center;
  margin-bottom: 5px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  width: 120px;
  min-width: 120px;
  color: var(--fontColor);
  font-size: 14px;
  user-select: none;
}

.form-group input,
.form-group select,
.form-group textarea {
  flex: 1;
  padding: 2px 4px;
  border: 1px solid var(--borderColor);
  border-radius: 5px;
  background-color: var(--menuColor);
  color: var(--fontColor);
  font-size: 14px;
  transition: border-color 0.2s ease;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--fontActiveColor);
}

.form-group input[type="range"] {
  flex: 1;
  margin-right: 10px;
}

.form-group input[type="checkbox"] {
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  margin-right: 10px;
}

.form-group input[type="password"] {
  letter-spacing: 1px;
}

/* 带按钮的输入框 */
.input-with-button {
  flex: 1;
  display: flex;
  gap: 5px;
}

/* 带滑块的值显示 */
.input-with-slider {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
}

.slider-value {
  min-width: 30px;
  text-align: center;
  color: var(--fontColor);
  font-size: 14px;
}

/* 按钮带状态 */
.button-with-status {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-text {
  color: var(--fontActiveColor);
  font-size: 14px;
}

/* 状态指示器 */
.status-indicator {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 5px;
  font-size: 14px;
}

.status-indicator.online {
  background-color: rgba(46, 204, 113, 0.2);
  color: #2ecc71;
  border: 1px solid rgba(46, 204, 113, 0.3);
}

.status-indicator.offline {
  background-color: rgba(231, 76, 60, 0.2);
  color: #e74c3c;
  border: 1px solid rgba(231, 76, 60, 0.3);
}

.status-indicator i {
  font-size: 16px;
}

/* 配置描述文本 */
.config-description {
  flex: 1;
  font-size: 10px;
  color: var(--fontColor);
  opacity: 0.7;
  margin-top: 4px;
  margin-left: 0px;
}

/* 语音设置 */
.voice-settings {
  width: 100%;
}

.range-value {
  min-width: 40px;
  text-align: center;
  color: var(--fontColor);
  font-size: 14px;
}

/* 视图按钮网格 */
.button-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
  gap: 8px;
  width:calc(100%)
}

@media (max-width: 480px) {
  .button-grid {
    grid-template-columns: repeat(3, 1fr); /* 小屏幕3列 */
  }
}

@media (max-width: 600px) {
  .button-grid {
    grid-template-columns: repeat(4, 1fr); /* 中等屏幕4列 */
  }
}

.view-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10px 5px;
  border: 1px solid var(--borderColor);
  border-radius: 5px;
  background-color: var(--menuColor);
  color: var(--fontColor);
  cursor: pointer;
  transition: all 0.2s ease;
  gap: 5px;
  min-width:50px
}

.view-button:hover {
  background-color: var(--menuActiveColor);
}

.view-button.active {
  background-color: var(--menuActiveColor);
  color: var(--fontActiveColor);
  border-color: var(--fontActiveColor);
}

.view-button i {
  font-size: 16px;
}

.view-button span {
  font-size: 12px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

/* 颜色设置区域优化 */
.color-settings-header {
  grid-column: 1 / -1;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--borderColor);
}

.color-settings-header h4 {
  color: var(--fontActiveColor);
  margin: 0 0 5px 0;
  font-size: 15px;
}

.color-description {
  color: var(--fontColor);
  font-size: 13px;
  margin: 0;
  opacity: 0.8;
}

.color-input-wrapper {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
}

.color-input-wrapper input[type="color"] {
  flex: 0 0 30px;
  height: 30px;
  border: 2px solid var(--borderColor);
  border-radius: 6px;
  cursor: pointer;
  padding: 2px;
  transition: all 0.2s ease;
  margin:0px
}

.color-input-wrapper input[type="color"]:hover {
  border-color: var(--fontActiveColor);
  transform: scale(1.05);
}

.color-value {
  flex: 1;
  color: var(--fontColor);
  font-size: 13px;
  background-color: var(--backgroundColor);
  padding: 5px 10px;
  border-radius: 4px;
  border: 1px solid var(--borderColor);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  user-select: all;
}

/* 操作按钮网格 */
.action-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 5px;
}

.button {
  border: 1px solid var(--borderColor);
  border-radius: 5px;
  background-color: var(--menuColor);
  color: var(--fontColor);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
  white-space: nowrap;
  width:calc(100% - 20px);
  margin:0px;
  padding: 6px 6px;
}

.button:hover {
  background-color: var(--menuActiveColor);
  color: var(--fontActiveColor);
}

.button.active {
  background-color: var(--menuActiveColor);
  color: var(--fontActiveColor);
  border-color: var(--fontActiveColor);
}

.button i {
  font-size: 14px;
}

/* 按钮组样式 */
.button-group {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
}

/* 响应式调整 */
@media (max-width: 600px) {
  .settings-nav {
    width: 40px;
    min-width: 40px;
  }
  
  .nav-item span {
    display: none;
  }
  
  .nav-item {
    justify-content: center;
    padding: 10px 10px;
  }
  
  .form-group {
    display: grid;
  }
  
  .form-group label {
    width: 100%;
  }
  
  .config-description {
    margin-left: 0;
    margin-top: 5px;
  }
  
  .action-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .color-settings {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 12px;
    padding: 8px;
  }
  
  .color-settings input[type="color"] {
    height: 36px;
  }
  
  .button-group {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .voice-settings .form-group {
    flex-direction: row;
    align-items: center;
  }
  
  .voice-settings .form-group label {
    width: 80px;
    min-width: 80px;
  }
  
  .input-with-slider {
    flex-direction: column;
    align-items: stretch;
    gap: 5px;
  }
  
  .slider-value {
    align-self: flex-end;
  }
}

/* Python状态指示器 */
.python-status {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 5px;
  font-size: 14px;
}

.python-status.installed {
  background-color: rgba(46, 204, 113, 0.2);
  color: #2ecc71;
  border: 1px solid rgba(46, 204, 113, 0.3);
}

.python-status.not-installed {
  background-color: rgba(231, 76, 60, 0.2);
  color: #e74c3c;
  border: 1px solid rgba(231, 76, 60, 0.3);
}

.python-status i {
  font-size: 16px;
}

/* 环境选择器 */
.environment-selector {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.environment-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px 8px;
  border: 2px solid var(--borderColor);
  border-radius: 8px;
  background-color: var(--menuColor);
  color: var(--fontColor);
  cursor: pointer;
  transition: all 0.3s ease;
  gap: 8px;
}

.environment-option:hover {
  background-color: var(--menuActiveColor);
}

.environment-option.active {
  background-color: var(--menuActiveColor);
  color: var(--fontActiveColor);
  border-color: var(--fontActiveColor);
}

.environment-option i {
  font-size: 24px;
  margin-bottom: 5px;
}

.environment-option span {
  font-size: 14px;
  font-weight: 600;
  text-align: center;
}

/* 环境警告 */
.environment-warning {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  margin: 8px 0px;
  background-color: rgba(230, 162, 60, 0.15);
  border: 1px solid rgba(230, 162, 60, 0.3);
  border-radius: 6px;
  color: #e6a23c;
}

.environment-warning i {
  font-size: 16px;
}

.environment-warning span {
  font-size: 13px;
  font-weight: 500;
}

/* 环境测试 */
.environment-test {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.test-controls {
  display: flex;
  gap: 8px;
}

.test-result {
  padding: 6px;
  border-radius: 6px;
}

.test-result.success {
  background-color: rgba(46, 204, 113, 0.1);
  border: 1px solid rgba(46, 204, 113, 0.2);
}

.test-result.error {
  background-color: rgba(231, 76, 60, 0.1);
  border: 1px solid rgba(231, 76, 60, 0.2);
}

.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.result-header i {
  font-size: 16px;
}

.result-header i.fa-check-circle {
  color: #2ecc71;
}

.result-header i.fa-times-circle {
  color: #e74c3c;
}

.result-header strong {
  color: var(--fontActiveColor);
  font-size: 14px;
}

.result-content {
  max-height: 200px;
  overflow-y: auto;
  background-color: var(--backgroundColor);
  border-radius: 4px;
  padding: 10px;
}

.result-content pre {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-wrap: break-word;
  color: var(--fontColor);
}

/* 包管理 */
.package-management {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 包搜索框 */
.package-search {
  position: relative;
  width: 100%;
}

.package-search input {
  width: calc(100% - 36px);
  padding: 4px 4px 4px 30px;
  margin: 0px;
  border: 1px solid var(--borderColor);
  border-radius: 6px;
  background-color: var(--menuColor);
  color: var(--fontColor);
  font-size: 14px;
  transition: all 0.2s ease;
}

.package-search i {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--fontColor);
  opacity: 0.6;
}

/* 安装状态 */
.installation-status {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background-color: rgba(52, 152, 219, 0.15);
  border: 1px solid rgba(52, 152, 219, 0.3);
  border-radius: 6px;
  color: #3498db;
}

.installation-status i {
  font-size: 16px;
}

.installation-status span {
  font-size: 14px;
  font-weight: 500;
}

/* 包列表容器 */
.package-list-container {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--borderColor);
  border-radius: 6px;
  background-color: var(--menuColor);
}

/* 空包状态 */
.empty-packages {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--fontColor);
  opacity: 0.6;
  gap: 12px;
}

.empty-packages i {
  font-size: 48px;
}

.empty-packages span {
  font-size: 14px;
  text-align: center;
}

/* 包项 */
.package-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 4px;
  border-bottom: 1px solid var(--borderColor);
  transition: all 0.2s ease;
}

.package-item:hover {
  background-color: var(--menuActiveColor);
}

.package-item:last-child {
  border-bottom: none;
}

.package-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.package-name {
  color: var(--fontActiveColor);
  font-size: 14px;
  font-weight: 600;
}

.package-version {
  color: var(--fontColor);
  font-size: 12px;
  opacity: 0.7;
}

.package-actions {
  display: flex;
  gap: 8px;
}

.button.small {
  width: auto;
  padding: 6px 10px;
  font-size: 12px;
}

/* 加载中 */
.loading-packages {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--fontColor);
  gap: 12px;
}

.loading-packages i {
  font-size: 24px;
}

.loading-packages span {
  font-size: 14px;
}

/* 包数量信息 */
.package-count {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: var(--backgroundColor);
  border-radius: 6px;
  border: 1px solid var(--borderColor);
}

.package-count i {
  color: var(--fontActiveColor);
  font-size: 14px;
}

.package-count span {
  color: var(--fontColor);
  font-size: 13px;
}

/* 响应式调整 */
@media (max-width: 600px) {
  .environment-selector {
    grid-template-columns: 1fr;
  }
  
  .environment-option {
    padding: 15px 10px;
  }
  
  .environment-option i {
    font-size: 28px;
  }
  
  .environment-option span {
    font-size: 16px;
  }
  
  .package-item {
    flex-direction: row;
    align-items: flex-start;
    gap: 10px;
  }
  
  .package-actions {
    align-self: flex-end;
  }
  
  .test-controls {
    flex-direction: column;
  }
}
</style>