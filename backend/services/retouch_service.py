import io
import time
from PIL import Image
import replicate
from fastapi import HTTPException
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import REPLICATE_API_TOKEN, GFPGAN_MODEL


def retouch_image(image_data: bytes, filename: str) -> str:
    """
    Replicate API를 사용하여 이미지 보정
    - GFPGAN 모델 사용
    - 피부/윤곽/눈/입 전체 보정
    """
    # Replicate API 토큰 확인
    if not REPLICATE_API_TOKEN:
        raise HTTPException(
            status_code=500,
            detail="Replicate API token not configured. Please set REPLICATE_API_TOKEN environment variable."
        )
    
    # 이미지 읽기
    image = Image.open(io.BytesIO(image_data))
    
    # RGB로 변환 (필요한 경우)
    if image.mode != 'RGB':
        image = image.convert('RGB')
    
    print(f"Processing image: {filename} (Size: {image.size})")
    
    # Replicate API 호출 (GFPGAN)
    try:
        print("Calling Replicate API...")
        print(f"Image size: {image.size}, Mode: {image.mode}")
        
        # PIL Image를 BytesIO로 변환하여 파일 객체로 전달
        img_bytes = io.BytesIO()
        image.save(img_bytes, format='PNG')
        img_bytes.seek(0)
        
        # Replicate API는 비동기로 실행되며 시간이 걸릴 수 있음
        start_time = time.time()
        
        output = replicate.run(
            GFPGAN_MODEL,
            input={
                "img": img_bytes,  # BytesIO 파일 객체로 전달
            }
        )
        
        elapsed_time = time.time() - start_time
        print(f"Replicate API completed in {elapsed_time:.2f} seconds")
        print(f"Replicate API response type: {type(output)}")
        print(f"Replicate API response: {output}")
    
    except Exception as e:
        error_msg = str(e)
        print(f"Replicate API error: {error_msg}")
        print(f"Error type: {type(e).__name__}")
        
        # Replicate 관련 에러인지 확인
        if "replicate" in error_msg.lower() or "ReplicateError" in str(type(e)):
            raise HTTPException(
                status_code=500,
                detail=f"Replicate API error: {error_msg}"
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Image processing error: {error_msg}"
            )
    
    # 결과 URL 반환
    if isinstance(output, str):
        enhanced_image_url = output
    elif isinstance(output, list) and len(output) > 0:
        enhanced_image_url = output[0]
    else:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected output format from Replicate: {type(output)}"
        )
    
    print(f"Retouch completed. Enhanced image URL: {enhanced_image_url}")
    return enhanced_image_url

