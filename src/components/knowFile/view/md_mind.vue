<script setup lang="ts">
import { ref, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { usestore } from '../../../store'
import { Transformer } from 'markmap-lib'
import * as markmap from 'markmap-view'

const store = usestore()

let id = ref("mindmap" + Date.now())
let map = null as any
const containerRef = ref<HTMLElement | null>(null)

// 状态变量
let colorMode = ref('color') // 'color' 或 'monochrome'

const init = async function() {
  await nextTick()
  if (!containerRef.value || !document.getElementById(id.value)) return
  
  // 清空容器
  const svgElement = document.getElementById(id.value)!
  svgElement.innerHTML = ""
  
  let markdown = store.data[store.index].content
  const transformer = new Transformer()
  const { root, features } = transformer.transform(markdown)

  const { Markmap } = markmap

  // 创建 markmap，使用默认彩色
  const options = {
    duration: 500,
    nodeMinHeight: 16,
    spacingVertical: 10,
    spacingHorizontal: 80,
    paddingX: 10,
    autoFit: true,
    fitRatio: 0.95,
    zoom: true,
    pan: true,
    initialExpandLevel: 2,
    maxWidth: () => {
      return containerRef.value ? containerRef.value.clientWidth - 40 : 800
    }
  } as any

  map = Markmap.create('#' + id.value, options, root)
  
  // 保存原始数据引用
  if (!map.state) map.state = {}
  map.state.data = root
  
  // 应用样式（但不覆盖颜色）
  setTimeout(() => {
    applyCustomStyles()
  }, 100)
  
  // 监听主题变化
  const observer = new MutationObserver(() => {
    if (map) {
      applyCustomStyles()
    }
  })
  
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['style', 'class']
  })
  
  window.addEventListener('resize', handleResize)
}

// 切换颜色模式
const toggleColorMode = async function() {
  colorMode.value = colorMode.value === 'color' ? 'monochrome' : 'color'
  
  if (colorMode.value === 'monochrome') {
    // 切换到单色模式
    applyMonochromeTheme()
  } else {
    // 切换回彩色模式，重新初始化让 markmap 恢复默认彩色
    await init()
  }
}

// 应用单色主题
function applyMonochromeTheme() {
  const svgElement = document.getElementById(id.value)
  if (!svgElement) return
  
  const rootStyle = getComputedStyle(document.documentElement)
  const monoColor = rootStyle.getPropertyValue('--fontActiveColor') || '#42b883'
  
  // 统一所有线条颜色
  const links = svgElement.querySelectorAll('.markmap-link')
  links.forEach(link => {
    link.setAttribute('stroke', monoColor)
  })
  
  // 统一节点线条
  const nodeLines = svgElement.querySelectorAll('.markmap-node line')
  nodeLines.forEach(line => {
    line.setAttribute('stroke', monoColor)
  })
  
  // 统一箭头颜色
  const arrows = svgElement.querySelectorAll('.markmap-arrow')
  arrows.forEach(arrow => {
    arrow.setAttribute('fill', monoColor)
    arrow.setAttribute('stroke', monoColor)
  })
  
  // 统一节点圆圈颜色
  const circles = svgElement.querySelectorAll('.markmap-node circle')
  circles.forEach(circle => {
    circle.setAttribute('stroke', monoColor)
  })
  
  // 统一文字颜色
  const texts = svgElement.querySelectorAll('.markmap-node text')
  const textColor = rootStyle.getPropertyValue('--fontColor') || '#333'
  texts.forEach(text => {
    text.setAttribute('fill', textColor)
  })
}

