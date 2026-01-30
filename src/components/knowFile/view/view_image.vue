<script setup lang="ts">
  import { ref, onMounted, onBeforeUnmount, computed, nextTick } from 'vue'

  const props = defineProps<{
    path: string;
    enableDragging?: boolean; // 是否启用拖拽
    minScale?: number;        // 最小缩放比例
    maxScale?: number;        // 最大缩放比例
    wheelStep?: number;       // 滚轮缩放步长
    showControls?: boolean;   // 是否显示控制按钮
  }>()

  // 默认值
  const enableDragging = props.enableDragging ?? true
  const minScale = props.minScale ?? 0.1
  const maxScale = props.maxScale ?? 5
  const wheelStep = props.wheelStep ?? 0.1
  const showControls = props.showControls ?? true

  // 图片缩放相关变量
  const imgScale = ref(1) // 缩放比例
  const imgPosition = ref({ x: 0, y: 0 }) // 图片位置
  const isDragging = ref(false) // 是否正在拖拽
  const dragStart = ref({ x: 0, y: 0 }) // 拖拽开始位置
  const imgElement = ref<HTMLImageElement | null>(null) // 图片元素引用
  const containerElement = ref<HTMLDivElement | null>(null) // 容器元素引用
  
  // 边界检查变量
  const boundaries = ref({
    minX: 0,
    maxX: 0,
    minY: 0,
    maxY: 0
  })

  // 发射事件
  const emit = defineEmits<{
    reset: [];
    scaleChange: [scale: number];
    positionChange: [position: { x: number, y: number }];
  }>()

  // 计算可拖拽边界
  const calculateBoundaries = () => {
    if (!imgElement.value || !containerElement.value) return
    
    const containerRect = containerElement.value.getBoundingClientRect()
    const imgRect = imgElement.value.getBoundingClientRect()
    
    // 计算可拖拽的边界范围
    const scaledWidth = imgRect.width * imgScale.value
    const scaledHeight = imgRect.height * imgScale.value
    
    // 只有当图片尺寸大于容器时才允许拖拽
    if (scaledWidth > containerRect.width) {
      boundaries.value.minX = -(scaledWidth - containerRect.width) / 2
      boundaries.value.maxX = (scaledWidth - containerRect.width) / 2
    } else {
      boundaries.value.minX = boundaries.value.maxX = 0
    }
    
    if (scaledHeight > containerRect.height) {
      boundaries.value.minY = -(scaledHeight - containerRect.height) / 2
      boundaries.value.maxY = (scaledHeight - containerRect.height) / 2
    } else {
      boundaries.value.minY = boundaries.value.maxY = 0
    }
    
    // 限制当前位置在边界内
    imgPosition.value.x = Math.max(boundaries.value.minX, Math.min(boundaries.value.maxX, imgPosition.value.x))
    imgPosition.value.y = Math.max(boundaries.value.minY, Math.min(boundaries.value.maxY, imgPosition.value.y))
  }

  // 初始化图片缩放功能
  const setupImageZoom = () => {
    if (!imgElement.value) return
    
    // 重置样式
    imgElement.value.style.transform = `scale(${imgScale.value}) translate(${imgPosition.value.x}px, ${imgPosition.value.y}px)`
    imgElement.value.style.transformOrigin = 'center center'
    imgElement.value.style.transition = 'transform 0.1s ease'
    imgElement.value.style.cursor = imgScale.value > 1 && enableDragging ? 'grab' : 'default'
    
    // 计算边界
    calculateBoundaries()
  }
  
  // 处理滚轮缩放
  const handleWheel = (e: WheelEvent) => {
    if (!imgElement.value || !containerElement.value) return
    
    e.preventDefault()
    e.stopPropagation()
    
    const delta = e.deltaY > 0 ? -wheelStep : wheelStep
    const newScale = Math.max(minScale, Math.min(maxScale, imgScale.value + delta))
    
    // 计算缩放中心点
    const rect = containerElement.value.getBoundingClientRect()
    const mouseX = e.clientX - rect.left - rect.width / 2
    const mouseY = e.clientY - rect.top - rect.height / 2
    
    // 调整位置以保持缩放中心
    const scaleRatio = newScale / imgScale.value
    const newX = imgPosition.value.x * scaleRatio + mouseX * (scaleRatio - 1)
    const newY = imgPosition.value.y * scaleRatio + mouseY * (scaleRatio - 1)
    
    imgScale.value = newScale
    imgPosition.value = { x: newX, y: newY }
    
    updateImageTransform()
    calculateBoundaries()
    emit('scaleChange', imgScale.value)
    emit('positionChange', imgPosition.value)
    
    // 更新光标样式
    if (imgElement.value) {
      imgElement.value.style.cursor = imgScale.value > 1 && enableDragging ? 'grab' : 'default'
    }
  }
  
  // 开始拖拽
  const startDrag = (e: MouseEvent) => {
    if (!imgElement.value || !containerElement.value || !enableDragging || imgScale.value <= 1) return
    
    e.preventDefault()
    e.stopPropagation()
    
    isDragging.value = true
    dragStart.value = { x: e.clientX - imgPosition.value.x, y: e.clientY - imgPosition.value.y }
    
    if (imgElement.value) {
      imgElement.value.style.cursor = 'grabbing'
      imgElement.value.style.transition = 'none'
    }
    
    // 添加全局拖拽监听
    document.addEventListener('mousemove', onDrag)
    document.addEventListener('mouseup', stopDrag)
    // 防止选中文本
    document.addEventListener('selectstart', preventSelection)
  }
  
  // 拖拽中
  const onDrag = (e: MouseEvent) => {
    if (!isDragging.value || !imgElement.value || !containerElement.value) return
    
    e.preventDefault()
    
    // 计算新位置
    let newX = e.clientX - dragStart.value.x
    let newY = e.clientY - dragStart.value.y
    
    // 限制在边界内
    newX = Math.max(boundaries.value.minX, Math.min(boundaries.value.maxX, newX))
    newY = Math.max(boundaries.value.minY, Math.min(boundaries.value.maxY, newY))
    
    imgPosition.value = { x: newX, y: newY }
    
    updateImageTransform()
  }
  
  // 停止拖拽
  const stopDrag = (e?: MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    
    isDragging.value = false
    if (imgElement.value) {
      imgElement.value.style.cursor = imgScale.value > 1 && enableDragging ? 'grab' : 'default'
      imgElement.value.style.transition = 'transform 0.1s ease'
    }
    
    // 清理事件监听
    document.removeEventListener('mousemove', onDrag)
    document.removeEventListener('mouseup', stopDrag)
    document.removeEventListener('selectstart', preventSelection)
    
    // 如果拖拽结束，触发位置变化事件
    if (e) {
      emit('positionChange', imgPosition.value)
    }
  }
  
  // 防止选中文本
  const preventSelection = (e: Event) => {
    e.preventDefault()
  }
  
  // 更新图片变换
  const updateImageTransform = () => {
    if (!imgElement.value) return
    
    imgElement.value.style.transform = `scale(${imgScale.value}) translate(${imgPosition.value.x}px, ${imgPosition.value.y}px)`
  }
  
  // 重置图片缩放
  const resetImageZoom = () => {
    imgScale.value = 1
    imgPosition.value = { x: 0, y: 0 }
    if (imgElement.value) {
      imgElement.value.style.transform = 'scale(1) translate(0px, 0px)'
      imgElement.value.style.cursor = 'default'
    }
    calculateBoundaries()
    emit('reset')
    emit('scaleChange', 1)
    emit('positionChange', imgPosition.value)
  }
  
  // 放大
  const zoomIn = () => {
    if (!imgElement.value || !containerElement.value) return
    
    const newScale = Math.min(maxScale, imgScale.value + 0.2)
    const scaleRatio = newScale / imgScale.value
    
    // 计算基于中心的缩放
    const newX = imgPosition.value.x * scaleRatio
    const newY = imgPosition.value.y * scaleRatio
    
    imgScale.value = newScale
    imgPosition.value = { x: newX, y: newY }
    
    updateImageTransform()
    calculateBoundaries()
    emit('scaleChange', imgScale.value)
    emit('positionChange', imgPosition.value)
    
    if (imgElement.value) {
      imgElement.value.style.cursor = imgScale.value > 1 && enableDragging ? 'grab' : 'default'
    }
  }
  
  // 缩小
  const zoomOut = () => {
    if (!imgElement.value || !containerElement.value) return
    
    const newScale = Math.max(minScale, imgScale.value - 0.2)
    const scaleRatio = newScale / imgScale.value
    
    // 计算基于中心的缩放
    const newX = imgPosition.value.x * scaleRatio
    const newY = imgPosition.value.y * scaleRatio
    
    imgScale.value = newScale
    imgPosition.value = { x: newX, y: newY }
    
    updateImageTransform()
    calculateBoundaries()
    emit('scaleChange', imgScale.value)
    emit('positionChange', imgPosition.value)
    
    if (imgElement.value && imgScale.value <= 1) {
      imgElement.value.style.cursor = 'default'
    }
  }
  
  // 在图片加载完成后设置缩放功能
  const onImageLoad = async (el: HTMLImageElement) => {
    imgElement.value = el
    await nextTick()
    setupImageZoom()
  }
  
  // 双击重置
  const handleDoubleClick = () => {
    resetImageZoom()
  }
  
  // 处理容器鼠标按下事件（防止拖拽时移出图片）
  const handleContainerMouseDown = (e: MouseEvent) => {
    // 只有在图片上点击时才启动拖拽
    if (!imgElement.value || e.target !== imgElement.value) {
      return
    }
    startDrag(e)
  }
  
  // 监听键盘快捷键
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl + 滚轮或 Ctrl + +/- 缩放
    if (e.ctrlKey) {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === '+' || e.key === '=') {
        zoomIn()
      } else if (e.key === '-' || e.key === '_') {
        zoomOut()
      } else if (e.key === '0') {
        resetImageZoom()
      }
    }
    // ESC 键重置
    else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      resetImageZoom()
    }
  }
  
  // 处理容器鼠标离开
  const handleContainerMouseLeave = (e: MouseEvent) => {
    // 如果正在拖拽且鼠标离开容器，停止拖拽
    if (isDragging.value) {
      stopDrag(e)
    }
  }
  
  onMounted(() => {
    // 添加键盘事件监听
    window.addEventListener('keydown', handleKeyDown)
  })
  
  onBeforeUnmount(() => {
    // 清理事件监听
    stopDrag()
    window.removeEventListener('keydown', handleKeyDown)
  })
