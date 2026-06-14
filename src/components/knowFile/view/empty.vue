<script setup lang="ts">
import { usestore } from '../../../store'
import { onMounted, onBeforeUnmount, computed } from 'vue'

const store = usestore()

const openFolder = async function() {
  let path = await window.ipcRenderer.invoke('openFolderDialog')
  if(path != null){
    store.root = path
    store.tree = await window.ipcRenderer.invoke('getDirectoryTree', path)
    store.path = path
  }
}

// 国际化文本
const t = {
  // 工具栏
  openFolder: computed(() => store.locales === 'en' ? 'Open Folder' : '打开文件夹'),
  selectLanguage: computed(() => store.locales === 'en' ? 'Select Language' : '选择语言'),
  selectTheme: computed(() => store.locales === 'en' ? 'Select Theme' : '选择主题'),
  
  // 欢迎信息
  welcome: computed(() => store.locales === 'en' ? 'Welcome' : '欢迎使用'),
  selectFolderPrompt: computed(() => store.locales === 'en' 
    ? 'Select a folder to start your work' 
    : '选择一个文件夹开始您的工作'),
  
  // 视图名称
  views: {
    file: computed(() => store.locales === 'en' ? 'Files' : '文件'),
    gantt: computed(() => store.locales === 'en' ? 'Gantt' : '甘特'),
    kanban: computed(() => store.locales === 'en' ? 'Kanban' : '看板'),
    graph: computed(() => store.locales === 'en' ? 'Graph' : '图谱'),
    month: computed(() => store.locales === 'en' ? 'Month' : '月历'),
    year: computed(() => store.locales === 'en' ? 'Year' : '年历'),
    map: computed(() => store.locales === 'en' ? 'Map' : '地图'),
    table: computed(() => store.locales === 'en' ? 'Table' : '表格'),
    browser: computed(() => store.locales === 'en' ? 'Browser' : '浏览'),
    mindmap: computed(() => store.locales === 'en' ? 'Mindmap' : '导图'),
    presentation: computed(() => store.locales === 'en' ? 'PPT' : '演示'),
    editor: computed(() => store.locales === 'en' ? 'Editor' : '编辑')
  },
  
  // 主题选项
  themes: {
    lightRed: computed(() => store.locales === 'en' ? 'Light Red' : '浅红色'),
    lightBlue: computed(() => store.locales === 'en' ? 'Light Blue' : '浅蓝色'),
    warm: computed(() => store.locales === 'en' ? 'Warm' : '暖色调'),
    midnightBlue: computed(() => store.locales === 'en' ? 'Midnight Blue' : '午夜蓝'),
    gray: computed(() => store.locales === 'en' ? 'Gray' : '灰色'),
    dark: computed(() => store.locales === 'en' ? 'Dark' : '深色')
  }
}

onMounted(() => {})
onBeforeUnmount(() => {})
</script>

