<template>
  <div class="image-generator">
    <div class="generator-container">
      <!-- 输入区域 -->
      <div class="input-section">
        <h2>文本到图像生成器</h2>
        
        <div class="form-group">
          <label for="prompt">提示词（支持中文）:</label>
          <textarea
            id="prompt"
            v-model="prompt"
            placeholder="请输入图像描述，例如：一只可爱的猫坐在窗边，阳光明媚"
            rows="4"
          ></textarea>
        </div>
        
        <div class="form-group">
          <label for="negative-prompt">负面提示词:</label>
          <textarea
            id="negative-prompt"
            v-model="negativePrompt"
            placeholder="不希望出现在图像中的内容"
            rows="3"
          ></textarea>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="width">图像宽度:</label>
            <input
              id="width"
              v-model.number="width"
              type="number"
              min="256"
              max="2048"
              step="64"
            >
          </div>
          
          <div class="form-group">
            <label for="height">图像高度:</label>
            <input
              id="height"
              v-model.number="height"
              type="number"
              min="256"
              max="2048"
              step="64"
            >
          </div>
          
          <div class="form-group">
            <label for="steps">迭代次数:</label>
            <input
              id="steps"
              v-model.number="steps"
              type="number"
              min="1"
              max="50"
            >
          </div>
        </div>
        
        <!-- 新增：模型和配置选项 -->
        <div class="form-row">
          <div class="form-group">
            <label for="lora1">Lora模型1:</label>
            <select id="lora1" v-model="lora1">
              <option value="None">None</option>
              <option value="redcraftRedzima_lora.safetensors">redcraftRedzima_lora</option>
              <option value="VestalWater_Illustrious_styles_for_Z_Image.safetensors">VestalWater</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="lora1Weight">Lora1权重:</label>
            <input
              id="lora1Weight"
              v-model.number="lora1Weight"
              type="number"
              min="0"
              max="2"
              step="0.1"
            >
          </div>
          
          <div class="form-group">
            <label for="noiseLevel">重绘系数:</label>
            <input
              id="noiseLevel"
              v-model.number="noiseLevel"
              type="number"
              min="0"
              max="1"
              step="0.05"
            >
          </div>
        </div>
        
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="useInpainting"> 使用局部重绘
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="useI2I"> 使用图生图
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="useControlNet"> 使用姿态控制
          </label>
        </div>
        
        <button
          class="generate-btn"
          :disabled="isGenerating"
          @click="generateImage"
        >
          {{ isGenerating ? '生成中...' : '生成图像' }}
        </button>
      </div>
      
      <!-- 结果区域 -->
      <div class="result-section">
        <h3>生成结果</h3>
        
        <div v-if="isGenerating" class="loading">
          <div class="spinner"></div>
          <p>正在生成图像... 排队任务数: {{ queueCount }}</p>
          <p>任务ID: {{ currentTaskId }}</p>
          <p v-if="statusMessage">{{ statusMessage }}</p>
        </div>
        
        <div v-if="error" class="error">
          {{ error }}
        </div>
        
        <div v-if="generatedImage && !isGenerating" class="image-result">
          <img :src="generatedImage" alt="生成的图像" class="generated-image">
          <div class="image-actions">
            <button @click="downloadImage">下载图像</button>
            <button @click="clearResult">清除结果</button>
          </div>
        </div>
        
        <div v-if="taskDetails" class="task-details">
          <h4>任务详情:</h4>
          <pre>{{ taskDetails }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'

// 状态管理 - 保持不变
const prompt = ref('')
const negativePrompt = ref('bad image, bad photo, bad hand, bad finger, logo, Backlight, worst quality, low resolution, distorted, twisted, watermark')
const width = ref(1024)
const height = ref(768)
const steps = ref(9)
const lora1 = ref('None')
const lora1Weight = ref(1)
const lora2 = ref('None')
const lora2Weight = ref(1)
const lora3 = ref('None')
const lora3Weight = ref(1)
const lora4 = ref('None')
const lora4Weight = ref(1)
const noiseLevel = ref(0.45)
const useInpainting = ref(false)
const useI2I = ref(false)
const useControlNet = ref(false)
const refineText = ref('开启')

const isGenerating = ref(false)
const generatedImage = ref('')
const error = ref('')
const queueCount = ref('0')
const currentTaskId = ref('')
const taskDetails = ref('')
const statusMessage = ref('')
const pollingInterval = ref<NodeJS.Timeout | null>(null)

// Gradio API调用函数 - 符合Gradio API规范
async function callGradioApi<T>(apiName: string, data: any[] = []): Promise<T> {
  const baseUrl = 'http://localhost:7861'
  
  try {
    // 1. 首先发送POST请求获取event_id
    const postUrl = `${baseUrl}/gradio_api/call/${apiName}`
    console.log(`POST请求: ${postUrl}`, { data })
    
    const postResponse = await fetch(postUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data })
    })
    
    if (!postResponse.ok) {
      const errorText = await postResponse.text()
      throw new Error(`POST请求失败: ${postResponse.status} ${postResponse.statusText}\n${errorText}`)
    }
    
    const postResult = await postResponse.json()
    console.log(`POST响应:`, postResult)
    
    const eventId = postResult.event_id
    if (!eventId) {
      throw new Error('无法获取event_id')
    }
    
    console.log(`获取到event_id: ${eventId}`)
    
    // 2. 使用GET请求获取结果
    const getUrl = `${baseUrl}/gradio_api/call/${apiName}/${eventId}`
    console.log(`GET请求: ${getUrl}`)
    
    // 使用fetch获取SSE流
    const response = await fetch(getUrl)
    
    if (!response.ok) {
      throw new Error(`GET请求失败: ${response.status} ${response.statusText}`)
    }
    
    // 读取SSE流
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取响应流')
    }
    
    const decoder = new TextDecoder()
    let resultData: any = null
    
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value)
        console.log('SSE chunk:', chunk)
        
        // 解析SSE格式
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataLine = line.substring(6)
            if (dataLine.trim()) {
              try {
                const parsed = JSON.parse(dataLine)
                console.log('解析的SSE数据:', parsed)
                
                if (parsed.msg === 'process_completed' && parsed.output) {
                  // 处理完成，返回输出数据
                  return parsed.output.data as T
                } else if (parsed.data) {
                  // 直接返回数据
                  return parsed.data as T
                } else if (parsed.msg === 'process_completed') {
                  // 只有完成消息，没有数据
                  return { completed: true } as T
                }
              } catch (e) {
                console.error('解析SSE数据失败:', e, '原始数据:', dataLine)
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
    
    // 如果没有找到有效数据，返回空
    return null as T
    
  } catch (err) {
    console.error(`${apiName} 调用失败:`, err)
    throw err
  }
}

