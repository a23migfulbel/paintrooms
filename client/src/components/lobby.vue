<script setup>
import { ref } from 'vue';
import { state, joinRoom } from '../store';

const username = ref('');
const roomName = ref('');
const error = ref('');
const loading = ref(false);

async function enter() {
  error.value = '';
  loading.value = true;
  const res = await joinRoom(roomName.value, username.value);
  loading.value = false;
  if (!res || !res.ok) error.value = (res && res.error) || 'No se pudo entrar';
}
</script>

<template>
  <main class="lobby">
    <h1>🎨 PaintRooms</h1>

    <form @submit.prevent="enter">
      <label>Tu nombre
        <input v-model="username" maxlength="20" required placeholder="Ana" />
      </label>
      <label>Sala (si no existe, se crea)
        <input v-model="roomName" maxlength="30" required placeholder="Prova" />
      </label>
      <button :disabled="loading || !state.connected">Entrar / crear sala</button>
      <p v-if="error" class="error">{{ error }}</p>
    </form>

    <h2>Salas activas</h2>
    <p v-if="!state.rooms.length" class="muted">Aún no hay salas. ¡Crea la primera!</p>
    <ul class="room-list">
      <li v-for="r in state.rooms" :key="r.name">
        <button type="button" @click="roomName = r.name">{{ r.name }}</button>
        <span class="muted">{{ r.users }} usuario(s)</span>
      </li>
    </ul>
  </main>
</template>