<script setup lang="ts">
  import * as d3 from 'd3';
  import { onMounted,onBeforeUnmount,ref, nextTick,watch } from 'vue'
  import { usestore } from '../../../store'
  const store=usestore()
  const graphContainer = ref<HTMLElement | null>(null);

  let width = ref(600)
  let height = ref(400)
  let deep = ref(1)
  let simulation = null as any
  let data = ref({
    nodes:[],
    links:[]
  }) as any
  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 10])
    .on('zoom', (event: any) => {
      nodeSVG.value.attr('transform', event.transform);
      linkSVG.value.attr('transform', event.transform);
      labelSVG.value.attr('transform', event.transform);
    });
  const  svg = d3.select(graphContainer.value).append('svg')
    .attr('width', width.value)
    .attr('height', height.value)
    .call(zoom);
  let linkSVG=ref(null) as any //svg中的边
  let nodeSVG=ref(null) as any //svg中的节点
  let labelSVG=ref(null) as any //svg中的标签
  
  let layoutType = ref("force") //布局类型
  let panelType = ref("")
  
  const resize=function(){
    if (graphContainer.value) {
      width.value = graphContainer.value.offsetWidth
      height.value = graphContainer.value.offsetHeight
      const svg = d3.select(graphContainer.value).select('svg')
      if (svg.empty()) {
        // 如果不存在SVG元素，则创建一个新的
        const newSvg = d3.select(graphContainer.value).append('svg').attr('width', width.value).attr('height', height.value)
        // 重新绑定事件处理程序
        newSvg.on('resize', resize);
      } else {
        // 如果SVG元素已经存在，则更新它的宽度和高度
        svg.attr('width', width.value).attr('height', height.value)
        simulation.force('center', d3.forceCenter(width.value / 2, height.value / 2))
      }
    }
  }
  
  const resetView=async function(){
    if (graphContainer.value) {
      await nextTick()
      width.value = graphContainer.value.offsetWidth
      height.value = graphContainer.value.offsetHeight
    }
    const minX:number = Number(d3.min(data.value.nodes, (d:any) => d.x)) || 0
    const maxX:number = Number(d3.max(data.value.nodes, (d:any) => d.x)) || 0
    const minY:number = Number(d3.min(data.value.nodes, (d:any) => d.y)) || 0
    const maxY:number = Number(d3.max(data.value.nodes, (d:any) => d.y)) || 0
    // 计算缩放比例
    const xScale = width.value / (maxX - minX);
    const yScale = height.value / (maxY - minY);
    const scale = Math.min(xScale, yScale);

    // 计算平移偏移量
    const offsetX = (maxX - minX) * scale / 2 - (maxX + minX) / 2;
    const offsetY = (maxY - minY) * scale / 2 - (maxY + minY) / 2;
    // 应用缩放和平移变换
    svg.call(zoom.transform, d3.zoomIdentity)
  }
  
  // 点击图形区域关闭设置面板
  const closePanel = function() {
    if (panelType.value !== '') {
      panelType.value = ''
    }
  }
  
  const init = async function(){
    if (graphContainer.value) {
      await nextTick()
      width.value = graphContainer.value.offsetWidth
      height.value = graphContainer.value.offsetHeight
      try {
        await loadFile()
        renderGraph()
        resize()
        getAttributes()
      } catch (error) {
        console.error(error);
      }
    }
  }
  const loadFile=async function(){
    let { fileList, relationList } = await window.ipcRenderer.invoke("getFilesRelation", store.root, deep.value);
    fileList=fileList.map((obj: any,index:number)  => {
      return proxyToRegular({ ...obj  });
    })
    data.value.nodes=fileList
    data.value.links=relationList
  }
  const renderGraph=function(){
    function svgDragstarted(event: any) {
        // 在拖动开始时，记录当前的鼠标位置和 SVG 元素的当前位置
        event.subject.startX = event.x;
        event.subject.startY = event.y;
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }

      function svgDragged(event: any) {
        // 计算鼠标移动的距离
        const dx = event.x - event.subject.startX;
        const dy = event.y - event.subject.startY;

        // 更新 SVG 元素的位置
        event.subject.fx += dx;
        event.subject.fy += dy;
      }

      function svgDragended(event: any) {
        // 在拖动结束时，清除固定的位置
        event.subject.fx = null;
        event.subject.fy = null;
      }
      const svgDrag: any = d3.drag()
                        .on('start', svgDragstarted)
                        .on('drag', svgDragged)
                        .on('end', svgDragended)

      const existingSvg = d3.select(graphContainer.value).select("svg");
      if (existingSvg) {
        existingSvg.remove();
      }
      const svg = d3.select(graphContainer.value)
                    .append('svg')
                    .attr('width', width.value)
                    .attr('height', height.value)
                    .call(zoom); // 调用拖动事件
      
      if (simulation) simulation.stop();
      if (layoutType.value === "force") {
        simulation = d3.forceSimulation<any, any>(data.value.nodes)
                        .force('link', d3.forceLink(data.value.links).id((d: any) => d.id))
                        .force('charge', d3.forceManyBody().strength(-250))
                        .force('center', d3.forceCenter(width.value / 2, height.value / 2))
                        .force('x', d3.forceX(width.value).strength(0.1)) // 添加水平位置限制
                        .force('y', d3.forceY(height.value).strength(0.1)); // 添加垂直位置限制
      } else if (layoutType.value === "circle") {
        // 圆形布局初始化
        const radius = Math.min(width.value, height.value) / 2 - 50; // 定义圆的半径
        const angle = (2 * Math.PI) / data.value.nodes.length; // 计算每个节点之间的角度

        data.value.nodes.forEach((node : any, index : number) => {
          node.x = width.value / 2 + radius * Math.cos(angle * index);
          node.y = height.value / 2 + radius * Math.sin(angle * index);
        });
      }
      //定义箭头
      svg.append("defs").selectAll("marker")
        .data(["end"])      // Different link/path types can be defined here
        .enter().append("marker")    // This section adds in the arrows
        .attr("id", String)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 15)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", "#999")
      //定义线条     
      linkSVG.value = svg.selectAll('line')
                      .data(data.value.links)
                      .enter().append('line')
                      .attr('stroke', '#999')
                      .attr('stroke-opacity', 0.6)
                      .attr('stroke-width', (d: any) => Math.sqrt(d.value))
                      .attr("marker-end", "url(#end)")

      const drag = d3.drag<SVGCircleElement, any, any>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);

      if(layoutType.value === "force"){
        nodeSVG.value = svg.selectAll<SVGCircleElement, any>('circle')
                      .data(data.value.nodes)
                      .enter().append('circle')
                      .attr('r', 5)
                      .attr('fill', '#ccc')
                      .call(drag as d3.ValueFn<SVGCircleElement, any, any> ,0, [])
      }else if(layoutType.value === "circle"){
        nodeSVG.value = svg.selectAll<SVGCircleElement, any>('circle')
                      .data(data.value.nodes)
                      .enter().append('circle')
                      .attr('r', 5)
                      .attr('fill', '#ccc')
                      .attr('cx', (d: any) => d.x) // 使用固定的x位置
                      .attr('cy', (d: any) => d.y); // 使用固定的y位置
      }
      // 添加节点标签
      labelSVG.value = svg.selectAll('.label')
        .data(data.value.nodes)
        .enter().append('text')
        .attr('class', 'label')
        .text((d: any) => d.label)
        .attr('x', (d: any) => d.x)
        .attr('y', (d: any) => d.y)
        .attr('dy', 20) // 垂直偏移量，使标签位于节点之上
        .attr('text-anchor', 'middle') // 文本锚点在中间
        .attr('font-size', '6px') // 设置文字大小
        .attr('fill', 'var(--fontColor)'); // 设置文字颜色

      simulation.on('tick', () => {
        linkSVG.value.attr('x1', (d: any) => d.source.x)
            .attr('y1', (d: any) => d.source.y)
            .attr('x2', (d: any) => d.target.x)
            .attr('y2', (d: any) => d.target.y);

        nodeSVG.value.attr('cx', (d: any) => d.x)
            .attr('cy', (d: any) => d.y);
        labelSVG.value.attr('x', (d: any) => d.x)
             .attr('y', (d: any) => d.y);
      });
        
      function dragstarted(event:any) {
        if (!event.active) simulation.alphaTarget(0.1).restart();

        // 获取当前的缩放变换
        const transform = d3.zoomTransform(svg.node() as SVGSVGElement);
        // 将节点的初始位置转换为画布的坐标系统
        event.subject.fx = (event.subject.x - transform.x) / transform.k;
        event.subject.fy = (event.subject.y - transform.y) / transform.k;
      }

      function dragged(event: any) {
        if (event.subject) {
          // 获取当前的缩放变换
          const transform = d3.zoomTransform(svg.node() as SVGSVGElement);

          // 将鼠标坐标转换为画布的坐标系统
          const x = (event.x - transform.x) / transform.k;
          const y = (event.y - transform.y) / transform.k;

          // 更新节点的位置
          event.subject.fx = x;
          event.subject.fy = y;
        }
      }

      function dragended(event:any) {
        if (!event.active) simulation.alphaTarget(0);
        if (event.subject) {
          event.subject.fx = null;
          event.subject.fy = null;
        }
      }
  }
  
  //获取节点属性
  let attributes = ref([]) as any
  const getAttributes = function(){
    // 获取所有属性
    let allProps = [] as any
    data.value.nodes.forEach((obj: { attributes: any }) => {
      const props = Object.keys(obj.attributes)
      for(let i = 0;i<props.length;i++){
        if(!/^[A-Za-z]+$/.test(props[i])){
          let t = {
            name:props[i],
            state:0,
            color:'rgba(170, 170, 170, 0.4)'
          } as any
          allProps.push(t)
        }
      }
    })
    // 去除重复属性
    let result = allProps.filter((obj:any, index:any, self:any) => {
      // 检查当前对象是否在之前的对象中出现过
      return (
        index ===
        self.findIndex((o:any) => {
          return JSON.stringify(o) === JSON.stringify(obj)
        })
      )
    })
    attributes.value = result
  }
  //展开所有节点的某一类属性
