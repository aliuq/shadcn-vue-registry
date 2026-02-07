<script setup lang="ts">
/**
 * Test page component — exercises the `registry:page` type.
 * target is REQUIRED for registry:page.
 */
defineProps<{
  title?: string
}>()
</script>

<template>
  <div class="container mx-auto py-8">
    <h1 class="text-3xl font-bold">
      {{ title ?? 'Chat Page' }}
    </h1>
    <p class="text-muted-foreground mt-2">
      A sample chat page for testing the registry:page type.
    </p>
  </div>
</template>
