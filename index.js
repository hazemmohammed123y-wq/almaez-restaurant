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

// رابط قاعدة البيانات الخاص بك
const mongoURI = "mongodb://mongo:jQMFmpjiXvMqKZeFosChJSDzcIxZOyZh@monorail.proxy.rlwy.net:27017";

mongoose.connect(mongoURI, {
    serverSelectionTimeoutMS: 8000 // زيادة وقت الانتظار لضمان استقرار الاتصال على ريلواي
})
.then(() => console.log('✅ تم الاتصال بنجاح بقاعدة بيانات MongoDB'))
.catch(err => {
    console.error('❌ خطأ في الاتصال بقاعدة البيانات:', err.message);
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

app.get('/kitchen.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'kitchen.html'));
});

app.get('/menu.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'menu.html'));
});

// مسار API إضافي كخطة بديلة آمنة تضمن جلب البيانات حتى لو علق السوكيت
app.get('/api/orders', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            const allOrders = await Order.find({});
            return res.json(allOrders);
        }
        res.json([]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

io.on('connection', async (socket) => {
    console.log('⚡ جهاز جديد اتصل بالسيرفر:', socket.id);

    // دالة جلب وإرسال الطلبات القديمة للمتصل
    const sendSavedOrders = async () => {
        try {
            if (mongoose.connection.readyState === 1) {
                const allOrders = await Order.find({});
                socket.emit('load_saved_orders', allOrders);
            }
        } catch (err) {
            console.log('خطأ في جلب الطلبات القديمة:', err);
        }
    };

    // جلب الطلبات فور الاتصال
    sendSavedOrders();

    // استقبال طلب جلب يدوي من المطبخ لضمان عدم الفشل عند الريفريش
    socket.on('request_orders_refresh', () => {
        sendSavedOrders();
    });

    // استقبال طلب جديد من العميل
    socket.on('new_order', async (orderData) => {
        console.log('🍔 طلب جديد وصل للسيرفر:', orderData);
        
        const now = new Date();
        const dateTimeString = now.toLocaleDateString('ar-EG') + ' - ' + now.toLocaleTimeString('ar-EG');

        let orderToSend = {
            _id: new mongoose.Types.ObjectId().toString(), 
            name: orderData.name,
            phone: orderData.phone,
            address: orderData.address,
            payment: orderData.payment,
            items: orderData.items,
            status: 'pending',
            date: dateTimeString
        };

        if (mongoose.connection.readyState === 1) {
            const newOrder = new Order(orderToSend);
            try {
                const savedOrder = await newOrder.save();
                orderToSend = savedOrder;
            } catch (err) {
                console.error('خطأ أثناء حفظ الطلب:', err);
            }
        }

        // إرسال للمطبخ لايف
        io.emit('kitchen_receive', orderToSend);
    });

    // تحديث حالة الطلب
    socket.on('update_order_status', async (data) => {
        if (mongoose.connection.readyState === 1) {
            try {
                await Order.findByIdAndUpdate(data.id, { status: data.status });
                console.log(`📦 تم تحديث حالة الطلب ${data.id} إلى ${data.status}`);
                // بث التحديث لكل الشاشات المفتوحة للمطبخ لمنع التضارب
                io.emit('order_status_updated_global', data);
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