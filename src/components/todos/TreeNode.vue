<template>
  <div class="tree-node" :data-id="item.id" :style="{ marginLeft: depth * 5 + 'px' }">    
    <!-- 上方插入区域 -->
    <div 
      v-if="depth > 0"
      class="drop-zone top"
      :class="{ 'drag-over': isTopZoneDragOver }"
      @dragover.prevent="handleZoneDragOver('top')"
      @dragenter.prevent="handleZoneDragEnter('top')"
      @dragleave="handleZoneDragLeave('top')"
      @drop="handleZoneDrop('top', $event)"
    ></div>
    
    <div class="tree-node-content-wrapper">
      <div class="tree-node-content" 
           :class="{ 
             active: selectedItem && selectedItem.id === item.id,
             'drag-over': isContentDragOver && canDrop
           }"
           @click="$emit('select', item)"
           :draggable="depth > 0"
           @dragstart="handleDragStart"
           @dragover.prevent="handleDragOver"
           @dragenter.prevent="isContentDragOver = true"
           @dragleave="isContentDragOver = false"
           @drop="handleContentDrop">
        
        <div class="tree-node-toggle" @click.stop="$emit('toggleExpand', item)">
          <i class="fa" :class="item.expanded ? 'fa-chevron-down' : 'fa-chevron-right'"></i>
        </div>
        
        <div class="tree-node-color" :style="{ backgroundColor: item.color || '#e9ecef' }"></div>
        
        <div class="tree-node-text">
          {{ item.title }}
          <span v-if="item.children && item.children.length > 0" class="sub-items-count">
            ({{ item.children.length }})
          </span>
        </div>

        <div class="tree-node-actions">
          <button @click.stop="$emit('addChild', item)" class="tree-node-btn" title="添加子项">
            <i class="fa fa-plus"></i>
          </button>
          <button @click.stop="$emit('moveToPending', item)" v-if="!item.children || item.children.length === 0" class="tree-node-btn" title="转为待办">
            <i class="fa fa-calendar-o"></i>
          </button>
          <button @click.stop="$emit('moveToInspiration', item)" v-if="!item.children || item.children.length === 0" class="tree-node-btn" title="转为灵感">
            <i class="fa fa-lightbulb-o"></i>
          </button>
          <button @click.stop="$emit('delete', item)" class="tree-node-btn danger" title="删除">
            <i class="fa fa-trash"></i>
          </button>
        </div>
        
        <div class="tree-node-status-icon" :title="item.status">
          <i :class="getStatusIcon(item.status)"></i>
        </div>
      </div>
    </div>
    
    <!-- 下方插入区域 -->
    <div 
      v-if="depth > 0"
      class="drop-zone bottom"
      :class="{ 'drag-over': isBottomZoneDragOver }"
      @dragover.prevent="handleZoneDragOver('bottom')"
      @dragenter.prevent="handleZoneDragEnter('bottom')"
      @dragleave="handleZoneDragLeave('bottom')"
      @drop="handleZoneDrop('bottom', $event)"
    ></div>
    
    <div class="tree-children" v-if="item.expanded && item.children && item.children.length > 0">
      <draggable 
        :list="childrenList"
        group="tree-items"
        item-key="id"
        :animation="150"
        ghost-class="tree-ghost"
        drag-class="tree-drag"
        @change="handleDragChange"
        class="tree-child-list">
        <template #item="{ element }">
          <tree-node 
            :item="element"
            :depth="depth + 1"
            :selected-item="selectedItem"
            @select="$emit('select', $event)"
            @addChild="$emit('addChild', $event)"
            @edit="$emit('edit', $event)"
            @delete="$emit('delete', $event)"
            @moveToPending="$emit('moveToPending', $event)"
            @moveToInspiration="$emit('moveToInspiration', $event)"
            @toggleExpand="$emit('toggleExpand', $event)"
            @childrenChanged="$emit('childrenChanged', $event)"
            @itemMoved="handleItemMoved"
          />
        </template>
      </draggable>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import draggable from 'vuedraggable'

