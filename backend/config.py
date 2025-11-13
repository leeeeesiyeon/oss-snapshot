import os
from dotenv import load_dotenv

# .env 파일 로드
load_dotenv()

# CORS 설정
CORS_ORIGINS = [
    "http://localhost:5173",  # React(Vite) 개발 서버 주소
]

# 파일 경로 설정
MODEL_FILE_NAME = "pose_model.pkl"  # 저장될 AI 모델 파일 이름
DATA_FILE_NAME = "pose_data.json"  # 학습 데이터 저장 파일 이름

# 사용 가능한 포즈 목록
AVAILABLE_POSES = ["Wink", "V sign", "Close up", "Surprise", "Background"]

