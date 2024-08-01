const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const upload = multer({ dest: 'uploads/' });

if (!process.env.ANTHROPIC_API_KEY || !process.env.OPENAI_API_KEY) {
  console.error('API ключи не установлены в переменных окружения');
  process.exit(1);
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.static('public'));

const tasks = new Map();

io.on('connection', (socket) => {
  console.log('Пользователь подключился');
  socket.on('disconnect', () => {
    console.log('Пользователь отключился');
  });
});

app.post('/upload', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      throw new Error('Файл не был загружен');
    }
    const taskId = uuidv4();
    tasks.set(taskId, { status: 'processing' });
    res.json({ taskId });
    processImageAsync(taskId, req.file.path);
  } catch (error) {
    console.error('Ошибка обработки загрузки:', error);
    res.status(400).json({ error: error.message });
  }
});

async function processImageAsync(taskId, imagePath) {
  try {
    console.log(`Начало обработки изображения для задачи ${taskId}`);
    
    tasks.set(taskId, { status: 'analyzing', progress: 25 });
    io.emit('taskUpdate', { taskId, status: 'analyzing', progress: 25 });
    
    console.log('Генерация поздравительного логотипа...');
    const congratsLogo = await generateCongratsLogo();
    tasks.set(taskId, { status: 'generating logo', progress: 50 });
    io.emit('taskUpdate', { taskId, status: 'generating logo', progress: 50 });
    
    console.log('Создание поздравительной открытки...');
    const greetingCard = await createGreetingCard(imagePath, congratsLogo);
    tasks.set(taskId, { status: 'creating card', progress: 75 });
    io.emit('taskUpdate', { taskId, status: 'creating card', progress: 75 });

    console.log('Сохранение открытки...');
    const cardUrl = await saveAndGetUrl(greetingCard, `greeting-card-${taskId}.png`);
    
    console.log('Обработка завершена');
    tasks.set(taskId, { status: 'completed' });
    io.emit('taskUpdate', { taskId, status: 'completed' });
    io.emit('cardGenerated', { taskId, cardUrl });
  } catch (error) {
    console.error(`Ошибка обработки изображения для задачи ${taskId}:`, error);
    tasks.set(taskId, { status: 'error', error: error.message });
    io.emit('taskUpdate', { taskId, status: 'error', error: error.message });
  } finally {
    try {
      await fs.unlink(imagePath);
      console.log(`Временный файл ${imagePath} удален`);
    } catch (unlinkError) {
      console.error('Ошибка удаления временного файла:', unlinkError);
    }
  }
}

async function generateCongratsLogo() {
  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: "Создайте праздничный логотип с текстом 'Visaginas birthday' на английском языке. Логотип должен быть ярким, праздничным и отражать атмосферу городского праздника.",
      n: 1,
      size: "1024x1024",
    });
    return response.data[0].url;
  } catch (error) {
    console.error('Ошибка генерации поздравительного логотипа:', error);
    throw error;
  }
}

// ... (предыдущий код остается без изменений)

async function createGreetingCard(imagePath, logoUrl) {
  try {
    const baseImage = sharp(imagePath);
    const logoBuffer = await downloadImage(logoUrl);

    // Изменяем размер и обрезаем базовое изображение до формата 9:16
    const resizedBase = await baseImage
      .resize({
        width: 1080,
        height: 1920,
        fit: sharp.fit.cover,
        position: sharp.strategy.entropy
      })
      .toBuffer();

    // Создаем праздничную рамку
    const frame = await createFestiveFrame();

    // Изменяем размер логотипа
    const resizedLogo = await sharp(logoBuffer)
      .resize({
        width: 1080,
        height: 640,
        fit: sharp.fit.inside
      })
      .toBuffer();

    // Создаем белый фон для логотипа
    const logoBackground = await sharp({
      create: {
        width: 1080,
        height: 640,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0.8 }
      }
    })
    .png()
    .toBuffer();

    // Собираем финальное изображение
    return sharp(resizedBase)
      .composite([
        { input: frame, blend: 'over' },
        { 
          input: logoBackground,
          top: 1280,
          left: 0
        },
        {
          input: resizedLogo,
          top: 1280,
          left: 0,
          gravity: 'center'
        }
      ])
      .toBuffer();
  } catch (error) {
    console.error('Ошибка при создании поздравительной открытки:', error);
    throw error;
  }
}

async function createFestiveFrame() {
  const width = 1080;
  const height = 1920;
  const frameWidth = 20;

  return sharp({
    create: {
      width: width,
      height: height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([
      {
        input: Buffer.from(`<svg>
          <rect x="0" y="0" width="${width}" height="${height}" fill="none" 
                stroke="gold" stroke-width="${frameWidth}" />
          <circle cx="${width/2}" cy="${height/2}" r="${width/4}" fill="none" 
                  stroke="gold" stroke-width="${frameWidth/2}" stroke-dasharray="10,10" />
          <text x="${width/2}" y="${height-50}" font-family="Arial" font-size="40" 
                fill="gold" text-anchor="middle">С Днем Рождения, Висагинас!</text>
        </svg>`),
        top: 0,
        left: 0
      }
    ])
    .png()
    .toBuffer();
}

// ... (остальной код остается без изменений)

async function saveAndGetUrl(imageBuffer, filename) {
  try {
    const publicPath = path.join(__dirname, 'public', 'generated');
    await fs.mkdir(publicPath, { recursive: true });
    const filePath = path.join(publicPath, filename);
    await fs.writeFile(filePath, imageBuffer);
    return `/generated/${filename}`;
  } catch (error) {
    console.error('Ошибка при сохранении изображения:', error);
    throw error;
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
