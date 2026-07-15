import torch
from facenet_pytorch import InceptionResnetV1
import numpy as np
import cv2

class FaceEmbedder:
    def __init__(self, device=None):
        if device is None:
            self.device = torch.device('cuda:0' if torch.cuda.is_available() else 'cpu')
        else:
            self.device = device
            
        # Initialize FaceNet model
        # Pretrained on vggface2 gives 512-dimensional embeddings
        self.resnet = InceptionResnetV1(pretrained='vggface2').eval().to(self.device)

    def preprocess_face(self, face_img):
        """
        Preprocess the face image for FaceNet.
        Expected input: BGR numpy array
        """
        # Convert BGR to RGB
        face_rgb = cv2.cvtColor(face_img, cv2.COLOR_BGR2RGB)
        
        # Resize to 160x160 (required by facenet-pytorch)
        face_resized = cv2.resize(face_rgb, (160, 160))
        
        # Normalize: (x - 127.5) / 128.0
        face_normalized = (np.float32(face_resized) - 127.5) / 128.0
        
        # Convert HWC to CHW format expected by PyTorch (Channels, Height, Width)
        face_tensor = torch.tensor(np.transpose(face_normalized, (2, 0, 1))).unsqueeze(0).float()
        
        return face_tensor

    def get_embedding(self, face_img):
        """
        Generate embedding for a single face image.
        Returns 512-dimensional numpy array.
        """
        if face_img is None or face_img.size == 0:
            return None
            
        face_tensor = self.preprocess_face(face_img).to(self.device)
        
        with torch.no_grad():
            # Get the embedding
            embedding = self.resnet(face_tensor)
            
        # Return as 1D numpy array
        return embedding.cpu().numpy()[0]
