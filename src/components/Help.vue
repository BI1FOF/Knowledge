<template>
  <div class="help-container">
    <!-- 左侧导航 - 默认窄版 -->
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
        <div class="nav-title" v-show="navExpanded">AI-KM 帮助</div>
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
            <div class="nav-item-title">{{ section.title }}</div>
            <div class="nav-item-subtitle">{{ section.subtitle }}</div>
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
        <h1>AI-KM 智能生产力平台</h1>
        <p class="header-subtitle">新手友好指南 - 四大核心功能</p>
      </div>

      <div class="main-content">
        <!-- 快速上手指南 - 最前面 -->
        <section id="quick-start" class="help-section">
          <div class="section-header">
            <div class="section-icon">🚀</div>
            <div class="section-title-content">
              <h2>快速上手指南（5分钟）</h2>
              <p class="section-desc">立即体验核心功能</p>
            </div>
          </div>

          <div class="quick-steps">
            <div class="quick-step-row">
              <div class="quick-step">
                <div class="step-icon">1️⃣</div>
                <div class="step-content">
                  <h4>体验智能对话</h4>
                  <ul>
                    <li>点击左侧AI图标</li>
                    <li>问个问题如"你好"</li>
                    <li>感受AI的回答</li>
                  </ul>
                </div>
              </div>
              
              <div class="quick-step">
                <div class="step-icon">2️⃣</div>
                <div class="step-content">
                  <h4>记录灵感</h4>
                  <ul>
                    <li>点击顶部"+"号</li>
                    <li>输入想法</li>
                    <li>点击保存</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div class="quick-step-row">
              <div class="quick-step">
                <div class="step-icon">3️⃣</div>
                <div class="step-content">
                  <h4>创建任务</h4>
                  <ul>
                    <li>进入任务管理</li>
                    <li>点击"新建任务"</li>
                    <li>设置时间开始</li>
                  </ul>
                </div>
              </div>
              
              <div class="quick-step">
                <div class="step-icon">4️⃣</div>
                <div class="step-content">
                  <h4>知识库体验</h4>
                  <ul>
                    <li>导入一个文档</li>
                    <li>点击"处理"按钮</li>
                    <li>问AI相关问题</li>
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
              <h2>智能对话系统</h2>
              <p class="section-desc">你的AI助手，参考个人文档库回答问题</p>
            </div>
          </div>

          <div class="section-content">
            <div class="content-card">
              <h3>核心概念：RAG技术</h3>
              <p>AI不仅能回答问题，还能<strong>参考你的个人文档库</strong>来回答问题。</p>
              
              <div class="example-box">
                <div class="example-title">📌 使用场景：</div>
                <p>询问："我的项目报告里提到的时间节点是什么？"</p>
                <p>AI会自动从你上传的项目文档中查找相关信息，然后回答。</p>
              </div>
            </div>

            <div class="content-card">
              <h3>三步使用指南</h3>
              
              <div class="step-card">
                <div class="step-number">1</div>
                <div class="step-details">
                  <h4>安装Ollama（推荐）</h4>
                  <ul>
                    <li>访问 <a href="https://ollama.com/" target="_blank">ollama.com</a></li>
                    <li>运行 <code>ollama serve</code></li>
                    <li>运行 <code>ollama pull qwen3</code></li>
                  </ul>
                </div>
              </div>

              <div class="step-card">
                <div class="step-number">2</div>
                <div class="step-details">
                  <h4>创建聊天对话</h4>
                  <ul>
                    <li>点击"新建聊天"</li>
                    <li>选择模型（如qwen3）</li>
                    <li>开始对话，像微信一样简单</li>
                  </ul>
                </div>
              </div>

              <div class="step-card">
                <div class="step-number">3</div>
                <div class="step-details">
                  <h4>关联知识库</h4>
                  <ul>
                    <li>点击书本图标 📚</li>
                    <li>选择.kb格式知识库</li>
                    <li>AI回答时会自动从知识库找资料</li>
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
              <h2>知识管理</h2>
              <p class="section-desc">建立你的数字大脑</p>
            </div>
          </div>

          <div class="section-content">
            <div class="content-card">
              <h3>知识处理流程</h3>
              <div class="flow-diagram">
                <div class="flow-step">
                  <div class="flow-icon">📥</div>
                  <div class="flow-text">导入文档</div>
                </div>
                <div class="flow-arrow">→</div>
                <div class="flow-step">
                  <div class="flow-icon">✂️</div>
                  <div class="flow-text">知识切片</div>
                </div>
                <div class="flow-arrow">→</div>
                <div class="flow-step">
                  <div class="flow-icon">🔢</div>
                  <div class="flow-text">向量化</div>
                </div>
                <div class="flow-arrow">→</div>
                <div class="flow-step">
                  <div class="flow-icon">🔍</div>
                  <div class="flow-text">智能检索</div>
                </div>
              </div>
            </div>

            <div class="content-card">
              <h3>操作步骤</h3>
              
              <div class="step-guide">
                <div class="guide-step">
                  <span class="guide-number">1</span>
                  <div class="guide-content">
                    <strong>导入文档</strong>
                    <p>支持：Markdown、PDF、Word、TXT</p>
                    <div class="tool-tip">
                      💡 建议先用 <a href="https://mineru.com.cn/" target="_blank">MinerU</a> 转换格式
                    </div>
                  </div>
                </div>

                <div class="guide-step">
                  <span class="guide-number">2</span>
                  <div class="guide-content">
                    <strong>创建知识库</strong>
                    <ul>
                      <li>点击"知识管理"菜单</li>
                      <li>选择文件夹</li>
                      <li>点击"处理"按钮</li>
                    </ul>
                  </div>
                </div>

                <div class="guide-step">
                  <span class="guide-number">3</span>
                  <div class="guide-content">
                    <strong>使用知识库</strong>
                    <div class="use-cases">
                      <span class="use-case">💬 智能对话</span>
                      <span class="use-case">🔗 工作流</span>
                      <span class="use-case">🔍 独立检索</span>
                    </div>
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
              <h2>可视化工作流</h2>
              <p class="section-desc">零代码自动化，像搭积木一样</p>
            </div>
          </div>

          <div class="section-content">
            <div class="content-card">
              <h3>八大节点类型</h3>
              
              <div class="nodes-grid">
                <div class="node-item" v-for="node in nodes" :key="node.id">
                  <div class="node-icon">{{ node.icon }}</div>
                  <div class="node-info">
                    <div class="node-name">{{ node.name }}</div>
                    <div class="node-desc">{{ node.desc }}</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="content-card">
              <h3>示例：分析新闻文章</h3>
              
              <div class="workflow-example">
                <div class="example-step">
                  <div class="example-number">1</div>
                  <div class="example-content">
                    <strong>拖拽三个节点：</strong>
                    <div class="node-tags">
                      <span class="node-tag">🕸️ 网页抓取</span>
                      <span class="node-tag">📚 知识库节点</span>
                      <span class="node-tag">🤖 推理节点</span>
                    </div>
                  </div>
                </div>

                <div class="example-step">
                  <div class="example-number">2</div>
                  <div class="example-content">
                    <strong>连接节点：</strong>
                    <p>点击节点底部的连接点 → 拖到下一个节点顶部</p>
                    <div class="flow-simple">
                      网页内容 → 知识库检索 → AI分析
                    </div>
                  </div>
                </div>

                <div class="example-step">
                  <div class="example-number">3</div>
                  <div class="example-content">
                    <strong>配置并运行：</strong>
                    <ul>
                      <li>网页抓取：输入网址</li>
                      <li>知识库：选择你的知识库</li>
                      <li>推理节点：输入分析指令</li>
                      <li>点击"运行所有节点"</li>
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
              <h2>常见问题</h2>
              <p class="section-desc">新手最常遇到的问题</p>
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
                  <span class="faq-text">{{ faq.question }}</span>
                  <i :class="['fa', faqOpen[index] ? 'fa-chevron-up' : 'fa-chevron-down']"></i>
                </div>
                <div class="faq-answer" v-if="faqOpen[index]">
                  <p>{{ faq.answer }}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 页脚 -->
        <div class="main-footer">
          <div class="footer-content">
            <div class="footer-tip">
              💡 <strong>使用建议：</strong>从最简单功能开始，逐步组合使用。有问题随时查阅帮助！
            </div>
            <div class="footer-links">
              <a href="https://github.com/whl1207/Knowledge/issues" target="_blank">
                <i class="fa fa-bug"></i> 反馈问题
              </a>
              <a href="https://github.com/whl1207/Knowledge" target="_blank">
                <i class="fa fa-github"></i> 查看源码
              </a>
              <a href="https://mineru.com.cn/" target="_blank">
                <i class="fa fa-file"></i> MinerU转换器
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

