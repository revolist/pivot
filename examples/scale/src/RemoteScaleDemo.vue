<template><div ref="host" class="pivot-scale-embed" /></template>
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { mountRemoteScaleDemo } from './remote-demo';
const host = ref<HTMLElement | null>(null);
let cleanup: (() => void) | undefined;
onMounted(() => { if (host.value) cleanup = mountRemoteScaleDemo(host.value); });
onBeforeUnmount(() => cleanup?.());
</script>
