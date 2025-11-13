import io
import time
import base64
import cv2
import numpy as np
import mediapipe as mp
from PIL import Image
import replicate
import requests
from scipy.spatial import Delaunay
from fastapi import HTTPException
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import REPLICATE_API_TOKEN, GFPGAN_MODEL

# MediaPipe Face Mesh 초기화
mp_face_mesh = mp.solutions.face_mesh
mp_drawing = mp.solutions.drawing_utils


def get_landmarks(image: np.ndarray) -> np.ndarray:
    """
    MediaPipe FaceMesh로 얼굴 랜드마크 추출
    468개 포인트 반환
    """
    with mp_face_mesh.FaceMesh(
        static_image_mode=True,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5
    ) as face_mesh:
        results = face_mesh.process(image)
        
        if not results.multi_face_landmarks:
            return None
        
        face_landmarks = results.multi_face_landmarks[0]
        h, w = image.shape[:2]
        
        landmarks = []
        for landmark in face_landmarks.landmark:
            x = int(landmark.x * w)
            y = int(landmark.y * h)
            landmarks.append([x, y])
        
        return np.array(landmarks, dtype=np.int32)


def apply_affine_transform(src, src_tri, dst_tri, size):
    """
    삼각형 영역에 affine 변환 적용
    """
    warp_mat = cv2.getAffineTransform(np.float32(src_tri), np.float32(dst_tri))
    dst = cv2.warpAffine(src, warp_mat, (size[0], size[1]), None,
                         flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT_101)
    return dst


def warp_triangle(img1, img2, t1, t2):
    """
    삼각형 영역을 warping
    """
    r1 = cv2.boundingRect(t1)
    r2 = cv2.boundingRect(t2)
    
    t1_rect = []
    t2_rect = []
    
    for i in range(0, 3):
        t1_rect.append(((t1[i][0] - r1[0]), (t1[i][1] - r1[1])))
        t2_rect.append(((t2[i][0] - r2[0]), (t2[i][1] - r2[1])))
    
    mask = np.zeros((r2[3], r2[2], 3), dtype=np.float32)
    cv2.fillConvexPoly(mask, np.int32(t2_rect), (1.0, 1.0, 1.0), 16, 0)
    
    img1_rect = img1[r1[1]:r1[1] + r1[3], r1[0]:r1[0] + r1[2]]
    size = (r2[2], r2[3])
    
    img2_rect = apply_affine_transform(img1_rect, t1_rect, t2_rect, size)
    
    img2[r2[1]:r2[1] + r2[3], r2[0]:r2[0] + r2[2]] = img2[r2[1]:r2[1] + r2[3], r2[0]:r2[0] + r2[2]] * (1 - mask) + img2_rect * mask


