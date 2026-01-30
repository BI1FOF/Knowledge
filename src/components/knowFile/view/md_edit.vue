<script setup lang="ts">
import { onMounted, watch, onBeforeUnmount, ref, computed, watchEffect, nextTick } from 'vue'
import { usestore } from '../../../store'
import * as monaco from 'monaco-editor'
import { debounce } from 'lodash-es'

const store = usestore()

// 编辑器实例
let editor: monaco.editor.IStandaloneCodeEditor | null = null
// 编辑器是否已初始化
const editorInitialized = ref(false)

// 当前数据引用
const data = ref(store.data[store.index])

// 支持的文件类型
const editType = ref([".md", ".html", ".js", ".css", ".ts", ".py", ".json", ".txt", ".flow", ".kb"])

// 主题映射
const themeMap = {
    '深色': 'hc-black',
    '灰色': 'vs-dark', 
    '浅色': 'vs'
} as const

// 语言映射
const languageMap: Record<string, string> = {
    '.md': 'markdown',
    '.html': 'html',
    '.js': 'javascript',
    '.ts': 'typescript',
    '.css': 'css',
    '.py': 'python',
    '.json': 'json',
    '.txt': 'plaintext',
    '.flow': 'json',
    '.kb': 'json'
}

// 计算属性：是否显示编辑器
const shouldShowEditor = computed(() => {
    const currentFile = store.data[store.index]
    return currentFile && editType.value.includes(currentFile.extension)
})

// 获取文件内容
const getFile = (): string => {
    if (store.data.length > 0 && data.value) {
        return data.value.content || ''
    }
    return ''
}

// 检测语言
const detectLanguage = (extension: string): string => {
    return languageMap[extension] || 'plaintext'
}

// 初始化编辑器
const initEditor = function () {
    if (!shouldShowEditor.value) {
        destroyEditor()
        return
    }
    
    data.value = store.data[store.index]
    
    // 确保DOM元素存在并且可见
    const container = document.getElementById('codeeditor')
    if (!container) {
        console.warn('编辑器容器未找到')
        return
    }
    
    // 如果容器有隐藏样式，确保它显示
    if (container.style.display === 'none') {
        container.style.display = 'block'
    }
    
    try {
        // 如果编辑器已经存在，先销毁
        if (editor) {
            destroyEditor()
        }
        
        // 初始化编辑器
        editor = monaco.editor.create(container, {
            value: getFile(),
            language: detectLanguage(data.value.extension),
            theme: themeMap[store.UI.theme as keyof typeof themeMap] || 'vs-dark',
            selectOnLineNumbers: true,
            roundedSelection: false,
            readOnly: false,
            cursorStyle: 'line',
            automaticLayout: true,
            glyphMargin: true,
            useTabStops: false,
            fontSize: 16,
            quickSuggestionsDelay: 100,
            wordWrap: "on",
            minimap: {
                enabled: false
            },
            scrollBeyondLastLine: false,
            folding: true,
            lineNumbersMinChars: 3,
            formatOnPaste: true,
            formatOnType: true,
            renderLineHighlight: 'all',
            scrollbar: {
                vertical: 'visible',
                horizontal: 'visible',
                useShadows: false
            }
        })
        
        // 添加快捷命令面板
        editor.addAction({
            id: 'show-command-palette',
            label: 'Show Command Palette',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP],
            run: () => {
                editor!.trigger('keybinding', 'editor.action.quickCommand', null)
            }
        })
        
        // 添加快捷键保存操作
        editor.addAction({
            id: 'save-file',
            label: 'Save File',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
            run: () => {
                saveContent()
            }
        })
        
        // 设置初始主题
        updateTheme()
        
        // 监听内容变化（防抖保存）
        const debouncedSave = debounce(saveContent, 500)
        editor.onDidChangeModelContent(debouncedSave)
        
        // 监听光标位置变化
        editor.onDidChangeCursorPosition((e) => {
            // 可以在这里添加光标位置相关的逻辑
        })
        
        // 监听编辑器尺寸变化
        window.addEventListener('resize', handleResize)
        
        editorInitialized.value = true
        console.log('编辑器初始化完成')
        
    } catch (error) {
        console.error('编辑器初始化失败:', error)
        editorInitialized.value = false
    }
}

// 处理窗口大小变化
const handleResize = () => {
    if (editor) {
        setTimeout(() => {
            editor?.layout()
        }, 100)
    }
}

// 重新初始化编辑器（用于从不支持的文件切换回来时）
const reinitEditor = () => {
    if (!shouldShowEditor.value) return
    
    // 使用 nextTick 确保DOM更新完成
    nextTick(() => {
        setTimeout(() => {
            initEditor()
        }, 50)
    })
}

// 防抖保存内容
const saveContent = () => {
    if (!editor || !data.value) return
    
    try {
        data.value.content = editor.getValue()
        
        if (data.value.path) {
            window.ipcRenderer.invoke('saveFile', data.value.path, data.value.content)
                .then((success) => {
                    if (success) {
                        console.log('文件保存成功')
                    } else {
                        console.warn('文件保存失败')
                    }
                })
                .catch((error) => {
                    console.error('保存失败:', error)
                })
        }
    } catch (error) {
        console.error('保存内容时出错:', error)
    }
}

