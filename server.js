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
app.use('/generated', express.static(path.join(__dirname, 'generated')));

const tasks = new Map();

io.on('connection', (socket) => {
  console.log('Пользователь подключился');
  socket.on('disconnect', () => {
    console.log('Пользователь отключился');
  });
});

function sendStatusUpdate(taskId, message) {
  console.log(`[${taskId}] ${message}`);
  io.emit('statusUpdate', { taskId, message });
}

app.post('/upload', upload.single('photo'), async (req, res) => {
  try {
    sendStatusUpdate('', 'Начало обработки загрузки');
    if (!req.file) {
      throw new Error('Файл не был загружен');
    }
    const taskId = uuidv4();
    const style = req.body.style || 'normal';
    tasks.set(taskId, { status: 'processing', style });
    res.json({ taskId });
    sendStatusUpdate(taskId, 'Задача создана, начинаем обработку');
    processImageAsync(taskId, req.file.path, style);
  } catch (error) {
    console.error('Ошибка обработки загрузки:', error);
    res.status(400).json({ error: error.message });
  }
});

async function processImageAsync(taskId, imagePath, style) {
  try {
    sendStatusUpdate(taskId, `Начало обработки изображения, стиль: ${style}`);
    
    tasks.set(taskId, { status: 'analyzing', progress: 25 });
    io.emit('taskUpdate', { taskId, status: 'analyzing', progress: 25 });
    
    let processedImageUrl = '';
    if (style === 'picasso') {
      sendStatusUpdate(taskId, 'Применение стиля Пикассо...');
      processedImageUrl = await applyPicassoStyle(imagePath, taskId);
      tasks.set(taskId, { status: 'applying style', progress: 75 });
      io.emit('taskUpdate', { taskId, status: 'applying style', progress: 75 });
    }
    
    sendStatusUpdate(taskId, 'Обработка завершена');
    tasks.set(taskId, { status: 'completed' });
    io.emit('taskUpdate', { taskId, status: 'completed' });
    io.emit('cardGenerated', { taskId, cardUrl: processedImageUrl });
  } catch (error) {
    console.error(`Ошибка обработки изображения для задачи ${taskId}:`, error);
    tasks.set(taskId, { status: 'error', error: error.message });
    io.emit('taskUpdate', { taskId, status: 'error', error: error.message });
    sendStatusUpdate(taskId, `Ошибка: ${error.message}`);
  } finally {
    try {
      await fs.unlink(imagePath);
      sendStatusUpdate(taskId, `Временный файл ${imagePath} удален`);
    } catch (unlinkError) {
      console.error('Ошибка удаления временного файла:', unlinkError);
    }
  }
}

async function applyPicassoStyle(imagePath, taskId) {
  try {
    sendStatusUpdate(taskId, 'Начало применения стиля Пикассо');
    
    sendStatusUpdate(taskId, 'Обработка изображения');
    const imageBuffer = await sharp(imagePath)
      .jpeg()
      .toBuffer();
    
    const base64Image = imageBuffer.toString('base64');
    sendStatusUpdate(taskId, 'Изображение преобразовано в base64');

    sendStatusUpdate(taskId, 'Начало анализа с Anthropic');
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

    sendStatusUpdate(taskId, 'Анализ Anthropic завершен, формируем промпт для OpenAI');
    const imageAnalysis = analysisMessage.content[0].text;

    const imagePrompt = `Create a new image in the style of Pablo Picasso based on the following description: ${imageAnalysis}. 
    The image should incorporate cubist elements and bold, abstract shapes typical of Picasso's style.`;

    sendStatusUpdate(taskId, 'Начинаем генерацию изображения с OpenAI');
    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: imagePrompt,
      n: 1,
      size: "1024x1024",
    });

    const picassoImageUrl = imageResponse.data[0].url;
    const picassoImageBuffer = await downloadImage(picassoImageUrl);

    sendStatusUpdate(taskId, 'Генерация текста для наложения');
    const textPrompt = `Create a stylized text image of "Happy Birthday Visaginas" that would fit well with a Picasso-style painting. 
    The text should be bold, colorful, and slightly abstract, matching Picasso's artistic style. 
    Make sure the text is large and clearly readable, using contrasting colors to stand out.
    Design the text to be positioned at the bottom of a larger image.`;

    const textResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: textPrompt,
      n: 1,
      size: "1024x1024",  // Используем поддерживаемый размер
    });

    const textImageUrl = textResponse.data[0].url;
    const textImageBuffer = await downloadImage(textImageUrl);

    // Обрезаем текстовое изображение до нужной высоты
    const croppedTextBuffer = await sharp(textImageBuffer)
      .extract({ left: 0, top: 768, width: 1024, height: 256 })  // Обрезаем нижнюю четверть изображения
      .toBuffer();

    sendStatusUpdate(taskId, 'Наложение текста на изображение');
    const finalImage = await sharp(picassoImageBuffer)
      .composite([
        {
          input: croppedTextBuffer,
          gravity: 'south',  // Размещаем текст внизу изображения
        }
      ])
      .toBuffer();

    const generatedDir = path.join(__dirname, 'generated');
    await fs.mkdir(generatedDir, { recursive: true });
    
    const outputFileName = `${taskId}-picasso.png`;
    const outputPath = path.join(generatedDir, outputFileName);
    await fs.writeFile(outputPath, finalImage);
    
    sendStatusUpdate(taskId, `Стиль Пикассо успешно применен, файл сохранен: ${outputPath}`);
    return `/generated/${outputFileName}`;
  } catch (error) {
    sendStatusUpdate(taskId, `Ошибка при применении стиля Пикассо: ${error.message}`);
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
