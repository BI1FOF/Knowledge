<template>
<div class="bg">
  <!-- 主视图切换 -->
  <div class="header">
    <div class="header-left">
      <!-- 视图切换按钮 -->
      <button 
        v-for="view in viewModes" 
        :key="view.id"
        :class="{ active: currentView === view.id }"
        @click="setCurrentView(view.id)"
        :title="view.title">
        <i :class="view.icon"></i>
      </button>
      <button v-if="currentView === 'waterfall'" @click="toggleWaterfallLayout" class="toolbar-action-btn">
        <i class="fa" :class="waterfallLayout === 'masonry' ? 'fa-th-large' : 'fa-list'"></i>
      </button>
      <button v-if="currentView === 'tree'" @click="expandAll" class="toolbar-action-btn">
        <i class="fa fa-expand"></i>
      </button>
      <button v-if="currentView === 'tree'" @click="collapseAll" class="toolbar-action-btn">
        <i class="fa fa-compress"></i>
      </button>
      <button @click="prev" v-if="currentView === 'month' || currentView === 'week'">
        <i class="fa fa-chevron-left"></i>
      </button>
      <button @click="next" v-if="currentView === 'month' || currentView === 'week'">
        <i class="fa fa-chevron-right"></i>
      </button>
    </div>
    
    <div class="header-center">
      <!-- 视图标题 -->
      <span v-if="currentView === 'month'">{{ currentMonth }}</span>
      <span v-else-if="currentView === 'week'">{{ formatWeekRange(currentDate) }}</span>
      <span v-else>{{ filteredItems.length }}</span>
    </div>
    
    <div class="header-right">
      <!-- 搜索框 -->
      <input 
        type="text" 
        v-model="searchText" 
        :placeholder="getSearchPlaceholder()" 
        class="search">
       
      <button 
        v-for="status in statusOptions" 
        :key="status.value"
        :class="{ active: selectedStatuses.includes(status.value) }"
        @click="toggleStatusFilter(status.value)"
        :title="status.label"
        class="status-filter-btn">
        <i :class="status.icon"></i>
      </button>
      
      <!-- 视图控制 -->
      <button @click="addItem" :title="`添加项目`">
        <i class="fa fa-plus"></i>
      </button>
      <button @click="toggleDataSet" :class="{ active: showDataSet }" title="数据管理">
        <i class="fa fa-cogs"></i>
      </button>
    </div>
  </div>
  
  <div class="home">
    <!-- 瀑布流视图 -->
    <div class="container container-flex" v-if="currentView === 'waterfall'">
      <div class="grid-scroll scoll" ref="waterfallGrid" @scroll="handleScroll">
        <!-- 瀑布流网格布局 -->
        <div v-if="waterfallLayout === 'masonry'" 
            class="grid-container" 
            :style="{ '--column-count': columnCount }">
          <div v-for="column in columnItems" :key="`column-${column.index}`" class="grid-column">
            <div v-for="item in column.items" 
                :key="item.id"
                class="grid-card"
                :style="{ 'borderLeft': 'solid 5px '+ (item.color || '#e9ecef') }"
                @click="selectItem(item)">
              <div class="grid-card-content scoll">
                <div class="grid-card-title">
                  <div style="flex:1">
                    {{ item.title }}
                  </div>
                  <div v-if="item.children && item.children.length > 0" class="sub-items-count">
                    <i class="fa fa-sitemap"></i> {{ item.children.length }} 子项
                  </div>
                </div>
                <div class="grid-card-meta">
                  <span class="grid-status-icon" :title="item.status">
                    <i :class="getStatusIcon(item.status)"></i>
                  </span>
                  <span class="grid-card-time">
                    {{ formatItemTime(item.createdTime) }}
                  </span>
                </div>
                
                <div v-if="item.startTime && item.endTime" class="grid-card-dates">
                  <div class="date-range">
                    <i class="fa fa-calendar"></i>
                    <span class="date-text">{{ formatDateForDisplay(item.startTime) }}</span>
                    <span class="date-separator"> - </span>
                    <span class="date-text">{{ formatDateForDisplay(item.endTime) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 瀑布流列表布局 -->
        <div v-else class="list-container">
          <div v-for="item in filteredItems" 
              :key="item.id"
              class="list-item"
              :style="{ 'borderLeft': 'solid 5px '+ (item.color || '#e9ecef') }"
              @click="selectItem(item)">
            <div class="list-item-content">
              <div class="list-item-title">{{ item.title }}</div>
              <div class="list-item-meta">
                <span class="list-status-icon" :title="item.status">
                  <i :class="getStatusIcon(item.status)"></i>
                </span>
                <span class="list-item-date">
                  {{ formatItemTime(item.createdTime) }}
                </span>
                <span v-if="item.startTime && item.endTime" class="list-item-dates">
                  <i class="fa fa-calendar"></i> 
                  {{ formatDateForDisplay(item.startTime) }} - {{ formatDateForDisplay(item.endTime) }}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- 空状态 -->
        <div v-if="filteredItems.length === 0" class="empty-state full-size">
          <i class="fa" :class="getViewIcon()"></i>
          <p v-if="!workspacePath">请先选择工作区</p>
          <p v-else>暂无项目</p>
          <p class="empty-hint" v-if="workspacePath">点击右上角的 + 按钮添加项目</p>
        </div>
      </div>
    </div>
    
    <!-- 树状图视图 -->
    <div class="container container-flex" v-if="currentView === 'tree'">
      <div class="tree-container scoll">
        <div class="tree-view">
          <draggable 
            v-model="treeItems"
            group="tree-items"
            item-key="id"
            :animation="150"
            ghost-class="tree-ghost"
            drag-class="tree-drag"
            @change="onTopLevelDragEnd"
            class="tree-root">
            <template #item="{ element }">
              <tree-node 
                :item="element"
                :depth="0"
                :selected-item="selectedItem"
                @select="selectItem"
                @addChild="addChildItem"
                @delete="deleteItem"
                @moveToPending="moveToPending"
                @moveToInspiration="moveToInspiration"
                @toggleExpand="toggleExpand"
                @childrenChanged="handleChildrenChanged"
                @itemMoved="handleItemMoved"
              />
            </template>
          </draggable>
        </div>
        
        <!-- 空状态 -->
        <div v-if="treeItems.length === 0" class="empty-state full-size">
          <i class="fa fa-sitemap"></i>
          <p v-if="!workspacePath">请先选择工作区</p>
          <p v-else-if="selectedStatuses.length > 0 || searchText">没有符合条件的项目</p>
          <p v-else>暂无项目</p>
        </div>
      </div>
    </div>
    
    <!-- 月视图 -->
    <div class="container" v-if="currentView === 'month'">
      <table class="month-table">
        <thead>
          <tr>
            <th v-for="day in daysOfWeek" :key="day">{{ day }}</th>
          </tr>
        </thead>
        <tbody class="month-table-body">
          <tr v-for="(week,w) in weeks" :key="w">
            <td v-for="(date,d) in week" :key="d" 
                :class="{
                  'date-cell': true,
                  'today': isToday(date.dateObject),
                  'selected-date': isSameDay(selectedDate, date.dateObject)
                }" 
                @click="changeSelectedDate(date.dateObject)">
              <div class="date-title" :class="{ today: isToday(date.dateObject) }">{{ date.day }}</div>
              <div class="date-items scoll">
                <div v-for="item in getItemsForDate(date.dateObject)" 
                     :key="item.id" 
                     class="task-span"
                     :style="getItemSpanStyle(item, date.dateObject)"
                     @click.stop="selectItem(item)">
                  <div class="task-span-content">
                    <span class="task-span-title">{{ item.title }}</span>
                    <span class="task-status-icon" :title="item.status">
                      <i :class="getStatusIcon(item.status)"></i>
                    </span>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- 周视图 -->
    <div class="container container-flex" v-if="currentView === 'week'">
      <div class="week-calendar">
        <div class="week-days">
          <div v-for="day in weekDays" :key="day.date" 
            class="week-day"
            :class="{
              'today': day.today,
              'selected-day': day.selected
            }" 
            @click="changeSelectedDate(day.time)">
            <span class="week-day-name">{{ day.name }}</span>
            <span class="week-day-date">{{ day.date }}</span>
            <span class="week-day-todos" v-if="day.todos>0">({{ day.todos }})</span>
          </div>
        </div>
      </div>
      <div class="tasks scoll full-height">
        <div v-for="item in filteredWeekItems" 
          :key="item.id"
          @click="selectItem(item)">
          <div class="task" 
              :class="{ active: selectedItem && selectedItem.id === item.id }"
              :style="{ '--task-color': item.color || '#e9ecef' }">
            <div class="task-header">
              <div class="task-title">{{ item.title }}</div>
            </div>
            <div class="task-dates">
              <span class="task-status-icon" :title="item.status">
                <i :class="getStatusIcon(item.status)"></i>
              </span>
              {{ formatDateForDisplay(item.startTime) }} - {{ formatDateForDisplay(item.endTime) }}
            </div>
          </div>
        </div>
        
        <!-- 空状态 -->
        <div v-if="filteredWeekItems.length === 0" class="empty-state">
          <i class="fa fa-calendar"></i>
          <p v-if="!workspacePath">请先选择工作区</p>
          <p v-else>本周没有任务</p>
        </div>
      </div>
    </div>
    
    <!-- 右侧面板：属性编辑和DataSet共享位置 -->
    <div class="right-panel" v-if="selectedItem || showDataSet">
      <!-- 属性编辑界面 - 保持原有紧凑样式 -->
      <div class="property scoll" v-if="selectedItem && !showDataSet">
        <div class="property-header">
          <h3 class="property-title">项目属性</h3>
          <div class="property-close-btn" @click="clearSelected">
            <i class="fa fa-times"></i>
          </div>
        </div>
        
        <div class="property-content">
          <!-- 标题编辑 - 只在焦点离开时保存 -->
          <div class="property-field">
            <textarea 
              :value="selectedItemTitle" 
              class="property-input scoll"
              @input="onTitleInput($event)"
              @blur="onBlur"
              :placeholder="'项目标题...'"
              rows="2">
            </textarea>
          </div>
          
          <!-- 正文编辑 - 只在焦点离开时保存 -->
          <div class="property-field">
            <textarea 
              :value="selectedItemContent"
              class="property-input scoll"
              @input="onContentInput($event)"
              @blur="onBlur"
              :placeholder="'详细说明...'"
              rows="6">
            </textarea>
          </div>

          <!-- 颜色选择 -->
          <div class="property-field">
            <div class="color-picker">
              <div class="color-options">
                <div 
                  v-for="color in colorOptions" 
                  :key="color"
                  class="color-option"
                  :style="{ backgroundColor: color }"
                  :class="{ selected: selectedItem.color === color }"
                  @click="selectColor(color, selectedItem)">
                  <i v-if="selectedItem.color === color" class="fa fa-check color-option-check"></i>
                </div>
              </div>
              <input 
                type="color" 
                :value="selectedItem.color || colorOptions[0]"
                @input="(e) => {
                  const target = e.target as HTMLInputElement;
                  const color = target?.value;
                  if (color && selectedItem) {
                    selectedItem.color = color;
                    saveIfNeeded('颜色更改');
                  }
                }"
                class="color-input">
            </div>
          </div>

          <!-- 状态选择 -->
          <div class="property-field">
            <label class="property-label">状态</label>
            <select :value="selectedItem?.status" 
              class="property-select"
              @change="updateItemStatus($event)">
              <option value="灵感">灵感</option>
              <option value="规划">规划</option>
              <option value="待办">待办</option>
              <option value="进行中">进行中</option>
              <option value="已完成">已完成</option>
            </select>
          </div>
          
          <!-- 开始时间 -->
          <div v-if="selectedItem?.status !== '灵感'" class="property-field">
            <label class="property-label">开始时间</label>
            <input type="date" 
              class="property-date-input"
              :value="formatDateForInput(selectedItem?.startTime)" 
              @change="(e) => {
                updateStartTime(e, selectedItem!);
              }">
          </div>

          <!-- 结束时间 -->
          <div v-if="selectedItem?.status !== '灵感'" class="property-field">
            <label class="property-label">结束时间</label>
            <input type="date" 
              class="property-date-input"
              :value="formatDateForInput(selectedItem?.endTime)" 
              @change="(e) => {
                updateEndTime(e, selectedItem!);
              }">
          </div>
          
          <!-- 删除按钮 -->
          <div class="property-field">
            <div class="property-btn" @click="deleteItem(selectedItem!)">
              <i class="fa fa-trash"></i> 删除
            </div>
          </div>

          <!-- 打开文件夹按钮 -->
          <div class="property-field" v-if="selectedItem?.filePath">
            <div class="property-btn" @click="openInFolder(selectedItem)">
              <i class="fa fa-folder-open"></i> 打开所在文件夹
            </div>
          </div>
        </div>
      </div>
      
      <!-- DataSet 组件 -->
      <DataSet 
        v-if="showDataSet" 
        @data-imported="handleDataImported"
        @data-cleared="handleDataCleared"
        :workspacePath="workspacePath"
        @workspace-changed="handleWorkspaceChanged"
      />
    </div>
  </div>
