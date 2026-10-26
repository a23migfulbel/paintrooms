<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { socket } from '../socket';
import { state, leaveRoom } from '../store';

const W = 1200; // resolución interna fija del canvas
const H = 700;

const canvas = ref(null);
let ctx = null;

const color = ref(state.me.color);
const width = ref(4);
const cursors = ref({}); // id -> { x, y } (0..1)

let drawing = false;
let last = null;
let pen = null;
const remoteLast = new Map(); // id -> último punto + estilo de cada usuario remoto
let lastCursorSent = 0;

const others = computed(() => state.users.filter((u) => u.id !== state.me.id));

function drawSegment(from, to, c, w) {
  ctx.strokeStyle = c;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(from.x * W, from.y * H);
  ctx.lineTo(to.x * W, to.y * H);
  ctx.stroke();
}

function redraw(strokes) {
  ctx.clearRect(0, 0, W, H);
  remoteLast.clear();
  for (const s of strokes) {
    let prev = s.points[0];
    drawSegment(prev, prev, s.color, s.width);
    for (let i = 1; i < s.points.length; i++) {
      drawSegment(prev, s.points[i], s.color, s.width);
      prev = s.points[i];
    }
  }
}

function getPoint(e) {
  const r = canvas.value.getBoundingClientRect();
  return {
    x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
    y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
  };
}

function onDown(e) {
  if (e.button !== 0) return;
  canvas.value.setPointerCapture(e.pointerId);
  drawing = true;
  pen = { color: color.value, width: width.value };
  const p = getPoint(e);
  last = p;
  drawSegment(p, p, pen.color, pen.width);
  socket.emit('draw_begin', { ...p, ...pen });
}

function onMove(e) {
  const p = getPoint(e);

  const now = performance.now();
  if (now - lastCursorSent > 30) {
    lastCursorSent = now;
    socket.emit('cursor_move', p);
  }

  if (!drawing) return;
  drawSegment(last, p, pen.color, pen.width);
  last = p;
  socket.emit('draw_move', p);
}

function onUp() {
  if (!drawing) return;
  drawing = false;
  last = null;
  socket.emit('draw_end');
}

function clearCanvas() {
  socket.emit('clear_canvas');
}

function onRemoteBegin({ id, x, y, color: c, width: w }) {
  remoteLast.set(id, { x, y, color: c, width: w });
  drawSegment({ x, y }, { x, y }, c, w);
}

function onRemoteMove({ id, x, y }) {
  const prev = remoteLast.get(id);
  if (!prev) return;
  drawSegment(prev, { x, y }, prev.color, prev.width);
  remoteLast.set(id, { ...prev, x, y });
}

function onRemoteEnd({ id }) {
  remoteLast.delete(id);
}

function onRemoteCursor({ id, x, y }) {
  cursors.value[id] = { x, y };
}

function onClear() {
  ctx.clearRect(0, 0, W, H);
  remoteLast.clear();
}

onMounted(() => {
  ctx = canvas.value.getContext('2d');
  redraw(state.strokes);

  socket.on('draw_begin', onRemoteBegin);
  socket.on('draw_move', onRemoteMove);
  socket.on('draw_end', onRemoteEnd);
  socket.on('cursor_move', onRemoteCursor);
  socket.on('clear_canvas', onClear);
});

onBeforeUnmount(() => {
  socket.off('draw_begin', onRemoteBegin);
  socket.off('draw_move', onRemoteMove);
  socket.off('draw_end', onRemoteEnd);
  socket.off('cursor_move', onRemoteCursor);
  socket.off('clear_canvas', onClear);
});

watch(() => state.strokes, (s) => redraw(s));
</script>

<template>
  <div class="room">
    <header>
      <h2>Sala: {{ state.roomName }}</h2>
      <button @click="leaveRoom">Salir</button>
    </header>

    <div class="layout">
      <div class="board">
        <canvas
          ref="canvas"
          :width="W"
          :height="H"
          @pointerdown="onDown"
          @pointermove="onMove"
          @pointerup="onUp"
          @pointercancel="onUp"
        ></canvas>

        <template v-for="u in others" :key="u.id">
          <div
            v-if="cursors[u.id]"
            class="cursor"
            :style="{ left: cursors[u.id].x * 100 + '%', top: cursors[u.id].y * 100 + '%', '--c': u.color }"
          >
            <span>{{ u.username }}</span>
          </div>
        </template>
      </div>

      <aside>
        <section>
          <h3>Usuarios ({{ state.users.length }})</h3>
          <ul>
            <li v-for="u in state.users" :key="u.id">
              <span class="dot" :style="{ '--c': u.color }"></span>
              {{ u.username }}<span v-if="u.id === state.me.id" class="muted">(tú)</span>
            </li>
          </ul>
        </section>

        <section>
          <h3>Pincel</h3>
          <label>Color <input type="color" v-model="color" /></label>
          <label>Grosor: {{ width }} <input type="range" min="1" max="30" v-model.number="width" /></label>
          <button @click="clearCanvas">🗑️ Limpiar pizarra</button>
        </section>
      </aside>
    </div>
  </div>
</template>