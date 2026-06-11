const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');

app.use(express.static(__dirname)); 

const io = new Server(server, { cors: { origin: "*" } });

// التعديل هنا: استخدام البورت المتغير
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/clint.html');
});

io.on('connection', (socket) => {
    console.log('⚡ فيه جهاز جديد اتصل بالسيرفر:', socket.id);

    socket.on('new_order', (orderData) => {
        console.log('🍔 طلب جديد وصل للسيرفر:', orderData);
        io.emit('kitchen_receive', orderData);
    });

    socket.on('disconnect', () => {
        console.log('❌ جهاز فصل الاتصال:', socket.id);
    });
});

// التعديل هنا: التأكد إن السيرفر بيسمع على البورت المتغير
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});