// 展开到指定级别
const expandToLevel = async function(level: number) {
  if (!containerRef.value || !document.getElementById(id.value)) return
  
  // 清空容器
  const svgElement = document.getElementById(id.value)!
  svgElement.innerHTML = ""
  
  // 获取当前内容
  const markdown = store.data[store.index].content
  const transformer = new Transformer()
  const { root } = transformer.transform(markdown)
  
  // 根据级别设置展开选项
  let expandLevel = level
  if (level === 0) expandLevel = 1 // 至少展开1级
  
  const { Markmap } = markmap
  const options = {
    duration: 500,
    nodeMinHeight: 16,
    spacingVertical: 10,
    spacingHorizontal: 80,
    paddingX: 10,
    autoFit: true,
    fitRatio: 0.95,
    zoom: true,
    pan: true,
    initialExpandLevel: expandLevel, // 使用指定的展开级别
    maxWidth: () => {
      return containerRef.value ? containerRef.value.clientWidth - 40 : 800
    }
  } as any
  
  // 销毁旧实例
  if (map) {
    map.destroy()
  }
  
  // 创建新实例
  map = Markmap.create('#' + id.value, options, root)
  
  // 保存数据引用
  if (!map.state) map.state = {}
  map.state.data = root
  
  // 应用样式
  setTimeout(() => {
    applyCustomStyles()
    // 如果当前是单色模式，重新应用
    if (colorMode.value === 'monochrome') {
      applyMonochromeTheme()
    }
  }, 100)
}

// 应用自定义样式（不覆盖颜色）
function applyCustomStyles() {
  const svgElement = document.getElementById(id.value)
  if (!svgElement) return
  
  // 创建样式元素
  let styleElement = document.getElementById('markmap-custom-styles')
  if (!styleElement) {
    styleElement = document.createElement('style')
    styleElement.id = 'markmap-custom-styles'
    document.head.appendChild(styleElement)
  }
  
  // 获取当前主题颜色
  const rootStyle = getComputedStyle(document.documentElement)
  const backgroundColor = rootStyle.getPropertyValue('--backgroundColor') || '#fff'
  const textColor = rootStyle.getPropertyValue('--fontColor') || '#333'
  const borderColor = rootStyle.getPropertyValue('--borderColor') || '#ccc'
  
  // 只修复布局相关样式，不覆盖颜色
  styleElement.textContent = `
    /* 确保文本有透明背景 */
    #${id.value} .markmap-foreign {
      background-color: transparent !important;
      overflow: visible !important;
    }
    
    /* 修复文字颜色使用主题色 */
    #${id.value} .markmap-node text {
      fill: ${textColor} !important;
      stroke: none !important;
    }
    
    /* 修复文字背景 */
    #${id.value} .markmap-node-text-bg {
      fill: ${backgroundColor} !important;
      stroke: ${backgroundColor} !important;
    }
    
    /* 修复节点圆圈背景 */
    #${id.value} .markmap-node circle {
      fill: ${backgroundColor} !important;
      stroke: ${borderColor} !important;
      stroke-width: 2px !important;
    }
    
    /* 悬停效果 */
    #${id.value} .markmap-node:hover circle {
      fill: ${textColor} !important;
      stroke: ${textColor} !important;
    }
  `
}

function update() {
  if (!map || !store.data[store.index]) return
  
  let markdown = store.data[store.index].content
  const transformer = new Transformer()
  const { root } = transformer.transform(markdown)
  
  map.setData(root)
  map.state.data = root
  
  requestAnimationFrame(() => {
    map.fit()
    setTimeout(() => {
      if (map && map.fit) {
        map.fit()
      }
      // 如果当前是单色模式，重新应用
      if (colorMode.value === 'monochrome') {
        setTimeout(() => applyMonochromeTheme(), 50)
      }
    }, 100)
  })
}

// 处理窗口大小变化
function handleResize() {
  if (map && map.fit) {
    requestAnimationFrame(() => {
      map.fit()
    })
  }
}

// 监听索引变化
watch(() => store.index, () => {
  update()
})

// 监听内容变化
watch(() => store.data[store.index]?.content, () => {
  if (map) update()
})

onMounted(() => {
  init()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  const styleElement = document.getElementById('markmap-custom-styles')
  if (styleElement) {
    styleElement.remove()
  }
  if (map) {
    map.destroy()
  }
})
</script>
  
