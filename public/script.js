const socket = io();

document.getElementById('uploadPhoto').addEventListener('click', () => {
    document.getElementById('fileInput').click();
});

document.getElementById('takePhoto').addEventListener('click', () => {
    alert('Функция съемки фото будет добавлена позже');
});

document.getElementById('fileInput').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        document.getElementById('generateDesign').disabled = false;
        document.getElementById('generateDesign').classList.remove('opacity-50', 'cursor-not-allowed');
    }
});

document.getElementById('generateDesign').addEventListener('click', async () => {
    const fileInput = document.getElementById('fileInput');
    if (fileInput.files.length === 0) {
        alert('Пожалуйста, сначала выберите фото');
        return;
    }

    const formData = new FormData();
    formData.append('photo', fileInput.files[0]);

    try {
        showProgressBar();
        setProgress(10); // Начальный прогресс

        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Ошибка загрузки');
        }

        setProgress(30); // Прогресс после загрузки

        const { taskId } = await response.json();
        displayStatus('Обработка изображения...');

        // Очищаем результаты перед новой генерацией
        clearResults();

        socket.on('taskUpdate', (update) => {
            if (update.taskId === taskId) {
                if (update.status === 'analyzing') {
                    const progress = 30 + (update.progress * 0.5); // От 30% до 80%
                    setProgress(progress);
                    displayStatus(`Анализ изображения... ${update.progress}%`);
                } else if (update.status === 'completed') {
                    setProgress(100);
                    hideProgressBar();
                    displayStatus('Генерация завершена');
                } else if (update.status === 'error') {
                    hideProgressBar();
                    displayError(update.error);
                }
            }
        });

        socket.on('designGenerated', (data) => {
            if (data.taskId === taskId) {
                const progress = 80 + (data.index * 6.67); // От 80% до 100%
                setProgress(progress);
                displayDesign(data.designUrl, data.index);
            }
        });
    } catch (error) {
        console.error('Ошибка:', error);
        hideProgressBar();
        displayError('Произошла ошибка при загрузке файла');
    }
});

function showProgressBar() {
    document.querySelector('.progress-container').style.display = 'block';
}

function hideProgressBar() {
    document.querySelector('.progress-container').style.display = 'none';
}

function setProgress(percent) {
    document.querySelector('.progress-bar').style.width = `${percent}%`;
}

function displayStatus(message) {
    document.getElementById('status').textContent = message;
}

function clearResults() {
    document.getElementById('results').innerHTML = '';
}

function displayDesign(url, index) {
    const resultsDiv = document.getElementById('results');
    const img = document.createElement('img');
    img.src = url;
    img.alt = `Вариант дизайна ${index + 1}`;
    img.className = 'w-full rounded-lg shadow-md mb-4';
    resultsDiv.appendChild(img);
}

function displayError(message) {
    document.getElementById('status').textContent = message;
    document.getElementById('status').classList.add('text-red-500');
}
