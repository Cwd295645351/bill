import Vue from "vue"

import App from "./App.vue"

const vue = new Vue({ render: (h) => h(App) }).$mount("#app")

export default vue
