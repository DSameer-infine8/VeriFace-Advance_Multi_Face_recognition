from flask import Blueprint, request, jsonify
from backend.services.registration_service import RegistrationService
import cv2
import numpy as np
import base64

register_bp = Blueprint('register', __name__)
reg_service = RegistrationService()

def get_bgr_from_base64(b64_string):
    if ',' in b64_string:
        b64_string = b64_string.split(',')[1]
    nparr = np.frombuffer(base64.b64decode(b64_string), np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return img

@register_bp.route('/register-face', methods=['POST'])
def register_face():
    """
    Saves a captured frame to the dataset folder.
    """
    data = request.json
    name = data.get('name')
    image_b64 = data.get('image')
    
    if not name or not image_b64:
        return jsonify({"status": "error", "message": "Missing name or image"}), 400
        
    img_bgr = get_bgr_from_base64(image_b64)
    result = reg_service.save_registration_frame(name, img_bgr)
    return jsonify(result)