import os
import json
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
pose_data_db: Dict[str, List[List[float]]] = {} # 예: { "브이": [ [좌표1], [좌표2] ] }

# 3. AI 뇌(분류기) 생성
classifier = KNeighborsClassifier(n_neighbors=3) # K-NN 알고리즘 사용

MODEL_FILE_NAME = "pose_model.pkl" # 저장될 AI 모델 파일 이름
DATA_FILE_NAME = "pose_data.json" # 학습 데이터 저장 파일 이름

# 사용 가능한 포즈 목록
AVAILABLE_POSES = ["Wink", "V sign", "Close up", "Surprise", "Background"]

# --- 학습 데이터 파일 저장/로드 함수 ---
def save_pose_data():
    """학습 데이터를 JSON 파일로 저장"""
    try:
        with open(DATA_FILE_NAME, 'w', encoding='utf-8') as f:
            json.dump(pose_data_db, f, ensure_ascii=False, indent=2)
        print(f"학습 데이터 저장 완료: {DATA_FILE_NAME}")
    except Exception as e:
        print(f"학습 데이터 저장 실패: {str(e)}")

def load_pose_data():
    """JSON 파일에서 학습 데이터 로드"""
    global pose_data_db
    if os.path.exists(DATA_FILE_NAME):
        try:
            with open(DATA_FILE_NAME, 'r', encoding='utf-8') as f:
                loaded_data = json.load(f)
                # JSON은 키를 문자열로 저장하므로 그대로 사용
                pose_data_db = {k: v for k, v in loaded_data.items()}
            total_count = sum(len(data) for data in pose_data_db.values())
            print(f"학습 데이터 로드 완료: {DATA_FILE_NAME} (총 {total_count}개 데이터)")
        except Exception as e:
            print(f"학습 데이터 로드 실패: {str(e)}")
            pose_data_db = {}
    else:
        print(f"학습 데이터 파일이 없습니다. 새로 시작합니다.")
        pose_data_db = {}

# 서버 시작 시 학습 데이터 로드
load_pose_data()

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
    
    # 파일에 저장
    save_pose_data()
    
    print(f"'{label}' 포즈 데이터 1개 수신. (총 {len(pose_data_db[label])}개)")
    return {"message": f"'{label}' data received", "count": len(pose_data_db[label])}

# --- API 2: "AI 모델 학습" (진짜 학습) ---
@app.post("/api/train-model")
def train_model():
    """지금까지 DB에 쌓인 모든 데이터를 AI에게 학습시킴"""
    try:
        if not pose_data_db:
            raise HTTPException(status_code=400, detail="No training data available. Please train poses first.")

        X_train = []
        y_train = []
        
        # features 길이 확인 및 필터링
        expected_length = None
        for label, features_list in pose_data_db.items():
            for features in features_list:
                if not isinstance(features, list) or len(features) == 0:
                    continue
                
                # 첫 번째 features의 길이를 기준으로 설정
                if expected_length is None:
                    expected_length = len(features)
                
                # 길이가 다른 features는 스킵
                if len(features) != expected_length:
                    print(f"Warning: Skipping features with length {len(features)} (expected {expected_length})")
                    continue
                
                X_train.append(features)
                y_train.append(label)
                
        if len(X_train) < 3:
            raise HTTPException(status_code=400, detail=f"Not enough data. Minimum 3 samples required. (Current: {len(X_train)} samples)")

        # ✅ [추가] numpy 배열로 변환
        try:
            X_train = np.array(X_train)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to convert data to numpy array: {str(e)}")

        # ✅ [추가] (0,1) 범위로 정규화 — 좌표를 화면 크기와 무관하게 안정화
        max_val = np.max(X_train)
        if max_val != 0:  # 0으로 나누는 문제 방지
            X_train = X_train / max_val
        else:
            raise HTTPException(status_code=400, detail="All feature values are zero. Invalid training data.")

        # 포즈 개수에 따라 다른 방식 사용
        unique_poses = len(set(y_train))
        
        if unique_poses == 1:
            # 1개 포즈만 있는 경우: 이상 탐지 방식 (거리 기반)
            # 학습 데이터의 평균과 표준편차를 저장하여 거리 기반 판단
            pose_name = y_train[0]
            mean_pose = np.mean(X_train, axis=0)
            std_pose = np.std(X_train, axis=0)
            # 표준편차가 0인 경우를 대비해 작은 값 추가
            std_pose = np.where(std_pose == 0, 0.001, std_pose)
            
            # 모델 대신 통계 정보를 저장 (dict 형태)
            model_data = {
                "type": "anomaly_detection",
                "pose_name": pose_name,
                "mean": mean_pose.tolist(),
                "std": std_pose.tolist(),
                "threshold_multiplier": 2.0  # 평균 ± 2*표준편차 범위 내면 해당 포즈로 판단
            }
            
            try:
                joblib.dump(model_data, MODEL_FILE_NAME)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to save model: {str(e)}")
            
            print(f"이상 탐지 모델 학습 완료! {len(X_train)}개의 데이터로 학습. (포즈: {pose_name})")
            return {"message": f"Anomaly detection model trained! (Total: {len(X_train)} samples, Pose: {pose_name})"}
        else:
            # 2개 이상 포즈가 있는 경우: 기존 K-NN 분류기 사용
            # ✅ KNN 학습
            try:
                classifier.fit(X_train, y_train)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to train classifier: {str(e)}")
            
            # ✅ 저장
            try:
                joblib.dump(classifier, MODEL_FILE_NAME)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to save model: {str(e)}")
            
            print(f"모델 학습 완료! {len(X_train)}개의 데이터로 학습. (정규화 적용됨) -> {MODEL_FILE_NAME} 저장됨")
            return {"message": f"Model training completed! (Total: {len(X_train)} samples, {len(set(y_train))} poses, normalization applied)"}
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error during model training: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error during model training: {str(e)}")

