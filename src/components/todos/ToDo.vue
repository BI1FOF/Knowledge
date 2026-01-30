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
      
      <button 
        v-for="status in statusOptions" 
        :key="status.value"
        :class="{ active: selectedStatuses.includes(status.value) }"
        @click="toggleStatusFilter(status.value)"
        :title="status.label"
        class="status-filter-btn">
        <i :class="status.icon"></i>
      </button>
      
      <!-- 搜索框 -->
      <input 
        type="text" 
        v-model="searchText" 
        :placeholder="getSearchPlaceholder()" 
        class="search">
      
      <!-- 视图控制 -->
      <button @click="addItem" :title="`添加项目`">
        <i class="fa fa-plus"></i>
      </button>
      <button @click="showDataSet = !showDataSet" :class="{ active: showDataSet }" title="数据管理">
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
        
        <!-- 瀑布流列表布局 - 修改样式 -->
        <div v-else class="list-container">
          <div v-for="item in filteredItems" 
              :key="item.id"
              class="list-item"
              :style="{ 'borderLeft': 'solid 5px '+ (item.color || '#e9ecef') }"
              @click="selectItem(item)">
            <div class="list-item-content">
              <div class="list-item-title">{{ item.title }}</div>
              <div class="list-item-meta">
                <!-- 状态图标 -->
                <span class="list-status-icon" :title="item.status">
                  <i :class="getStatusIcon(item.status)"></i>
                </span>
                <span class="list-item-date">
                  {{ formatItemTime(item.createdTime) }}
                </span>
                <div v-if="item.startTime && item.endTime" class="list-item-dates">
                  <i class="fa fa-calendar"></i> 
                  {{ formatDateForDisplay(item.startTime) }} - {{ formatDateForDisplay(item.endTime) }}
                </div>
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
          <p>暂无项目</p>
          <p class="empty-hint">点击右上角的 + 按钮添加项目</p>
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
          <p v-if="selectedStatuses.length > 0 || searchText">没有符合条件的项目</p>
          <p v-else>暂无项目</p>
          <p class="empty-hint">
            <span v-if="selectedStatuses.length > 0">当前筛选状态: {{ getSelectedStatusLabels() }}</span>
            <span v-else>可以添加任何状态的项目</span>
          </p>
        </div>
      </div>
    </div>
    
    <!-- 月视图 - 使用筛选后的项目 -->
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
                <!-- 跨天任务渲染 - 使用筛选后的项目 -->
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
    
    <!-- 周视图 - 使用筛选后的项目 -->
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
        <!-- 使用筛选后的项目 -->
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
          <p>本周没有任务</p>
          <p class="empty-hint">为任务设置日期后会自动出现在这里</p>
        </div>
      </div>
    </div>
    
    <!-- 属性编辑界面 -->
    <div class="property scoll" v-if="selectedItem">
      <div class="property-header">
        <h3 class="property-title">{{ selectedItem.title || '编辑项目' }}</h3>
        <div class="property-close-btn" @click="clearSelected">
          <i class="fa fa-times"></i>
        </div>
      </div>
      
      <div class="property-content">
        <div class="property-field">
          <input :value="selectedItemTitle" 
            type="text" 
            class="property-input"
            @input="updateSelectedItemTitle($event)"
            @blur="updateSelectedItem(selectedItem!)"
            @keyup.enter="updateSelectedItem(selectedItem!)"
            :placeholder="'项目标题...'">
        </div>
        
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
                  updateSelectedItem(selectedItem);
                }
              }"
              class="color-input">
          </div>
        </div>
        
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
        
        <div v-if="selectedItem?.status !== '灵感'" class="property-field">
          <label class="property-label">开始时间</label>
          <input type="date" 
            class="property-date-input"
            :value="formatDateForInput(selectedItem?.startTime)" 
            @change="(e) => {
              updateStartTime(e, selectedItem!);
              updateSelectedItem(selectedItem!);
            }">
        </div>

        <div v-if="selectedItem?.status !== '灵感'" class="property-field">
          <label class="property-label">结束时间</label>
          <input type="date" 
            class="property-date-input"
            :value="formatDateForInput(selectedItem?.endTime)" 
            @change="(e) => {
              updateEndTime(e, selectedItem!);
              updateSelectedItem(selectedItem!);
            }">
        </div>
        
        <div class="property-field">
          <div class="property-btn" @click="deleteItem(selectedItem!)">
            <i class="fa fa-trash"></i> 删除
          </div>
        </div>
      </div>
    </div>
    
    <!-- 数据管理面板 -->
    <DataSet 
      v-if="showDataSet" 
      @data-imported="handleDataImported"
      @data-cleared="handleDataCleared"
    />
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

