<script setup lang="ts">
  import { usestore } from '../../../store'
  import {ref, onMounted, watch, nextTick} from 'vue'
  
  const store = usestore()
  let editRowIndex = ref<number | null>(null)
  let editAttributeName = ref<string>('')
  let attributes = ref([]) as any
  let data = ref([]) as any
  
  // 初始化数据
  const init = async function(){
    try {
      const files = await window.ipcRenderer.invoke("getFiles", store.root, 1)
      data.value = files
      getAttributes()
    } catch (error) {
      console.error('获取文件列表失败:', error)
    }
  }
  
  // 获取节点属性
  const getAttributes = function(){
    let allProps = [] as any
    data.value.forEach((obj: { attributes: any }) => {
      const props = Object.keys(obj.attributes)
      for(let i = 0; i < props.length; i++){
        if(!/^[A-Za-z]+$/.test(props[i])){
          allProps.push(props[i])
        }
      }
    })
    
    // 去除重复属性
    let result = allProps.filter((obj:any, index:any, self:any) => {
      return index === self.findIndex((o:any) => {
        return JSON.stringify(o) === JSON.stringify(obj)
      })
    })
    
    attributes.value = result
  }
  
  // 打开文件
  const open = function(i: number){
    store.addTab(data.value[i])
  }
  
  // 打开文件夹
  const openFolder = function(path: string){
    store.root = path
    init()
  }
  
  // 智能识别数据类型
  const detectDataType = function(value: any): string {
    if (value === null || value === undefined || value === '') return 'text'
    
    // 检查是否是布尔值
    if (typeof value === 'boolean') return 'checkbox'
    
    // 检查字符串值
    if (typeof value === 'string') {
      const str = value.trim()
      
      // 检查布尔值字符串
      const lowerStr = str.toLowerCase()
      if (lowerStr === 'true' || lowerStr === 'false' || 
          lowerStr === '是' || lowerStr === '否' ||
          lowerStr === '1' || lowerStr === '0' || 
          lowerStr === 'yes' || lowerStr === 'no') {
        return 'checkbox'
      }
      
      // 检查ISO日期时间格式 (如：2022-11-25T14:57:39.000Z)
      const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?$/
      if (isoDateRegex.test(str)) {
        return 'datetime-local' // 改为 datetime-local 以支持时间
      }
      
      // 检查标准日期格式
      const datePatterns = [
        /^\d{4}-\d{2}-\d{2}$/,
        /^\d{4}\/\d{2}\/\d{2}$/,
        /^\d{4}年\d{2}月\d{2}日$/
      ]
      for (const pattern of datePatterns) {
        if (pattern.test(str)) {
          return 'date'
        }
      }
      
      // 检查时间格式
      const timePattern = /^\d{2}:\d{2}(:\d{2})?$/
      if (timePattern.test(str)) {
        return 'time'
      }
      
      // 检查是否是数字
      if (!isNaN(Number(str)) && str !== '' && str.trim() !== '') {
        // 排除空字符串和空格
        return 'number'
      }
    }
    
    // 检查是否是日期对象
    if (value instanceof Date) return 'datetime-local'
    
    // 检查是否是数字
    if (typeof value === 'number') return 'number'
    
    return 'text'
  }
  
  // 获取输入框类型
  const getInputType = function(attr: string, value: any){
    const detectedType = detectDataType(value)
    
    // 根据属性名给予提示（但不强制）
    const attrLower = attr.toLowerCase()
    if (attr === '状态' || attr === '完成' || attrLower.includes('status')) {
      return 'checkbox'
    } else if (attr === '日期' || attr === 'date' || attrLower.includes('date')) {
      return 'date'
    } else if (attr === '时间' || attr === 'time' || attrLower.includes('time')) {
      return 'time'
    } else if (attrLower.includes('datetime') || attrLower.includes('timestamp')) {
      return 'datetime-local'
    }
    
    return detectedType
  }
  
  // 转换值为标准格式
  const normalizeValue = function(value: any, inputType: string): any {
    if (value === null || value === undefined || value === '') return ''
    
    switch (inputType) {
      case 'checkbox':
        if (typeof value === 'boolean') return value
        if (typeof value === 'string') {
          const str = value.trim().toLowerCase()
          if (str === 'true' || str === '是' || str === '1' || str === 'yes') return true
          if (str === 'false' || str === '否' || str === '0' || str === 'no') return false
        }
        return Boolean(value)
        
      case 'date':
        if (value instanceof Date) {
          const year = value.getFullYear()
          const month = ('0' + (value.getMonth() + 1)).slice(-2)
          const day = ('0' + value.getDate()).slice(-2)
          return `${year}-${month}-${day}`
        }
        if (typeof value === 'string') {
          const str = value.trim()
          // 处理ISO格式
          if (str.includes('T')) {
            try {
              const date = new Date(str)
              const year = date.getFullYear()
              const month = ('0' + (date.getMonth() + 1)).slice(-2)
              const day = ('0' + date.getDate()).slice(-2)
              return `${year}-${month}-${day}`
            } catch (e) {
              return str
            }
          }
          return str
        }
        return value
        
      case 'time':
        if (typeof value === 'string') return value.trim()
        return value
        
      case 'datetime-local':
        if (value instanceof Date) {
          const year = value.getFullYear()
          const month = ('0' + (value.getMonth() + 1)).slice(-2)
          const day = ('0' + value.getDate()).slice(-2)
          const hours = ('0' + value.getHours()).slice(-2)
          const minutes = ('0' + value.getMinutes()).slice(-2)
          const seconds = ('0' + value.getSeconds()).slice(-2)
          return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
        }
        if (typeof value === 'string') {
          const str = value.trim()
          // 处理ISO格式
          if (str.includes('T')) {
            try {
              const date = new Date(str)
              const year = date.getFullYear()
              const month = ('0' + (date.getMonth() + 1)).slice(-2)
              const day = ('0' + date.getDate()).slice(-2)
              const hours = ('0' + date.getHours()).slice(-2)
              const minutes = ('0' + date.getMinutes()).slice(-2)
              const seconds = ('0' + date.getSeconds()).slice(-2)
              return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
            } catch (e) {
              return str
            }
          }
          return str
        }
        return value
        
      case 'number':
        if (typeof value === 'number') return value
        const num = Number(value)
        return isNaN(num) ? value : num
        
      default:
        return value
    }
  }
  
  // 保存属性修改
  const saveAttribute = async function(index: number, attribute: string, value: any, inputType?: string){
    console.log('保存属性开始:', { index, attribute, value, inputType })
    
    const file = data.value[index]
    if (!file) {
      console.error('文件信息不完整:', file)
      return
    }
    
    // 获取文件路径 - 使用正确的属性名
    const filePath = file.fullPath || file.path
    if (!filePath) {
      console.error('文件路径不存在:', file)
      return
    }
    
    console.log('文件路径:', filePath)
    
    try {
      console.log('准备保存文件:', file.label, '路径:', filePath)
      
      // 根据输入类型规范化值
      const inputTypeToUse = inputType || getInputType(attribute, value)
      const normalizedValue = normalizeValue(value, inputTypeToUse)
      
      console.log('规范化后的值:', normalizedValue, '类型:', inputTypeToUse)
      
      // 直接构建配置对象，而不是先获取
      let config: Record<string, any> = {}
      
      // 保留现有属性（除了当前修改的属性）
      if (file.attributes) {
        config = { ...file.attributes }
      }
      
      // 更新配置
      if (normalizedValue === '' || normalizedValue === null || normalizedValue === undefined) {
        delete config[attribute]
        console.log('删除属性:', attribute)
      } else {
        config[attribute] = normalizedValue
        console.log('设置属性:', attribute, '=', normalizedValue)
      }
      
      console.log('最终配置对象:', config)
      
      // 保存到文件
      console.log('调用IPC保存文件元数据...')
      const success = await window.ipcRenderer.invoke('saveFileMetadata', filePath, config)
      
      console.log('保存结果:', success)
      
      if (success) {
        // 更新本地数据
        if (!data.value[index].attributes) {
          data.value[index].attributes = {}
        }
        
        if (normalizedValue === '' || normalizedValue === null || normalizedValue === undefined) {
          delete data.value[index].attributes[attribute]
        } else {
          data.value[index].attributes[attribute] = normalizedValue
        }
        
        // 如果是新增的属性，需要更新属性列表
        if (!attributes.value.includes(attribute) && normalizedValue !== '' && 
            normalizedValue !== null && normalizedValue !== undefined) {
          attributes.value.push(attribute)
        }
        
        console.log(`属性保存成功: ${file.label} - ${attribute} = ${normalizedValue}`)
        
        // 退出编辑模式
        editRowIndex.value = null
        editAttributeName.value = ''
        
        // 强制重新渲染
        data.value = [...data.value]
        
        // 重新获取属性列表
        getAttributes()
      } else {
        console.error(`属性保存失败: ${file.label} - ${attribute}`)
        alert(`保存失败，请检查控制台日志`)
      }
      
    } catch (error: any) {
      console.error('保存属性失败:', error)
      alert(`保存失败: ${error.message || '未知错误'}`)
    }
  }
  
  // 格式化属性显示 - 添加文本截断功能
  const formatAttributeDisplay = function(value: any, maxLength: number = 20){
    if (value === null || value === undefined || value === '') return ''
    
    // 布尔值显示
    if (typeof value === 'boolean') {
      return value ? '✓' : ''
    }
    
    // 日期格式化
    if (value instanceof Date) {
      const year = value.getFullYear()
      const month = ('0' + (value.getMonth() + 1)).slice(-2)
      const day = ('0' + value.getDate()).slice(-2)
      const hours = ('0' + value.getHours()).slice(-2)
      const minutes = ('0' + value.getMinutes()).slice(-2)
      return `${month}-${day} ${hours}:${minutes}`
    }
    
    // 字符串日期处理
    if (typeof value === 'string') {
      // ISO日期时间格式处理
      if (value.includes('T')) {
        try {
          const date = new Date(value)
          const month = ('0' + (date.getMonth() + 1)).slice(-2)
          const day = ('0' + date.getDate()).slice(-2)
          const hours = ('0' + date.getHours()).slice(-2)
          const minutes = ('0' + date.getMinutes()).slice(-2)
          return `${month}-${day} ${hours}:${minutes}`
        } catch (e) {
          // 如果解析失败，返回原始值
        }
      }
      
      // 标准日期格式显示为MM-DD
      const dateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      if (dateMatch) {
        return `${dateMatch[2]}-${dateMatch[3]}`
      }
      
      // 时间格式显示
      const timeMatch = value.match(/^(\d{2}):(\d{2})(:(\d{2}))?$/)
      if (timeMatch) {
        return `${timeMatch[1]}:${timeMatch[2]}`
      }
    }
    
    // 通用字符串处理 - 添加截断功能
    const strValue = String(value)
    if (strValue.length > maxLength) {
      return strValue.substring(0, maxLength) + '...'
    }
    
    return strValue
  }
  
  // 获取完整文本（用于title提示）
  const getFullText = function(value: any): string {
    if (value === null || value === undefined || value === '') return ''
    
    // 布尔值显示
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false'
    }
    
    // 日期对象
    if (value instanceof Date) {
      return value.toISOString()
    }
    
    return String(value)
  }
  
  // 处理单元格点击
  const handleCellClick = async function(index: number, attribute: string, event: MouseEvent){
    // 设置当前编辑的行和属性
    editRowIndex.value = index
    editAttributeName.value = attribute
    
    // 等待Vue完成DOM更新
    await nextTick()
    
    // 查找并聚焦输入框
    const cell = event.currentTarget as HTMLElement
    if (!cell) return
    
    // 给DOM一点时间渲染
    setTimeout(() => {
      const input = cell.querySelector('input')
      if (input) {
        input.focus()
        
        // 如果是日期/时间类型，显示选择器
        if (input.type === 'date' || input.type === 'time' || input.type === 'datetime-local') {
          try {
            input.showPicker?.()
          } catch (e) {
            // 某些浏览器可能不支持showPicker
            console.log('showPicker not supported')
          }
        }
      } else {
        console.warn('找不到输入框，请检查DOM结构')
      }
    }, 50)
  }
  
  // 处理输入框变化
  const handleInputChange = function(index: number, attribute: string, event: Event, inputType?: string){
    const target = event.target as HTMLInputElement
    let value: any
    
    if (inputType === 'checkbox') {
      value = target.checked
    } else {
      value = target.value
    }
    
    console.log('输入框变化:', { index, attribute, value, inputType })
    
    // 对于复选框，立即保存
    if (inputType === 'checkbox') {
      saveAttribute(index, attribute, value, inputType)
    }
    // 对于其他类型，等待失去焦点或回车
  }
  
  // 处理输入框失去焦点
  const handleInputBlur = function(index: number, attribute: string, event: Event, inputType?: string){
    const target = event.target as HTMLInputElement
    let value: any
    
    if (inputType === 'checkbox') {
      value = target.checked
    } else {
      value = target.value
    }
    
    console.log('输入框失去焦点:', { index, attribute, value, inputType })
    
    // 如果值为空，删除该属性
    if (value === '' || value === null || value === undefined) {
      saveAttribute(index, attribute, '')
    } else {
      saveAttribute(index, attribute, value, inputType)
    }
  }
  
  // 处理回车键
  const handleKeyPress = function(index: number, attribute: string, event: KeyboardEvent, inputType?: string){
    if (event.key === 'Enter') {
      const target = event.target as HTMLInputElement
      let value: any
      
      if (inputType === 'checkbox') {
        value = target.checked
      } else {
        value = target.value
      }
      
      console.log('回车键保存:', { index, attribute, value, inputType })
      
      saveAttribute(index, attribute, value, inputType)
      target.blur() // 失去焦点，退出编辑模式
    }
  }
  
  // 添加新属性列
  const addAttributeColumn = function(){
    const newAttrName = prompt('请输入新属性名称:')
    if (newAttrName && newAttrName.trim()) {
      const attrName = newAttrName.trim()
      if (!attributes.value.includes(attrName)) {
        attributes.value.push(attrName)
      }
    }
  }
  
  watch(() => store.root, () => {
    init()
  })
  
  onMounted(() => {
    init()
  })
