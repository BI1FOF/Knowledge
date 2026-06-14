<template>
  <div class="help-container">
    <!-- 左侧浮动导航 - 在容器内部 -->
    <div 
      class="help-nav"
      :class="{ expanded: navExpanded }"
      @mouseenter="navExpanded = true"
      @mouseleave="navExpanded = false"
    >
      <div class="nav-header">
        <div class="nav-icon">
          <i class="fa fa-question-circle"></i>
        </div>
        <div class="nav-title" v-show="navExpanded">{{ t('nav.title') }}</div>
      </div>
      
      <div class="nav-content">
        <div 
          v-for="section in sections" 
          :key="section.id"
          class="nav-item"
          :class="{ active: activeSection === section.id }"
          @click="scrollToSection(section.id)"
        >
          <div class="nav-item-icon">{{ section.icon }}</div>
          <div class="nav-item-content" v-show="navExpanded">
            <div class="nav-item-title">{{ t(`sections.${section.id}.title`) }}</div>
            <div class="nav-item-subtitle">{{ t(`sections.${section.id}.subtitle`) }}</div>
          </div>
        </div>
      </div>
      
      <div class="nav-footer" v-show="navExpanded">
        <a href="https://github.com/whl1207/Knowledge" target="_blank" class="nav-link">
          <i class="fa fa-github"></i>
          GitHub
        </a>
      </div>
    </div>

    <!-- 主要内容区 -->
    <div class="help-main">
      <!-- 紧凑的头部 -->
      <div class="main-header">
        <h1>{{ t('header.title') }}</h1>
        <p class="header-subtitle">{{ t('header.subtitle') }}</p>
      </div>

      <div class="main-content">
        <!-- 快速上手指南 -->
        <section id="quick-start" class="help-section">
          <div class="section-header">
            <div class="section-icon">🚀</div>
            <div class="section-title-content">
              <h2>{{ t('sections.quick-start.title') }}</h2>
              <p class="section-desc">{{ t('sections.quick-start.subtitle') }}</p>
            </div>
          </div>

          <div class="quick-steps">
            <div class="quick-step-row">
              <div class="quick-step">
                <div class="step-icon">1️⃣</div>
                <div class="step-content">
                  <h4>{{ t('quickStart.step1.title') }}</h4>
                  <ul>
                    <li v-for="(item, index) in t('quickStart.step1.items')" :key="index">{{ item }}</li>
                  </ul>
                </div>
              </div>
              
              <div class="quick-step">
                <div class="step-icon">2️⃣</div>
                <div class="step-content">
                  <h4>{{ t('quickStart.step2.title') }}</h4>
                  <ul>
                    <li v-for="(item, index) in t('quickStart.step2.items')" :key="index">{{ item }}</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div class="quick-step-row">
              <div class="quick-step">
                <div class="step-icon">3️⃣</div>
                <div class="step-content">
                  <h4>{{ t('quickStart.step3.title') }}</h4>
                  <ul>
                    <li v-for="(item, index) in t('quickStart.step3.items')" :key="index">{{ item }}</li>
                  </ul>
                </div>
              </div>
              
              <div class="quick-step">
                <div class="step-icon">4️⃣</div>
                <div class="step-content">
                  <h4>{{ t('quickStart.step4.title') }}</h4>
                  <ul>
                    <li v-for="(item, index) in t('quickStart.step4.items')" :key="index">{{ item }}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 智能对话系统 -->
        <section id="ai-chat" class="help-section">
          <div class="section-header">
            <div class="section-icon">🤖</div>
            <div class="section-title-content">
              <h2>{{ t('sections.ai-chat.title') }}</h2>
              <p class="section-desc">{{ t('sections.ai-chat.subtitle') }}</p>
            </div>
          </div>

          <div class="section-content">
            <div class="content-card">
              <h3>{{ t('aiChat.concept.title') }}</h3>
              <p v-html="t('aiChat.concept.description')"></p>
              
              <div class="example-box">
                <div class="example-title">{{ t('aiChat.concept.example.title') }}</div>
                <p>{{ t('aiChat.concept.example.question') }}</p>
                <p>{{ t('aiChat.concept.example.answer') }}</p>
              </div>
            </div>

            <div class="content-card">
              <h3>{{ t('aiChat.guide.title') }}</h3>
              
              <div class="step-card">
                <div class="step-number">1</div>
                <div class="step-details">
                  <h4>{{ t('aiChat.guide.step1.title') }}</h4>
                  <ul>
                    <li v-for="(item, index) in t('aiChat.guide.step1.items')" :key="index" v-html="item"></li>
                  </ul>
                </div>
              </div>

              <div class="step-card">
                <div class="step-number">2</div>
                <div class="step-details">
                  <h4>{{ t('aiChat.guide.step2.title') }}</h4>
                  <ul>
                    <li v-for="(item, index) in t('aiChat.guide.step2.items')" :key="index">{{ item }}</li>
                  </ul>
                </div>
              </div>

              <div class="step-card">
                <div class="step-number">3</div>
                <div class="step-details">
                  <h4>{{ t('aiChat.guide.step3.title') }}</h4>
                  <ul>
                    <li v-for="(item, index) in t('aiChat.guide.step3.items')" :key="index">{{ item }}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 知识管理 -->
        <section id="knowledge" class="help-section">
          <div class="section-header">
            <div class="section-icon">📚</div>
            <div class="section-title-content">
              <h2>{{ t('sections.knowledge.title') }}</h2>
              <p class="section-desc">{{ t('sections.knowledge.subtitle') }}</p>
            </div>
          </div>

          <div class="section-content">
            <div class="content-card">
              <h3>{{ t('knowledge.process.title') }}</h3>
              <div class="flow-diagram">
                <div class="flow-step">
                  <div class="flow-icon">📥</div>
                  <div class="flow-text">{{ t('knowledge.process.step1') }}</div>
                </div>
                <div class="flow-arrow">→</div>
                <div class="flow-step">
                  <div class="flow-icon">✂️</div>
                  <div class="flow-text">{{ t('knowledge.process.step2') }}</div>
                </div>
                <div class="flow-arrow">→</div>
                <div class="flow-step">
                  <div class="flow-icon">🔢</div>
                  <div class="flow-text">{{ t('knowledge.process.step3') }}</div>
                </div>
                <div class="flow-arrow">→</div>
                <div class="flow-step">
                  <div class="flow-icon">🔍</div>
                  <div class="flow-text">{{ t('knowledge.process.step4') }}</div>
                </div>
              </div>
            </div>

            <div class="content-card">
              <h3>{{ t('knowledge.steps.title') }}</h3>
              
              <div class="guide-step">
                <span class="guide-number">1</span>
                <div class="guide-content">
                  <strong>{{ t('knowledge.steps.step1.title') }}</strong>
                  <p>{{ t('knowledge.steps.step1.description') }}</p>
                  <div class="tool-tip" v-html="t('knowledge.steps.step1.tip')"></div>
                </div>
              </div>

              <div class="guide-step">
                <span class="guide-number">2</span>
                <div class="guide-content">
                  <strong>{{ t('knowledge.steps.step2.title') }}</strong>
                  <ul>
                    <li v-for="(item, index) in t('knowledge.steps.step2.items')" :key="index">{{ item }}</li>
                  </ul>
                </div>
              </div>

              <div class="guide-step">
                <span class="guide-number">3</span>
                <div class="guide-content">
                  <strong>{{ t('knowledge.steps.step3.title') }}</strong>
                  <div class="use-cases">
                    <span v-for="(useCase, index) in t('knowledge.steps.step3.useCases')" 
                          :key="index" 
                          class="use-case">{{ useCase }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 工作流编辑器 -->
        <section id="workflow" class="help-section">
          <div class="section-header">
            <div class="section-icon">🔗</div>
            <div class="section-title-content">
              <h2>{{ t('sections.workflow.title') }}</h2>
              <p class="section-desc">{{ t('sections.workflow.subtitle') }}</p>
            </div>
          </div>

          <div class="section-content">
            <div class="content-card">
              <h3>{{ t('workflow.nodes.title') }}</h3>
              
              <div class="nodes-grid">
                <div class="node-item" v-for="node in nodes" :key="node.id">
                  <div class="node-icon">{{ node.icon }}</div>
                  <div class="node-info">
                    <div class="node-name">{{ t(`workflow.nodes.${node.key}.name`) }}</div>
                    <div class="node-desc">{{ t(`workflow.nodes.${node.key}.desc`) }}</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="content-card">
              <h3>{{ t('workflow.example.title') }}</h3>
              
              <div class="workflow-example">
                <div class="example-step">
                  <div class="example-number">1</div>
                  <div class="example-content">
                    <strong>{{ t('workflow.example.step1.title') }}</strong>
                    <div class="node-tags">
                      <span v-for="(tag, index) in t('workflow.example.step1.tags')" 
                            :key="index" 
                            class="node-tag">{{ tag }}</span>
                    </div>
                  </div>
                </div>

                <div class="example-step">
                  <div class="example-number">2</div>
                  <div class="example-content">
                    <strong>{{ t('workflow.example.step2.title') }}</strong>
                    <p>{{ t('workflow.example.step2.description') }}</p>
                    <div class="flow-simple">{{ t('workflow.example.step2.flow') }}</div>
                  </div>
                </div>

                <div class="example-step">
                  <div class="example-number">3</div>
                  <div class="example-content">
                    <strong>{{ t('workflow.example.step3.title') }}</strong>
                    <ul>
                      <li v-for="(item, index) in t('workflow.example.step3.items')" :key="index">{{ item }}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 常见问题 -->
        <section id="faq" class="help-section">
          <div class="section-header">
            <div class="section-icon">❓</div>
            <div class="section-title-content">
              <h2>{{ t('sections.faq.title') }}</h2>
              <p class="section-desc">{{ t('sections.faq.subtitle') }}</p>
            </div>
          </div>

          <div class="section-content">
            <div class="faq-list">
              <div 
                class="faq-item" 
                v-for="(faq, index) in faqs" 
                :key="index"
                @click="toggleFaq(index)"
              >
                <div class="faq-question">
                  <span class="faq-number">Q{{ index + 1 }}</span>
                  <span class="faq-text">{{ t(`faq.${index}.question`) }}</span>
                  <i :class="['fa', faqOpen[index] ? 'fa-chevron-up' : 'fa-chevron-down']"></i>
                </div>
                <div class="faq-answer" v-if="faqOpen[index]">
                  <p>{{ t(`faq.${index}.answer`) }}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 页脚 -->
        <div class="main-footer">
          <div class="footer-content">
            <div class="footer-tip">
              <strong>{{ t('footer.tip.label') }}</strong> {{ t('footer.tip.text') }}
            </div>
            <div class="footer-links">
              <a href="https://github.com/whl1207/Knowledge/issues" target="_blank">
                <i class="fa fa-bug"></i> {{ t('footer.links.feedback') }}
              </a>
              <a href="https://github.com/whl1207/Knowledge" target="_blank">
                <i class="fa fa-github"></i> {{ t('footer.links.source') }}
              </a>
              <a href="https://mineru.com.cn/" target="_blank">
                <i class="fa fa-file"></i> {{ t('footer.links.mineru') }}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { usestore } from '../../store'

const store = usestore()

// 根据store的语言设置返回当前语言
const currentLocale = computed(() => store.locales || 'zh')

// 国际化函数
const t = (key: string) => {
  const keys = key.split('.')
  // 使用类型断言绕过索引签名限制
  let value: any = (translations as Record<string, any>)[currentLocale.value]
  
  for (const k of keys) {
    if (value && value[k] !== undefined) {
      value = value[k]
    } else {
      // 如果找不到对应语言的翻译，回退到中文
      let fallback: any = translations.zh
      for (const fk of keys) {
        if (fallback && fallback[fk] !== undefined) {
          fallback = fallback[fk]
        } else {
          return key
        }
      }
      return fallback
    }
  }
  return value
}

// 导航展开状态
const navExpanded = ref(false)
const activeSection = ref('quick-start')
const faqOpen = ref<Record<number, boolean>>({})

// 章节定义（图标和ID保持不变，标题通过国际化获取）
const sections = ref([
  { id: 'quick-start', icon: '🚀' },
  { id: 'ai-chat', icon: '🤖' },
  { id: 'knowledge', icon: '📚' },
  { id: 'workflow', icon: '🔗' },
  { id: 'faq', icon: '❓' }
])

// 节点列表（带key用于国际化）
const nodes = ref([
  { id: 1, icon: '📝', key: 'text' },
  { id: 2, icon: '📁', key: 'file' },
  { id: 3, icon: '🌐', key: 'webSearch' },
  { id: 4, icon: '🕸️', key: 'webCrawl' },
  { id: 5, icon: '🤖', key: 'inference' },
  { id: 6, icon: '🐍', key: 'python' },
  { id: 7, icon: '📚', key: 'knowledge' },
  { id: 8, icon: '📊', key: 'structured' }
])

// FAQ列表（数量固定，内容通过国际化获取）
const faqs = ref([0, 1, 2, 3]) // 4个FAQ

// 切换FAQ
const toggleFaq = (index: number) => {
  faqOpen.value[index] = !faqOpen.value[index]
}

// 滚动到指定章节
const scrollToSection = (sectionId: string) => {
  const element = document.getElementById(sectionId)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    activeSection.value = sectionId
  }
}

