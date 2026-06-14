<script setup lang="ts">
import { usestore } from '../../../store'
import { ref, reactive, onMounted, onBeforeUnmount, watch } from 'vue'

// 获取数据
const store = usestore()
const files = ref([]) as any

// 右键点击的文件
const selectFile = ref({}) as any

// 右键菜单的样式
const ifMenu = ref(false)
const menuPosition = reactive({
  x: 0,
  y: 0
})

// 显示模式：grid（图标）、list（列表）
const viewMode = ref('grid')

// 是否显示文件名
const showFileName = ref(true)

// 图片宽高比模式：'portrait'(2:3 竖屏), 'landscape'(3:2 横屏), 'square'(正方形)
const imageAspectRatio = ref('square')

// 图标尺寸：'small'(小), 'medium'(中), 'large'(大)
const iconSize = ref('medium')

const getData = async function () {
  if (store.path && !(await window.ipcRenderer.invoke('isDirectory', store.path))) {
    return
  }
  try {
    files.value = await window.ipcRenderer.invoke('getFiles', store.path, 1)
  } catch (error) {
    console.error(error)
  }
}

// 获取图片地址
const getAddress = function (item: any) {
  return `file:\/\/${item.path.replace(/\\/g, '/')}`
}

// 是否为图片文件
const isImageFile = function (item: any) {
  return item.extension && ['.jpeg', '.jpg', '.png', '.webp', '.gif', '.bmp', '.svg'].includes(item.extension.toLowerCase())
}

// 打开文件
const open = async function (data: any) {
  store.addTab(data)
}

// 右键菜单
const nodeContextmenu = function (event: any, item: any) {
  event.preventDefault()
  selectFile.value = item
  ifMenu.value = true
  menuPosition.x = event.clientX - 10
  menuPosition.y = event.clientY - 17
}

// 打开位置
const openInFolder = async function (data: any) {
  window.ipcRenderer.invoke('openInFolder', data.path)
}

// 获取颜色
const color = function (item: any) {
  if (item.attributes && item.attributes['颜色']) {
    return item.attributes['颜色']
  }
  return 'var(--borderColor)'
}

// 切换视图模式
const toggleViewMode = function () {
  viewMode.value = viewMode.value === 'grid' ? 'list' : 'grid'
}

// 切换文件名显示
const toggleFileName = function () {
  showFileName.value = !showFileName.value
}

// 切换图片宽高比
const toggleAspectRatio = function () {
  const ratios = ['square', 'landscape', 'portrait']
  const currentIndex = ratios.indexOf(imageAspectRatio.value)
  const nextIndex = (currentIndex + 1) % ratios.length
  imageAspectRatio.value = ratios[nextIndex]
}

// 切换图标尺寸
const toggleIconSize = function () {
  const sizes = ['small', 'medium', 'large']
  const currentIndex = sizes.indexOf(iconSize.value)
  const nextIndex = (currentIndex + 1) % sizes.length
  iconSize.value = sizes[nextIndex]
}

// 获取当前图片容器的样式
const getImageContainerStyle = function () {
  // 根据图标尺寸和宽高比计算尺寸 - 紧凑设计
  let baseSize = 80 // medium 紧凑尺寸
  
  if (iconSize.value === 'small') {
    baseSize = 60 // 小尺寸更紧凑
  } else if (iconSize.value === 'large') {
    baseSize = 160 // 大尺寸适当减小
  }
  
  switch (imageAspectRatio.value) {
    case 'landscape': // 横屏 3:2
      return {
        containerWidth: Math.round(baseSize * 1.5) + 'px', // 3:2 比例
        containerHeight: baseSize + 'px',
        iconFontSize: Math.round(baseSize * 0.5) + 'px'
      }
    case 'portrait': // 竖屏 2:3
      return {
        containerWidth: baseSize + 'px', // 2:3 比例
        containerHeight: Math.round(baseSize * 1.5) + 'px',
        iconFontSize: Math.round(baseSize * 0.5) + 'px'
      }
    default: // square 正方形
      return {
        containerWidth: baseSize + 'px',
        containerHeight: baseSize + 'px',
        iconFontSize: Math.round(baseSize * 0.5) + 'px'
      }
  }
}

