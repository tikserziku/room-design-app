const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const OpenAI = require('openai');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const fetch = require('node-fetch');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const upload = multer({ dest: 'uploads/' });

if (!process.env.OPENAI_API_KEY) {
  console.error('API ключ OpenAI не установлен в переменных окружения');
  process.exit(1);
}

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
    const style = req.body.style || 'normal';
    tasks.set(taskId, { status: 'processing', style });
    res.json({ taskId });
    processImageAsync(taskId, req.file.path, style);
  } catch (error) {
    console.error('Ошибка обработки загрузки:', error);
    res.status(400).json({ error: error.message });
  }
});

async function processImageAsync(taskId, imagePath, style) {
  try {
    console.log(`Начало обработки изображения для задачи ${taskId}, стиль: ${style}`);
    
    tasks.set(taskId, { status: 'analyzing', progress: 25 });
    io.emit('taskUpdate', { taskId, status: 'analyzing', progress: 25 });
    
    let processedImagePath = imagePath;
    if (style === 'picasso') {
      console.log('Применение стиля Пикассо...');
      processedImagePath = await applyPicassoStyle(imagePath);
      tasks.set(taskId, { status: 'applying style', progress: 50 });
      io.emit('taskUpdate', { taskId, status: 'applying style', progress: 50 });
    }
    
    console.log('Генерация поздравительного логотипа...');
    const congratsLogo = await generateCongratsLogo();
    console.log('Поздравительный логотип сгенерирован:', congratsLogo);
    tasks.set(taskId, { status: 'generating logo', progress: 75 });
    io.emit('taskUpdate', { taskId, status: 'generating logo', progress: 75 });
    
    console.log('Создание поздравительной открытки...');
    const greetingCard = await createGreetingCard(processedImagePath, congratsLogo);
    console.log('Поздравительная открытка создана');
    tasks.set(taskId, { status: 'creating card', progress: 90 });
    io.emit('taskUpdate', { taskId, status: 'creating card', progress: 90 });

    console.log('Сохранение открытки...');
    const cardUrl = await saveAndGetUrl(greetingCard, `greeting-card-${taskId}.png`);
    console.log('Открытка сохранена:', cardUrl);
    
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

async function applyPicassoStyle(imagePath) {
  try {
    // Уменьшаем размер изображения перед обработкой
    const resizedImageBuffer = await sharp(imagePath)
      .resize({ width: 512, height: 512, fit: 'inside' })
      .toBuffer();

    const response = await openai.images.edit({
      image: resizedImageBuffer,
      prompt: "Transform this image into the style of Pablo Picasso, emphasizing cubist elements and bold, abstract shapes.",
      n: 1,
      size: "512x512"
    });

    const picassoImageUrl = response.data[0].url;
    const picassoImageBuffer = await downloadImage(picassoImageUrl);
    
    const outputPath = imagePath.replace('.jpg', '-picasso.png');
    await sharp(picassoImageBuffer)
      .toFile(outputPath);
    
    // Освобождаем память
    resizedImageBuffer = null;
    picassoImageBuffer = null;

    return outputPath;
  } catch (error) {
    console.error('Ошибка при применении стиля Пикассо:', error);
    throw error;
  }
}

async function generateCongratsLogo() {
  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: "Создайте праздничный логотип с текстом 'Visaginas birthday' на английском языке. Логотип должен быть ярким, праздничным и отражать атмосферу городского праздника. Логотип должен быть круглым и размещен на ярко-зеленом фоне (#00FF00). Сам логотип должен быть контрастным по отношению к фону.",
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
    console.log('Начало создания поздравительной открытки');
    const baseImage = sharp(imagePath);
    const logoBuffer = await downloadImage(logoUrl);

    const WIDTH = 1080;
    const HEIGHT = 1920;
    const LOGO_SIZE = Math.floor(WIDTH * 0.25); // Размер логотипа - 25% от ширины изображения

    // Изменяем размер и обрезаем базовое изображение до формата 9:16
    const resizedBase = await baseImage
      .resize({
        width: WIDTH,
        height: HEIGHT,
        fit: sharp.fit.cover,
        position: sharp.strategy.entropy
      })
      .toBuffer();
    
    console.log('Базовое изображение изменено');

    // Обработка логотипа: удаление зеленого фона и создание круглой маски
    const processedLogo = await sharp(logoBuffer)
      .resize(LOGO_SIZE, LOGO_SIZE)
      .removeAlpha()
      .flatten({ background: { r: 0, g: 255, b: 0 } })
      .toColourspace('b-w')
      .threshold(128)
      .toColourspace('srgb')
      .composite([{
        input: Buffer.from(`<svg><circle cx="${LOGO_SIZE/2}" cy="${LOGO_SIZE/2}" r="${LOGO_SIZE/2}" /></svg>`),
        blend: 'dest-in'
      }])
      .png()
      .toBuffer();

    console.log('Логотип обработан: зеленый фон удален и применена круглая маска');

    // Собираем финальное изображение
    console.log('Начало сборки финального изображения');
    return sharp(resizedBase)
      .composite([
        {
          input: processedLogo,
          top: HEIGHT - LOGO_SIZE - 20,
          left: WIDTH - LOGO_SIZE - 20,
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
