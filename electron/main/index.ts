import { app, BrowserWindow, shell, ipcMain, dialog, globalShortcut, Menu, desktopCapturer, nativeImage, screen } from 'electron'
import { release } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as fs from 'fs'
import * as path from 'path'
import yaml from 'js-yaml'
import mammoth from "mammoth"
import TurndownService from 'turndown'
import xlsx from 'xlsx'
import * as PDFJS from 'pdfjs-dist'
import { pythonService } from './python-service'
import { trustedPythonService } from './trusted-python-service'
import { fork } from 'child_process'
import { randomUUID } from 'crypto'

globalThis.__filename = fileURLToPath(import.meta.url)
globalThis.__dirname = dirname(__filename)

// The built directory structure
process.env.DIST_ELECTRON = join(__dirname, '..')
process.env.DIST = join(process.env.DIST_ELECTRON, '../dist')
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.DIST_ELECTRON, '../public')
  : process.env.DIST

// Disable GPU Acceleration for Windows 7
if (release().startsWith('6.1')) app.disableHardwareAcceleration()

// ARM Linux environments often lack working GPU drivers, which can crash the
// renderer GPU process and leave a blank window.
if (process.platform === 'linux') app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

const boundsFilePath = path.join(app.getPath('userData'), 'window-bounds.json');

let win: BrowserWindow | null = null
const preload = join(__dirname, '../preload/index.mjs')
const url = process.env.VITE_DEV_SERVER_URL
const indexHtml = join(process.env.DIST, 'index.html')

// ==================== llama.cpp 子进程管理 ====================

let llamaServiceProcess: any = null
let llamaRequestId = 0
const llamaCallbacks = new Map()

// 动态创建 llama 服务文件
function ensureLlamaServiceFile(): string | null {
    const targetPath = join(__dirname, 'llama-service.mjs')
    
    // 如果文件已存在，直接返回
    if (fs.existsSync(targetPath)) {
        console.log('[llama] 服务文件已存在:', targetPath)
        return targetPath
    }
    
    console.log('[llama] 正在创建服务文件:', targetPath)
    
    // 服务文件内容 - 使用 ES Module 格式
    const serviceContent = `// electron/llama-service.mjs
import { getLlama, LlamaChatSession } from 'node-llama-cpp';
import { randomUUID } from 'crypto';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let llamaModelCache = new Map();
let llamaStreamRequests = new Map();

async function validateModelFile(modelPath) {
    if (!fs.existsSync(modelPath)) {
        throw new Error(\`模型文件不存在: \${modelPath}\`);
    }
    const stats = fs.statSync(modelPath);
    const sizeMB = stats.size / 1024 / 1024;
    console.log(\`[llama-service] 文件大小: \${sizeMB.toFixed(2)} MB\`);
    return true;
}

async function getLlamaModel(modelPath, options) {
    if (llamaModelCache.has(modelPath)) {
        return llamaModelCache.get(modelPath);
    }
    
    try {
        await validateModelFile(modelPath);
        
        const llama = await getLlama();
        const threads = 2;  // 固定2线程
        const gpuLayers = 0;
        const contextSize = 2048;
        
        const model = await llama.loadModel({
            modelPath: modelPath,
            gpuLayers: gpuLayers,
            threads: threads,
            contextSize: contextSize
        });
        
        llamaModelCache.set(modelPath, model);
        console.log('[llama-service] 模型加载成功');
        return model;
    } catch (error) {
        console.error('[llama-service] 加载模型失败:', error);
        throw error;
    }
}

async function scanModels(modelsDir) {
    const resolvedDir = path.resolve(modelsDir || './models');
    const availableModels = [];
    
    if (!fs.existsSync(resolvedDir)) {
        fs.mkdirSync(resolvedDir, { recursive: true });
        return { success: true, models: availableModels };
    }
    
    const files = fs.readdirSync(resolvedDir);
    for (const file of files) {
        const fullPath = path.join(resolvedDir, file);
        const stat = fs.statSync(fullPath);
        
        if (!stat.isDirectory() && (file.endsWith('.gguf') || file.endsWith('.GGUF'))) {
            const name = file.replace(/\\.gguf$/i, '');
            availableModels.push({ name, path: fullPath });
        }
    }
    
    return { success: true, models: availableModels };
}

async function runInference(params) {
    const { modelPath, prompt, temperature, maxTokens } = params;
    let context = null;
    
    try {
        const safeMaxTokens = Math.min(maxTokens, 2048);
        
        const model = await getLlamaModel(modelPath, {});
        context = await model.createContext();
        const session = new LlamaChatSession({ contextSequence: context.getSequence() });
        
        const response = await session.prompt(prompt, {
            temperature: temperature || 0.7,
            maxTokens: safeMaxTokens,
            topP: 0.9,
            topK: 40
        });
        
        // 不立即清理，让进程自然退出
        return { success: true, content: response };
    } catch (error) {
        console.error('[llama-service] 推理失败:', error);
        return { success: false, error: error.message };
    }
}

async function runStreamInference(id, params) {
    const { modelPath, prompt, temperature, maxTokens } = params;
    const requestId = randomUUID();
    let context = null;
    const controller = new AbortController();
    
    llamaStreamRequests.set(requestId, { controller });
    
    try {
        const safeMaxTokens = Math.min(maxTokens, 2048);
        
        const model = await getLlamaModel(modelPath, {});
        context = await model.createContext();
        const session = new LlamaChatSession({ contextSequence: context.getSequence() });
        
        process.send({ type: 'streamStart', id, requestId });
        
        let fullResponse = '';
        
        await session.prompt(prompt, {
            temperature: temperature || 0.7,
            maxTokens: safeMaxTokens,
            topP: 0.9,
            topK: 40,
            onTextChunk: (chunk) => {
                if (controller.signal.aborted) return;
                if (chunk) {
                    fullResponse += chunk;
                    process.send({ type: 'streamChunk', id, requestId, chunk });
                }
            }
        });
        
        process.send({ type: 'streamComplete', id, requestId, fullContent: fullResponse });
        
        // 清理请求记录，但不释放上下文（让进程自然退出）
        llamaStreamRequests.delete(requestId);
        
    } catch (error) {
        console.error('[llama-service] 流式推理失败:', error);
        process.send({ type: 'streamError', id, requestId, error: error.message });
        llamaStreamRequests.delete(requestId);
    }
}

process.on('message', async (message) => {
    const { type, id, params } = message;
    console.log('[llama-service] 收到消息:', type);
    
    try {
        switch (type) {
            case 'scan':
                const result = await scanModels(params.modelsDir);
                process.send({ type: 'scanResult', id, result });
                break;
            case 'inference':
                const inferenceResult = await runInference(params);
                process.send({ type: 'inferenceResult', id, result: inferenceResult });
                break;
            case 'streamInference':
                await runStreamInference(id, params);
                break;
            case 'abort':
                const info = llamaStreamRequests.get(params.requestId);
                if (info) info.controller.abort();
                process.send({ type: 'abortResult', id, result: { success: true } });
                break;
        }
    } catch (error) {
        console.error('[llama-service] 处理失败:', error);
        process.send({ type: \`\${type}Result\`, id, error: error.message });
    }
});

console.log('[llama-service] 服务已启动，使用保守配置');
`;
    
    try {
        // 确保目录存在
        const dir = path.dirname(targetPath)
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }
        
        // 写入文件
        fs.writeFileSync(targetPath, serviceContent, 'utf8')
        console.log('[llama] 服务文件创建成功:', targetPath)
        return targetPath
    } catch (error) {
        console.error('[llama] 创建服务文件失败:', error)
        return null
    }
}