<template>
  <div class="mindmap-container" v-if="store.data[store.index] != undefined">
    <div class="mindmap" @contextmenu.prevent="" ref="containerRef">
      <svg :id="id" class="mindmap-svg"></svg>
      <div class="btns">
        <!-- 刷新按钮 -->
        <i @click="init" class="btn fa fa-refresh" :title="store.locales=='zh'?'刷新思维导图':'Refresh'"></i>
        
        <!-- 适应窗口按钮 -->
        <i @click="map && map.fit()" class="btn fa fa-arrows-alt" :title="store.locales=='zh'?'适应窗口':'Fit to Window'"></i>
        
        <!-- 颜色模式切换按钮 -->
        <i @click="toggleColorMode" class="btn" :class="colorMode === 'color' ? 'fa fa-paint-brush' : 'fa fa-adjust'" 
           :title="colorMode === 'color' ? (store.locales=='zh'?'转换为单色':'Switch to Monochrome') : (store.locales=='zh'?'转换为彩色':'Switch to Color')"></i>
        
        <!-- 分隔线 -->
        <span class="separator"></span>
        <i @click="expandToLevel(2)" class="btn" :title="store.locales=='zh'?'展开一级':'Expand to Level 1'">
          <span class="level-text">1</span>
        </i>
        <i @click="expandToLevel(3)" class="btn" :title="store.locales=='zh'?'展开二级':'Expand to Level 2'">
          <span class="level-text">2</span>
        </i>
        <i @click="expandToLevel(4)" class="btn" :title="store.locales=='zh'?'展开三级':'Expand to Level 3'">
          <span class="level-text">3</span>
        </i>
        <i @click="expandToLevel(5)" class="btn" :title="store.locales=='zh'?'展开三级':'Expand to Level 3'">
          <span class="level-text">4</span>
        </i>
        <i @click="expandToLevel(6)" class="btn" :title="store.locales=='zh'?'展开四级':'Expand to Level 4'">
          <span class="level-text">5</span>
        </i>
        <i @click="expandToLevel(999)" class="btn fa fa-expand" :title="store.locales=='zh'?'全部展开':'Expand All'"></i>
      </div>
    </div>
  </div>
</template>
  
<style scoped>
.mindmap-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  flex: 1;
}

.mindmap {
  position: relative;
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--backgroundColor);
}

.mindmap-svg {
  width: 100%;
  height: 100%;
  flex: 1;
  min-height: 0;
  display: block;
  overflow: visible;
}

/* 按钮容器 */
.btns {
  position: absolute;
  right: 5px;
  top: 5px;
  z-index: 10;
  display: flex;
  gap: 2px;
  background-color: var(--menuColor);
  padding: 2px;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border: 1px solid var(--borderColor);
  align-items: center;
}

.btn {
  cursor: pointer;
  font-size: 14px;
  color: var(--fontColor);
  opacity: 0.8;
  transition: all 0.2s ease;
  padding: 6px 2px;
  border-radius: 4px;
  min-width: 28px;
  text-align: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn:hover {
  opacity: 1;
  color: var(--fontActiveColor);
  background-color: var(--menuActiveColor);
  transform: translateY(-1px);
}

.btn:active {
  transform: translateY(0);
}

/* 级别数字样式 */
.level-text {
  font-size: 12px;
  font-weight: bold;
}

/* 分隔线 */
.separator {
  width: 1px;
  height: 20px;
  background-color: var(--borderColor);
  margin: 0 4px;
}

/* 暗色主题适配 */
@media (prefers-color-scheme: dark) {
  .mindmap {
    background-color: var(--backgroundColor, #1a1a1a);
  }
  
  .btns {
    background-color: var(--menuColor, #2d2d2d);
    border-color: var(--borderColor, #404040);
  }
  
  .btn {
    color: var(--fontColor, #e0e0e0);
  }
  
  .btn:hover {
    color: var(--fontActiveColor, #42b883);
    background-color: var(--menuActiveColor, #3a3a3a);
  }
}
</style>