/* 状态筛选按钮的激活指示器 */
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

/* ========== 通用工具栏 ========== */
.toolbar {
  background: var(--backgroundColor);
  flex-shrink: 0;
  padding: 5px;
  display: flex;
  gap: 5px;
  align-items: center;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
}

.toolbar-action-btn {
  padding: 6px;
  border: 1px solid var(--borderColor);
  border-radius: 4px;
  background: var(--backgroundColor);
  color: var(--fontColor);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.toolbar-action-btn:hover {
  background: var(--menuActiveColor);
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

.grid-card-status {
  padding: 2px 6px;
  border-radius: 5px;
  background: var(--menuActiveColor);
  color: var(--fontColor);
}

.grid-card-status.灵感 {
  background: #fff3cd;
  color: #856404;
}

.grid-card-status.规划 {
  background: #d1ecf1;
  color: #0c5460;
}

.grid-card-status.待办 {
  background: #d4edda;
  color: #155724;
}

.grid-card-status.进行中 {
  background: #cce5ff;
  color: #004085;
}

.grid-card-status.已完成 {
  background: #f8f9fa;
  color: #6c757d;
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

/* 列表布局中的时间显示增强 */
.list-item-content {
  flex: 1;
  display: flex;
  flex-direction: column; /* 改为列布局 */
}

.list-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--fontColor);
  opacity: 0.8;
  flex-wrap: wrap;
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
  margin-right: 5px;
}

.list-item-dates i {
  font-size: 10px;
}

/* 列表布局样式 */
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
  flex-direction: row;
  justify-content: center;
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
  flex:1;
}

.list-item-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--fontColor);
  opacity: 0.8;
  flex-wrap: wrap;
}

.list-item-status {
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 11px;
  white-space: nowrap;
  flex-shrink: 0;
}

.list-item-date {
  white-space: nowrap;
  flex-shrink: 0;
}

.list-item-dates {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  flex-shrink: 0;
}