// 获取网格的列宽 - 紧凑设计
const getGridTemplateColumns = function () {
  const style = getImageContainerStyle()
  const containerWidth = parseInt(style.containerWidth)
  
  // 紧凑设计，减少额外空间
  if (iconSize.value === 'small') {
    return `repeat(auto-fill, minmax(${containerWidth}px, 1fr))`
  } else if (iconSize.value === 'large') {
    return `repeat(auto-fill, minmax(${containerWidth}px, 1fr))`
  }
  return `repeat(auto-fill, minmax(${containerWidth}px, 1fr))`
}

// 获取网格间距 - 紧凑设计
const getGridGap = function () {
  if (iconSize.value === 'small') {
    return '4px' // 小尺寸间距最小
  } else if (iconSize.value === 'large') {
    return '8px' // 大尺寸间距稍大
  }
  return '5px' // 中尺寸间距
}

// 获取文件名字体大小 - 紧凑设计
const getFileNameFontSize = function () {
  if (iconSize.value === 'small') {
    return '9px'
  } else if (iconSize.value === 'large') {
    return '13px'
  }
  return '10px'
}

// 获取文件名最大高度 - 紧凑设计
const getFileNameMaxHeight = function () {
  if (iconSize.value === 'small') {
    return '16px'
  } else if (iconSize.value === 'large') {
    return '22px'
  }
  return '18px'
}

// 获取宽高比按钮的图标
const getAspectRatioIcon = function () {
  switch (imageAspectRatio.value) {
    case 'landscape':
      return 'fa fa-arrows-h' // 横屏图标
    case 'portrait':
      return 'fa fa-arrows-v' // 竖屏图标
    default:
      return 'fa fa-square' // 正方形图标
  }
}

// 获取宽高比按钮的提示文字
const getAspectRatioTitle = function () {
  switch (imageAspectRatio.value) {
    case 'landscape':
      return '横屏显示 (3:2)'
    case 'portrait':
      return '竖屏显示 (2:3)'
    default:
      return '正方形显示'
  }
}

// 获取图标尺寸按钮的图标
const getIconSizeIcon = function () {
  switch (iconSize.value) {
    case 'small':
      return 'fa fa-minus-square' // 小图标
    case 'large':
      return 'fa fa-plus-square' // 大图标
    default:
      return 'fa fa-square' // 中图标
  }
}

// 获取图标尺寸按钮的提示文字
const getIconSizeTitle = function () {
  switch (iconSize.value) {
    case 'small':
      return '小图标'
    case 'large':
      return '大图标'
    default:
      return '中图标'
  }
}

watch(() => store.root, () => {
  getData()
})

watch(() => store.path, () => {
  getData()
})

onMounted(() => {
  getData()
})

onBeforeUnmount(() => {
  // 清理
})
</script>