// 初始化 llama 服务子进程
function initLlamaService() {
    if (llamaServiceProcess) return
    
    // 确保服务文件存在
    const servicePath = ensureLlamaServiceFile()
    
    if (!servicePath) {
        console.error('[llama] 无法创建或找到服务文件')
        return
    }
    
    try {
        console.log('[llama] 启动服务子进程:', servicePath)
        llamaServiceProcess = fork(servicePath, [], {
            execArgv: ['--experimental-vm-modules'] // 添加这个标志以支持 ES Module
        })
        
        llamaServiceProcess.on('message', (message: any) => {
            const { type, id, result, error, requestId, chunk, fullContent } = message
            
            const callback = llamaCallbacks.get(id)
            if (!callback) return
            
            switch (type) {
                case 'scanResult':
                case 'inferenceResult':
                case 'statusResult':
                case 'unloadResult':
                case 'abortResult':
                    if (error) {
                        callback.reject(new Error(error))
                    } else {
                        callback.resolve(result)
                    }
                    llamaCallbacks.delete(id)
                    break
                    
                case 'streamStart':
                    callback.resolve({ requestId })
                    break
                    
                case 'streamChunk':
                    if (callback.onStream) {
                        callback.onStream(chunk)
                    }
                    break
                    
                case 'streamComplete':
                    if (callback.onComplete) {
                        callback.onComplete(fullContent)
                    }
                    llamaCallbacks.delete(id)
                    break
                    
                case 'streamError':
                    if (callback.onError) {
                        callback.onError(new Error(error))
                    }
                    llamaCallbacks.delete(id)
                    break
            }
        })
        
        llamaServiceProcess.on('error', (error: Error) => {
            console.error('[llama] 子进程错误:', error)
        })
        
        llamaServiceProcess.on('exit', (code: number) => {
            console.log('[llama] 子进程退出:', code)
            llamaServiceProcess = null
            // 退出后重新初始化
            setTimeout(() => {
                if (!llamaServiceProcess) {
                    console.log('[llama] 尝试重新启动服务...')
                    initLlamaService()
                }
            }, 5000)
        })
        
        console.log('[llama] 服务子进程已启动')
    } catch (error) {
        console.error('[llama] 启动服务子进程失败:', error)
    }
}

// 发送消息到 llama 服务
function sendToLlamaService(type: string, params: any, streamCallbacks: any = null): Promise<any> {
    return new Promise((resolve, reject) => {
        if (!llamaServiceProcess) {
            initLlamaService()
            if (!llamaServiceProcess) {
                reject(new Error('llama 服务未启动'))
                return
            }
        }
        
        const id = ++llamaRequestId
        llamaCallbacks.set(id, { resolve, reject, ...streamCallbacks })
        
        llamaServiceProcess.send({ type, id, params })
        
        // 超时处理
        setTimeout(() => {
            if (llamaCallbacks.has(id)) {
                llamaCallbacks.delete(id)
                reject(new Error('请求超时'))
            }
        }, 300000) // 5分钟超时
    })
}

// ==================== 窗口创建 ====================

async function createWindow() {
  win = new BrowserWindow({
    title: 'AI-KM',
    width: 900,
    height: 600,
    minWidth: 600,
    minHeight: 350,
    icon: join(process.env.VITE_PUBLIC, 'favicon.ico'),
    titleBarStyle: 'hidden',
    webPreferences: {
      preload,
      webSecurity: false
    },
  })
  
  if (process.platform === 'linux') {
    win.setMenuBarVisibility(false)
    Menu.setApplicationMenu(null)
  }
  
  if (fs.existsSync(boundsFilePath)) {
    const bounds = JSON.parse(fs.readFileSync(boundsFilePath, { encoding: 'utf8' }));
    win.setBounds(bounds);
  }
  
  globalShortcut.register('CommandOrControl+=', () => {
    const zoomFactor = win!.webContents.zoomFactor;
    win!.webContents.zoomFactor = zoomFactor + 0.1;
  });
  
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(url)
    win.webContents.openDevTools({ mode: 'undocked' })
  } else {
    win.loadFile(indexHtml)
  }
  
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })
  
  win.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  })
}

// ==================== 应用生命周期 ====================

app.whenReady().then(async () => {
  await pythonService.initialize()
  initLlamaService() // 初始化 llama 服务
  createWindow()
})

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