// 监听滚动事件
const handleScroll = () => {
  const scrollPosition = window.scrollY + 100
  
  for (const section of sections.value) {
    const element = document.getElementById(section.id)
    if (element) {
      const offsetTop = element.offsetTop
      const offsetBottom = offsetTop + element.offsetHeight
      
      if (scrollPosition >= offsetTop && scrollPosition < offsetBottom) {
        activeSection.value = section.id
        break
      }
    }
  }
}

// 初始化
onMounted(() => {
  window.addEventListener('scroll', handleScroll)
  // 默认展开第一个FAQ
  if (faqs.value.length > 0) {
    faqOpen.value[0] = true
  }
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})

// 中英文翻译数据
const translations = {
  zh: {
    nav: {
      title: 'AI-KM 帮助'
    },
    header: {
      title: 'AI-KM 智能生产力平台',
      subtitle: '新手友好指南 - 四大核心功能'
    },
    sections: {
      'quick-start': {
        title: '快速开始',
        subtitle: '5分钟体验'
      },
      'ai-chat': {
        title: '智能对话',
        subtitle: 'RAG助手'
      },
      'knowledge': {
        title: '知识管理',
        subtitle: '数字大脑'
      },
      'workflow': {
        title: '工作流',
        subtitle: '自动化'
      },
      'faq': {
        title: '常见问题',
        subtitle: '新手必读'
      }
    },
    quickStart: {
      step1: {
        title: '体验智能对话',
        items: ['点击左侧AI图标', '问个问题如"你好"', '感受AI的回答']
      },
      step2: {
        title: '记录灵感',
        items: ['点击顶部"+"号', '输入想法', '点击保存']
      },
      step3: {
        title: '创建任务',
        items: ['进入任务管理', '点击"新建任务"', '设置时间开始']
      },
      step4: {
        title: '知识库体验',
        items: ['导入一个文档', '点击"处理"按钮', '问AI相关问题']
      }
    },
    aiChat: {
      concept: {
        title: '核心概念：RAG技术',
        description: 'AI不仅能回答问题，还能<strong>参考你的个人文档库</strong>来回答问题。',
        example: {
          title: '📌 使用场景：',
          question: '询问："我的项目报告里提到的时间节点是什么？"',
          answer: 'AI会自动从你上传的项目文档中查找相关信息，然后回答。'
        }
      },
      guide: {
        title: '三步使用指南',
        step1: {
          title: '安装Ollama（推荐）',
          items: [
            '访问 <a href="https://ollama.com/" target="_blank">ollama.com</a>',
            '运行 <code>ollama serve</code>',
            '运行 <code>ollama pull qwen3</code>'
          ]
        },
        step2: {
          title: '创建聊天对话',
          items: ['点击"新建聊天"', '选择模型（如qwen3）', '开始对话，像微信一样简单']
        },
        step3: {
          title: '关联知识库',
          items: ['点击书本图标 📚', '选择.kb格式知识库', 'AI回答时会自动从知识库找资料']
        }
      }
    },
    knowledge: {
      process: {
        title: '知识处理流程',
        step1: '导入文档',
        step2: '知识切片',
        step3: '向量化',
        step4: '智能检索'
      },
      steps: {
        title: '操作步骤',
        step1: {
          title: '导入文档',
          description: '支持：Markdown、PDF、Word、TXT',
          tip: '💡 建议先用 <a href="https://mineru.com.cn/" target="_blank">MinerU</a> 转换格式'
        },
        step2: {
          title: '创建知识库',
          items: ['点击"知识管理"菜单', '选择文件夹', '点击"处理"按钮']
        },
        step3: {
          title: '使用知识库',
          useCases: ['💬 智能对话', '🔗 工作流', '🔍 独立检索']
        }
      }
    },
    workflow: {
      nodes: {
        title: '八大节点类型',
        text: { name: '文本节点', desc: '输入固定文本' },
        file: { name: '本地文件', desc: '读取电脑文件' },
        webSearch: { name: '网络搜索', desc: '上网查资料' },
        webCrawl: { name: '网页抓取', desc: '获取网页内容' },
        inference: { name: '推理节点', desc: '调用AI思考' },
        python: { name: 'Python节点', desc: '运行代码' },
        knowledge: { name: '知识库节点', desc: '从知识库找资料' },
        structured: { name: '结构化节点', desc: '表格数据处理' }
      },
      example: {
        title: '示例：分析新闻文章',
        step1: {
          title: '拖拽三个节点：',
          tags: ['🕸️ 网页抓取', '📚 知识库节点', '🤖 推理节点']
        },
        step2: {
          title: '连接节点：',
          description: '点击节点底部的连接点 → 拖到下一个节点顶部',
          flow: '网页内容 → 知识库检索 → AI分析'
        },
        step3: {
          title: '配置并运行：',
          items: [
            '网页抓取：输入网址',
            '知识库：选择你的知识库',
            '推理节点：输入分析指令',
            '点击"运行所有节点"'
          ]
        }
      }
    },
    faq: [
      {
        question: '完全没接触过AI，能学会吗？',
        answer: '完全可以！软件设计时考虑了新手，智能对话像普通聊天，知识管理像整理文件夹，有详细教程。'
      },
      {
        question: '需要付费吗？',
        answer: '软件免费开源。AI部分：Ollama模型免费（需电脑运行），其他商业API可能需付费。'
      },
      {
        question: '数据安全吗？',
        answer: '所有数据保存在你的本地电脑，知识库在自选文件夹，聊天记录和工作流都在本地。'
      },
      {
        question: '应该先学习哪个功能？',
        answer: '建议顺序：1.智能对话（最简单）2.任务管理 3.知识管理 4.工作流编辑（进阶）。'
      }
    ],
    footer: {
      tip: {
        label: '💡 使用建议：',
        text: '从最简单功能开始，逐步组合使用。有问题随时查阅帮助！'
      },
      links: {
        feedback: '反馈问题',
        source: '查看源码',
        mineru: 'MinerU转换器'
      }
    }
  },
  en: {
    nav: {
      title: 'AI-KM Help'
    },
    header: {
      title: 'AI-KM Intelligent Productivity Platform',
      subtitle: 'Beginner Friendly Guide - 4 Core Features'
    },
    sections: {
      'quick-start': {
        title: 'Quick Start',
        subtitle: '5 min experience'
      },
      'ai-chat': {
        title: 'AI Chat',
        subtitle: 'RAG Assistant'
      },
      'knowledge': {
        title: 'Knowledge',
        subtitle: 'Digital Brain'
      },
      'workflow': {
        title: 'Workflow',
        subtitle: 'Automation'
      },
      'faq': {
        title: 'FAQ',
        subtitle: 'Must read'
      }
    },
    quickStart: {
      step1: {
        title: 'Try AI Chat',
        items: ['Click AI icon on left', 'Ask "Hello"', 'Experience AI response']
      },
      step2: {
        title: 'Save Ideas',
        items: ['Click "+" on top', 'Enter your idea', 'Click save']
      },
      step3: {
        title: 'Create Task',
        items: ['Go to Task Management', 'Click "New Task"', 'Set time and start']
      },
      step4: {
        title: 'Try Knowledge Base',
        items: ['Import a document', 'Click "Process"', 'Ask AI related questions']
      }
    },
    aiChat: {
      concept: {
        title: 'Core Concept: RAG Technology',
        description: 'AI can answer questions by <strong>referencing your personal document library</strong>.',
        example: {
          title: '📌 Use Case:',
          question: 'Ask: "What are the deadlines mentioned in my project report?"',
          answer: 'AI will automatically search your uploaded project documents and answer.'
        }
      },
      guide: {
        title: '3-Step Guide',
        step1: {
          title: 'Install Ollama (Recommended)',
          items: [
            'Visit <a href="https://ollama.com/" target="_blank">ollama.com</a>',
            'Run <code>ollama serve</code>',
            'Run <code>ollama pull qwen3</code>'
          ]
        },
        step2: {
          title: 'Start a Chat',
          items: ['Click "New Chat"', 'Select model (e.g., qwen3)', 'Start chatting']
        },
        step3: {
          title: 'Connect Knowledge Base',
          items: ['Click book icon 📚', 'Select .kb knowledge base', 'AI will automatically reference it']
        }
      }
    },
    knowledge: {
      process: {
        title: 'Knowledge Processing Flow',
        step1: 'Import',
        step2: 'Chunking',
        step3: 'Vectorize',
        step4: 'Retrieval'
      },
      steps: {
        title: 'Steps',
        step1: {
          title: 'Import Documents',
          description: 'Support: Markdown, PDF, Word, TXT',
          tip: '💡 Use <a href="https://mineru.com.cn/" target="_blank">MinerU</a> for format conversion'
        },
        step2: {
          title: 'Create Knowledge Base',
          items: ['Click "Knowledge" menu', 'Select folder', 'Click "Process"']
        },
        step3: {
          title: 'Use Knowledge Base',
          useCases: ['💬 AI Chat', '🔗 Workflow', '🔍 Standalone Search']
        }
      }
    },
    workflow: {
      nodes: {
        title: '8 Node Types',
        text: { name: 'Text', desc: 'Static text input' },
        file: { name: 'File', desc: 'Read local files' },
        webSearch: { name: 'Web Search', desc: 'Search online' },
        webCrawl: { name: 'Web Crawl', desc: 'Fetch web content' },
        inference: { name: 'Inference', desc: 'AI reasoning' },
        python: { name: 'Python', desc: 'Run Python code' },
        knowledge: { name: 'Knowledge', desc: 'Query knowledge base' },
        structured: { name: 'Structured', desc: 'Process tabular data' }
      },
      example: {
        title: 'Example: Analyze News Article',
        step1: {
          title: 'Drag 3 nodes:',
          tags: ['🕸️ Web Crawl', '📚 Knowledge', '🤖 Inference']
        },
        step2: {
          title: 'Connect nodes:',
          description: 'Click bottom connector → Drag to next node top',
          flow: 'Web Content → Knowledge Search → AI Analysis'
        },
        step3: {
          title: 'Configure and run:',
          items: [
            'Web Crawl: Enter URL',
            'Knowledge: Select your knowledge base',
            'Inference: Enter analysis prompt',
            'Click "Run All Nodes"'
          ]
        }
      }
    },
    faq: [
      {
        question: 'Can I learn it with no AI experience?',
        answer: 'Absolutely! The software is designed for beginners. AI chat works like regular chat, knowledge management is like organizing folders, with detailed tutorials.'
      },
      {
        question: 'Is it free?',
        answer: 'The software is free and open-source. For AI: Ollama models are free (run locally), other commercial APIs may require payment.'
      },
      {
        question: 'Is my data secure?',
        answer: 'All data is stored locally on your computer. Knowledge bases are in your chosen folders, chat history and workflows are all local.'
      },
      {
        question: 'Which feature should I learn first?',
        answer: 'Suggested order: 1. AI Chat (simplest) 2. Task Management 3. Knowledge Management 4. Workflow Editor (advanced).'
      }
    ],
    footer: {
      tip: {
        label: '💡 Tip:',
        text: 'Start with simple features, then combine them gradually. Check help anytime!'
      },
      links: {
        feedback: 'Feedback',
        source: 'Source Code',
        mineru: 'MinerU Converter'
      }
    }
  }
}
</script>

