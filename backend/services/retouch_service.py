import io
import base64
import cv2
import numpy as np
from PIL import Image
from fastapi import HTTPException
import sys
import os
import tempfile
import shutil
from pathlib import Path
from functools import lru_cache

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import importlib.util


# =========================
# MediaPipe ASCII 경로 준비
# =========================

ASCII_MP_SITE = Path(tempfile.gettempdir()) / "mediapipe_ascii_site"
ASCII_MP_PACKAGE = ASCII_MP_SITE / "mediapipe"


def _prepare_mediapipe_package():
    if not ASCII_MP_PACKAGE.exists():
        spec = importlib.util.find_spec("mediapipe")
        if spec is None or spec.origin is None:
            raise ImportError("mediapipe package not found in site-packages")
        source_pkg = Path(spec.origin).resolve().parent
        ASCII_MP_SITE.mkdir(parents=True, exist_ok=True)
        if ASCII_MP_PACKAGE.exists():
            shutil.rmtree(ASCII_MP_PACKAGE)
        shutil.copytree(source_pkg, ASCII_MP_PACKAGE, dirs_exist_ok=True)

    if str(ASCII_MP_SITE) not in sys.path:
        sys.path.insert(0, str(ASCII_MP_SITE))

    if "mediapipe" in sys.modules:
        del sys.modules["mediapipe"]


_prepare_mediapipe_package()

import mediapipe as mp
from mediapipe.python._framework_bindings import resource_util as mp_resource_util


# =========================
# 0. MediaPipe 리소스 경로 ASCII로 강제
#    (윈도우 한글 경로 문제 우회)
# =========================

_MP_PACKAGE_DIR = Path(mp.__file__).resolve().parent
_MP_SITE_ROOT = _MP_PACKAGE_DIR.parent


def _setup_mediapipe_resource_dir():
    mp_resource_util.set_resource_dir(str(_MP_SITE_ROOT))


@lru_cache(maxsize=1)
def _init_mediapipe():
    _setup_mediapipe_resource_dir()
    return True


def get_landmarks(image: np.ndarray) -> np.ndarray:
    """
    MediaPipe FaceMesh로 얼굴 랜드마크 추출 (468 포인트)
    """
    _init_mediapipe()

    h, w = image.shape[:2]

    if len(image.shape) == 3 and image.shape[2] == 3:
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    else:
        rgb_image = image

    try:
        with mp.solutions.face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        ) as face_mesh:
            results = face_mesh.process(rgb_image)
    except Exception as e:
        print("[get_landmarks] FaceMesh error:", e)
        return None

    if not results.multi_face_landmarks:
        print("[get_landmarks] No face detected")
        return None

    face_landmarks = results.multi_face_landmarks[0]
    landmarks = []
    for lm in face_landmarks.landmark:
        x = int(lm.x * w)
        y = int(lm.y * h)
        landmarks.append([x, y])

    return np.array(landmarks, dtype=np.int32)


# =========================
# 2. 인덱스 정의
# =========================

LEFT_EYE_IDX = [
    33, 7, 163, 144, 145, 153, 154, 155,
    133, 173, 157, 158, 159, 160, 161, 246
]

RIGHT_EYE_IDX = [
    362, 382, 381, 380, 374, 373, 390, 249,
    263, 466, 388, 387, 386, 385, 384, 398
]

FACE_OVAL_IDX = [
    10, 338, 297, 332, 284, 251, 389, 356,
    454, 323, 361, 288, 397, 365, 379, 378,
    400, 377, 152, 148, 176, 149, 150, 136,
    172, 58, 132, 93, 234, 127, 162, 21,
    54, 103, 67, 109
]


# =========================
# 3. 유틸
# =========================

def safe_crop(img, x1, y1, x2, y2):
    h, w = img.shape[:2]
    x1 = max(0, min(w - 1, x1))
    x2 = max(0, min(w, x2))
    y1 = max(0, min(h - 1, y1))
    y2 = max(0, min(h, y2))
    if x2 <= x1 or y2 <= y1:
        return None, x1, y1, x2, y2
    return img[y1:y2, x1:x2].copy(), x1, y1, x2, y2


