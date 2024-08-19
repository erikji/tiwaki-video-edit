<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'

const route = useRoute();
const router = useRouter();
onMounted(async () => {
  await router.isReady();
  const res = await fetch('api/check');
  if (!res.ok) {
    if (res.status == 401) {
      router.push({ name: 'login' });
    }
  }
})
</script>

<template>
  <nav v-if="route.name != 'login'">
    <RouterLink :to="{ name: 'home' }">Home</RouterLink>
    <RouterLink :to="{ name: 'shuffle' }">Shuffle</RouterLink>
  </nav>
  <RouterView />
</template>

<style scoped>
nav {
  width: 100%;
}

nav a {
  padding: 0 1rem;
}
</style>
