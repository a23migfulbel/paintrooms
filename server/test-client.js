const { io } = require('socket.io-client')

const socket = io('http://localhost:3000')

socket.on('connect', () => {
    console.log('conectado con id', socket.id);

    socket.on('room_users', (users) => {
        console.log('Usuarios en la sala: ', users);
    })
    
    socket.emit('join_room', {roomName: 'Prova', username: 'Ana'}, (respuesta) => {
        console.log('El servidor respondio:', respuesta);
    });
});