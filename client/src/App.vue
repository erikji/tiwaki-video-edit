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
  <div class="wrapperOuter">
    <div class="wrapperInner">
      <div class="row" v-if="route.name != 'login'">
        <nav>
          <RouterLink :to="{ name: 'home' }">Home</RouterLink>
          <RouterLink :to="{ name: 'shuffle' }">Shuffle</RouterLink>
          <RouterLink :to="{ name: 'extract' }">Extract</RouterLink>
          <RouterLink :to="{ name: 'trim' }">Trim</RouterLink>
        </nav>
        <form method="post" action="/api/logout">
          <input type="submit" value="LOGOUT"/>
        </form>
      </div>
      <RouterView />
    </div>
  </div>
</template>

<style scoped>
.wrapperOuter {
  padding: 16px;
  width: 100%;
  min-height: 100%;
  background-image: radial-gradient(circle at 91.26302083333333% 88.78255208333333%, #6653E5 0%, 20%, rgba(102,83,229,0) 40%), radial-gradient(circle at 6.503906249999999% 88.037109375%, rgba(27,72,128,0.99) 0%, 25%, rgba(27,72,128,0) 50%), radial-gradient(circle at 3.5937499999999996% 22.373046875%, #BDE9FB 0%, 42%, rgba(189,233,251,0) 70%), radial-gradient(circle at 68.35611979166667% 17.96875%, #2DB6D4 0%, 42%, rgba(45,182,212,0) 70%), radial-gradient(circle at 48.9013671875% 49.521484375%, #F8FCFF 0%, 100%, rgba(248,252,255,0) 100%);
  box-sizing: border-box;
}

.wrapperInner {
  width: 100%;
  height: 100%;
  /* backdrop-filter: dbrop(10%); */
}

nav {
  width: 100%;
}

nav a {
  padding: 0 1rem;
}

form input {
  font-size: larger;
}
</style>
