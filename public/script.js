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
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Ошибка загрузки');
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
        console.error('Ошибка:', error);
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
        img.alt = `Вариант дизайна ${index + 1}`;
        img.className = 'w-full rounded-lg shadow-md';
        resultsDiv.appendChild(img);
    });
}

function displayError(message) {
    document.getElementById('status').textContent = message;
    document.getElementById('status').classList.add('text-red-500');
}
