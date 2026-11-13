<script setup lang="ts">
defineProps<{ class?: string }>()
</script>

<template><div class="skeleton" :class="$props.class" aria-hidden="true" /></template>
