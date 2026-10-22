const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173'

const io = new Server(PORT, {
    cors: { origin: CLIENT_ORIGIN},
});

const rooms = new Map();

io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);

    socket.on('join_room', ({ roomName, username }, ack) => {
        socket.join(roomName);
        socket.data.roomName = roomName;
        socket.data.username = username;
        console.log(`${username} entro en la sala ${roomName}`);
        

        /*la logica de este map es que si rooms no tiene nombre
        le añade un nombre y dentro del roomname crea un objeto mas
        donde guardas un array Stroke(Trazos) y  otro map para los usuarios,
        entonces al decirle a la constante que guarde el objeto de esa sala tambien
        adopta el objeto de roomName.
        */
        if (!rooms.has(roomName)) {
            rooms.set(roomName, { strokes: [], users: new Map()});
        }
        const room = rooms.get(roomName);
        room.users.set(socket.id, { username });

        console.log('Salas: ', JSON.stringify([...rooms], null, 2));
        ack({ ok: true });
    });

    socket.on('disconnect', () => {
        console.log('Cliente desconectado', socket.id);

        const room = rooms.get(socket.data.roomName);
        if (room) {
            room.users.delete(socket.id);
        }

        if( room.users.size === 0){
            rooms.delete(socket.data.roomName);  
        }

        console.log('Salas: ', JSON.stringify([...rooms], null, 2));
    })
})

console.log(`Servidor escuchando en el puerto ${PORT}`);