<style scoped>
.help-container {
  display: flex;
  width: 100%;
  height: 100%;
  background-color: var(--backgroundColor);
  color: var(--fontColor);
  overflow: hidden;
  position: relative;
}

/* 左侧导航 - 在容器内浮动 */
.help-nav {
  position: absolute;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
  width: 56px;
  height: auto;
  max-height: 80vh;
  background-color: var(--menuColor);
  border: 1px solid var(--borderColor);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
  z-index: 10;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(10px);
  overflow: hidden;
}

.help-nav.expanded {
  width: 220px;
}

.nav-header {
  height: 60px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  border-bottom: 1px solid var(--borderColor);
  gap: 12px;
  flex-shrink: 0;
}

.nav-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--menuActiveColor);
  border-radius: 8px;
  color: var(--fontActiveColor);
  font-size: 16px;
  flex-shrink: 0;
}

.nav-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--fontActiveColor);
  white-space: nowrap;
  opacity: 0;
  transform: translateX(-10px);
  transition: all 0.3s ease;
}

.help-nav.expanded .nav-title {
  opacity: 1;
  transform: translateX(0);
}

.nav-content {
  flex: 1;
  padding: 8px 0;
  overflow-y: auto;
  max-height: calc(80vh - 120px);
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  margin: 4px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  gap: 12px;
  min-height: 44px;
}

