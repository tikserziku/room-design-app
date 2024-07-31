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
        displayThumbnail(e.target.files[0]);
    }
});

document.getElementById('generateDesign').addEventListener('click', handleGenerateDesign);

// Функция для инициализации камеры
function initCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Ваше устройство не поддерживает использование камеры');
        return;
    }

    const cameraInterface = document.createElement('div');
    cameraInterface.id = 'cameraInterface';
    cameraInterface.innerHTML = `
        <video id="cameraPreview" autoplay playsinline></video>
        <button id="captureButton">Сделать снимок</button>
        <button id="closeCameraButton">Закрыть камеру</button>
    `;
    document.body.appendChild(cameraInterface);

    const video = document.getElementById('cameraPreview');

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
            video.srcObject = stream;
            document.getElementById('captureButton').addEventListener('click', () => capturePhoto(video, stream));
            document.getElementById('closeCameraButton').addEventListener('click', () => closeCameraInterface(stream));
        })
        .catch(error => {
            console.error('Ошибка доступа к камере:', error);
            alert('Не удалось получить доступ к камере');
            closeCameraInterface();
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
        displayThumbnail(file);

        // Закрываем интерфейс камеры
        closeCameraInterface(stream);
    }, 'image/jpeg');
}

// Функция для закрытия интерфейса камеры
function closeCameraInterface(stream) {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    const cameraInterface = document.getElementById('cameraInterface');
    if (cameraInterface) {
        cameraInterface.remove();
    }
}

// Функция для отображения миниатюры фото
function displayThumbnail(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const thumbnail = document.getElementById('photoThumbnail') || document.createElement('img');
        thumbnail.id = 'photoThumbnail';
        thumbnail.src = e.target.result;
        thumbnail.alt = 'Thumbnail';
        thumbnail.className = 'photo-thumbnail';
        
        const takePhotoButton = document.getElementById('takePhoto');
        if (!document.getElementById('photoThumbnail')) {
            takePhotoButton.insertAdjacentElement('afterend', thumbnail);
        }
    }
    reader.readAsDataURL(file);
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

// Остальные функции (handleTaskUpdate, handleDesignGenerated, showProgressBar, и т.д.) остаются без изменений

// ... (остальной код остается без изменений)

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
