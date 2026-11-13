import { createApp } from 'vue'
import App from './App.vue'
import { captureBankCallback, restoreSession } from './stores/app'
import './stores/theme'
import './style.css'

captureBankCallback()
createApp(App).mount('#app')
void restoreSession()