.nav-item:hover {
  background-color: var(--menuHoverColor);
}

.nav-item.active {
  background-color: var(--menuActiveColor);
}

.nav-item-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.nav-item-content {
  flex: 1;
  overflow: hidden;
  opacity: 0;
  transform: translateX(-10px);
  transition: all 0.3s ease;
}

.help-nav.expanded .nav-item-content {
  opacity: 1;
  transform: translateX(0);
}

.nav-item-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--fontColor);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-item.active .nav-item-title {
  color: var(--fontActiveColor);
  font-weight: 600;
}

.nav-item-subtitle {
  font-size: 11px;
  color: var(--borderColor);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-footer {
  padding: 12px;
  border-top: 1px solid var(--borderColor);
  flex-shrink: 0;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--fontColor);
  font-size: 12px;
  text-decoration: none;
  padding: 6px 10px;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.nav-link:hover {
  background-color: var(--menuHoverColor);
  color: var(--fontActiveColor);
  text-decoration: none;
}

/* 主要内容区 - 留出导航空间 */
.help-main {
  flex: 1;
  height: 100%;
  overflow-y: auto;
  padding: 16px 24px 16px 100px;
  max-width: 900px;
  margin: 0 auto;
}

/* 其余样式保持不变（从上一版本复制） */
.main-header {
  text-align: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--borderColor);
}