<template>
  <div class="file-viewer">
    <!-- 顶部菜单 -->
    <div class="menu">
      <ul>
        <li class="path-info">
          <i class="fa fa-folder"></i>
          {{ store.path == "" ? "根目录" : store.path }}
        </li>
        <li class="menu-tools">
          <button @click="store.backPath()" title="返回上一级">
            <i class="fa fa-arrow-up"></i>
          </button>
        </li>
        <li class="menu-tools">
          <button @click="toggleViewMode" :title="viewMode === 'grid' ? '切换到列表视图' : '切换到图标视图'">
            <i :class="viewMode === 'grid' ? 'fa fa-list' : 'fa fa-th'"></i>
          </button>
        </li>
        <li class="menu-tools">
          <button @click="toggleFileName" :title="showFileName ? '隐藏文件名' : '显示文件名'">
            <i :class="showFileName ? 'fa fa-font' : 'fa fa-eye-slash'"></i>
          </button>
        </li>
        <li class="menu-tools" v-if="viewMode === 'grid'">
          <button @click="toggleIconSize" :title="getIconSizeTitle()">
            <i :class="getIconSizeIcon()"></i>
          </button>
        </li>
        <li class="menu-tools" v-if="viewMode === 'grid' && files && files.some((item: any) => isImageFile(item))">
          <button @click="toggleAspectRatio" :title="getAspectRatioTitle()">
            <i :class="getAspectRatioIcon()"></i>
          </button>
        </li>
      </ul>
    </div>

    <!-- 文件列表区域 -->
    <div class="files-container" :class="[viewMode, iconSize, imageAspectRatio]" @dragover.prevent>
      <!-- 网格视图 -->
      <div v-if="viewMode === 'grid'" class="files-grid" 
           :style="{ 
             gridTemplateColumns: getGridTemplateColumns(),
             gap: getGridGap() 
           }">
        <div v-for="(item, index) in files" :key="index" class="file-item" 
             @dblclick="open(item)" @contextmenu="nodeContextmenu($event, item)" 
             :title="item.fullName">
          <div class="file-content" :style="{ 
            width: getImageContainerStyle().containerWidth,
            height: getImageContainerStyle().containerHeight,
            borderColor: color(item) 
          }">
            <i v-if="!isImageFile(item)" :class="store.icon(item.extension)" :style="{ 
              fontSize: getImageContainerStyle().iconFontSize 
            }"></i>
            <div v-if="isImageFile(item)" class="img">
              <img :src="getAddress(item)" loading="lazy" />
            </div>
          </div>
          <div class="file-title" v-if="showFileName" :style="{
            fontSize: getFileNameFontSize(),
            maxHeight: getFileNameMaxHeight()
          }">
            {{ item.label }}
          </div>
        </div>
      </div>

      <!-- 列表视图 -->
      <div v-if="viewMode === 'list'" class="files-list">
        <div v-for="(item, index) in files" :key="index" class="list-item" 
             @dblclick="open(item)" @contextmenu="nodeContextmenu($event, item)" 
             :title="item.fullName">
          <div class="list-icon" :style="{ color: color(item) }">
            <i v-if="!isImageFile(item)" :class="store.icon(item.extension)"></i>
            <div v-if="isImageFile(item)" class="list-img">
              <img :src="getAddress(item)" loading="lazy" />
            </div>
          </div>
          <div class="list-name" v-if="showFileName">
            {{ item.label }}
          </div>
        </div>
      </div>

      <!-- 空文件夹提示 -->
      <div v-if="files && files.length === 0" class="empty-folder">
        <i class="fa fa-folder-open"></i>
        <p>文件夹为空</p>
      </div>
    </div>

    <!-- 右键菜单 -->
    <div class="contextmenu" v-if="ifMenu" @mouseleave="ifMenu = false" 
         :style="{ top: menuPosition.y + 'px', left: menuPosition.x + 'px' }">
      <ul>
        <li @click="open(selectFile); ifMenu = false">
          <i class="fa fa-file-text-o"></i>&nbsp; 打开
        </li>
        <li @click="openInFolder(selectFile); ifMenu = false">
          <i class="fa fa-folder"></i>&nbsp; 系统位置
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.file-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--backgroundColor);
  overflow: hidden;
  border-right: 1px solid var(--borderColor);
}

/* 顶部菜单 */
.menu {
  height: 40px;
  min-height: 40px;
  border-bottom: 1px solid var(--borderColor);
  flex-shrink: 0;
  padding: 0;
}

.menu ul {
  margin: 0;
  padding: 0 5px;
  height: 100%;
  display: flex;
  align-items: center;
  white-space: nowrap;
}

.menu li {
  cursor: pointer;
  color: var(--fontColor);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.path-info {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 5px;
}

.path-info i {
  color: var(--primaryColor);
}

.menu-tools {
  display: flex;
  padding: 0 2px;
}

.menu-tools button {
  background: transparent;
  border: 1px solid var(--borderColor);
  border-radius: 4px;
  color: var(--fontColor);
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
  padding: 0;
  margin: 0;
}

.menu-tools button:hover {
  background: var(--menuActiveColor);
  border-color: var(--primaryColor);
}

/* 文件容器 */
.files-container {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 2px; /* 减少容器内边距 */
  background: var(--backgroundColor);
}

/* 网格视图 - 紧凑设计 */
.files-grid {
  display: grid;
  align-items: start;
  justify-items: center; /* 居中对齐 */
  width: 100%;
}

/* 通用文件项样式 - 紧凑设计 */
.files-grid .file-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: transform 0.2s;
  width: 100%;
  box-sizing: border-box;
  padding: 1px; /* 减少内边距 */
}