// 更新主题
const updateTheme = () => {
    if (!editor) return
    
    const theme = themeMap[store.UI.theme as keyof typeof themeMap]
    if (theme) {
        monaco.editor.setTheme(theme)
    }
}

// 切换语言
const changeLanguage = (language: string) => {
    if (editor) {
        const model = editor.getModel()
        if (model) {
            monaco.editor.setModelLanguage(model, language)
        }
    }
}

// 自动切换语言
const autoChangeLanguage = () => {
    if (editor && data.value) {
        const language = detectLanguage(data.value.extension)
        changeLanguage(language)
    }
}

// 更新编辑器内容
const updateEditorContent = () => {
    if (editor && data.value) {
        const currentValue = editor.getValue()
        const newValue = data.value.content || ''
        
        // 只有当内容不同时才更新，避免光标位置丢失
        if (currentValue !== newValue) {
            // 保存光标位置
            const position = editor.getPosition()
            editor.setValue(newValue)
            
            // 恢复光标位置
            if (position) {
                editor.setPosition(position)
                editor.revealPositionInCenter(position)
            }
        }
        
        autoChangeLanguage()
    }
}

// 更改字体大小
const changeFont = (size: number) => {
    if (editor) {
        editor.updateOptions({
            fontSize: size,
        })
    }
}

// 更改样式主题
const changeStyle = (theme: string) => {
    monaco.editor.setTheme(theme)
}

// 分发保存事件
const dispatchsave = () => {
    saveContent()
}

// 销毁编辑器
const destroyEditor = () => {
    if (editor) {
        try {
            // 移除事件监听器
            window.removeEventListener('resize', handleResize)
            
            // 销毁编辑器
            editor.getModel()?.dispose()
            editor.dispose()
            console.log('编辑器已销毁')
        } catch (error) {
            console.warn('编辑器销毁时出现警告:', error)
        } finally {
            editor = null
            editorInitialized.value = false
        }
    }
}

// 保存快捷键处理
const handleSave = (e: KeyboardEvent) => {
    if ((e.key === 's' || e.key === 'S') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        saveContent()
    }
}

// 监听当前文件变化
watch(() => store.data[store.index], (newValue) => {
    data.value = newValue
    
    if (!shouldShowEditor.value) {
        // 不支持的文件类型，销毁编辑器
        destroyEditor()
        return
    }
    
    // 支持的文件类型
    if (!editor || !editorInitialized.value) {
        // 编辑器未初始化，重新初始化
        reinitEditor()
    } else {
        // 编辑器已存在，更新内容
        updateEditorContent()
    }
}, { immediate: true })

// 监听文件内容变化（从外部更新）
watch(() => data.value?.content, (newContent) => {
    if (editor && newContent !== undefined) {
        updateEditorContent()
    }
})

// 监听主题变化
watchEffect(() => {
    updateTheme()
})

// 监听 shouldShowEditor 变化
watch(shouldShowEditor, (newValue) => {
    if (newValue) {
        // 切换到支持的文件类型
        reinitEditor()
    } else {
        // 切换到不支持的文件类型
        destroyEditor()
    }
})

// 组件挂载
onMounted(() => {
    // 延迟初始化以确保DOM完全渲染
    setTimeout(() => {
        if (shouldShowEditor.value) {
            initEditor()
        }
    }, 100)
    
    window.addEventListener('keydown', handleSave)
})

// 组件卸载
onBeforeUnmount(() => {
    destroyEditor()
    window.removeEventListener('keydown', handleSave)
    window.removeEventListener('resize', handleResize)
})
</script>