</script>

<template>
  <div class="bg">
    <!-- 顶部菜单栏 -->
    <div class="menu">
      <ul>
        <!-- 路径信息 -->
        <li class="path-info">
          <i class="fa fa-table"></i>
          {{ store.root == "" ? "根目录" : store.root }}
        </li>
        
        <!-- 返回上一级按钮 -->
        <li class="menu-tools">
          <button @click="store.backPath()" title="返回上一级">
            <i class="fa fa-arrow-up"></i>
          </button>
        </li>
        
        <!-- 添加属性列按钮 -->
        <li class="menu-tools">
          <button @click="addAttributeColumn" title="添加属性列">
            <i class="fa fa-plus"></i>
          </button>
        </li>
      </ul>
    </div>
    
    <!-- 表格内容区域 -->
    <div class="tab_content scoll">
      <table>
        <thead>
          <tr>
            <th class="fixed-col index">#</th>
            <th class="fixed-col action">操作</th>
            <th class="fixed-col name">文件名</th>
            <th v-for="(attr, attrIndex) in attributes" :key="attrIndex" class="attribute-col">
              <div class="attribute-header">
                <span :title="attr">{{ attr }}</span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(node, index) in data"
            :key="index"
            :class="{ 'hover-row': index === editRowIndex }"
          >
            <!-- 序号列 -->
            <td class="fixed-col index">
              <span>{{ Number(index) + 1 }}</span>
            </td>
            
            <!-- 操作列 -->
            <td class="fixed-col action">
              <div class="action-buttons">
                <i 
                  class="fa fa-folder-open folder-icon" 
                  v-if="node.isFolder"
                  @click="openFolder(node.fullPath || node.path)"
                  title="打开文件夹"
                ></i>
                <i 
                  class="fa fa-file-text file-icon" 
                  @click="open(Number(index))"
                  :title="node.isFolder ? '打开文件夹' : '打开文件'"
                ></i>
              </div>
            </td>
            
            <!-- 文件名列 -->
            <td class="fixed-col name">
              <span :title="node.label" class="filename-text">{{ node.label }}</span>
            </td>
            
            <!-- 属性列 -->
            <td 
              v-for="(attr, attrIndex) in attributes" 
              :key="attrIndex"
              class="attribute-col"
              @click="handleCellClick(Number(index), attr, $event)"
            >
              <!-- 只读模式显示 -->
              <div 
                v-if="!(Number(index) === editRowIndex && editAttributeName === attr)"
                class="attribute-value"
                :class="{
                  'status-true': node.attributes && node.attributes[attr] === true,
                  'status-false': node.attributes && node.attributes[attr] === false,
                  'date-value': getInputType(attr, node.attributes ? node.attributes[attr] : '') === 'date',
                  'datetime-value': getInputType(attr, node.attributes ? node.attributes[attr] : '') === 'datetime-local',
                  'time-value': getInputType(attr, node.attributes ? node.attributes[attr] : '') === 'time',
                  'number-value': getInputType(attr, node.attributes ? node.attributes[attr] : '') === 'number',
                  'text-value': getInputType(attr, node.attributes ? node.attributes[attr] : '') === 'text',
                  'empty-value': !(node.attributes && node.attributes[attr]) && node.attributes && node.attributes[attr] !== false && node.attributes && node.attributes[attr] !== 0
                }"
                :title="getFullText(node.attributes ? node.attributes[attr] : '')"
              >
                <template v-if="node.attributes && node.attributes[attr] !== undefined && node.attributes[attr] !== null && node.attributes[attr] !== ''">
                  {{ formatAttributeDisplay(node.attributes[attr]) }}
                </template>
                <template v-else>
                  <span class="add-hint">点击添加</span>
                </template>
              </div>
              
              <!-- 编辑模式输入框 -->
              <div 
                v-if="Number(index) === editRowIndex && editAttributeName === attr"
                class="edit-input"
              >
                <!-- 复选框 -->
                <input
                  v-if="getInputType(attr, node.attributes ? node.attributes[attr] : '') === 'checkbox'"
                  type="checkbox"
                  :checked="node.attributes && node.attributes[attr] === true"
                  @change="(e: Event) => handleInputChange(Number(index), attr, e, 'checkbox')"
                  @blur="(e: Event) => handleInputBlur(Number(index), attr, e, 'checkbox')"
                  class="checkbox-input"
                  autofocus
                />
                
                <!-- 日期选择器 -->
                <input
                  v-else-if="getInputType(attr, node.attributes ? node.attributes[attr] : '') === 'date'"
                  type="date"
                  :value="normalizeValue(node.attributes ? node.attributes[attr] : '', 'date')"
                  @change="(e: Event) => handleInputChange(Number(index), attr, e, 'date')"
                  @blur="(e: Event) => handleInputBlur(Number(index), attr, e, 'date')"
                  @keypress="(e: KeyboardEvent) => handleKeyPress(Number(index), attr, e, 'date')"
                  class="date-input"
                  autofocus
                />
                
                <!-- 时间选择器 -->
                <input
                  v-else-if="getInputType(attr, node.attributes ? node.attributes[attr] : '') === 'time'"
                  type="time"
                  :value="normalizeValue(node.attributes ? node.attributes[attr] : '', 'time')"
                  @change="(e: Event) => handleInputChange(Number(index), attr, e, 'time')"
                  @blur="(e: Event) => handleInputBlur(Number(index), attr, e, 'time')"
                  @keypress="(e: KeyboardEvent) => handleKeyPress(Number(index), attr, e, 'time')"
                  class="time-input"
                  autofocus
                />
                
                <!-- 日期时间选择器 -->
                <input
                  v-else-if="getInputType(attr, node.attributes ? node.attributes[attr] : '') === 'datetime-local'"
                  type="datetime-local"
                  :value="normalizeValue(node.attributes ? node.attributes[attr] : '', 'datetime-local')"
                  @change="(e: Event) => handleInputChange(Number(index), attr, e, 'datetime-local')"
                  @blur="(e: Event) => handleInputBlur(Number(index), attr, e, 'datetime-local')"
                  @keypress="(e: KeyboardEvent) => handleKeyPress(Number(index), attr, e, 'datetime-local')"
                  class="datetime-input"
                  autofocus
                />
                
                <!-- 数字输入框 -->
                <input
                  v-else-if="getInputType(attr, node.attributes ? node.attributes[attr] : '') === 'number'"
                  type="number"
                  :value="node.attributes ? node.attributes[attr] : ''"
                  @change="(e: Event) => handleInputChange(Number(index), attr, e, 'number')"
                  @blur="(e: Event) => handleInputBlur(Number(index), attr, e, 'number')"
                  @keypress="(e: KeyboardEvent) => handleKeyPress(Number(index), attr, e, 'number')"
                  class="number-input"
                  autofocus
                />
                
                <!-- 文本输入框 -->
                <input
                  v-else
                  type="text"
                  :value="node.attributes ? node.attributes[attr] : ''"
                  @change="(e: Event) => handleInputChange(Number(index), attr, e, 'text')"
                  @blur="(e: Event) => handleInputBlur(Number(index), attr, e, 'text')"
                  @keypress="(e: KeyboardEvent) => handleKeyPress(Number(index), attr, e, 'text')"
                  placeholder="输入值"
                  class="text-input"
                  autofocus
                />
              </div>
            </td>
          </tr>
          
          <!-- 空状态 -->
          <tr v-if="data.length === 0" class="empty-row">
            <td :colspan="attributes.length + 3" class="empty-cell">
              <div class="empty-state">
                <i class="fa fa-inbox"></i>
                <p>暂无数据</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