const expandAttribute=async function(indexParam:string|number,state:number){
  // 将参数转换为 number 类型
  const index = Number(indexParam)
  
  if (isNaN(index)) {
    console.error('Invalid index:', indexParam)
    return
  }
  
  // 确保 index 在有效范围内
  if (index < 0 || index >= attributes.value.length) {
    console.error('Index out of range:', index)
    return
  }
  
  attributes.value[index].state=state
  let attribute = attributes.value[index].name //需要展开的属性
    if(state==1||state==-1){ //如果是创建属性节点
      //循环遍历节点，并根据属性创建新节点
      for(let i = 0;i<data.value.nodes.length;i++){
        //如果该节点有这个属性
        if(data.value.nodes[i].attributes!=undefined){
          if(data.value.nodes[i].attributes[attribute]!=undefined){
            let items =[]
            //切分属性，根据;和；进行切分
            if(data.value.nodes[i].attributes[attribute] instanceof Date){
              items =[store.StampToDate(data.value.nodes[i].attributes[attribute])]
            }else{
              items = data.value.nodes[i].attributes[attribute].split(/[;；]/)
            }
            //遍历所有items
            for (const item of items) {
              //判断节点是否存在
              let nodeindex=null as number|unknown //是否有重复边，序号
              //判断属性内容是否是原有节点
              for (let index = 0;index<data.value.nodes.length;index++) {
                if(data.value.nodes[index].label==item){
                  //添加边
                  nodeindex=index
                }
              }
              if(nodeindex==null){
                nodeindex=data.value.nodes.length
                //添加节点
                data.value.nodes.push({
                  id:data.value.nodes.length,
                  label:item,
                  path:'',
                  type:attribute,
                  x:0,
                  y:0,
                  vx:0,
                  vy:0
                })
              }
              //边数据
              let linkData={
                id:data.value.links.length,
                index:data.value.links.length,
                source:(state==1)?(data.value.nodes[i].id):(nodeindex),
                target:(state==1)?(nodeindex):(data.value.nodes[i].id),
                type:attribute,
                style:{
                  fill:attributes.value[index].color,
                  stroke:attributes.value[index].color,
                },
              }
              let edgeState=false //是否有重复边
              for (const link of data.value.links) {
                if(link.source==linkData.source && link.target==linkData.target && link.type==linkData.type){
                  //添加边
                  edgeState=true
                }
              }
              if(edgeState==false) data.value.links.push(linkData)
            }
          }
        }
      }
    }else{
      //如果是删除行为
      let filteredNodes = data.value.nodes.filter((node:any) => node.type !== attribute);
      data.value.nodes = filteredNodes;

      //过滤边，属性有变化会产生bug
      let filteredEdges = data.value.links.filter((link:any) => link.type !== attribute);
      data.value.links = filteredEdges;
    }
    renderGraph()
  }
  function proxyToRegular(obj:any) {
    return JSON.parse(JSON.stringify(obj));
  }
  watch(()=>store.root, (newValue, oldValue) => {
    init()
  })
  onMounted(() => {
    init()
    window.addEventListener('resize', resize)
  });
  onBeforeUnmount(() => {
    window.removeEventListener('resize', resize)
  })