// 更新类型定义 - 移除 type 字段和 content 字段
type ItemStatus = '灵感' | '规划' | '待办' | '进行中' | '已完成'

interface Item {
  id: number;
  title: string;  // 统一使用 title 字段
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

const props = defineProps<{
  item: Item;
  depth: number;
  selectedItem?: Item | null;
}>()

const emit = defineEmits<{
  (e: 'select', item: Item): void;
  (e: 'addChild', item: Item): void;
  (e: 'edit', item: Item): void;
  (e: 'delete', item: Item): void;
  (e: 'moveToPending', item: Item): void;
  (e: 'moveToInspiration', item: Item): void;
  (e: 'toggleExpand', item: Item): void;
  (e: 'childrenChanged', payload: { itemId: number, children: Item[] }): void;
  (e: 'itemMoved', payload: { movedItem: Item, newParentId?: number, targetItemId?: number, position?: 'before' | 'after' | 'inside' }): void;
}>()

// 拖拽状态
const isContentDragOver = ref(false)
const isTopZoneDragOver = ref(false)
const isBottomZoneDragOver = ref(false)
const draggedItemId = ref<number | null>(null)

const canDrop = computed(() => {
  return !draggedItemId.value || draggedItemId.value !== props.item.id
})

const childrenList = computed({
  get() {
    return props.item.children || []
  },
  set(newChildren: Item[]) {
    props.item.children = newChildren
    emit('childrenChanged', {
      itemId: props.item.id,
      children: newChildren
    })
  }
})

// 状态图标函数
const getStatusIcon = (status: ItemStatus): string => {
  const statusIcons: Record<ItemStatus, string> = {
    '灵感': 'fa fa-lightbulb-o',
    '规划': 'fa fa-sitemap',
    '待办': 'fa fa-clock-o',
    '进行中': 'fa fa-spinner fa-spin',
    '已完成': 'fa fa-check-circle-o'
  };
  return statusIcons[status] || 'fa fa-circle';
}

// 辅助函数
const getDraggedItemId = (event: DragEvent): number | null => {
  const itemIdStr = event.dataTransfer?.getData('text/plain')
  if (!itemIdStr) return null
  
  const itemId = parseInt(itemIdStr)
  return isNaN(itemId) ? null : itemId
}

// 拖拽开始
const handleDragStart = (event: DragEvent) => {
  if (props.depth === 0 || !props.item.id) {
    event.preventDefault()
    return
  }
  
  draggedItemId.value = props.item.id
  event.dataTransfer?.setData('text/plain', props.item.id.toString())
  event.dataTransfer!.effectAllowed = 'move'
}

// 内容区域拖拽
const handleDragOver = (event: DragEvent) => {
  if (props.depth === 0) return
  if (canDrop.value) {
    event.preventDefault()
  }
}

const handleContentDrop = (event: DragEvent) => {
  if (props.depth === 0) return
  
  event.preventDefault()
  isContentDragOver.value = false
  
  const droppedItemId = getDraggedItemId(event)
  if (!droppedItemId || droppedItemId === props.item.id || !props.item.id) return
  
  emit('itemMoved', {
    movedItem: { id: droppedItemId } as Item,
    newParentId: props.item.id,
    targetItemId: props.item.id,
    position: 'inside'
  })
  
  // 自动展开接收拖拽的节点
  if (!props.item.expanded) {
    emit('toggleExpand', props.item)
  }
}

// 插入区域拖拽
const handleZoneDragOver = (zone: 'top' | 'bottom') => {
  if (props.depth === 0) return
  if (canDrop.value) {
    if (zone === 'top') isTopZoneDragOver.value = true
    else isBottomZoneDragOver.value = true
  }
}

const handleZoneDragEnter = (zone: 'top' | 'bottom') => {
  if (props.depth === 0) return
  if (canDrop.value) {
    isContentDragOver.value = false
    if (zone === 'top') {
      isTopZoneDragOver.value = true
      isBottomZoneDragOver.value = false
    } else {
      isTopZoneDragOver.value = false
      isBottomZoneDragOver.value = true
    }
  }
}

const handleZoneDragLeave = (zone: 'top' | 'bottom') => {
  if (zone === 'top') isTopZoneDragOver.value = false
  else isBottomZoneDragOver.value = false
}

const handleZoneDrop = (zone: 'top' | 'bottom', event: DragEvent) => {
  if (props.depth === 0) return
  
  event.preventDefault()
  isTopZoneDragOver.value = false
  isBottomZoneDragOver.value = false
  
  const droppedItemId = getDraggedItemId(event)
  if (!droppedItemId || droppedItemId === props.item.id || !props.item.id) return
  
  emit('itemMoved', {
    movedItem: { id: droppedItemId } as Item,
    newParentId: props.item.parentId,
    targetItemId: props.item.id,
    position: zone === 'top' ? 'before' : 'after'
  })
}

// 处理子列表拖拽
const handleDragChange = (evt: any) => {
  if (evt.moved) {
    // 同一层级内重新排序
    const { element, oldIndex, newIndex } = evt.moved
    
    const newChildren = [...childrenList.value]
    const [movedItem] = newChildren.splice(oldIndex, 1)
    newChildren.splice(newIndex, 0, movedItem)
    
    childrenList.value = newChildren
    
    emit('itemMoved', {
      movedItem: element,
      newParentId: props.item.id,
      targetItemId: props.item.id,
      position: 'inside'
    })
    
  } else if (evt.added) {
    // 项目被添加到这个节点
    const { element } = evt.added
    
    emit('itemMoved', {
      movedItem: element,
      newParentId: props.item.id,
      targetItemId: props.item.id,
      position: 'inside'
    })
  }
}

// 处理子节点移动事件
const handleItemMoved = (payload: { movedItem: Item, newParentId?: number, targetItemId?: number, position?: 'before' | 'after' | 'inside' }) => {
  emit('itemMoved', payload)
}
</script>

<style scoped>
.tree-node {
  margin-bottom: 2px;
  position: relative;
}

.drop-zone {
  height: 0px;
  background-color: transparent;
  transition: all 0.2s ease;
  border-radius: 2px;
}

.drop-zone.drag-over {
  background-color: var(--fontActiveColor);
  height: 8px;
}

.drop-zone.top {
  margin-top: 2px;
}

.drop-zone.bottom {
  margin-bottom: 2px;
}

.tree-node-content {
  display: flex;
  align-items: center;
  padding: 5px;
  border: 1px solid var(--borderColor);
  border-radius: 4px;
  background: var(--backgroundColor);
  cursor: pointer;
  transition: all 0.2s ease;
}

.tree-node-content:hover {
  background: var(--menuActiveColor);
}

.tree-node-content.active {
  background: var(--menuActiveColor);
  border-color: var(--fontActiveColor);
  border-width: 1px;
}

.tree-node-content.drag-over {
  background: var(--menuActiveColor);
  border: 2px dashed var(--fontActiveColor);
  opacity: 0.8;
}

.tree-node-toggle {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 8px;
  cursor: pointer;
  opacity: 0.6;
}

.tree-node-toggle:hover {
  opacity: 1;
}

.tree-node-color {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  margin-right: 8px;
}

.tree-node-text {
  flex: 1;
  font-size: 14px;
  color: var(--fontColor);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 添加状态图标样式 */
.tree-node-status-icon {
  margin-right: 8px;
  font-size: 12px;
  opacity: 0.7;
  width: 16px;
  text-align: center;
}

.sub-items-count {
  font-size: 12px;
  opacity: 0.7;
  margin-left: 4px;
}

.tree-node-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.tree-node-content:hover .tree-node-actions {
  opacity: 1;
}

.tree-node-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  color: var(--fontColor);
  cursor: pointer;
  border-radius: 4px;
}

.tree-node-btn:hover {
  background: var(--menuColor);
}

.tree-node-btn.danger:hover {
  background: #ff6b6b;
  color: white;
}

.tree-children {
  margin-left: 5px;
  padding-left: 10px;
  border-left: 2px dashed var(--borderColor);
}

.tree-child-list {
  min-height: 20px;
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
</style>