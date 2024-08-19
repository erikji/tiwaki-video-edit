<script setup lang="ts">
</script>

<template>
    <div class="centered">
        <form method="post" action="/api/login" class="column">
            <label class="column">
                <p>Username</p>
                <input type="text" name="username">
            </label>
            <label class="column">
                <p>Password</p>
                <input type="password" name="password">
            </label>
            <input type="submit">
        </form>
    </div>
</template>

<style scoped>
p {
    text-align: start;
}
</style>