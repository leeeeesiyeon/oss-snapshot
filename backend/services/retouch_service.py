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
        x = lm.x * w
        y = lm.y * h
        landmarks.append([x, y])

    return np.array(landmarks, dtype=np.float32)


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

# 턱선 포인트 (전체 이동용)
JAW_POINTS = [152, 172, 136, 150, 149, 148, 176, 377, 400, 378, 379, 365, 397]

# 광대 포인트 (기존 234/454 대신)
CHEEKBONE_POINTS = [93, 116, 117, 166, 168, 323, 345, 346, 397, 399]

# 입 주변 고정 anchor 포인트 (TPS에서 고정)
MOUTH_ANCHOR_IDX = [
    61, 291, 13, 0, 78, 308, 82, 87, 95,
    267, 269, 270, 272, 273, 274, 317, 318, 324
]

# 입술 포인트
OUTER_LIP = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291]
INNER_LIP = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308]


# =========================
# 3. 유틸
# =========================

def hex_to_rgb(hex_str):
    """HEX 색상 코드를 RGB 튜플로 변환"""
    hex_str = hex_str.lstrip('#')
    return tuple(int(hex_str[i:i+2], 16) for i in (0, 2, 4))

# 화장 색상 정의
BLUSH_RGB = hex_to_rgb("#FA7D77")
HIGHLIGHT_RGB = hex_to_rgb("#FEEDEF")

def make_soft_mask(h, w, pts, feather=35):
    """부드러운 마스크 생성 (feather 적용)"""
    mask = np.zeros((h, w), dtype=np.float32)
    cv2.fillConvexPoly(mask, pts.astype(np.int32), 1.0)
    mask = cv2.GaussianBlur(mask, (0, 0), feather)
    return np.clip(mask, 0, 1)

def alpha_blend_color(img, mask, color_rgb, alpha=1.0):
    """색상 레이어를 이미지에 블렌딩"""
    color_layer = np.zeros_like(img, dtype=np.float32)
    color_layer[:] = np.array(color_rgb, dtype=np.float32)
    m = (mask * alpha)[..., None]
    out = img.astype(np.float32) * (1 - m) + color_layer * m
    return np.clip(out, 0, 255).astype(np.uint8)

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


# ============================================================
# 5. 얼굴형 보정 (Piecewise Affine, 턱/광대만 자연스럽게)
# ============================================================

# 얼굴형 변형에 쓰는 컨트롤 포인트(외곽 + 안정 anchor)
FACE_SHAPE_CTRL_IDX = sorted(set(
    FACE_OVAL_IDX
    + [1, 5, 9, 10, 152, 168, 199]  # 중앙 anchor (코/이마/턱)
    + LEFT_EYE_IDX[:4] + RIGHT_EYE_IDX[:4]  # 눈 주변 anchor
    + [234, 454]  # 광대 중심
))

def _delaunay_triangles(rect, points):
    """points 기준으로 Delaunay triangulation 반환 (triangle vertex index 3개씩) - 최적화 버전"""
    subdiv = cv2.Subdiv2D(rect)
    for p in points:
        subdiv.insert((float(p[0]), float(p[1])))

    triangleList = subdiv.getTriangleList()
    if len(triangleList) == 0:
        return []
    
    triangleList = np.array(triangleList, dtype=np.float32)

    # 좌표 -> 인덱스 매핑 (최적화: 벡터화된 거리 계산)
    pts = points.astype(np.float32)
    tris = []
    
    # 모든 삼각형의 모든 정점에 대해 한 번에 거리 계산
    for t in triangleList:
        tri = t.reshape(3, 2)
        idxs = []
        ok = True
        for v in tri:
            # 벡터화된 거리 계산 (더 빠름)
            d = np.sum((pts - v) ** 2, axis=1)
            i = int(np.argmin(d))
            if d[i] > 4.0:  # 거리 임계값 (2.0^2 = 4.0)
                ok = False
                break
            idxs.append(i)
        if ok and len(set(idxs)) == 3:
            tris.append(tuple(sorted(idxs)))  # 정렬하여 중복 제거 용이
    
    # 중복 제거 (set 사용으로 더 빠름)
    tris = list(set(tris))
    return tris

