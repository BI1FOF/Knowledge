<script setup lang="ts">
import { ref, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { usestore } from '../../../store'
import { Transformer } from 'markmap-lib'
import * as markmap from 'markmap-view'

const store = usestore()

let id = ref("mindmap" + Date.now())
let map = null as any
const containerRef = ref<HTMLElement | null>(null)

const init = async function() {
  await nextTick()
  if (!containerRef.value || !document.getElementById(id.value)) return
  
  // 清空容器
  const svgElement = document.getElementById(id.value)!
  svgElement.innerHTML = ""
  
  let markdown = store.data[store.index].content
  const transformer = new Transformer()
  const { root, features } = transformer.transform(markdown)
  const { styles, scripts } = transformer.getUsedAssets(features)

  const { Markmap, loadCSS, loadJS } = markmap

  // 加载必要的脚本
  if (scripts) loadJS(scripts, { getMarkmap: () => markmap })

  // 创建 markmap，传递自定义选项
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
    },
    color: (node: any) => {
      // 为不同层级的节点设置颜色
      const depth = node.d || 0
      const rootStyle = getComputedStyle(document.documentElement)
      if (depth === 0) {
        return rootStyle.getPropertyValue('--fontActiveColor') || '#42b883'
      } else if (depth === 1) {
        return rootStyle.getPropertyValue('--fontColor') || '#333'
      } else {
        return rootStyle.getPropertyValue('--fontColor') || '#555'
      }
    }
  } as any

  map = Markmap.create('#' + id.value, options, root)
  
  // 应用自定义样式
  setTimeout(() => {
    applyCustomStyles()
  }, 100)
  
  // 监听主题变化
  const observer = new MutationObserver(() => {
    if (map) {
      updateTheme()
      applyCustomStyles()
    }
  })
  
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['style', 'class']
  })
  
  // 添加窗口大小变化的监听
  window.addEventListener('resize', handleResize)
}

// 应用自定义样式修复线条和文字问题
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
  const lineColor = rootStyle.getPropertyValue('--borderColor') || '#ccc'
  const arrowColor = rootStyle.getPropertyValue('--fontActiveColor') || '#42b883'
  const textColor = rootStyle.getPropertyValue('--fontColor') || '#333'
  const backgroundColor = rootStyle.getPropertyValue('--backgroundColor') || '#fff'
  
  // 修复样式的CSS
  styleElement.textContent = `
    /* 修复所有线条样式 - 确保颜色一致 */
    #${id.value} .markmap-link {
      fill: none !important;
      stroke: ${lineColor} !important;
      stroke-width: 2px !important;
      stroke-opacity: 1 !important;
    }
    
    /* 特别修复文字下方的横线（这是关键） */
    #${id.value} .markmap-node line {
      stroke: ${lineColor} !important;
      stroke-width: 2px !important;
    }
    
    /* 修复箭头样式 */
    #${id.value} .markmap-arrow {
      fill: ${arrowColor} !important;
      stroke: ${arrowColor} !important;
      stroke-width: 2px !important;
    }
    
    /* 确保文本有透明背景 */
    #${id.value} .markmap-foreign {
      background-color: transparent !important;
      overflow: visible !important;
    }
    
    /* 修复文字颜色 - 使用fontColor */
    #${id.value} .markmap-node text {
      fill: ${textColor} !important;
      stroke: none !important;
      paint-order: stroke;
    }
    
    #${id.value} .markmap-node-text {
      fill: ${textColor} !important;
    }
    
    /* 修复文字背景（避免遮挡线条） */
    #${id.value} .markmap-node-text-bg {
      fill: ${backgroundColor} !important;
      stroke: ${backgroundColor} !important;
    }
    
    /* 确保线条在文字背景下方 */
    #${id.value} .markmap-link {
      z-index: 1 !important;
    }
    
    #${id.value} .markmap-node line {
      z-index: 2 !important;
    }
    
    #${id.value} .markmap-foreign {
      z-index: 3 !important;
    }
    
    /* 修复节点圆圈样式 */
    #${id.value} .markmap-node circle {
      fill: ${backgroundColor} !important;
      stroke: ${lineColor} !important;
      stroke-width: 2px !important;
      r: 5px !important;
    }
    
    /* 悬停效果 */
    #${id.value} .markmap-node:hover circle {
      fill: ${arrowColor} !important;
      stroke: ${arrowColor} !important;
    }
    
    #${id.value} .markmap-node:hover line {
      stroke: ${arrowColor} !important;
    }
    
    /* 焦点节点 */
    #${id.value} .markmap-node.focused circle {
      fill: ${arrowColor} !important;
      stroke: ${arrowColor} !important;
    }
    
    #${id.value} .markmap-node.focused line {
      stroke: ${arrowColor} !important;
    }
    
    /* 选中的节点 */
    #${id.value} .markmap-node.selected circle {
      fill: ${arrowColor} !important;
      stroke: ${arrowColor} !important;
    }
    
    #${id.value} .markmap-node.selected line {
      stroke: ${arrowColor} !important;
    }
  `
}