.main-header h1 {
  font-size: 20px;
  font-weight: 600;
  color: var(--fontActiveColor);
  margin: 0 0 4px 0;
}

.header-subtitle {
  font-size: 13px;
  color: var(--fontColor);
  opacity: 0.8;
  margin: 0;
}

.help-section {
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--borderColor);
}

.section-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.section-title-content h2 {
  font-size: 18px;
  font-weight: 600;
  color: var(--fontActiveColor);
  margin: 0 0 4px 0;
}

.section-desc {
  font-size: 13px;
  color: var(--fontColor);
  opacity: 0.8;
  margin: 0;
}

/* 快速上手指南 */
.quick-steps {
  margin: 16px 0;
}

.quick-step-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.quick-step {
  background-color: var(--menuColor);
  border-radius: 10px;
  padding: 16px;
  border: 1px solid var(--borderColor);
  transition: transform 0.2s ease;
}

.quick-step:hover {
  transform: translateY(-2px);
  border-color: var(--fontActiveColor);
}

.step-icon {
  font-size: 20px;
  margin-bottom: 8px;
}

.quick-step h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--fontActiveColor);
  margin: 0 0 8px 0;
}

.quick-step ul {
  margin: 0;
  padding-left: 16px;
  font-size: 12px;
}

.quick-step li {
  margin-bottom: 4px;
  line-height: 1.4;
}