</div>
</template>

<style scoped>
.bg {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.home {
  width: 100%;
  height: calc(100% - 40px);
  flex: 1;
  display: flex;
  flex-direction: row;
  overflow: hidden;
}

/* ========== 通用头部 ========== */
.header {
  display: flex;
  height: 40px;
  border-bottom: var(--borderColor) 1px solid;
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
  padding: 0 0px 0px 5px;
}

.header-left button,
.header-right button {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 5px;
  border: 1px solid var(--borderColor);
  background: var(--backgroundColor);
  color: var(--fontColor);
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
}

.header-left button:hover,
.header-right button:hover {
  background: var(--menuActiveColor);
}

.header-left button.active,
.header-right button.active {
  background: var(--menuActiveColor);
  border-color: var(--fontActiveColor);
  color: var(--fontActiveColor);
}

.header-center {
  flex: 1;
  user-select: none;
  text-align: center;
  line-height: 40px;
}

.status-filter-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--borderColor);
  background: var(--backgroundColor);
  color: var(--fontColor);
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
  position: relative;
}

.status-filter-btn:hover {
  background: var(--menuActiveColor);
}

.status-filter-btn.active {
  background: var(--menuActiveColor);
  border-color: var(--fontActiveColor);
  color: var(--fontActiveColor);
}

.status-filter-btn.active::after {
  content: '';
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 4px;
  background-color: var(--fontActiveColor);
  border-radius: 50%;
}

.search {
  flex: 1;
  min-width: 50px;
  padding: 1px 4px;
  margin: 0px;
  margin-right:5px;
  border-radius: 4px;
  background-color: var(--backgroundColor);
  border: 1px solid var(--borderColor);
  color: var(--fontColor);
}

/* ========== 通用容器 ========== */
.container {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  height: calc(100% - 0px);
}

.container-flex {
  flex: 1;
}

/* ========== 瀑布流视图 ========== */
.grid-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 5px;
  position: relative;
}

.grid-container {
  display: grid;
  grid-template-columns: repeat(var(--column-count, 3), 1fr);
  gap: 5px;
  padding-bottom: 5px;
}

.grid-column {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.grid-card {
  position: relative;
  border: 1px solid var(--borderColor);
  border-left: 5px solid var(--borderColor);
  border-radius: 5px;
  padding: 3px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--backgroundColor);
  width: 100%;
  box-sizing: border-box;
  break-inside: avoid;
}

.grid-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.grid-card-content {
  flex: 1;
  margin: 3px 0px;
  line-height: 1.5;
  font-size: 14px;
  color: var(--fontColor);
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: break-word;
  max-height: 200px;
  overflow-y: auto;
}

.grid-card-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
  color: var(--fontColor);
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  flex-direction: row;
  line-clamp: 3;
  max-height: 4.5em;
}

.grid-card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2px;
  font-size: 11px;
  text-align: right;
}

.grid-card-dates {
  margin: 0;
  font-size: 11px;
  color: var(--fontColor);
  opacity: 0.8;
}

.date-range {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--menuActiveColor);
  border-radius: 3px;
  padding: 3px 6px;
}

.date-range i {
  font-size: 10px;
}

.date-text {
  white-space: nowrap;
}

.date-separator {
  opacity: 0.6;
}

.list-container {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding-bottom: 5px;
}

