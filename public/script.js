const socket = io();
let currentTaskId = null;

document.addEventListener('DOMContentLoaded', function() {
    const uploadButton = document.getElementById('uploadPhoto');
    const fileInput = document.getElementById('fileInput');
    const generateButton = document.getElementById('generateDesign');

    uploadButton.addEventListener('click', function() {
        fileInput.click();
    });

    fileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            if (isValidImageType(file)) {
                displayThumbnail(file);
                enableGenerateButton();
            } else {
                alert('Please select a JPEG or PNG image.');
                e.target.value = '';
            }
        }
    });

    generateButton.addEventListener('click', handleGenerateDesign);

    initializeImageCounter();
});

function isValidImageType(file) {
    const acceptedImageTypes = ['image/jpeg', 'image/png'];
    return file && acceptedImageTypes.includes(file.type);
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
        alert('Please select a photo first');
        return;
    }

    const file = fileInput.files[0];
    if (!isValidImageType(file)) {
        alert('Please select a JPEG or PNG image.');
        return;
    }

    const formData = new FormData();
    formData.append('photo', file);
    formData.append('style', 'picasso');

    try {
        showProgressBar();
        setProgress(0);
        displayStatus('Uploading file...');
        
        clearStatusLog();

        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw
