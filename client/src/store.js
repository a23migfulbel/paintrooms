import { reactive, markRaw } from 'vue';
import { socket } from './socket';

const KEY = 'paintrooms-session';

export const state = reactive({
  connected: false,
  me: null,
  roomName: null,
  users: [],
  rooms: [],
  strokes: [],
});

export function joinRoom(roomName, username) {
  return new Promise((resolve) => {
    socket.emit('join_room', { roomName, username }, (res) => {
      if (res && res.ok) {
        state.me = res.you;
        state.roomName = res.roomName;
        state.users = res.users;
        state.strokes = markRaw(res.strokes);
        sessionStorage.setItem(KEY, JSON.stringify({ roomName: res.roomName, username: res.you.username }));
      } else {
        sessionStorage.removeItem(KEY);
      }
      resolve(res);
    });
  });
}

export function leaveRoom() {
  socket.emit('leave_room');
  sessionStorage.removeItem(KEY);
  state.roomName = null;
  state.me = null;
  state.users = [];
}

// Al conectar (y al reconectar o tras F5) volvemos a entrar en la sala guardada
socket.on('connect', async () => {
  state.connected = true;
  const saved = JSON.parse(sessionStorage.getItem(KEY) || 'null');
  if (saved) await joinRoom(saved.roomName, saved.username);
});
socket.on('disconnect', () => { state.connected = false; });
socket.on('room_users', (users) => { state.users = users; });
socket.on('room_list', (list) => { state.rooms = list; });