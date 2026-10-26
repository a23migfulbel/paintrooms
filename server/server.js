const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const io = new Server(PORT, {
  cors: { origin: CLIENT_ORIGIN },
});

// nombre de sala -> { strokes: [trazos], users: Map(id -> {username, color}), timer }
const rooms = new Map();

const COLORES = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#008080'];

// Fuerza un número entre 0 y 1 (si no es número, devuelve 0)
function limpiar(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

// Convierte el Map de usuarios en un array que viaja bien por la red
function userList(room) {
  const lista = [];
  room.users.forEach((datos, id) => {
    const usuario = {};
    usuario.id = id;
    usuario.username = datos.username;
    usuario.color = datos.color;
    lista.push(usuario);
  });
  return lista;
}

// Lista de salas activas para el Lobby
function listaDeSalas() {
  const lista = [];
  rooms.forEach((room, nombre) => {
    lista.push({ name: nombre, users: room.users.size });
  });
  return lista;
}

// Saca al socket de su sala (se usa en leave_room y en disconnect)
function salir(socket) {
  const roomName = socket.data.roomName;
  const room = rooms.get(roomName);
  if (!room) return;

  room.users.delete(socket.id);
  socket.leave(roomName);
  socket.data.roomName = null;
  socket.data.stroke = null;

  if (room.users.size === 0) {
    // La sala vacía espera 5 minutos antes de borrarse (para que F5 no pierda el dibujo)
    room.timer = setTimeout(() => {
      if (room.users.size === 0) {
        rooms.delete(roomName);
        io.emit('room_list', listaDeSalas());
      }
    }, 5 * 60 * 1000);
  } else {
    io.to(roomName).emit('room_users', userList(room));
  }
  io.emit('room_list', listaDeSalas());
}

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);

  // Nada más conectar, el Lobby necesita ver las salas
  socket.emit('room_list', listaDeSalas());

  socket.on('join_room', ({ roomName, username }, ack) => {
    roomName = String(roomName || '').trim().slice(0, 30);
    username = String(username || '').trim().slice(0, 20);
    if (!roomName || !username) {
      return ack({ ok: false, error: 'Nombre y sala obligatorios' });
    }

    salir(socket); // por si estaba en otra sala

    if (!rooms.has(roomName)) {
      rooms.set(roomName, { strokes: [], users: new Map(), timer: null });
    }
    const room = rooms.get(roomName);
    clearTimeout(room.timer); // cancela el borrado si estaba programado

    const color = COLORES[room.users.size % COLORES.length];
    room.users.set(socket.id, { username, color });

    socket.join(roomName);
    socket.data.roomName = roomName;
    socket.data.stroke = null;

    ack({
      ok: true,
      roomName: roomName,
      you: { id: socket.id, username: username, color: color },
      strokes: room.strokes, // estado inicial del canvas
      users: userList(room),
    });
    io.to(roomName).emit('room_users', userList(room));
    io.emit('room_list', listaDeSalas());
  });

  socket.on('leave_room', () => {
    salir(socket);
  });

  socket.on('cursor_move', ({ x, y }) => {
    const roomName = socket.data.roomName;
    if (roomName) {
      socket.to(roomName).emit('cursor_move', { id: socket.id, x: limpiar(x), y: limpiar(y) });
    }
  });

  socket.on('draw_begin', ({ x, y, color, width }) => {
    const roomName = socket.data.roomName;
    if (!roomName) return;
    const room = rooms.get(roomName);

    const trazo = {
      id: socket.id,
      color: color,
      width: width,
      points: [{ x: limpiar(x), y: limpiar(y) }],
    };
    room.strokes.push(trazo);    // guardado para quien llegue tarde
    socket.data.stroke = trazo;  // trazo en curso de este usuario

    socket.to(roomName).emit('draw_begin', {
      id: socket.id, x: limpiar(x), y: limpiar(y), color: color, width: width,
    });
  });

  socket.on('draw_move', ({ x, y }) => {
    const roomName = socket.data.roomName;
    if (!roomName || !socket.data.stroke) return;

    socket.data.stroke.points.push({ x: limpiar(x), y: limpiar(y) });
    socket.to(roomName).emit('draw_move', { id: socket.id, x: limpiar(x), y: limpiar(y) });
  });

  socket.on('draw_end', () => {
    const roomName = socket.data.roomName;
    if (!roomName) return;

    socket.data.stroke = null;
    socket.to(roomName).emit('draw_end', { id: socket.id });
  });

  socket.on('clear_canvas', () => {
    const roomName = socket.data.roomName;
    if (!roomName) return;

    rooms.get(roomName).strokes = [];
    io.to(roomName).emit('clear_canvas'); // a todos, incluido quien pulsa
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
    salir(socket);
  });
});

console.log(`Servidor escuchando en el puerto ${PORT}`);