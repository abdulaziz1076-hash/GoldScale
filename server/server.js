const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// 1. إعدادات API (ضع مفتاحك هنا)
// ============================================================
const METALS_API_KEY = "AVBQopOokaYlq3OUGPztnJcPXU66AbtsyS1Q4Goq";
const METALS_API_URL = `https://api.metals-api.com/api/latest?access_key=${METALS_API_KEY}&base=USD&symbols=XAU`;
const FALLBACK_PRICE = 4082; // سعر احتياطي في حال تعذر الاتصال

// ============================================================
// 2. متغيرات التخزين المؤقت (الأسعار المخزنة في ذاكرة الخادم)
// ============================================================
let cachedPrice = {
    usd: FALLBACK_PRICE,
    lastUpdated: new Date().toISOString(),
    status: 'pending'
};

// ============================================================
// 3. دالة جلب السعر من API
// ============================================================
async function fetchAndStorePrice() {
    try {
        console.log('⏳ جاري تحديث السعر من Metals-API...');
        const response = await fetch(METALS_API_URL);
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        
        const data = await response.json();
        let price = parseFloat(data.rates?.XAU);
        
        if (!price || price <= 0) {
            throw new Error('قيمة السعر غير صالحة');
        }
        
        // إذا كانت القيمة أقل من 1، فهي معكوسة (نأخذ المقلوب)
        if (price < 1) {
            price = 1 / price;
        }
        
        cachedPrice = {
            usd: price,
            lastUpdated: new Date().toISOString(),
            status: 'success'
        };
        
        console.log(`✅ تم تحديث السعر: $${price} (${cachedPrice.lastUpdated})`);
    } catch (error) {
        console.error('❌ فشل جلب السعر:', error.message);
        // لا نغير السعر المخزن، نترك القديم
        cachedPrice.status = 'failed';
        cachedPrice.lastUpdated = new Date().toISOString();
    }
}

// ============================================================
// 4. تشغيل المهمة المجدولة (كل 10 دقائق)
// ============================================================
// جلب السعر فور تشغيل الخادم
fetchAndStorePrice();

// جدولة تحديث كل 10 دقائق
cron.schedule('*/10 * * * *', () => {
    fetchAndStorePrice();
});

console.log('⏰ تم جدولة تحديث السعر كل 10 دقائق');

// ============================================================
// 5. تشغيل خادم Express
// ============================================================
app.use(cors());
app.use(express.json());

// نقطة النهاية لجلب السعر (يستخدمها الكود الأمامي)
app.get('/api/price', (req, res) => {
    res.json({
        success: true,
        data: cachedPrice
    });
});

// نقطة النهاية للتحقق من صحة الخادم
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// الصفحة الرئيسية (اختياري)
app.get('/', (req, res) => {
    res.send(`
        <h1>🚀 خادم أسعار الذهب يعمل بنجاح</h1>
        <p>آخر تحديث: ${cachedPrice.lastUpdated}</p>
        <p>سعر الأونصة: $${cachedPrice.usd}</p>
        <p>الحالة: ${cachedPrice.status}</p>
        <hr />
        <p>استخدم نقطة النهاية <code>/api/price</code> للحصول على البيانات بصيغة JSON.</p>
    `);
});

app.listen(PORT, () => {
    console.log(`✅ الخادم يعمل على المنفذ ${PORT}`);
});
