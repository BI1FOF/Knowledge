<!-- src/components/set/SkillsSettings.vue -->
<template>
  <div class="skills-settings">
    <div class="settings-group">
      <h3>{{ store.locales=='zh'?'技能设置' : 'Skills Settings' }}</h3>
      <div class="form-group">
        <label>{{ store.locales=='zh'?'技能文件夹路径' : 'Skills Folder Path' }}</label>
        <div class="input-with-button">
          <input v-model="store.skillsPath" :placeholder="store.locales=='zh'?'请输入技能文件夹路径' : 'Enter skills folder path'"/>
          <div class="button" style="width:20px" @click="openSkillsFolder" :title="store.locales=='zh'?'选择技能文件夹' : 'Select Skills Folder'">
            <i class="fa fa-folder-open"></i>
          </div>
          <div class="button" style="width:20px" @click="refreshSkills" :title="store.locales=='zh'?'刷新技能列表' : 'Refresh Skills'">
          <i class="fa fa-refresh"></i>
        </div>
        </div>
      </div>
    </div>

    <!-- 技能列表 -->
    <div class="settings-group">
      <h3>{{ store.locales=='zh'?'已加载技能' : 'Loaded Skills' }}</h3>
      
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-indicator">
        <i class="fa fa-spinner fa-spin"></i> {{ store.locales=='zh'?'正在加载技能...' : 'Loading skills...' }}
      </div>
      
      <!-- 技能列表 -->
      <div v-else class="skills-list-container scoll">
        <div v-if="skills.length === 0" class="empty-message">
          {{ store.locales=='zh'?'暂无技能，请选择技能文件夹' : 'No skills found, please select skills folder' }}
        </div>
        
        <div 
          v-for="(skill, index) in skills" 
          :key="skill.name"
          class="skill-item"
          :class="{ active: activeSkillName === skill.name }"
          @click="selectSkill(skill.name)"
        >
          <i class="fa fa-cube"></i>
          <div class="skill-info">
            <span class="skill-name">{{ skill.name }}</span>
            <span class="skill-description">{{ skill.description }}</span>
          </div>
          <div class="skill-actions">
            <i class="fa fa-folder-open" @click.stop="openSkillFolder(skill)" :title="store.locales=='zh'?'打开文件夹' : 'Open Folder'"></i>
          </div>
        </div>
      </div>
    </div>

    <!-- 技能预览 -->
    <div v-if="previewSkillData" class="settings-group">
      <h3>
        {{ store.locales=='zh'?'技能预览' : 'Skill Preview' }}
        <i class="fa fa-close close-preview" @click="closePreview"></i>
      </h3>
      
      <div class="skill-preview">
        <div class="preview-metadata">
          <h4>Metadata</h4>
          <pre>{{ JSON.stringify(previewSkillData.metadata, null, 2) }}</pre>
        </div>
        
        <div class="preview-content">
          <h4>SKILL.md</h4>
          <pre>{{ previewSkillData.content }}</pre>
        </div>
        
        <div v-if="previewSkillData.files.length > 0" class="preview-files">
          <h4>{{ store.locales=='zh'?'相关文件' : 'Related Files' }}</h4>
          <ul>
            <li v-for="file in previewSkillData.files" :key="file">
              <i class="fa" :class="getFileIcon(file)"></i> {{ file }}
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.skills-settings {
  width: 100%;
  height: 100%;
  overflow-y: auto;
}

.settings-group {
  margin-bottom: 10px;
  padding-bottom: 5px;
  border-bottom: 1px solid var(--borderColor);
}

.settings-group:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.settings-group h3 {
  color: var(--fontActiveColor);
  margin: 0 0 5px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--borderColor);
  font-size: 16px;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.close-preview {
  cursor: pointer;
  font-size: 14px;
  opacity: 0.7;
}

.close-preview:hover {
  opacity: 1;
}

/* 表单组样式 */
.form-group {
  display: flex;
  align-items: flex-start;
  margin-bottom: 5px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  width: 120px;
  min-width: 120px;
  color: var(--fontColor);
  font-size: 14px;
  user-select: none;
  padding-top: 8px;
}

.form-group input,
.form-group select,
.form-group textarea {
  flex: 1;
  padding: 4px 2px;
  border: 1px solid var(--borderColor);
  border-radius: 5px;
  background-color: var(--menuColor);
  color: var(--fontColor);
  font-size: 14px;
  transition: border-color 0.2s ease;
  margin: 0;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--fontActiveColor);
}

/* 带按钮的输入框 */
.input-with-button {
  flex: 1;
  display: flex;
  gap: 5px;
}

/* 按钮样式 */
.button {
  border: 1px solid var(--borderColor);
  border-radius: 5px;
  background-color: var(--menuColor);
  color: var(--fontColor);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
  white-space: nowrap;
  width: calc(100% - 20px);
  margin: 0px;
  padding: 6px 6px;
}

.button:hover {
  background-color: var(--menuActiveColor);
  color: var(--fontActiveColor);
}

.button i {
  font-size: 14px;
}

/* 技能列表样式 */
.skills-list-container {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--borderColor);
  border-radius: 5px;
  background-color: var(--menuColor);
}

