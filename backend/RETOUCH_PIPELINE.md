# AI 보정 파이프라인

## 구현된 파이프라인

### 1단계: Replicate GFPGAN
- **목적**: 얼굴 복원 및 피부 보정
- **기능**: 
  - 피부 잡티 제거
  - 피부 톤 균일화
  - 주름 완화
  - 전반적인 얼굴 선명도 향상

### 2단계: MediaPipe FaceMesh
- **목적**: 얼굴 랜드마크 추출
- **기능**:
  - 468개 포인트 추출
  - 오프라인 동작 (빠름)
  - Google에서 만든 정확한 모델

### 3단계: OpenCV 삼각형 기반 Warping
- **목적**: 얼굴 변형 (눈 확대, 얼굴형 축소)
- **기능**:
  - Delaunay 삼각분할로 자연스러운 변형
  - 눈 주변 확대 (기본 15% 확대)
  - 턱선 안쪽으로 이동 (기본 5% 축소)
  - 자연스러운 blending

### 4단계: 결과 반환
- Base64 인코딩된 Data URL 반환
- 프론트엔드에서 바로 사용 가능

## 파라미터 조정

`backend/services/retouch_service.py`의 `enlarge_eyes_and_reduce_face` 함수에서:

```python
def enlarge_eyes_and_reduce_face(img, landmarks, eye_scale=1.15, face_scale=0.95):
```

- `eye_scale`: 눈 확대 비율 (기본 1.15 = 15% 확대)
- `face_scale`: 얼굴 축소 비율 (기본 0.95 = 5% 축소)

값을 조정하여 보정 강도를 변경할 수 있습니다.

## 에러 처리

- GFPGAN 실패 시: 원본 이미지 반환
- 얼굴 감지 실패 시: GFPGAN 결과만 반환
- Warping 실패 시: GFPGAN 결과만 반환

모든 단계에서 실패해도 최소한 GFPGAN 결과는 반환되도록 설계되었습니다.

