const socket = io();
let currentTaskId = null;
let selectedStyle = 'normal';

document.getElementById('styleNormal').addEventListener('click', () => setStyle('normal'));
document.getElementById('stylePicasso').addEventListener('click', () => setStyle('picasso'));

document.getElementById('uploadPhoto').addEventListener('click', () => {
    document.getElementById('fileInput').click();
});

document.getElementById('takePhoto').addEventListener('click', initCamera);

document.getElementById('fileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        if (isValidImageType(file)) {
            enableGenerateButton();
            displayThumbnail(file);
        } else {
            alert('Пожалуйста, выберите изображение в формате JPEG или PNG.');
            e.target.value = '';
        }
    }
});

document.getElementById('generateDesign').addEventListener('click', handleGenerateDesign);

function setStyle(style) {
    selectedStyle = style;
    document.getElementById('styleNormal').classList.toggle('bg-blue-700', style === 'normal');
    document.getElementById('stylePicasso').classList.toggle('bg-green-700', style === 'picasso');
}

function isValidImageType(file) {
    const acceptedImageTypes = ['image/jpeg', 'image/png'];
    return file && acceptedImageTypes.includes(file.type);
}

function initCamera() {
    // ... (оставьте существующий код для инициализации камеры)
}

function capturePhoto(videoElement, stream) {
    // ... (оставьте существующий код для захвата фото)
}

function closeCameraInterface(stream) {
    // ... (оставьте существующий код для закрытия интерфейса камеры)
}

function displayThumbnail(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const thumbnail = document.getElementById('photoThumbnail');
        thumbnail.src = e.target.result;
        thumbnail.classList.remove('hidden');
    }
    reader.readAsDataURL(file);
}

function enableGenerateButton() {
    const generateButton = document.getElementById('generateDesign');
    generateButton.disabled = false;
    generateButton.classList.remove('opacity-50', 'cursor-not-allowed');
}

async function handleGenerateDesign() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput.files.length === 0) {
        alert('Пожалуйста, сначала выберите фото или сделайте снимок');
        return;
    }

    const file = fileInput.files[0];
    if (!isValidImageType(file)) {
        alert('Пожалуйста, выберите изображение в формате JPEG или PNG.');
        return;
    }

    const formData = new FormData();
    formData.append('photo', file);
    formData.append('style', selectedStyle);

    try {
        showProgressBar();
        setProgress(0);
        displayStatus('Загрузка файла...');

        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Ошибка загрузки');
        }

        const { taskId } = await response.json();
        currentTaskId = taskId;

        clearResults();
    } catch (error) {
        console.error('Ошибка:', error);
        hideProgressBar();
        displayError(error.message);
    }
}

socket.on('taskUpdate', (update) => {
    if (update.taskId === currentTaskId) {
        setProgress(update.progress);
        displayStatus(update.status);
        if (update.status === 'error') {
            displayError(update.error);
        }
    }
});

socket.on('cardGenerated', (data) => {
    if (data.taskId === currentTaskId) {
        displayGreetingCard(data.cardUrl);
    }
});

function displayGreetingCard(url) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';

    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Поздравительная открытка';
    img.className = 'w-full rounded-lg shadow-md mb-4';
    resultsDiv.appendChild(img);

    const downloadBtn = document.createElement('a');
    downloadBtn.href = url;
    downloadBtn.download = 'visaginas-birthday-card.png';
    downloadBtn.textContent = 'Скачать открытку';
    downloadBtn.className = 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded';
    resultsDiv.appendChild(downloadBtn);

    hideProgressBar();
}

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

function displayError(message) {
    document.getElementById('status').textContent = message;
    document.getElementById('status').classList.add('text-red-500');
}