.section-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.content-card {
  background-color: var(--menuColor);
  border-radius: 10px;
  padding: 20px;
  border: 1px solid var(--borderColor);
}

.content-card h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--fontActiveColor);
  margin: 0 0 12px 0;
}

.content-card p {
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 12px;
}

.example-box {
  background-color: rgba(var(--fontActiveColor-rgb), 0.05);
  border-radius: 8px;
  padding: 12px;
  margin-top: 12px;
  border-left: 3px solid var(--fontActiveColor);
}

.example-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--fontActiveColor);
  margin-bottom: 6px;
}

.step-card {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--borderColor);
}

.step-card:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.step-number {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--fontActiveColor) 0%, #667eea 100%);
  color: white;
  border-radius: 50%;
  font-weight: 600;
  font-size: 14px;
  flex-shrink: 0;
}

.step-details h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--fontActiveColor);
  margin: 0 0 8px 0;
}

.step-details ul {
  margin: 0;
  padding-left: 16px;
  font-size: 12px;
}

.step-details li {
  margin-bottom: 4px;
  line-height: 1.4;
}

.flow-diagram {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 16px 0;
  padding: 0 10px;
  flex-wrap: wrap;
}

.flow-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  min-width: 60px;
}

.flow-icon {
  font-size: 20px;
  margin-bottom: 4px;
}

