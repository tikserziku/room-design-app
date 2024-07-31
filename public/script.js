const socket = io();

document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);
  
  // Очищаем предыдущие результаты
  localStorage.removeItem('designVariants');
  document.getElementById('results').innerHTML = '';
  
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
  
  const instructions = document.createElement('p');
  instructions.textContent = 'Чтобы сохранить изображение, нажмите на кнопку "Скачать" под изображением.';
  resultsDiv.appendChild(instructions);

  variants.forEach((url, index) => {
    const container = document.createElement('div');
    container.className = 'image-container';

    const img = document.createElement('img');
    img.src = url;
    img.alt = `Design variant ${index + 1}`;

    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = 'Скачать';
    downloadBtn.className = 'download-btn';
    downloadBtn.onclick = () => downloadImage(url, `design-variant-${index + 1}.png`);

    container.appendChild(img);
    container.appendChild(downloadBtn);
    resultsDiv.appendChild(container);
  });

  // Сохраняем результаты в localStorage
  localStorage.setItem('designVariants', JSON.stringify(variants));
}

function downloadImage(url, filename) {
  fetch(url)
    .then(response => response.blob())
    .then(blob => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    })
    .catch(error => console.error('Error downloading image:', error));
}

// Добавьте эту функцию для восстановления результатов при загрузке страницы
function restoreResults() {
  const variants = JSON.parse(localStorage.getItem('designVariants'));
  if (variants) {
    displayResults(variants);
  }
}

// Вызовите эту функцию при загрузке страницы
window.onload = restoreResults;

function displayError(message) {
  document.getElementById('error').textContent = message;
}
