import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from fastapi import APIRouter, HTTPException, UploadFile, File
from services import retouch_service

router = APIRouter(prefix="/api", tags=["retouch"])


@router.post("/retouch-upload")
async def retouch_image_upload(file: UploadFile = File(...)):
    """
    FormData로 이미지 업로드하여 Replicate API로 보정
    - GFPGAN 모델 사용
    - 피부/윤곽/눈/입 전체 보정
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