.flow-text {
  font-size: 11px;
  color: var(--fontColor);
  opacity: 0.8;
}

.flow-arrow {
  color: var(--fontActiveColor);
  font-size: 16px;
  font-weight: bold;
}

.guide-step {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--borderColor);
}

.guide-step:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.guide-number {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--menuActiveColor);
  color: var(--fontActiveColor);
  border-radius: 50%;
  font-weight: 600;
  font-size: 13px;
  flex-shrink: 0;
}

.guide-content strong {
  display: block;
  margin-bottom: 6px;
  color: var(--fontActiveColor);
  font-size: 14px;
}

.guide-content p,
.guide-content ul {
  font-size: 12px;
  margin: 0;
  padding-left: 16px;
}

.tool-tip {
  background-color: rgba(var(--fontActiveColor-rgb), 0.1);
  border-radius: 6px;
  padding: 8px;
  margin-top: 8px;
  font-size: 11px;
}

.use-cases {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.use-case {
  background-color: rgba(var(--fontActiveColor-rgb), 0.1);
  color: var(--fontActiveColor);
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
}

.nodes-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin: 12px 0;
}

.node-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background-color: var(--backgroundColor);
  border-radius: 8px;
  border: 1px solid var(--borderColor);
  transition: all 0.2s ease;
}

