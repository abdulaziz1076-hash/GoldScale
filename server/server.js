const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// 🔑 مفتاح GoldAPI.io الجديد
// ============================================================
const GOLD_API_KEY = "goldapi-2d5254b3e470938e18dce7629c4ca41f-io";
const GOLD_API_URL = `https://www.goldapi.io/api/XAU/USD`;

// ============================================================
// تخزين السعر في الذاكرة
// ============================================================
let cachedPrice = {
    usd: 4082,
    lastUpdated: new Date().toISOString(),
    status: 'pending'
};

// ============================================================
// دالة جلب السعر من GoldAPI.io
// ============================================================
async function fetchAndStorePrice() {
    try {
        console.log('⏳ جاري تحديث السعر من GoldAPI.io...');
        
        const response = await fetch(GOLD_API_URL, {
            headers: {
                'x-access-token': GOLD_API_KEY,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('📦 البيانات المستلمة:', JSON.stringify(data).substring(0, 200) + '...');
        
        // GoldAPI.io يعيد السعر في "price"
        let price = parseFloat(data.price);
        
        if (!price || price <= 0) {
            throw new Error('قيمة السعر غير صالحة');
        }
        
        cachedPrice = {
            usd: price,
            lastUpdated: new Date().toISOString(),
            status: 'success'
        };
        
        console.log(`✅ تم تحديث السعر: $${price} (${cachedPrice.lastUpdated})`);
    } catch (error) {
        console.error('❌ فشل جلب السعر:', error.message);
        cachedPrice.status = 'failed';
        cachedPrice.lastUpdated = new Date().toISOString();
        cachedPrice.error = error.message;
    }
}

// ============================================================
// جدولة التحديث (كل 10 دقائق)
// ============================================================
fetchAndStorePrice();
cron.schedule('*/10 * * * *', () => {
    fetchAndStorePrice();
});

console.log('⏰ تم جدولة تحديث السعر كل 10 دقائق');

// ============================================================
// نقاط النهاية (Endpoints)
// ============================================================
app.use(cors());
app.use(express.json());

app.get('/api/price', (req, res) => {
    res.json({
        success: true,
        data: cachedPrice
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        lastPrice: cachedPrice
    });
});

app.get('/', (req, res) => {
    res.send(`
        <h1>🚀 خادم أسعار الذهب يعمل بنجاح</h1>
        <p>آخر تحديث: ${cachedPrice.lastUpdated}</p>
        <p>سعر الأونصة: $${cachedPrice.usd}</p>
        <p>الحالة: ${cachedPrice.status}</p>
        ${cachedPrice.error ? `<p style="color:red;">⚠️ خطأ: ${cachedPrice.error}</p>` : ''}
        <hr />
        <p>استخدم نقطة النهاية <code>/api/price</code> للحصول على البيانات بصيغة JSON.</p>
    `);
});

app.listen(PORT, () => {
    console.log(`✅ الخادم يعمل على المنفذ ${PORT}`);
});