def _warp_triangle(img, out, t_src, t_dst):
    """삼각형 하나를 src->dst로 warp해서 out에 합침 (에러 처리 추가)"""
    try:
        r1 = cv2.boundingRect(np.float32([t_src]))
        r2 = cv2.boundingRect(np.float32([t_dst]))

        x1, y1, w1, h1 = r1
        x2, y2, w2, h2 = r2

        if w1 <= 0 or h1 <= 0 or w2 <= 0 or h2 <= 0:
            return

        # 경계 체크
        h, w = img.shape[:2]
        if x1 < 0 or y1 < 0 or x1 + w1 > w or y1 + h1 > h:
            return
        if x2 < 0 or y2 < 0 or x2 + w2 > w or y2 + h2 > h:
            return

        t1_rect = []
        t2_rect = []

        for i in range(3):
            t1_rect.append(((t_src[i][0] - x1), (t_src[i][1] - y1)))
            t2_rect.append(((t_dst[i][0] - x2), (t_dst[i][1] - y2)))

        img1_rect = img[y1:y1+h1, x1:x1+w1]
        if img1_rect.size == 0:
            return

        mat = cv2.getAffineTransform(np.float32(t1_rect), np.float32(t2_rect))
        if mat is None:
            return
            
        warped = cv2.warpAffine(img1_rect, mat, (w2, h2),
                                flags=cv2.INTER_LINEAR,
                                borderMode=cv2.BORDER_REFLECT_101)

        mask = np.zeros((h2, w2, 3), dtype=np.float32)
        cv2.fillConvexPoly(mask, np.int32(t2_rect), (1.0, 1.0, 1.0), 16, 0)

        out_roi = out[y2:y2+h2, x2:x2+w2].astype(np.float32)
        warped_f = warped.astype(np.float32)

        blended = out_roi * (1.0 - mask) + warped_f * mask
        out[y2:y2+h2, x2:x2+w2] = np.clip(blended, 0, 255).astype(np.uint8)
    except Exception as e:
        # 개별 삼각형 warp 실패는 무시 (다른 삼각형은 계속 처리)
        pass

def validate_landmarks(landmarks) -> bool:
    """
    랜드마크 신뢰도 검증
    이상한 랜드마크가 있으면 False 반환 (TPS 실행 금지)
    """
    if landmarks is None or len(landmarks) < 468:
        print("[validate_landmarks] 랜드마크 개수 부족")
        return False
    
    try:
        # 1) 턱끝(152)이 입 중앙(13)보다 아래로 80px 이상 떨어짐 → 오류
        if 152 < len(landmarks) and 13 < len(landmarks):
            chin_y = landmarks[152][1]
            mouth_y = landmarks[13][1]
            if chin_y > mouth_y + 80:
                print(f"[validate_landmarks] 턱끝이 입보다 너무 아래 (차이: {chin_y - mouth_y:.1f}px)")
                return False
        
        # 2) 왼쪽/오른쪽 광대의 x 좌표가 뒤집힘
        # 왼쪽 광대: 93, 116, 117, 166, 168
        # 오른쪽 광대: 323, 345, 346, 397, 399
        left_cheek = [93, 116, 117, 166, 168]
        right_cheek = [323, 345, 346, 397, 399]
        
        valid_left = [p for p in left_cheek if p < len(landmarks)]
        valid_right = [p for p in right_cheek if p < len(landmarks)]
        
        if len(valid_left) > 0 and len(valid_right) > 0:
            left_x_avg = np.mean([landmarks[p][0] for p in valid_left])
            right_x_avg = np.mean([landmarks[p][0] for p in valid_right])
            if left_x_avg > right_x_avg:
                print(f"[validate_landmarks] 광대 좌표 뒤집힘 (왼쪽: {left_x_avg:.1f} > 오른쪽: {right_x_avg:.1f})")
                return False
        
        # 3) 턱선 평균 y가 얼굴 전체 y 범위에서 너무 벗어나면 → 오류
        jaw_ys = [landmarks[p][1] for p in JAW_POINTS if p < len(landmarks)]
        if len(jaw_ys) > 0:
            jaw_y_mean = np.mean(jaw_ys)
            face_y_min = np.min(landmarks[FACE_OVAL_IDX][:, 1])
            face_y_max = np.max(landmarks[FACE_OVAL_IDX][:, 1])
            face_y_range = face_y_max - face_y_min
            
            if jaw_y_mean < face_y_min - face_y_range * 0.2 or jaw_y_mean > face_y_max + face_y_range * 0.2:
                print(f"[validate_landmarks] 턱선 y가 얼굴 범위를 벗어남 (턱: {jaw_y_mean:.1f}, 얼굴: {face_y_min:.1f}~{face_y_max:.1f})")
                return False
        
        # 4) 입꼬리(61, 291)가 입 중앙(13)보다 더 아래 위치 → 오류
        if 13 < len(landmarks) and 61 < len(landmarks) and 291 < len(landmarks):
            mouth_center_y = landmarks[13][1]
            mouth_left_y = landmarks[61][1]
            mouth_right_y = landmarks[291][1]
            if mouth_left_y > mouth_center_y + 15 or mouth_right_y > mouth_center_y + 15:
                print(f"[validate_landmarks] 입꼬리가 입 중앙보다 아래 (중앙: {mouth_center_y:.1f}, 좌: {mouth_left_y:.1f}, 우: {mouth_right_y:.1f})")
                return False
        
        return True
        
    except Exception as e:
        print(f"[validate_landmarks] 검증 중 오류: {e}")
        return False