/* 保持原有的CSS样式不变 */
.bg {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--backgroundColor);
  overflow: hidden;
  border-right: 1px solid var(--borderColor);
  box-sizing: border-box;
}

.menu {
  height: 40px;
  min-height: 40px;
  max-height: 40px;
  border-bottom: 1px solid var(--borderColor);
  flex-shrink: 0;
  padding: 0;
}

.menu ul {
  margin: 0;
  padding: 0 10px;
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
  padding: 0 10px;
}

.path-info i {
  color: var(--primaryColor);
}

.menu-tools {
  display: flex;
  padding: 0 5px;
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

.tab_content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0;
  background: var(--backgroundColor);
}

table {
  width: 100%;
  min-width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  table-layout: fixed;
}

thead {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--menuColor);
}

thead th {
  padding: 6px 4px;
  text-align: left;
  font-weight: 600;
  color: var(--fontActiveColor);
  border-bottom: 2px solid var(--borderColor);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  height: 32px;
  vertical-align: middle;
}

.fixed-col {
  position: sticky;
  background: inherit;
  z-index: 5;
}

.fixed-col.index {
  left: 0;
  width: 35px;
  min-width: 35px;
  text-align: center;
  padding: 0 2px !important;
}

.fixed-col.action {
  left: 35px;
  width: 40px;
  min-width: 40px;
  text-align: center;
  padding: 0 2px !important;
}

