<template>
  <div>
    初始化项目
    <Login></Login>
  </div>
</template>

<script>
import Login from '@/Login.vue'
export default {
  name: 'app',
  props: {},

  components: { Login },

  data() {
    return {}
  },

  computed: {},

  mounted() {
    console.log('%cRUNNING_AT:', 'color: #fff;background:#008000;padding: 0 10px;', ENV)
    console.log('%cBUILD_TIME:', 'color: #fff;background:#008000;padding: 0 10px;', BUILD_TIME)
  },

  methods: {},
}
</script>
<style scoped></style>
