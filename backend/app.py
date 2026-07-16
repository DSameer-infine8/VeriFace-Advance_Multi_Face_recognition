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
from backend.database.db import Database
from backend.routes.register_face import get_register_blueprint
from backend.routes.recognize_face import get_recognize_blueprint, get_bgr_from_base64

face_detector = FaceDetector()

print(get_register_blueprint)

# Define paths
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
frontend_dir = os.path.join(base_dir, 'frontend')
db_path = os.path.join(base_dir, 'embeddings', 'embeddings.pkl')

app = Flask(__name__, static_folder=frontend_dir)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Initialize database
db = Database(db_path)

# Register blueprints
register_bp = get_register_blueprint(db)
recognize_bp, rec_service = get_recognize_blueprint(db)



from backend.routes.register_face import register_bp
app.register_blueprint(register_bp, url_prefix='/api')
app.register_blueprint(recognize_bp, url_prefix='/api')


# Serve frontend files
@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def static_files(path):
    if os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')


# Socket.IO event for real-time recognition
@socketio.on('process_frame')
def handle_process_frame(data):
    image_b64 = data.get('image')
    if image_b64:
        try:
            img_bgr = get_bgr_from_base64(image_b64)
            results = rec_service.recognize_faces_in_frame(img_bgr)
            emit('recognition_results', {'faces': results})
        except Exception as e:
            print(f"Error processing frame via socketio: {e}")
            with open("error_log.txt", "a") as f:
                import traceback
                f.write(traceback.format_exc() + "\\n")
            emit('recognition_results', {'faces': []})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
    