<script setup>
import { state } from './store';
import Lobby from './components/Lobby.vue';
import Room from './components/Room.vue';
</script>

<template>
  <div v-if="!state.connected" class="banner">Conectando con el servidor…</div>
  <Room v-if="state.roomName" />
  <Lobby v-else />
</template>