def stabilize_landmarks(landmarks):
    """
    랜드마크 전체에 median 기반 smoothing 적용
    - 턱 라인 포인트들의 y값을 median 기반으로 보정
    - 광대 포인트들의 x·y를 median 기반으로 안정화
    - vertical outlier clipping (mean ± 25px 벗어나면 median에 끌어당김)
    """
    lm = landmarks.copy()
    
    # 1) 턱 라인 포인트들의 y값 median 보정
    jaw_pts = [p for p in JAW_POINTS if p < len(landmarks)]
    if len(jaw_pts) > 0:
        jaw_ys = [lm[p][1] for p in jaw_pts]
        med_y = float(np.median(jaw_ys))
        mean_y = float(np.mean(jaw_ys))
        
        for p in jaw_pts:
            y = float(lm[p][1])
            if abs(y - mean_y) > 25:  # mean ± 25px 벗어나면
                lm[p][1] = med_y
    
    # 2) 광대 포인트들의 x·y median 안정화
    cheek_pts = [p for p in CHEEKBONE_POINTS if p < len(landmarks)]
    if len(cheek_pts) > 0:
        # x 좌표
        cheek_xs = [lm[p][0] for p in cheek_pts]
        med_x = float(np.median(cheek_xs))
        mean_x = float(np.mean(cheek_xs))
        
        # y 좌표
        cheek_ys = [lm[p][1] for p in cheek_pts]
        med_y = float(np.median(cheek_ys))
        mean_y = float(np.mean(cheek_ys))
        
        for p in cheek_pts:
            x = float(lm[p][0])
            y = float(lm[p][1])
            if abs(x - mean_x) > 25:
                lm[p][0] = med_x
            if abs(y - mean_y) > 25:
                lm[p][1] = med_y
    
    return lm

def stabilize_chin_landmarks(landmarks, thr_px=20):
    """
    턱/하관 랜드마크 이상치 제거/보정 (하위 호환성 유지)
    """
    return stabilize_landmarks(landmarks)

# =========================
# 6. 피부 보정 (얼굴 영역만 선택적 스무딩)
# =========================

