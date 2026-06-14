<template>
  <div class="data-set-container">    
    <div class="settings-scroll scoll">
      <div class="settings-group">
        <div class="settings-title">
          设置
        </div>
        
        <!-- 工作区路径 -->
        <div class="settings-item">
          <div class="settings-item-content">
            <div class="settings-item-title">
              <i class="fa fa-folder"></i> 当前工作区
            </div>
            <div class="workspace-path-display" :title="workspacePath">
              {{ workspacePath || '未选择工作区' }}
            </div>
          </div>
          <button class="settings-action-btn" @click="selectWorkspace" title="选择工作区">
            <i class="fa fa-folder-open"></i> 选择
          </button>
        </div>
        
        <!-- 项目统计 -->
        <div class="settings-item">
          <div class="settings-item-content">
            <div class="settings-item-title">
              <i class="fa fa-bar-chart"></i> 项目统计
            </div>
            <div class="settings-stats">
              <div class="stat-item">
                <span class="stat-label">灵感:</span>
                <span class="stat-value">{{ stats.inspiration }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">规划:</span>
                <span class="stat-value">{{ stats.organized }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">待办:</span>
                <span class="stat-value">{{ stats.pending }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">进行中:</span>
                <span class="stat-value">{{ stats.inProgress }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">已完成:</span>
                <span class="stat-value">{{ stats.completed }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 文件夹统计 -->
        <div class="settings-item">
          <div class="settings-item-content">
            <div class="settings-item-title">
              <i class="fa fa-folder"></i> 文件系统统计
            </div>
            <div class="folder-stats">
              <div class="stat-item">
                <span class="stat-label">总文件夹:</span>
                <span class="stat-value">{{ stats.totalFolders }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">总文件:</span>
                <span class="stat-value">{{ stats.totalFiles }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Markdown文件:</span>
                <span class="stat-value">{{ stats.totalMarkdownFiles }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">.README.md文件:</span>
                <span class="stat-value">{{ stats.totalReadmeFiles }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">其他文件:</span>
                <span class="stat-value">{{ stats.totalOtherFiles }}</span>
              </div>
              <div class="stat-item total">
                <span class="stat-label">总条目:</span>
                <span class="stat-value">{{ stats.totalItems }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 刷新统计 -->
        <div class="settings-item">
          <div class="settings-item-content">
            <div class="settings-item-title">
              <i class="fa fa-refresh"></i> 刷新统计
            </div>
          </div>
          <button class="settings-action-btn" @click="refreshStats" title="刷新统计">
            <i class="fa fa-refresh"></i> 刷新
          </button>
        </div>

        <!-- 调试信息（仅在开发环境显示） -->
        <div class="settings-item" v-if="debug">
          <div class="settings-item-content">
            <div class="settings-item-title">
              <i class="fa fa-bug"></i> 调试信息
            </div>
            <div style="font-size: 11px; max-height: 100px; overflow-y: auto; padding: 4px; background: var(--menuColor); border-radius: 4px;">
              <div>文件列表总数: {{ fileList.length }}</div>
              <div>Markdown文件: {{ fileList.filter(f => f.extension === '.md').length }}</div>
              <div>文件夹总数: {{ fileList.filter(f => f.type === 'folder').length }}</div>
              <div>带状态的文件夹: {{ fileList.filter(f => f.type === 'folder' && f.attributes?.status).length }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 确认对话框 -->
    <div v-if="showConfirmDialog" class="confirm-dialog-overlay">
      <div class="confirm-dialog">
        <div class="confirm-dialog-header">
          <i class="fa fa-exclamation-triangle"></i> 确认操作
        </div>
        <div class="confirm-dialog-content">
          {{ confirmMessage }}
        </div>
        <div class="confirm-dialog-actions">
          <button class="confirm-btn cancel" @click="cancelConfirm">
            取消
          </button>
          <button class="confirm-btn confirm" @click="executeConfirmAction">
            确认
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.data-set-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--backgroundColor);
}

.settings-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 5px;
}

.settings-group {
  border: 1px solid var(--borderColor);
  border-radius: 5px;
  overflow: hidden;
}

.settings-title {
  padding: 2px 5px;
  background: var(--menuColor);
  color: var(--fontColor);
  font-weight: 500;
  border-bottom: 1px solid var(--borderColor);
  display: flex;
  align-items: center;
  gap: 5px;
}

.settings-item {
  display: flex;
  flex-direction: column;
  padding: 5px;
  border-bottom: 1px solid var(--borderColor);
  background: var(--backgroundColor);
}

.settings-item:last-child {
  border-bottom: none;
}

.settings-item:hover {
  background: var(--menuActiveColor);
}

.settings-item-content {
  width: 100%;
  margin-bottom: 10px;
}

.settings-item-title {
  font-weight: 500;
  color: var(--fontColor);
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 5px;
}

.workspace-path-display {
  font-size: 12px;
  color: var(--fontColor);
  opacity: 0.8;
  word-break: break-all;
  padding: 4px;
  background: var(--menuColor);
  border-radius: 4px;
  max-height: 60px;
  overflow-y: auto;
}

.settings-action-btn {
  padding: 6px 12px;
  border: 1px solid var(--borderColor);
  border-radius: 4px;
  background: var(--backgroundColor);
  color: var(--fontColor);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
  white-space: nowrap;
  width: 100%;
}

.settings-action-btn:hover {
  background: var(--menuActiveColor);
  border-color: var(--fontActiveColor);
}

.settings-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.settings-stats {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 5px;
  margin-top: 5px;
}

.folder-stats {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 5px;
  margin-top: 5px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--fontColor);
  padding: 2px 0;
}

.stat-item.total {
  grid-column: span 1;
  border-top: 1px solid var(--borderColor);
  padding-top: 6px;
  margin-top: 2px;
  font-weight: 500;
}

.stat-label {
  opacity: 0.8;
}

.stat-value {
  font-weight: 500;
}

/* 确认对话框样式 */
.confirm-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.confirm-dialog {
  background: var(--backgroundColor);
  border-radius: 8px;
  padding: 20px;
  width: 300px;
  max-width: 90%;
  border: 1px solid var(--borderColor);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.confirm-dialog-header {
  color: var(--fontColor);
  font-weight: 500;
  font-size: 16px;
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.confirm-dialog-header i {
  color: #ff6b6b;
}

.confirm-dialog-content {
  color: var(--fontColor);
  margin-bottom: 20px;
  line-height: 1.5;
}

.confirm-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.confirm-btn {
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  border: 1px solid var(--borderColor);
}

.confirm-btn.cancel {
  background: var(--backgroundColor);
  color: var(--fontColor);
}

.confirm-btn.cancel:hover {
  background: var(--menuActiveColor);
}

.confirm-btn.confirm {
  background: #ff6b6b;
  color: white;
  border-color: #ff6b6b;
}

.confirm-btn.confirm:hover {
  background: #ff5252;
}
</style>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';

// 定义事件
const emit = defineEmits(['data-imported', 'data-cleared', 'workspace-changed']);

// 响应式变量
const workspacePath = ref<string>('');
const fileList = ref<any[]>([]);
const showConfirmDialog = ref(false);
const confirmMessage = ref('');
const confirmAction = ref<'clear' | null>(null);
const debug = ref(false); // 设置为true显示调试信息

// 计算数据统计
const stats = computed(() => {
  const allFiles = fileList.value;
  
  // 统计所有文件夹
  const actualFolders = allFiles.filter(item => item.type === 'folder');
  
  // 统计所有文件（包括非.md文件）
  const allFiles_count = allFiles.filter(item => item.type === 'file');
  
  // 统计Markdown文件
  const markdownFiles = allFiles.filter(item => 
    item.type === 'file' && item.extension === '.md'
  );
  
  // 统计.README.md文件
  const readmeFiles = markdownFiles.filter(item => 
    item.label === '.README.md'
  );
  
  // 统计其他文件（非.md文件）
  const otherFiles = allFiles.filter(item => 
    item.type === 'file' && item.extension !== '.md'
  );
  
  // 统计带状态的文件夹
  const projectFolders = actualFolders.filter(f => 
    f.attributes && f.attributes.status
  );
  
  // 统计所有项目（有status的文件夹 + 所有.md文件）
  const projectItems = [
    ...projectFolders,
    ...markdownFiles
  ];
  
  // 按状态统计项目
  const inspiration = projectItems.filter(item => 
    (item.attributes?.status || '灵感') === '灵感'
  ).length;
  
  const organized = projectItems.filter(item => 
    item.attributes?.status === '规划'
  ).length;
  
  const pending = projectItems.filter(item => 
    item.attributes?.status === '待办'
  ).length;
  
  const inProgress = projectItems.filter(item => 
    item.attributes?.status === '进行中'
  ).length;
  
  const completed = projectItems.filter(item => 
    item.attributes?.status === '已完成'
  ).length;
  
  return {
    inspiration,
    organized,
    pending,
    inProgress,
    completed,
    // 文件系统统计
    totalFolders: actualFolders.length,           // 所有文件夹
    totalFiles: allFiles_count.length,             // 所有文件
    totalMarkdownFiles: markdownFiles.length,      // 所有.md文件
    totalReadmeFiles: readmeFiles.length,          // .README.md文件
    totalOtherFiles: otherFiles.length,            // 其他文件
    projectFolders: projectFolders.length,         // 项目文件夹（有status）
    totalItems: allFiles.length,                   // 总条目数
    totalProjects: projectItems.length             // 项目总数
  };
});

// 选择工作区
const selectWorkspace = async () => {
  try {
    const folderPath = await window.ipcRenderer.invoke('openFolderDialog');
    if (folderPath) {
      workspacePath.value = folderPath;
      await loadWorkspaceStats();
      emit('workspace-changed', folderPath);
      emit('data-imported', { path: folderPath });
    }
  } catch (error) {
    console.error('选择工作区失败:', error);
    alert('选择工作区失败，请重试');
  }
};

// 加载工作区统计
const loadWorkspaceStats = async () => {
  if (!workspacePath.value) return;
  
  try {
    console.log('加载工作区统计:', workspacePath.value);
    // 获取文件列表（深度为3层）
    const files = await window.ipcRenderer.invoke('getFiles', workspacePath.value, 3);
    console.log('获取到的文件列表:', files);
    fileList.value = files || [];
    
    // 打印详细统计信息
    const folders = files.filter((f: any) => f.type === 'folder');
    const markdownFiles = files.filter((f: any) => f.extension === '.md');
    
  } catch (error) {
    console.error('加载工作区统计失败:', error);
  }
};

// 刷新统计
const refreshStats = async () => {
  if (!workspacePath.value) {
    alert('请先选择工作区');
    return;
  }
  
  await loadWorkspaceStats();
  alert('统计已刷新');
};

// 确认清空数据
const confirmClearData = () => {
  confirmMessage.value = '确认清空所有数据吗？此操作不可恢复。';
  confirmAction.value = 'clear';
  showConfirmDialog.value = true;
};

// 取消确认
const cancelConfirm = () => {
  showConfirmDialog.value = false;
  confirmAction.value = null;
};

// 执行确认的操作
const executeConfirmAction = async () => {
  try {
    switch (confirmAction.value) {
      case 'clear':
        // 清空数据
        localStorage.removeItem('workspacePath');
        workspacePath.value = '';
        fileList.value = [];
        emit('data-cleared');
        alert('数据已清空');
        break;
    }
  } catch (error) {
    console.error('操作失败:', error);
    alert('操作失败，请重试');
  } finally {
    showConfirmDialog.value = false;
    confirmAction.value = null;
  }
};

// 监听工作区路径变化
watch(workspacePath, (newPath) => {
  if (newPath) {
    localStorage.setItem('workspacePath', newPath);
  } else {
    localStorage.removeItem('workspacePath');
  }
});

// 初始化
onMounted(async () => {
  console.log('DataSet组件已加载');
  
  // 读取保存的工作区路径
  const savedPath = localStorage.getItem('workspacePath');
  if (savedPath) {
    workspacePath.value = savedPath;
    await loadWorkspaceStats();
  }
});
</script>