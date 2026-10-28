import { createApp } from 'vue'
import { createPinia } from 'pinia'
import {
  Button,
  Cell,
  CellGroup,
  DatePicker,
  Dialog,
  Empty,
  Field,
  Form,
  Icon,
  List,
  NavBar,
  Popup,
  Picker,
  PullRefresh,
  SwipeCell,
  Tab,
  Tabs,
  Tabbar,
  TabbarItem,
  Tag,
  Loading,
} from 'vant'
import 'vant/lib/index.css'

import App from './App.vue'
import router from './router'
import './styles/index.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)

;[
  Button,
  Cell,
  CellGroup,
  DatePicker,
  Dialog,
  Empty,
  Field,
  Form,
  Icon,
  List,
  NavBar,
  Popup,
  Picker,
  PullRefresh,
  SwipeCell,
  Tab,
  Tabs,
  Tabbar,
  TabbarItem,
  Tag,
  Loading,
].forEach((c) => app.use(c))

app.mount('#app')
