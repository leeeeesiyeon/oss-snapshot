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

# Replicate API 설정
REPLICATE_API_TOKEN = os.getenv("REPLICATE_API_TOKEN", "")
if REPLICATE_API_TOKEN:
    os.environ["REPLICATE_API_TOKEN"] = REPLICATE_API_TOKEN

# GFPGAN 모델 (Replicate)
GFPGAN_MODEL = "tencentarc/gfpgan:9283608cc6b7be6b65a8e44983db012355fde4132009bf99d976b2f0896856a3"

