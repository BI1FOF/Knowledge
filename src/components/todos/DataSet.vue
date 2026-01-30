<template>
  <div class="data-set-container">    
    <div class="settings-scroll scoll">
      <div class="settings-group">
        <div class="settings-title">
          设置
        </div>
        <!-- 数据导出 -->
        <div class="settings-item">
          <div class="settings-item-content">
            <div class="settings-item-title">
              <i class="fa fa-download"></i> 导出
            </div>
          </div>
          <button class="settings-action-btn" @click="exportData" title="导出数据">
            <i class="fa fa-download"></i> 导出
          </button>
        </div>
        
        <!-- 数据导入 -->
        <div class="settings-item">
          <div class="settings-item-content">
            <div class="settings-item-title">
              <i class="fa fa-upload"></i> 导入
            </div>
          </div>
          <div class="settings-import-actions">
            <input 
              type="file" 
              ref="fileInput"
              accept=".json" 
              @change="handleFileSelect"
              class="file-input"
              id="fileInput"
            />
            <label for="fileInput" class="settings-action-btn" title="选择文件">
              <i class="fa fa-folder-open"></i>
            </label>
            <button 
              class="settings-action-btn" 
              @click="importData" 
              :disabled="!selectedFile"
              title="导入数据"
            >
              <i class="fa fa-upload"></i> 导入
            </button>
          </div>
        </div>
        
        <!-- 清空数据 -->
        <div class="settings-item danger">
          <div class="settings-item-content">
            <div class="settings-item-title">
              <i class="fa fa-trash"></i> 清空
            </div>
          </div>
          <button class="settings-action-btn danger" @click="confirmClearData" title="清空所有数据">
            <i class="fa fa-trash"></i> 清空
          </button>
        </div>
        
        <div class="settings-item info">
          <div class="settings-item-content">
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
              <div class="stat-item total">
                <span class="stat-label">总计:</span>
                <span class="stat-value">{{ stats.total }}</span>
              </div>
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
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--backgroundColor);
  border-left: var(--borderColor) 1px solid;
}

.settings-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 5px;
}

.settings-group {
  margin-bottom: 15px;
  border: 1px solid var(--borderColor);
  border-radius: 5px;
  overflow: hidden;
}

.settings-title {
  padding: 8px 10px;
  background: var(--menuColor);
  color: var(--fontColor);
  font-weight: 500;
  border-bottom: 1px solid var(--borderColor);
  display: flex;
  align-items: center;
  gap: 8px;
}

.settings-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
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

.settings-item.danger {
  border-left: 3px solid #ff6b6b;
}

.settings-item.info {
  border-left: 3px solid #4ECDC4;
}

.settings-item-content {
  flex: 1;
}

.settings-item-title {
  font-weight: 500;
  color: var(--fontColor);
  margin: 4px 0px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.settings-item-description {
  font-size: 12px;
  color: var(--fontColor);
  opacity: 0.7;
}

.settings-action-btn {
  padding: 4px;
  border: 1px solid var(--borderColor);
  border-radius: 4px;
  background: var(--backgroundColor);
  color: var(--fontColor);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  white-space: nowrap;
}
.settings-action-btn:hover {
  background: var(--menuActiveColor);
}

.settings-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.settings-action-btn.danger {
  background: #ff6b6b;
  color: white;
  border-color: #ff6b6b;
}

.settings-action-btn.danger:hover {
  background: #ff5252;
}

.settings-import-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.file-input {
  display: none;
}

.settings-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 8px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--fontColor);
  padding: 2px 0;
}