.files-grid .file-item:hover {
  transform: translateY(-1px); /* 减少悬停移动距离 */
}

.files-grid .file-content {
  border: 1px solid var(--borderColor);
  border-radius: 4px; /* 减小圆角 */
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--menuColor);
  overflow: hidden;
  transition: border-color 0.2s;
  box-sizing: border-box;
  margin: 0; /* 移除外边距 */
  padding: 0; /* 移除内边距 */
}

.files-grid .file-content:hover {
  border-color: var(--primaryColor);
}

.files-grid .img {
  width: 100%;
  height: 100%;
}

.files-grid .img img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* 对于横屏和竖屏模式，可以改为 cover 以填充容器 */
.files-container.landscape .img img,
.files-container.portrait .img img {
  object-fit: cover;
}

/* 文件名样式 - 紧凑设计 */
.files-grid .file-title {
  width: 100%;
  text-align: center;
  color: var(--fontColor);
  margin-top: 2px;
  box-sizing: border-box;
  line-height: 1.2;
  padding: 0 1px;
  /* 单行省略号 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 紧凑设计的图标尺寸样式 */
.files-container.small .file-title {
  max-height: 16px;
}

.files-container.medium .file-title {
  max-height: 18px;
}

.files-container.large .file-title {
  max-height: 22px;
}

/* 列表视图 */
.files-list {
  display: flex;
  flex-direction: column;
  gap: 3px; /* 减小列表项间距 */
  padding: 0;
}

.files-list .list-item {
  display: flex;
  align-items: center;
  padding: 4px 6px; /* 减小列表项内边距 */
  border: 1px solid var(--borderColor);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  gap: 10px; /* 减小图标和文字间距 */
}

.files-list .list-item:hover {
  background: var(--menuActiveColor);
  border-color: var(--primaryColor);
}

.files-list .list-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.files-list .list-icon i {
  font-size: 18px;
}

.files-list .list-img {
  width: 32px;
  height: 32px;
}

.files-list .list-img img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.files-list .list-name {
  flex: 1;
  font-size: 12px; /* 减小列表文字大小 */
  color: var(--fontColor);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 空文件夹提示 */
.empty-folder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--fontSecondaryColor);
  gap: 8px; /* 减小间距 */
}

.empty-folder i {
  font-size: 36px; /* 减小图标 */
  opacity: 0.5;
}

.empty-folder p {
  font-size: 12px; /* 减小文字 */
  opacity: 0.7;
}

/* 右键菜单 */
.contextmenu {
  z-index: 1000;
  position: fixed;
}

.contextmenu ul {
  position: absolute;
  min-width: 140px; /* 减小菜单宽度 */
  border: 1px solid var(--borderColor);
  background: var(--menuColor);
  border-radius: 4px;
  list-style-type: none;
  padding: 6px 0; /* 减小内边距 */
  margin: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); /* 减小阴影 */
}

.contextmenu li {
  padding: 6px 12px; /* 减小菜单项内边距 */
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: var(--fontColor);
  transition: background-color 0.2s;
  font-size: 13px; /* 减小字体 */
}

.contextmenu li:hover {
  background: var(--menuActiveColor);
}

/* 滚动条样式 */
.files-container::-webkit-scrollbar {
  width: 6px; /* 减小滚动条宽度 */
}

.files-container::-webkit-scrollbar-track {
  background: var(--backgroundColor);
}

.files-container::-webkit-scrollbar-thumb {
  background: var(--borderColor);
  border-radius: 3px;
}

.files-container::-webkit-scrollbar-thumb:hover {
  background: var(--primaryColor);
}
</style>