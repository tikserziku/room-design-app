const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const upload = multer({ dest: 'uploads/' });

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
  const imageBuffer = await fs.readFile(imagePath);
  const base64Image = imageBuffer.toString('base64');

  try {
    console.log('Anthropic API Key:', process.env.ANTHROPIC_API_KEY ? 'Set' : 'Not set');
    console.log('Anthropic client:', anthropic ? 'Initialized' : 'Not initialized');
    console.log('Anthropic client methods:', Object.keys(anthropic));

    const response = await anthropic.beta.messages.create({
      model: "claude-3-sonnet-20240320",
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
              text: "Analyze this room image and provide a detailed description focusing on the style, colors, furniture, and overall ambiance. Then, suggest three different design concepts that could enhance or transform this room."
            }
          ]
        }
      ]
    });

    console.log('Anthropic API Response:', JSON.stringify(response, null, 2));
    return response.content[0].text;
  } catch (error) {
    console.error('Error calling Anthropic API:', error);
    throw error;
  }
}

async function generateDesigns(description) {
  const designs = [];
  for (let i = 0; i < 3; i++) {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: `Based on this description: ${description}. Generate a new, unique room design concept. The image should be photorealistic and highly detailed.`,
      n: 1,
      size: "1024x1024",
    });
    designs.push(response.data[0].url);
  }
  return designs;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