.list-item-action-btn {
  padding: 6px;
  border: 1px solid var(--borderColor);
  border-radius: 4px;
  background: var(--backgroundColor);
  color: var(--fontColor);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.list-item-action-btn:hover {
  background: var(--menuActiveColor);
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

.task-span-status {
  padding: 1px 4px;
  border-radius: 8px;
  font-size: 9px;
  flex-shrink: 0;
}

.task-complete-icon {
  opacity: 0.5;
  cursor: pointer;
  flex-shrink: 0;
}

.task-span:hover .task-complete-icon {
  opacity: 1;
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

/* ========== 周视图任务列表 ========== */
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

.task-status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  margin-left: 5px;
  width: 40px;
  text-align: center;
  flex-shrink: 0;
  background: var(--menuActiveColor);
  color: var(--fontColor);
}

.task-status.灵感 {
  background: #fff3cd;
  color: #856404;
}

.task-status.规划 {
  background: #d1ecf1;
  color: #0c5460;
}

.task-status.待办 {
  background: #d4edda;
  color: #155724;
}

.task-status.进行中 {
  background: #cce5ff;
  color: #004085;
}

.task-status.已完成 {
  background: #f8f9fa;
  color: #6c757d;
}

.task-dates {
  font-size: 12px;
  color: var(--fontColor);
  opacity: 0.8;
  padding-left: 5px;
  white-space: nowrap;
}

/* ========== 属性编辑界面 ========== */
.property {
  width: 180px;
  padding: 5px;
  border-left: 1px solid var(--borderColor);
  background: var(--backgroundColor);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.property-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
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
}

.property-label {
  display: block;
  font-size: 12px;
  color: var(--fontColor);
}

.property-input {
  width: calc(100% - 10px);
  border: 1px solid var(--borderColor);
  border-radius: 4px;
  background: var(--backgroundColor);
  color: var(--fontColor);
  font-size: 14px;
  margin: 0px;
  padding: 4px;
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
  width: calc(100% - 4px);
  height: 32px;
  border: 1px solid var(--borderColor);
  border-radius: 4px;
  background: var(--backgroundColor);
  cursor: pointer;
  margin: 0px;
  margin-top: 4px;
  padding: 2px;
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
}
</style>

<script setup lang="ts">
import {ref, computed, watch, onMounted, onBeforeUnmount, nextTick} from 'vue'
import draggable from 'vuedraggable'
import TreeNode from './TreeNode.vue'
import DataSet from './DataSet.vue'

// 类型定义
type ViewMode = 'waterfall' | 'tree' | 'week' | 'month';
type ItemStatus = '灵感' | '规划' | '待办' | '进行中' | '已完成';

interface Item {
  id: number;
  title: string;
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
const selectedStatuses = ref<string[]>([]); // 改为数组，支持多选
const searchText = ref('');

// UI状态
const waterfallGrid = ref<HTMLElement | null>(null);
const waterfallLayout = ref<'masonry' | 'list'>('masonry');
const columnCount = ref(3);
const columnItems = ref<Array<{index: number, items: Item[]}>>([]);
const showDataSet = ref(false);

// 颜色选项
const colorOptions = ref([
  '#FF0000', '#00FF00', '#FF6B6B', '#4ECDC4', '#45B7D1',
  '#96CEB4', '#FFEAA7', '#DDA0DD', '#FDCB6E', '#A29BFE',
  '#FD79A8', '#00B894', '#e9ecef', '#cce5ff', '#d4edda'
]);

// 计算属性 - 修改：为不同视图提供不同的筛选逻辑
const filteredItems = computed(() => {
  if (!allItems.value) return [];
  
  let result = allItems.value;
  
  // 按状态筛选（多选）
  if (selectedStatuses.value.length > 0) {
    result = result.filter((item: Item) => selectedStatuses.value.includes(item.status));
  }
  
  // 按搜索词筛选
  if (searchText.value) {
    const searchTerm = searchText.value.toLowerCase();
    result = result.filter((item: Item) => 
      item.title?.toLowerCase().includes(searchTerm)
    );
  }
  
  // 排序逻辑
  return result.sort((a: Item, b: Item) => {
    if (currentView.value === 'waterfall' || currentView.value === 'tree') {
      // 瀑布流和树状图按创建时间倒序
      return new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime();
    } else {
      // 月视图和周视图按开始时间正序
      const aStart = a.startTime ? new Date(a.startTime).getTime() : 0;
      const bStart = b.startTime ? new Date(b.startTime).getTime() : 0;
      return aStart - bStart;
    }
  });
});

// 专门为周视图计算的筛选项目
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
  
  // 应用状态筛选（多选）
  if (selectedStatuses.value.length > 0) {
    result = result.filter((item: Item) => selectedStatuses.value.includes(item.status));
  }
  
  // 应用搜索筛选
  if (searchText.value) {
    const searchTerm = searchText.value.toLowerCase();
    result = result.filter((item: Item) => 
      item.title?.toLowerCase().includes(searchTerm)
    );
  }
  
  // 按开始时间排序
  return result.sort((a: Item, b: Item) => {
    const aStart = a.startTime ? new Date(a.startTime).getTime() : 0;
    const bStart = b.startTime ? new Date(b.startTime).getTime() : 0;
    return aStart - bStart;
  });
});

// 树状图项目计算 - 只显示规划项目，但应用其他筛选条件
const treeItems = computed({
  get() {
    // 如果没有状态筛选，则显示所有项目（保持原来的逻辑）
    if (selectedStatuses.value.length === 0) {
      // 首先筛选出所有符合条件的项目（根据搜索筛选）
      let result = allItems.value;
      
      // 应用搜索筛选
      if (searchText.value) {
        const searchTerm = searchText.value.toLowerCase();
        result = result.filter((item: Item) => 
          item.title?.toLowerCase().includes(searchTerm)
        );
      }
      
      // 构建树状结构：只返回顶级项目，按 _order 字段排序
      const topItems = result
        .filter((item: Item) => !item.parentId)
        .map(item => ({
          ...item,
          children: getFilteredChildrenItems(item.id, result)
        }))
        .sort((a, b) => {
          const aOrder = a._order !== undefined ? a._order : a.id;
          const bOrder = b._order !== undefined ? b._order : b.id;
          return aOrder - bOrder;
        });
        
      return topItems;
    } 
    // 如果有状态筛选，需要特殊处理以保持父子关系
    else {
      // 步骤1: 找出所有符合筛选状态的项目
      const filteredItems = allItems.value.filter((item: Item) => 
        selectedStatuses.value.includes(item.status)
      );
      
      // 步骤2: 找出这些项目的所有祖先（父级、祖父级等）
      const itemsWithAncestors = new Set<Item>();
      
      filteredItems.forEach(item => {
        // 添加符合条件的项目本身
        itemsWithAncestors.add(item);
        
        // 递归查找并添加所有祖先
        let parentId = item.parentId;
        while (parentId) {
          const parent = allItems.value.find(i => i.id === parentId);
          if (parent) {
            itemsWithAncestors.add(parent);
            parentId = parent.parentId;
          } else {
            break;
          }
        }
      });
      
      // 步骤3: 从所有祖先中找出顶级项目
      const topLevelItems = Array.from(itemsWithAncestors).filter(item => 
        !item.parentId || 
        !Array.from(itemsWithAncestors).some(parent => parent.id === item.parentId)
      );
      
      // 步骤4: 为每个顶级项目构建完整的树结构
      const buildTree = (items: Item[]): Item[] => {
        return items
          .filter(item => itemsWithAncestors.has(item))
          .map(item => {
            // 获取直接子项
            const children = allItems.value.filter(child => 
              child.parentId === item.id && itemsWithAncestors.has(child)
            );
            
            return {
              ...item,
              children: buildTree(children)
            };
          })
          .sort((a, b) => {
            const aOrder = a._order !== undefined ? a._order : a.id;
            const bOrder = b._order !== undefined ? b._order : b.id;
            return aOrder - bOrder;
          });
      };
      
      let result = buildTree(topLevelItems);
      
      // 应用搜索筛选（如果有）
      if (searchText.value) {
        const searchTerm = searchText.value.toLowerCase();
        const filterTreeBySearch = (items: Item[]): Item[] => {
          return items
            .filter(item => item.title?.toLowerCase().includes(searchTerm))
            .map(item => ({
              ...item,
              children: filterTreeBySearch(item.children || [])
            }))
            .filter(item => item.title?.toLowerCase().includes(searchTerm) || 
                           (item.children && item.children.length > 0));
        };
        
        result = filterTreeBySearch(result);
      }
      
      return result;
    }
  },
  set(newItems: Item[]) {
    // 更新所有顶级项目的 _order 字段
    newItems.forEach((item, index) => {
      const existingItem = allItems.value.find(i => i.id === item.id);
      if (existingItem) {
        existingItem._order = index;
        existingItem.parentId = undefined;
      }
    });
    
    storeData();
  }
});

// 获取筛选后的子项（考虑状态筛选和搜索筛选）
function getFilteredChildrenItems(parentId: number, sourceItems: Item[] = allItems.value): Item[] {
  // 获取所有子项
  const children = sourceItems
    .filter((item: Item) => item.parentId === parentId);
  
  // 如果有状态筛选，筛选子项
  if (selectedStatuses.value.length > 0) {
    const filteredChildren = children.filter(child => 
      selectedStatuses.value.includes(child.status) || 
      // 如果子项本身不符合筛选状态，但它的子项符合，也需要显示
      hasMatchingDescendants(child.id)
    );
    
    return filteredChildren
      .sort((a, b) => {
        const aOrder = a._order !== undefined ? a._order : a.id;
        const bOrder = b._order !== undefined ? b._order : b.id;
        return aOrder - bOrder;
      })
      .map(child => ({
        ...child,
        children: getFilteredChildrenItems(child.id, sourceItems)
      }));
  } else {
    // 没有状态筛选，返回所有子项
    return children
      .sort((a, b) => {
        const aOrder = a._order !== undefined ? a._order : a.id;
        const bOrder = b._order !== undefined ? b._order : b.id;
        return aOrder - bOrder;
      })
      .map(child => ({
        ...child,
        children: getFilteredChildrenItems(child.id, sourceItems)
      }));
  }
}

// 检查项目是否有符合条件的后代
function hasMatchingDescendants(itemId: number): boolean {
  // 获取所有子项
  const children = allItems.value.filter(item => item.parentId === itemId);
  
  // 检查直接子项是否符合条件
  if (children.some(child => selectedStatuses.value.includes(child.status))) {
    return true;
  }
  
  // 递归检查子项的子项
  return children.some(child => hasMatchingDescendants(child.id));
}

const currentYear = computed(() => {
  return currentDate.value.getFullYear();
});

const currentMonth = computed(() => {
  return currentDate.value.toLocaleString('default', { month: 'long'}) + (' ' + currentYear.value);
});

const firstDayOfMonth = computed(() => {
  return new Date(currentYear.value, currentDate.value.getMonth(), 1);
});

const daysOfWeek = computed(() => {
  return ['日', '一', '二', '三', '四', '五', '六'];
});

const dates = computed(() => {
  const datesArr: any[] = [];
  const firstDay = new Date(firstDayOfMonth.value);
  const firstDayOfWeek = firstDay.getDay();
  const prevMonthLastDate = new Date(currentYear.value, currentDate.value.getMonth(), 0).getDate();
  
  // 填充上一个月的日期
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthLastDate - i;
    const prevMonthDate = new Date(currentYear.value, currentDate.value.getMonth() - 1, day);
    datesArr.push({
      day,
      isCurrentMonth: false,
      dateObject: prevMonthDate
    });
  }
  
  // 填充当前月份的日期
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
  
  // 填充下一个月的日期
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
  get: () => {
    if (!selectedItem.value) return '';
    return selectedItem.value.title;
  },
  set: (value: string) => {
    if (selectedItem.value) {
      selectedItem.value.title = value;
      updateSelectedItem(selectedItem.value);
    }
  }
});

