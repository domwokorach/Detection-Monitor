<script setup lang="ts">
import { Construction } from 'lucide-vue-next'
import { page } from '@/stores/app'
import EmptyState from '@/components/ui/EmptyState.vue'
</script>
<template>
  <div class="glass rounded-lg p-6">
    <EmptyState :icon="Construction" :title="`${page[0].toUpperCase()}${page.slice(1)} is not built yet`" body="This area is not part of the current release. Overview, Alerts, Transactions, Risk Scoring, Investigations and Compliance are live." />
  </div>
</template>
