# AI-KM Intelligent Knowledge Management Platform

## 🚀 Overview

**AI-KM (Artificial Intelligence Knowledge Management)** is a next-generation knowledge management platform integrated with cutting-edge AI technologies. Leveraging large language models and knowledge graph technology, it helps individuals and organizations achieve efficient knowledge organization, in-depth analysis, and intelligent application.

### 🎯 Major Upgrade in Latest Version: From "Expert Tool" to "Platform for All Users"

The latest version of AI-KM represents a systematic upgrade aimed at transitioning from an "expert tool" to a "platform for all users." The core goal of this update is to reduce the operational complexity of advanced features. While maintaining deep support for professional characteristics like knowledge graphs and complex workflows, it provides a unified entry point for users with different technical backgrounds through clear module delineation and an intuitive interface design.

**Key updates include:**
1.  **New Modular Architecture:** Clearly defined functional boundaries divided into five core modules.
2.  **Intelligent Chat Interface:** Supports knowledge base calling and workflow initiation.
3.  **End-to-End Knowledge Base Framework:** Integrates editing, chunking, processing, retrieval strategies, visualization, and testing.
4.  **Visual Workflow Editor:** Supports 10 types of functional nodes, including Decision, Python, MCP, etc.
5.  **Integrated Inspiration Management:** A multi-view system for managing inspiration and tasks.

These improvements build an effective bridge between novice users and expert capabilities, fostering collaboration and efficiency within knowledge-intensive teams.

## ✨ Core Value

- **Intelligent Knowledge Processing:** Automatically parses, classifies, and links knowledge content.
- **Multi-Dimensional Visualization:** Presents knowledge relationships through 12 view modes.
- **Open Model Integration:** Supports free switching between mainstream open-source large language models.
- **Enterprise-Grade Security:** All data processing is performed locally, ensuring complete privacy.
- **Beginner-Friendly:** Get started in 5 minutes with progressive feature exploration.
- **Expert-Level Capabilities:** Visual workflows support complex AI agent construction.

## 🏗️ System Architecture

The latest version of AI-KM adopts a clear functional module division, including five core modules: Home, Knowledge Management, Knowledge Base Processing, Workflow, and Inspiration Management. This design establishes clear usage boundaries for various operations, allowing novice users to access advanced functionalities through a familiar chat interface without needing to understand the underlying complex mechanisms.

## 🎯 Quick Start Guide (5-Minute Experience)

### Step 1: Experience Intelligent Conversation
1.  Click the AI icon on the left to enter the chat interface.
2.  Try asking a simple question like "Hello."
3.  Experience the AI's instant response.
    *(This feature requires installing Ollama or entering an API key to use.)*

### Step 2: Record Inspiration
1.  Click the "+" button in the top toolbar.
2.  Input your idea or note.
3.  Click save to complete your first record.

### Step 3: Create a Task
1.  Enter the Task Management module.
2.  Click the "New Task" button.
3.  Set the task name and time, and start managing.

