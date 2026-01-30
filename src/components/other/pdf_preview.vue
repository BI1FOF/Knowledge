<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import type { Ref } from 'vue'

const props = defineProps<{
    filePath: string
    fileName: string
}>()

const currentPage = ref(1)
const totalPages = ref(0)
const zoom = ref(1)
const loading = ref(false)
const error = ref(false)
const loadProgress = ref(0)
const pdfDoc = ref(null) as any

const canvasEl: Ref<HTMLCanvasElement | null> = ref(null)

// 修复：使用正确的 PDF.js 配置
// 声明全局 window 扩展以修复 TypeScript 报错
declare global {
  interface Window {
    pdfjsLib?: any
  }
}


async function initPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib

  const makePublicUrl = (name: string) => new URL(name, window.location.href).href

  const loadScript = (url: string, module = false) => new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    if (module) s.type = 'module'
    s.src = url
    s.onload = () => resolve()
    s.onerror = (e) => reject(e)
    document.head.appendChild(s)
  })

  // 1) 优先尝试使用 public 下的 UMD 构建 (pdf.min.js)
  try {
    const pdfJsUrl = makePublicUrl('pdf.min.js')
    const pdfWorkerUrl = makePublicUrl('pdf.worker.min.js')
    await loadScript(pdfJsUrl)
    if ((window as any).pdfjsLib) {
      try { (window as any).__pdfjsLoadedVia = 'umd' } catch (e) { /* ignore */ }
      try {
        const gw = (window.pdfjsLib as any).GlobalWorkerOptions
        if (gw && typeof gw === 'object') {
          gw.workerSrc = pdfWorkerUrl
        } else {
          try { (window.pdfjsLib as any).GlobalWorkerOptions = { workerSrc: pdfWorkerUrl } } catch (e) { /* ignore if read-only */ }
        }
      } catch (e) {
        console.warn('设置 UMD pdfjsLib.GlobalWorkerOptions 失败，可能为只读:', e)
      }
      console.log('PDF.js 已通过 public UMD 脚本加载', { hasGlobal: true, version: (window.pdfjsLib as any)?.version })
      return (window.pdfjsLib as any)
    } else {
      console.warn('UMD 公共脚本加载后未在 window 上暴露 pdfjsLib，尝试 mjs 动态导入...')
    }
  } catch (err) {
    console.warn('通过 public UMD 脚本加载 PDF.js 失败:', err)
  }

  // 2) 尝试动态导入 public 下的 mjs（模块），避免将 mjs 通过普通 script 注入导致 import.meta 报错
  try {
    const pdfModuleUrl = makePublicUrl('pdf.min.mjs')
    // 使用动态 import 加载模块以支持 import.meta
    const imported = await import(/* @vite-ignore */ pdfModuleUrl)
    const pdfjsLib = (imported as any).default || imported
    const pdfWorkerUrl = makePublicUrl('pdf.worker.min.mjs')
    try {
      const gw = (pdfjsLib as any).GlobalWorkerOptions
      if (gw && typeof gw === 'object') {
        gw.workerSrc = pdfWorkerUrl
      } else {
        try { (pdfjsLib as any).GlobalWorkerOptions = { workerSrc: pdfWorkerUrl } } catch (e) { /* ignore */ }
      }
    } catch (e) {
      console.warn('设置 mjs pdfjsLib.GlobalWorkerOptions 失败，可能为只读:', e)
    }
    try { (window as any).__pdfjsLoadedVia = 'mjs' } catch (e) { /* ignore */ }
    window.pdfjsLib = pdfjsLib
    console.log('PDF.js 已通过 public mjs 动态导入加载', { version: (pdfjsLib as any)?.version })
    return pdfjsLib
  } catch (err) {
    console.warn('通过 public mjs 动态导入失败，回退到 npm 包导入:', err)
  }

  // 3) 回退：从 node_modules 导入 pdfjs-dist
  try {
    const imported = await import('pdfjs-dist')
    const pdfjsLib = (imported as any).default || imported
    try {
      const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.min?url')
      try {
        const gw = (pdfjsLib as any).GlobalWorkerOptions
        const workerUrl = (pdfjsWorker as any).default || pdfjsWorker
        if (gw && typeof gw === 'object') {
          gw.workerSrc = workerUrl
        } else {
          try { (pdfjsLib as any).GlobalWorkerOptions = { workerSrc: workerUrl } } catch (e) { /* ignore */ }
        }
      } catch (e) {
        console.warn('设置 npm 导入的 pdfjsLib.GlobalWorkerOptions 失败:', e)
      }
    } catch (e) {
      try { (pdfjsLib as any).GlobalWorkerOptions = { workerSrc: '' } } catch (ee) { /* ignore */ }
    }
    try { (window as any).__pdfjsLoadedVia = 'npm' } catch (e) { /* ignore */ }
    window.pdfjsLib = pdfjsLib
    console.log('PDF.js 初始化成功 (模块导入回退)', { version: (pdfjsLib as any)?.version })
    return pdfjsLib
  } catch (err) {
    console.error('初始化PDF.js失败:', err)
    throw err
  }
}

