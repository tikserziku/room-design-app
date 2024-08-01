// ... (существующий код остается без изменений)

// Обновляем обработчики событий Socket.IO
socket.on('taskUpdate', handleTaskUpdate);
socket.on('cardGenerated', handleCardGenerated);

function handleTaskUpdate(update) {
  if (update.taskId === currentTaskId) {
    setProgress(update.progress);
    displayStatus(update.status);
    if (update.status === 'error') {
      displayError(update.error);
    }
  }
}

function handleCardGenerated(data) {
  if (data.taskId === currentTaskId) {
    displayGreetingCard(data.cardUrl);
  }
}

function displayGreetingCard(url) {
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = ''; // Очищаем предыдущие результаты

  const img = document.createElement('img');
  img.src = url;
  img.alt = 'Поздравительная открытка';
  img.className = 'w-full rounded-lg shadow-md mb-4';
  resultsDiv.appendChild(img);

  // Добавляем кнопку загрузки
  const downloadBtn = document.createElement('a');
  downloadBtn.href = url;
  downloadBtn.download = 'visaginas-birthday-card.png';
  downloadBtn.textContent = 'Скачать открытку';
  downloadBtn.className = 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded';
  resultsDiv.appendChild(downloadBtn);
}

// Функция для отображения статуса
function displayStatus(message) {
  document.getElementById('status').textContent = message;
}

// Функция для отображения ошибки
function displayError(message) {
  document.getElementById('error').textContent = message;
}

// Функция для установки прогресса
function setProgress(percent) {
  const progressBar = document.querySelector('.progress-bar');
  if (progressBar) {
    progressBar.style.width = `${percent}%`;
  }
}

// ... (остальной существующий код остается без изменений)
