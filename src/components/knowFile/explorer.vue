<template>
  <div class="bg">
    <!-- 顶部标签栏保持不变 -->
    <div class="top-panel">
      <!-- 主页按钮 -->
      <div class="home">
        <div class="button" style="flex:1" :class="{active:mode=='file'}" @click="toggleMode('file')">
          <i class="fa fa-navicon"></i>
        </div>
        <div class="button" style="flex:1" :class="{active:mode=='search'}" @click="toggleMode('search')" v-if="store.root!=''">
          <i class="fa fa-search"></i> 
        </div>
        <div class="button" style="flex:1;" :class="{active:mode=='AI'}" @click="toggleMode('AI')">
          <i class="iconfont">&#xe65d;</i>
        </div>
        <!-- 新增：清空所有标签按钮 -->
        <div class="button" style="flex:1" 
             :class="{disabled: store.data.length <= 1}"
             @click="clearAllTabs"
             title="关闭所有标签页">
          <i class="fa fa-times-circle"></i>
        </div>
      </div>
      <div class="App_tabs" ref="tabsContainer" @wheel="handleWheel">
        <transition-group name="tab" tag="div" class="tabs-wrapper">
          <div class="App_tab" 
               v-for="(item,index) in store.data" 
               :key="index" 
               :class="{ 'active': store.index === index }" 
               @click="selectFile(Number(index))">
            <i :class="store.icon(item.extension)"></i> {{item.label}}&nbsp;
            <span><i class="fa fa-times" @click="close($event, Number(index))"></i></span>
          </div>
        </transition-group>
      </div>
    </div>
    
    <!-- 主要内容区域保持不变 -->
    <div class="explorer-container">
      <!-- 左侧面板 -->
      <panel class="left-panel" v-if="mode=='file'"/>
      <search class="left-panel" v-if="mode=='search'"/>
      <AI class="left-panel" v-if="mode=='AI'"/>
      <!-- 右侧内容区域 -->
      <div class="right-content">
        <div class="explorer" :style="{flexDirection:store.UI.layout=='horizontal'?'row':'column'}">
          <view_file v-if="store.view.includes('文件')&&store.root!=''" />
          <view_kanban v-if="store.view.includes('看板')&&store.root!=''" />
          <view_graph v-if="store.view.includes('图谱')&&store.root!=''" />
          <view_gantt v-if="store.view.includes('甘特')&&store.root!=''" />
          <view_date v-if="store.view.includes('月历')&&store.root!=''" />
          <view_year v-if="store.view.includes('年历')&&store.root!=''" />
          <view_map v-if="store.view.includes('地图')&&store.root!=''" />
          <view_table v-if="store.view.includes('表格')&&store.root!=''" />
          <md_edit v-if="store.view.includes('编辑')&&store.index!=null" :style="{borderRight:store.UI.layout=='horizontal'?'1px solid var(--borderColor)':'',borderTop:store.UI.layout=='vertical'?'1px solid var(--borderColor)':''}"/>
          <md_read v-if="store.view.includes('浏览')&&hasActiveFile" 
                   :style="{borderRight:store.UI.layout=='horizontal'?'1px solid var(--borderColor)':'',borderTop:store.UI.layout=='vertical'?'1px solid var(--borderColor)':''}" 
                   :content="activeFileContent" 
                   :path="activeFilePath"/>
          <md_mind v-if="store.view.includes('导图')&&store.index!=null" :style="{borderRight:store.UI.layout=='horizontal'?'1px solid var(--borderColor)':'',borderTop:store.UI.layout=='vertical'?'1px solid var(--borderColor)':''}"/>
          <md_ppt v-if="store.view.includes('演示')&&store.index!=null" :style="{borderRight:store.UI.layout=='horizontal'?'1px solid var(--borderColor)':'',borderTop:store.UI.layout=='vertical'?'1px solid var(--borderColor)':''}"/>
          <empty v-if="store.view.length==0||store.root==''" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, nextTick } from 'vue';
  import {usestore} from '../../store'
  
  import view_file from './view/view_file.vue'
  import view_kanban from './view/view_kanban.vue'
  import view_graph from './view/view_graph.vue'
  import view_gantt from './view/view_gantt.vue'
  import view_date from './view/view_date.vue'
  import view_year from './view/view_year.vue'
  import view_map from './view/view_map.vue'
  import view_table from './view/view_table.vue'
  import md_read from './view/md_read.vue'
  import md_mind from './view/md_mind.vue'
  import md_edit from './view/md_edit.vue'
  import md_ppt from './view/md_ppt.vue'
  import empty from './view/empty.vue'
  
  import panel from './panel.vue'
  import search from './search.vue'
  import AI from './SlideAI.vue'
  
  const store = usestore();
  const tabsContainer = ref<HTMLElement | null>(null);
  const mode = ref('file');

  // 切换模式的方法
  const toggleMode = function(targetMode: string) {
    mode.value = mode.value !== targetMode ? targetMode : '';
  };

  // 计算属性：判断是否有激活的文件
  const hasActiveFile = computed(() => {
    return store.index !== null && 
          store.data.length > 0 && 
          store.index < store.data.length;
  });

  // 计算属性：获取激活文件的内容
  const activeFileContent = computed(() => {
    if (hasActiveFile.value) {
      return store.data[store.index!].content;
    }
    return '';
  });

  // 计算属性：获取激活文件的路径
  const activeFilePath = computed(() => {
    if (hasActiveFile.value) {
      return store.data[store.index!].path;
    }
    return '';
  });

  // 新增：清空所有标签的方法
  const clearAllTabs = async function() {
    // 只有当标签数量大于1时才执行
    if (store.data.length <= 1) {
      return;
    }
    
    // 添加确认对话框，避免误操作
    if (confirm(`确定要关闭所有 ${store.data.length} 个标签页吗？`)) {
      // 使用动画效果关闭所有标签
      const tabs = document.querySelectorAll('.App_tab');
      tabs.forEach(tab => {
        tab.classList.add('closing');
      });
      
      // 等待动画完成
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 清除所有标签
      store.data.splice(0, store.data.length);
      
      // 重置状态
      store.index = null;
      store.path = '';
    }
  };

  // 选择文件
  const selectFile = function(index: number) {
    if (index >= 0 && index < store.data.length) {
      store.index = index;
      if (store.data[store.index].type == 'file') {
        store.path = store.data[store.index].path.substring(0, store.data[store.index].path.lastIndexOf('\\'));
      } else {
        store.path = store.data[store.index].path;
      }
    }
  };

  // 关闭文件
  const close = async function(event: Event, index: number) {
    event.stopPropagation();
    
    if (index < 0 || index >= store.data.length) {
      return;
    }
    
    // 添加关闭动画
    const tabElement = event.currentTarget as HTMLElement;
    const tab = tabElement.closest('.App_tab');
    if (tab) {
      tab.classList.add('closing');
      
      // 等待动画完成
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    store.data.splice(index, 1);
    
    if (store.data.length == 0) {
      store.index = null;
      store.path = '';
    } else {
      if (store.index == index) {
        store.index = Math.max(0, Math.min(index, store.data.length - 1));
        if (store.data[store.index] && store.data[store.index].type == 'file') {
          store.path = store.data[store.index].path.substring(0, store.data[store.index].path.lastIndexOf('\\'));
        } else if (store.data[store.index]) {
          store.path = store.data[store.index].path;
        }
      } else if (store.index > index) {
        store.index -= 1;
      }
    }
  };
  
  const handleWheel = function(event: WheelEvent) {
    if (tabsContainer.value) {
      tabsContainer.value.scrollLeft += event.deltaY;
      event.preventDefault();
    }
  };
</script>

<style scoped>
  .bg {
    display: flex;
    flex-direction: column;
    height: calc(100% - 1px); /* 使用视口高度 */
    background-color: var(--backgroundColor);
    overflow: hidden; /* 防止整体溢出 */
  }

  .top-panel{
    width:100%;
    height:40px;
    line-height:40px;
    border-bottom:1px solid var(--borderColor);
    user-select: none;
    display: flex;
    flex-shrink: 0;
  }

  .home{
    display: flex;
    align-items: center;
    line-height: normal;
    text-align: center;
    font-size: 16px;
    color: var(--fontColor);
    cursor: pointer;
    flex-shrink: 0;
  }

  .App_tabs {
    white-space: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    line-height: normal;
    scroll-behavior: smooth;
    flex: 1;
    display: flex;
    align-items: flex-end;
    padding: 0 3px;
    flex-shrink: 0;
  }

  .App_tabs::-webkit-scrollbar {
    display: none;
  }

  .tabs-wrapper {
    display: flex;
    align-items: flex-end;
    flex-shrink: 0;
    position: relative;
    min-height: 35px;
  }

  .App_tab {
    background-color: var(--backgroundColor);
    border: 1px solid var(--borderColor);
    border-bottom: 0px;
    height: 35px;
    min-width: fit-content;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    user-select: none;
    padding: 0 8px;
    margin-right: 5px;
    border-radius: 5px 5px 0px 0px;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.3s ease;
    transform-origin: left center;
    opacity: 1;
    transform: scale(1);
  }

  .App_tab.active {
    background-color: var(--backgroundColor);
    border-bottom: 0px;
  }

  .App_tab i:not(.fa-times) {
    margin-right: 5px;
  }

  .App_tab .fa-times {
    opacity: 0.6;
    font-size: 12px;
    margin-left: 5px;
    transition: opacity 0.2s;
  }

  .App_tab .fa-times:hover {
    opacity: 1;
    transform: scale(1.1);
  }

  /* 标签添加动画 */
  .tab-enter-active {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    transition-delay: 0.1s;
  }

  .tab-leave-active {
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    position: absolute;
    width: auto !important; /* 保持宽度 */
  }

  /* 修改这里：从下往上进入，从当前位置向下离开 */
  .tab-enter-from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }

  .tab-leave-to {
    opacity: 0;
    transform: translateY(10px) scale(0.95);
    margin-right: -100px; /* 让元素向右移动消失 */
  }

  .tab-enter-to,
  .tab-leave-from {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  .tab-move {
    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes closeTab {
    0% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    50% {
      opacity: 0.5;
      transform: translateY(5px) scale(0.97);
    }
    100% {
      opacity: 0;
      transform: translateY(15px) scale(0.9);
      margin-right: -40px;
      width: 0;
      padding: 0;
    }
  }

  /* 标签悬停效果 */
  .App_tab:hover:not(.active) {
    background-color: rgba(128, 128, 128, 0.1);
    transform: translateY(-1px);
  }

  .App_tab.active:hover {
    background-color: var(--backgroundColor);
  }

  .explorer-container {
    display: flex;
    width: 100%;
    flex: 1; /* 占据剩余空间 */
    min-height: 0; /* 关键：允许flex子元素收缩 */
    overflow: hidden; /* 防止内容溢出 */
  }
  
  .left-panel {
    width: 270px;
    min-width: 270px;
    height: 100%;
    overflow: hidden;
    border-right: 1px solid var(--borderColor);
    flex-shrink: 0; /* 防止被压缩 */
  }

  .right-content {
    flex: 1;
    min-width: 0; /* 关键：允许flex子元素收缩 */
    overflow: hidden; /* 改为hidden，防止滚动条 */
  }

  .explorer {
    display: flex;
    width: 100%;
    height: 100%; /* 继承父容器高度 */
    min-height: 0; /* 关键：允许flex子元素收缩 */
  }
  
  /* 确保所有子组件也正确处理高度 */
  .explorer > * {
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  
  .button{
    background-color: var(--backgroundColor);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3px 8px;
    transition: all 0.2s;
  }
  
  .button.active {
    background-color: var(--menuActiveColor);
  }
  
  /* 新增：禁用状态样式 */
  .button.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }
  
  .button:not(.disabled):hover {
    background-color: var(--menuHoverColor);
    transform: translateY(-1px);
  }
</style>