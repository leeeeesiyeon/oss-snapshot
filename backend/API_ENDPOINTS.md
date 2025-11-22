# API 엔드포인트 매핑 확인

## 프론트엔드 → 백엔드 API 매핑

### 1. AI 보정 관련
- **프론트엔드**: `POST /api/retouch-upload` (SelectFramePage.jsx)
- **백엔드**: `routers/retouch.py` → `@router.post("/retouch-upload")`
- **상태**: ✅ 매핑 완료

### 2. 포즈 학습 관련
- **프론트엔드**: `GET /api/pose-counts` (TrainAiPage.jsx)
- **백엔드**: `routers/pose.py` → `@router.get("/pose-counts")`
- **상태**: ✅ 매핑 완료

- **프론트엔드**: `POST /api/train` (TrainAiPage.jsx)
- **백엔드**: `routers/pose.py` → `@router.post("/train")`
- **상태**: ✅ 매핑 완료

- **프론트엔드**: `POST /api/train-model` (TrainAiPage.jsx)
- **백엔드**: `routers/pose.py` → `@router.post("/train-model")`
- **상태**: ✅ 매핑 완료

### 3. 포즈 예측 관련
- **프론트엔드**: `POST /api/predict` (AiModePage.jsx)
- **백엔드**: `routers/pose.py` → `@router.post("/predict")`
- **상태**: ✅ 매핑 완료

### 4. 데이터 삭제 관련
- **프론트엔드**: `DELETE /api/reset-all` (TrainAiPage.jsx)
- **백엔드**: `routers/pose.py` → `@router.delete("/reset-all")`
- **상태**: ✅ 매핑 완료

## 백엔드 파일 구조

```
backend/
├── main.py                    # FastAPI 앱 생성 및 라우터 등록
├── config.py                  # 설정 및 상수
├── models/
│   └── schemas.py             # Pydantic 모델
├── services/
│   ├── pose_service.py        # 포즈 관련 비즈니스 로직
│   └── retouch_service.py    # AI 보정 관련 비즈니스 로직
└── routers/
    ├── pose.py                # 포즈 관련 API 엔드포인트
    └── retouch.py             # AI 보정 관련 API 엔드포인트
```

## 모든 API 엔드포인트가 정상적으로 매핑되었습니다! ✅