// 简化的API调用，直接获取event_id
async function callApiForEventId(apiName: string, data: any[] = []): Promise<string> {
  const baseUrl = 'http://localhost:7861'
  const url = `${baseUrl}/gradio_api/call/${apiName}`
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${response.statusText}\n${errorText}`)
    }
    
    const result = await response.json()
    console.log(`${apiName} event_id响应:`, result)
    
    return result.event_id
  } catch (err) {
    console.error(`${apiName} 调用失败:`, err)
    throw err
  }
}

// 使用event_id轮询结果
async function pollWithEventId(apiName: string, eventId: string): Promise<any> {
  const baseUrl = 'http://localhost:7861'
  const pollUrl = `${baseUrl}/gradio_api/call/${apiName}/${eventId}`
  
  console.log(`轮询: ${pollUrl}`)
  
  try {
    const response = await fetch(pollUrl)
    
    if (!response.ok) {
      throw new Error(`轮询失败: ${response.status} ${response.statusText}`)
    }
    
    // 读取SSE流
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取响应流')
    }
    
    const decoder = new TextDecoder()
    let resultData: any = null
    
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value)
        console.log('轮询SSE chunk:', chunk)
        
        // 解析SSE格式
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataLine = line.substring(6)
            if (dataLine.trim()) {
              try {
                const parsed = JSON.parse(dataLine)
                console.log('轮询解析的数据:', parsed)
                
                if (parsed.msg === 'process_completed' && parsed.output) {
                  resultData = parsed.output.data
                } else if (parsed.data) {
                  resultData = parsed.data
                } else if (parsed.msg === 'process_completed') {
                  resultData = { completed: true }
                }
              } catch (e) {
                console.error('解析轮询数据失败:', e)
              }
            }
          }
        }
        
        // 如果已获取到数据，提前退出
        if (resultData) {
          break
        }
      }
    } finally {
      reader.releaseLock()
    }
    
    return resultData
    
  } catch (err) {
    console.error(`轮询 ${apiName} 失败:`, err)
    throw err
  }
}

// 生成图像
async function generateImage() {
  if (!prompt.value.trim()) {
    error.value = '请输入提示词'
    return
  }
  
  isGenerating.value = true
  error.value = ''
  generatedImage.value = ''
  taskDetails.value = ''
  statusMessage.value = '正在提交生成任务...'
  currentTaskId.value = Date.now().toString()
  
  try {
    // 构建参数
    const params = [
      null,                               // [0] State组件1
      null,                               // [1] State组件2
      prompt.value,                       // [2] 提示词
      steps.value,                        // [3] 迭代次数
      negativePrompt.value,               // [4] 负面提示词
      width.value,                        // [5] 图片宽
      height.value,                       // [6] 图片高
      {                                   // [7] 参考图片
        path: "https://raw.githubusercontent.com/gradio-app/gradio/main/test/test_files/bus.png",
        meta: { _type: "gradio.FileData" }
      },
      refineText.value,                   // [8] 是否开启加速
      lora1.value,                        // [9] Lora_1
      lora1Weight.value,                  // [10] lora权重
      lora2.value,                        // [11] Lora_2
      lora2Weight.value,                  // [12] lora权重
      lora3.value,                        // [13] Lora_3
      lora3Weight.value,                  // [14] lora权重
      lora4.value,                        // [15] Lora_4
      lora4Weight.value,                  // [16] lora权重
      useInpainting.value,                // [17] 是否使用局部重绘
      useI2I.value,                       // [18] 是否使用图生图
      noiseLevel.value,                   // [19] 重绘系数
      useControlNet.value                 // [20] 是否使用姿态控制
    ]
    
    console.log('提交参数:', params.length, '个')
    
    statusMessage.value = '提交任务到队列...'
    
    // 调用add_task_to_queue获取event_id
    const taskEventId = await callApiForEventId('add_task_to_queue', params)
    
    if (taskEventId) {
      taskDetails.value = `任务已提交，event_id: ${taskEventId}`
      statusMessage.value = '任务正在处理中...'
      queueCount.value = '1'
      
      // 开始轮询任务状态
      pollTaskStatus(taskEventId)
    } else {
      throw new Error('无法获取任务event_id')
    }
    
  } catch (err) {
    error.value = `生成任务提交失败: ${err instanceof Error ? err.message : '未知错误'}`
    isGenerating.value = false
    statusMessage.value = ''
    console.error('生成错误详情:', err)
  }
}

// 轮询任务状态
async function pollTaskStatus(eventId: string) {
  console.log(`开始轮询任务状态: ${eventId}`)
  
  try {
    // 轮询任务结果
    const taskResult = await pollWithEventId('add_task_to_queue', eventId)
    
    console.log('任务轮询结果:', taskResult)
    
    if (taskResult) {
      if (Array.isArray(taskResult) && taskResult.length >= 3) {
        const [details, markdown, queue] = taskResult
        taskDetails.value = details || '任务详情'
        queueCount.value = queue || '0'
        statusMessage.value = `任务已处理，队列中还有 ${queueCount.value} 个任务`
        
        // 任务处理完成，开始轮询图像结果
        startImagePolling()
      } else if (taskResult.completed) {
        statusMessage.value = '任务处理完成，等待图像生成...'
        startImagePolling()
      }
    } else {
      // 如果没有结果，等待后重试
      setTimeout(() => {
        if (isGenerating.value) {
          pollTaskStatus(eventId)
        }
      }, 2000)
    }
    
  } catch (err) {
    console.error('轮询任务状态失败:', err)
    
    // 等待后重试
    setTimeout(() => {
      if (isGenerating.value) {
        pollTaskStatus(eventId)
      }
    }, 3000)
  }
}

// 轮询图像结果
function startImagePolling() {
  if (pollingInterval.value) {
    clearInterval(pollingInterval.value)
  }
  
  let pollCount = 0
  const maxPolls = 30 // 最多轮询30次，约1.5分钟
  
  pollingInterval.value = setInterval(async () => {
    pollCount++
    
    try {
      statusMessage.value = `检查图像生成进度... (${pollCount}/${maxPolls})`
      
      // 获取刷新API的event_id
      const refreshParams = [
        null,  // State组件1
        null,  // State组件2
        null,  // State组件3
        null   // State组件4
      ]
      
      const refreshEventId = await callApiForEventId('refresh_ui_and_process_queue', refreshParams)
      
      if (refreshEventId) {
        // 轮询刷新结果
        const refreshResult = await pollWithEventId('refresh_ui_and_process_queue', refreshEventId)
        
        console.log('刷新轮询结果:', refreshResult)
        
        if (Array.isArray(refreshResult) && refreshResult.length >= 6) {
          const [details, gallery, zipPath, markdown, queue, latestImage] = refreshResult
          
          queueCount.value = queue || '0'
          taskDetails.value = details || taskDetails.value
          statusMessage.value = `队列中还有 ${queueCount.value} 个任务`
          
          // 检查是否有新生成的图像
          if (latestImage && !generatedImage.value) {
            processLatestImage(latestImage)
          }
          
          // 检查是否完成
          if (queue === '0' || generatedImage.value || pollCount >= maxPolls) {
            if (!generatedImage.value && pollCount >= maxPolls) {
              error.value = '生成超时，请重试'
            }
            stopPolling()
            isGenerating.value = false
            if (generatedImage.value) {
              statusMessage.value = '图像生成完成!'
            }
          }
        }
      }
      
    } catch (err) {
      console.error('图像轮询失败:', err)
      
      if (pollCount >= maxPolls) {
        error.value = '轮询超时，请检查服务器连接'
        stopPolling()
        isGenerating.value = false
        statusMessage.value = ''
      }
    }
  }, 3000) // 每3秒轮询一次
}

// 处理最新图像
function processLatestImage(imageData: any) {
  let imagePath = ''
  
  // 提取图像路径
  if (typeof imageData === 'string') {
    imagePath = imageData
  } else if (imageData && typeof imageData === 'object') {
    if (imageData.path) {
      imagePath = imageData.path
    } else if (imageData.url) {
      imagePath = imageData.url
    } else if (imageData.name) {
      imagePath = imageData.name
    }
  }
  
  if (imagePath) {
    console.log('发现图像路径:', imagePath)
    
    // 构建图片URL
    let imageUrl = imagePath
    
    if (!imageUrl.startsWith('http')) {
      if (imageUrl.startsWith('/')) {
        imageUrl = `http://localhost:7861${imageUrl}`
      } else {
        imageUrl = `http://localhost:7861/file=${imageUrl}`
      }
    }
    
    console.log('尝试加载图像:', imageUrl)
    
    // 验证图像
    const img = new Image()
    img.onload = () => {
      console.log('图像加载成功')
      generatedImage.value = imageUrl
    }
    img.onerror = () => {
      console.log('图像加载失败，尝试其他格式')
      // 尝试直接使用原始路径
      if (imagePath.startsWith('/')) {
        generatedImage.value = `http://localhost:7861${imagePath}`
      }
    }
    img.src = imageUrl
  }
}