.stat-item.total {
  grid-column: span 3;
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
  padding: 10px;
  width: 300px;
  max-width: 90%;
  border: 1px solid var(--borderColor);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.confirm-dialog-header {
  color: var(--fontColor);
  font-weight: 500;
  font-size: 16px;
  margin-bottom: 5px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.confirm-dialog-content {
  color: var(--fontColor);
  margin-bottom: 10px;
  line-height: 1.5;
}

.confirm-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.confirm-btn {
  padding: 4px 8px;
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
import { ref, computed, onMounted } from 'vue';

// 定义事件
const emit = defineEmits(['data-imported', 'data-cleared']);

const selectedFile = ref<File | null>(null);
const showConfirmDialog = ref(false);
const confirmMessage = ref('');
const confirmAction = ref<'clear' | 'import' | null>(null);
const confirmData = ref<any>(null);
const fileInput = ref<HTMLInputElement | null>(null);

// 计算数据统计
const stats = computed(() => {
  const itemsStr = localStorage.getItem('items');
  const items = itemsStr ? JSON.parse(itemsStr) : [];
  
  return {
    inspiration: items.filter((item: any) => item.status === '灵感').length,
    organized: items.filter((item: any) => item.status === '规划').length,
    pending: items.filter((item: any) => item.status === '待办').length,
    inProgress: items.filter((item: any) => item.status === '进行中').length,
    completed: items.filter((item: any) => item.status === '已完成').length,
    total: items.length
  };
});

// 导出数据
const exportData = () => {
  try {
    // 获取所有数据
    const items = localStorage.getItem('items');
    const nextId = localStorage.getItem('nextId');
    
    const exportData = {
      items: items ? JSON.parse(items) : [],
      nextId: nextId ? parseInt(nextId) : 1,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
    
    // 创建JSON字符串
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    // 创建下载链接
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `task-manager-data-${new Date().toISOString().split('T')[0]}.json`;
    
    // 触发下载
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // 清理URL
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
    console.log('数据导出成功');
  } catch (error) {
    console.error('导出数据失败:', error);
    alert('导出数据失败，请重试');
  }
};

// 处理文件选择
const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0];
  }
};

// 导入数据
const importData = () => {
  if (!selectedFile.value) {
    alert('请先选择要导入的文件');
    return;
  }
  
  const reader = new FileReader();
  
  reader.onload = (e) => {
    try {
      const content = e.target?.result as string;
      const importData = JSON.parse(content);
      
      // 验证数据格式
      if (!importData.items || !Array.isArray(importData.items)) {
        throw new Error('无效的数据格式');
      }
      
      // 显示确认对话框
      confirmMessage.value = `确认导入 ${importData.items.length} 条数据吗？这将替换现有数据。`;
      confirmAction.value = 'import';
      confirmData.value = importData;
      showConfirmDialog.value = true;
      
    } catch (error) {
      console.error('导入数据失败:', error);
      alert('导入数据失败：文件格式不正确');
    }
  };
  
  reader.onerror = () => {
    alert('读取文件失败');
  };
  
  reader.readAsText(selectedFile.value);
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
  confirmData.value = null;
};

// 执行确认的操作
const executeConfirmAction = () => {
  try {
    switch (confirmAction.value) {
      case 'clear':
        // 清空数据
        localStorage.removeItem('items');
        localStorage.removeItem('nextId');
        emit('data-cleared');
        alert('数据已清空');
        break;
        
      case 'import':
        // 导入数据
        if (confirmData.value) {
          localStorage.setItem('items', JSON.stringify(confirmData.value.items));
          localStorage.setItem('nextId', confirmData.value.nextId?.toString() || '1');
          emit('data-imported', confirmData.value);
          alert(`成功导入 ${confirmData.value.items.length} 条数据`);
        }
        break;
    }
    
    // 重置文件输入
    if (fileInput.value) fileInput.value.value = '';
    selectedFile.value = null;
    
  } catch (error) {
    console.error('操作失败:', error);
    alert('操作失败，请重试');
  } finally {
    showConfirmDialog.value = false;
    confirmAction.value = null;
    confirmData.value = null;
  }
};

// 初始化
onMounted(() => {
  console.log('DataSet组件已加载');
});
</script>