// 方法
function setCurrentView(view: ViewMode) {
  currentView.value = view;
  
  // 如果是周视图或月视图，更新日期显示
  if (view === 'week' || view === 'month') {
    computer();
  }
  
  // 如果是瀑布流视图，重新计算布局
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
    case 'waterfall': return '搜索所有项目...';
    case 'tree': return '搜索规划项目...';
    case 'week': 
    case 'month': return '搜索日历项目...';
    default: return '搜索...';
  }
}

// 切换状态筛选（多选）
function toggleStatusFilter(status: string) {
  const index = selectedStatuses.value.indexOf(status);
  if (index > -1) {
    // 如果已经选中，则移除
    selectedStatuses.value.splice(index, 1);
  } else {
    // 如果未选中，则添加
    selectedStatuses.value.push(status);
  }
}

// 获取选中的状态标签
function getSelectedStatusLabels() {
  return selectedStatuses.value
    .map(status => statusOptions.find(opt => opt.value === status)?.label)
    .filter(Boolean)
    .join(', ');
}

function getRandomColor() {
  return colorOptions.value[Math.floor(Math.random() * colorOptions.value.length)];
}

function selectItem(item: Item) {
  selectedItem.value = item;
}

function clearSelected() {
  selectedItem.value = null;
}

function addItem() {
  // 如果选择了状态，使用第一个选中的状态作为默认状态
  const defaultStatus = selectedStatuses.value.length > 0 ? selectedStatuses.value[0] : '灵感';
  let newItem: Item;
  
  const today = new Date();
  let startTime = new Date(today);
  let endTime = new Date(today);
  
  // 根据当前视图决定是否设置时间
  if (currentView.value === 'week' || currentView.value === 'month') {
    // 在月视图或周视图中，如果有选中的日期，使用选中的日期
    if (selectedDate.value && !isSameDay(selectedDate.value, today)) {
      startTime = new Date(selectedDate.value);
      endTime = new Date(selectedDate.value);
    }
    
    newItem = {
      id: nextId.value++,
      title: `新的${defaultStatus}`,
      status: defaultStatus as ItemStatus,
      createdTime: new Date(),
      color: getRandomColor(),
      expanded: true,
      startTime: startTime,
      endTime: endTime
    };
  } else {
    // 其他视图中，保持原有逻辑
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 7);
    
    newItem = {
      id: nextId.value++,
      title: `新的${defaultStatus}`,
      status: defaultStatus as ItemStatus,
      createdTime: new Date(),
      color: getRandomColor(),
      expanded: true
    };
    
    // 为需要时间的状态添加时间信息
    if (defaultStatus !== '灵感' && defaultStatus !== '规划') {
      newItem.startTime = today;
      newItem.endTime = endDate;
    }
  }
  
  // 如果是规划项目，设置 _order
  if (defaultStatus === '规划') {
    newItem._order = treeItems.value.length;
  }
  
  allItems.value.push(newItem);
  selectedItem.value = newItem;
  
  storeData();
  
  // 根据当前视图更新显示
  if (currentView.value === 'waterfall') {
    distributeItemsToColumns();
  }
}

