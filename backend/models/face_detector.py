import cv2
from facenet_pytorch import MTCNN
import torch

class FaceDetector:
    def __init__(self, device=None):
        if device is None:
            self.device = torch.device('cuda:0' if torch.cuda.is_available() else 'cpu')
        else:
            self.device = device
            
        # Initialize MTCNN
        # keep_all=True allows detecting multiple faces in one frame
        self.mtcnn = MTCNN(keep_all=True, device=self.device)

    def detect_faces(self, image_bgr):
        """
        Detect faces in a BGR image (OpenCV format)
        Returns:
            boxes: list of [x1, y1, x2, y2]
            probs: list of probabilities
        """
        if image_bgr is None:
            return [], []
            
        # Convert BGR to RGB for MTCNN
        try:
            image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        except Exception as e:
            print(f"Error converting image: {e}")
            return [], []
        
        # Downscale for faster detection (trade-off between speed and small face detection)
        # Using a scale of 0.5 makes detection ~4x faster on CPU
        scale = 0.5
        small_image_rgb = cv2.resize(image_rgb, (0, 0), fx=scale, fy=scale)
        
        # Detect faces on the smaller image
        boxes, probs = self.mtcnn.detect(small_image_rgb)
        
        with open("detector_log.txt", "a") as f:
            f.write(f"Image mean: {image_rgb.mean():.2f}, boxes: {boxes}\\n")
        
        if boxes is None:
            return [], []
            
        # Scale bounding boxes back to original image size
        boxes = boxes / scale
            
        return boxes, probs