const socket = io();

document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  
  try {
    const response = await fetch('/upload', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error('Upload failed');
    }
    
    const { taskId } = await response.json();
    displayStatus('Обработка изображения...');
    
    socket.on('taskUpdate', (update) => {
      if (update.taskId === taskId) {
        if (update.status === 'analyzing') {
          displayStatus(`Анализ изображения... ${update.progress}%`);
        } else if (update.status === 'completed') {
          displayResults(update.variants);
        } else if (update.status === 'error') {
          displayError(update.error);
        }
      }
    });
  } catch (error) {
    console.error('Error:', error);
    displayError('Произошла ошибка при загрузке файла');
  }
});

function displayStatus(message) {
  document.getElementById('status').textContent = message;
}

function displayResults(variants) {
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '';
  variants.forEach((url, index) => {
    const img = document.createElement('img');
    img.src = url;
    img.alt = `Design variant ${index + 1}`;
    resultsDiv.appendChild(img);
  });
}

function displayError(message) {
  document.getElementById('error').textContent = message;
}

function displayResults(variants) {
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '';
  variants.forEach((url, index) => {
    const container = document.createElement('div');
    container.className = 'image-container';

    const img = document.createElement('img');
    img.src = url;
    img.alt = `Design variant ${index + 1}`;

    const downloadBtn = document.createElement('a');
    downloadBtn.href = url;
    downloadBtn.download = `design-variant-${index + 1}.png`;
    downloadBtn.textContent = 'Скачать';
    downloadBtn.className = 'download-btn';

    container.appendChild(img);
    container.appendChild(downloadBtn);
    resultsDiv.appendChild(container);
  });
}