.fixed-col.name {
  left: 75px;
  width: 120px;
  min-width: 120px;
  max-width: 120px;
  padding: 0 6px !important;
}

.attribute-col {
  min-width: 80px;
  max-width: 120px;
  width: auto;
  padding: 0 !important;
  cursor: pointer;
  position: relative;
  height: 32px;
  overflow: hidden;
}

.attribute-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  width: 100%;
  height: 100%;
  padding: 0 4px;
}

.attribute-header span {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11px;
  white-space: nowrap;
}

tbody tr {
  border-bottom: 1px solid rgba(var(--borderColor-rgb, 128, 128, 128), 0.1);
  transition: background-color 0.2s;
  height: 32px;
}

tbody tr:hover {
  background-color: var(--menuHoverColor);
}

tbody tr.hover-row {
  background-color: rgba(var(--primaryColor-rgb, 0, 123, 255), 0.05);
}

td {
  padding: 0;
  text-align: left;
  vertical-align: middle;
  border-bottom: 1px solid rgba(var(--borderColor-rgb, 128, 128, 128), 0.1);
  height: 32px;
  max-height: 32px;
  overflow: hidden;
  white-space: nowrap;
}

/* 属性值显示 - 优化文本显示 */
.attribute-value {
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11px;
  line-height: 1.3;
  padding: 0 3px;
  height: 100%;
  width: 100%;
  transition: all 0.2s;
  cursor: pointer;
  text-align: center;
  word-break: break-all;
}

