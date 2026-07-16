from flask import Blueprint, request, jsonify
from backend.services.recognition_service import RecognitionService
import cv2
import numpy as np
import base64

recognize_bp = Blueprint('recognize', __name__)

def get_bgr_from_base64(b64_string):
    if ',' in b64_string:
        b64_string = b64_string.split(',')[1]
    nparr = np.frombuffer(base64.b64decode(b64_string), np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return img

def get_recognize_blueprint(db):
    rec_service = RecognitionService(db)
    
    @recognize_bp.route('/recognize-face', methods=['POST'])
    def recognize_face():
        """
        REST endpoint for face recognition (Phase 7 requirement).
        """
        data = request.json
        image_b64 = data.get('image')
        
        if not image_b64:
            return jsonify({"status": "error", "message": "Missing image"}), 400
            
        img_bgr = get_bgr_from_base64(image_b64)
        results = rec_service.recognize_faces_in_frame(img_bgr)
        return jsonify({"status": "success", "faces": results})
        
    return recognize_bp, rec_service