.list-item {
  border: 1px solid var(--borderColor);
  border-left: 5px solid var(--borderColor);
  border-radius: 5px;
  padding: 5px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--backgroundColor);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.list-item:hover {
  transform: translateX(2px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.list-item-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.list-item-title {
  flex: 1;
  font-size: 14px;
  color: var(--fontColor);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.list-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--fontColor);
  opacity: 0.8;
  flex-wrap: wrap;
  margin-top: 4px;
}

.list-item-dates {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  flex-shrink: 0;
  background: var(--menuActiveColor);
  border-radius: 3px;
  padding: 2px 6px;
}

.list-item-dates i {
  font-size: 10px;
}

/* ========== 树状图视图 ========== */
.tree-container {
  flex: 1;
  overflow-y: auto;
  padding: 5px;
  position: relative;
}

.tree-view {
  min-height: 100%;
}

.tree-root {
  min-height: 100%;
}

.tree-ghost {
  opacity: 0.5;
  background: var(--menuActiveColor);
}

.tree-drag {
  opacity: 0.8;
  transform: rotate(5deg);
  background: var(--menuActiveColor);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.sub-items-count {
  font-size: 11px;
  color: var(--fontColor);
  opacity: 0.7;
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  left:0px
}

/* ========== 月视图 ========== */
.month-table {
  width: 100%;
  height: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.month-table-body {
  height: 100%;
}

.month-table tr {
  height: 16.66%;
}

.month-table td {
  vertical-align: top;
  padding: 2px;
  width: 14.28%;
  position: relative;
  cursor: pointer;
  border: 1px solid var(--borderColor);
}

.date-cell:hover {
  border-color: var(--fontActiveColor);
}

.date-cell.today {
  opacity: 1;
}

.date-cell.selected-date {
  border: var(--fontActiveColor) 2px solid;
  opacity: 1;
}

.date-title {
  font-size: 10px;
  margin: 2px;
  color: var(--fontColor);
}

.date-title.today {
  color: var(--fontActiveColor);
}

.date-items {
  height: calc(100% - 20px);
  overflow-y: auto;
}

.task-span {
  position: relative;
  z-index: 1;
  font-size: 10px;
  cursor: pointer;
  width: calc(100% - 14px);
  border-radius: 2px;
  margin-bottom: 2px;
  padding: 4px;
  border-left: 3px solid;
}

.task-span-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.task-span-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

/* ========== 周视图 ========== */
.week-calendar {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--menuColor);
  border-bottom: 1px solid var(--borderColor);
  font-size: 10px;
  user-select: none;
  height: 40px;
}

.week-days {
  display: flex;
  justify-content: space-around;
  text-align: center;
  margin: 0px;
  flex: 1;
  height: 40px;
  line-height: normal;
}

.week-day {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: visible;
  cursor: pointer;
  position: relative;
  height:100%
}

.week-day:hover {
  background-color: var(--menuActiveColor);
}

.week-day.today {
  color: var(--fontActiveColor);
}

.week-day.selected-day {
  background-color: var(--backgroundColor);
  border-left: 1px solid var(--borderColor);
  border-right: 1px solid var(--borderColor);
}

.week-day-name {
  font-size: 10px;
  line-height: 1.2;
}

.week-day-date {
  font-size: 12px;
  line-height: 1.2;
  font-weight: bold;
}

.week-day-todos {
  position: relative;
  bottom: 0px;
  left: 0;
  right: 0;
  font-size: 9px;
  line-height: 1;
  text-align: center;
  opacity: 0.8;
  color: var(--fontColor);
}

.tasks {
  border-radius: 4px;
  overflow-y: auto;
  flex: 1;
  padding: 5px;
}

.tasks.full-height {
  height: calc(100% - 45px);
}

.task {
  display: flex;
  flex-direction: column;
  padding: 5px;
  border: 1px solid var(--borderColor);
  border-radius: 4px;
  margin-bottom: 5px;
  cursor: pointer;
  position: relative;
  border-left: 4px solid var(--task-color, var(--borderColor));
}

.task:hover {
  background: var(--menuActiveColor);
  border-color: var(--fontActiveColor);
}

.task.active {
  background: var(--menuActiveColor);
  border-color: var(--fontActiveColor);
  border-width: 1px;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.task-title {
  flex: 1;
  font-size: 14px;
  color: var(--fontColor);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0 5px;
}

.task-dates {
  font-size: 12px;
  color: var(--fontColor);
  opacity: 0.8;
  padding-left: 5px;
  white-space: nowrap;
}

/* ========== 右侧面板 ========== */
.right-panel {
  width: 200px;
  border-left: 1px solid var(--borderColor);
  background: var(--backgroundColor);
  overflow: hidden;
}

/* ========== 属性编辑界面 - 保持原有紧凑样式 ========== */
.property {
  width: calc(100% - 10px);
  height: calc(100% - 10px);
  padding: 5px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.property-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--borderColor);
}

.property-title {
  margin: 0;
  font-size: 16px;
  color: var(--fontColor);
}

.property-close-btn {
  margin: 0px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
}

.property-close-btn:hover {
  background: var(--menuActiveColor);
}

.property-content {
  flex: 1;
}

.property-field {
  margin: 5px 0px;
  display: flex;
  flex-direction: column;
}

.property-label {
  display: block;
  font-size: 12px;
  color: var(--fontColor);
  margin-bottom: 2px;
}

.property-input {
  width: calc(100% - 10px);
  min-height: 50px;
  border: 1px solid var(--borderColor);
  border-radius: 4px;
  background: var(--backgroundColor);
  color: var(--fontColor);
  font-size: 14px;
  margin: 0px;
  padding: 4px;
  resize: vertical;
  font-family: inherit;
}

.property-date-input {
  width: calc(100% - 10px);
  border: 1px solid var(--borderColor);
  border-radius: 4px;
  background: var(--backgroundColor);
  color: var(--fontColor);
  font-size: 14px;
  margin: 0px;
  padding: 4px;
}

.property-select {
  width: calc(100% - 2px);
  border: 1px solid var(--borderColor);
  border-radius: 4px;
  background: var(--backgroundColor);
  color: var(--fontColor);
  font-size: 14px;
  margin: 0px;
  padding: 6px;
}

.color-picker {
  margin: 0px;
  width: calc(100% - 0px);
}

.color-options {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  margin-bottom: 8px;
}

.color-option {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid transparent;
  transition: transform 0.2s;
}

.color-option:hover {
  transform: scale(1.1);
  border-color: var(--fontActiveColor);
}

.color-option.selected {
  border-color: var(--fontActiveColor);
}

.color-option-check {
  color: white;
  font-size: 12px;
  text-shadow: 0 0 2px rgba(0,0,0,0.5);
}

.color-input {
  width: calc(100% - 0px);
  height: 32px;
  border: 1px solid var(--borderColor);
  border-radius: 4px;
  background: var(--backgroundColor);
  cursor: pointer;
  margin: 0px;
}

.property-btn {
  width: calc(100% - 12px);
  cursor: pointer;
  padding: 5px;
  border: 1px solid var(--borderColor);
  border-radius: 4px;
  background: var(--backgroundColor);
  color: var(--fontColor);
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
}

.property-btn:hover {
  background: var(--menuActiveColor);
}

/* ========== 空状态样式 ========== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--fontColor);
  opacity: 0.5;
  text-align: center;
  padding: 40px;
}

.empty-state.full-size {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
}

.empty-state i {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-hint {
  font-size: 12px;
  margin-top: 8px;
  opacity: 0.7;
}

/* ========== 滚动条样式 ========== */
.scoll::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.scoll::-webkit-scrollbar-track {
  background: transparent;
}

.scoll::-webkit-scrollbar-thumb {
  background: var(--borderColor);
  border-radius: 3px;
}

.scoll::-webkit-scrollbar-thumb:hover {
  background: var(--fontActiveColor);
}
</style>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { usestore } from '../../store/index'
import draggable from 'vuedraggable'
import TreeNode from './TreeNode.vue'
import DataSet from './DataSet.vue'

const store = usestore()

// 类型定义
type ViewMode = 'waterfall' | 'tree' | 'week' | 'month';
type ItemStatus = '灵感' | '规划' | '待办' | '进行中' | '已完成';

interface Item {
  id: number;
  title: string;
  content?: string;
  status: ItemStatus;
  createdTime: Date;
  startTime?: Date;
  endTime?: Date;
  color?: string;
  parentId?: number;
  children?: Item[];
  expanded?: boolean;
  relatedId?: number;
  _order?: number;
  filePath?: string;
  isFolder?: boolean;
}

// 视图配置
const viewModes = [
  { id: 'waterfall' as ViewMode, title: '瀑布流', icon: 'fa fa-th-large' },
  { id: 'tree' as ViewMode, title: '树状图', icon: 'fa fa-sitemap' },
  { id: 'week' as ViewMode, title: '周视图', icon: 'fa fa-calendar' },
  { id: 'month' as ViewMode, title: '月视图', icon: 'fa fa-map-o' }
] as const;

// 状态筛选选项
const statusOptions = [
  { value: '灵感', label: '灵感', icon: 'fa fa-lightbulb-o' },
  { value: '规划', label: '规划', icon: 'fa fa-sitemap' },
  { value: '待办', label: '待办', icon: 'fa fa-clock-o' },
  { value: '进行中', label: '进行中', icon: 'fa fa-spinner' },
  { value: '已完成', label: '已完成', icon: 'fa fa-check-circle-o' }
] as const;

// 响应式变量
const currentView = ref<ViewMode>('waterfall');
const currentDate = ref(new Date());
const selectedDate = ref(new Date());
const weekDays = ref([]) as any;
const allItems = ref<Item[]>([]);
const nextId = ref(1);
const selectedItem = ref<Item | null>(null);
const selectedStatuses = ref<string[]>([]);
const searchText = ref('');
const workspacePath = ref<string>('');
const showDataSet = ref(false);

// UI状态
const waterfallGrid = ref<HTMLElement | null>(null);
const waterfallLayout = ref<'masonry' | 'list'>('masonry');
const columnCount = ref(3);
const columnItems = ref<Array<{index: number, items: Item[]}>>([]);

// 颜色选项
const colorOptions = ref([
  '#FF0000', '#00FF00', '#FF6B6B', '#4ECDC4', '#45B7D1',
  '#96CEB4', '#FFEAA7', '#DDA0DD', '#FDCB6E', '#A29BFE',
  '#FD79A8', '#00B894', '#e9ecef', '#cce5ff', '#d4edda'
]);

// 保存状态管理
let lastSavedTitle = '';
let lastSavedContent = '';
let hasUnsavedChanges = false;

// 计算属性 - 筛选项目
const filteredItems = computed(() => {
  if (!allItems.value.length) return [];
  
  let result = allItems.value;
  
  if (selectedStatuses.value.length > 0) {
    result = result.filter((item: Item) => selectedStatuses.value.includes(item.status));
  }
  
  if (searchText.value) {
    const searchTerm = searchText.value.toLowerCase();
    result = result.filter((item: Item) => 
      item.title?.toLowerCase().includes(searchTerm) ||
      item.content?.toLowerCase().includes(searchTerm)
    );
  }
  
  return result.sort((a: Item, b: Item) => {
    if (currentView.value === 'waterfall' || currentView.value === 'tree') {
      return new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime();
    } else {
      const aStart = a.startTime ? new Date(a.startTime).getTime() : 0;
      const bStart = b.startTime ? new Date(b.startTime).getTime() : 0;
      return aStart - bStart;
    }
  });
});

// 周视图筛选项目
const filteredWeekItems = computed(() => {
  const selected = new Date(selectedDate.value);
  selected.setHours(0, 0, 0, 0);
  
  let result = allItems.value.filter((item: Item) => {
    if (!item.startTime || !item.endTime) return false;
    
    const start = new Date(item.startTime);
    const end = new Date(item.endTime);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    
    return selected >= start && selected <= end;
  });
  
  if (selectedStatuses.value.length > 0) {
    result = result.filter((item: Item) => selectedStatuses.value.includes(item.status));
  }
  
  if (searchText.value) {
    const searchTerm = searchText.value.toLowerCase();
    result = result.filter((item: Item) => 
      item.title?.toLowerCase().includes(searchTerm) ||
      item.content?.toLowerCase().includes(searchTerm)
    );
  }
  
  return result.sort((a: Item, b: Item) => {
    const aStart = a.startTime ? new Date(a.startTime).getTime() : 0;
    const bStart = b.startTime ? new Date(b.startTime).getTime() : 0;
    return aStart - bStart;
  });
});

// 树状图项目计算
const treeItems = computed({
  get() {
    if (!allItems.value.length) return [];
    
    // 先根据筛选条件过滤项目，但注意：这里需要保持父子关系
    // 所以我们不能直接过滤，而是需要先找出所有符合条件的项目及其祖先
    let visibleItems = new Set<number>();
    
    if (selectedStatuses.value.length > 0 || searchText.value) {
      // 找出所有符合条件的项目
      allItems.value.forEach(item => {
        const statusMatch = selectedStatuses.value.length === 0 || selectedStatuses.value.includes(item.status);
        const searchMatch = !searchText.value || 
          item.title?.toLowerCase().includes(searchText.value.toLowerCase()) ||
          item.content?.toLowerCase().includes(searchText.value.toLowerCase());

        if (statusMatch && searchMatch) {
          // 添加这个项目及其所有祖先（显式检查 parentId 是否未定义）
          let current: Item | undefined = item;
          while (current) {
            visibleItems.add(current.id);
            if (current.parentId !== undefined && current.parentId !== null) {
              current = allItems.value.find(i => i.id === current!.parentId);
            } else {
              break;
            }
          }
        }
      });
    }
    
    // 构建树结构
    const buildTreeFromItems = (parentId?: number): Item[] => {
      return allItems.value
        .filter(item => {
          // 过滤父子关系（严格判断 parentId 是否未定义）
          if (parentId === undefined) {
            return item.parentId === undefined || item.parentId === null;
          }
          return item.parentId === parentId;
        })
        .filter(item => {
          // 如果有筛选条件，只显示可见的项目
          if (visibleItems.size > 0) {
            return visibleItems.has(item.id);
          }
          return true;
        })
        .sort((a, b) => {
          const aOrder = a._order !== undefined ? a._order : a.id;
          const bOrder = b._order !== undefined ? b._order : b.id;
          return aOrder - bOrder;
        })
        .map(item => {
          // 递归获取子项
          const children = buildTreeFromItems(item.id);
          
          return {
            ...item,
            expanded: item.expanded !== undefined ? item.expanded : true,
            children: children
          };
        });
    };
    
    return buildTreeFromItems();
  },
  set(newItems: Item[]) {
    // 只在拖拽排序时保存，不保存展开/折叠状态
    const hasOrderChanged = newItems.some((item, index) => {
      const existingItem = allItems.value.find(i => i.id === item.id);
      return existingItem && existingItem._order !== index;
    });
    
    if (hasOrderChanged) {
      newItems.forEach((item, index) => {
        const existingItem = allItems.value.find(i => i.id === item.id);
        if (existingItem) {
          existingItem._order = index;
          existingItem.parentId = undefined;
          saveItemToFile(existingItem);
        }
      });
      // 强制刷新
      allItems.value = [...allItems.value];
    }
  }
});

// 日期相关计算属性
const currentYear = computed(() => currentDate.value.getFullYear());
const currentMonth = computed(() => {
  return currentDate.value.toLocaleString('default', { month: 'long'}) + (' ' + currentYear.value);
});
const firstDayOfMonth = computed(() => new Date(currentYear.value, currentDate.value.getMonth(), 1));
const daysOfWeek = computed(() => ['日', '一', '二', '三', '四', '五', '六']);

const dates = computed(() => {
  const datesArr: any[] = [];
  const firstDay = new Date(firstDayOfMonth.value);
  const firstDayOfWeek = firstDay.getDay();
  const prevMonthLastDate = new Date(currentYear.value, currentDate.value.getMonth(), 0).getDate();
  
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthLastDate - i;
    const prevMonthDate = new Date(currentYear.value, currentDate.value.getMonth() - 1, day);
    datesArr.push({
      day,
      isCurrentMonth: false,
      dateObject: prevMonthDate
    });
  }
  
  const lastDay = new Date(currentYear.value, currentDate.value.getMonth() + 1, 0);
  const lastDate = lastDay.getDate();
  for (let i = 1; i <= lastDate; i++) {
    const currentDateObj = new Date(currentYear.value, currentDate.value.getMonth(), i);
    datesArr.push({
      day: i,
      isCurrentMonth: true,
      dateObject: currentDateObj
    });
  }
  
  const remainingDays = 7 - (datesArr.length % 7);
  if (remainingDays < 7) {
    for (let i = 1; i <= remainingDays; i++) {
      const nextMonthDate = new Date(currentYear.value, currentDate.value.getMonth() + 1, i);
      datesArr.push({
        day: i,
        isCurrentMonth: false,
        dateObject: nextMonthDate
      });
    }
  }
  
  return datesArr;
});

const weeks = computed(() => {
  const weeksArr: any[][] = [];
  const datesArr = [...dates.value];
  while (datesArr.length) {
    weeksArr.push(datesArr.splice(0, 7));
  }
  return weeksArr;
});

const selectedItemTitle = computed({
  get: () => selectedItem.value?.title || '',
  set: (value: string) => {
    if (selectedItem.value) {
      selectedItem.value.title = value;
    }
  }
});

// 选中项目的正文内容
const selectedItemContent = computed({
  get: () => selectedItem.value?.content || '',
  set: (value: string) => {
    if (selectedItem.value) {
      selectedItem.value.content = value;
    }
  }
});

// ========== 工具栏函数 ==========
function toggleDataSet() {
  if (showDataSet.value) {
    // 关闭 DataSet 前检查是否需要保存
    saveIfNeeded('关闭DataSet');
  }
  showDataSet.value = !showDataSet.value;
  if (showDataSet.value) {
    selectedItem.value = null;
  }
}

// ========== 路径处理函数 ==========

// 标准化路径
function normalizePath(filePath: string): string {
  if (!filePath) return '';
  
  let normalized = filePath.replace(/\//g, '\\');
  normalized = normalized.replace(/^([a-zA-Z]):\\([a-zA-Z]):/, '$1:\\');
  
  if (normalized.match(/^[a-zA-Z]:\\[a-zA-Z]:/)) {
    normalized = normalized.substring(0, 3) + normalized.substring(4);
  }
  
  normalized = normalized.replace(/\\\\+/g, '\\');
  return normalized;
}

// 路径拼接
function pathJoin(...segments: string[]): string {
  const validSegments = segments.filter(s => s && s.length > 0);
  if (validSegments.length === 0) return '';
  
  let result = validSegments[0];
  
  for (let i = 1; i < validSegments.length; i++) {
    const segment = validSegments[i];
    
    if (result.endsWith('/') || result.endsWith('\\')) {
      result = result.slice(0, -1);
    }
    
    const cleanSegment = segment.startsWith('/') || segment.startsWith('\\') 
      ? segment.slice(1) 
      : segment;
    
    result = `${result}\\${cleanSegment}`;
  }
  
  if (result.match(/^[a-zA-Z]:\\[a-zA-Z]:/)) {
    result = result.replace(/^([a-zA-Z]):\\.*/, '$1:\\');
  }
  
  return result;
}

// ========== 文件系统相关函数 ==========

// 选择工作区
async function selectWorkspace() {
  const folderPath = await window.ipcRenderer.invoke('openFolderDialog');
  if (folderPath) {
    workspacePath.value = normalizePath(folderPath);
    await loadWorkspace();
  }
}

// 加载工作区
async function loadWorkspace() {
  if (!workspacePath.value) return;
  
  try {
    const { fileList, relationList } = await window.ipcRenderer.invoke(
      'getFilesRelation', 
      workspacePath.value, 
      10
    );
    
    const items: Item[] = [];
    let maxId = 0;
    
    for (const file of fileList) {
      const isFolder = file.type === 'folder';
      const isReadme = file.label === '.README.md';
      
      if (isReadme) continue;
      
      let item: Item;
      
      if (isFolder) {
        const readmePath = pathJoin(file.path, '.README.md');
        const metadata = await getFileMetadata(readmePath);
        
        item = {
          id: file.id,
          title: file.label,
          status: metadata?.status || '灵感',
          createdTime: metadata?.createdTime ? new Date(metadata.createdTime) : new Date(),
          color: metadata?.color || getRandomColor(),
          expanded: true,
          isFolder: true,
          filePath: normalizePath(file.path)
        };
        
        if (metadata?.startTime) item.startTime = new Date(metadata.startTime);
        if (metadata?.endTime) item.endTime = new Date(metadata.endTime);
        if (metadata?.order !== undefined) item._order = metadata.order;
        
        // 读取文件夹的正文内容（从 .README.md 中）
        try {
          const readmeContent = await window.ipcRenderer.invoke('readFile', readmePath);
          // 提取 frontmatter 之后的内容
          const lines = readmeContent.split('\n');
          let inFrontmatter = false;
          let frontmatterEnded = false;
          let contentLines: string[] = [];
          
          for (const line of lines) {
            if (line.trim() === '---' && !inFrontmatter && !frontmatterEnded) {
              inFrontmatter = true;
              continue;
            }
            if (line.trim() === '---' && inFrontmatter) {
              inFrontmatter = false;
              frontmatterEnded = true;
              continue;
            }
            if (!inFrontmatter && frontmatterEnded) {
              contentLines.push(line);
            }
          }
          
          item.content = contentLines.join('\n').trim();
        } catch (error) {
          console.error(`读取文件夹正文失败: ${readmePath}`, error);
        }
        
      } else {
        const metadata = await getFileMetadata(file.path);
        
        item = {
          id: file.id,
          title: file.label.replace(/\.md$/, ''),
          status: metadata?.status || '灵感',
          createdTime: metadata?.createdTime ? new Date(metadata.createdTime) : new Date(),
          color: metadata?.color || getRandomColor(),
          expanded: true,
          isFolder: false,
          filePath: normalizePath(file.path)
        };
        
        if (metadata?.startTime) item.startTime = new Date(metadata.startTime);
        if (metadata?.endTime) item.endTime = new Date(metadata.endTime);
        if (metadata?.parentId) item.parentId = metadata.parentId;
        if (metadata?.order !== undefined) item._order = metadata.order;
        if (metadata?.relatedId) item.relatedId = metadata.relatedId;
        
        // 读取文件的正文内容
        try {
          const fileContent = await window.ipcRenderer.invoke('readFile', file.path);
          // 提取 frontmatter 之后的内容
          const lines = fileContent.split('\n');
          let inFrontmatter = false;
          let frontmatterEnded = false;
          let contentLines: string[] = [];
          
          for (const line of lines) {
            if (line.trim() === '---' && !inFrontmatter && !frontmatterEnded) {
              inFrontmatter = true;
              continue;
            }
            if (line.trim() === '---' && inFrontmatter) {
              inFrontmatter = false;
              frontmatterEnded = true;
              continue;
            }
            if (!inFrontmatter && frontmatterEnded) {
              contentLines.push(line);
            }
          }
          
          item.content = contentLines.join('\n').trim();
        } catch (error) {
          console.error(`读取文件正文失败: ${file.path}`, error);
        }
      }
      
      items.push(item);
      maxId = Math.max(maxId, file.id);
    }
    
    for (const relation of relationList) {
      const child = items.find(i => i.id === relation.target);
      if (child) {
        child.parentId = relation.source;
      }
    }
    
    allItems.value = items;
    nextId.value = maxId + 1;
    
    if (currentView.value === 'waterfall') {
      distributeItemsToColumns();
    }
    computer();
    
    //console.log(`工作区加载完成，共 ${items.length} 个项目`);
    
  } catch (error) {
    //console.error('加载工作区失败:', error);
  }
}

// 获取文件元数据
async function getFileMetadata(filePath: string): Promise<any> {
  try {
    const normalizedPath = normalizePath(filePath);
    const exists = await fileExists(normalizedPath);
    if (!exists) return null;
    
    const content = await window.ipcRenderer.invoke('readFile', normalizedPath);
    
    const match = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
    if (match) {
      try {
        // 尝试 JSON 解析
        return JSON.parse('{' + match[1].replace(/(\w+):/g, '"$1":') + '}');
      } catch {
        // 简单的 YAML 解析
        const lines = match[1].split('\n');
        const result: any = {};
        for (const line of lines) {
          const [key, ...valueParts] = line.split(':');
          if (key && valueParts.length) {
            const value = valueParts.join(':').trim();
            if (value === 'true') result[key.trim()] = true;
            else if (value === 'false') result[key.trim()] = false;
            else if (!isNaN(Number(value))) result[key.trim()] = Number(value);
            else result[key.trim()] = value;
          }
        }
        return result;
      }
    }
    return null;
  } catch (error) {
    console.error('获取文件元数据失败:', error);
    return null;
  }
}

// 保存项目到文件
async function saveItemToFile(item: Item) {
  if (!workspacePath.value) return;
  
  try {
    const isFolder = item.isFolder || (item.children && item.children.length > 0);
    let filePath = item.filePath ? normalizePath(item.filePath) : '';
    
    if (!filePath) {
      // 新项目，需要创建文件
      const parentItem = allItems.value.find(i => i.id === item.parentId);
      
      // 关键修复：正确获取父路径
      let parentPath = workspacePath.value;
      if (parentItem) {
        // 如果父项目是文件夹，直接使用其路径
        if (parentItem.isFolder) {
          parentPath = normalizePath(parentItem.filePath || '');
        } else {
          // 如果父项目不是文件夹，获取其所在目录
          const parentFilePath = parentItem.filePath || '';
          parentPath = normalizePath(parentFilePath.split(/[/\\]/).slice(0, -1).join('\\'));
        }
      }
      
      if (isFolder) {
        // 创建文件夹
        const folderName = sanitizeFileName(item.title) || '未命名';
        filePath = pathJoin(parentPath, folderName);
        filePath = normalizePath(filePath);
        
        // 确保父目录存在
        try {
          await window.ipcRenderer.invoke('ensureDir', parentPath);
        } catch (error) {
          console.error(`创建父目录失败: ${parentPath}`, error);
        }
        
        // 创建文件夹
        try {
          await window.ipcRenderer.invoke('ensureDir', filePath);
        } catch (error) {
          console.error(`创建文件夹失败: ${filePath}`, error);
          throw error;
        }
        
        // 创建 .README.md（包含元数据和正文）
        const readmePath = pathJoin(filePath, '.README.md');
        await saveContentToFile(readmePath, item);
        item.filePath = filePath;
      } else {
        // 创建 Markdown 文件
        const fileName = sanitizeFileName(item.title) || '未命名';
        filePath = pathJoin(parentPath, `${fileName}.md`);
        filePath = normalizePath(filePath);
        
        // 确保父目录存在
        try {
          await window.ipcRenderer.invoke('ensureDir', parentPath);
        } catch (error) {
          console.error(`创建父目录失败: ${parentPath}`, error);
        }
        
        // 检查文件是否已存在
        let finalPath = filePath;
        let counter = 1;
        while (true) {
          try {
            const exists = await fileExists(finalPath);
            if (!exists) break;
            finalPath = pathJoin(parentPath, `${fileName}_${counter}.md`);
            finalPath = normalizePath(finalPath);
            counter++;
          } catch {
            break;
          }
        }
        filePath = finalPath;
        
        await saveContentToFile(filePath, item);
        item.filePath = filePath;
      }
    } else {
      // 更新现有文件
      if (isFolder) {
        // 如果是文件夹，先确保文件夹存在
        try {
          const folderExists = await fileExists(filePath);
          if (!folderExists) {
            console.log(`文件夹不存在，重新创建: ${filePath}`);
            await window.ipcRenderer.invoke('ensureDir', filePath);
          }
        } catch (error) {
          console.error(`检查文件夹存在性失败: ${filePath}`, error);
        }
        
        // 更新 .README.md（包含元数据和正文）
        const readmePath = pathJoin(filePath, '.README.md');
        await saveContentToFile(readmePath, item);
      } else {
        // 如果是文件，直接更新
        const parentDir = filePath.substring(0, filePath.lastIndexOf('\\'));
        if (parentDir) {
          try {
            const dirExists = await fileExists(parentDir);
            if (!dirExists) {
              console.log(`父目录不存在，重新创建: ${parentDir}`);
              await window.ipcRenderer.invoke('ensureDir', parentDir);
            }
          } catch (error) {
            console.error(`检查父目录存在性失败: ${parentDir}`, error);
          }
        }
        
        // 保存文件内容
        await saveContentToFile(filePath, item);
      }
    }
    
    // 如果标题改变，可能需要重命名文件/文件夹
    const oldPath = item.filePath;
    if (oldPath) {
      const oldFileName = oldPath.split(/[/\\]/).pop() || '';
      const expectedFileName = isFolder 
        ? sanitizeFileName(item.title)
        : `${sanitizeFileName(item.title)}.md`;
      
      if (oldFileName !== expectedFileName && oldFileName !== '.README.md' && expectedFileName) {
        const parentPath = oldPath.substring(0, oldPath.lastIndexOf('\\'));
        if (parentPath) {
          // 生成不重复的文件名
          let newPath = normalizePath(pathJoin(parentPath, expectedFileName));
          let finalPath = newPath;
          let counter = 1;
          
          // 检查是否重名（排除当前文件自身）
          while (true) {
            try {
              const exists = await fileExists(finalPath);
              // 如果文件不存在，或者存在的是当前文件本身，则可以使用
              if (!exists || finalPath === oldPath) break;
              
              // 生成带数字后缀的新文件名
              const nameWithoutExt = expectedFileName.replace(/\.md$/, '');
              finalPath = normalizePath(pathJoin(parentPath, `${nameWithoutExt}_${counter}.md`));
              counter++;
            } catch {
              break;
            }
          }
          
          // 只有当路径不同时才执行重命名
          if (finalPath !== oldPath) {
            try {
              if (isFolder) {
                // 创建新文件夹
                await window.ipcRenderer.invoke('ensureDir', finalPath);
                
                // 移动 .README.md
                const oldReadmePath = pathJoin(oldPath, '.README.md');
                const newReadmePath = pathJoin(finalPath, '.README.md');
                
                try {
                  const oldReadmeExists = await fileExists(oldReadmePath);
                  if (oldReadmeExists) {
                    const content = await window.ipcRenderer.invoke('readFile', oldReadmePath);
                    await window.ipcRenderer.invoke('writeFile', newReadmePath, content);
                    await window.ipcRenderer.invoke('deleteFile', oldReadmePath);
                  }
                } catch (error) {
                  console.error('移动 .README.md 失败:', error);
                }
                
                // 移动所有子项目
                const children = allItems.value.filter(i => i.parentId === item.id);
                for (const child of children) {
                  if (child.filePath) {
                    const childFileName = child.filePath.split(/[/\\]/).pop();
                    const oldChildPath = child.filePath;
                    const newChildPath = normalizePath(pathJoin(finalPath, childFileName || ''));
                    
                    child.filePath = newChildPath;
                    
                    try {
                      const childExists = await fileExists(oldChildPath);
                      if (childExists) {
                        const content = await window.ipcRenderer.invoke('readFile', oldChildPath);
                        await window.ipcRenderer.invoke('writeFile', newChildPath, content);
                        await window.ipcRenderer.invoke('deleteFile', oldChildPath);
                      }
                    } catch (error) {
                      console.error(`移动子项目文件失败: ${oldChildPath}`, error);
                    }
                    
                    await saveItemToFile(child);
                  }
                }
                
                // 删除旧文件夹
                await deleteFolderRecursive(oldPath);
                
              } else {
                // 移动文件
                try {
                  const fileExists_check = await fileExists(oldPath);
                  if (fileExists_check) {
                    const content = await window.ipcRenderer.invoke('readFile', oldPath);
                    await window.ipcRenderer.invoke('writeFile', finalPath, content);
                    await window.ipcRenderer.invoke('deleteFile', oldPath);
                  } else {
                    await saveContentToFile(finalPath, item);
                  }
                } catch (error) {
                  console.error('移动文件失败:', error);
                }
              }
              
              item.filePath = finalPath;
              console.log(`文件重命名成功: ${oldPath} -> ${finalPath}`);
              
            } catch (error) {
              console.error('重命名失败:', error);
            }
          }
        }
      }
    }
    
    console.log(`文件保存完成: ${item.title}`);
    
  } catch (error) {
    console.error(`保存项目 ${item.title} 失败:`, error);
  }
}

// 递归删除文件夹
async function deleteFolderRecursive(folderPath: string) {
  try {
    const { fileList } = await window.ipcRenderer.invoke('getFilesRelation', folderPath, 1);
    
    for (const file of fileList) {
      if (file.type === 'file') {
        try {
          const fileExists_check = await fileExists(file.path);
          if (fileExists_check) {
            await window.ipcRenderer.invoke('deleteFile', file.path);
          }
        } catch (error) {
          console.error(`删除文件失败: ${file.path}`, error);
        }
      }
    }
    
    try {
      const folderExists = await fileExists(folderPath);
      if (folderExists) {
        await window.ipcRenderer.invoke('deleteFile', folderPath);
        console.log(`成功删除文件夹: ${folderPath}`);
      }
    } catch (error) {
      console.error(`删除文件夹失败: ${folderPath}`, error);
    }
  } catch (error) {
    console.error('获取文件夹内容失败:', error);
  }
}

// 保存完整内容到文件（包含元数据和正文）
async function saveContentToFile(filePath: string, item: Item) {
  const normalizedPath = normalizePath(filePath);
  
  const metadata: any = {
    id: item.id,
    status: item.status,
    color: item.color,
    createdTime: item.createdTime.toISOString()
  };
  
  if (item.startTime) metadata.startTime = item.startTime.toISOString();
  if (item.endTime) metadata.endTime = item.endTime.toISOString();
  if (item.parentId) metadata.parentId = item.parentId;
  if (item._order !== undefined) metadata.order = item._order;
  if (item.relatedId) metadata.relatedId = item.relatedId;
  
  let content = '---\n';
  for (const [key, value] of Object.entries(metadata)) {
    content += `${key}: ${value}\n`;
  }
  content += '---\n';
  
  // 添加正文内容
  if (item.content && item.content.trim() !== '') {
    content += '\n' + item.content + '\n';
  }
  
  try {
    await window.ipcRenderer.invoke('writeFile', normalizedPath, content);
    console.log(`文件保存成功: ${normalizedPath}`);
  } catch (error) {
    console.error(`保存文件失败: ${normalizedPath}`, error);
    throw error;
  }
}

// 重命名文件
async function renameItemFile(item: Item, newName: string) {
  if (!item.filePath) return;
  
  const parentPath = normalizePath(item.filePath.split(/[/\\]/).slice(0, -1).join('\\'));
  const newPath = normalizePath(pathJoin(parentPath, newName));
  
  try {
    if (await fileExists(newPath)) {
      console.warn(`目标文件已存在: ${newPath}`);
      return;
    }
    
    const content = await window.ipcRenderer.invoke('readFile', item.filePath);
    await window.ipcRenderer.invoke('writeFile', newPath, content);
    await window.ipcRenderer.invoke('deleteFile', item.filePath);
    
    item.filePath = newPath;
  } catch (error) {
    console.error('重命名文件失败:', error);
  }
}

// 删除项目文件
async function deleteItemFile(item: Item) {
  if (!item.filePath) return;
  
  try {
    const normalizedPath = normalizePath(item.filePath);
    
    if (item.isFolder) {
      console.log(`开始删除文件夹及其内容: ${normalizedPath}`);
      
      // 先递归删除所有子项目
      const children = allItems.value.filter(i => i.parentId === item.id);
      for (const child of children) {
        await deleteItemFile(child);
      }
      
      // 删除文件夹内的 .README.md 文件
      const readmePath = pathJoin(normalizedPath, '.README.md');
      try {
        const readmeExists = await fileExists(readmePath);
        if (readmeExists) {
          await window.ipcRenderer.invoke('deleteFile', readmePath);
          console.log(`删除 .README.md 成功: ${readmePath}`);
        }
      } catch (error) {
        console.error(`删除 .README.md 失败: ${readmePath}`, error);
      }
      
      // 删除文件夹本身
      try {
        const folderExists = await fileExists(normalizedPath);
        if (folderExists) {
          // 注意：这里需要使用专门删除文件夹的方法
          // 如果 IPC 有删除文件夹的方法，使用它；否则可能需要递归删除
          await window.ipcRenderer.invoke('deleteFolder', normalizedPath);
          console.log(`删除文件夹成功: ${normalizedPath}`);
        }
      } catch (error) {
        console.error(`删除文件夹失败: ${normalizedPath}`, error);
      }
    } else {
      // 删除单个文件
      try {
        const fileExists_check = await fileExists(normalizedPath);
        if (fileExists_check) {
          await window.ipcRenderer.invoke('deleteFile', normalizedPath);
          console.log(`删除文件成功: ${normalizedPath}`);
        }
      } catch (error) {
        console.error(`删除文件失败: ${normalizedPath}`, error);
      }
    }
  } catch (error) {
    console.error(`删除项目文件失败: ${item.filePath}`, error);
  }
}

// 在文件管理器中打开
async function openInFolder(item: Item) {
  if (!item.filePath) return;
  await window.ipcRenderer.invoke('openInFolder', item.filePath);
}

// ========== 视图控制函数 ==========

function setCurrentView(view: ViewMode) {
  // 切换视图前检查是否需要保存
  saveIfNeeded('切换视图');
  currentView.value = view;
  
  if (view === 'week' || view === 'month') {
    computer();
  }
  
  if (view === 'waterfall') {
    nextTick(() => {
      calculateColumnCount();
      distributeItemsToColumns();
    });
  }
}

function getViewIcon() {
  const view = viewModes.find(v => v.id === currentView.value);
  return view ? view.icon : 'fa-question';
}

function getSearchPlaceholder() {
  switch (currentView.value) {
    case 'waterfall': return store.locales=='zh'?'搜索所有项目...':'Search all items...';
    case 'tree': return store.locales=='zh'?'搜索规划项目...':'Search for planned items...';
    case 'week': 
    case 'month': return store.locales=='zh'?'搜索日历项目...':'Search calendar items...';
    default: return store.locales=='zh'?'搜索...':'Search...';
  }
}

function toggleStatusFilter(status: string) {
  const index = selectedStatuses.value.indexOf(status);
  if (index > -1) {
    selectedStatuses.value.splice(index, 1);
  } else {
    selectedStatuses.value.push(status);
  }
}

function getRandomColor() {
  return colorOptions.value[Math.floor(Math.random() * colorOptions.value.length)];
}

function selectItem(item: Item) {
  // 选择新项目前保存当前项目的更改
  saveIfNeeded('切换项目');
  
  if (showDataSet.value) {
    showDataSet.value = false;
  }
  const original = allItems.value.find(i => i.id === item.id);
  selectedItem.value = original || item;
  
  // 当选中项目时，记录当前的值用于后续比较
  if (selectedItem.value) {
    lastSavedTitle = selectedItem.value.title;
    lastSavedContent = selectedItem.value.content || '';
    hasUnsavedChanges = false;
  }
}

function clearSelected() {
  // 关闭右侧面板前保存更改
  saveIfNeeded('关闭面板');
  selectedItem.value = null;
  hasUnsavedChanges = false;
}

// 添加项目
async function addItem() {
  if (!workspacePath.value) {
    alert('请先选择工作区');
    return;
  }
  
  const defaultStatus = selectedStatuses.value.length > 0 ? selectedStatuses.value[0] : '灵感';
  const today = new Date();
  
  let newItem: Item = {
    id: nextId.value++,
    title: `新的${defaultStatus}`,
    status: defaultStatus as ItemStatus,
    createdTime: new Date(),
    color: getRandomColor(),
    expanded: true,
    content: ''
  };
  
  if (defaultStatus !== '灵感' && defaultStatus !== '规划') {
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 7);
    newItem.startTime = today;
    newItem.endTime = endDate;
  }
  
  if (defaultStatus === '规划') {
    newItem._order = treeItems.value.length;
  }
  
  if (selectedItem.value) {
    newItem.parentId = selectedItem.value.id;
    newItem.isFolder = false;
  } else {
    newItem.isFolder = false;
  }
  
  allItems.value.push(newItem);
  
  await saveItemToFile(newItem);
  
  selectedItem.value = newItem;
  
  if (currentView.value === 'waterfall') {
    distributeItemsToColumns();
  }
}

// 移动项目到待办
async function moveToPending(item: Item) {
  const newItem: Item = {
    id: nextId.value++,
    title: item.title.length > 30 ? item.title.substring(0, 30) + '...' : item.title,
    status: '待办',
    createdTime: new Date(),
    startTime: new Date(),
    endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    color: item.color || getRandomColor(),
    relatedId: item.id,
    isFolder: false,
    content: item.content
  };
  
  allItems.value.push(newItem);
  await saveItemToFile(newItem);
  
  if (item.status === '规划') {
    item.status = '已完成';
    await saveItemToFile(item);
    
    const updateChildrenStatus = async (parentId: number) => {
      const children = allItems.value.filter((i: Item) => i.parentId === parentId);
      for (const child of children) {
        child.status = '已完成';
        await saveItemToFile(child);
        await updateChildrenStatus(child.id);
      }
    };
    
    await updateChildrenStatus(item.id);
  }
  
  selectedItem.value = newItem;
}

// 移动到灵感
async function moveToInspiration(item: Item) {
  item.status = '灵感';
  item.parentId = undefined;
  delete item._order;
  
  await saveItemToFile(item);
  
  const updateChildrenStatus = async (parentId: number) => {
    const children = allItems.value.filter((i: Item) => i.parentId === parentId);
    for (const child of children) {
      child.status = '灵感';
      child.parentId = undefined;
      delete child._order;
      await saveItemToFile(child);
      await updateChildrenStatus(child.id);
    }
  };
  
  await updateChildrenStatus(item.id);
}

// 切换瀑布流布局
function toggleWaterfallLayout() {
  waterfallLayout.value = waterfallLayout.value === 'masonry' ? 'list' : 'masonry';
}

function expandAll() {
  allItems.value.forEach((item: Item) => {
    if (item.status === '规划') {
      item.expanded = true;
    }
  });
  // 强制更新树状图
  if (currentView.value === 'tree') {
    treeItems.value = [...treeItems.value];
  }
}

function collapseAll() {
  allItems.value.forEach((item: Item) => {
    if (item.status === '规划') {
      item.expanded = false;
    }
  });
  if (currentView.value === 'tree') {
    const newTreeItems = [...treeItems.value];
  }
}

function prev() {
  if (currentView.value === 'month') {
    currentDate.value = new Date(currentYear.value, currentDate.value.getMonth() - 1, 1);
  } else if (currentView.value === 'week') {
    currentDate.value.setDate(currentDate.value.getDate() - 7);
    computer();
  }
}

function next() {
  if (currentView.value === 'month') {
    currentDate.value = new Date(currentYear.value, currentDate.value.getMonth() + 1, 1);
  } else if (currentView.value === 'week') {
    currentDate.value.setDate(currentDate.value.getDate() + 7);
    computer();
  }
}

function computer() {
  weekDays.value = [];
  const dayOfWeek = currentDate.value.getDay();
  const currentDay = currentDate.value.getDate();
  const currentMonth = currentDate.value.getMonth();
  const currentYear = currentDate.value.getFullYear();
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(currentYear, currentMonth, currentDay - dayOfWeek + i);
    weekDays.value.push({
      name: getDayName(date.getDay()),
      date: formatDate(date),
      time: date,
      today: isToday(date),
      selected: isSameDay(date, selectedDate.value),
      todos: countTodo(date),
    });
  }
}

