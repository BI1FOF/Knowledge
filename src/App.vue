<script setup lang="ts">
  import {ref, onMounted, computed} from 'vue'
  import {usestore} from './store'
  const store=usestore()
  import home from './components/home.vue'
  import explorer from './components/knowFile/explorer.vue'
  import knowledge from './components/knowRAG/knowRAG.vue'
  import flow from './components/workFlow/workFlow.vue'
  import ToDo from './components/todos/ToDo.vue'
  import Set from './components/Set.vue'
  const set = ref(false); // 是否显示设置面板
  const isMaximized = ref(false); // 窗口是否最大化状态
  store.setTheme()

  // 计算标题文本
  const panelTitle = computed(() => {
    if (store.locales === 'en') {
      switch(store.mainPanel) {
        case '主页': return 'home';
        case '知识管理': return 'Knowledge Management';
        case '知识库处理': return 'Knowledge Base Processing';
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
        <div :class="{active:store.mainPanel=='知识库处理'}" @click="store.mainPanel='知识库处理';" :title="store.locales === 'en' ? 'Knowledge Base Processing' : '知识库处理'"><i class="fa fa-stack-overflow"></i></div>
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
      <knowledge v-if="store.mainPanel=='知识库处理'"/>
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

<style>
  .set-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.8);
    z-index: 1000;
    display: flex;
    align-items: flex-start;
    justify-content: center;
  }

  .settings-panel {
    position: absolute;
    width: 80%;
    left: 10%;
    top: 60px;
    height: calc(100% - 120px);
    z-index: 100;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }
</style>