</script>

<template>
  <div class="image-container" 
       ref="containerElement"
       @dblclick="handleDoubleClick"
       @wheel="handleWheel"
       @mousedown="handleContainerMouseDown"
       @mouseleave="handleContainerMouseLeave"
       style="position: relative; width: 100%; height: 100%; overflow: hidden; user-select: none; -webkit-user-drag: none;">
    
    <!-- 缩放控制按钮 -->
    <div v-if="showControls && imgScale > 1" class="zoom-controls" 
         style="position: absolute; top: 10px; right: 10px; z-index: 1000; display: flex; gap: 5px; pointer-events: auto;">
      <button @click.stop="zoomIn" 
              title="放大 (Ctrl + +)"
              style="width: 30px; height: 30px; border-radius: 50%; background: rgba(0,0,0,0.7); color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; pointer-events: auto;">
        <i class="fa fa-search-plus" style="font-size: 12px;"></i>
      </button>
      <button @click.stop="zoomOut" 
              title="缩小 (Ctrl + -)"
              style="width: 30px; height: 30px; border-radius: 50%; background: rgba(0,0,0,0.7); color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; pointer-events: auto;">
        <i class="fa fa-search-minus" style="font-size: 12px;"></i>
      </button>
      <button @click.stop="resetImageZoom" 
              title="重置 (Ctrl + 0 或 ESC 或 双击)"
              style="width: 30px; height: 30px; border-radius: 50%; background: rgba(0,0,0,0.7); color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; pointer-events: auto;">
        <i class="fa fa-undo" style="font-size: 12px;"></i>
      </button>
    </div>
    
    <!-- 缩放提示 -->
    <div v-if="imgScale > 1" class="zoom-hint" 
         style="position: absolute; bottom: 10px; left: 10px; background: rgba(0,0,0,0.7); color: white; padding: 5px 10px; border-radius: 4px; font-size: 12px; pointer-events: none;">
      <div>缩放: {{ Math.round(imgScale * 100) }}%</div>
      <div style="font-size: 11px; opacity: 0.8;">双击重置 | 滚轮缩放 | 拖拽移动</div>
      <div style="font-size: 11px; opacity: 0.8;">快捷键: Ctrl + +/- 缩放 | ESC 重置</div>
    </div>
    
    <!-- 图片元素 -->
    <img 
      ref="imgElement"
      style="width: 100%; height: 100%; object-fit: contain; user-select: none; -webkit-user-drag: none; transition: transform 0.1s ease;" 
      :src="path" 
      @load="onImageLoad($event.target as HTMLImageElement)"
      @mousedown="startDrag"
      draggable="false"
    />
  </div>
