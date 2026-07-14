const video = document.getElementById('webcam');
const captureCanvas = document.getElementById('captureCanvas');
const captureCtx = captureCanvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const captureBtn = document.getElementById('captureBtn');
const trainBtn = document.getElementById('trainBtn');
const statusMsg = document.getElementById('statusMsg');
const personNameInput = document.getElementById('personName');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const overlayCanvas = document.getElementById('overlayCanvas');
const overlayCtx = overlayCanvas.getContext('2d');

let socket = null;
let stream = null;
let captureInterval = null;
// As per requirement: capture for 1 minute every 0.5s
const CAPTURE_DURATION_MS = 60000; // 1 minute
const CAPTURE_INTERVAL_MS = 500; // 0.5 seconds
let captureFrames = 0;
const totalFrames = CAPTURE_DURATION_MS / CAPTURE_INTERVAL_MS;

function showStatus(msg, type) {
    statusMsg.textContent = msg;
    statusMsg.className = `status ${type}`;
    statusMsg.style.display = 'block';
}

async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480, facingMode: 'user' } 
        });
        video.srcObject = stream;
        
        video.onloadedmetadata = () => {
            captureCanvas.width = video.videoWidth;
            captureCanvas.height = video.videoHeight;
            overlayCanvas.width = video.videoWidth;
            overlayCanvas.height = video.videoHeight;
            
            startBtn.disabled = true;
            captureBtn.disabled = false;
            showStatus("Camera started. Enter name and click Start Capture.", "info");
            
            connectSocket();
        };
    } catch (err) {
        console.error("Error accessing webcam:", err);
        showStatus("Could not access webcam. Please allow permissions.", "error");
    }
}

let isDetecting = false;

function connectSocket() {
    socket = io();
    
    socket.on('connect', () => {
        isDetecting = false;
        processDetectionFrame();
    });
    
    socket.on('disconnect', () => {
        // Handle disconnect if needed
    });
    
    socket.on('detection_results', (data) => {
        drawDetectionBoxes(data.boxes);
        isDetecting = false;
        requestAnimationFrame(processDetectionFrame);
    });
}

function processDetectionFrame() {
    if (!stream || !socket || !socket.connected) return;
    
    if (video.readyState === video.HAVE_ENOUGH_DATA && !isDetecting) {
        isDetecting = true;
        
        if (captureCanvas.width !== video.videoWidth) {
            captureCanvas.width = video.videoWidth;
            captureCanvas.height = video.videoHeight;
        }
        
        captureCtx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
        const imageData = captureCanvas.toDataURL('image/jpeg', 0.6);
        
        socket.emit('detect_face_only', { image: imageData });
    } else if (!isDetecting) {
        requestAnimationFrame(processDetectionFrame);
    }
}

function drawDetectionBoxes(boxes) {
    if (overlayCanvas.width !== video.videoWidth && video.videoWidth > 0) {
        overlayCanvas.width = video.videoWidth;
        overlayCanvas.height = video.videoHeight;
    }
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    
    if (!boxes || boxes.length === 0) return;
    
    boxes.forEach(box => {
        const [x1, y1, x2, y2] = box;
        const width = x2 - x1;
        const height = y2 - y1;
        
        // Mirror horizontally
        const mirroredX = overlayCanvas.width - x2;
        
        overlayCtx.strokeStyle = '#2ed573';
        overlayCtx.lineWidth = 3;
        overlayCtx.strokeRect(mirroredX, y1, width, height);
    });
}

async function startCapture() {
    const name = personNameInput.value.trim();
    if (!name) {
        showStatus("Please enter a person name before capturing.", "error");
        return;
    }
    
    captureBtn.disabled = true;
    personNameInput.disabled = true;
    progressContainer.style.display = 'block';
    captureFrames = 0;
    
    showStatus(`Capturing data for ${name}... Please move your head around slowly to capture different angles.`, "info");
    
    captureInterval = setInterval(async () => {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            captureCtx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
            const imageData = captureCanvas.toDataURL('image/jpeg', 0.8);
            
            // Send frame to backend
            try {
                await fetch('/api/register-face', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: name, image: imageData })
                });
            } catch (err) {
                console.error("Failed to send frame:", err);
            }
        }
        
        captureFrames++;
        const progress = (captureFrames / totalFrames) * 100;
        progressBar.style.width = `${progress}%`;
        
        if (captureFrames >= totalFrames) {
            stopCapture();
        }
    }, CAPTURE_INTERVAL_MS);
}

function stopCapture() {
    clearInterval(captureInterval);
    captureBtn.textContent = "Capture Complete";
    showStatus("Capture complete! You can now Train the Model.", "success");
    trainBtn.disabled = false;
    trainBtn.classList.replace('secondary-btn', 'primary-btn');
}

async function trainModel() {
    trainBtn.disabled = true;
    showStatus("Generating embeddings... This may take a few moments.", "info");
    
    try {
        const response = await fetch('/api/generate-embeddings', {
            method: 'POST'
        });
        const data = await response.json();
        
        if (data.status === 'success') {
            showStatus(`Training successful! ${data.message}. You can now go to Live Recognition.`, "success");
            trainBtn.textContent = "Model Trained ✓";
        } else {
            showStatus(`Training failed: ${data.message}`, "error");
            trainBtn.disabled = false;
        }
    } catch (err) {
        console.error("Training error:", err);
        showStatus("An error occurred during training.", "error");
        trainBtn.disabled = false;
    }
}

startBtn.addEventListener('click', startCamera);
captureBtn.addEventListener('click', startCapture);
trainBtn.addEventListener('click', trainModel);