// 导航展开状态
const navExpanded = ref(false)
const activeSection = ref('quick-start')
const faqOpen = ref<Record<number, boolean>>({})

// 章节定义
const sections = ref([
  { id: 'quick-start', icon: '🚀', title: '快速开始', subtitle: '5分钟体验' },
  { id: 'ai-chat', icon: '🤖', title: '智能对话', subtitle: 'RAG助手' },
  { id: 'knowledge', icon: '📚', title: '知识管理', subtitle: '数字大脑' },
  { id: 'workflow', icon: '🔗', title: '工作流', subtitle: '自动化' },
  { id: 'faq', icon: '❓', title: '常见问题', subtitle: '新手必读' }
])

// 节点列表
const nodes = ref([
  { id: 1, icon: '📝', name: '文本节点', desc: '输入固定文本' },
  { id: 2, icon: '📁', name: '本地文件', desc: '读取电脑文件' },
  { id: 3, icon: '🌐', name: '网络搜索', desc: '上网查资料' },
  { id: 4, icon: '🕸️', name: '网页抓取', desc: '获取网页内容' },
  { id: 5, icon: '🤖', name: '推理节点', desc: '调用AI思考' },
  { id: 6, icon: '🐍', name: 'Python节点', desc: '运行代码' },
  { id: 7, icon: '📚', name: '知识库节点', desc: '从知识库找资料' },
  { id: 8, icon: '📊', name: '结构化节点', desc: '表格数据处理' }
])

// FAQ列表
const faqs = ref([
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
])

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
</script>

<style scoped>
.help-container {
  display: flex;
  width: 100%;
  height: 100%;
  background-color: var(--backgroundColor);
  color: var(--fontColor);
  overflow: hidden;
}

/* 左侧导航 - 紧凑设计 */
.help-nav {
  width: 56px;
  height: 100%;
  background-color: var(--menuColor);
  border-right: 1px solid var(--borderColor);
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
  flex-shrink: 0;
  position: relative;
  z-index: 10;
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

/* 主要内容区 - 紧凑设计 */
.help-main {
  flex: 1;
  height: 100%;
  overflow-y: auto;
  padding: 16px 24px;
  max-width: 900px;
  margin: 0 auto;
}

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

/* 章节样式 */
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

/* 内容卡片 */
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

/* 智能对话部分 */
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

/* 知识管理部分 */
.flow-diagram {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 16px 0;
  padding: 0 10px;
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
}

.use-case {
  background-color: rgba(var(--fontActiveColor-rgb), 0.1);
  color: var(--fontActiveColor);
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
}

/* 工作流部分 */
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

/* FAQ部分 */
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

/* 页脚 */
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

/* 通用样式 */
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
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 100;
    transform: translateX(-100%);
  }
  
  .help-nav.expanded {
    transform: translateX(0);
    width: 220px;
  }
  
  .help-main {
    padding: 16px;
  }
  
  .quick-step-row,
  .nodes-grid {
    grid-template-columns: 1fr;
  }
  
  .flow-diagram {
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .flow-arrow {
    transform: rotate(90deg);
    margin: 8px 0;
  }
  
  .footer-links {
    flex-direction: column;
    gap: 8px;
  }
}
</style>