</template>

<style scoped>
  .image-container {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    touch-action: none; /* 防止移动端默认手势 */
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
  }
  
  .image-container img {
    transition: transform 0.1s ease;
    will-change: transform; /* 优化性能 */
    -webkit-user-drag: none;
    -khtml-user-drag: none;
    -moz-user-drag: none;
    -o-user-drag: none;
    user-drag: none;
  }
  
  .zoom-controls button {
    opacity: 0.8;
    transition: opacity 0.2s, transform 0.2s;
    pointer-events: auto;
  }
  
  .zoom-controls button:hover {
    opacity: 1;
    transform: scale(1.1);
  }
  
  /* 防止按钮被拖拽 */
  .zoom-controls button,
  .zoom-controls button * {
    -webkit-user-drag: none;
    -khtml-user-drag: none;
    -moz-user-drag: none;
    -o-user-drag: none;
    user-drag: none;
  }
  
  .zoom-hint {
    z-index:99;
  }
  /* 移动端适配 */
  @media (max-width: 768px) {
    .zoom-controls {
      top: 5px !important;
      right: 5px !important;
      gap: 3px !important;
    }
    
    .zoom-controls button {
      width: 28px !important;
      height: 28px !important;
    }
    
    .zoom-hint {
      bottom: 5px !important;
      left: 5px !important;
      padding: 3px 8px !important;
      font-size: 11px !important;
    }
    
    .zoom-hint div {
      font-size: 10px !important;
    }
  }
</style>