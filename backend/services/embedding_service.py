import os
import cv2
import glob
from backend.models.face_detector import FaceDetector
from backend.models.facenet_model import FaceEmbedder
from backend.database.db import Database

class EmbeddingService:
    def __init__(self, db: Database):
        self.db = db
        self.detector = FaceDetector()
        self.embedder = FaceEmbedder()
        #self.dataset_path = 'dataset'
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        self.dataset_path = os.path.join(base_dir, 'dataset')

    def generate_embeddings_from_dataset(self):
        """
        Loads all dataset images, detects faces, generates embeddings,
        and stores them with the person's name in the DB.
        """
        if not os.path.exists(self.dataset_path):
            os.makedirs(self.dataset_path)
            
        # Reset DB embeddings to avoid duplicates on re-run
        self.db.embeddings = {}
        
        persons = os.listdir(self.dataset_path)
        count = 0
        
        for person_name in persons:
            person_dir = os.path.join(self.dataset_path, person_name)
            if not os.path.isdir(person_dir):
                continue
                
            # Read all images for this person
            image_paths = glob.glob(os.path.join(person_dir, '*.jpg')) + \
                          glob.glob(os.path.join(person_dir, '*.png'))
                          
            for img_path in image_paths:
                img_bgr = cv2.imread(img_path)
                if img_bgr is None:
                    continue
                    
                # The image is already a cropped face from RegistrationService!
                # We can just generate the embedding directly.
                emb = self.embedder.get_embedding(img_bgr)
                if emb is not None:
                    self.db.add_embedding(person_name, emb)
                    count += 1
                            
        self.db.save_db()
        return {"status": "success", "message": f"Generated {count} embeddings from dataset"}
