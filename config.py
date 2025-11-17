import os

# Roboflow API Configuration
ROBOFLOW_API_URL = "https://detect.roboflow.com/app-jqdgo/11"
ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY", "azvtlf6ccogUJKtpM2m9")

# Detection Configuration
CONFIDENCE_THRESHOLD = 0.3  # 50% - Only show detections above this confidence level

# Flask Configuration
UPLOAD_FOLDER = 'static/uploads'