def stabilize_oval(landmarks, thr=15):
    """
    FACE_OVAL 좌표를 안정화하여 잘못된 landmark로 인한 목까지 확장 방지
    """
    oid = FACE_OVAL_IDX
    if landmarks is None or len(landmarks) <= max(oid):
        return landmarks
    
    try:
        ys = landmarks[oid][:, 1]
        med = float(np.median(ys))
        lm = landmarks.copy()
        corrected = 0
        for p in oid:
            if abs(float(lm[p][1]) - med) > thr:
                lm[p][1] = med
                corrected += 1
        if corrected > 0:
            print(f"[stabilize_oval] {corrected}개 oval 포인트 보정 (중앙값: {med:.1f}, thr={thr})")
        return lm
    except Exception as e:
        print(f"[stabilize_oval] Error: {e}, returning original landmarks")
        return landmarks


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
    """
    h, w, _ = img.shape

    if landmarks is None or len(landmarks) < len(FACE_OVAL_IDX):
        print("[smooth_skin] Invalid landmarks, skipping skin smoothing")
        return img

    # 1) FACE_OVAL 안정화 (잘못된 landmark로 인한 목까지 확장 방지)
    landmarks = stabilize_oval(landmarks, thr=15)

    try:
        oval = landmarks[FACE_OVAL_IDX].astype(np.int32)
    except (IndexError, ValueError) as e:
        print(f"[smooth_skin] Error extracting face oval: {e}, skipping skin smoothing")
        return img

    mask_face = np.zeros((h, w), dtype=np.float32)
    cv2.fillConvexPoly(mask_face, oval, 1.0)

    # 2) 피부보정 마스크에서 턱 아래쪽(목 부분) 제거
    chin = int(np.max(oval[:, 1]))
    mask_face[chin+5:, :] = 0  # 턱 아래 5px부터 제거
    
    # 추가로 erode를 활용해 턱 아래쪽을 더 축소
    mask_face = cv2.erode(mask_face, np.ones((25, 25), np.uint8), iterations=1)

    # 4) 보조 얼굴 polygon 마스크 (안정 포인트 기반)
    try:
        stable_face_points = [10, 234, 454, 67, 297, 152]  # 이마, 양광대, 볼, 턱끝
        valid_points = [p for p in stable_face_points if p < len(landmarks)]
        if len(valid_points) >= 3:
            stable_pts = landmarks[valid_points].astype(np.int32)
            mask_stable = np.zeros((h, w), dtype=np.float32)
            cv2.fillConvexPoly(mask_stable, stable_pts, 1.0)
            # 기존 마스크와 결합 (둘 다 있어야 적용)
            mask_face = mask_face * mask_stable
            print(f"[smooth_skin] 보조 얼굴 polygon 마스크 적용: {len(valid_points)}개 포인트")
    except Exception as e:
        print(f"[smooth_skin] 보조 마스크 생성 실패: {e}, 기본 마스크만 사용")

    if mask_face.sum() < 100:
        print("[smooth_skin] Face mask too small, skipping skin smoothing")
        return img

    left_eye_pts = landmarks[LEFT_EYE_IDX].astype(np.int32)
    left_eye_rect = cv2.boundingRect(left_eye_pts)
    eye_pad = int(max(left_eye_rect[2], left_eye_rect[3]) * 0.5)
    left_eye_x1 = max(0, left_eye_rect[0] - eye_pad)
    left_eye_y1 = max(0, left_eye_rect[1] - eye_pad)
    left_eye_x2 = min(w, left_eye_rect[0] + left_eye_rect[2] + eye_pad)
    left_eye_y2 = min(h, left_eye_rect[1] + left_eye_rect[3] + eye_pad)

    right_eye_pts = landmarks[RIGHT_EYE_IDX].astype(np.int32)
    right_eye_rect = cv2.boundingRect(right_eye_pts)
    eye_pad = int(max(right_eye_rect[2], right_eye_rect[3]) * 0.5)
    right_eye_x1 = max(0, right_eye_rect[0] - eye_pad)
    right_eye_y1 = max(0, right_eye_rect[1] - eye_pad)
    right_eye_x2 = min(w, right_eye_rect[0] + right_eye_rect[2] + eye_pad)
    right_eye_y2 = min(h, right_eye_rect[1] + right_eye_rect[3] + eye_pad)

    eye_mask = np.zeros((h, w), dtype=np.float32)
    cv2.rectangle(eye_mask, (left_eye_x1, left_eye_y1), (left_eye_x2, left_eye_y2), 1.0, -1)
    cv2.rectangle(eye_mask, (right_eye_x1, right_eye_y1), (right_eye_x2, right_eye_y2), 1.0, -1)
    sigma_eye = max(w, h) * 0.02
    ksize_eye = int(sigma_eye * 6) | 1
    if ksize_eye < 3:
        ksize_eye = 3
    eye_mask = cv2.GaussianBlur(eye_mask, (ksize_eye, ksize_eye), sigma_eye)

    chin_y = int(oval[:, 1].max())
    mouth_y_start = int(chin_y - (chin_y - oval[:, 1].min()) * 0.3)
    mouth_mask = np.zeros((h, w), dtype=np.float32)
    mouth_mask[mouth_y_start:chin_y, :] = 1.0
    sigma_mouth = max(w, h) * 0.015
    ksize_mouth = int(sigma_mouth * 6) | 1
    if ksize_mouth < 3:
        ksize_mouth = 3
    mouth_mask = cv2.GaussianBlur(mouth_mask, (ksize_mouth, ksize_mouth), sigma_mouth)

    final_mask = mask_face.copy()
    final_mask = final_mask * (1.0 - eye_mask * 0.7)
    final_mask = final_mask * (1.0 - mouth_mask * 0.5)
    sigma_final = max(w, h) * 0.01
    ksize_final = int(sigma_final * 6) | 1
    if ksize_final < 3:
        ksize_final = 3
    final_mask = cv2.GaussianBlur(final_mask, (ksize_final, ksize_final), sigma_final)
    final_mask = np.clip(final_mask, 0.0, 1.0)

    mask_max = final_mask.max()
    mask_mean = final_mask.mean()
    mask_area = (final_mask > 0.1).sum()
    print(f"[smooth_skin] mask stats: max={mask_max:.3f}, mean={mask_mean:.3f}, area={mask_area} pixels")

    if mask_max < 0.01:
        print("[smooth_skin] Warning: mask is too small, skipping skin smoothing")
        return img

    ox, oy, ofw, ofh = cv2.boundingRect(oval)
    pad = int(max(ofw, ofh) * 0.1)
    x1 = max(0, ox - pad)
    y1 = max(0, oy - pad)
    x2 = min(w, ox + ofw + pad)
    y2 = min(h, oy + ofh + pad)

    face_roi = img[y1:y2, x1:x2].copy()
    final_mask_roi = final_mask[y1:y2, x1:x2].copy()

    try:
        face_roi_bgr = cv2.cvtColor(face_roi, cv2.COLOR_RGB2BGR)
        smoothed_roi_bgr = cv2.bilateralFilter(face_roi_bgr, d, sigma_color, sigma_space)
        smoothed_roi = cv2.cvtColor(smoothed_roi_bgr, cv2.COLOR_BGR2RGB)
    except Exception as e:
        print(f"[smooth_skin] Bilateral filter error: {e}, using Gaussian blur instead")
        sigma_blur = max(ofw, ofh) * 0.03
        ksize_blur = int(sigma_blur * 6) | 1
        if ksize_blur < 3:
            ksize_blur = 3
        smoothed_roi = cv2.GaussianBlur(face_roi, (ksize_blur, ksize_blur), sigma_blur)

    face_roi_f = face_roi.astype(np.float32)
    smoothed_roi_f = smoothed_roi.astype(np.float32)
    mask3_roi = final_mask_roi[..., None]

    blended_roi = face_roi_f * (1.0 - mask3_roi * strength) + smoothed_roi_f * (mask3_roi * strength)
    blended_roi = np.clip(blended_roi, 0, 255).astype(np.uint8)

    blended = img.copy()
    blended[y1:y2, x1:x2] = blended_roi

    diff_skin = np.mean(np.abs(blended.astype(np.int32) - img.astype(np.int32)))
    diff_max = np.max(np.abs(blended.astype(np.int32) - img.astype(np.int32)))
    print(f"[smooth_skin] strength:{strength:.2f}, mask max:{mask_max:.3f}, mean diff:{diff_skin:.2f}, max diff:{diff_max:.2f}")

    if diff_skin < 0.5:
        print(f"[smooth_skin] Warning: skin smoothing effect is very small (diff={diff_skin:.2f})")

    return blended


# =========================
# 6. 화장 레이어 (블러셔, 립 컬러, 하이라이트)
# =========================

def apply_lip_color(img, landmarks, color_rgb, alpha=1.0):
    """
    립 컬러 적용 (outer - inner 방식)
    """
    h, w = img.shape[:2]
    
    try:
        outer = landmarks[OUTER_LIP]
        inner = landmarks[INNER_LIP]
        
        mask_outer = make_soft_mask(h, w, outer, feather=25)
        mask_inner = make_soft_mask(h, w, inner, feather=15)
        
        lip_mask = np.clip(mask_outer - mask_inner, 0, 1)
        return alpha_blend_color(img, lip_mask, color_rgb, alpha=alpha)
    except Exception as e:
        print(f"[apply_lip_color] Error: {e}, returning original")
        return img


def apply_blush(img, landmarks, color_rgb, alpha=1.0):
    """
    블러셔 적용 (광대 중심 타원, 볼 아래쪽 위치)
    """
    h, w = img.shape[:2]
    
    try:
        # 볼 중심 포인트 (안정적 광대 인덱스 사용)
        Lc = landmarks[116].copy()
        Rc = landmarks[345].copy()
        
        # 얼굴 폭 기반 반지름 및 아래로 이동 거리 계산
        left_pt = landmarks[234]
        right_pt = landmarks[454]
        face_width = np.linalg.norm(right_pt - left_pt)
        rx = face_width * 0.12  # 더 작게 조정 (18% -> 12%)
        ry = face_width * 0.10  # 더 작게 조정 (14% -> 10%)
        
        # 볼 위치를 아래로 이동 (얼굴 높이의 8% 정도)
        face_height = np.max(landmarks[FACE_OVAL_IDX][:, 1]) - np.min(landmarks[FACE_OVAL_IDX][:, 1])
        offset_y = face_height * 0.08
        
        Lc[1] += offset_y  # Y 좌표를 아래로 이동
        Rc[1] += offset_y
        
        blush_mask = np.zeros((h, w), dtype=np.float32)
        
        for c in [Lc, Rc]:
            center = (int(c[0]), int(c[1]))
            axes = (int(rx), int(ry))
            tmp = np.zeros((h, w), dtype=np.float32)
            cv2.ellipse(tmp, center, axes, 0, 0, 360, 1.0, -1)
            tmp = cv2.GaussianBlur(tmp, (0, 0), 35)  # 경계 완전 제거
            blush_mask = np.maximum(blush_mask, tmp)
        
        blush_mask = np.clip(blush_mask, 0, 1)
        return alpha_blend_color(img, blush_mask, color_rgb, alpha=alpha)
    except Exception as e:
        print(f"[apply_blush] Error: {e}, returning original")
        return img


def apply_highlight(img, landmarks, color_rgb, alpha=1.0):
    """
    하이라이트 적용 (광대상단/코옆/콧대)
    """
    h, w = img.shape[:2]
    mask = np.zeros((h, w), dtype=np.float32)
    
    try:
        # 콧대(얇은 폴리곤)
        nose_pts = landmarks[[168, 6, 197, 195]]
        mask = np.maximum(mask, make_soft_mask(h, w, nose_pts, feather=20))
        
        # 코옆(팔자 옆) 좌우 작은 타원
        for pid in [49, 279]:
            c = landmarks[pid]
            tmp = np.zeros((h, w), dtype=np.float32)
            cv2.ellipse(tmp, (int(c[0]), int(c[1])), (18, 10), 0, 0, 360, 1.0, -1)
            tmp = cv2.GaussianBlur(tmp, (0, 0), 20)
            mask = np.maximum(mask, tmp)
        
        # 광대 상단 좌우 타원
        for pid in [117, 346]:
            c = landmarks[pid]
            tmp = np.zeros((h, w), dtype=np.float32)
            cv2.ellipse(tmp, (int(c[0]), int(c[1])), (22, 14), 0, 0, 360, 1.0, -1)
            tmp = cv2.GaussianBlur(tmp, (0, 0), 25)
            mask = np.maximum(mask, tmp)
        
        mask = np.clip(mask, 0, 1)
        return alpha_blend_color(img, mask, color_rgb, alpha=alpha)
    except Exception as e:
        print(f"[apply_highlight] Error: {e}, returning original")
        return img


# =========================
# 7. 메인 파이프라인
# =========================

def retouch_image(image_data: bytes, filename: str) -> str:
    """
    1. FaceMesh 랜드마크 (한글 경로 우회 포함)
    2. 눈 확대 + 피부 보정 + 화장 레이어 (블러셔, 립 컬러, 하이라이트)
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

    try:
        img_proc = img_array.copy()

        # 1단계: 눈 확대
        print("[retouch_image] Step 1: enlarge_eyes")
        eye_scale = 1.15  # 눈 확대 (15%)
        img_proc = enlarge_eyes(img_proc, landmarks, scale=eye_scale)
        print("[retouch_image] Step 1: enlarge_eyes completed")

        # 2단계: 피부 보정
        print("[retouch_image] Step 2: smooth_skin")
        landmarks_final = get_landmarks(img_proc)
        if landmarks_final is None:
            landmarks_final = landmarks
        else:
            landmarks = landmarks_final

        img_proc = smooth_skin(
            img_proc,
            landmarks,
            strength=0.45,
            d=15,
            sigma_color=100.0,
            sigma_space=100.0,
        )
        print("[retouch_image] Step 2: smooth_skin completed")

        # 3단계: 화장 레이어 (블러셔 → 립 컬러 → 하이라이트)
        print("[retouch_image] Step 3: makeup")
        img_proc = apply_blush(img_proc, landmarks, BLUSH_RGB, alpha=0.35)  # 자연스러운 블러셔
        img_proc = apply_lip_color(img_proc, landmarks, BLUSH_RGB, alpha=0.45)  # 자연스러운 립 컬러
        img_proc = apply_highlight(img_proc, landmarks, HIGHLIGHT_RGB, alpha=0.30)  # 자연스러운 하이라이트
        print("[retouch_image] Step 3: makeup completed")

        diff = np.mean(np.abs(img_proc.astype(np.int32) - img_array.astype(np.int32)))
        print(f"[retouch_image] Retouch done (mean abs diff: {diff:.2f})")

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