<template>
    <div v-if="shouldShowEditor" class="editor" style="border-right:1px solid var(--borderColor)">
        <div class="menu">
            <ul>
                <li @click.prevent>
                    <i class="fa fa-file-text"></i> {{ store.locales == 'zh' ? '文件' : 'file' }}
                    <ul>
                        <li @click="dispatchsave">
                            <i class="fa fa-floppy-o"></i> {{ store.locales == 'zh' ? '保存' : 'save' }}
                        </li>
                    </ul>
                </li>
                <li @click.prevent v-if="false">
                    <i class="fa fa-legal"></i> {{ store.locales == 'zh' ? '插入' : 'insert' }}
                    <ul>
                        <li @click="">
                            <i class="fa fa-code"></i> {{ store.locales == 'zh' ? '代码' : 'code' }}
                        </li>
                        <li @click="">
                            <i class="fa fa-file-image-o"></i> {{ store.locales == 'zh' ? '图片' : 'image' }}
                        </li>
                        <li @click="">
                            <i class="fa fa-link"></i> {{ store.locales == 'zh' ? '链接' : 'link' }}
                        </li>
                    </ul>
                </li>
                <li @click.prevent>
                    <i class="fa fa-adjust"></i> {{ store.locales == 'zh' ? '主题' : 'theme' }}
                    <ul>
                        <li @click="changeStyle('vs')">
                            {{ store.locales == 'zh' ? '浅色' : 'vs' }}
                        </li>
                        <li @click="changeStyle('vs-dark')">
                            {{ store.locales == 'zh' ? '深色' : 'vs-dark' }}
                        </li>
                        <li @click="changeStyle('hc-black')">
                            {{ store.locales == 'zh' ? '黑色' : 'hc-black' }}
                        </li>
                    </ul>
                </li>
                <li @click.prevent>
                    <i class="fa fa-language"></i> {{ store.locales == 'zh' ? '语言' : 'language' }}
                    <ul>
                        <li @click="changeLanguage('markdown')">
                            markdown
                        </li>
                        <li @click="changeLanguage('html')">
                            html
                        </li>
                        <li @click="changeLanguage('javascript')">
                            javascript
                        </li>
                        <li @click="changeLanguage('typescript')">
                            typescript
                        </li>
                        <li @click="changeLanguage('python')">
                            python
                        </li>
                        <li @click="changeLanguage('css')">
                            css
                        </li>
                        <li @click="changeLanguage('json')">
                            json
                        </li>
                        <li @click="changeLanguage('plaintext')">
                            plaintext
                        </li>
                    </ul>
                </li>
                <li @click.prevent>
                    <i class="fa fa-font"></i> {{ store.locales == 'zh' ? '字体' : 'font' }}
                    <ul>
                        <li @click="changeFont(12)">
                            12
                        </li>
                        <li @click="changeFont(15)">
                            15
                        </li>
                        <li @click="changeFont(18)">
                            18
                        </li>
                        <li @click="changeFont(24)">
                            24
                        </li>
                        <li @click="changeFont(30)">
                            30
                        </li>
                    </ul>
                </li>
            </ul>
        </div>
        <div id="codeeditor"></div>
    </div>
    <div v-else class="unsupported-file">
        {{ store.locales === 'zh' ? '不支持的文件类型' : 'Unsupported file type' }}
    </div>
</template>

<style scoped>
.editor {
    position: relative;
    margin: 0px;
    width: 100%;
    height: 100%;
    flex: 2;
    overflow: hidden;
}

#codeeditor {
    position: relative;
    width: 100%;
    max-width: 100%;
    height: calc(100% - 26px);
    outline: none;
    display: block !important; /* 确保编辑器容器始终显示 */
}

.unsupported-file {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--textColor);
    font-size: 14px;
    opacity: 0.7;
}

.menu {
    position: relative;
    width: 100%;
    height: 26px;
    user-select: none;
    border-bottom: 1px solid var(--borderColor);
    background-color: var(--menuColor);
}

/* 一级菜单容器 */
.menu > ul {
    position: absolute;
    margin: 0px;
    padding: 0px;
    z-index: 99;
    display: block;
    white-space: nowrap;
    list-style: none;
}

/* 一级菜单项（横向排列） */
.menu > ul > li {
    position: relative;
    height: 19px;
    cursor: pointer;
    line-height: 18px;
    white-space: nowrap;
    padding: 3px 10px;
    width: fit-content;
    display: inline-block;
    text-align: left;
    z-index: 99;
    font-size: 12px;
    color: var(--textColor);
    vertical-align: top;
}

/* 一级菜单悬停效果 */
.menu > ul > li:hover {
    background: var(--menuActiveColor);
}

/* 一级菜单项之间的分隔线 */
.menu > ul > li:not(:last-child)::after {
    content: '';
    position: absolute;
    right: 0;
    top: 4px;
    bottom: 4px;
    width: 1px;
    background-color: var(--borderColor);
    opacity: 0.5;
}

/* 二级下拉菜单容器 */
.menu li > ul {
    position: absolute;
    left: 0px;
    top: 25px;
    width: fit-content;
    min-width: 120px;
    background-color: var(--menuColor);
    display: none;
    box-shadow: 2px 2px 6px rgba(0, 0, 0, 0.2);
    border: 1px solid var(--borderColor);
    border-radius: 4px;
    z-index: 100;
    padding: 4px 0;
    list-style: none;
    margin: 0;
}

/* 显示二级菜单 */
.menu li:hover > ul {
    display: block;
}

/* 二级菜单项（竖向排列） */
.menu li > ul > li {
    list-style-type: none;
    width: 100%;
    padding: 6px 12px;
    box-sizing: border-box;
    white-space: nowrap;
    display: block;
    cursor: pointer;
    font-size: 12px;
    color: var(--textColor);
    transition: background-color 0.2s ease;
}

/* 二级菜单项悬停效果 */
.menu li > ul > li:hover {
    background-color: var(--menuHoverColor);
}

/* 二级菜单项图标样式 */
.menu li > ul > li i {
    width: 16px;
    text-align: center;
    margin-right: 8px;
    font-size: 14px;
}

/* 三级菜单（如果存在） */
.menu li > ul > li > ul {
    left: 100%;
    top: 0;
    margin-left: 2px;
    margin-top: -4px;
}

/* 避免菜单重叠时的冲突 */
.menu li > ul > li:hover > ul {
    display: block;
}
</style>