app.on('will-quit', () => {
  if (llamaServiceProcess) {
    llamaServiceProcess.kill()
  }
})

// ==================== IPC 处理器 ====================

ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${url}#${arg}`)
  } else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }
})

// 文件树相关函数
function getDirectoryTree(directoryPath: string): any {
  const absolutePath = path.resolve(directoryPath);
  const stats = fs.statSync(directoryPath);
  if (stats.isDirectory()) {
    const files = fs.readdirSync(directoryPath);
    const tree = {
      label: path.basename(directoryPath),
      type: 'folder',
      path: absolutePath,
      children: files.map(file => getDirectoryTree(path.join(directoryPath, file))),
      extension: 'folder'
    }
    return tree;
  } else {
    return {
      label: path.basename(directoryPath),
      type: 'file',
      path: absolutePath,
      extension: path.extname(directoryPath)
    };
  }
}

ipcMain.handle('getDirectoryTree', (event, folderPath) => {
  if (folderPath) {
    const tree = [getDirectoryTree(folderPath)];
    fs.watchFile(folderPath, (curr: any, prev: any) => {
      console.log("文件变化")
    })
    return tree;
  }
})

function getFiles(folderPath: string, depth: number, fileList: any[] = []): any[] {
  const files = fs.readdirSync(folderPath);
  depth--;

  files.forEach(file => {
    const filePath = path.join(folderPath, file);
    const stats = fs.statSync(filePath);
    if (stats.isDirectory() && depth > 0) {
      getFiles(filePath, depth, fileList);
    } else {
      const fileExtension = path.extname(filePath);
      let fileData = {
        label: path.basename(filePath),
        type: stats.isDirectory() ? 'folder' : 'file',
        path: filePath,
        extension: stats.isDirectory() ? 'folder' : fileExtension,
        attributes: {}
      }
      fileData.attributes = getConfig(filePath)
      fileList.push(fileData);
    }
  });
  return fileList;
}

function getFilesRelation(folderPath: string, depth: number, parentIndex: number | undefined, fileList: any[] = [], relationList: any[] = []): { fileList: any[], relationList: any[] } {
  if (depth <= 0) return { fileList, relationList };
  
  const files = fs.readdirSync(folderPath)
  
  files.forEach(file => {
    const filePath = path.join(folderPath, file)
    const stats = fs.statSync(filePath)

    const fileData = {
      id: fileList.length,
      label: file,
      type: stats.isDirectory() ? 'folder' : 'file',
      path: filePath,
      extension: stats.isDirectory() ? 'folder' : path.extname(filePath),
      attributes: {}
    }
    
    if (fileData.extension === '.md' || fileData.type === 'folder') {
      fileData.attributes = getConfig(filePath)
    }
    
    fileList.push(fileData)
    
    if (parentIndex !== undefined) {
      relationList.push({ source: parentIndex, target: fileData.id })
    }

    if (stats.isDirectory() && depth > 1) {
      getFilesRelation(filePath, depth - 1, fileData.id, fileList, relationList)
    }
  })
  
  return { fileList, relationList }
}

function getConfig(fullPath: string): any {
  try {
    let isFolder = fs.statSync(fullPath).isDirectory()
    fullPath = isFolder ? (fullPath + "\\.README.md") : (fullPath)
    if (path.extname(fullPath) != '.md') return {}
    let isFile = fs.existsSync(fullPath)
    if (isFile) {
      const fileContent = fs.readFileSync(fullPath, 'utf8')
      const matches = fileContent.match(/^---\r?\n([\s\S]+?)\r?\n---/)
      if (matches && matches.length > 1) {
        const yamlHeader = matches[1]
        try {
          const headerObj = yaml.load(yamlHeader)
          return headerObj
        } catch (error) {
          console.error('Failed to parse YAML header:', error)
          return {}
        }
      } else {
        return {}
      }
    } else {
      return {}
    }
  } catch (error) {
    console.error('An error occurred while trying to load the js-yaml module:', error);
    return {}
  }
}

ipcMain.handle('getConfig', (event, path) => {
  if (path) {
    return getConfig(path)
  }
})

ipcMain.handle('saveFileMetadata', async (event, filePath, metadata) => {
  try {
    if (!filePath || path.extname(filePath) !== '.md') return false
    if (!fs.existsSync(filePath)) return false

    const fileContent = fs.readFileSync(filePath, 'utf8')
    const matches = fileContent.match(/^---\r?\n([\s\S]+?)\r?\n---\r?\n?/)
    const rest = matches ? fileContent.slice(matches[0].length) : (matches === null ? fileContent : '')

    const yamlStr = yaml.dump(metadata || {})
    const newContent = `---\n${yamlStr}---\n${rest}`

    fs.writeFileSync(filePath, newContent, 'utf8')
    return true
  } catch (error) {
    console.error('保存文件元数据失败:', error)
    return false
  }
})

ipcMain.handle('getFiles', (event, folderPath, n) => {
  if (folderPath) {
    const files = getFiles(folderPath, n, [])
    return files
  }
})

ipcMain.handle('getFilesRelation', (event, folderPath, n) => {
  if (folderPath) {
    const { fileList, relationList } = getFilesRelation(folderPath, n, undefined)
    return { fileList, relationList }
  }
})

ipcMain.handle('selectFile', async (event) => {
  const result = await dialog.showOpenDialog(win!, {
    properties: ['openFile']
  });

  if (!result.canceled) {
    return result.filePaths[0];
  } else {
    return null;
  }
});

ipcMain.handle('openFolderDialog', async (event) => {
  const result = await dialog.showOpenDialog(win!, {
    properties: ['openDirectory']
  });

  if (!result.canceled) {
    return result.filePaths[0];
  } else {
    return null;
  }
});

async function readPdf(filePath: string): Promise<string> {
  const fileBuffer = fs.readFileSync(filePath)
  const uint8 = new Uint8Array(fileBuffer)
  const loadingTask = PDFJS.getDocument({ data: uint8 })
  const pdfDocument = await loadingTask.promise
  const pageCount = pdfDocument.numPages;
  let textContent = '';

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdfDocument.getPage(i);
    const content = await page.getTextContent();
    const strings = (content as { items: { str: string }[] }).items.map(item => item.str);
    textContent += strings.join(' ');
  }
  return textContent;
}

