import os
import cv2
import time
from backend.models.face_detector import FaceDetector

class RegistrationService:
    def __init__(self):
        # Resolve dataset path relative to the project root
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        self.dataset_path = os.path.join(base_dir, 'dataset')
        self.detector = FaceDetector()
        
    def save_registration_frame(self, name, frame_bgr):
        """
        Saves a cropped face to the dataset folder for the user.
        Expects the BGR frame from OpenCV.
        """
        if not name or name.strip() == "":
            return {"status": "error", "message": "Name is required"}
            
        name = name.strip()
        person_dir = os.path.join(self.dataset_path, name)
        os.makedirs(person_dir, exist_ok=True)
        
        # Detect and crop face to ensure we only save valid faces
        boxes, probs = self.detector.detect_faces(frame_bgr)
        if len(boxes) == 0:
            return {"status": "error", "message": "No face detected"}
            
        crops = self.detector.crop_faces(frame_bgr, boxes[:1]) # take first face
        if len(crops) == 0:
            return {"status": "error", "message": "Could not crop face"}
            
        face_crop = crops[0]
        
        # Save image with timestamp to avoid overwrites
        timestamp = int(time.time() * 1000)
        img_path = os.path.join(person_dir, f"{timestamp}.jpg")
        cv2.imwrite(img_path, face_crop)
        
        return {"status": "success", "message": "Face saved successfully"}