# =========================
# 4. 눈 확대 (패치 리사이즈 + 원형 마스크)
# =========================

def enlarge_eye_simple(img: np.ndarray, landmarks: np.ndarray, eye_indices, scale: float) -> np.ndarray:
    h, w, _ = img.shape
    eye_pts = landmarks[eye_indices].astype(np.int32)
    ex, ey, ew, eh = cv2.boundingRect(eye_pts)

    pad = int(max(ew, eh) * 0.3)
    cx = ex + ew // 2
    cy = ey + eh // 2

    x1 = cx - (ew // 2 + pad)
    x2 = cx + (ew // 2 + pad)
    y1 = cy - (eh // 2 + pad)
    y2 = cy + (eh // 2 + pad)

    patch, x1, y1, x2, y2 = safe_crop(img, x1, y1, x2, y2)
    if patch is None:
        return img

    ph, pw = patch.shape[:2]
    new_w = int(pw * scale)
    new_h = int(ph * scale)
    resized = cv2.resize(patch, (new_w, new_h), interpolation=cv2.INTER_CUBIC)

    cx_local = (x2 - x1) // 2
    cy_local = (y2 - y1) // 2
    nx1 = cx_local - new_w // 2
    ny1 = cy_local - new_h // 2
    nx2 = nx1 + new_w
    ny2 = ny1 + new_h

    nx1_clip = max(0, nx1)
    ny1_clip = max(0, ny1)
    nx2_clip = min(pw, nx2)
    ny2_clip = min(ph, ny2)

    rx1 = nx1_clip - nx1
    ry1 = ny1_clip - ny1
    rx2 = rx1 + (nx2_clip - nx1_clip)
    ry2 = ry1 + (ny2_clip - ny1_clip)

    if nx2_clip <= nx1_clip or ny2_clip <= ny1_clip:
        return img

    patch_target = patch[ny1_clip:ny2_clip, nx1_clip:nx2_clip].astype(np.float32)
    patch_resized = resized[ry1:ry2, rx1:rx2].astype(np.float32)

    hh, ww = patch_target.shape[:2]
    yy, xx = np.ogrid[:hh, :ww]
    cy0 = hh / 2.0
    cx0 = ww / 2.0
    radius = min(hh, ww) / 2.0
    dist = np.sqrt((xx - cx0) ** 2 + (yy - cy0) ** 2)
    mask = (dist <= radius).astype(np.float32)
    mask = cv2.GaussianBlur(mask, (0, 0), radius * 0.4)
    mask3 = mask[..., None]

    blended = patch_target * (1 - mask3) + patch_resized * mask3
    blended = np.clip(blended, 0, 255).astype(np.uint8)

    out = img.copy()
    out[y1:y2, x1:x2][ny1_clip:ny2_clip, nx1_clip:nx2_clip] = blended
    return out


def enlarge_eyes(img: np.ndarray, landmarks: np.ndarray, scale: float = 1.1) -> np.ndarray:
    out = img.copy()
    before = out.copy()
    out = enlarge_eye_simple(out, landmarks, LEFT_EYE_IDX, scale)
    out = enlarge_eye_simple(out, landmarks, RIGHT_EYE_IDX, scale)
    diff_eye = np.mean(np.abs(out.astype(np.int32) - before.astype(np.int32)))
    print(f"[enlarge_eyes] mean abs diff: {diff_eye:.2f} (scale={scale})")
    return out


# =========================
# 5. 하관 슬림 (턱 + 아래 영역 포함)
# =========================

def slim_lower_face(
    img: np.ndarray,
    landmarks: np.ndarray,
    face_scale: float = 0.9,
    lower_start_ratio: float = 0.55,
    extra_bottom_ratio: float = 0.4,
    side_margin_ratio: float = 0.15,
) -> np.ndarray:
    """
    - face_scale: 하관 가로 축소 비율 (0.9 = 10% 줄이기)
    - lower_start_ratio: ROI 안에서 어느 y부터 하관으로 볼지 (0~1)
    - extra_bottom_ratio: 턱 아래로 얼굴 높이의 몇 %까지 같이 줄일지
    - side_margin_ratio: 좌우로 얼굴 폭의 몇 %까지 더 포함할지
    """
    h, w, _ = img.shape
    oval = landmarks[FACE_OVAL_IDX].astype(np.int32)

    ox, oy, ofw, ofh = cv2.boundingRect(oval)
    if ofw <= 0 or ofh <= 0:
        return img

    extra_bottom = int(ofh * extra_bottom_ratio)
    side_margin = int(ofw * side_margin_ratio)

    x1 = max(0, ox - side_margin)
    y1 = max(0, oy)
    x2 = min(w, ox + ofw + side_margin)
    y2 = min(h, oy + ofh + extra_bottom)

    face_roi, x1, y1, x2, y2 = safe_crop(img, x1, y1, x2, y2)
    if face_roi is None:
        return img

    fh, fw = face_roi.shape[:2]

    local_oval = oval - np.array([x1, y1])

    mask_face = np.zeros((fh, fw), dtype=np.float32)
    cv2.fillConvexPoly(mask_face, local_oval, 1.0)

    # 턱 y 위치 (local)
    chin_y_local = int(local_oval[:, 1].max())
    if 0 <= chin_y_local < fh:
        # 턱 아래는 전부 1 → 턱 아래 영역 전체가 슬림 대상
        mask_face[chin_y_local:, :] = 1.0

    # 가로 축소한 버전
    new_w = int(fw * face_scale)
    if new_w < 1:
        new_w = 1

    squeezed = cv2.resize(face_roi, (new_w, fh), interpolation=cv2.INTER_LINEAR)
    pad_total = fw - new_w
    pad_left = pad_total // 2
    pad_right = pad_total - pad_left
    squeezed_full = cv2.copyMakeBorder(
        squeezed,
        top=0, bottom=0,
        left=pad_left, right=pad_right,
        borderType=cv2.BORDER_REPLICATE,
    )

    # y 방향 가중치 (윗부분 0, 아래쪽 1)
    weight_y = np.zeros((fh, 1), dtype=np.float32)
    start_y = int(fh * lower_start_ratio)
    for yy in range(fh):
        if yy <= start_y:
            alpha = 0.0
        else:
            alpha = (yy - start_y) / max(1, (fh - start_y))
        weight_y[yy, 0] = np.clip(alpha, 0.0, 1.0)

    weight = weight_y * mask_face[:, :, None]
    weight = cv2.GaussianBlur(weight, (0, 0), fh * 0.15)
    weight = np.clip(weight, 0.0, 1.0)

    weight3 = np.repeat(weight, 3, axis=2)

    face_roi_f = face_roi.astype(np.float32)
    squeezed_f = squeezed_full.astype(np.float32)

    blended = face_roi_f * (1.0 - weight3) + squeezed_f * weight3
    blended = np.clip(blended, 0, 255).astype(np.uint8)

    out = img.copy()
    out[y1:y2, x1:x2] = blended
    diff_lower = np.mean(np.abs(blended.astype(np.int32) - face_roi.astype(np.int32)))
    print(f"[slim_lower_face] fw:{fw} -> {new_w} | weight max:{weight.max():.3f}, mean diff:{diff_lower:.2f}")
    return out


# =========================
# 6. 피부 보정 (얼굴 영역만 선택적 스무딩)
# =========================

def smooth_skin(
    img: np.ndarray,
    landmarks: np.ndarray,
    strength: float = 0.5,
    d: int = 9,
    sigma_color: float = 75.0,
    sigma_space: float = 75.0,
) -> np.ndarray:
    """
    얼굴 영역만 선택적으로 피부 보정 (Bilateral 필터 사용)
    
    - strength: 보정 강도 (0.0 ~ 1.0, 기본 0.5)
    - d: Bilateral 필터 직경 (기본 9)
    - sigma_color: 색상 공간 표준편차 (기본 75.0)
    - sigma_space: 좌표 공간 표준편차 (기본 75.0)
    """
    h, w, _ = img.shape
    oval = landmarks[FACE_OVAL_IDX].astype(np.int32)
    
    # 얼굴 영역 마스크 생성
    mask_face = np.zeros((h, w), dtype=np.float32)
    cv2.fillConvexPoly(mask_face, oval, 1.0)
    
    # 눈과 입 영역은 제외 (약하게 보정)
    # 왼쪽 눈 영역
    left_eye_pts = landmarks[LEFT_EYE_IDX].astype(np.int32)
    left_eye_rect = cv2.boundingRect(left_eye_pts)
    eye_pad = int(max(left_eye_rect[2], left_eye_rect[3]) * 0.5)
    left_eye_x1 = max(0, left_eye_rect[0] - eye_pad)
    left_eye_y1 = max(0, left_eye_rect[1] - eye_pad)
    left_eye_x2 = min(w, left_eye_rect[0] + left_eye_rect[2] + eye_pad)
    left_eye_y2 = min(h, left_eye_rect[1] + left_eye_rect[3] + eye_pad)
    
    # 오른쪽 눈 영역
    right_eye_pts = landmarks[RIGHT_EYE_IDX].astype(np.int32)
    right_eye_rect = cv2.boundingRect(right_eye_pts)
    eye_pad = int(max(right_eye_rect[2], right_eye_rect[3]) * 0.5)
    right_eye_x1 = max(0, right_eye_rect[0] - eye_pad)
    right_eye_y1 = max(0, right_eye_rect[1] - eye_pad)
    right_eye_x2 = min(w, right_eye_rect[0] + right_eye_rect[2] + eye_pad)
    right_eye_y2 = min(h, right_eye_rect[1] + right_eye_rect[3] + eye_pad)
    
    # 눈 영역 마스크 생성 (가우시안으로 부드럽게)
    eye_mask = np.zeros((h, w), dtype=np.float32)
    cv2.rectangle(eye_mask, (left_eye_x1, left_eye_y1), (left_eye_x2, left_eye_y2), 1.0, -1)
    cv2.rectangle(eye_mask, (right_eye_x1, right_eye_y1), (right_eye_x2, right_eye_y2), 1.0, -1)
    sigma_eye = max(w, h) * 0.02
    ksize_eye = int(sigma_eye * 6) | 1  # 홀수로 만들기
    if ksize_eye < 3:
        ksize_eye = 3
    eye_mask = cv2.GaussianBlur(eye_mask, (ksize_eye, ksize_eye), sigma_eye)
    
    # 입 영역 (랜드마크 12, 15, 16, 17, 18, 19, 20, 61, 84, 17, 314, 405, 320, 307, 375, 321, 308, 324, 318)
    # 간단하게 턱 아래쪽 일부 영역 제외
    chin_y = int(oval[:, 1].max())
    mouth_y_start = int(chin_y - (chin_y - oval[:, 1].min()) * 0.3)
    mouth_mask = np.zeros((h, w), dtype=np.float32)
    mouth_mask[mouth_y_start:chin_y, :] = 1.0
    sigma_mouth = max(w, h) * 0.015
    ksize_mouth = int(sigma_mouth * 6) | 1
    if ksize_mouth < 3:
        ksize_mouth = 3
    mouth_mask = cv2.GaussianBlur(mouth_mask, (ksize_mouth, ksize_mouth), sigma_mouth)
    
    # 최종 마스크: 얼굴 영역에서 눈과 입은 약하게 (30% 강도)
    final_mask = mask_face.copy()
    final_mask = final_mask * (1.0 - eye_mask * 0.7)  # 눈 영역은 30%만 적용
    final_mask = final_mask * (1.0 - mouth_mask * 0.5)  # 입 영역은 50%만 적용
    sigma_final = max(w, h) * 0.01
    ksize_final = int(sigma_final * 6) | 1
    if ksize_final < 3:
        ksize_final = 3
    final_mask = cv2.GaussianBlur(final_mask, (ksize_final, ksize_final), sigma_final)
    final_mask = np.clip(final_mask, 0.0, 1.0)
    
    # Bilateral 필터로 스무딩 (텍스처 보존)
    smoothed = cv2.bilateralFilter(img, d, sigma_color, sigma_space)
    
    # 원본과 블렌딩 (strength에 따라)
    img_f = img.astype(np.float32)
    smoothed_f = smoothed.astype(np.float32)
    
    # 마스크를 3채널로 확장
    mask3 = final_mask[..., None]
    
    # 얼굴 영역만 선택적으로 블렌딩
    blended = img_f * (1.0 - mask3 * strength) + smoothed_f * (mask3 * strength)
    blended = np.clip(blended, 0, 255).astype(np.uint8)
    
    diff_skin = np.mean(np.abs(blended.astype(np.int32) - img.astype(np.int32)))
    print(f"[smooth_skin] strength:{strength:.2f}, mask max:{final_mask.max():.3f}, mean diff:{diff_skin:.2f}")
    
    return blended


# =========================
# 7. 메인 파이프라인
# =========================

def retouch_image(image_data: bytes, filename: str) -> str:
    """
    1. FaceMesh 랜드마크 (한글 경로 우회 포함)
    2. 눈 확대 + 하관 슬림 + 피부 보정 (얼굴 영역만 선택적 스무딩)
    3. Base64 data URL 반환
    """
    print(f"[retouch_image] Processing image: {filename}")

    # 1) 이미지 로드
    try:
        image = Image.open(io.BytesIO(image_data))
        if image.mode != "RGB":
            image = image.convert("RGB")
        img_array = np.array(image)  # RGB
        print(f"[retouch_image] Image loaded: {img_array.shape}")
    except Exception as e:
        print("[retouch_image] Image loading error:", e)
        raise HTTPException(status_code=500, detail=f"Image loading error: {e}")

    # 2) 랜드마크
    print("[retouch_image] Step 1: get_landmarks")
    landmarks = get_landmarks(img_array)
    if landmarks is None:
        print("[retouch_image] Landmarks None → return original")
        _, buffer = cv2.imencode(".png", cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR))
        img_base64 = base64.b64encode(buffer).decode("utf-8")
        return f"data:image/png;base64,{img_base64}"

    print(f"[retouch_image] Landmarks extracted: {len(landmarks)}")

    # 3) 보정
    try:
        img_proc = img_array.copy()

        # 눈 10% 확대 (체감 안 되면 1.15 ~ 1.2로 올려보기)
        eye_scale = 1.20
        img_proc = enlarge_eyes(img_proc, landmarks, scale=eye_scale)

        # 하관 10% 슬림 + 턱 아래 포함
        img_proc = slim_lower_face(
            img_proc,
            landmarks,
            face_scale=0.85,
            lower_start_ratio=0.55,
            extra_bottom_ratio=0.40,
            side_margin_ratio=0.15,
        )

        # 피부 보정 (얼굴 영역만 선택적 스무딩)
        # strength: 0.5 = 50% 블렌딩 (0.0~1.0 조정 가능)
        img_proc = smooth_skin(
            img_proc,
            landmarks,
            strength=0.5,
            d=9,
            sigma_color=75.0,
            sigma_space=75.0,
        )

        diff = np.mean(np.abs(img_proc.astype(np.int32) - img_array.astype(np.int32)))
        print(f"[retouch_image] Geometry retouch done (mean abs diff: {diff:.2f})")
        if diff < 1.0:
            print("[retouch_image] Warning: retouch effect very small (diff < 1). Consider adjusting parameters.")
    except Exception as e:
        print("[retouch_image] Retouch error:", e)
        _, buffer = cv2.imencode(".png", cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR))
        img_base64 = base64.b64encode(buffer).decode("utf-8")
        return f"data:image/png;base64,{img_base64}"

    # 4) 인코딩
    try:
        _, buffer = cv2.imencode(".png", cv2.cvtColor(img_proc, cv2.COLOR_RGB2BGR))
    except Exception:
        _, buffer = cv2.imencode(".png", cv2.cvtColor(img_proc, cv2.COLOR_RGB2BGR))

    img_base64 = base64.b64encode(buffer).decode("utf-8")
    data_url = f"data:image/png;base64,{img_base64}"
    print("[retouch_image] Success")
    return data_url
