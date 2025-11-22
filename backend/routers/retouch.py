import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from fastapi import APIRouter, HTTPException, UploadFile, File
from services import retouch_service

router = APIRouter(prefix="/api", tags=["retouch"])


@router.post("/retouch-upload")
async def retouch_image_upload(file: UploadFile = File(...)):
    """
    FormData로 이미지 업로드하여 AI 보정
    - MediaPipe FaceMesh로 얼굴 랜드마크 추출
    - OpenCV로 눈 확대 및 얼굴형 축소
    """
    try:
        image_data = await file.read()
        enhanced_image_url = retouch_service.retouch_image(image_data, file.filename)
        
        return {
            "enhanced_image_url": enhanced_image_url,
            "status": "success"
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Retouch error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Retouch failed: {str(e)}"
        )

