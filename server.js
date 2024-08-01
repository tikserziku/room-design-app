const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const dotenv = require('dotenv');
const fileType = require('file-type');
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

async function createGreetingCard(imagePath, logoUrl) {
  try {
    const baseImage = sharp(imagePath);
    const logoBuffer = await downloadImage(logoUrl);

    // Получаем метаданные базового изображения
    const baseMetadata = await baseImage.metadata();

    // Изменяем размер и расширяем базовое изображение
    const resizedBase = await baseImage
      .resize(800, 600, { fit: 'cover' })
      .extend({
        top: 50, bottom: 50, left: 50, right: 50,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .toBuffer();

    // Получаем метаданные расширенного базового изображения
    const extendedMetadata = await sharp(resizedBase).metadata();

    // Изменяем размер логотипа
    const resizedLogo = await sharp(logoBuffer)
      .resize(Math.floor(extendedMetadata.width / 4), Math.floor(extendedMetadata.height / 4), {
        fit: 'inside',
        withoutEnlargement: true
      })
      .toBuffer();

    // Накладываем логотип на базовое изображение
    return sharp(resizedBase)
      .composite([
        {
          input: resizedLogo,
          top: 10,
          left: 10,
          gravity: 'northeast'
        }
      ])
      .toBuffer();
  } catch (error) {
    console.error('Ошибка при создании поздравительной открытки:', error);
    throw error;
  }
}

async function downloadImage(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('Ошибка при загрузке изображения:', error);
    throw error;
  }
}


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
