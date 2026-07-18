import cv2
import mediapipe as mp
import numpy as np

class BlinkDetector:
    def __init__(self):
        self.mp_face_mesh = mp.solutions.face_mesh
        # We only need face landmarks for eye aspect ratio
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            max_num_faces=10,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        # Landmark indices for Left and Right eyes
        self.LEFT_EYE = [362, 385, 387, 263, 373, 380]
        self.RIGHT_EYE = [33, 160, 158, 133, 153, 144]
        
        # EAR threshold below which an eye is considered closed
        self.EAR_THRESH = 0.21

    def calculate_ear(self, landmarks, eye_indices):
        """Calculate Eye Aspect Ratio"""
        # Coordinates of the eye landmarks
        p1 = np.array([landmarks[eye_indices[0]].x, landmarks[eye_indices[0]].y])
        p2 = np.array([landmarks[eye_indices[1]].x, landmarks[eye_indices[1]].y])
        p3 = np.array([landmarks[eye_indices[2]].x, landmarks[eye_indices[2]].y])
        p4 = np.array([landmarks[eye_indices[3]].x, landmarks[eye_indices[3]].y])
        p5 = np.array([landmarks[eye_indices[4]].x, landmarks[eye_indices[4]].y])
        p6 = np.array([landmarks[eye_indices[5]].x, landmarks[eye_indices[5]].y])

        # Vertical distances
        v1 = np.linalg.norm(p2 - p6)
        v2 = np.linalg.norm(p3 - p5)
        
        # Horizontal distance
        h = np.linalg.norm(p1 - p4)

        # EAR formula
        ear = (v1 + v2) / (2.0 * h)
        return ear

    def detect_blinks(self, image_rgb):
        """
        Returns a list of booleans indicating if each detected face is blinking.
        Note: Since face_mesh doesn't easily map to bounding boxes, this 
        returns a general blink state, but we will assume it matches the largest/closest face.
        Actually, we can match landmarks to bounding boxes by checking if landmark center is in the box.
        """
        results = self.face_mesh.process(image_rgb)
        blinking_faces = []
        
        if results.multi_face_landmarks:
            for face_landmarks in results.multi_face_landmarks:
                left_ear = self.calculate_ear(face_landmarks.landmark, self.LEFT_EYE)
                right_ear = self.calculate_ear(face_landmarks.landmark, self.RIGHT_EYE)
                
                # Average EAR
                avg_ear = (left_ear + right_ear) / 2.0
                
                # Check if eyes are closed
                is_blinking = bool(avg_ear < self.EAR_THRESH)
                
                # Calculate center of the face (nose tip is 1)
                nose = face_landmarks.landmark[1]
                h, w, _ = image_rgb.shape
                cx, cy = int(nose.x * w), int(nose.y * h)
                
                blinking_faces.append({
                    "is_blinking": is_blinking,
                    "center": (cx, cy)
                })
                
        return blinking_faces
