import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import DraftBanner from './DraftBanner.vue'

export default {
  extends: DefaultTheme,
  Layout: () => h(DefaultTheme.Layout, null, { 'doc-before': () => h(DraftBanner) }),
}
