<template>
  <div class="main">
    <div style="display: flex;">
      <input v-model="url" type="text" placeholder="Enter URL">
      <button @click="navigate">Go</button>
      <button @click="back">></button>
      <button @click="forward"><</button>
    </div>
    <iframe ref="iframe" style="width: calc(100% - 2px); height: calc(100vh - 36px); border: 1px solid #ccc;"></iframe>
  </div>
</template>
<style>
.iframe {
  width: 100%;
  height: 80vh;
  border: none; /* 去掉边框 */
}
</style>
<script setup lang="ts">
  import { ref ,reactive,watch,onMounted, onBeforeUnmount} from 'vue'
  import {usestore} from '../../store'
  const store=usestore()
  let url = ref('https://m.inftab.com')
  let iframe = ref(null) as any
    const navigate = function() {
      // 在这里可以添加校验URL的逻辑
      // 如果URL不合法，可以给出提示

      // 更新iframe的src
      iframe.src = url.value;
    }
    const back = function() {
      // 后退一个页面
      window.history.back();

      // 更新url和iframe的src
      url.value = window.location.href;
      iframe.src = url.value;
    }
    const forward = function() {
      // 前进一个页面
      window.history.forward();
      // 更新url和iframe的src
      url.value = window.location.href;
      iframe.src = url.value;
    }
</script>