def enlarge_eyes_and_reduce_face(img: np.ndarray, landmarks: np.ndarray, eye_scale: float = 1.15, face_scale: float = 0.95) -> np.ndarray:
    """
    눈을 크게 하고 얼굴형을 작게 만드는 warping
    - eye_scale: 눈 확대 비율 (기본 1.15 = 15% 확대)
    - face_scale: 얼굴 축소 비율 (기본 0.95 = 5% 축소)
    """
    h, w = img.shape[:2]
    img_warped = img.copy().astype(np.float32)
    
    # 새로운 랜드마크 (변형된 좌표)
    new_landmarks = landmarks.copy().astype(np.float32)
    
    # 눈 영역 랜드마크 인덱스 (MediaPipe Face Mesh)
    # 왼쪽 눈 중심 근처
    left_eye_indices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
    # 오른쪽 눈 중심 근처
    right_eye_indices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
    
    # 얼굴 윤곽 인덱스 (턱선 포함)
    face_oval_indices = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
    
    # 1. 눈 확대
    # 왼쪽 눈 중심 계산
    left_eye_points = landmarks[left_eye_indices]
    left_eye_center = np.mean(left_eye_points, axis=0)
    
    # 왼쪽 눈 랜드마크를 중심으로 확대
    for idx in left_eye_indices:
        if idx < len(new_landmarks):
            direction = new_landmarks[idx] - left_eye_center
            new_landmarks[idx] = left_eye_center + direction * eye_scale
    
    # 오른쪽 눈 중심 계산
    right_eye_points = landmarks[right_eye_indices]
    right_eye_center = np.mean(right_eye_points, axis=0)
    
    # 오른쪽 눈 랜드마크를 중심으로 확대
    for idx in right_eye_indices:
        if idx < len(new_landmarks):
            direction = new_landmarks[idx] - right_eye_center
            new_landmarks[idx] = right_eye_center + direction * eye_scale
    
    # 2. 얼굴형 축소 (턱선 안쪽으로)
    # 얼굴 중심 계산
    face_center = np.mean(landmarks[face_oval_indices], axis=0)
    
    # 얼굴 윤곽 랜드마크를 중심으로 축소
    for idx in face_oval_indices:
        if idx < len(new_landmarks):
            direction = new_landmarks[idx] - face_center
            new_landmarks[idx] = face_center + direction * face_scale
    
    # 3. Delaunay 삼각분할로 자연스러운 warping
    # 얼굴 영역의 경계점 추가 (이미지 경계)
    boundary_points = np.array([
        [0, 0], [w//2, 0], [w-1, 0],
        [w-1, h//2], [w-1, h-1], [w//2, h-1], [0, h-1], [0, h//2]
    ], dtype=np.float32)
    
    # 원본과 변형된 랜드마크에 경계점 추가
    points1 = np.vstack([landmarks.astype(np.float32), boundary_points])
    points2 = np.vstack([new_landmarks.astype(np.float32), boundary_points])
    
    # Delaunay 삼각분할
    try:
        tri = Delaunay(points1)
    except:
        # 삼각분할 실패 시 원본 반환
        return img.astype(np.uint8)
    
    # 각 삼각형에 대해 warping 적용
    for i in range(len(tri.simplices)):
        t1 = points1[tri.simplices[i]]
        t2 = points2[tri.simplices[i]]
        
        # 삼각형이 이미지 경계 내에 있는지 확인
        if (np.all(t1[:, 0] >= 0) and np.all(t1[:, 0] < w) and
            np.all(t1[:, 1] >= 0) and np.all(t1[:, 1] < h) and
            np.all(t2[:, 0] >= 0) and np.all(t2[:, 0] < w) and
            np.all(t2[:, 1] >= 0) and np.all(t2[:, 1] < h)):
            warp_triangle(img.astype(np.float32), img_warped, t1, t2)
    
    # 4. 자연스러운 blending (가우시안 블러로 경계 부드럽게)
    mask = np.ones((h, w), dtype=np.float32)
    cv2.fillPoly(mask, [landmarks[face_oval_indices].astype(np.int32)], 0)
    mask = cv2.GaussianBlur(mask, (21, 21), 0)
    mask = np.stack([mask, mask, mask], axis=2)
    
    result = img.astype(np.float32) * mask + img_warped * (1 - mask)
    
    return np.clip(result, 0, 255).astype(np.uint8)


def download_image_from_url(url: str) -> np.ndarray:
    """
    URL에서 이미지 다운로드하여 numpy 배열로 변환
    """
    response = requests.get(url, timeout=30)
    if response.status_code != 200:
        raise HTTPException(status_code=500, detail=f"Failed to download image from URL: {url}")
    
    img_array = np.frombuffer(response.content, np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=500, detail="Failed to decode image")
    
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)


def retouch_image(image_data: bytes, filename: str) -> str:
    """
    Replicate GFPGAN → MediaPipe FaceMesh → OpenCV Warping 파이프라인
    1. GFPGAN으로 얼굴 복원
    2. MediaPipe FaceMesh로 랜드마크 추출
    3. OpenCV로 삼각형 기반 warping (눈 확대, 턱선 축소)
    4. 자연스러운 blending
    """
    # Replicate API 토큰 확인
    if not REPLICATE_API_TOKEN:
        raise HTTPException(
            status_code=500,
            detail="Replicate API token not configured. Please set REPLICATE_API_TOKEN environment variable."
        )
    
    # 1단계: GFPGAN으로 얼굴 복원
    print(f"Step 1: GFPGAN face restoration for {filename}")
    image = Image.open(io.BytesIO(image_data))
    
    if image.mode != 'RGB':
        image = image.convert('RGB')
    
    print(f"Processing image: {filename} (Size: {image.size})")
    
    try:
        img_bytes = io.BytesIO()
        image.save(img_bytes, format='PNG')
        img_bytes.seek(0)
        
        start_time = time.time()
        output = replicate.run(
            GFPGAN_MODEL,
            input={
                "img": img_bytes,
            }
        )
        elapsed_time = time.time() - start_time
        print(f"GFPGAN completed in {elapsed_time:.2f} seconds")
        
        if isinstance(output, str):
            enhanced_image_url = output
        elif isinstance(output, list) and len(output) > 0:
            enhanced_image_url = output[0]
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Unexpected output format from Replicate: {type(output)}"
            )
        
        print(f"GFPGAN result URL: {enhanced_image_url}")
    
    except Exception as e:
        error_msg = str(e)
        print(f"GFPGAN error: {error_msg}")
        raise HTTPException(
            status_code=500,
            detail=f"GFPGAN processing error: {error_msg}"
        )
    
    # 2단계: MediaPipe FaceMesh로 랜드마크 추출
    print("Step 2: MediaPipe FaceMesh landmark extraction")
    try:
        enhanced_img = download_image_from_url(enhanced_image_url)
        landmarks = get_landmarks(enhanced_img)
        
        if landmarks is None:
            print("Warning: Face not detected, returning GFPGAN result only")
            return enhanced_image_url
        
        print(f"Landmarks extracted: {len(landmarks)} points")
    
    except Exception as e:
        print(f"Landmark extraction error: {str(e)}, returning GFPGAN result only")
        return enhanced_image_url
    
    # 3단계: OpenCV로 얼굴 변형 (눈 확대, 얼굴형 축소)
    print("Step 3: OpenCV triangle-based warping")
    try:
        warped_img = enlarge_eyes_and_reduce_face(enhanced_img, landmarks)
        print("Warping completed")
    
    except Exception as e:
        print(f"Warping error: {str(e)}, returning GFPGAN result only")
        return enhanced_image_url
    
    # 4단계: 결과 이미지를 임시 파일로 저장하고 URL 반환
    # 실제 배포 환경에서는 클라우드 스토리지(S3, Cloudinary 등)에 업로드해야 함
    # 여기서는 base64로 인코딩하여 반환하거나, 임시 서버에 저장
    print("Step 4: Saving warped image")
    
    # 임시로 base64 인코딩된 데이터 URL 반환 (실제로는 클라우드 스토리지 사용 권장)
    # 또는 로컬 서버에 저장하고 URL 반환
    try:
        # PNG로 인코딩
        _, buffer = cv2.imencode('.png', cv2.cvtColor(warped_img, cv2.COLOR_RGB2BGR))
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        
        # Data URL로 반환 (프론트엔드에서 직접 사용 가능)
        data_url = f"data:image/png;base64,{img_base64}"
        
        print("Warping pipeline completed successfully")
        return data_url
    
    except Exception as e:
        print(f"Image encoding error: {str(e)}, returning GFPGAN result only")
        return enhanced_image_url