function convertToMarkdown(data: any[]): string {
  let markdown = '';
  const headers = data[0];
  markdown += '| ' + headers.join(' | ') + ' |\n';
  markdown += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
  for (let i = 1; i < data.length; i++) {
    markdown += '| ' + data[i].join(' | ') + ' |\n';
  }
  return markdown;
}

async function createFile(directoryPath: string, fileName: string): Promise<string | null> {
  try {
    if (!fs.existsSync(directoryPath)) {
      throw new Error(`目录 ${directoryPath} 不存在`);
    }

    const filePath = path.join(directoryPath, fileName);

    if (fs.existsSync(filePath)) {
      throw new Error(`文件 ${filePath} 已存在`);
    }

    fs.writeFileSync(filePath, '');
    return filePath;
  } catch (error) {
    console.error('创建文件失败:', error);
    return null;
  }
}

ipcMain.handle('createFile', async (event, directoryPath: string, fileName: string) => {
  return await createFile(directoryPath, fileName);
});

function getInf(filePath: string): any {
  try {
    const stats = fs.statSync(filePath);
    const type = stats.isDirectory() ? 'folder' : 'file';
    const label = path.basename(filePath);
    const extension = type === 'folder' ? 'folder' : path.extname(filePath);
    return { type, label, extension };
  } catch (error) {
    console.error(`Error getting file info for path ${filePath}:`, error);
    return null;
  }
}

ipcMain.handle('getInf', async (event, path: string) => {
  return await getInf(path);
});

ipcMain.handle('deleteFile', async (event, filePath) => {
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
});

ipcMain.handle('deleteFolder', async (event, folderPath) => {
  const deleteFolderRecursive = (folderPath: string) => {
    if (fs.existsSync(folderPath)) {
      fs.readdirSync(folderPath).forEach((file) => {
        const curPath = path.join(folderPath, file);
        if (fs.lstatSync(curPath).isDirectory()) {
          deleteFolderRecursive(curPath);
        } else {
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(folderPath);
    }
  };

  try {
    deleteFolderRecursive(folderPath);
    return { success: true };
  } catch (error) {
    console.error('删除文件夹失败:', error);
    throw error;
  }
});

ipcMain.handle('isDirectory', (event, filePath) => {
  try {
    const stats = fs.statSync(filePath);
    return stats.isDirectory();
  } catch (error) {
    return false;
  }
});

ipcMain.handle('openInFolder', async (event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`路径不存在: ${filePath}`);
    }
    shell.showItemInFolder(filePath);
    return true;
  } catch (error) {
    console.error('打开文件位置失败:', error);
    throw error;
  }
});

ipcMain.handle('readFile', async (event, filePath) => {
  const fileExtension = path.extname(filePath);
  
  if (fileExtension == ".md" || fileExtension == "" || fileExtension == ".kb") {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      return fileContent;
    } catch (error: any) {
      return `Error reading file: ${error.message}`;
    }
  } else if (fileExtension == ".docx") {
    try {
      const { value: html } = await mammoth.convertToHtml({ path: filePath })
      const turndownService = new TurndownService()
      const result = turndownService.turndown(html)
      return result
    } catch (err) {
      console.error(err);
      throw err;
    }
  } else if (fileExtension == ".pdf") {
    const result = await readPdf(filePath)
    return result
  } else if (fileExtension == ".xlsx") {
    const workbook = xlsx.readFile(filePath);
    let allMarkdownContent = '';

    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 })
      const markdownContent = convertToMarkdown(jsonData)
      allMarkdownContent += `## ${sheetName}\n\n`
      allMarkdownContent += markdownContent + '\n\n'
    })
    return allMarkdownContent
  } else if (fileExtension == ".html" || fileExtension == ".htm") {
    try {
      const htmlContent = fs.readFileSync(filePath, 'utf-8');
      const textContent = htmlContent
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      return textContent;
    } catch (error: any) {
      return `Error reading HTML file: ${error.message}`;
    }
  } else if (fileExtension == ".js" || fileExtension == ".javascript") {
    try {
      const jsContent = fs.readFileSync(filePath, 'utf-8');
      return `\`\`\`javascript\n${jsContent}\n\`\`\``;
    } catch (error: any) {
      return `Error reading JavaScript file: ${error.message}`;
    }
  } else if (fileExtension == ".py" || fileExtension == ".python") {
    try {
      const pyContent = fs.readFileSync(filePath, 'utf-8');
      return `\`\`\`python\n${pyContent}\n\`\`\``;
    } catch (error: any) {
      return `Error reading Python file: ${error.message}`;
    }
  } else if (fileExtension == ".txt") {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error: any) {
      return `Error reading text file: ${error.message}`;
    }
  } else if (fileExtension == ".json") {
    try {
      const jsonContent = fs.readFileSync(filePath, 'utf-8');
      try {
        const parsed = JSON.parse(jsonContent);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return jsonContent;
      }
    } catch (error: any) {
      return `Error reading JSON file: ${error.message}`;
    }
  } else if (fileExtension == ".csv") {
    try {
      const csvContent = fs.readFileSync(filePath, 'utf-8');
      const lines = csvContent.split('\n').filter(line => line.trim() !== '');
      if (lines.length === 0) return '';
      let markdownTable = '';
      const headers = lines[0].split(',');
      markdownTable += '| ' + headers.join(' | ') + ' |\n';
      markdownTable += '|' + headers.map(() => '---').join('|') + '|\n';
      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(',');
        markdownTable += '| ' + cells.join(' | ') + ' |\n';
      }
      return markdownTable;
    } catch (error: any) {
      return `Error reading CSV file: ${error.message}`;
    }
  } else {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      return `${fileContent}`;
    } catch (error: any) {
      return `不支持的文件格式：${fileExtension}\n错误信息：${error.message}`;
    }
  }
});

