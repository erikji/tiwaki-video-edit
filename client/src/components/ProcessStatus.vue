<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

const props = defineProps<{
    status?: string,
    error?: string,
    percentage?: number //0-100
}>();

let dots = ref<string>('.');
let interval: NodeJS.Timeout;
onMounted(() => {
    interval = setInterval(() => {
        if (dots.value == '...') {
            dots.value = '.';
        } else {
            dots.value += '.';
        }
    }, 1000);
})

onUnmounted(() => {
    clearInterval(interval);
});
</script>

<script lang="ts">
</script>

<template>
    <p v-if="!error && status">{{ status }}{{ dots }} {{ percentage ? percentage + '%' : '' }}</p>
    <p class="error" v-if="error">{{ error }}</p>
</template>

<style scoped>
p {
    margin: 0;
}

.error {
    color: red;
}
</style>