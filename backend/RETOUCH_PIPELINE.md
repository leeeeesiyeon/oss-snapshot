# AI 보정 파이프라인

## 구현된 파이프라인

### 1단계: MediaPipe FaceMesh
- **목적**: 얼굴 랜드마크 추출
- **기능**:
  - 468개 포인트 추출
  - 오프라인 동작 (빠름)
  - Google에서 만든 정확한 모델

### 2단계: OpenCV 삼각형 기반 Warping
- **목적**: 얼굴 변형 (눈 확대, 얼굴형 축소)
- **기능**:
  - Delaunay 삼각분할로 자연스러운 변형
  - 눈 주변 확대 (기본 10% 확대)
  - 얼굴형 축소 (기본 10% 축소)
  - 부드러운 가우시안 블러 블렌딩

### 3단계: 결과 반환
- Base64 인코딩된 Data URL 반환
- 프론트엔드에서 바로 사용 가능

## 파라미터 조정

`backend/services/retouch_service.py`의 `enlarge_eyes_and_reduce_face` 함수에서:

```python
def enlarge_eyes_and_reduce_face(img, landmarks, eye_scale=1.10, face_scale=0.90):
```

- `eye_scale`: 눈 확대 비율 (기본 1.10 = 10% 확대)
- `face_scale`: 얼굴 축소 비율 (기본 0.90 = 10% 축소)

값을 조정하여 보정 강도를 변경할 수 있습니다.

## 에러 처리

- 얼굴 감지 실패 시: 원본 이미지 반환
- Warping 실패 시: 원본 이미지 반환
- 모든 단계에서 실패해도 원본 이미지는 반환되도록 설계되었습니다.
