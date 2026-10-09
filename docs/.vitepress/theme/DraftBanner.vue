<script setup>
import { useData } from 'vitepress'
const { frontmatter } = useData()
</script>

<template>
  <div v-if="frontmatter.status === 'draft'" class="custom-block warning">
    <p class="custom-block-title">Draft — not yet verified by the PayWay team</p>
    <p>
      Double-check details before relying on them.
      <a v-if="frontmatter.source" :href="frontmatter.source">See the official page.</a>
    </p>
  </div>
</template>
