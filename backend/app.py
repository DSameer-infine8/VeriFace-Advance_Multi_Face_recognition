import os
import sys
from pathlib import Path

import numpy as np
import base64
import cv2

# Ensure backend can be imported properly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask_socketio import SocketIO, emit
from flask_cors import CORS
from flask import Flask, render_template, send_from_directory
from backend.models.face_detector import FaceDetector

face_detector = FaceDetector()



# Define paths
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
frontend_dir = os.path.join(base_dir, 'frontend')
db_path = os.path.join(base_dir, 'embeddings', 'embeddings.pkl')

app = Flask(__name__, static_folder=frontend_dir)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Serve frontend files
@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory(frontend_dir, path)

def get_bgr_from_base64(b64_string):
    if ',' in b64_string:
        b64_string = b64_string.split(',')[1]
    nparr = np.frombuffer(base64.b64decode(b64_string), np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return img

# Socket.IO event for real-time face detection ONLY (used during registration)
@socketio.on('detect_face_only')
def handle_detect_face_only(data):
    image_b64 = data.get('image')
    if image_b64:
        try:
            # Convert base64 string to BGR image format using your existing helper
            img_bgr = get_bgr_from_base64(image_b64)
            
            # Detect faces using the FaceDetector
            boxes, probs = face_detector.detect_faces(img_bgr)
            
            # Convert numpy arrays to lists for JSON serialization
            boxes_list = [box.tolist() for box in boxes] if len(boxes) > 0 else []
            
            # Emit the bounding boxes back to the frontend
            emit('detection_results', {'boxes': boxes_list})
            
        except Exception as e:
            print(f"Error during face detection: {e}")
            emit('detection_results', {'boxes': []})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
    