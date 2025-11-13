from pydantic import BaseModel
from typing import List

# Pydantic 모델 (React가 보낼 데이터 형식)
class PoseData(BaseModel):
    label: str          # 예: "브이"
    features: List[float] # 예: [x1, y1, x2, y2, ...] (34개 숫자)

class PredictData(BaseModel):
    features: List[float]