</script>

<template >
  <div class="graph">
    <!-- 顶部菜单 - 参照第一个模块的样式 -->
    <div class="menu">
      <ul>
        <!-- 路径信息 -->
        <li class="path-info">
          <i class="fa fa-sitemap"></i>
          {{ store.root == "" ? "根目录" : store.root }}
        </li>
        
        <!-- 布局选择器 -->
        <li class="menu-tools">
          <div class="layout-selector">
            <select 
              v-model="layoutType" 
              @change="renderGraph()"
              title="布局方式"
              class="layout-select"
            >
              <option value="force">力导向布局</option>
              <option value="circle">圆形布局</option>
            </select>
          </div>
        </li>
        
        <!-- 深度选择器 -->
        <li class="menu-tools">
          <div class="depth-selector">
            <select 
              v-model="deep" 
              @change="init()"
              title="关联深度"
              class="depth-select"
            >
              <option value="1">深度1</option>
              <option value="2">深度2</option>
              <option value="3">深度3</option>
              <option value="4">深度4</option>
              <option value="5">深度5</option>
            </select>
          </div>
        </li>
        
        <!-- 聚焦按钮 -->
        <li class="menu-tools">
          <button @click="resetView()" title="聚焦">
            <i class="fa fa-arrows-alt"></i>
          </button>
        </li>
        
        <!-- 设置面板开关 -->
        <li class="menu-tools">
          <button @click="panelType=='设置'?panelType='':panelType='设置'" title="设置">
            <i class="fa fa-cogs"></i>
          </button>
        </li>
      </ul>
    </div>
    
    <!-- 右侧设置面板 -->
    <div class="panel scoll" v-if="panelType!=''" style="width:230px">
      
      <div class="scoll" v-if="panelType=='设置'">
        <table>
          <tr v-for="(item,index) in attributes" :key="index" style="text-align: center;">
            <td><i class="fa fa-file-text"></i></td>
            <td style="max-width:100px;text-overflow: ellipsis;" :title="item.name">{{item.name}}</td>
            <td @click="expandAttribute(index,-1)" v-if="item.state==0||item.state==1"><i class="fa fa-toggle-off" /></td>
            <td @click="expandAttribute(index,0)" v-if="item.state==-1"><i class="fa fa-toggle-on" /></td>
            <td @click="expandAttribute(index,1)" v-if="item.state==0||item.state==-1"><i class="fa fa-toggle-off" /></td>
            <td @click="expandAttribute(index,0)" v-if="item.state==1"><i class="fa fa-toggle-on" /></td>
          </tr>
        </table>
      </div>
    </div>
    
    <!-- 图形容器 - 添加点击事件来关闭设置面板 -->
    <div ref="graphContainer" id="graphContainer" @click="closePanel"></div>
  </div>
