from fastapi import APIRouter, HTTPException
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from models.schemas import PoseData, PredictData
from services import pose_service
from config import AVAILABLE_POSES

router = APIRouter(prefix="/api", tags=["pose"])


@router.post("/train")
def train_pose(data: PoseData):
    """React로부터 '포즈 이름'과 '좌표'를 받아 DB에 저장"""
    count = pose_service.add_pose_data(data.label, data.features)
    return {"message": f"'{data.label}' data received", "count": count}


@router.post("/train-model")
def train_model():
    """지금까지 DB에 쌓인 모든 데이터를 AI에게 학습시킴"""
    return pose_service.train_model()


@router.post("/predict")
def predict_pose(data: PredictData):
    """React에서 보낸 '현재 좌표'를 보고, '무슨 포즈'인지 예측"""
    return pose_service.predict_pose(data.features)


@router.get("/pose-counts")
def get_pose_counts():
    """현재 학습된 포즈별 횟수를 반환"""
    return pose_service.get_pose_counts(AVAILABLE_POSES)


@router.delete("/pose/{pose_name}")
def delete_pose(pose_name: str):
    """특정 포즈의 학습 데이터를 모두 삭제"""
    deleted_count = pose_service.delete_pose(pose_name)
    return {
        "message": f"'{pose_name}' 포즈 데이터 {deleted_count}개 삭제 완료. 모델을 재학습해주세요."
    }


@router.delete("/reset-all")
def reset_all_data():
    """모든 학습 데이터와 모델 삭제"""
    total_count = pose_service.reset_all_data()
    return {
        "message": f"전체 데이터 {total_count}개 삭제 완료. 모든 학습 데이터와 모델이 삭제되었습니다."
    }

