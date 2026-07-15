import os
import pickle
import numpy as np

class Database:
    def __init__(self, db_path='embeddings/embeddings.pkl'):
        # Note: the paths are relative to where app.py is run from
        self.db_path = db_path
        self.embeddings = {} # Dictionary mapping name to list of embeddings
        self.load_db()
        
    def load_db(self):
        """Load embeddings from pickle file."""
        if os.path.exists(self.db_path):
            with open(self.db_path, 'rb') as f:
                self.embeddings = pickle.load(f)
        else:
            self.embeddings = {}
            
    def save_db(self):
        """Save embeddings to pickle file."""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        with open(self.db_path, 'wb') as f:
            pickle.dump(self.embeddings, f)
            
    def add_embedding(self, name, embedding):
        """Add a single embedding for a user and save to disk."""
        if name not in self.embeddings:
            self.embeddings[name] = []
        self.embeddings[name].append(embedding)
        self.save_db()
        
    def get_all_embeddings(self):
        """
        Returns a list of names and a list of corresponding embeddings.
        Useful for vectorized similarity search.
        """
        names = []
        emb_list = []
        for name, embs in self.embeddings.items():
            for emb in embs:
                names.append(name)
                emb_list.append(emb)
                
        if len(emb_list) > 0:
            return names, np.array(emb_list)
        return [], np.array([])
