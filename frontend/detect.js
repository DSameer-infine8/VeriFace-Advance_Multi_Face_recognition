const video = document.getElementById('webcam');
const overlayCanvas = document.getElementById('overlayCanvas');
const overlayCtx = overlayCanvas.getContext('2d');
const captureCanvas = document.getElementById('captureCanvas');
const captureCtx = captureCanvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusMsg = document.getElementById('statusMsg');
const videoContainer = document.getElementById('videoContainer');
const statsOverlay = document.getElementById('statsOverlay');

let stream = null;
let processingInterval = null;
let socket = null;
const FPS = 10; // Send 10 frames per second to backend
let frameCount = 0;
let lastFpsTime = Date.now();

function showStatus(msg, type) {
    statusMsg.textContent = msg;
    statusMsg.className = `status ${type}`;
}

async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480, facingMode: 'user' } 
        });
        video.srcObject = stream;
        
        video.onloadedmetadata = () => {
            overlayCanvas.width = video.videoWidth;
            overlayCanvas.height = video.videoHeight;
            captureCanvas.width = video.videoWidth;
            captureCanvas.height = video.videoHeight;
            
            startBtn.disabled = true;
            stopBtn.disabled = false;
            videoContainer.classList.add('active');
            statsOverlay.style.display = 'block';
            
            showStatus("Camera started. Connecting to server...", "info");
            connectSocket();
        };
    } catch (err) {
        console.error("Error accessing webcam:", err);
        showStatus("Could not access webcam. Please allow permissions.", "error");
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    if (processingInterval) {
        clearInterval(processingInterval);
    }
    if (socket) {
        socket.disconnect();
    }
    videoContainer.classList.remove('active');
    startBtn.disabled = false;
    stopBtn.disabled = true;
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    statsOverlay.style.display = 'none';
    showStatus("Camera stopped.", "info");
}

function connectSocket() {
    socket = io(); // Connects to the host serving the page
    
    socket.on('connect', () => {
        showStatus("Connected to recognition server.", "success");
        startProcessing();
    });
    
    socket.on('disconnect', () => {
        showStatus("Disconnected from server.", "error");
        clearInterval(processingInterval);
    });
    
    socket.on('recognition_results', (data) => {
        drawResults(data.faces);
        updateFPS();
        isProcessing = false;
        requestAnimationFrame(processNextFrame);
    });
}

let isProcessing = false;

function processNextFrame() {
    if (!stream || !socket || !socket.connected) return;
    
    if (video.readyState === video.HAVE_ENOUGH_DATA && !isProcessing) {
        isProcessing = true;
        
        if (captureCanvas.width !== video.videoWidth) {
            captureCanvas.width = video.videoWidth;
            captureCanvas.height = video.videoHeight;
        }
        
        captureCtx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
        const imageData = captureCanvas.toDataURL('image/jpeg', 0.6); // Slightly lower quality for speed
        
        socket.emit('process_frame', { image: imageData });
    } else if (!isProcessing) {
        requestAnimationFrame(processNextFrame);
    }
}

function startProcessing() {
    isProcessing = false;
    processNextFrame();
}

function updateFPS() {
    frameCount++;
    const now = Date.now();
    if (now - lastFpsTime >= 1000) {
        statsOverlay.textContent = `FPS: ${frameCount}`;
        frameCount = 0;
        lastFpsTime = now;
    }
}

function drawResults(faces) {
    if (overlayCanvas.width !== video.videoWidth && video.videoWidth > 0) {
        overlayCanvas.width = video.videoWidth;
        overlayCanvas.height = video.videoHeight;
    }
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    
    if (!faces || faces.length === 0) return;
    
    faces.forEach(face => {
        const [x1, y1, x2, y2] = face.box;
        const name = face.name;
        const sim = face.similarity ? (face.similarity * 100).toFixed(1) + '%' : '';
        
        const width = x2 - x1;
        const height = y2 - y1;
        
        // Since video is mirrored via CSS scaleX(-1), we must mirror coordinates horizontally
        const mirroredX = overlayCanvas.width - x2;
        
        // Draw bounding box
        overlayCtx.strokeStyle = name === "Unknown" ? '#ff4757' : '#2ed573';
        overlayCtx.lineWidth = 3;
        overlayCtx.strokeRect(mirroredX, y1, width, height);
        
        // Draw background for text
        overlayCtx.fillStyle = name === "Unknown" ? 'rgba(255, 71, 87, 0.8)' : 'rgba(46, 213, 115, 0.8)';
        
        const text = name !== "Unknown" ? `${name} (${sim})` : "Unknown";
        overlayCtx.font = '14px Inter, sans-serif';
        const textWidth = overlayCtx.measureText(text).width;
        
        // Position text above box
        const textY = y1 > 25 ? y1 - 25 : y1 + height + 5;
        
        overlayCtx.fillRect(mirroredX, textY, textWidth + 10, 25);
        
        // Draw text
        overlayCtx.fillStyle = '#FFFFFF';
        overlayCtx.fillText(text, mirroredX + 5, textY + 18);
    });
}

startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);
