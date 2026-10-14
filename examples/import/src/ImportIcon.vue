<template><span class="import-icon" aria-hidden="true" v-html="icons[name]" /></template>
<script setup lang="ts">
import table from '@fortawesome/fontawesome-free/svgs/solid/table-cells-large.svg?raw';
import file from '@fortawesome/fontawesome-free/svgs/solid/file-excel.svg?raw';
import upload from '@fortawesome/fontawesome-free/svgs/solid/arrow-up-from-bracket.svg?raw';
import lock from '@fortawesome/fontawesome-free/svgs/solid/lock.svg?raw';
import chart from '@fortawesome/fontawesome-free/svgs/solid/chart-column.svg?raw';
import arrow from '@fortawesome/fontawesome-free/svgs/solid/arrow-right.svg?raw';
import reset from '@fortawesome/fontawesome-free/svgs/solid/arrow-rotate-left.svg?raw';
import close from '@fortawesome/fontawesome-free/svgs/solid/xmark.svg?raw';
import check from '@fortawesome/fontawesome-free/svgs/solid/check.svg?raw';
import download from '@fortawesome/fontawesome-free/svgs/solid/download.svg?raw';
import fields from '@fortawesome/fontawesome-free/svgs/solid/list-check.svg?raw';
const icons = { table, file, upload, lock, chart, arrow, reset, close, check, download, fields };
defineProps<{ name: keyof typeof icons }>();
</script>