// 加载PDF文档
async function loadPdf() {
  loading.value = true
  error.value = false
  loadProgress.value = 0
  
  try {
    const pdfjsLib = await initPdfJs()
    console.log('initPdfJs result', { pdfjsLibType: typeof pdfjsLib, hasPDFDocument: !!(pdfjsLib as any)?.PDFDocumentProxy })
    
    if (!props.filePath) {
      throw new Error('文件路径为空')
    }

    // 通过主进程读取二进制数据
    const pdfData = await window.ipcRenderer.invoke('readFileBinary', props.filePath)
    console.log('readFileBinary result type', { t: Object.prototype.toString.call(pdfData), len: (pdfData && (pdfData as any).length) })
    if (!pdfData) {
      throw new Error('无法读取PDF文件')
    }

    // 转换为 Uint8Array
    let uint8Array: Uint8Array
    if (pdfData instanceof ArrayBuffer) {
      uint8Array = new Uint8Array(pdfData)
    } else if (ArrayBuffer.isView(pdfData)) {
      uint8Array = new Uint8Array((pdfData as any).buffer || pdfData)
    } else if ((pdfData as any).data && (pdfData as any).data instanceof Array) {
      uint8Array = new Uint8Array((pdfData as any).data)
    } else {
      try {
        uint8Array = new Uint8Array(pdfData as any)
      } catch (e) {
        throw new Error('无法将读取的数据转换为 Uint8Array: ' + e)
      }
    }
    console.log('Uint8Array created, length=', uint8Array.length)
    
    // 如果通过 UMD script 注入加载 pdf.js，避免启用 worker（可能与 worker 构建不兼容，导致私有字段错误）
    const loadedVia = (window as any).__pdfjsLoadedVia
    const useWorkerFlag = loadedVia === 'umd' ? false : true
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      useWorker: useWorkerFlag,
      isEvalSupported: false,
      disableFontFace: false,
      // 进度回调
      onProgress: (progress: any) => {
        if (progress.total > 0) {
          loadProgress.value = Math.round((progress.loaded / progress.total) * 100)
        }
      }
    })
    
    pdfDoc.value = await loadingTask.promise
    totalPages.value = pdfDoc.value.numPages
    console.log('PDF document loaded', { numPages: totalPages.value, pdfDocType: typeof pdfDoc.value })
    loadProgress.value = 100
    
    await calculateInitialZoom()
    await renderPage(currentPage.value)
    
  } catch (err) {
    console.error('加载PDF失败:', err)
    error.value = true
    
    // 降级方案：显示下载链接
    console.log('PDF渲染失败，提供下载链接')
  } finally {
    loading.value = false
  }
}

// 计算初始缩放比例
async function calculateInitialZoom() {
  if (!pdfDoc.value || !canvasEl.value) return
  
  try {
    const page = await pdfDoc.value.getPage(1)
    const viewport = page.getViewport({ scale: 1 })
    const container = canvasEl.value.parentElement
    
    if (container) {
      const containerWidthPx = container.clientWidth - 40
      const calculatedZoom = containerWidthPx / viewport.width
      zoom.value = Math.min(Math.max(calculatedZoom, 0.5), 2)
    }
  } catch (err) {
    console.error('计算缩放比例失败:', err)
    zoom.value = 1
  }
}

// 渲染PDF页面
async function renderPage(pageNumber: number) {
  if (!pdfDoc.value || !canvasEl.value) return
  
  try {
    console.log('renderPage start', { pageNumber })
    const page = await pdfDoc.value.getPage(pageNumber)
    const canvas = canvasEl.value
    const context = canvas.getContext('2d')
    
    if (!context) {
      throw new Error('无法获取canvas上下文')
    }

    const viewport = page.getViewport({ scale: zoom.value })
    console.log('page viewport', { width: viewport.width, height: viewport.height, scale: zoom.value })
    
    // 设置DPI以提高清晰度
    const dpi = window.devicePixelRatio || 1
    canvas.style.height = viewport.height + 'px'
    canvas.style.width = viewport.width + 'px'
    canvas.height = Math.round(viewport.height * dpi)
    canvas.width = Math.round(viewport.width * dpi)
    console.log('canvas sizes set', { cssWidth: canvas.style.width, cssHeight: canvas.style.height, pixelWidth: canvas.width, pixelHeight: canvas.height, dpi })
    
    context.setTransform(dpi, 0, 0, dpi, 0, 0)
    
    // 设置白色背景
    context.fillStyle = 'white'
    context.fillRect(0, 0, viewport.width, viewport.height)
    
    const renderContext = {
      canvasContext: context,
      viewport: viewport
    }
    
    await page.render(renderContext).promise
    
    console.log(`第 ${pageNumber} 页渲染完成`) 
    // small delay to allow browser to composite
    setTimeout(() => console.log('renderPage complete (delayed check)'))
    
  } catch (err) {
    console.error(`渲染第${pageNumber}页失败:`, err)
    error.value = true
  }
}

