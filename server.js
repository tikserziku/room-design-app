const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const dotenv = require('dotenv');
const fileType = require('file-type');

dotenv.config();

const app = express();
const upload = multer({ dest: 'uploads/' });

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Anthropic API key is not set in environment variables');
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error('OpenAI API key is not set in environment variables');
  process.exit(1);
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.static('public'));

app.post('/upload', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      throw new Error('No file uploaded');
    }
    const analysisResult = await analyzeImage(req.file.path);
    const designVariants = await generateDesigns(analysisResult);
    res.json({ variants: designVariants });
  } catch (error) {
    console.error('Error processing upload:', error);
    res.status(500).json({ error: error.message });
  }
});

async function analyzeImage(imagePath) {
  try {
    const imageBuffer = await fs.readFile(imagePath);
    const imageType = await fileType.fromBuffer(imageBuffer);
    
    if (!imageType || !['image/jpeg', 'image/png'].includes(imageType.mime)) {
      throw new Error('Unsupported image format. Please upload a JPEG or PNG image.');
    }

    const base64Image = imageBuffer.toString('base64');

    console.log('Sending request to Anthropic API...');
    console.log('Image type:', imageType.mime);

    const message = await anthropic.beta.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: imageType.mime,
                data: base64Image
              }
            },
            {
              type: "text",
              text: "Analyze this room image and provide a detailed description focusing on the style, colors, furniture, and overall ambiance. Then, suggest three different design concepts that could enhance or transform this room."
            }
          ]
        }
      ]
    });

    console.log('Received response from Anthropic API');
    return message.content[0].text;
  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    throw error;
  }
}

async function generateDesigns(description) {
  const designs = [];
  try {
    for (let i = 0; i < 3; i++) {
      console.log(`Generating design ${i + 1}...`);
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: `Based on this description: ${description}. Generate a new, unique room design concept. The image should be photorealistic and highly detailed.`,
        n: 1,
        size: "1024x1024",
      });
      designs.push(response.data[0].url);
    }
    return designs;
  } catch (error) {
    console.error('Error generating designs:', error);
    throw error;
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Anthropic API Key:', process.env.ANTHROPIC_API_KEY ? `Set (${process.env.ANTHROPIC_API_KEY.substr(0, 5)}...)` : 'Not set');
  console.log('OpenAI API Key:', process.env.OPENAI_API_KEY ? `Set (${process.env.OPENAI_API_KEY.substr(0, 5)}...)` : 'Not set');
});