</template>

<style scoped>
  .graph{
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--backgroundColor);
    overflow: hidden;
    border-right: 1px solid var(--borderColor);
    box-sizing: border-box;
  }
  
  #graphContainer{
    width:100%;
    height:100%;
    position: relative;
    flex: 1;
    min-height: 0;
    cursor: default;
  }
  
  /* 顶部菜单 - 与第一个模块保持一致 */
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
  
  /* 布局选择器样式 */
  .layout-selector, .depth-selector {
    display: flex;
    align-items: center;
  }
  
  .layout-select, .depth-select {
    min-width: 100px;
    height: 28px;
    padding: 0 8px;
    background-color: var(--menuColor);
    border: 1px solid var(--borderColor);
    border-radius: 4px;
    color: var(--fontColor);
    font-size: 14px;
    cursor: pointer;
    outline: none;
    transition: all 0.2s;
  }
  
  .layout-select:hover, .depth-select:hover {
    border-color: var(--primaryColor);
    background-color: var(--menuHoverColor);
  }
  
  .layout-select:focus, .depth-select:focus {
    border-color: var(--primaryColor);
    box-shadow: 0 0 0 2px rgba(var(--primaryColor-rgb, 0, 123, 255), 0.25);
  }
  
  .layout-select option, .depth-select option {
    background-color: var(--menuColor);
    color: var(--fontColor);
    padding: 8px;
  }
  
  .depth-select {
    min-width: 80px;
  }
  
  /* 右侧面板样式 */
  .panel{
    position: absolute;
    right: 0;
    top: 40px;
    height:calc(100% - 40px);
    width: 230px;
    background-color: var(--backgroundColor);
    border-left:1px solid var(--borderColor) ;
    overflow-y: auto;
    z-index: 10;
    opacity: 0.95;
    user-select: none;
  }
  
  .panel .scoll {
    padding: 10px;
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
  }
  
  td{
    font-size: 12px;
    padding: 4px 2px;
    border-bottom: 1px solid var(--borderColor);
  }
</style>