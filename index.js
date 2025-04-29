const { Telegraf } = require('telegraf');

const axios = require('axios');

const express = require('express');

const EventEmitter = require('events');

require('dotenv').config();

// افزایش محدودیت شنونده‌ها (برای پروژه‌های بزرگ‌تر)

EventEmitter.defaultMaxListeners = 20;

// متغیر ردیابی خطای آخر

let lastError = null;

// 1. سرور Express برای پینگ

const app = express();

app.get('/ping', (req, res) => {

  res.send('پینگ دریافت شد!');

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(`سرور Express روی پورت ${PORT} اجرا شد.`);

});

// 2. اعلان به ادمین

async function notifyAdmin(message) {

  try {

    await bot.telegram.sendMessage(process.env.ADMIN_ID, message, {

      parse_mode: 'HTML',

    });

    console.log('نوتیفیکیشن به ادمین ارسال شد:', message);

  } catch (error) {

    console.error('خطا در ارسال نوتیفیکیشن:', error.message);

  }

}

// 3. پینگ خودکار با axios

async function pingSelf() {

  const url = process.env.GLITCH_URL || 'https://YOUR_GLITCH_PROJECT.glitch.me/ping';

  console.log('اجرای pingSelf با axios');

  try {

    const response = await axios.get(url, {

      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MyBot/1.0)' },

      timeout: 5000,

      validateStatus: () => true,

    });

    if (response.status === 200) {

      console.log('پاسخ موفق پینگ:', response.data);

      lastError = null;

    } else {

      const errorMsg = `پینگ ناموفق بود: کد وضعیت ${response.status}`;

      console.error(errorMsg);

      if (lastError !== errorMsg) {

        lastError = errorMsg;

        await notifyAdmin(`<b>⚠️ پینگ ناموفق بود:</b>\nکد وضعیت: ${response.status}`);

      }

    }

  } catch (error) {

    console.error('خطا در پینگ:', error.message);

    if (lastError !== error.message) {

      lastError = error.message;

      await notifyAdmin(`<b>⚠️ خطا در پینگ:</b>\n${error.message}`);

    }

  }

}

// 4. زمان‌بندی پینگ هر 5 دقیقه

setInterval(async () => {

  console.log('ارسال پینگ دوره‌ای...');

  try {

    await pingSelf();

  } catch (err) {

    console.error('تلاش پینگ ناموفق بود، تلاش دوباره...');

    setTimeout(() => pingSelf(), 30000);

  }

}, 5 * 60 * 1000);

// 5. دریافت قیمت USDT از نوبیتکس

async function getUsdtPrice() {

  try {

    const res = await axios.get('https://api.nobitex.ir/v2/orderbook/USDTIRT', {

      timeout: 5000,

      headers: { Connection: 'close' },

    });

    const data = res.data;

    if (data.asks && Array.isArray(data.asks)) {

      return Math.floor(parseFloat(data.asks[0][0]) / 10); // حذف یک صفر (تبدیل به تومان)

    }

  } catch (err) {

    console.error('❌ خطا در دریافت قیمت:', err.message);

  }

  return null;

}

// 6. آپدیت بیو گروه

async function updateBio() {

  const chatId = process.env.CHAT_ID;

  let lastPrice = null;

  while (true) {

    const price = await getUsdtPrice();

    // ساعت با تایم ایران

    const now = new Date();

    now.setHours(now.getHours() + 3);

    now.setMinutes(now.getMinutes() + 30);

    const timeStr = now.toLocaleTimeString('fa-IR', {

      hour: '2-digit',

      minute: '2-digit',

      hour12: false,

    });

    let bio;

    if (price === null) {

      bio = `❌ خطا در دریافت قیمت - ${timeStr}`;

    } else {

      const trend = (lastPrice !== null)

        ? (price > lastPrice ? '📈' : price < lastPrice ? '📉' : '〰️')

        : '';

      lastPrice = price;

      const priceStr = price.toLocaleString('fa-IR');

      bio = `${trend}  دلار: ${priceStr} تومان - ${timeStr} ⏰\n \n 💈 @KoreaMixPlus 💈 ㅤㅤㅤ`;

    }

    try {

      await bot.telegram.setChatDescription(chatId, bio);

      console.log(`بیو آپدیت شد: ${bio}`);

    } catch (err) {

      console.error('خطا در آپدیت بیو:', err.message);

      await notifyAdmin(`<b>⚠️ خطا در آپدیت بیو:</b>\n${err.message}`);

    }

    await new Promise((resolve) => setTimeout(resolve, 120000)); // هر 2 دقیقه

  }

}

// 7. تنظیمات ربات

const TOKEN = process.env.BOT_TOKEN;

if (!TOKEN) {

  console.error('توکن ربات تنظیم نشده!');

  process.exit(1);

}

const bot = new Telegraf(TOKEN);

// 8. فرمان /start

bot.start((ctx) => {

  ctx.reply(

    '🤖 سلام!\nمن قیمت لحظه‌ای دلار رو به‌صورت خودکار در بیو گروه آپدیت می‌کنم!\n@KoreaMixGp',

    { parse_mode: 'HTML' }

  );

});

// 9. مدیریت خطا

bot.catch((err, ctx) => {

  console.error('خطای عمومی:', err.message, 'در:', ctx.updateType);

  if (ctx) {

    ctx.reply('⚠️ مشکلی پیش اومده، لطفاً دوباره امتحان کن.');

  }

});

// 10. اجرای ربات

bot.launch().then(() => {

  console.log('🤖 ربات فعال شد!');

  pingSelf(); // اجرای اولیه

  updateBio(); // آغاز آپدیت بیو

});

// 11. مدیریت خاموشی

process.once('SIGINT', () => bot.stop('SIGINT'));

process.once('SIGTERM', () => bot.stop('SIGTERM'));