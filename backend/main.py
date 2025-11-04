import os
import joblib # 1. AI 모델 저장을 위해 임포트
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict

# 2. AI 학습(뇌)을 위한 scikit-learn 임포트
from sklearn.neighbors import KNeighborsClassifier
from sklearn.exceptions import NotFittedError

# --- FastAPI 앱 설정 ---
app = FastAPI()
origins = [
    "http://localhost:5173", # React(Vite) 개발 서버 주소
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- AI 모델 및 데이터베이스 (간단한 인메모리) ---
# (서버를 껐다 켜면 학습 데이터가 날아감 - 2주 프로젝트용으로 간단하게)
pose_data_db: Dict[str, List[List[float]]] = {} # 예: { "브이": [ [좌표1], [좌표2] ] }

# 3. AI 뇌(분류기) 생성
classifier = KNeighborsClassifier(n_neighbors=3) # K-NN 알고리즘 사용

MODEL_FILE_NAME = "pose_model.pkl" # 저장될 AI 모델 파일 이름

# --- Pydantic 모델 (React가 보낼 데이터 형식) ---
class PoseData(BaseModel):
    label: str          # 예: "브이"
    features: List[float] # 예: [x1, y1, x2, y2, ...] (34개 숫자)

class PredictData(BaseModel):
    features: List[float]

# --- API 1: "이 포즈 학습" (데이터 수집) ---
@app.post("/api/train")
def train_pose(data: PoseData):
    """React로부터 '포즈 이름'과 '좌표'를 받아 DB에 저장"""
    label = data.label
    features = data.features
    
    if label not in pose_data_db:
        pose_data_db[label] = []
        
    pose_data_db[label].append(features)
    
    print(f"'{label}' 포즈 데이터 1개 수신. (총 {len(pose_data_db[label])}개)")
    return {"message": f"'{label}' data received", "count": len(pose_data_db[label])}

# --- API 2: "AI 모델 학습" (진짜 학습) ---
@app.post("/api/train-model")
def train_model():
    """지금까지 DB에 쌓인 모든 데이터를 AI에게 학습시킴"""
    if not pose_data_db:
        raise HTTPException(status_code=400, detail="학습할 데이터가 없습니다.")

    X_train = [] # 모든 좌표 데이터
    y_train = [] # 모든 이름표(라벨)
    
    for label, features_list in pose_data_db.items():
        for features in features_list:
            X_train.append(features)
            y_train.append(label)
            
    if len(X_train) < 3: # 최소 3개는 있어야 학습 가능 (n_neighbors=3)
        raise HTTPException(status_code=400, detail=f"데이터가 너무 적습니다. 최소 3개 이상 필요합니다. (현재 {len(X_train)}개)")

    # 4. AI 뇌(classifier) 학습 시작!
    classifier.fit(X_train, y_train)
    
    # 5. 학습된 AI 뇌를 파일(.pkl)로 저장
    joblib.dump(classifier, MODEL_FILE_NAME)
    
    print(f"모델 학습 완료! {len(X_train)}개의 데이터로 학습. -> {MODEL_FILE_NAME} 저장됨")
    return {"message": f"모델 학습 완료! (총 {len(X_train)}개 데이터)"}

# --- API 3: "포즈 예측" (챌린지용) ---
@app.post("/api/predict")
def predict_pose(data: PredictData):
    """React에서 보낸 '현재 좌표'를 보고, '무슨 포즈'인지 예측"""
    
    # 저장된 AI 뇌(.pkl)가 있는지 확인하고 로드
    if not os.path.exists(MODEL_FILE_NAME):
        raise HTTPException(status_code=404, detail="학습된 모델 파일(model.pkl)이 없습니다. 먼저 학습시켜주세요.")
        
    try:
        # 6. 저장된 뇌(.pkl)를 불러옴
        loaded_classifier = joblib.load(MODEL_FILE_NAME)
        
        # 7. 뇌에게 "이 좌표 뭐야?"라고 물어봄 (예측)
        prediction = loaded_classifier.predict([data.features])
        # 8. "이 포즈 90% 확신해" (신뢰도)
        probability = loaded_classifier.predict_proba([data.features])
        
        pose_name = prediction[0]
        confidence = np.max(probability[0])
        
        return {"pose": pose_name, "confidence": confidence}
        
    except NotFittedError:
         raise HTTPException(status_code=500, detail="모델이 아직 학습되지 않았습니다.")
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))

# --- API 4: "포즈 횟수 확인" ---
@app.get("/api/pose-counts")
def get_pose_counts():
    """현재 학습된 포즈별 횟수를 반환"""
    counts = {}
    for pose in AVAILABLE_POSES:
        # pose_data_db에서 직접 데이터를 가져옴
        if pose in pose_data_db:
            counts[pose] = len(pose_data_db[pose])
        else:
            counts[pose] = 0
    return counts

# 상단에 상수 추가
AVAILABLE_POSES = ["차렷!", "브이", "꽃받침", "볼하트", "배경"]

