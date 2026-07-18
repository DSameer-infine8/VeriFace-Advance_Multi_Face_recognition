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
const attendanceDate = document.getElementById('attendanceDate');
const attendanceTableBody = document.getElementById('attendanceTableBody');
const saveCsvBtn = document.getElementById('saveCsvBtn');
const attendanceCheckbox = document.getElementById('attendanceCheckbox');
const tablePanel = document.querySelector('.table-panel');

let attendanceData = {}; // { 'Name': { status: 'Absent', time: '-', proof: null, blinkCount: 0, lastBlink: false } }
let todayDateString = '';

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

        // --- Attendance Logic ---
        if (name !== "Unknown" && attendanceCheckbox.checked) {
            markAttendance(name, face.box, face.is_blinking);
        }
    });
}

function markAttendance(name, box, is_blinking) {
    if (attendanceData[name] && attendanceData[name].status === 'Absent') {
        // Blink logic
        let wasBlinking = attendanceData[name].lastBlink;
        if (is_blinking && !wasBlinking) {
            // Blink transition from open to close
            attendanceData[name].blinkCount += 1;
        }
        attendanceData[name].lastBlink = is_blinking;

        // Show blink progress
        showStatus(`${name} recognized. Blinks: ${attendanceData[name].blinkCount}/3`, "info");

        if (attendanceData[name].blinkCount >= 3) {
            const [x1, y1, x2, y2] = box;
            // Ensure coordinates are within canvas bounds
            const startX = Math.max(0, x1);
            const startY = Math.max(0, y1);
            const width = Math.min(captureCanvas.width - startX, x2 - x1);
            const height = Math.min(captureCanvas.height - startY, y2 - y1);

            // Create a temporary canvas to extract the crop
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = width;
            cropCanvas.height = height;
            const cropCtx = cropCanvas.getContext('2d');

            if (width > 0 && height > 0) {
                cropCtx.drawImage(captureCanvas, startX, startY, width, height, 0, 0, width, height);
                const proofDataUrl = cropCanvas.toDataURL('image/jpeg', 0.8);

                const now = new Date();
                const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                attendanceData[name].status = 'Present';
                attendanceData[name].time = timeStr;
                attendanceData[name].proof = proofDataUrl;

                showStatus(`Attendance marked for ${name}!`, "success");
                renderAttendanceTable();
            }
        }
    }
}

async function initializeAttendance() {
    // Set Date Header
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    todayDateString = `${day}-${month}-${year}`;
    attendanceDate.textContent = `Date: ${todayDateString}`;

    // Fetch registered faces
    try {
        const response = await fetch('/api/registered-faces');
        const data = await response.json();

        if (data.status === 'success') {
            const uniqueFaces = [...new Set(data.faces)];
            attendanceData = {};
            uniqueFaces.forEach(name => {
                attendanceData[name] = { status: 'Absent', time: '-', proof: null, blinkCount: 0, lastBlink: false };
            });
            renderAttendanceTable();
        }
    } catch (err) {
        console.error("Failed to fetch registered faces:", err);
        attendanceTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: #ff4757;">Failed to load attendance data.</td></tr>';
    }
}

function renderAttendanceTable() {
    attendanceTableBody.innerHTML = '';
    const names = Object.keys(attendanceData);

    if (names.length === 0) {
        attendanceTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No faces registered yet.</td></tr>';
        return;
    }

    names.forEach((name, index) => {
        const data = attendanceData[name];
        const tr = document.createElement('tr');

        // S.No
        const tdSno = document.createElement('td');
        tdSno.textContent = index + 1;

        // Name
        const tdName = document.createElement('td');
        tdName.textContent = name;

        // Status
        const tdStatus = document.createElement('td');
        tdStatus.textContent = data.status;
        if (data.status === 'Present') {
            tdStatus.style.color = '#2ed573';
            tdStatus.style.fontWeight = 'bold';
        } else {
            tdStatus.style.color = '#ff4757';
        }

        // Proof
        const tdProof = document.createElement('td');
        if (data.proof) {
            const img = document.createElement('img');
            img.src = data.proof;
            img.className = 'proof-img';
            tdProof.appendChild(img);
        } else {
            tdProof.textContent = '-';
        }

        tr.appendChild(tdSno);
        tr.appendChild(tdName);
        tr.appendChild(tdStatus);
        tr.appendChild(tdProof);

        attendanceTableBody.appendChild(tr);
    });
}

function downloadCsv() {
    if (Object.keys(attendanceData).length === 0) {
        alert("No attendance data available.");
        return;
    }

    const headers = ['S.No', 'Name', 'Status', 'Time', 'Date'];
    const rows = [];
    rows.push(headers.join(','));

    Object.keys(attendanceData).forEach((name, index) => {
        const data = attendanceData[name];
        const row = [
            index + 1,
            name,
            data.status,
            data.time,
            todayDateString
        ];
        rows.push(row.join(','));
    });

    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Attendance_${todayDateString}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);
saveCsvBtn.addEventListener('click', downloadCsv);

attendanceCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
        tablePanel.classList.remove('collapsed');
    } else {
        tablePanel.classList.add('collapsed');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    tablePanel.classList.add('collapsed');
    attendanceCheckbox.checked = false;
    initializeAttendance();
});
