import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from backend.models.face_detector import FaceDetector
from backend.models.facenet_model import FaceEmbedder
from backend.database.db import Database

class RecognitionService:
    def __init__(self, db: Database):
        self.db = db
        self.detector = FaceDetector()
        self.embedder = FaceEmbedder()
        # Cosine similarity threshold for FaceNet vggface2 model.
        # Ranges from -1 to 1. Higher means more similar.
        self.threshold = 0.6 

    def recognize_faces_in_frame(self, frame_bgr):
        """
        Detects faces in frame, generates embeddings, compares with DB.
        Returns a list of dicts: [{'name': 'Person', 'box': [x1, y1, x2, y2], 'similarity': float}]
        """
        results = []
        
        # 1. Detect faces
        boxes, probs = self.detector.detect_faces(frame_bgr)
        if len(boxes) == 0:
            return results
            
        # 2. Crop faces
        crops = self.detector.crop_faces(frame_bgr, boxes)
        
        # 3. Get all embeddings from DB
        db_names, db_embeddings = self.db.get_all_embeddings()
        has_db = len(db_embeddings) > 0
        
        for i, crop in enumerate(crops):
            box = [int(b) for b in boxes[i]]
            name = "Unknown"
            max_sim = 0.0
            
            # Generate embedding for live face
            live_emb = self.embedder.get_embedding(crop)
            
            if live_emb is not None and has_db:
                # Calculate cosine similarity with all DB embeddings
                sims = cosine_similarity([live_emb], db_embeddings)[0]
                
                # Find max similarity
                max_idx = np.argmax(sims)
                max_sim = sims[max_idx]
                
                if max_sim >= self.threshold:
                    name = db_names[max_idx]
                    
            results.append({
                "name": name,
                "box": box,
                "similarity": float(max_sim) if live_emb is not None and has_db else 0.0
            })
            
        return results