ipcMain.handle('openAndReadFile', async (event, type) => {
  const result = await dialog.showOpenDialog(win!, {
    title: '打开文件',
    filters: [{
      name: type,
      extensions: type,
    }],
    buttonLabel: '打开'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      return fileContent;
    } catch (error: any) {
      return `Error reading file: ${error.message}`;
    }
  } else {
    return "";
  }
});

ipcMain.handle('saveFile', async (event, filePath, fileContent) => {
  try {
    fs.writeFileSync(filePath, fileContent);
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
});

ipcMain.on('openTreePath', function (event, p) {
  dialog.showOpenDialog({
    properties: [p],
    title: '请选择位置，并读取树形关系',
    buttonLabel: '选择'
  }).then(result => {
    event.sender.send('selectedTreePath', result)
  })
})

ipcMain.on('closeWindow', () => {
  app.quit()
})

ipcMain.handle('openByApp', async (event, path) => {
  const isWindows = process.platform === 'win32';
  if (isWindows) {
    if (path != "") {
      fs.exists(path, (exists: any) => {
        if (exists) shell.openPath(path)
      })
    }
  }
});

ipcMain.on('dev', () => {
  if (win!.webContents.isDevToolsOpened()) {
    win!.webContents.closeDevTools();
  } else {
    win!.webContents.openDevTools({ mode: "undocked", activate: true });
  }
})

ipcMain.handle('openFile', async (event) => {
  const result = await dialog.showOpenDialog(win!, {
    properties: ['openFile']
  })

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0]
    const content = fs.readFileSync(filePath, 'utf-8')
    return { content, filePath }
  }

  return { content: null, filePath: null }
})

ipcMain.handle('showDialog', async (event, options) => {
  const result = await dialog.showMessageBox(options);
  return result;
});