# --- API 3: "포즈 예측" ---
@app.post("/api/predict")
def predict_pose(data: PredictData):
    """React에서 보낸 '현재 좌표'를 보고, '무슨 포즈'인지 예측"""
    
    # 저장된 AI 뇌(.pkl)가 있는지 확인하고 로드
    if not os.path.exists(MODEL_FILE_NAME):
        raise HTTPException(status_code=404, detail="학습된 모델 파일(model.pkl)이 없습니다. 먼저 학습시켜주세요.")
        
    try:
        # 6. 저장된 뇌(.pkl)를 불러옴
        loaded_model = joblib.load(MODEL_FILE_NAME)
        
        # 모델 타입 확인
        if isinstance(loaded_model, dict) and loaded_model.get("type") == "anomaly_detection":
            # 이상 탐지 방식 (1개 포즈)
            pose_name = loaded_model["pose_name"]
            mean_pose = np.array(loaded_model["mean"])
            std_pose = np.array(loaded_model["std"])
            threshold_multiplier = loaded_model.get("threshold_multiplier", 2.0)
            
            # 입력 데이터 정규화 (학습 시와 동일한 방식)
            features_array = np.array([data.features])
            max_val = np.max(features_array)
            if max_val != 0:
                features_array = features_array / max_val
            else:
                raise HTTPException(status_code=400, detail="Invalid input features")
            
            # 평균과의 거리 계산 (Z-score 방식)
            normalized_diff = np.abs((features_array[0] - mean_pose) / std_pose)
            max_z_score = np.max(normalized_diff)
            
            # 임계값 이내면 해당 포즈로 판단
            if max_z_score <= threshold_multiplier:
                # 거리가 가까울수록 높은 신뢰도
                confidence = max(0.0, min(1.0, 1.0 - (max_z_score / threshold_multiplier) * 0.3))
            else:
                # 임계값을 넘으면 "Unknown" 또는 낮은 신뢰도
                pose_name = "Unknown"
                confidence = 0.0
            
            return {"pose": pose_name, "confidence": confidence}
        else:
            # 기존 K-NN 분류기 방식 (2개 이상 포즈)
            loaded_classifier = loaded_model
            
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

# --- API 5: "특정 포즈 데이터 삭제" ---
@app.delete("/api/pose/{pose_name}")
def delete_pose(pose_name: str):
    """특정 포즈의 학습 데이터를 모두 삭제"""
    if pose_name not in pose_data_db:
        raise HTTPException(status_code=404, detail=f"'{pose_name}' 포즈 데이터가 없습니다.")
    
    deleted_count = len(pose_data_db[pose_name])
    del pose_data_db[pose_name]
    
    # 파일에 저장
    save_pose_data()
    
    # 모델 파일도 삭제 (데이터가 변경되었으므로 재학습 필요)
    if os.path.exists(MODEL_FILE_NAME):
        os.remove(MODEL_FILE_NAME)
    
    print(f"'{pose_name}' 포즈 데이터 {deleted_count}개 삭제 완료")
    return {"message": f"'{pose_name}' 포즈 데이터 {deleted_count}개 삭제 완료. 모델을 재학습해주세요."}

# --- API 6: "전체 데이터 삭제" ---
@app.delete("/api/reset-all")
def reset_all_data():
    """모든 학습 데이터와 모델 삭제 (이전에 했던 모든 학습들 포함)"""
    total_count = sum(len(data) for data in pose_data_db.values())
    
    # 모든 포즈 데이터 삭제
    pose_data_db.clear()
    
    # 학습 데이터 파일 삭제
    if os.path.exists(DATA_FILE_NAME):
        os.remove(DATA_FILE_NAME)
        print(f"학습 데이터 파일 삭제: {DATA_FILE_NAME}")
    
    # 모델 파일도 삭제 (혹시 다른 이름으로 저장된 파일도 확인)
    if os.path.exists(MODEL_FILE_NAME):
        os.remove(MODEL_FILE_NAME)
    
    # 혹시 다른 위치에 저장된 모델 파일도 삭제
    model_variants = ["model.pkl", "pose_model.pkl", "trained_model.pkl"]
    for variant in model_variants:
        if os.path.exists(variant):
            os.remove(variant)
    
    # 분류기도 초기화
    global classifier
    classifier = KNeighborsClassifier(n_neighbors=3)
    
    print(f"전체 데이터 {total_count}개 삭제 완료 (모든 학습 데이터 및 모델 파일 삭제됨)")
    return {"message": f"전체 데이터 {total_count}개 삭제 완료. 모든 학습 데이터와 모델이 삭제되었습니다."}

