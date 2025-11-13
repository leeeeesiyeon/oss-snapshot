import io
import base64
import cv2
import numpy as np
from PIL import Image
from scipy.spatial import Delaunay
from fastapi import HTTPException
import sys
import os
import tempfile
import shutil
from pathlib import Path
from functools import lru_cache

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import mediapipe as mp
    from mediapipe.framework import calculator_pb2
    from mediapipe.python.solution_base import SolutionBase
    from mediapipe.python._framework_bindings import resource_util as mp_resource_util
except ImportError as e:
    raise ImportError(f"MediaPipe import failed: {e}")


# MediaPipe 리소스를 ASCII 경로로 복사하여 Windows 한글 경로 문제를 우회
_MP_PACKAGE_DIR = Path(mp.__file__).resolve().parent
_MP_SITE_ROOT = _MP_PACKAGE_DIR.parent
_HAS_NON_ASCII_PATH = any(ord(ch) > 127 for ch in str(_MP_SITE_ROOT))
_ASCII_RESOURCE_ROOT = None

if _HAS_NON_ASCII_PATH:
    temp_base = Path(tempfile.gettempdir()) / "mediapipe_ascii_resources"
    dest_dir = temp_base / "mediapipe"
    source_dir = _MP_SITE_ROOT / "mediapipe"
    if not dest_dir.exists():
        temp_base.mkdir(parents=True, exist_ok=True)
        shutil.copytree(source_dir, dest_dir, dirs_exist_ok=True)
    _ASCII_RESOURCE_ROOT = temp_base

    _original_set_resource_dir = mp_resource_util.set_resource_dir

    def _patched_set_resource_dir(path: str) -> None:
        if path and any(ord(ch) > 127 for ch in path):
            _original_set_resource_dir(str(_ASCII_RESOURCE_ROOT))
        else:
            _original_set_resource_dir(path)

    mp_resource_util.set_resource_dir = _patched_set_resource_dir  # type: ignore

else:
    _ASCII_RESOURCE_ROOT = _MP_SITE_ROOT


def _mediapipe_resource_root() -> Path:
    return Path(_ASCII_RESOURCE_ROOT)


@lru_cache(maxsize=1)
def _load_face_mesh_graph_bytes() -> bytes:
    graph_path = _mediapipe_resource_root() / "mediapipe" / "modules" / "face_landmark" / "face_landmark_front_cpu.binarypb"
    if not graph_path.exists():
        raise FileNotFoundError(f"MediaPipe graph file not found: {graph_path}")
    return graph_path.read_bytes()


class PatchedFaceMesh(SolutionBase):
    def __init__(
        self,
        static_image_mode: bool = False,
        max_num_faces: int = 1,
        refine_landmarks: bool = False,
        min_detection_confidence: float = 0.5,
        min_tracking_confidence: float = 0.5,
    ) -> None:
        graph_config = calculator_pb2.CalculatorGraphConfig()
        graph_config.ParseFromString(_load_face_mesh_graph_bytes())

        super().__init__(
            graph_config=graph_config,
            side_inputs={
                "num_faces": max_num_faces,
                "with_attention": refine_landmarks,
                "use_prev_landmarks": not static_image_mode,
            },
            calculator_params={
                "facedetectionshortrangecpu__facedetectionshortrange__facedetection__TensorsToDetectionsCalculator.min_score_thresh": min_detection_confidence,
                "facelandmarkcpu__ThresholdingCalculator.threshold": min_tracking_confidence,
            },
            outputs=["multi_face_landmarks"],
        )

    def process(self, image):  # type: ignore[override]
        return super().process(input_data={"image": image})


# MediaPipe Face Mesh 래퍼
mp_face_mesh = PatchedFaceMesh


def get_landmarks(image: np.ndarray) -> np.ndarray:
    """
    MediaPipe FaceMesh로 얼굴 랜드마크 추출
    468개 포인트 반환
    """
    # MediaPipe FaceMesh 초기화 시도
    try:
        with mp_face_mesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        ) as face_mesh:
            # RGB로 변환 (MediaPipe는 RGB를 요구)
            if len(image.shape) == 3 and image.shape[2] == 3:
                rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB) if image.dtype == np.uint8 else image
            else:
                rgb_image = image

            results = face_mesh.process(rgb_image)

    except Exception as e:
        error_msg = str(e)
        print(f"MediaPipe FaceMesh initialization error: {error_msg}")

        # 모델 파일 경로 문제인 경우 추가 정보 출력
        try:
            graph_path = _mediapipe_resource_root() / "mediapipe" / "modules" / "face_landmark" / "face_landmark_front_cpu.binarypb"
            print(f"Expected graph path: {graph_path}")
            print(f"Graph file exists: {graph_path.exists()}")
        except Exception as path_error:
            print(f"Graph path check failed: {path_error}")

        raise

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


