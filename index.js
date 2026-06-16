const express = require('express');
const app = express();
const http = require('http');
const path = require('path'); 
const server = http.createServer(app);
const { Server } = require('socket.io');
const mongoose = require('mongoose'); // استدعاء مكتبة قاعدة البيانات

const io = new Server(server, {
    cors: {
        origin: "*", 
    }
});

// الربط بقاعدة بيانات MongoDB على ريلواي باستخدام الرابط بتاعك
const mongoURI = "mongodb://mongo:jQMFmpjiXvMqKZeFosChJSDzcIxZOyZh@mongodb.railway.internal:27017";
mongoose.connect(mongoURI)
  .then(() => console.log('✅ تم الاتصال بنجاح بقاعدة بيانات MongoDB على ريلواي'))
  .catch(err => console.error('❌ خطأ في الاتصال بقاعدة البيانات:', err));

// تصميم شكل (Schema) حفظ الطلب في قاعدة البيانات
const OrderSchema = new mongoose.Schema({
    name: String,
    phone: String,
    address: String,
    payment: String,
    items: Array,
    status: { type: String, default: 'pending' }, // pending = في المطبخ، done = تم التحضير
    date: { type: String }
});

const Order = mongoose.model('Order', OrderSchema);

app.use(express.static(path.join(__dirname))); 

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'clint.html')); 
});

app.get('/menu.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'menu.html'));
});

// الـ Sockets
io.on('connection', async (socket) => {
    console.log('⚡ فيه جهاز جديد اتصل بالسيرفر:', socket.id);

    // أول ما شاشة المطبخ تفتح، السيرفر بيبعتلها كل الطلبات المتخزنة علطول
    try {
        const allOrders = await Order.find({});
        socket.emit('load_saved_orders', allOrders);
    } catch (err) {
        console.log('خطأ في جلب الطلبات القديمة:', err);
    }

    // استقبال طلب جديد من الزبون
    socket.on('new_order', async (orderData) => {
        console.log('🍔 طلب جديد وصل للسيرفر:', orderData);
        
        const now = new Date();
        const dateTimeString = now.toLocaleDateString('ar-EG') + ' - ' + now.toLocaleTimeString('ar-EG');

        // حفظ الطلب في قاعدة البيانات أول ما يوصل
        const newOrder = new Order({
            name: orderData.name,
            phone: orderData.phone,
            address: orderData.address,
            payment: orderData.payment,
            items: orderData.items,
            status: 'pending',
            date: dateTimeString
        });

        try {
            const savedOrder = await newOrder.save();
            // بنبعت الطلب للمطبخ ومعاه الـ ID بتاعه من قاعدة البيانات عشان نعرف نعدله بعدين
            io.emit('kitchen_receive', savedOrder);
        } catch (err) {
            console.error('خطأ أثناء حفظ الطلب:', err);
        }
    });

    // تحديث حالة الطلب لما المطبخ يدوس "تم التحضير"
    socket.on('update_order_status', async (data) => {
        try {
            await Order.findByIdAndUpdate(data.id, { status: data.status });
            console.log(`📦 تم تحديث حالة الطلب ${data.id} إلى ${data.status}`);
        } catch (err) {
            console.error('خطأ في تحديث حالة الطلب:', err);
        }
    });

    socket.on('disconnect', () => {
        console.log('❌ جهاز فصل الاتصال:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});