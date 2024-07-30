document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const loadingDiv = document.getElementById('loading');
    const resultsDiv = document.getElementById('results');
    
    loadingDiv.style.display = 'block';
    resultsDiv.innerHTML = '';
    
    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        if (!response.ok) {
            throw new Error('Server error');
        }
        const data = await response.json();
        
        if (data.error) {
            resultsDiv.innerHTML = `Error: ${data.error}`;
        } else if (data.variants && data.variants.length) {
            resultsDiv.innerHTML = data.variants.map(url => `<img src="${url}" alt="Design variant">`).join('');
        } else {
            resultsDiv.innerHTML = 'No variants generated';
        }
    } catch (error) {
        console.error('Error:', error);
        resultsDiv.innerHTML = `Error: ${error.message}`;
    } finally {
        loadingDiv.style.display = 'none';
    }
});
