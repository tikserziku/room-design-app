// ... (остальной код остается без изменений)

function displayGreetingCard(url) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'relative';

    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Поздравительная открытка';
    img.className = 'w-full rounded-lg shadow-md mb-4';

    const textOverlay = document.createElement('div');
    textOverlay.className = 'absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-center py-4 px-2';
    textOverlay.innerHTML = '<h2 class="text-3xl font-bold">Happy Birthday Visaginas!</h2>';

    container.appendChild(img);
    container.appendChild(textOverlay);
    resultsDiv.appendChild(container);

    const downloadBtn = document.createElement('a');
    downloadBtn.href = url;
    downloadBtn.download = 'visaginas-birthday-card.png';
    downloadBtn.textContent = 'Скачать открытку';
    downloadBtn.className = 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded';
    resultsDiv.appendChild(downloadBtn);

    hideProgressBar();
}

// ... (остальной код остается без изменений)