// 修改：移除瀑布流视图中的状态转换函数调用
function moveToOrganized(item: Item) {
  item.status = '规划';
  item.expanded = true;
  item.parentId = undefined;
  
  // 设置 _order
  item._order = treeItems.value.length;
  
  updateSelectedItem(item);
  
  // 如果当前是瀑布流视图，更新显示
  if (currentView.value === 'waterfall') {
    distributeItemsToColumns();
  }
}

function moveToInspiration(item: Item) {
  item.status = '灵感';
  item.parentId = undefined;
  delete item._order;
  
  // 如果有子项，也转为灵感
  if (hasChildren(item)) {
    const updateChildrenStatus = (parentId: number) => {
      const children = allItems.value.filter((i: Item) => i.parentId === parentId);
      children.forEach((child: Item) => {
        child.status = '灵感';
        child.parentId = undefined;
        delete child._order;
        updateChildrenStatus(child.id);
      });
    };
    updateChildrenStatus(item.id);
  }
  
  updateSelectedItem(item);
}

function moveToPending(item: Item) {
  const newItem: Item = {
    id: nextId.value++,
    title: item.title.length > 30 ? item.title.substring(0, 30) + '...' : item.title,
    status: '待办',
    createdTime: new Date(),
    startTime: new Date(),
    endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    color: item.color || getRandomColor(),
    relatedId: item.id
  };
  
  allItems.value.push(newItem);
  
  // 如果是规划状态，将其状态改为 '已完成' 以从规划列表中移除
  if (item.status === '规划') {
    item.status = '已完成';
    
    // 同时也需要将所有子项的状态改为 已完成
    const updateChildrenStatus = (parentId: number) => {
      const children = allItems.value.filter((i: Item) => i.parentId === parentId);
      children.forEach((child: Item) => {
        child.status = '已完成';
        updateChildrenStatus(child.id);
      });
    };
    
    updateChildrenStatus(item.id);
    
    updateSelectedItem(item);
  }
  
  selectedItem.value = newItem;
  
  storeData();
}

