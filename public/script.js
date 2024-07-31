// Инициализация соединения Socket.IO
const socket = io();

// Обработчики событий для элементов пользовательского интерфейса
document.getElementById('uploadPhoto').addEventListener('click', () => {
    document.getElementById('fileInput').click();
});

document.getElementById('takePhoto').addEventListener('click', initCamera);

document.getElementById('fileInput').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        enableGenerateButton();
    }
});

document.getElementById('generateDesign').addEventListener('click', handleGenerateDesign);

// Функция для инициализации камеры
function initCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Ваше устройство не поддерживает использование камеры');
        return;
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
            const videoElement = document.createElement('video');
            videoElement.srcObject = stream;
            videoElement.play();

            const captureButton = document.createElement('button');
            captureButton.textContent = 'Сделать снимок';
            captureButton.addEventListener('click', () => capturePhoto(videoElement, stream));

            const container = document.createElement('div');
            container.appendChild(videoElement);
            container.appendChild(captureButton);

            document.body.appendChild(container);
        })
        .catch(error => {
            console.error('Ошибка доступа к камере:', error);
            alert('Не удалось получить доступ к камере');
        });
}

// Функция для захвата фото
function capturePhoto(videoElement, stream) {
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    canvas.getContext('2d').drawImage(videoElement, 0, 0);

    canvas.toBlob(blob => {
        const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
        const dt = new DataTransfer();
        dt.items.add(file);
        document.getElementById('fileInput').files = dt.files;
        enableGenerateButton();

        // Очистка видео элемента и остановка потока
        videoElement.parentNode.remove();
        stream.getTracks().forEach(track => track.stop());
    }, 'image/jpeg');
}

// Включение кнопки генерации
function enableGenerateButton() {
    const generateButton = document.getElementById('generateDesign');
    generateButton.disabled = false;
    generateButton.classList.remove('opacity-50', 'cursor-not-allowed');
}

// Основная функция для обработки генерации дизайна
async function handleGenerateDesign() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput.files.length === 0) {
        alert('Пожалуйста, сначала выберите фото или сделайте снимок');
        return;
    }

    const formData = new FormData();
    formData.append('photo', fileInput.files[0]);

    try {
        showProgressBar();
        setProgress(0);
        displayStatus('Загрузка файла...');

        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Ошибка загрузки');
        }

        setProgress(10);
        displayStatus('Файл загружен. Начинаем анализ...');

        const { taskId } = await response.json();

        // Очищаем результаты перед новой генерацией
        clearResults();

        // Удаляем предыдущие обработчики событий
        socket.off('taskUpdate');
        socket.off('designGenerated');

        // Устанавливаем новые обработчики событий
        socket.on('taskUpdate', handleTaskUpdate(taskId));
        socket.on('designGenerated', handleDesignGenerated(taskId));

    } catch (error) {
        console.error('Ошибка:', error);
        hideProgressBar();
        displayError('Произошла ошибка при загрузке файла');
    }
}

// Обработчик обновлений задачи
function handleTaskUpdate(taskId) {
    return (update) => {
        if (update.taskId === taskId) {
            if (update.status === 'analyzing') {
                const progress = 10 + (update.progress * 0.2); // От 10% до 30%
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
    };
}

// Обработчик генерации дизайна
function handleDesignGenerated(taskId) {
    return (data) => {
        if (data.taskId === taskId) {
            const progress = 30 + ((data.index + 1) * 23.33); // От 30% до 100%
            setProgress(progress);
            displayDesign(data.designUrl, data.index);
        }
    };
}

// Вспомогательные функции для управления UI
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