// 更新主题颜色
function updateTheme() {
  if (!map) return
  
  // 重新应用自定义样式
  applyCustomStyles()
}

function update() {
  if (!map || !store.data[store.index]) return
  
  let markdown = store.data[store.index].content
  const transformer = new Transformer()
  const { root } = transformer.transform(markdown)
  
  map.setData(root)
  
  // 更新主题
  updateTheme()
  
  // 使用 requestAnimationFrame 确保 DOM 更新后再调整
  requestAnimationFrame(() => {
    map.fit()
    
    // 重新应用样式
    setTimeout(() => {
      if (map && map.fit) {
        map.fit()
        applyCustomStyles()
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
watch(() => store.index, (newValue, oldValue) => {
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
  // 清理事件监听
  window.removeEventListener('resize', handleResize)
  // 清理自定义样式
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
        <i @click="init" class="btn fa fa-refresh" title="刷新思维导图"></i>
        <i @click="map && map.fit()" class="btn fa fa-arrows-alt" title="适应窗口"></i>
      </div>
    </div>
  </div>
</template>
  
<style scoped>
.mindmap-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  flex:1;
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
  right: 10px;
  top: 10px;
  z-index: 10;
  display: flex;
  gap: 8px;
  background-color: var(--menuColor);
  padding: 6px 10px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--borderColor);
}

.btn {
  cursor: pointer;
  font-size: 16px;
  color: var(--fontColor);
  opacity: 0.8;
  transition: opacity 0.2s, transform 0.2s, background-color 0.2s;
  padding: 4px;
  border-radius: 3px;
}

.btn:hover {
  opacity: 1;
  color: var(--fontActiveColor);
  background-color: var(--menuActiveColor);
  transform: scale(1.1);
}

.btn:active {
  transform: scale(0.95);
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

/* 深度选择器覆盖Markmap样式 */
:deep(.markmap-node text) {
  fill: var(--fontColor) !important;
}

:deep(.markmap-node-text) {
  fill: var(--fontColor) !important;
}

/* 确保文字下方的横线与连接曲线颜色一致 */
:deep(.markmap-node line) {
  stroke: var(--borderColor) !important;
}

:deep(.markmap-link) {
  stroke: var(--borderColor) !important;
}

/* 鼠标悬停时保持一致 */
:deep(.markmap-node:hover line) {
  stroke: var(--fontActiveColor) !important;
}

:deep(.markmap-node:hover ~ .markmap-link) {
  stroke: var(--fontActiveColor) !important;
}

/* 修复背景色 */
:deep(.markmap-node-text-bg) {
  fill: var(--backgroundColor) !important;
  stroke: var(--backgroundColor) !important;
}
</style>