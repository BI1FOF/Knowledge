<script setup lang="ts">
  import {ref, onMounted, computed} from 'vue'
  import {usestore} from './store'
  const store=usestore()
  import home from './components/home.vue'
  import explorer from './components/knowFile/explorer.vue'
  import knowledge from './components/knowRAG/knowRAG.vue'
  import flow from './components/workFlow/workFlow.vue'
  import ToDo from './components/todos/ToDo.vue'
  import Set from './components/set/Set.vue'
  const set = ref(false); // 是否显示设置面板
  const isMaximized = ref(false); // 窗口是否最大化状态
  store.setTheme()

  // 计算标题文本
  const panelTitle = computed(() => {
    if (store.locales === 'en') {
      switch(store.mainPanel) {
        case '主页': return 'home';
        case '知识管理': return 'Knowledge Management';
        case '知识处理': return 'Knowledge Processing';
        case '工作流': return 'Workflow';
        case '灵感管理': return 'Inspiration Management';
        default: return store.mainPanel;
      }
    }
    return store.mainPanel; // 默认使用中文
  })

  onMounted(async () => {
    store.loadConfig()
    if(store.root!=undefined&&store.root!=""){
      store.tree =  await window.ipcRenderer.invoke('getDirectoryTree',store.root)
    }
  })
  function minimizeWindow() {
    window.ipcRenderer.invoke('minimize-window');
  }

  function maximizeWindow() {
    isMaximized.value=!isMaximized.value
    window.ipcRenderer.invoke('maximize-window');
  }

  function toggleFullscreen() {
    window.ipcRenderer.invoke('toggle-fullscreen');
  }
  function closeWindow() {
    store.saveConfig()
    window.ipcRenderer.invoke('close-window')
  }
  function closeSetPanel() {
    set.value = false
  }
</script>

<template>
  <div class="container">
    <!-- 左侧面板 -->
    <div class="mainPanel">
      <div class="panel-header">
        <div :class="{active:store.mainPanel=='主页'}" @click="store.mainPanel='主页';" :title="store.locales === 'en' ? 'Home' : '主页'"><i class="fa fa-home"></i></div>
        <div :class="{active:store.mainPanel=='知识管理'}" @click="store.mainPanel='知识管理';"  :title="store.locales === 'en' ? 'Knowledge Management' : '知识管理'"><i class="fa fa-book"></i></div>
        <div :class="{active:store.mainPanel=='知识处理'}" @click="store.mainPanel='知识处理';" :title="store.locales === 'en' ? 'Knowledge Processing' : '知识处理'"><i class="fa fa-stack-overflow"></i></div>
        <div :class="{active:store.mainPanel=='工作流'}" @click="store.mainPanel='工作流'"  :title="store.locales === 'en' ? 'Workflow' : '工作流'"><i class="fa fa-stumbleupon"></i></div>
        <div :class="{active:store.mainPanel=='灵感管理'}" @click="store.mainPanel='灵感管理';"  :title="store.locales === 'en' ? 'Inspiration Management' : '灵感管理'"><i class="fa fa-lightbulb-o"></i></div>
        <div style="flex:1;-webkit-app-region: drag;font-size: 12px;">{{ panelTitle }}</div>
        <div :class="{active:set}" @click="set=!set"><i class="fa fa-cogs"></i></div>
        <div @click="minimizeWindow" title="最小化">
            <i class="fa fa-minus"></i>
          </div>
          <div @click="maximizeWindow" title="最大化/还原">
            <i class="fa" :class="isMaximized ? 'fa-compress' : 'fa-window-maximize'"></i>
          </div>
          <div @click="toggleFullscreen" title="全屏/退出全屏">
            <i class="fa fa-arrows-alt"></i>
          </div>
        <div @click="closeWindow" style="font-size:16px;margin-top: 6px;margin-right: 6px;"><i class="fa fa-times"></i></div>
      </div>
    </div>
    
    <!-- 右侧内容区域 -->
    <div class="main">
      <home v-if="store.mainPanel=='主页'"/>
      <explorer v-if="store.mainPanel=='知识管理'"/>
      <knowledge v-if="store.mainPanel=='知识处理'"/>
      <flow v-if="store.mainPanel=='工作流'"/>
      <ToDo v-if="store.mainPanel=='灵感管理'"/>
    </div>
    
    <!-- 设置面板 -->
    <div v-if="set" class="set-overlay" @click="closeSetPanel">
      <div class="settings-panel" @click.stop>
        <Set/>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .set-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
    display: flex;
    align-items: flex-start;
    justify-content: center;
  }

  .settings-panel {
    position: absolute;
    width: 100%;
    top: 39px;
    height: calc(100% - 40px);
    z-index: 100;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }
    
  /* 左侧主面板 */
  .mainPanel {
    width: fit-content;
    min-width: 100%;
    height: 39px;
    background-color: var(--menuColor);
    border-right: 1px solid var(--borderColor);
    transition: width 0.1s ease;
    display: flex;
    position: relative;
    z-index: 10;
    border: var(--borderColor) 1px solid;
  }

  /* 隐藏状态 */
  .mainPanel.panel-hide {
    width: 0;
    min-width: 0;
    opacity: 0;
    border-right: none;
  }

  /* 拖拽条 */
  .mainPanel .panel-draggable {
    position: absolute;
    right: 0;
    top: 0;
    width: 5px;
    height: 100%;
    cursor: ew-resize;
    z-index: 11;
  }

  .mainPanel .panel-draggable:hover {
    background-color: var(--menuActiveColor);
    opacity: 0.5;
  }

  /* 面板头部（图标栏） */
  .panel-header {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 0;
    user-select: none;
    margin-left: 5px;
  }

  .panel-header div {
    width: 30px;
    height: 30px;
    line-height: 30px;
    margin: 0px 5px 0px 0px;
    text-align: center;
    border-radius: 5px;
    font-size: 16px;
    color: var(--fontColor);
    cursor: pointer;
    transition: all 0.25s ease;
  }

  .panel-header div:hover {
    color: var(--fontActiveColor);
    background-color: var(--menuActiveColor);
  }

  .panel-header div.active {
    color: var(--fontActiveColor);
    background-color: var(--menuActiveColor);
  }

  /* 拖拽区域 */
  .panel-header div[style*="drag"] {
    cursor: move;
    opacity: 0.3;
  }

  .panel-header div[style*="drag"]:hover {
    background-color: transparent;
  }

  /* 设置按钮 */
  .panel-header div:last-child {
    margin-top: auto;
    margin-bottom: 5px;
  }
</style>