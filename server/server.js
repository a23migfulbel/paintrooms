const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173'

const io = new Server(PORT, {
    cors: { origin: CLIENT_ORIGIN},
});

io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);

    socket.on('join_room', ({ roomName, username }, ack) => {
        socket.join(roomName);
        socket.data.roomName = roomName;
        socket.data.username = username;
        console.log(`${username} entro en la sala ${roomName}`);
        ack({ ok: true });
    });

    socket.on('disconnect', () => {
        console.log('Cliente desconectado', socket.id);
    })
})

console.log(`Servidor escuchando en el puerto ${PORT}`);



