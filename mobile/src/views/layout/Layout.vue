<template>
  <div class="layout-page-container">
    <div class="layout-header-container"></div>
    <div class="layout-context-container"></div>
    <div class="layout-footer-container"></div>
  </div>
</template>

<script setup lang="ts"></script>

<style scoped lang="scss">
.layout-page-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  .layout-header-container {
    width: 100%;
    height: 60px;
    background-color: #eee;
    box-shadow: 0 3px 3px #ddd;
  }
  .layout-footer-container {
    width: 100%;
    height: 60px;
    background-color: #eee;
    box-shadow: 0 -3px 3px #ddd;
  }
  .layout-context-container {
    flex: 1;
    width: 100%;
    min-height: 0;
  }
}
</style>