<template>
  <div class="App_empty">
    <div class="panels-container">
      <!-- 顶部工具栏 -->
      <div class="top-toolbar">
        <div class="toolbar-inner">
          <button class="folder-btn" @click="openFolder()" :title="t.openFolder.value">
            <i class="fa fa-folder-open"></i>
            <span>{{ t.openFolder.value }}</span>
          </button>
          
          <div class="settings-group">
            <select v-model="store.locales" style="margin:0px" :title="t.selectLanguage.value">
              <option value="zh">中文</option>
              <option value="en">ENGLISH</option>
            </select>
            
            <select v-model="store.UI.theme" @change="store.changeTheme()" style="margin:0px" :title="t.selectTheme.value">
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
        </div>
      </div>

      <!-- 主视图区域 -->
      <div class="main-panel">
        <div class="welcome-message">
          <i class="fa fa-folder-open welcome-icon"></i>
          <h2>{{ t.welcome.value }}</h2>
          <p>{{ t.selectFolderPrompt.value }}</p>
        </div>

        <!-- 视图按钮 -->
        <div class="views-container">
          <div class="views scoll">
            <div class="view" @click="store.toggleView('文件')" :class="{active:store.isView('文件')}">
              <i class="fa fa-folder"></i>
              <span>{{ t.views.file.value }}</span>
            </div>
            <div class="view" @click="store.toggleView('甘特')" :class="{active:store.isView('甘特')}">
              <i class="iconfont">&#xe672;</i>
              <span>{{ t.views.gantt.value }}</span>
            </div>
            <div class="view" @click="store.toggleView('看板')" :class="{active:store.isView('看板')}">
              <i class="fa fa-list-ul"></i>
              <span>{{ t.views.kanban.value }}</span>
            </div>
            <div class="view" @click="store.toggleView('图谱')" :class="{active:store.isView('图谱')}">
              <i class="iconfont">&#xe662;</i>
              <span>{{ t.views.graph.value }}</span>
            </div>
            <div class="view" @click="store.toggleView('月历')" :class="{active:store.isView('月历')}">
              <i class="iconfont">&#xe600;</i>
              <span>{{ t.views.month.value }}</span>
            </div>
            <div class="view" @click="store.toggleView('年历')" :class="{active:store.isView('年历')}">
              <i class="fa fa-calendar"></i>
              <span>{{ t.views.year.value }}</span>
            </div>
            <div class="view" @click="store.toggleView('地图')" :class="{active:store.isView('地图')}">
              <i class="iconfont">&#xe884;</i>
              <span>{{ t.views.map.value }}</span>
            </div>
            <div class="view" @click="store.toggleView('表格')" :class="{active:store.isView('表格')}">
              <i class="fa fa-table"></i>
              <span>{{ t.views.table.value }}</span>
            </div>
            <div class="view" @click="store.toggleView('浏览')" :class="{active:store.isView('浏览')}">
              <i class="fa fa-book"></i>
              <span>{{ t.views.browser.value }}</span>
            </div>
            <div class="view" @click="store.toggleView('导图')" :class="{active:store.isView('导图')}">
              <i class="fa fa-map-o"></i>
              <span>{{ t.views.mindmap.value }}</span>
            </div>
            <div class="view" @click="store.toggleView('演示')" :class="{active:store.isView('演示')}">
              <i class="fa fa-television"></i>
              <span>{{ t.views.presentation.value }}</span>
            </div>
            <div class="view" @click="store.toggleView('编辑')" :class="{active:store.isView('编辑')}">
              <i class="fa fa-code"></i>
              <span>{{ t.views.editor.value }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.App_empty {
  flex: 1;
  width: 100%;
  height: 100%;
  background-color: var(--backgroundColor);
  overflow: hidden;
  user-select: none;
  display: flex;
  flex-direction: column;
}

/* 顶部工具栏 */
.top-toolbar {
  padding: 2px 5px;
  background-color: rgba(var(--menuColor), 0.1);
}

.toolbar-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 5px;
}

.folder-btn {
  border: none;
  padding: 6px 10px;
  margin-top: 2px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  transition: all 0.2s ease;
  background-color: var(--backgroundColor);
  border: var(--borderColor) 1px solid;
}

.folder-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.folder-btn:active {
  transform: translateY(0);
}

.settings-group {
  display: flex;
  gap: 5px;
}

/* 主面板 */
.panels-container {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.main-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 5px;
  gap: 5px;
}

.welcome-message {
  text-align: center;
  padding: 10px;
  border-radius: 12px;
  background: rgba(var(--menuColor), 0.05);
  border: 1px solid rgba(var(--borderColor), 0.3);
  max-width: 500px;
  width: 100%;
}

.welcome-icon {
  font-size: 48px;
  color: var(--accentColor);
  margin-bottom: 16px;
}

.welcome-message h2 {
  margin: 0 0 8px 0;
  color: var(--textColor);
  font-size: 24px;
}

.welcome-message p {
  margin: 0;
  color: var(--textSecondary);
  font-size: 14px;
  opacity: 0.8;
}

/* 视图容器 */
.views-container {
  width: 100%;
  max-width: 800px;
}

.views {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
  gap: 6px;
  padding: 5px;
  background: rgba(var(--menuColor), 0.05);
  border-radius: 12px;
}

.view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6px;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  background: rgba(var(--menuColor), 0.1);
}

.view:hover {
  background-color: var(--menuColor);
  transform: translateY(-2px);
  border-color: var(--borderColor);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.view.active {
  background-color: var(--menuActiveColor);
  color: white;
  border-color: var(--accentColor);
  box-shadow: 0 4px 12px rgba(var(--accentColor), 0.2);
}

.view.active:hover {
  background-color: var(--menuActiveColor);
}

.view i {
  font-size: 20px;
  margin-bottom: 6px;
}

.view i.iconfont {
  font-size: 18px;
}

.view span {
  font-size: 12px;
  font-weight: 500;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .toolbar-inner {
    flex-direction: column;
    gap: 5px;
  }
  
  .settings-group {
    width: 100%;
    justify-content: center;
  }
  
  .views {
    grid-template-columns: repeat(4, 1fr);
    gap: 5px;
  }
  
  .main-panel {
    gap: 5px;
  }
}

</style>