// 其他方法（与原始代码基本保持一致）
function toggleWaterfallLayout() {
  waterfallLayout.value = waterfallLayout.value === 'masonry' ? 'list' : 'masonry';
}

function expandAll() {
  allItems.value.forEach((item: Item) => {
    if (item.status === '规划') {
      item.expanded = true;
    }
  });
  storeData();
}

function collapseAll() {
  allItems.value.forEach((item: Item) => {
    if (item.status === '规划') {
      item.expanded = false;
    }
  });
  storeData();
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
      today: date.getFullYear() === new Date().getFullYear() && 
             date.getMonth() === new Date().getMonth() && 
             date.getDate() === new Date().getDate(),
      selected: isSameDay(date, selectedDate.value),
      todos: countTodo(date),
    });
  }
}

function getDayName(dayIndex: any) {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return days[dayIndex];
}

function formatDate(date: any) {
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
  // 如果你想显示年份，可以取消注释下面这行
  // const year = d.getFullYear().toString().substring(2);
  // return `${year}-${month}-${day}`;
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

// 修改：countTodo 函数使用筛选后的项目
function countTodo(date: Date): number {
  let itemsToCount = allItems.value;
  
  // 应用状态筛选（多选）
  if (selectedStatuses.value.length > 0) {
    itemsToCount = itemsToCount.filter((item: Item) => selectedStatuses.value.includes(item.status));
  }
  
  // 应用搜索筛选
  if (searchText.value) {
    const searchTerm = searchText.value.toLowerCase();
    itemsToCount = itemsToCount.filter((item: Item) => 
      item.title?.toLowerCase().includes(searchTerm)
    );
  }
  
  if (itemsToCount.length > 0) {
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
  } else {
    return 0;
  }
}

// 修改：getItemsForDate 函数使用筛选后的项目
function getItemsForDate(date: Date) {
  let itemsToShow = allItems.value;
  
  // 应用状态筛选（多选）
  if (selectedStatuses.value.length > 0) {
    itemsToShow = itemsToShow.filter((item: Item) => selectedStatuses.value.includes(item.status));
  }
  
  // 应用搜索筛选
  if (searchText.value) {
    const searchTerm = searchText.value.toLowerCase();
    itemsToShow = itemsToShow.filter((item: Item) => 
      item.title?.toLowerCase().includes(searchTerm)
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

function completeItem(item: Item) {
  const originalItem = allItems.value.find((i: Item) => i.id === item.id);
  if (originalItem) {
    originalItem.status = '已完成';
    storeData();
  }
}

function selectColor(color: string, item: Item) {
  if (item) {
    item.color = color;
    updateSelectedItem(item);
  }
}

function updateSelectedItemTitle(event: Event) {
  if (!selectedItem.value) return;
  const target = event.target as HTMLInputElement;
  const value = target.value;
  
  selectedItem.value.title = value;
  updateSelectedItem(selectedItem.value);
  
  // 强制重新渲染树状图
  nextTick(() => {
    if (currentView.value === 'tree' && treeItems.value) {
      treeItems.value = JSON.parse(JSON.stringify(treeItems.value));
    }
  });
}

function updateItemStatus(event: Event) {
  if (!selectedItem.value) return;
  const target = event.target as HTMLSelectElement;
  selectedItem.value.status = target.value as ItemStatus;
  updateSelectedItem(selectedItem.value);
}

function updateSelectedItem(item: Item) {
  const index = allItems.value.findIndex((i: Item) => i.id === item.id);
  if (index !== -1) {
    allItems.value[index] = { ...item };
    selectedItem.value = { ...item };
    storeData();
    computer();
  }
}

function addChildItem(parent: Item) {
  const newItem: Item = {
    id: nextId.value++,
    title: '新的子规划',
    status: '规划',
    createdTime: new Date(),
    color: getRandomColor(),
    parentId: parent.id
  };
  
  allItems.value.push(newItem);
  
  parent.expanded = true;
  updateSelectedItem(parent);
  
  storeData();
}

function deleteItem(item: Item) {
  // 删除所有子项目
  const deleteChildren = (parentId: number) => {
    const children = allItems.value.filter((i: Item) => i.parentId === parentId);
    children.forEach((child: Item) => {
      deleteChildren(child.id);
      const index = allItems.value.findIndex((i: Item) => i.id === child.id);
      if (index !== -1) {
        allItems.value.splice(index, 1);
      }
    });
  };
  
  deleteChildren(item.id);
  
  // 删除项目本身
  const index = allItems.value.findIndex((i: Item) => i.id === item.id);
  if (index !== -1) {
    allItems.value.splice(index, 1);
  }
  
  storeData();
  if (selectedItem.value && selectedItem.value.id === item.id) {
    selectedItem.value = null;
  }
  
  distributeItemsToColumns();
}

function getChildrenItems(parentId: number, filteredItems: Item[] = allItems.value): Item[] {
  // 直接获取所有子项，按 _order 字段排序，如果没有则按 ID
  const children = filteredItems
    .filter((item: Item) => item.parentId === parentId)
    .sort((a, b) => {
      const aOrder = a._order !== undefined ? a._order : a.id;
      const bOrder = b._order !== undefined ? b._order : b.id;
      return aOrder - bOrder;
    });
  
  // 为每个子项递归获取其子项（使用相同的筛选条件）
  return children.map(child => {
    return {
      ...child,
      children: getChildrenItems(child.id, filteredItems)
    };
  });
}

function toggleExpand(item: Item) {
  item.expanded = !item.expanded;
  updateSelectedItem(item);
}

function onTopLevelDragEnd(event: any) {
  if (event.moved) {
    // 顶级项目之间的顺序变化
    treeItems.value.forEach((item, index) => {
      const existingItem = allItems.value.find(i => i.id === item.id);
      if (existingItem) {
        existingItem._order = index;
      }
    });
    
    storeData();
    
  } else if (event.added) {
    // 项目被添加到顶级列表（从子级拖拽到顶层）
    const { element, newIndex } = event.added;
    
    // 找到这个项目
    const item = allItems.value.find((i: Item) => i.id === element.id);
    if (item) {
      // 设置为顶级
      item.parentId = undefined;
      
      // 更新 _order 字段
      item._order = newIndex;
      
      // 重新排序所有顶级项目的 _order
      const currentTopItems = treeItems.value;
      currentTopItems.forEach((topItem, index) => {
        if (topItem.id !== item.id) {
          const existingItem = allItems.value.find(i => i.id === topItem.id);
          if (existingItem) {
            // 调整 _order：如果 index >= newIndex，则加1
            existingItem._order = index >= newIndex ? index + 1 : index;
          }
        }
      });
      
      storeData();
      
      // 强制更新 treeItems
      nextTick(() => {
        treeItems.value = [...treeItems.value];
      });
    }
  }
}

function handleItemMoved(payload: { movedItem: Item, newParentId?: number, targetItemId?: number, position?: 'before' | 'after' | 'inside' }) {
  const movedItem = allItems.value.find((i: Item) => i.id === payload.movedItem.id);
  if (!movedItem) {
    return;
  }
  
  // 检查是否是移动到自身（防止循环）
  if (payload.newParentId === movedItem.id) {
    return;
  }
  
  // 简单检查：如果新父级是当前项目的子项，则拒绝
  const isChildOfMovedItem = (parentId: number): boolean => {
    const children = getChildrenItems(parentId);
    for (const child of children) {
      if (child.id === movedItem.id) return true;
      if (isChildOfMovedItem(child.id)) return true;
    }
    return false;
  };
  
  if (payload.newParentId && isChildOfMovedItem(movedItem.id)) {
    return;
  }
  
  // 保存旧的父级ID
  const oldParentId = movedItem.parentId;
  
  // 根据 position 处理不同的放置位置
  if (payload.position === 'inside') {
    // 放入目标节点内部
    movedItem.parentId = payload.newParentId;
  } else if (payload.position === 'before' || payload.position === 'after') {
    // 放在目标节点前面或后面
    movedItem.parentId = payload.targetItemId ? 
      allItems.value.find(i => i.id === payload.targetItemId)?.parentId : 
      undefined;
  }
  
  storeData();
  
  // 如果项目从子级移动到顶层，确保它在 treeItems 中
  if (!movedItem.parentId && oldParentId) {
    // 添加到顶级时设置 _order
    movedItem._order = treeItems.value.length;
    nextTick(() => {
      treeItems.value = [...treeItems.value];
    });
  } else if (movedItem.parentId && !oldParentId) {
    // 项目从顶级移动到子级，需要从 treeItems 中移除
    nextTick(() => {
      treeItems.value = treeItems.value.filter(item => item.id !== movedItem.id);
    });
  }
}

function handleChildrenChanged(payload: { itemId: number, children: Item[] }) {
  // 更新子项的父级ID
  payload.children.forEach((child: Item, index: number) => {
    const childItem = allItems.value.find(i => i.id === child.id);
    if (childItem) {
      childItem.parentId = payload.itemId;
      childItem._order = index;
    }
  });
  
  storeData();
}

function formatDateForInput(date: Date | undefined) {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function updateStartTime(event: any, item: Item) {
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
  
  storeData();
}

function updateEndTime(event: any, item: Item) {
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
  
  storeData();
}

function hasChildren(item: Item): boolean {
  if (!item) return false;
  
  // 首先检查 item 本身是否有 children 属性
  if (item.children && item.children.length > 0) {
    return true;
  }
  
  // 如果没有 children 属性，检查 allItems 中是否有 parentId 等于当前 item.id 的项目
  const childItems = allItems.value.filter((i: Item) => i.parentId === item.id);
  return childItems.length > 0;
}

function handleScroll(event: Event) {
  // 可以添加无限滚动逻辑
}

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

async function storeData() {
  try {
    localStorage.setItem('items', JSON.stringify(allItems.value));
    localStorage.setItem('nextId', nextId.value.toString());
    
    window.dispatchEvent(new CustomEvent('items-updated'));
    
    await nextTick();
  } catch (error) {
    console.error('存储数据时出错:', error);
  }
}

function getData() {
  if (localStorage.getItem('items') !== null) {
    const savedItems = JSON.parse(localStorage.getItem('items')!);
    
    allItems.value = savedItems.map((item: any, index: number) => {
      const itemId = item.id || Date.now() - index;
      
      // 兼容性处理
      let title = item.title || item.content || '未命名项目';
      
      return {
        ...item,
        id: itemId,
        title: title,
        color: item.color || getRandomColor(),
        createdTime: new Date(item.createdTime),
        startTime: item.startTime ? new Date(item.startTime) : undefined,
        endTime: item.endTime ? new Date(item.endTime) : undefined,
        expanded: item.expanded !== undefined ? item.expanded : true,
        status: item.status || '灵感'
      };
    });
  } else {
    allItems.value = [];
  }
  
  // 计算下一个可用的ID
  if (allItems.value.length > 0) {
    const maxId = Math.max(...allItems.value.map((i: Item) => i.id));
    nextId.value = maxId + 1;
  } else {
    nextId.value = Date.now();
  }
  
  distributeItemsToColumns();
}

function handleDataImported(data: any) {
  getData();
  showDataSet.value = false;
}

function handleDataCleared() {
  getData();
  showDataSet.value = false;
  selectedItem.value = null;
}

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

// 监听器
watch([filteredItems, columnCount, waterfallLayout], () => {
  if (currentView.value === 'waterfall') {
    distributeItemsToColumns();
  }
}, { immediate: true, deep: true });

watch(allItems, () => {
  computer();
});

watch(showDataSet, (newVal) => {
  if (newVal) {
    selectedItem.value = null;
  }
});

watch(selectedItem, (newVal) => {
  if (newVal) {
    showDataSet.value = false;
  }
});

// 监听筛选条件变化，重新计算
watch([selectedStatuses, searchText], () => {
  // 强制重新计算各个视图的筛选结果
  if (currentView.value === 'week' || currentView.value === 'month') {
    computer();
  }
});

// 生命周期
onMounted(() => {
  nextTick(() => {
    // 确保所有顶级规划项目都有 _order 字段
    const topItems = allItems.value
      .filter((item: Item) => item.status === '规划' && !item.parentId);
    
    topItems.forEach((item, index) => {
      if (item._order === undefined) {
        item._order = index;
      }
    });
    
    if (topItems.length > 0) {
      storeData();
    }
    
    setupResizeObserver();
    computer();
  });
});

onBeforeUnmount(() => {
  window.removeEventListener('items-updated', () => {});
  document.removeEventListener('click', () => {});
  window.removeEventListener('resize', () => {});
});

// 初始化
getData();
</script>