/* 文件名文本样式 */
.filename-text {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  line-height: 1.3;
  padding: 0 2px;
  height: 100%;
  display: flex;
  align-items: center;
}

.status-true {
  color: #28a745;
  background: rgba(40, 167, 69, 0.08);
  font-weight: 500;
}

.status-false {
  color: #6c757d;
  opacity: 0.5;
}

.date-value {
  color: #17a2b8;
  font-family: monospace;
  font-size: 10px;
}

.datetime-value {
  color: #fd7e14;
  font-family: monospace;
  font-size: 10px;
}

.time-value {
  color: #20c997;
  font-family: monospace;
  font-size: 10px;
}

.number-value {
  color: #6f42c1;
  text-align: center;
  font-family: monospace;
  font-size: 11px;
}

/* 文本值样式 - 确保文本被截断 */
.text-value {
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-value {
  color: var(--borderColor);
  font-style: italic;
  opacity: 0.6;
}

.add-hint {
  color: var(--primaryColor);
  font-size: 10px;
  opacity: 0.7;
}

.action-buttons {
  display: flex;
  gap: 6px;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
}

.folder-icon, .file-icon {
  cursor: pointer;
  font-size: 12px;
  padding: 2px;
  border-radius: 2px;
  transition: all 0.2s;
  color: var(--fontColor);
}

.folder-icon:hover {
  color: var(--primaryColor);
  background: rgba(var(--primaryColor-rgb, 0, 123, 255), 0.1);
}

.file-icon:hover {
  color: #28a745;
  background: rgba(40, 167, 69, 0.1);
}

.edit-input {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
  padding: 0 2px;
  box-sizing: border-box;
}

.edit-input input {
  width: 100%;
  height: 24px;
  padding: 0 4px;
  border: 1px solid var(--borderColor);
  border-radius: 2px;
  background: var(--backgroundColor);
  color: var(--fontColor);
  font-size: 11px;
  outline: none;
  transition: all 0.2s;
  box-sizing: border-box;
  line-height: 24px;
}

.edit-input input:focus {
  border-color: var(--primaryColor);
  box-shadow: 0 0 0 1px rgba(var(--primaryColor-rgb, 0, 123, 255), 0.2);
}

.edit-input input.checkbox-input {
  width: auto;
  height: auto;
  margin: 0;
  transform: scale(0.9);
  cursor: pointer;
}

.edit-input input.date-input,
.edit-input input.datetime-input,
.edit-input input.time-input {
  font-family: monospace;
  font-size: 10px;
}

.edit-input input.datetime-input {
  min-width: 140px;
}

.edit-input input.number-input {
  text-align: right;
  font-family: monospace;
  font-size: 11px;
}

.empty-row {
  border-bottom: none;
}

.empty-cell {
  text-align: center;
  padding: 40px 20px !important;
  border-bottom: none;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--borderColor);
}

.empty-state i {
  font-size: 32px;
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: 12px;
}

.tab_content::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.tab_content::-webkit-scrollbar-track {
  background: transparent;
}

.tab_content::-webkit-scrollbar-thumb {
  background-color: rgba(var(--borderColor-rgb, 128, 128, 128), 0.3);
  border-radius: 3px;
}

.tab_content::-webkit-scrollbar-thumb:hover {
  background-color: rgba(var(--borderColor-rgb, 128, 128, 128), 0.5);
}

@media (max-width: 768px) {
  .fixed-col.name {
    width: 100px;
    min-width: 100px;
    max-width: 100px;
  }
  
  .attribute-col {
    min-width: 70px;
    max-width: 100px;
  }
}
</style>