// 翻页功能
async function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--
    await renderPage(currentPage.value)
  }
}

async function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    await renderPage(currentPage.value)
  }
}

// 缩放功能
async function zoomIn() {
  if (zoom.value < 3) {
    zoom.value = Math.min(3, zoom.value + 0.1)
    await renderPage(currentPage.value)
  }
}

async function zoomOut() {
  if (zoom.value > 0.3) {
    zoom.value = Math.max(0.3, zoom.value - 0.1)
    await renderPage(currentPage.value)
  }
}

// 适合宽度
async function fitWidth() {
  if (!pdfDoc.value || !canvasEl.value) return
  
  try {
    const page = await pdfDoc.value.getPage(currentPage.value)
    const viewport = page.getViewport({ scale: 1 })
    const container = canvasEl.value.parentElement
    
    if (container) {
      const containerWidthPx = container.clientWidth - 40
      zoom.value = containerWidthPx / viewport.width
      await renderPage(currentPage.value)
    }
  } catch (err) {
    console.error('适合宽度操作失败:', err)
  }
}

// 监听文件路径变化
watch(() => props.filePath, (newPath) => {
  if (newPath) {
    pdfDoc.value = null
    currentPage.value = 1
    zoom.value = 1
    loadPdf()
  }
})

// 监听缩放变化
watch(zoom, async () => {
  if (pdfDoc.value && currentPage.value > 0) {
    await renderPage(currentPage.value)
  }
})

// 监听当前页变化
watch(currentPage, async (newPage) => {
  if (pdfDoc.value && newPage > 0) {
    await renderPage(newPage)
  }
})

// 监听窗口大小变化
const handleResize = () => {
  if (pdfDoc.value) {
    nextTick(() => {
      // 响应式布局逻辑
    })
  }
}

onMounted(() => {
  if (props.filePath) {
    loadPdf()
  }
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (pdfDoc.value) {
    pdfDoc.value.destroy()
  }
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <div class="pdf-preview">
    <div class="pdf-header">
      <span>PDF Preview: {{ fileName }}</span>
      <div class="pdf-controls">
        <button @click="prevPage" :disabled="currentPage <= 1">←</button>
        <span>第 {{ currentPage }} 页 / 共 {{ totalPages }} 页</span>
        <button @click="nextPage" :disabled="currentPage >= totalPages">→</button>
        <button @click="zoomOut" :disabled="zoom <= 0.5">-</button>
        <span>{{ Math.round(zoom * 100) }}%</span>
        <button @click="zoomIn" :disabled="zoom >= 2">+</button>
        <button @click="fitWidth" title="适合宽度">📏</button>
      </div>
    </div>
    <div class="pdf-content">
      <div v-if="loading" class="loading">
        <div>Loading PDF...</div>
        <div v-if="loadProgress > 0" class="progress">{{ loadProgress }}%</div>
      </div>
      <div v-else-if="error" class="error">
        <div>Failed to load PDF</div>
        <div class="fallback-options">
          <button @click="loadPdf" class="retry-btn">重试</button>
          <a :href="'file://' + filePath" download class="download-btn" target="_blank">
            下载PDF
          </a>
        </div>
      </div>
      <div v-else class="pages-container">
        <canvas 
          ref="canvasEl"
          class="page-canvas"
        />
        <div class="page-info">
          <span>第 {{ currentPage }} 页 / 共 {{ totalPages }} 页</span>
          <span>缩放: {{ Math.round(zoom * 100) }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pdf-preview {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f8f9fa;
}

.pdf-header {
  padding: 8px 12px;
  border-bottom: 1px solid var(--borderColor);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--menuColor);
  font-size: 12px;
  flex-shrink: 0;
}

.pdf-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pdf-controls button {
  padding: 4px 8px;
  border: 1px solid var(--borderColor);
  background: var(--backgroundColor);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  min-width: 32px;
}

.pdf-controls button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pdf-controls button:hover:not(:disabled) {
  background: var(--menuColor);
}

.pdf-content {
  flex: 1;
  overflow: auto;
  padding: 20px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background: #f5f5f5;
}

.loading, .error {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: var(--fontColor);
  flex-direction: column;
  gap: 12px;
}

.progress {
  font-size: 14px;
  color: #666;
}

.fallback-options {
  display: flex;
  gap: 12px;
}

.retry-btn, .download-btn {
  padding: 8px 16px;
  border: 1px solid var(--borderColor);
  background: var(--backgroundColor);
  border-radius: 4px;
  cursor: pointer;
  text-decoration: none;
  color: inherit;
  display: inline-block;
}

.retry-btn:hover, .download-btn:hover {
  background: var(--menuColor);
}

.pages-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  max-width: 100%;
}

.page-canvas {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 1px solid #ddd;
  background: white;
  max-width: 100%;
  height: auto;
}

.page-info {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #666;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 16px;
  border: 1px solid #ddd;
}
</style>