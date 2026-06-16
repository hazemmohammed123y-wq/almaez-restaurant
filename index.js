const express = require('express');
const app = express();
const http = require('http');
const path = require('path'); 
const server = http.createServer(app);
const { Server } = require('socket.io');
const mongoose = require('mongoose'); 

const io = new Server(server, {
    cors: {
        origin: "*", 
    }
});

// الرابط المتغير: جربنا هنا نستخدم الرابط اللي إنت بعته
const mongoURI = "mongodb://mongo:jQMFmpjiXvMqKZeFosChJSDzcIxZOyZh@mongodb.railway.internal:27017";

mongoose.connect(mongoURI, {
    serverSelectionTimeoutMS: 5000 // لو معرفش يتصل في خلال 5 ثواني ميعلقش السيرفر
})
.then(() => console.log('✅ تم الاتصال بنجاح بقاعدة بيانات MongoDB'))
.catch(err => {
    console.error('❌❌ خطأ كبير في الاتصال بقاعدة البيانات:', err.message);
    console.log('⚠️ السيرفر هيشتغل عادي دلوقتي بس البيانات مش هتحفظ لحد ما نحل رابط الداتابيز.');
});

const OrderSchema = new mongoose.Schema({
    name: String,
    phone: String,
    address: String,
    payment: String,
    items: Array,
    status: { type: String, default: 'pending' }, 
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

io.on('connection', async (socket) => {
    console.log('⚡ فيه جهاز جديد اتصل بالسيرفر:', socket.id);

    // جلب الطلبات القديمة لو الداتابيز شغالة
    try {
        if (mongoose.connection.readyState === 1) {
            const allOrders = await Order.find({});
            socket.emit('load_saved_orders', allOrders);
        }
    } catch (err) {
        console.log('خطأ في جلب الطلبات القديمة:', err);
    }

    // استقبال طلب جديد
    socket.on('new_order', async (orderData) => {
        console.log('🍔 طلب جديد وصل للسيرفر:', orderData);
        
        const now = new Date();
        const dateTimeString = now.toLocaleDateString('ar-EG') + ' - ' + now.toLocaleTimeString('ar-EG');

        // تجهيز بيانات الطلب لتقديمه لايف حتى لو الداتابيز فيها مشكلة
        let orderToSend = {
            _id: new mongoose.Types.ObjectId().toString(), // كود مؤقت
            name: orderData.name,
            phone: orderData.phone,
            address: orderData.address,
            payment: orderData.payment,
            items: orderData.items,
            status: 'pending',
            date: dateTimeString
        };

        // لو الداتابيز متصلة، احفظ فيها
        if (mongoose.connection.readyState === 1) {
            const newOrder = new Order(orderToSend);
            try {
                const savedOrder = await newOrder.save();
                orderToSend = savedOrder;
            } catch (err) {
                console.error('خطأ أثناء حفظ الطلب في الداتابيز:', err);
            }
        }

        // إرسال للمطبخ فوراً (لايف)
        io.emit('kitchen_receive', orderToSend);
    });

    socket.on('update_order_status', async (data) => {
        if (mongoose.connection.readyState === 1) {
            try {
                await Order.findByIdAndUpdate(data.id, { status: data.status });
                console.log(`📦 تم تحديث حالة الطلب ${data.id} إلى ${data.status}`);
            } catch (err) {
                console.error('خطأ في تحديث حالة الطلب:', err);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('❌ جهاز فصل الاتصال:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});