.node-item:hover {
  border-color: var(--fontActiveColor);
  transform: translateY(-1px);
}

.node-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.node-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--fontActiveColor);
  margin-bottom: 2px;
}

.node-desc {
  font-size: 11px;
  color: var(--fontColor);
  opacity: 0.8;
}

.workflow-example {
  margin-top: 16px;
}

.example-step {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.example-number {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--menuActiveColor);
  color: var(--fontActiveColor);
  border-radius: 50%;
  font-weight: 600;
  font-size: 13px;
  flex-shrink: 0;
}

.example-content strong {
  display: block;
  margin-bottom: 6px;
  color: var(--fontActiveColor);
  font-size: 14px;
}

.example-content p {
  font-size: 12px;
  margin: 6px 0;
}

.node-tags {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.node-tag {
  background-color: rgba(var(--fontActiveColor-rgb), 0.1);
  color: var(--fontActiveColor);
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
}

.flow-simple {
  background: linear-gradient(135deg, var(--fontActiveColor) 0%, #667eea 100%);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-weight: 500;
  text-align: center;
  margin: 12px 0;
  font-size: 13px;
}

.faq-list {
  margin-top: 8px;
}

.faq-item {
  border: 1px solid var(--borderColor);
  border-radius: 8px;
  margin-bottom: 8px;
  overflow: hidden;
}

.faq-question {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background-color: var(--menuColor);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.faq-question:hover {
  background-color: var(--menuHoverColor);
}

.faq-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background-color: var(--borderColor);
  border-radius: 50%;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}

.faq-text {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--fontActiveColor);
}

.faq-question i {
  font-size: 12px;
  opacity: 0.7;
  flex-shrink: 0;
}

.faq-answer {
  padding: 12px 16px 12px 52px;
  background-color: var(--backgroundColor);
  border-top: 1px solid var(--borderColor);
  font-size: 12px;
  line-height: 1.5;
}

.main-footer {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--borderColor);
}

.footer-content {
  text-align: center;
}

.footer-tip {
  font-size: 13px;
  margin-bottom: 12px;
  color: var(--fontColor);
  opacity: 0.9;
}

.footer-links {
  display: flex;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
}

.footer-links a {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--fontActiveColor);
  font-size: 12px;
  text-decoration: none;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.footer-links a:hover {
  background-color: var(--menuHoverColor);
  text-decoration: none;
}

code {
  background-color: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Consolas', monospace;
  font-size: 12px;
  color: var(--fontActiveColor);
}

a {
  color: var(--fontActiveColor);
  text-decoration: none;
  font-weight: 500;
}

a:hover {
  text-decoration: underline;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .help-nav {
    left: 10px;
  }
  
  .help-main {
    padding: 16px 16px 16px 80px;
  }
  
  .quick-step-row,
  .nodes-grid {
    grid-template-columns: 1fr;
  }
  
  .flow-diagram {
    flex-direction: column;
    gap: 8px;
  }
  
  .flow-arrow {
    transform: rotate(90deg);
    margin: 4px 0;
  }
  
  .footer-links {
    flex-direction: column;
    gap: 8px;
  }
}
</style>