.skill-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--borderColor);
  cursor: pointer;
  transition: all 0.2s ease;
  gap: 10px;
}

.skill-item:hover {
  background-color: var(--menuActiveColor);
}

.skill-item.active {
  background-color: var(--menuActiveColor);
  color: var(--fontActiveColor);
  border-left: 3px solid var(--fontActiveColor);
}

.skill-item:last-child {
  border-bottom: none;
}

.skill-item i.fa-cube {
  font-size: 16px;
  min-width: 20px;
}

.skill-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.skill-name {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.skill-description {
  font-size: 12px;
  opacity: 0.8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.skill-actions {
  display: flex;
  gap: 10px;
  opacity: 0.7;
}

.skill-actions i {
  cursor: pointer;
  padding: 2px;
  border-radius: 3px;
}

.skill-actions i:hover {
  background-color: var(--borderColor);
  opacity: 1;
}

.empty-message {
  padding: 20px;
  text-align: center;
  opacity: 0.7;
}

.loading-indicator {
  padding: 20px;
  text-align: center;
  color: var(--fontActiveColor);
}

.loading-indicator i {
  margin-right: 8px;
}

/* 技能预览样式 */
.skill-preview {
  padding: 10px;
  overflow-y: auto;
}

.preview-metadata,
.preview-content,
.preview-files {
  margin-bottom: 15px;
}

.preview-metadata h4,
.preview-content h4,
.preview-files h4 {
  margin: 0 0 5px 0;
  font-size: 14px;
  color: var(--fontActiveColor);
}

.preview-metadata pre,
.preview-content pre {
  margin: 0;
  padding: 10px;
  background-color: var(--menuColor);
  border: 1px solid var(--borderColor);
  border-radius: 5px;
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-y: auto;
}

.preview-files ul {
  margin: 0;
  padding-left: 20px;
}

.preview-files li {
  font-size: 13px;
  margin-bottom: 3px;
}

.preview-files i {
  margin-right: 5px;
  font-size: 12px;
}

/* 响应式调整 */
@media (max-width: 600px) {
  .form-group {
    flex-direction: column;
  }
  
  .input-with-button {
    width: 100%;
  }
}
</style>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { usestore } from '../../store'

const store = usestore()

// 技能列表
const skills = ref<Array<{
  name: string
  description: string
  path: string
  metadata: any
}>>([])

// 当前选中的技能名称
const activeSkillName = ref<string | null>(null)

// 预览数据
const previewSkillData = ref<{
  name: string
  metadata: any
  content: string
  files: string[]
} | null>(null)

// 加载状态
const loading = ref(false)

// 打开技能文件夹
const openSkillsFolder = async function() {
  let path = await window.ipcRenderer.invoke('openFolderDialog')
  if(path!=null){
    store.skillsPath = path
    await loadSkills()
  }
}

// 刷新技能列表
const refreshSkills = async () => {
  await loadSkills()
}

// 加载技能
const loadSkills = async () => {
  if (!store.skillsPath) {
    skills.value = []
    return
  }
  
  loading.value = true
  try {
    const loadedSkills = await window.ipcRenderer.invoke('loadSkills', store.skillsPath)
    skills.value = loadedSkills
    // 如果之前有选中的技能，尝试重新选中
    if (activeSkillName.value) {
      const exists = skills.value.some(s => s.name === activeSkillName.value)
      if (!exists) {
        activeSkillName.value = null
      }
    }
  } catch (error) {
    console.error('加载技能失败:', error)
    if (store.locales === 'zh') {
      alert('加载技能失败: ' + error)
    } else {
      alert('Failed to load skills: ' + error)
    }
  } finally {
    loading.value = false
  }
}

// 选择技能
const selectSkill = (skillName: string) => {
  activeSkillName.value = skillName
  previewSkill(skills.value.find(s => s.name === skillName)!)
}

// 预览技能
const previewSkill = async (skill: any) => {
  try {
    const preview = await window.ipcRenderer.invoke('previewSkill', skill.path)
    previewSkillData.value = {
      name: skill.name,
      metadata: preview.metadata,
      content: preview.content,
      files: preview.files
    }
  } catch (error) {
    console.error('预览技能失败:', error)
  }
}

// 打开技能文件夹
const openSkillFolder = (skill: any) => {
  window.ipcRenderer.invoke('openInFolder', skill.path)
}

// 关闭预览
const closePreview = () => {
  previewSkillData.value = null
}

// 获取文件图标
const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'md': return 'fa-file-text-o'
    case 'py': return 'fa-file-code-o'
    case 'js': return 'fa-file-code-o'
    case 'json': return 'fa-file-code-o'
    case 'txt': return 'fa-file-text-o'
    default: return 'fa-file-o'
  }
}

// 监听技能文件夹路径变化
watch(() => store.skillsPath, async (newPath) => {
  if (newPath) {
    await loadSkills()
  } else {
    skills.value = []
  }
})

// 组件挂载时加载技能
onMounted(async () => {
  if (store.skillsPath) {
    await loadSkills()
  }
})
</script>