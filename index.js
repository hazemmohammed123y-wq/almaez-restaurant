const express = require('express');
const app = express();
const http = require('http');
const path = require('path'); // ضفنا الـ path علشان المسارات تتظبط على السيرفر
const server = http.createServer(app);
const { Server } = require('socket.io');

const io = new Server(server, {
    cors: {
        origin: "*", // بيسمح لأي جهاز يتصل بالـ Socket بدون مشاكل حماية
    }
});

// 1. السطر ده مهم جداً: بيخلي Express يشوف الصور وملفات الـ CSS والـ JS اللي في مشروعك
app.use(express.static(path.join(__dirname))); 

// 2. تحديد البورت المتغير عشان السيرفر الخارجي يعرف يشغله
const PORT = process.env.PORT || 3000;

// 3. مسار الصفحة الرئيسية (الصفحة اللي بتفتح أول ما تدخل اللينك)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'clint.html')); // تأكد إن اسم الملف clint.html بالظبط عندك
});

// 4. مسار المنيو (علشان لما تدوس "طلب الآن" يفتح معاك وميجيبش Cannot GET /menu.html)
app.get('/menu.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'menu.html'));
});

// 5. شغل الـ Socket.io بتاعك زي ما هو
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

// 6. تشغيل السيرفر بالبورت المظبوط
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});