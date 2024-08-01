const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { Anthropic } = require('@anthropic-ai/sdk');
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
      tasks.set(taskId, { status: 'applying style', progress: 75 });
      io.emit('taskUpdate', { taskId, status: 'applying style', progress: 75 });
    }
    
    console.log('Обработка завершена');
    const cardUrl = `/generated/${path.basename(processedImagePath)}`;
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
    console.log('Начало применения стиля Пикассо');
    
    // Считываем и обрабатываем изображение
    const imageBuffer = await sharp(imagePath)
      .jpeg() // Конвертируем изображение в JPEG
      .toBuffer();
    
    const base64Image = imageBuffer.toString('base64');

    console.log('Изображение обработано, начинаем анализ с Anthropic');
    // Анализируем изображение с помощью Anthropic API
    const analysisMessage = await anthropic.beta.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: base64Image
              }
            },
            {
              type: "text",
              text: "Analyze this image and describe its key elements and overall composition. Focus on aspects that would be important to recreate in a Picasso-style painting."
            }
          ]
        }
      ]
    });

    console.log('Анализ Anthropic завершен, формируем промпт для OpenAI');
    const imageAnalysis = analysisMessage.content[0].text;

    // Создаем промпт для OpenAI на основе анализа
    const openaiPrompt = `Create a new image in the style of Pablo Picasso based on the following description: ${imageAnalysis}. 
    The image should incorporate cubist elements and bold, abstract shapes typical of Picasso's style. 
    Additionally, include the text "Happy Birthday Visaginas" in English, integrated into the composition in a stylistic manner. 
    The text should be clearly readable but artistically incorporated into the Picasso-style image.`;

    console.log('Начинаем генерацию изображения с OpenAI');
    // Генерируем новое изображение с помощью OpenAI
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: openaiPrompt,
      n: 1,
      size: "1024x1024",
    });

    console.log('Изображение сгенерировано, сохраняем результат');
    const picassoImageUrl = response.data[0].url;
    const picassoImageBuffer = await downloadImage(picassoImageUrl);
    
    const outputPath = imagePath.replace(/\.[^/.]+$/, '') + '-picasso.png';
    await fs.writeFile(outputPath, picassoImageBuffer);
    
    console.log('Стиль Пикассо успешно применен');
    return outputPath;
  } catch (error) {
    console.error('Ошибка при применении стиля Пикассо:', error);
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