### Step 4: Initial Experience with Knowledge Base
1.  Import a document (supports Markdown, PDF, Word, TXT).
2.  Click the "Process" button to build the knowledge base. *(This function requires using Ollama's embedding models.)*
3.  Return to the chat interface, select the generated knowledge base file (.kb file), and ask the AI questions about the document's content.

## 🏗️ Core Features Explained

### 1. 🏠 Home - Intelligent Conversation Center

The Home provides a standard conversation interface similar to generic AI chat software, supporting multi-window session management and switching between various large language models. To enhance usability, we've designed three conversation modes:

#### 1.1 Regular Conversation
- Supports custom system prompts to solidify the AI's role and behavior.
- Supports simple function reuse and role-playing.
- Suitable for daily Q&A and creative writing.

#### 1.2 Retrieval-Based Conversation (RAG Technology)
- Users can select a pre-built knowledge base.
- The system answers questions by citing relevant knowledge snippets based on Retrieval-Augmented Generation (RAG) technology.
- Significantly improves factual accuracy and professionalism.
- **Example Usage Scenario:**
    > **Question:** "What are the timeline milestones mentioned in my project report?"
    >
    > **AI Action:** Automatically searches for relevant information from your uploaded project documents before answering.

#### 1.3 Workflow-Based Conversation
- Users simply state their needs and select the target workflow.
- This triggers and executes the embedded complex workflow.
- Achieves task automation with zero-code operation.

### 2. 📚 Knowledge Management - 12-View System

Building upon the original AI-KM, we have enhanced the usability and expressiveness of knowledge management. The system provides 12 views to operate and display knowledge objects:

| View Type | Core Function | Suitable Scenarios |
| :--- | :--- | :--- |
| **File View** | Document list management | Daily file browsing |
| **Gantt Chart** | Timeline management, progress tracking | Project management, learning plans |
| **Kanban View** | Card-based task management | Agile development, personal Kanban |
| **Knowledge Graph** | 3D force-directed layout, dynamic relationship discovery | Knowledge discovery, concept mapping |
| **Month Calendar** | Monthly schedule display | Monthly planning |
| **Year Calendar** | Annual time view | Long-term planning |
| **Map View** | Geographic marking, spatial analysis | Regional research, field surveys |
| **Table View** | Batch editing metadata | Data organization, bulk operations |
| **Reader View** | Focused reading mode | In-depth reading, studying |
| **Mind Map** | Free node editing, theme focusing | Brainstorming, content creation |
| **PPT View** | Presentation mode, focus tracking | Knowledge presentation, teaching/training |
| **Editor View** | Rich text editing | Content creation, document editing |

**Detail Optimizations:**
- Edit file metadata in bulk through the Table View.
- Intuitively display dynamic relationships between files through the Knowledge Graph View.

### 3. 🔬 Knowledge Base Processing, Retrieval & Testing - End-to-End Framework

Based on the first updated AI-KM, this version strengthens the complete pipeline for knowledge base construction and evaluation. The core improvement lies in the fine-grained visual control over knowledge base files, text chunks, and their interrelationships.

#### 3.1 File Preview
- View original document content.
- Supports previewing documents in multiple formats.
- Preserves the original document formatting.

#### 3.2 Chunk Management
- **Intelligent Chunking Strategies:** Manage text chunking strategies and versions.
- **Manual Optimization:** Supports manual adjustment of chunk boundaries.
- **Version Control:** Tracks chunk modification history.

#### 3.3 Knowledge Graph Visualization
- Displays semantic associations between chunks.
- Visualizes attached metadata tags.
- Dynamically adjusts relationship links.

#### 3.4 Automated Testing Framework
```
User Inputs Test Question Set → System Auto-Evaluates → Generates Quality Report
```
- **Quantitative Evaluation:** Automatically assesses the knowledge base's recall rate and accuracy.
- **Question Set Management:** Supports batch import of test questions.
- **Iterative Optimization:** Optimizes knowledge base configuration based on test results.

#### 3.5 Configuration Management
- **Embedding Model Selection:** Supports multiple embedding models.
- **Retrieval Strategy Adjustment:** Configurable relevance thresholds.
- **Parameter Optimization:** Auto-optimizes based on test results.

### 4. 🔗 Workflow - Visual Agent Building Platform

A core breakthrough in this AI-KM update is its workflow engine, which has evolved from a task executor to a low-code agent building and orchestration platform. This engine aims to encapsulate professional Large Language Model (LLM) programming paradigms (like ReAct, planning, and tool calling) into visual, composable nodes. This allows domain experts to build, share, and deploy complex AI agent workflows without coding.

Our node design follows the principles of "modularity, atomicity, and interconnectivity." Ten types of nodes cover the core aspects of agent interaction:

#### Node Classification & Functional Description

| Category | Node Name | Core Function | Analogous Agent Capability |
| :--- | :--- | :--- | :--- |
| **Input** | Text Node | Receives text input | Perception |
| | File Node | Reads local files | Perception |
| | Web Scraping | Fetches webpage content | Perception |
| | Web Search | Searches for information online | Perception |
| **Knowledge** | Knowledge Base Node | Retrieves structured knowledge | Memory |
| | Structured Input | Processes structured data | Memory |
| **Reasoning** | Reasoning Node | Core LLM thinking/processing | Planning & Reasoning |
| **Control** | Decision Node | Conditional branching based on rules/LLM | Decision Making |
| **Execution** | Python Execution | Runs Python code | Tool Use |
| | MCP Node | Calls external tools | Tool Use |

#### 4.1 Workflow Building Experience
Workflows are built through an intuitive drag-and-drop graphical interface. Users define data flow and control flow between nodes using connecting lines. The workflow can be exported as a `.flow` file and called from the Home module.

**The key innovation lies in:**
- **Encapsulation:** Any built workflow can be saved as an independent, parameterized "skill package."
- **Reusability:** Workflow "skill packages" can be used directly in the Home conversation interface.
- **Natural Language Triggering:** Users only need to select or trigger via natural language in chat to invoke the entire complex process.

This essentially enables customized agents to function as plug-and-play conversation skills, allowing novice users to directly leverage AI capabilities built by experts.

#### 4.2 Unique Advantages
Compared to purely LLM-driven conversations or hard-coded scripts, AI-KM's workflows offer unique advantages:

- **Explainability & Controllability:** The entire reasoning and execution process is clearly visible, auditable, and debuggable as a flowchart, avoiding the "black box" uncertainty of traditional agents.
- **Reliability & Reusability:** Successful workflows can be solidified to ensure high-quality tasks are repeated without errors, becoming digital assets for the organization.
- **Openness & Extensibility:** Through Python and MCP nodes, system capabilities can seamlessly connect to almost any external system or newly emerging AI tool.

### 5. 💡 Inspiration Management - Integrated Creativity & Task Management

We integrate inspiration, planning, and task management into a unified interface:

#### Task Lifecycle Management
```
Inspiration → Planning → To-Do → In Progress → Completed
```

#### Multi-View Support
- **Waterfall View:** Displays the timeline of creative evolution.
- **Tree View:** Shows hierarchical relationships between tasks.
- **Calendar View:** Manages tasks based on the time dimension.
- **Kanban View:** Status-driven task management.

**Application Scenarios:**
- Personal management of creative cycles and task progress.
- Team task distribution and progress tracking.
- Project management and collaboration.

## 🎬 Typical Application Cases

### Case 1: Knowledge Base Processing, Retrieval, and Testing Framework

Example: Building a regulations knowledge base.

1.  **Import Documents:** User saves relevant regulations in a designated folder.
2.  **Automatic Processing:** System automatically performs text chunking and vectorization.
3.  **Visual Optimization:** Use knowledge graph visualization tools to inspect and manually establish associations between key concepts (e.g., model names, authors).
4.  **Automated Testing:** Through the automated testing framework, input a set of common questions; the system automatically evaluates retrieval results.
5.  **Iterative Optimization:** Optimize chunking strategies and edit metadata tags based on test results to improve retrieval accuracy.

```
📁 Regulations → ✂️ Smart Chunking → 🔍 Vectorization → 📊 Visual Inspection → 🧪 Auto-Testing → 🔄 Iterative Optimization
```

### Case 2: Workflow Design for Complex Q&A Tasks

**Scenario:** Querying financial reimbursement processes and regulations.

**Workflow Design:**
```
User Question → Reasoning Node extracts key info → Decision Node routes to relevant KB → Knowledge Base Node retrieves → Reasoning Node summarizes answer
```

**Core Innovations:**
1.  **Smart Routing:** The Decision Node automatically determines which knowledge base the question belongs to.
2.  **Multi-Layer Retrieval:** Compares the similarity between reasoned key information and knowledge base chunks.
3.  **Professional Summarization:** Generates professional answers by combining the user's question with retrieval results.

### Case 3: Workflow Design for Planning Problem Solving

**Scenario:** Classic planning problem solving.

**Workflow Design:**
```
Natural Language Description → Reasoning Node parses math model → Python Node generates solution code → Run solution → Generate analysis report
```

**Technical Characteristics:**
- **Natural Language to Math Model:** LLM automatically parses problem structure.
- **Automatic Code Generation:** Generates precise solution code based on the mathematical model.
- **Complete Solution:** Outputs the mathematical model, solution code, results, and analysis report.

**Supported Problem Types:**
- Planning Problems
- Assignment Problems
- TSP Problems
- Various Operations Research/Optimization Problems

### Case 4: Workflow Design for Complex Review Tasks

**Scenario:** Contract compliance review.

**Workflow Design:**
```
Contract Document → Split into modules → Parallel review process → Regulation retrieval → Compliance judgment → Generate review report
```

**Review Dimensions:**
1.  **Format Review:** Contract structure completeness.
2.  **Clause Review:** Key clause compliance.
3.  **Regulatory Conformity:** Match with relevant laws and standards.
4.  **Risk Assessment:** Identification of potential risk points.

**Value Proposition:**
- Assists business personnel in improving efficiency.
- Enhances the accuracy of business reviews.
- Standardizes the review process.

## 📈 Multi-Level Impact

### 1. Impact on Users
- **Significantly Lowers Technical Barrier:** Enables professionals without technical backgrounds to use AI for complex knowledge work and task automation.
- **Empowers Individual Creation:** Provides tools for everyone to build their own AI assistants.
- **Improves Work Efficiency:** Reduces repetitive work through automation.

### 2. Impact on Organizations
- **Knowledge Assetization:** Standardized, reusable workflows become carriers of organizational best practices.
- **Improved Collaboration Efficiency:** Accelerates the sedimentation, dissemination, and efficient utilization of internal knowledge.
- **Digital Transformation:** Drives organizations toward intelligent, automated work modes.

### 3. Impact on the Research Community
- **Complete Practical Framework:** Provides a complete, actionable framework for knowledge-augmented LLM applications.
- **Engineering Practice Reference:** Offers case references for deep integration of workflows with MCP and RAG.
- **Agent System Exploration:** Provides engineering practice foundations for building next-generation agent systems.

## 🛠️ Installation & Deployment

### System Requirements
- **Operating System:** Windows 10+ / macOS 12+ / Linux (Ubuntu 20.04+)
- **Hardware Configuration:**
    - **Minimum:** 8GB RAM, 4-core CPU, 1GB storage *(using online APIs for processing)*.
    - **Recommended:** 16GB+ RAM, Dedicated GPU, 50GB+ storage *(if using local LLMs, requires installing Ollama separately or entering relevant platform API keys)*.

### Development Environment Setup
```shell
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build Windows client
npm run build
```

## ❓ Frequently Asked Questions (FAQs for Beginners)

### Q1: I have no experience with AI at all. Can I learn it?
**A:** Absolutely! The latest version of AI-KM is specifically designed with a progressive learning path:
- Start with the simplest chat conversation.
- Gradually engage with knowledge management and workflows.
- Each function has detailed guidance.
- The community provides abundant learning resources.

### Q2: Is it free?
**A:**
- ✅ **Software is Free & Open Source:** The AI-KM platform is completely free.
- ✅ **Ollama Models are Free:** Runs locally, no payment required.
- ⚠️ **Commercial APIs:** May require payment if using services like OpenAI's API.
- 💡 **Recommendation:** Use Ollama to run models locally for free.

### Q3: Is my data safe?
**A:** **100% Safe:**
- All data is saved on your local computer.
- Knowledge bases are stored in folders you choose.
- Chat history and workflow data are all stored locally.
- No content is uploaded to the cloud.

### Q4: Which function should I learn first?
**A:** Suggested progressive learning order:
1.  **Home Conversation** (Get started in 5 minutes)
2.  **Inspiration Management** (Daily task management)
3.  **Knowledge Management** (Build a personal knowledge system)
4.  **Knowledge Base Processing** (Professional knowledge organization)
5.  **Workflow Editing** (Advanced automation)

## 🔧 Technical Characteristics

### Content Parsing Capabilities
- **Multi-Format Support:** Seamlessly parses Markdown, PDF, Word, TXT.
- **Intelligent Chunking:** Dynamic chunking strategy that preserves semantic integrity.
- **Metadata Extraction:** Automatically extracts author, time, keywords, etc.
- **Incremental Updates:** Only updates changed parts, efficient and time-saving.

### Retrieval Optimization Tools
- **Retrieval Debug Console:** View retrieval effects in real-time.
- **Vector Visualization:** Intuitively displays vector space distribution.
- **Feedback Learning:** Optimizes retrieval results based on user feedback.
- **Automated Testing:** Quantitatively evaluates knowledge base quality.

### Workflow Extensibility
- **Custom Nodes:** Supports custom workflow nodes.
- **External Integration:** Connects to various external tools via MCP.
- **Code Extension:** Python nodes support execution of arbitrary code.
- **Skill Package Marketplace:** Plans to open workflow sharing in the future.

## 🤝 Community & Support

### Getting Help
- **GitHub Issues:** [Report problems & suggestions](https://github.com/whl1207/Knowledge/issues)
- **Source Code:** [View the latest code](https://github.com/whl1207/Knowledge)
- **Format Conversion:** [MinerU Document Converter](https://mineru.com.cn/)

### Usage Tips
💡 **Best Practices:**
1.  **Start Small:** Begin with simple knowledge organization, then gradually increase complexity.
2.  **Iterate and Optimize:** Both knowledge bases and workflows require continuous iteration and optimization.
3.  **Team Collaboration:** Share workflows and knowledge bases to promote team learning.
4.  **Regular Backups:** Regularly back up important knowledge bases and workflows.

## 🎯 Conclusion

AI-KM is a comprehensive knowledge management platform designed to bridge the gap between professional AI applications and ordinary users. By introducing a structured functional module system and a powerful workflow system composed of ten node types, the software successfully encapsulates advanced functionalities like knowledge graphs, complex reasoning, and external tool calls into easy-to-use conversational interactions.

**The system has proven effective in supporting:**
- Knowledge base construction and evaluation.
- Complex workflow construction.
- Professional problem-solving.
- Business review automation.

AI-KM not only enhances the efficiency for individuals and organizations to manage and utilize knowledge, but its architectural design also lays the foundation for developing more intelligent, autonomous human-computer collaboration systems in the future.

---

**Start your AI knowledge management journey now!** 🚀

If you have any questions, please feel free to consult the help documentation or contact community support. We wish you a pleasant experience!


# AI-KM 智能知识管理平台

## 🚀 概述

**AI-KM（Artificial Intelligence Knowledge Management）** 是一个集成了前沿AI技术的下一代知识管理平台。通过大语言模型和知识图谱技术，帮助个人和组织实现知识的高效组织、深度分析和智能应用。

### 🎯 最新版本重大升级：从"专家工具"到"全用户平台"

最新版的AI-KM是一次系统性升级，旨在从"专家工具"转型为"全用户平台"。本次更新的核心目标是降低高级功能的操作复杂性，在保持对知识图谱、复杂工作流等专业特性的深度支持的同时，通过清晰的模块划分和直观的界面设计，为不同技术背景的用户提供统一入口。

**关键更新包括：**
1. **全新模块化架构**：明确功能边界，分为五大核心模块
2. **智能聊天界面**：支持知识库调用和工作流启动
3. **知识库全流程框架**：集成编辑、切片、处理、检索策略、可视化、测试
4. **可视化工作流编辑器**：支持10类功能节点，包括决策、Python、MCP等
5. **集成化灵感管理**：多视图的灵感与任务管理系统

这些改进在新手用户与专家能力之间建立了有效桥梁，促进了知识密集型团队内的协作与效率。

## ✨ 核心价值

- **智能知识处理**：自动解析、分类和关联知识内容
- **多维度可视化**：提供12种视图模式呈现知识关系
- **开放模型集成**：支持主流开源大语言模型自由切换
- **企业级安全**：所有数据处理均在本地完成，完全私密
- **新手友好**：5分钟快速上手，渐进式功能探索
- **专家级能力**：可视化工作流支持复杂AI智能体构建

## 🏗️ 系统架构

最新版AI-KM采用了清晰的功能模块划分，包括主页、知识管理、知识库处理、工作流和灵感管理五大核心模块，为各类操作划定了明确的使用边界。这种设计使得新手用户无需深入理解后台复杂机制，即可通过熟悉的聊天界面调用高级功能。

## 🎯 快速上手指南（5分钟体验）

### 第一步：体验智能对话
1. 点击左侧AI图标进入对话界面
2. 尝试问一个简单问题如"你好"
3. 感受AI的即时回复体验
（此功能需要先安装沃拉码或填入 api 才可使用）

### 第二步：记录灵感
1. 点击顶部工具栏的"+"号
2. 输入你的想法或笔记
3. 点击保存，完成第一条记录

### 第三步：创建任务
1. 进入任务管理模块
2. 点击"新建任务"按钮
3. 设置任务名称和时间，开始管理

### 第四步：知识库初体验
1. 导入一个文档（支持Markdown、PDF、Word、TXT）
2. 点击"处理"按钮建立知识库，此功能需要使用ollama的嵌入模型。
3. 回到对话界面，选择生成的知识库文件(kb文件)，问AI关于文档内容的问题。

## 🏗️ 核心功能详解

### 1. 🏠 主页 - 智能对话中心

主页提供了与通用AI聊天软件相似的标准对话界面，支持多会话窗口管理和多种大语言模型切换。为了提升易用性，我们设计了三种对话模式：

#### 1.1 普通对话
- 支持自定义系统提示词，固化AI的角色与行为
- 支持简单的功能复用和角色扮演
- 适合日常问答和创意写作

#### 1.2 基于检索的对话（RAG技术）
- 用户可选择已构建的知识库
- 系统基于检索增强生成（RAG）技术，引用相关知识片段回答问题
- 极大提升事实准确性和专业性
- **使用场景示例**：
  > **提问**："我的项目报告里提到的时间节点是什么？"
  > 
  > **AI行为**：自动从你上传的项目文档中查找相关信息，然后回答

#### 1.3 基于工作流的对话
- 用户只需提出需求并选择目标工作流
- 即可触发并执行内嵌的复杂工作流
- 实现任务自动化，零代码操作

### 2. 📚 知识管理 - 12种视图系统

在原始版AI-KM的基础上，我们增强了知识管理的易用性与表现力。系统提供12种视图来操作和展示知识对象：

| 视图类型 | 核心功能 | 适用场景 |
|---------|--------|---------|
| 文件视图 | 文档列表管理 | 日常文件浏览 |
| 甘特图 | 时间线管理、进度追踪 | 项目管理、学习计划 |
| 看板视图 | 卡片式任务管理 | 敏捷开发、个人看板 |
| 知识图谱 | 3D力导向图布局、动态关系发现 | 知识发现、概念梳理 |
| 月日历 | 月度日程展示 | 月度规划 |
| 年日历 | 年度时间视图 | 长期规划 |
| 地图视图 | 地理标记、空间分析 | 区域研究、田野调查 |
| 表格视图 | 批量编辑元数据 | 数据整理、批量操作 |
| 阅读器视图 | 专注阅读模式 | 深度阅读、学习 |
| 思维导图 | 自由节点编辑、主题聚焦 | 头脑风暴、内容创作 |
| PPT视图 | 演示模式、焦点追踪 | 知识展示、教学培训 |
| 编辑器视图 | 富文本编辑 | 内容创作、文档编辑 |

**细节优化：**
- 通过表格视图批量编辑文件的元数据
- 通过知识图谱视图直观展示文件之间的动态关联

### 3. 🔬 知识库处理、检索与测试 - 全流程框架

基于第一次更新的AI-KM，本版本强化了知识库构建与评估的全流程。核心改进在于对知识库文件、文本切片及其关联关系的精细化可视化管控。

#### 3.1 文件预览
- 查看原始文档内容
- 支持多种格式文档预览
- 保持文档原始格式

#### 3.2 切片管理
- **智能切片策略**：管理文本切片策略、版本
- **手动优化**：支持手动调整切片边界
- **版本控制**：跟踪切片修改历史

#### 3.3 知识图谱可视化
- 展示切片间的语义关联
- 可视化附加的元数据标签
- 动态调整关联关系

#### 3.4 自动化测试框架
```
用户输入测试问题集 → 系统自动评估 → 生成质量报告
```
- **量化评估**：自动评估知识库的召回率与准确性
- **问题集管理**：支持批量导入测试问题
- **迭代优化**：根据测试结果优化知识库配置

#### 3.5 配置管理
- **嵌入模型选择**：支持多种嵌入模型
- **检索策略调整**：可配置相关性阈值
- **参数优化**：基于测试结果自动调优

### 4. 🔗 工作流 - 可视化智能体构建平台

这次更新的AI-KM的核心突破在于其工作流引擎，它从一个任务执行器演化为一个低代码的智能体（Agent）构建与编排平台。该引擎旨在将专业的大语言模型（LLM）编程范式（如ReAct、规划与工具调用）封装成可视化的、可组合的节点，从而让领域专家无需编码即可构建、共享和部署复杂的AI智能体流程。

我们的节点设计遵循"模块化、原子化、可互联"的原则，十类节点覆盖了智能体交互的核心环节：

#### 节点分类与功能描述

| 类别 | 节点名称 | 核心功能 | 类比智能体能力 |
|------|---------|---------|--------------|
| **输入** | 文本节点 | 接收文本输入 | 感知 |
|  | 文件节点 | 读取本地文件 | 感知 |
|  | 网页抓取 | 获取网页内容 | 感知 |
|  | 网络搜索 | 在线搜索信息 | 感知 |
| **知识** | 知识库节点 | 检索结构化知识 | 记忆 |
|  | 结构化输入 | 处理结构化数据 | 记忆 |
| **推理** | 推理节点 | LLM核心思考处理 | 规划与推理 |
| **控制** | 决策节点 | 基于规则/LLM条件分支 | 决策 |
| **执行** | Python执行 | 运行Python代码 | 工具使用 |
|  | MCP节点 | 调用外部工具 | 工具使用 |

#### 4.1 工作流构建体验
工作流的构建通过一个直观的拖拽式图形界面完成。用户通过连接线定义节点间的数据流与控制流。该工作流可以导出为flow文件，并在主页中的调用。

**关键创新在于：**
- **可封装性**：任何构建好的工作流都可以被保存为一个独立的、参数化的"技能包"
- **可复用性**：工作流"技能包"可以直接使用到主页的对话界面
- **自然语言触发**：用户只需在聊天中选择或通过自然语言触发，即可调用整个复杂流程

这本质上实现了将定制化智能体（Agent）作为即插即用的对话技能，使新手用户能直接利用专家构建的AI能力。

#### 4.2 独特优势
与纯LLM驱动的对话或硬编码脚本相比，AI-KM的工作流提供了独特优势：

- **可解释性与可控性**：整个推理和执行过程以流程图形式清晰可见、可审计、可调试，避免了传统智能体的"黑箱"不确定性
- **可靠性与复用性**：固化成功的工作流可以确保高质量任务被零误差重复执行，成为组织的数字资产
- **开放性与扩展性**：通过Python和MCP节点，系统能力可以无缝对接几乎任何外部系统或新出现的AI工具

### 5. 💡 灵感管理 - 创意与任务一体化

我们将灵感、规划与任务管理整合到一个统一界面中：

#### 任务生命周期管理
```
灵感 → 规划 → 待办 → 进行中 → 已完成
```

#### 多视图支持
- **瀑布流视图**：时间线展示创意演进
- **树状图视图**：层次化展示任务关系
- **日历视图**：按时间维度管理任务
- **看板视图**：状态驱动的任务管理

**应用场景：**
- 个人管理创意周期和任务进度
- 团队进行任务分发与进度追踪
- 项目管理与协作

## 🎬 典型应用案例

### 案例1：面向知识库的处理、检索和测试框架

以构建一个法规知识库为例：

1. **导入文档**：用户将相关法规保存在指定文件夹
2. **自动处理**：系统自动进行文本切片与向量化
3. **可视化优化**：利用知识图谱可视化工具，检查并手动建立关键概念（如模型名称、作者）之间的关联
4. **自动化测试**：通过自动化测试框架，输入常见问题的测试集，系统自动评估检索结果
5. **迭代优化**：根据测试结果优化切片策略，编辑元数据标签，提升检索精度

```
📁 法规文档 → ✂️ 智能切片 → 🔍 向量化 → 📊 可视化检查 → 🧪 自动化测试 → 🔄 迭代优化
```

### 案例2：面向复杂问答任务的工作流设计

**场景**：财务报销流程与规定查询

**工作流设计**：
```
用户提问 → 推理节点提取关键信息 → 决策节点路由到对应知识库 → 知识库节点检索 → 推理节点总结答案
```

**核心创新**：
1. **智能路由**：决策节点自动判断问题归属的知识库
2. **多层检索**：对比推理出的关键信息与知识库切片相似度
3. **专业总结**：结合用户问题与检索结果生成专业回答

### 案例3：面向规划问题求解的工作流设计

**场景**：经典规划问题求解

**工作流设计**：
```
自然语言描述 → 推理节点解析数学模型 → Python节点生成求解代码 → 运行求解 → 生成分析报告
```

**技术特点**：
- **自然语言到数学模型**：LLM自动解析问题结构
- **代码自动生成**：根据数学模型生成精确求解代码
- **完整解决方案**：输出数学模型、求解代码、求解结果、分析报告

**支持问题类型**：
- 规划问题
- 指派问题
- TSP问题
- 各类运筹优化问题

### 案例4：面向复杂审核任务的工作流设计

**场景**：合同合规性审核

**工作流设计**：
```
合同文档 → 多模块拆分 → 并行审核流程 → 法规检索 → 合规性判断 → 生成审核报告
```

**审核维度**：
1. **格式审核**：合同结构完整性
2. **条款审核**：关键条款合规性
3. **法规符合性**：与相关法律规范的匹配度
4. **风险评估**：潜在风险点识别

**价值体现**：
- 辅助业务经办人员提高效率
- 提升业务审核的正确率
- 标准化审核流程

## 📈 多层面影响

### 1. 对用户层面
- **显著降低技术门槛**：使非技术背景的专业人员也能使用AI进行复杂知识工作和任务自动化
- **赋能个体创造**：提供工具让每个人都能构建自己的AI助手
- **提升工作效率**：通过自动化减少重复性工作

### 2. 对组织层面
- **知识资产化**：标准化、可复用工作流成为组织最佳实践的载体
- **协作效率提升**：加速了内部知识的沉淀、传播与高效利用
- **数字化转型**：推动组织向智能化、自动化工作模式转型

### 3. 对研究社区层面
- **完整实践框架**：提供了一套完整的、可实操的知识增强LLM应用框架
- **工程实践参考**：工作流与MCP、RAG深度集成的案例参考
- **智能体系统探索**：为构建下一代智能体（Agent）系统提供了工程实践基础

## 🛠️ 安装与部署

### 系统要求
- **操作系统**：Windows 10+/macOS 12+/Linux（Ubuntu 20.04+）
- **硬件配置**：
  - 最低：8GB RAM，4核CPU，1GB存储，使用互联网 api 进行处理
  - 推荐：16GB+ RAM，独立GPU，50GB+存储，如果使用大语言模型，需要另外安装Ollama或填入相关平台的api。

### 开发环境配置
```shell
# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建Windows客户端
npm run build
```

## ❓ 常见问题（新手必读）

### Q1：完全没接触过AI，能学会吗？
**A**：完全可以！最新版AI-KM专门设计了从易到难的学习路径：
- 从最简单的聊天对话开始
- 逐步接触知识管理和工作流
- 每个功能都有详细指引
- 社区提供大量学习资源

### Q2：需要付费吗？
**A**：
- ✅ **软件免费开源**：AI-KM平台完全免费
- ✅ **Ollama模型免费**：本地运行，无需付费
- ⚠️ **商业API**：如使用OpenAI等商业API可能需要付费
- 💡 **推荐**：使用Ollama在本地免费运行

### Q3：数据安全吗？
**A**：**100%安全**：
- 所有数据保存在你的本地电脑
- 知识库存储在你自选的文件夹
- 聊天记录和工作流数据都在本地
- 不上传任何内容到云端

### Q4：应该先学习哪个功能？
**A**：建议渐进式学习顺序：
1. **主页对话**（5分钟上手）
2. **灵感管理**（日常任务管理）
3. **知识管理**（建立个人知识体系）
4. **知识库处理**（专业化知识组织）
5. **工作流编辑**（高级自动化）

## 🔧 技术特点

### 内容解析能力
- **多格式支持**：Markdown、PDF、Word、TXT无缝解析
- **智能切片**：保持语义完整的动态分块策略
- **元数据提取**：自动提取作者、时间、关键词等信息
- **增量更新**：只更新变化部分，高效省时

### 检索优化工具
- **检索调试台**：实时查看检索效果
- **向量可视化**：直观展示向量空间分布
- **反馈学习**：根据用户反馈优化检索结果
- **自动化测试**：量化评估知识库质量

### 工作流扩展性
- **节点自定义**：支持自定义工作流节点
- **外部集成**：通过MCP对接各类外部工具
- **代码扩展**：Python节点支持任意代码执行
- **技能包市场**：未来计划开放工作流共享

## 🤝 社区与支持

### 获取帮助
- **GitHub Issues**：[反馈问题与建议](https://github.com/whl1207/Knowledge/issues)
- **项目源码**：[查看最新代码](https://github.com/whl1207/Knowledge)
- **格式转换**：[MinerU文档转换器](https://mineru.com.cn/)

### 使用建议
💡 **最佳实践**：
1. **从小处开始**：从简单的知识整理开始，逐步复杂化
2. **迭代优化**：知识库和工作流都需要不断迭代优化
3. **团队协作**：分享工作流和知识库，促进团队学习
4. **定期备份**：重要知识库和工作流定期备份

## 🎯 结语

AI-KM是一个旨在弥合专业AI应用与普通用户间鸿沟的综合知识管理平台。通过引入结构清晰的功能模块和一个由十类节点构成的强大工作流系统，软件成功地将知识图谱、复杂推理、外部工具调用等高级功能封装为易用的对话式交互。

**系统证明能有效支持：**
- 知识库构建与评估
- 复杂工作流程构造
- 专业问题求解
- 业务审核自动化

AI-KM不仅提升了个人与组织管理、利用知识的效率，其架构设计也为未来开发更智能、更自主的人机协作系统奠定了基础。

---

**开始你的AI知识管理之旅吧！** 🚀

如果有任何问题，请随时查阅帮助文档或联系社区支持。祝您使用愉快！