ipcMain.handle('readFileBinary', async (event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`)
    }
    const fileBuffer = fs.readFileSync(filePath)
    return new Uint8Array(fileBuffer)
  } catch (error) {
    console.error('读取二进制文件失败:', error)
    return null
  }
})

ipcMain.handle('search', async (event, path, filterText) => {
  return search(path, filterText)
});

async function search(storePath: string, filterText: string, dirPath: string = storePath, results: any[] = [], floor: number = 1): Promise<any[]> {
  if (floor > 10) return results
  let filterTexts = filterText.split(" ")
  if (filterTexts.indexOf("") > -1) {
    filterTexts.splice(filterTexts.indexOf(""), 1)
  }

  let list = await fs.promises.readdir(dirPath)

  for (let itemPath of list) {
    const fullPath = path.join(dirPath, itemPath)
    const fileStat = await fs.promises.stat(fullPath)
    const isFile = fileStat.isFile()
    const dir = {
      label: path.basename(itemPath),
      path: path.join(dirPath, itemPath),
      extension: path.extname(itemPath),
    } as any

    if (!isFile) {
      await search(storePath, filterText, fullPath, results, floor + 1)
    }

    let nameCount = 0
    for (let i = 0; i < filterTexts.length; i++) {
      if (dir.label.indexOf(filterTexts[i]) > -1) {
        nameCount++
      }
    }

    let contentArr = []
    let length = 12

    if (dir.extension == ".md") {
      dir.content = await fs.readFileSync(path.join(dirPath, itemPath), 'utf-8')

      let count = 0
      for (let i = 0; i < filterTexts.length; i++) {
        if (dir.content.indexOf(filterTexts[i]) > -1) {
          count++
        }
      }

      if (count >= filterTexts.length) {
        let index = 0
        let num = 0
        while (index != -1) {
          num++
          let nextIndex = Infinity

          for (let i = 0; i < filterTexts.length; i++) {
            if (dir.content.indexOf(filterTexts[i], index) > -1 && dir.content.indexOf(filterTexts[i], index) < nextIndex) {
              nextIndex = dir.content.indexOf(filterTexts[i], index)
            }
          }

          if (nextIndex == Infinity || nextIndex == index) {
            break
          } else if (nextIndex > index) {
            let str = dir.content.slice(Math.max(0, nextIndex - length), Math.min(dir.content.length, nextIndex + length))
            contentArr.push(str)
            index = nextIndex + length
          }
        }
        dir.arr = contentArr
      }
    }

    if (nameCount >= filterTexts.length || contentArr.length > 0) {
      results.push(dir)
    }
  }

  return results
}

ipcMain.handle('toggle-fullscreen', () => {
  if (win!.isFullScreen()) {
    win!.setFullScreen(false);
  } else {
    win!.setFullScreen(true);
  }
});

ipcMain.handle('minimize-window', () => {
  if (win) {
    win.minimize();
  }
});

ipcMain.handle('maximize-window', () => {
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});

ipcMain.handle('close-window', () => {
  if (win) {
    win.close();
  }
});

// ==================== Python 相关 ====================

ipcMain.handle('installPythonPackageWithEnvironment', async (event, { packageName, environment = 'safe' }) => {
  try {
    let result
    if (environment === 'trusted') {
      result = await trustedPythonService.installPackage(packageName)
    } else {
      result = await pythonService.installPackage(packageName)
    }
    return result
  } catch (error: any) {
    return {
      success: false,
      message: `安装包 ${packageName} 失败: ${error.message}`,
      error: error.message
    }
  }
})

ipcMain.handle('listPythonPackagesWithEnvironment', async (event, environment = 'safe') => {
  try {
    let result
    if (environment === 'trusted') {
      result = await trustedPythonService.listPackages()
    } else {
      result = await pythonService.listPackages()
    }
    return result
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    }
  }
})

ipcMain.handle('executePython', async (event, params) => {
  console.log('[主进程] 收到 executePython 请求')
  
  try {
    if (!params) {
      console.error('[主进程] 错误: 参数为空')
      return {
        success: false,
        error: '参数不能为空',
        timestamp: Date.now()
      }
    }
    
    const { code, environment } = params
    console.log(`[主进程] 环境: ${environment}, 代码长度: ${code?.length || 0}`)
    
    if (!code || typeof code !== 'string') {
      return {
        success: false,
        error: '代码内容不能为空',
        timestamp: Date.now()
      }
    }
    
    if (environment) {
      console.log('[主进程] 使用可信环境执行')
      try {
        const result = await trustedPythonService.executeCode(code)
        console.log('[主进程] 可信环境执行完成:', {
          success: result.success,
          outputLength: result.output?.length || 0,
          error: result.error?.substring(0, 100) || '无错误'
        })
        return {
          success: result.success,
          result: result.result,
          output: result.output,
          error: result.error,
          logs: result.logs,
          executionTime: result.executionTime,
          rawOutput: result.rawOutput
        }
      } catch (error: any) {
        console.error('[主进程] 可信环境执行异常:', error)
        return {
          success: false,
          error: `可信环境执行异常: ${error.message}`,
          stack: error.stack,
          timestamp: Date.now()
        }
      }
    } else if (!environment) {
      console.log('[主进程] 使用安全环境执行')
      return {
        success: true,
        result: '安全环境执行结果',
        output: '安全环境输出',
        timestamp: Date.now()
      }
    } else {
      return {
        success: false,
        error: `未知环境类型: ${environment}`,
        timestamp: Date.now()
      }
    }
  } catch (error: any) {
    console.error('[主进程] IPC处理器异常:', error)
    return {
      success: false,
      error: `IPC处理器异常: ${error.message}`,
      stack: error.stack,
      timestamp: Date.now()
    }
  }
})

ipcMain.handle('checkPythonInstallation', async () => {
  return await pythonService.checkInstallation()
})

ipcMain.handle('validatePythonCode', async (event, code) => {
  return pythonService.validateCodeSecurity(code)
})

// ==================== Agent Skills 功能 ====================

ipcMain.handle('loadSkills', async (event, skillsPath) => {
  try {
    if (!skillsPath || !fs.existsSync(skillsPath)) {
      return []
    }
    
    const skills = []
    const items = fs.readdirSync(skillsPath)
    
    for (const item of items) {
      const skillPath = path.join(skillsPath, item)
      const stats = fs.statSync(skillPath)
      
      if (stats.isDirectory()) {
        const skillMdPath = path.join(skillPath, 'SKILL.md')
        
        if (fs.existsSync(skillMdPath)) {
          try {
            const content = fs.readFileSync(skillMdPath, 'utf8')
            const metadata = parseSkillMetadata(content)
            
            if (metadata && metadata.name) {
              const files = fs.readdirSync(skillPath)
                .filter(file => file !== 'SKILL.md')
                .map(file => ({
                  name: file,
                  path: path.join(skillPath, file),
                  size: fs.statSync(path.join(skillPath, file)).size
                }))
              
              skills.push({
                name: metadata.name,
                description: metadata.description || '',
                path: skillPath,
                metadata: metadata,
                preview: {
                  content: content,
                  files: files
                }
              })
            }
          } catch (error) {
            console.error(`解析技能 ${item} 失败:`, error)
          }
        } else {
          console.warn(`技能文件夹 ${item} 中没有 SKILL.md 文件`)
        }
      }
    }
    
    console.log(`加载了 ${skills.length} 个技能`)
    return skills
  } catch (error) {
    console.error('加载技能失败:', error)
    throw error
  }
})

function parseSkillMetadata(content: string): { [key: string]: any } | null {
  const matches = content.match(/^---\r?\n([\s\S]+?)\r?\n---/)
  if (matches && matches.length > 1) {
    try {
      return yaml.load(matches[1]) as { [key: string]: any }
    } catch (error) {
      console.error('解析YAML失败:', error)
      return null
    }
  }
  return null
}

ipcMain.handle('previewSkill', async (event, skillPath) => {
  try {
    const skillMdPath = path.join(skillPath, 'SKILL.md')
    if (!fs.existsSync(skillMdPath)) {
      throw new Error('SKILL.md 不存在')
    }
    
    const content = fs.readFileSync(skillMdPath, 'utf8')
    const metadata = parseSkillMetadata(content)
    
    const files = fs.readdirSync(skillPath).filter(f => {
      const filePath = path.join(skillPath, f)
      return fs.statSync(filePath).isFile()
    })
    
    return {
      metadata: metadata || {},
      content: content,
      files: files
    }
  } catch (error) {
    console.error('预览技能失败:', error)
    throw error
  }
})

ipcMain.handle('getSkillFile', async (event, skillPath, filename) => {
  try {
    const filePath = path.join(skillPath, filename)
    const realSkillPath = fs.realpathSync(skillPath)
    const realFilePath = fs.realpathSync(filePath)
    
    if (!realFilePath.startsWith(realSkillPath)) {
      throw new Error('不允许访问技能文件夹外的文件')
    }
    
    if (!fs.existsSync(filePath)) {
      throw new Error('文件不存在')
    }
    
    const stats = fs.statSync(filePath)
    if (stats.isDirectory()) {
      throw new Error('不能读取文件夹')
    }
    
    const ext = path.extname(filePath).toLowerCase()
    if (ext === '.py' || ext === '.js' || ext === '.json' || ext === '.txt' || ext === '.md') {
      const content = fs.readFileSync(filePath, 'utf8')
      return { type: 'text', content }
    } else {
      return { type: 'binary', path: filePath }
    }
  } catch (error) {
    console.error('读取技能文件失败:', error)
    throw error
  }
})

ipcMain.handle('executeSkillScript', async (event, skillPath, scriptName, args = []) => {
  try {
    const scriptPath = path.join(skillPath, 'scripts', scriptName)
    const realSkillPath = fs.realpathSync(skillPath)
    const realScriptPath = fs.realpathSync(scriptPath)
    
    if (!realScriptPath.startsWith(realSkillPath)) {
      throw new Error('不允许执行技能文件夹外的脚本')
    }
    
    if (!fs.existsSync(scriptPath)) {
      throw new Error('脚本不存在')
    }
    
    const stats = fs.statSync(scriptPath)
    if (stats.isDirectory()) {
      throw new Error('不能执行文件夹')
    }
    
    const ext = path.extname(scriptPath).toLowerCase()
    
    if (ext === '.py') {
      const code = fs.readFileSync(scriptPath, 'utf8')
      const result = await pythonService.executeCode(code)
      return result
    } else if (ext === '.js') {
      const code = fs.readFileSync(scriptPath, 'utf8')
      try {
        const func = new Function('args', code)
        const result = func(args)
        return { success: true, result }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    } else if (ext === '.sh' || ext === '.bat') {
      const { exec } = require('child_process')
      return new Promise((resolve) => {
        exec(`"${scriptPath}" ${args.join(' ')}`, (error: any, stdout: any, stderr: any) => {
          if (error) {
            resolve({ success: false, error: error.message, stderr })
          } else {
            resolve({ success: true, output: stdout })
          }
        })
      })
    } else {
      throw new Error(`不支持的脚本类型: ${ext}`)
    }
  } catch (error: any) {
    console.error('执行技能脚本失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('writeFile', async (event, filePath, content) => {
  console.log(`[主进程] 收到写入文件请求: ${filePath}`)
  
  try {
    if (!filePath) {
      throw new Error('文件路径不能为空')
    }
    
    const directory = path.dirname(filePath)
    if (!fs.existsSync(directory)) {
      console.log(`[主进程] 目录不存在，创建目录: ${directory}`)
      fs.mkdirSync(directory, { recursive: true })
    }
    
    fs.writeFileSync(filePath, content, 'utf8')
    
    console.log(`[主进程] 文件写入成功: ${filePath}`)
    return {
      success: true,
      path: filePath
    }
  } catch (error: any) {
    console.error(`[主进程] 写入文件失败: ${filePath}`, error)
    return {
      success: false,
      error: error.message
    }
  }
})

ipcMain.handle('ensureDir', async (event, dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
      console.log(`[主进程] 目录创建成功: ${dirPath}`)
    }
    return { success: true }
  } catch (error: any) {
    console.error(`[主进程] 创建目录失败: ${dirPath}`, error)
    return { success: false, error: error.message }
  }
})

// ==================== 截图功能模块 ====================

ipcMain.handle('takeScreenshot', async (event, options = {}) => {
  try {
    const { sourceTypes = ['screen'], thumbnailSize = { width: 1920, height: 1080 }, format = 'png', quality = 90 } = options
    
    const sources = await desktopCapturer.getSources({
      types: sourceTypes,
      thumbnailSize,
      fetchWindowIcons: false
    })
    
    if (sources.length === 0) {
      throw new Error('没有找到可用的截图源')
    }
    
    let selectedSource = sources[0]
    for (const source of sources) {
      if (source.name.toLowerCase().includes('entire screen') ||
        source.name.toLowerCase().includes('screen 1') ||
        source.name.toLowerCase().includes('display')) {
        selectedSource = source
        break
      }
    }
    
    let base64Data
    if (format === 'png') {
      base64Data = selectedSource.thumbnail.toPNG().toString('base64')
      return `data:image/png;base64,${base64Data}`
    } else if (format === 'jpeg' || format === 'jpg') {
      base64Data = selectedSource.thumbnail.toJPEG(quality).toString('base64')
      return `data:image/jpeg;base64,${base64Data}`
    } else {
      throw new Error(`不支持的图片格式: ${format}`)
    }
  } catch (error: any) {
    console.error('截图失败:', error)
    return {
      success: false,
      error: error.message,
      code: error.code,
      stack: error.stack
    }
  }
})

ipcMain.handle('captureRegion', async () => {
  let selectionWindow: BrowserWindow | null = null
  
  try {
    console.log('开始区域截图...')
    
    if (win) {
      win.minimize()
    }
    
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize
    
    selectionWindow = new BrowserWindow({
      width: screenWidth,
      height: screenHeight,
      x: 0,
      y: 0,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      fullscreenable: false,
      resizable: false,
      movable: false,
      focusable: true,
      hasShadow: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
      show: false
    })
    
    const regionSelectHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { background: transparent; overflow: hidden; cursor: crosshair; width: 100vw; height: 100vh; position: relative; }
            #overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.3); z-index: 1; }
            #selection-area { position: absolute; border: 2px solid #3498db; background: rgba(52, 152, 219, 0.2); z-index: 2; pointer-events: none; display: none; }
            #size-display { position: absolute; bottom: -30px; right: 0; background: rgba(0, 0, 0, 0.8); color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
            #info-panel { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: rgba(0, 0, 0, 0.8); color: white; padding: 10px 20px; border-radius: 8px; display: flex; gap: 15px; z-index: 1000; }
            .key { background: rgba(255, 255, 255, 0.2); padding: 2px 8px; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div id="overlay"></div>
          <div id="selection-area"><div id="size-display">0×0</div></div>
          <div id="info-panel"><span>拖拽选择区域</span><span class="key">ESC</span><span>取消</span><span class="key">ENTER</span><span>确认</span></div>
          <script>
            const { ipcRenderer } = require('electron')
            let start = { x: 0, y: 0 }, end = { x: 0, y: 0 }, selecting = false, rect = { x: 0, y: 0, width: 0, height: 0 }
            const area = document.getElementById('selection-area'), sizeDisplay = document.getElementById('size-display')
            document.addEventListener('mousedown', (e) => { if (e.button === 0) { start = { x: e.clientX, y: e.clientY }; end = { x: e.clientX, y: e.clientY }; selecting = true; area.style.display = 'block'; update() } })
            document.addEventListener('mousemove', (e) => { if (selecting) { end = { x: e.clientX, y: e.clientY }; update() } })
            document.addEventListener('mouseup', (e) => { if (e.button === 0 && selecting) { selecting = false; update(); if (rect.width < 10 && rect.height < 10) area.style.display = 'none' } })
            document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cancel(); if (e.key === 'Enter' && rect.width > 10 && rect.height > 10) capture() })
            document.addEventListener('contextmenu', (e) => { e.preventDefault(); cancel() })
            document.addEventListener('dblclick', () => { if (rect.width > 10 && rect.height > 10) capture() })
            function update() { rect = { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) }; area.style.left = rect.x + 'px'; area.style.top = rect.y + 'px'; area.style.width = rect.width + 'px'; area.style.height = rect.height + 'px'; sizeDisplay.textContent = rect.width + '×' + rect.height }
            function capture() { if (rect.width > 10 && rect.height > 10) ipcRenderer.send('region-selected', { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }) }
            function cancel() { ipcRenderer.send('region-cancelled') }
          </script>
        </body>
      </html>
    `
    
    await selectionWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(regionSelectHTML)}`)
    
    selectionWindow.once('ready-to-show', () => {
      selectionWindow!.show()
      selectionWindow!.focus()
    })
    
    selectionWindow.on('close', () => { if (win) win.restore() })
    
    return new Promise((resolve, reject) => {
      ipcMain.once('region-selected', async (event, rect) => {
        if (selectionWindow && !selectionWindow!.isDestroyed()) selectionWindow!.close()
        if (win) win.restore()
        try {
          const screenshot = await captureScreenArea(rect)
          resolve(screenshot)
        } catch (error) { reject(error) }
      })
      
      ipcMain.once('region-cancelled', () => {
        if (selectionWindow && !selectionWindow!.isDestroyed()) selectionWindow!.close()
        if (win) win.restore()
        resolve(null)
      })
      
      setTimeout(() => {
        if (selectionWindow && !selectionWindow!.isDestroyed()) selectionWindow!.close()
        if (win) win.restore()
        reject(new Error('截图超时'))
      }, 60000)
    })
  } catch (error: any) {
    console.error('区域截图失败:', error)
    if (selectionWindow && !selectionWindow.isDestroyed()) selectionWindow.close()
    if (win) win.restore()
    return { success: false, error: error.message }
  }
})

async function captureScreenArea(rect: any): Promise<string> {
  try {
    const displays = screen.getAllDisplays()
    let targetDisplay = displays[0]
    for (const display of displays) {
      if (rect.x >= display.bounds.x && rect.y >= display.bounds.y &&
        rect.x + rect.width <= display.bounds.x + display.bounds.width &&
        rect.y + rect.height <= display.bounds.y + display.bounds.height) {
        targetDisplay = display
        break
      }
    }
    
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: targetDisplay.bounds.width, height: targetDisplay.bounds.height },
      fetchWindowIcons: false
    })
    
    let screenSource = sources[0]
    for (const source of sources) {
      if (source.display_id && source.display_id.toString() === targetDisplay.id.toString()) {
        screenSource = source
        break
      }
    }
    
    const relativeX = rect.x - targetDisplay.bounds.x
    const relativeY = rect.y - targetDisplay.bounds.y
    const maxX = Math.max(0, Math.min(relativeX, screenSource.thumbnail.getSize().width - 1))
    const maxY = Math.max(0, Math.min(relativeY, screenSource.thumbnail.getSize().height - 1))
    const maxWidth = screenSource.thumbnail.getSize().width - maxX
    const maxHeight = screenSource.thumbnail.getSize().height - maxY
    const cropWidth = Math.min(rect.width, maxWidth)
    const cropHeight = Math.min(rect.height, maxHeight)
    
    const croppedImage = screenSource.thumbnail.crop({ x: maxX, y: maxY, width: cropWidth, height: cropHeight })
    const base64Data = croppedImage.toPNG().toString('base64')
    return `data:image/png;base64,${base64Data}`
  } catch (error) {
    console.error('截取屏幕区域失败:', error)
    throw error
  }
}

// ==================== llama.cpp IPC 处理器 ====================

ipcMain.handle('scanLlamaModels', async (event, { modelsDir }) => {
  try {
    return await sendToLlamaService('scan', { modelsDir })
  } catch (error: any) {
    console.error('[llama] 扫描模型失败:', error)
    return { success: false, error: error.message, models: [] }
  }
})

ipcMain.handle('llamaInference', async (event, params) => {
  try {
    return await sendToLlamaService('inference', params)
  } catch (error: any) {
    console.error('[llama] 推理失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('llamaStreamInference', async (event, params) => {
  
  try {
    const requestId = randomUUID()
    let lastChunk = '' // 记录上一个发送的块
    let chunkCount = 0 // 记录发送的块数量
    
    const result = await sendToLlamaService('streamInference', params, {
      onStream: (chunk: string) => {
        // ✅ 去重：跳过重复的块
        if (chunk === lastChunk) {
          return
        }
        
        // ✅ 可选：检查是否是累积重复（如 "你" -> "你好" -> "你好你"）
        let actualChunk = chunk
        if (lastChunk && chunk.startsWith(lastChunk)) {
          actualChunk = chunk.substring(lastChunk.length)
          if (!actualChunk) return // 如果没有新内容，跳过
        }
        
        lastChunk = chunk
        chunkCount++
        
        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send('llamaStreamChunk', { 
            requestId, 
            chunk: actualChunk,  // 发送去重后的内容
            done: false 
          })
        }
      },
      onComplete: (fullContent: string) => {
        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send('llamaStreamChunk', { 
            requestId, 
            chunk: '', 
            done: true, 
            fullContent 
          })
        }
      },
      onError: (error: Error) => {
        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send('llamaStreamError', { 
            requestId, 
            error: error.message 
          })
        }
      }
    })
    return result
  } catch (error: any) {
    throw error
  }
})

ipcMain.handle('llamaStreamAbort', async (event, { requestId }) => {
  try {
    return await sendToLlamaService('abort', { requestId })
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('getLlamaModelStatus', async (event, { modelPath }) => {
  try {
    return await sendToLlamaService('status', { modelPath })
  } catch (error: any) {
    return { loaded: false, error: error.message }
  }
})

ipcMain.handle('unloadLlamaModel', async (event, { modelPath }) => {
  try {
    return await sendToLlamaService('unload', { modelPath })
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})