def enlarge_eyes_and_reduce_face(img: np.ndarray, landmarks: np.ndarray, eye_scale: float = 1.10, face_scale: float = 0.90) -> np.ndarray:
    """
    눈을 크게 하고 얼굴형을 작게 만드는 warping
    - eye_scale: 눈 확대 비율 (기본 1.10 = 10% 확대)
    - face_scale: 얼굴 축소 비율 (기본 0.90 = 10% 축소)
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
    
    # 4. 자연스러운 blending (부드러운 경계선)
    # 얼굴 영역 마스크 생성
    face_mask = np.zeros((h, w), dtype=np.uint8)
    cv2.fillPoly(face_mask, [landmarks[face_oval_indices].astype(np.int32)], 255)
    
    # 얼굴 영역을 약간 확장하여 블렌딩 영역 생성
    kernel_size = max(20, int(min(h, w) * 0.05))  # 이미지 크기의 5% 정도
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
    expanded_mask = cv2.dilate(face_mask, kernel, iterations=1)
    
    # 부드러운 마스크 생성 (가우시안 블러 적용)
    blur_size = kernel_size * 2 + 1
    if blur_size % 2 == 0:
        blur_size += 1
    smooth_mask = cv2.GaussianBlur(expanded_mask.astype(np.float32), (blur_size, blur_size), 0)
    smooth_mask = smooth_mask / 255.0  # 0~1 범위로 정규화
    
    # 3채널 마스크로 변환
    smooth_mask_3d = np.stack([smooth_mask, smooth_mask, smooth_mask], axis=2)
    
    # 얼굴 영역만 블렌딩 (배경은 원본 유지)
    # 얼굴 영역: warped 이미지 사용, 배경: 원본 이미지 사용
    result = img.astype(np.float32) * (1 - smooth_mask_3d) + img_warped * smooth_mask_3d
    
    return np.clip(result, 0, 255).astype(np.uint8)


def retouch_image(image_data: bytes, filename: str) -> str:
    """
    MediaPipe FaceMesh → OpenCV Warping 파이프라인
    1. MediaPipe FaceMesh로 랜드마크 추출 (원본 이미지에서)
    2. OpenCV로 삼각형 기반 warping (눈 확대, 얼굴형 축소)
    3. 자연스러운 blending
    """
    # 이미지를 numpy 배열로 변환
    print(f"Processing image: {filename}")
    try:
        image = Image.open(io.BytesIO(image_data))
        
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # PIL Image를 numpy 배열로 변환
        img_array = np.array(image)
        print(f"Image loaded: {img_array.shape}")
    
    except Exception as e:
        error_msg = str(e)
        print(f"Image loading error: {error_msg}")
        raise HTTPException(
            status_code=500,
            detail=f"Image loading error: {error_msg}"
        )
    
    # 1단계: MediaPipe FaceMesh로 랜드마크 추출
    print("Step 1: MediaPipe FaceMesh landmark extraction")
    try:
        landmarks = get_landmarks(img_array)
        
        if landmarks is None:
            print("Warning: Face not detected, returning original image")
            # 원본 이미지를 base64로 반환
            _, buffer = cv2.imencode('.png', cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR))
            img_base64 = base64.b64encode(buffer).decode('utf-8')
            return f"data:image/png;base64,{img_base64}"
        
        print(f"Landmarks extracted: {len(landmarks)} points")
    
    except Exception as e:
        error_msg = str(e)
        print(f"Landmark extraction error: {error_msg}")
        
        # 모델 파일 경로 문제인 경우 상세 정보 출력
        if "path" in error_msg.lower() or "binarypb" in error_msg.lower():
            try:
                mp_path = os.path.dirname(mp.__file__)
                model_path = os.path.join(mp_path, 'modules', 'face_landmark', 'face_landmark_front_cpu.binarypb')
                print(f"MediaPipe installation path: {mp_path}")
                print(f"Expected model path: {model_path}")
                print(f"Model file exists: {os.path.exists(model_path)}")
                
                # 대체 경로 확인
                alt_paths = [
                    os.path.join(mp_path, 'modules', 'face_landmark'),
                    os.path.join(mp_path, '..', 'modules', 'face_landmark'),
                ]
                for alt_path in alt_paths:
                    if os.path.exists(alt_path):
                        files = os.listdir(alt_path)
                        print(f"Alternative path exists: {alt_path}, files: {files[:5]}")
            except Exception as path_error:
                print(f"Path check error: {path_error}")
        
        print("Returning original image due to landmark extraction failure")
        # 원본 이미지를 base64로 반환
        _, buffer = cv2.imencode('.png', cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR))
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        return f"data:image/png;base64,{img_base64}"
    
    # 2단계: OpenCV로 얼굴 변형 (눈 확대, 얼굴형 축소)
    print("Step 2: OpenCV triangle-based warping")
    try:
        warped_img = enlarge_eyes_and_reduce_face(img_array, landmarks)
        print("Warping completed")
    
    except Exception as e:
        print(f"Warping error: {str(e)}, returning original image")
        # 원본 이미지를 base64로 반환
        _, buffer = cv2.imencode('.png', cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR))
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        return f"data:image/png;base64,{img_base64}"
    
    # 3단계: 결과 이미지를 base64로 인코딩하여 반환
    print("Step 3: Encoding warped image")
    try:
        # PNG로 인코딩
        _, buffer = cv2.imencode('.png', cv2.cvtColor(warped_img, cv2.COLOR_RGB2BGR))
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        
        # Data URL로 반환 (프론트엔드에서 직접 사용 가능)
        data_url = f"data:image/png;base64,{img_base64}"
        
        print("Warping pipeline completed successfully")
        return data_url
    
    except Exception as e:
        print(f"Image encoding error: {str(e)}, returning original image")
        # 원본 이미지를 base64로 반환
        _, buffer = cv2.imencode('.png', cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR))
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        return f"data:image/png;base64,{img_base64}"