function getDayName(dayIndex: number) {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return days[dayIndex];
}

function formatDate(date: Date) {
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${month}-${day}`;
}

function formatWeekRange(date: Date) {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${start.getMonth()+1}/${start.getDate()} - ${end.getMonth()+1}/${end.getDate()}`;
}

function formatDateForDisplay(date: Date | undefined) {
  if (!date) return '';
  const d = new Date(date);
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${month}-${day}`;
}

function formatItemTime(date: Date) {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 60) {
    return `${diffMins}分钟前`;
  } else if (diffHours < 24) {
    return `${diffHours}小时前`;
  } else if (diffDays < 7) {
    return `${diffDays}天前`;
  } else {
    return formatDateForDisplay(d);
  }
}

function changeSelectedDate(date: Date) {
  selectedDate.value = new Date(date);
  computer();
}

function isToday(date: Date) {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

function isSameDay(date1: Date, date2: Date): boolean {
  if (!date1 || !date2) return false;
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function countTodo(date: Date): number {
  let itemsToCount = allItems.value;
  
  if (selectedStatuses.value.length > 0) {
    itemsToCount = itemsToCount.filter((item: Item) => selectedStatuses.value.includes(item.status));
  }
  
  if (searchText.value) {
    const searchTerm = searchText.value.toLowerCase();
    itemsToCount = itemsToCount.filter((item: Item) => 
      item.title?.toLowerCase().includes(searchTerm) ||
      item.content?.toLowerCase().includes(searchTerm)
    );
  }
  
  return itemsToCount.filter((item: Item) => {
    if (!item.startTime || !item.endTime) return false;
    
    const taskStart = new Date(item.startTime);
    const taskEnd = new Date(item.endTime);
    const checkDate = new Date(date);
    
    taskStart.setHours(0, 0, 0, 0);
    taskEnd.setHours(23, 59, 59, 999);
    checkDate.setHours(0, 0, 0, 0);
    
    return checkDate >= taskStart && checkDate <= taskEnd;
  }).length;
}

function getItemsForDate(date: Date) {
  let itemsToShow = allItems.value;
  
  if (selectedStatuses.value.length > 0) {
    itemsToShow = itemsToShow.filter((item: Item) => selectedStatuses.value.includes(item.status));
  }
  
  if (searchText.value) {
    const searchTerm = searchText.value.toLowerCase();
    itemsToShow = itemsToShow.filter((item: Item) => 
      item.title?.toLowerCase().includes(searchTerm) ||
      item.content?.toLowerCase().includes(searchTerm)
    );
  }
  
  return itemsToShow.filter((item: Item) => {
    if (!item.startTime || !item.endTime) return false;
    
    const taskStart = new Date(item.startTime);
    const taskEnd = new Date(item.endTime);
    taskStart.setHours(0, 0, 0, 0);
    taskEnd.setHours(23, 59, 59, 999);
    date.setHours(0, 0, 0, 0);
    
    return date >= taskStart && date <= taskEnd;
  });
}

function getContrastColor(hexcolor: string): string {
  if (!hexcolor || hexcolor.includes('var(')) {
    return '#000000';
  }
  
  const color = hexcolor.replace('#', '');
  let r, g, b;
  if (color.length === 3) {
    r = parseInt(color[0] + color[0], 16);
    g = parseInt(color[1] + color[1], 16);
    b = parseInt(color[2] + color[2], 16);
  } else {
    r = parseInt(color.substring(0, 2), 16);
    g = parseInt(color.substring(2, 4), 16);
    b = parseInt(color.substring(4, 6), 16);
  }
  
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return yiq >= 128 ? '#000000' : '#FFFFFF';
}

function getItemSpanStyle(item: Item, cellDate: Date) {
  if (!item.startTime || !item.endTime) {
    return { display: 'none' };
  }
  
  const taskStart = new Date(item.startTime);
  const taskEnd = new Date(item.endTime);
  
  taskStart.setHours(0, 0, 0, 0);
  taskEnd.setHours(0, 0, 0, 0);
  const cellDateCopy = new Date(cellDate);
  cellDateCopy.setHours(0, 0, 0, 0);
  
  if (cellDateCopy < taskStart || cellDateCopy > taskEnd) {
    return { display: 'none' };
  }
  
  const backgroundColor = item.color || getRandomColor();
  const textColor = getContrastColor(backgroundColor);
  
  return {
    backgroundColor,
    color: textColor,
    cursor: 'pointer',
    borderLeft: `3px solid ${backgroundColor}`,
    borderLeftColor: backgroundColor
  };
}

// 计算瀑布流列数
function calculateColumnCount() {
  if (!waterfallGrid.value) return;
  
  const container = waterfallGrid.value;
  const containerWidth = container.clientWidth;
  const cardMinWidth = 200;
  const gap = 10;
  
  const maxColumns = Math.floor((containerWidth + gap) / (cardMinWidth + gap));
  const newColumnCount = Math.max(2, Math.min(12, maxColumns));
  
  if (newColumnCount !== columnCount.value) {
    columnCount.value = newColumnCount;
    distributeItemsToColumns();
  }
}

// 分配项目到各列
function distributeItemsToColumns() {
  if (!filteredItems.value || filteredItems.value.length === 0 || waterfallLayout.value !== 'masonry') {
    columnItems.value = Array.from({length: columnCount.value}, (_, i) => ({index: i, items: []}));
    return;
  }
  
  const columns: Array<{index: number, items: Item[]}> = Array.from(
    {length: columnCount.value}, 
    (_, i) => ({index: i, items: []})
  );
  
  filteredItems.value.forEach((item: Item, index: number) => {
    const columnIndex = index % columnCount.value;
    columns[columnIndex].items.push(item);
  });
  
  columnItems.value = columns;
}

// ========== 保存相关函数 ==========

// 标题输入处理 - 只更新内存，标记有未保存更改
function onTitleInput(event: Event) {
  if (!selectedItem.value) return;
  const target = event.target as HTMLInputElement;
  selectedItem.value.title = target.value;
  hasUnsavedChanges = true;
  console.log(`标题输入: ${target.value} (已标记未保存)`);
}

// 内容输入处理 - 只更新内存，标记有未保存更改
function onContentInput(event: Event) {
  if (!selectedItem.value) return;
  const target = event.target as HTMLTextAreaElement;
  selectedItem.value.content = target.value;
  hasUnsavedChanges = true;
  console.log(`内容输入: ${target.value.substring(0, 20)}... (已标记未保存)`);
}

// 焦点离开时保存
function onBlur() {
  saveIfNeeded('焦点离开');
}

// 颜色选择时保存
function selectColor(color: string, item: Item) {
  if (item) {
    item.color = color;
    hasUnsavedChanges = true;
    saveIfNeeded('颜色更改');
  }
}

// 状态更改时保存
function updateItemStatus(event: Event) {
  if (!selectedItem.value) return;
  const target = event.target as HTMLSelectElement;
  selectedItem.value.status = target.value as ItemStatus;
  hasUnsavedChanges = true;
  saveIfNeeded('状态更改');
}

// 开始时间更改时保存
async function updateStartTime(event: any, item: Item) {
  if (!event.target.value) return;
  
  const newDate = new Date(event.target.value);
  if (item.startTime) {
    const oldDate = new Date(item.startTime);
    newDate.setHours(oldDate.getHours(), oldDate.getMinutes(), oldDate.getSeconds(), oldDate.getMilliseconds());
  }
  
  item.startTime = newDate;
  
  if (item.endTime && item.endTime < newDate) {
    item.endTime = new Date(newDate);
    if (item.endTime) item.endTime.setHours(17, 0, 0, 0);
  }
  
  hasUnsavedChanges = true;
  saveIfNeeded('开始时间更改');
}

// 结束时间更改时保存
async function updateEndTime(event: any, item: Item) {
  if (!event.target.value) return;
  
  const newDate = new Date(event.target.value);
  if (item.endTime) {
    const oldDate = new Date(item.endTime);
    newDate.setHours(oldDate.getHours(), oldDate.getMinutes(), oldDate.getSeconds(), oldDate.getMilliseconds());
  }
  
  item.endTime = newDate;
  
  if (item.startTime && item.startTime > newDate) {
    item.startTime = new Date(newDate);
    if (item.startTime) item.startTime.setHours(9, 0, 0, 0);
  }
  
  hasUnsavedChanges = true;
  saveIfNeeded('结束时间更改');
}

// 如果需要则保存（检查是否有未保存更改）
async function saveIfNeeded(reason: string = '') {
  if (!selectedItem.value) return;
  
  const hasTitleChanged = selectedItem.value.title !== lastSavedTitle;
  const hasContentChanged = selectedItem.value.content !== lastSavedContent;
  
  if (hasUnsavedChanges || hasTitleChanged || hasContentChanged) {
    console.log(`保存项目 (${reason}): ${selectedItem.value.title}`);
    
    // 更新最后保存的记录
    lastSavedTitle = selectedItem.value.title;
    lastSavedContent = selectedItem.value.content || '';
    hasUnsavedChanges = false;
    
    // 调用更新函数
    await updateSelectedItem(selectedItem.value);
  } else {
    console.log(`跳过保存 (${reason}): 无变化`);
  }
}

// 更新项目
async function updateSelectedItem(item: Item) {
  const index = allItems.value.findIndex((i: Item) => i.id === item.id);
  if (index !== -1) {
    // 先更新数组中的项目
    allItems.value[index] = { ...item };
    
    // 更新选中的项目引用
    if (selectedItem.value && selectedItem.value.id === item.id) {
      selectedItem.value = allItems.value[index];
    }
    
    // 保存到文件系统
    await saveItemToFile(allItems.value[index]);
    
    // 重新计算视图
    computer();
    
    console.log(`项目已更新并保存: ${item.title}`);
  }
}

// 添加子项目
async function addChildItem(parent: Item) {
  const newItem: Item = {
    id: nextId.value++,
    title: '新的子规划',
    status: '规划',
    createdTime: new Date(),
    color: getRandomColor(),
    parentId: parent.id,
    isFolder: false,
    expanded: true,
    content: ''
  };
  
  allItems.value.push(newItem);
  
  if (!parent.isFolder) {
    parent.isFolder = true;
    
    if (parent.filePath) {
      const oldPath = parent.filePath;
      if (oldPath.endsWith('.md')) {
        // 将 .md 文件转换为文件夹
        const folderPath = normalizePath(oldPath.replace(/\.md$/, ''));
        
        try {
          // 确保创建新文件夹
          await window.ipcRenderer.invoke('ensureDir', folderPath);
          
          // 移动原文件内容到 .README.md
          const readmePath = pathJoin(folderPath, '.README.md');
          const content = await window.ipcRenderer.invoke('readFile', oldPath);
          await window.ipcRenderer.invoke('writeFile', readmePath, content);
          
          // 删除原文件
          await window.ipcRenderer.invoke('deleteFile', oldPath);
          
          // 更新父项目路径为文件夹路径
          parent.filePath = folderPath;
          await saveContentToFile(readmePath, parent);
          
          console.log(`成功将文件转换为文件夹: ${oldPath} -> ${folderPath}`);
        } catch (error) {
          console.error('转换文件夹失败:', error);
          parent.isFolder = false;
          return;
        }
      }
    }
  }
  
  // 确保父文件夹存在
  if (parent.filePath) {
    const parentExists = await fileExists(parent.filePath);
    if (!parentExists) {
      console.warn(`父文件夹不存在，重新创建: ${parent.filePath}`);
      await window.ipcRenderer.invoke('ensureDir', parent.filePath);
      
      const readmePath = pathJoin(parent.filePath, '.README.md');
      await saveContentToFile(readmePath, parent);
    }
  }
  
  // 先保存父项目，确保文件夹存在
  await saveItemToFile(parent);
  
  // 然后再保存子项目
  await saveItemToFile(newItem);
  
  parent.expanded = true;
}

// 删除项目
async function deleteItem(item: Item) {
  // 递归删除子项目
  const deleteChildren = async (parentId: number) => {
    const children = allItems.value.filter((i: Item) => i.parentId === parentId);
    for (const child of children) {
      await deleteChildren(child.id);
      const index = allItems.value.findIndex((i: Item) => i.id === child.id);
      if (index !== -1) {
        allItems.value.splice(index, 1);
      }
      // 删除子项目的文件
      await deleteItemFile(child);
    }
  };
  
  // 先删除所有子项目
  await deleteChildren(item.id);
  
  // 再删除当前项目
  const index = allItems.value.findIndex((i: Item) => i.id === item.id);
  if (index !== -1) {
    allItems.value.splice(index, 1);
    // 删除当前项目的文件/文件夹
    await deleteItemFile(item);
  }
  
  // 如果删除的是当前选中的项目，清除选中状态
  if (selectedItem.value && selectedItem.value.id === item.id) {
    selectedItem.value = null;
  }
  
  // 刷新瀑布流视图
  distributeItemsToColumns();
  
  console.log(`项目删除完成: ${item.title}`);
}

function toggleExpand(item: Item) {
  if (!item) return;
  
  const existing = allItems.value.find(i => i.id === item.id);
  if (existing) {
    existing.expanded = !existing.expanded;
  } else {
    item.expanded = !item.expanded;
  }

  if (currentView.value === 'tree') {
    allItems.value = [...allItems.value];
  }
}

// 处理顶级拖拽
async function onTopLevelDragEnd(event: any) {
  if (event.moved) {
    for (let i = 0; i < treeItems.value.length; i++) {
      const item = treeItems.value[i];
      const existingItem = allItems.value.find(e => e.id === item.id);
      if (existingItem) {
        existingItem._order = i;
        await saveItemToFile(existingItem);
      }
    }
  } else if (event.added) {
    const { element, newIndex } = event.added;
    const item = allItems.value.find((i: Item) => i.id === element.id);
    
    if (item) {
      item.parentId = undefined;
      item._order = newIndex;
      await saveItemToFile(item);
      
      const currentTopItems = treeItems.value;
      for (let i = 0; i < currentTopItems.length; i++) {
        const topItem = currentTopItems[i];
        if (topItem.id !== item.id) {
          const existingItem = allItems.value.find(e => e.id === topItem.id);
          if (existingItem) {
            existingItem._order = i >= newIndex ? i + 1 : i;
            await saveItemToFile(existingItem);
          }
        }
      }
      
      nextTick(() => {
        treeItems.value = [...treeItems.value];
      });
    }
  }
}

// 处理项目移动
async function handleItemMoved(payload: { movedItem: Item, newParentId?: number, targetItemId?: number, position?: 'before' | 'after' | 'inside' }) {
  const movedItem = allItems.value.find((i: Item) => i.id === payload.movedItem.id);
  if (!movedItem) return;
  
  if (payload.newParentId === movedItem.id) return;
  
  const isChildOfMovedItem = (parentId: number): boolean => {
    const children = allItems.value.filter(i => i.parentId === parentId);
    for (const child of children) {
      if (child.id === movedItem.id) return true;
      if (isChildOfMovedItem(child.id)) return true;
    }
    return false;
  };
  
  if (payload.newParentId && isChildOfMovedItem(movedItem.id)) return;
  
  const oldParentId = movedItem.parentId;
  
  if (payload.position === 'inside') {
    movedItem.parentId = payload.newParentId;
  } else if (payload.position === 'before' || payload.position === 'after') {
    movedItem.parentId = payload.targetItemId ? 
      allItems.value.find(i => i.id === payload.targetItemId)?.parentId : 
      undefined;
  }
  
  await saveItemToFile(movedItem);
  
  if (!movedItem.parentId && oldParentId) {
    movedItem._order = treeItems.value.length;
    await saveItemToFile(movedItem);
    nextTick(() => {
      treeItems.value = [...treeItems.value];
    });
  } else if (movedItem.parentId && !oldParentId) {
    nextTick(() => {
      treeItems.value = treeItems.value.filter(item => item.id !== movedItem.id);
    });
  }
}

// 处理子项目变化
async function handleChildrenChanged(payload: { itemId: number, children: Item[] }) {
  for (let i = 0; i < payload.children.length; i++) {
    const child = payload.children[i];
    const childItem = allItems.value.find(c => c.id === child.id);
    if (childItem) {
      childItem.parentId = payload.itemId;
      childItem._order = i;
      await saveItemToFile(childItem);
    }
  }
}

function formatDateForInput(date: Date | undefined) {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function handleScroll(event: Event) {}

function getStatusIcon(status: ItemStatus): string {
  const statusIcons: Record<ItemStatus, string> = {
    '灵感': 'fa fa-lightbulb-o',
    '规划': 'fa fa-sitemap',
    '待办': 'fa fa-clock-o',
    '进行中': 'fa fa-spinner fa-spin',
    '已完成': 'fa fa-check-circle-o'
  };
  return statusIcons[status] || 'fa fa-circle';
}

// 检查文件是否存在
async function fileExists(filePath: string): Promise<boolean> {
  if (!filePath) return false;
  
  try {
    const normalizedPath = normalizePath(filePath);
    const result = await window.ipcRenderer.invoke('getInf', normalizedPath);
    return result !== null && result !== undefined;
  } catch (error: any) {
    if (error.message?.includes('ENOENT') || error.code === 'ENOENT') {
      return false;
    }
    console.error('检查文件存在性时出错:', error);
    return false;
  }
}

// 清理文件名
function sanitizeFileName(fileName: string): string {
  if (!fileName) return '';
  return fileName
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100);
}

// 处理数据导入事件
function handleDataImported(data: any) {
  showDataSet.value = false;
  if (workspacePath.value) {
    loadWorkspace();
  }
}

// 处理数据清空事件
function handleDataCleared() {
  showDataSet.value = false;
  workspacePath.value = '';
  allItems.value = [];
  localStorage.removeItem('workspacePath');
}

// 处理工作区变化
function handleWorkspaceChanged(newPath: string) {
  workspacePath.value = newPath;
  if (newPath) {
    loadWorkspace();
  }
}

// ========== 生命周期和监听 ==========

watch([filteredItems, columnCount, waterfallLayout], () => {
  if (currentView.value === 'waterfall') {
    distributeItemsToColumns();
  }
}, { immediate: true, deep: true });

watch(allItems, () => {
  computer();
});

watch(selectedItem, (newVal, oldVal) => {
  if (newVal && (!oldVal || newVal.id !== oldVal.id)) {
    let parentId = newVal.parentId;
    while (parentId !== undefined && parentId !== null) {
      const parent = allItems.value.find(i => i.id === parentId);
      if (parent) {
        parent.expanded = true;
        parentId = parent.parentId;
      } else {
        break;
      }
    }
    
    // 当选中项目变化时，更新最后保存的记录
    lastSavedTitle = newVal.title;
    lastSavedContent = newVal.content || '';
    hasUnsavedChanges = false;
  }
});

watch([selectedStatuses, searchText], () => {
  if (currentView.value === 'week' || currentView.value === 'month') {
    computer();
  }
});

function setupResizeObserver() {
  const resizeObserver = new ResizeObserver(() => {
    if (currentView.value === 'waterfall') {
      calculateColumnCount();
    }
  });
  
  if (waterfallGrid.value) {
    resizeObserver.observe(waterfallGrid.value);
  }
  
  window.addEventListener('resize', () => {
    if (currentView.value === 'waterfall') {
      calculateColumnCount();
    }
  });
  
  return () => {
    resizeObserver.disconnect();
    window.removeEventListener('resize', () => {
      if (currentView.value === 'waterfall') {
        calculateColumnCount();
      }
    });
  };
}

onMounted(() => {
  nextTick(() => {
    setupResizeObserver();
    computer();
    
    const savedWorkspace = localStorage.getItem('workspacePath');
    if (savedWorkspace) {
      workspacePath.value = savedWorkspace;
      loadWorkspace();
    }
  });
});

onBeforeUnmount(() => {
  // 组件卸载前保存当前项目的更改
  saveIfNeeded('组件卸载');
  
  if (workspacePath.value) {
    localStorage.setItem('workspacePath', workspacePath.value);
  }
  
  window.removeEventListener('resize', () => {});
});
</script>