// 停止轮询
function stopPolling() {
  if (pollingInterval.value) {
    clearInterval(pollingInterval.value)
    pollingInterval.value = null
  }
}

// 下载图像
function downloadImage() {
  if (!generatedImage.value) return
  
  const link = document.createElement('a')
  link.href = generatedImage.value
  link.download = `generated-image-${Date.now()}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// 清除结果
function clearResult() {
  generatedImage.value = ''
  taskDetails.value = ''
  error.value = ''
}

// 组件卸载时清理
onUnmounted(() => {
  stopPolling()
})
</script>



<style scoped>
.image-generator {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

.generator-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
}

@media (max-width: 1024px) {
  .generator-container {
    grid-template-columns: 1fr;
  }
}

.input-section, .result-section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

h2, h3 {
  color: #333;
  margin-bottom: 20px;
}

h2 {
  font-size: 24px;
}

h3 {
  font-size: 20px;
  border-bottom: 2px solid #f0f0f0;
  padding-bottom: 10px;
}

.form-group {
  margin-bottom: 20px;
}

label {
  display: block;
  font-weight: 500;
  color: #555;
  margin-bottom: 8px;
  font-size: 14px;
}

textarea, input[type="number"], select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

textarea:focus, input[type="number"]:focus, select:focus {
  outline: none;
  border-color: #4a90e2;
  box-shadow: 0 0 0 2px rgba(74, 144, 226, 0.1);
}

textarea {
  resize: vertical;
  min-height: 80px;
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  margin-right: 20px;
  margin-bottom: 10px;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: auto;
  margin-right: 8px;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}

.generate-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 12px 30px;
  font-size: 16px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  width: 100%;
  margin-top: 10px;
}

.generate-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.generate-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
  transform: none;
}

.generate-btn:active:not(:disabled) {
  transform: translateY(0);
}

.loading {
  text-align: center;
  padding: 30px 20px;
  background: #f8f9fa;
  border-radius: 8px;
  margin: 20px 0;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error {
  background: #fee;
  color: #c33;
  padding: 12px;
  border-radius: 6px;
  margin: 20px 0;
  border: 1px solid #fcc;
}

.image-result {
  text-align: center;
  margin: 20px 0;
}

.generated-image {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  margin-bottom: 20px;
  max-height: 500px;
  object-fit: contain;
}

.image-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.image-actions button {
  padding: 8px 20px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
}

.image-actions button:hover {
  background: #f5f5f5;
  border-color: #999;
}

.image-actions button:first-child {
  background: #4a90e2;
  color: white;
  border-color: #4a90e2;
}

.image-actions button:first-child:hover {
  background: #357ae8;
}

.task-details {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #eee;
}

.task-details h4 {
  color: #666;
  font-size: 14px;
  margin-bottom: 8px;
  font-weight: 600;
}

.task-details pre {
  background: #f8f9fa;
  padding: 12px;
  border-radius: 6px;
  font-size: 12px;
  color: #333;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 200px;
  overflow-y: auto;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}
</style>