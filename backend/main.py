from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import pose, retouch
from services import pose_service
from config import CORS_ORIGINS

# FastAPI 앱 생성
app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 서버 시작 시 학습 데이터 로드
pose_service.load_pose_data()

# 라우터 등록
app.include_router(pose.router)
app.include_router(retouch.router)
