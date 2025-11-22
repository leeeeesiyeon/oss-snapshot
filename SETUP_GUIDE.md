# 프로젝트 실행 가이드

## 📋 사전 준비사항

### 1. Python 환경 설정
- Python 3.8 이상 필요
- 가상환경 생성 및 활성화 (권장)

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Mac/Linux
python3 -m venv venv
source venv/bin/activate
```

### 2. Node.js 환경 설정
- Node.js 16 이상 필요
- npm 또는 yarn 설치 필요

## 🔧 백엔드 설정

### 1. Python 패키지 설치

```bash
cd backend
pip install -r requirements.txt
```

**필요한 주요 패키지:**
- `fastapi` - 웹 프레임워크
- `uvicorn` - ASGI 서버
- `pydantic` - 데이터 검증
- `numpy`, `scikit-learn` - 머신러닝
- `opencv-python` - 이미지 처리
- `mediapipe` - 얼굴 랜드마크 추출
- `Pillow` - 이미지 처리
- `python-dotenv` - 환경 변수 관리

### 2. 환경 변수 설정 (선택사항)

`.env` 파일 생성 (필요한 경우):
```
# .env 파일 예시
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

### 3. 백엔드 서버 실행

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

서버가 실행되면:
- API 문서: http://localhost:8000/docs
- 서버 주소: http://localhost:8000

## 🎨 프론트엔드 설정

### 1. Node.js 패키지 설치

```bash
cd frontend
npm install
```

**필요한 주요 패키지:**
- `react`, `react-dom` - React 프레임워크
- `@tensorflow/tfjs` - TensorFlow.js
- `@tensorflow-models/pose-detection` - 포즈 감지
- `@vladmandic/human` - 얼굴/포즈 감지
- `axios` - HTTP 클라이언트
- `react-router-dom` - 라우팅
- `react-webcam` - 웹캠 접근
- `vite` - 빌드 도구

### 2. 프론트엔드 개발 서버 실행

```bash
cd frontend
npm run dev
```

서버가 실행되면:
- 개발 서버: http://localhost:5173

## 🚀 전체 실행 순서

1. **터미널 1 - 백엔드 실행**
   ```bash
   cd backend
   pip install -r requirements.txt
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **터미널 2 - 프론트엔드 실행**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **브라우저에서 접속**
   - http://localhost:5173

## ⚠️ 주의사항

### MediaPipe 한글 경로 문제
- Windows에서 한글이 포함된 경로에 있을 경우 MediaPipe가 오류를 발생시킬 수 있습니다.
- `retouch_service.py`에서 임시 디렉토리를 사용하여 이 문제를 우회합니다.

### 포트 충돌
- 백엔드: 8000 포트
- 프론트엔드: 5173 포트
- 다른 서비스가 이 포트를 사용 중이면 변경이 필요합니다.

### CORS 설정
- `backend/config.py`에서 CORS 허용 주소를 설정할 수 있습니다.
- 기본값: `http://localhost:5173`, `http://127.0.0.1:5173`

## 🔍 문제 해결

### 백엔드 오류
1. **ModuleNotFoundError**: `pip install -r requirements.txt` 실행
2. **포트 이미 사용 중**: 다른 포트로 변경 (`--port 8001`)
3. **MediaPipe 오류**: Python 경로에 한글이 없도록 확인

### 프론트엔드 오류
1. **node_modules 오류**: `rm -rf node_modules` 후 `npm install` 재실행
2. **포트 이미 사용 중**: `vite.config.js`에서 포트 변경
3. **API 연결 오류**: 백엔드 서버가 실행 중인지 확인

## 📝 추가 정보

- API 엔드포인트: `backend/API_ENDPOINTS.md` 참조
- AI 보정 파이프라인: `backend/RETOUCH_PIPELINE.md` 참조

