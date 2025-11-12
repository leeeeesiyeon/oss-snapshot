import React, { useRef, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import html2canvas from 'html2canvas';
import logoWhite from '../assets/images/logo_white.png';
import frameBlack from '../assets/images/frames/frame_black.png';
import frameRed from '../assets/images/frames/frame_red.png';
import frameWhite from '../assets/images/frames/frame_white.png';
import saveButton from '../assets/images/save_button.svg';
import barSvg from '../assets/images/_bar.svg';

// 네컷 출력/저장 페이지
export default function PrintPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const photos = location.state?.photos || [];
  const frame = location.state?.frame || 'white';
  const filter = location.state?.filter || 'none';
  const frameRef = useRef(null);
  const [isAnimated, setIsAnimated] = useState(false);
  const [isFixed, setIsFixed] = useState(false);

  // 필터 CSS 스타일 생성
  const getFilterStyle = (filterType) => {
    switch (filterType) {
      case 'grayscale':
        // 흑백 100%, 밝기 +30, 대비 -20
        return { filter: 'grayscale(100%) brightness(1.3) contrast(0.8)' };
      case '6s':
        // 노이즈 10, 흑백 10, 밝기 -10, 대비 -20, 채도 -10
        // CSS로는 노이즈를 직접 적용할 수 없으므로 다른 효과로 대체
        return { filter: 'grayscale(10%) brightness(0.9) contrast(0.8) saturate(0.9)' };
      case 'bright':
        // 밝기 10, 채도 10, 대비 -20
        return { filter: 'brightness(1.1) saturate(1.1) contrast(0.8)' };
      default:
        return { filter: 'none' };
    }
  };

  useEffect(() => {
    // 컴포넌트 마운트 후 2초 뒤에 애니메이션 시작
    const timer = setTimeout(() => {
      setIsAnimated(true);
    }, 2000);
    
    // 애니메이션 완료 후 고정 (2초 + 1.2초 = 3.2초 후)
    const fixTimer = setTimeout(() => {
      setIsFixed(true);
    }, 3200);
    
    return () => {
      clearTimeout(timer);
      clearTimeout(fixTimer);
    };
  }, []);

  // 프레임 이미지
  const frameImages = {
    black: frameBlack,
    red: frameRed,
    white: frameWhite,
  };

  const handleSave = async () => {
    try {
      const filterStyle = getFilterStyle(filter);
      const scale = 2;
      const canvasWidth = 837 * scale;
      const canvasHeight = 2639 * scale;
      
      // 최종 Canvas 생성
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = canvasWidth;
      finalCanvas.height = canvasHeight;
      const ctx = finalCanvas.getContext('2d');
      
      // 각 사진의 위치와 크기 (원본 크기 기준)
      const photoPositions = [
        { x: 21, y: 122, width: 795, height: 597 },
        { x: 21, y: 737, width: 795, height: 597 },
        { x: 21, y: 1352, width: 795, height: 597 },
        { x: 21, y: 1967, width: 795, height: 597 }
      ];
      
      // 1. 각 사진을 로드하고 필터 적용
      const photoCanvases = [];
      for (let i = 0; i < Math.min(photos.length, 4); i++) {
        const pos = photoPositions[i];
        const scaledWidth = pos.width * scale;
        const scaledHeight = pos.height * scale;
        
        await new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          
          img.onload = () => {
            try {
              const photoCanvas = document.createElement('canvas');
              photoCanvas.width = scaledWidth;
              photoCanvas.height = scaledHeight;
              const photoCtx = photoCanvas.getContext('2d');
              
              // 필터 적용 (Canvas 2D Context의 filter 속성 사용)
              if ('filter' in photoCtx && filterStyle.filter && filterStyle.filter !== 'none') {
                photoCtx.filter = filterStyle.filter;
              }
              
              // 이미지를 그리기 (비율 유지, cover 방식)
              const imgAspect = img.width / img.height;
              const canvasAspect = scaledWidth / scaledHeight;
              
              let drawWidth = scaledWidth;
              let drawHeight = scaledHeight;
              let drawX = 0;
              let drawY = 0;
              
              if (imgAspect > canvasAspect) {
                // 이미지가 더 넓음 - 높이를 맞추고 좌우를 자름
                drawHeight = scaledHeight;
                drawWidth = scaledHeight * imgAspect;
                drawX = (scaledWidth - drawWidth) / 2;
              } else {
                // 이미지가 더 높음 - 너비를 맞추고 상하를 자름
                drawWidth = scaledWidth;
                drawHeight = scaledWidth / imgAspect;
                drawY = (scaledHeight - drawHeight) / 2;
              }
              
              photoCtx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
              photoCanvases.push({
                canvas: photoCanvas,
                x: pos.x * scale,
                y: pos.y * scale
              });
              resolve();
            } catch (error) {
              console.error('사진 처리 중 오류:', error);
              resolve();
            }
          };
          
          img.onerror = () => {
            console.error('이미지 로드 실패:', photos[i]);
            resolve();
          };
          
          img.src = photos[i];
        });
      }
      
      // 2. 프레임 이미지 로드
      const frameImg = new Image();
      frameImg.crossOrigin = 'anonymous';
      await new Promise((resolve) => {
        frameImg.onload = () => {
          // 3. 사진들을 먼저 그리기
          photoCanvases.forEach((photoData) => {
            ctx.drawImage(photoData.canvas, photoData.x, photoData.y);
          });
          
          // 4. 프레임을 맨 위에 그리기
          ctx.drawImage(frameImg, 0, 0, canvasWidth, canvasHeight);
          resolve();
        };
        frameImg.onerror = () => {
          console.error('프레임 이미지 로드 실패');
          resolve();
        };
        frameImg.src = frameImages[frame];
      });
      
      // 5. 최종 이미지 저장
      finalCanvas.toBlob((blob) => {
        if (!blob) {
          alert('이미지 생성에 실패했습니다. 다시 시도해주세요.');
          return;
        }
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'snapshot.png';
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 100);
      }, 'image/png', 1.0);
      
    } catch (error) {
      alert('파일 저장 중 오류가 발생했습니다: ' + error.message);
      console.error('저장 오류:', error);
    }
  };

  if (!photos || photos.length === 0) {
    return (
      <div className="print-page" style={{ transform: 'scale(0.8)', transformOrigin: 'center 5%' }}>
        <h2>No photos available</h2>

        {/* 저작권 문구 */}
        <div
          style={{
            marginTop: '40px',
            textAlign: 'center',
            color: 'rgba(245, 245, 245, 0.8)',
            fontSize: '0.9rem'
          }}
        >
          <div style={{ marginBottom: '5px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <img 
              src={logoWhite} 
              alt="Snapshot" 
              style={{ 
                height: '1.1rem',
                width: 'auto'
              }} 
            />
          </div>
          <div style={{ fontSize: '0.8rem' }}>
            © 2025 | All rights reserved
          </div>
          <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center', gap: '15px', fontSize: '0.9rem' }}>
            <a 
              href="#" 
              onClick={(e) => {
                e.preventDefault();
                navigate('/');
              }}
              style={{ 
                color: 'rgba(245, 245, 245, 0.8)', 
                textDecoration: 'none',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
              onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
            >
              HOME
            </a>
            <span style={{ color: 'rgba(245, 245, 245, 0.5)' }}>|</span>
            <a 
              href="https://github.com/leeeeesiyeon/oss-snapshot" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                color: 'rgba(245, 245, 245, 0.8)', 
                textDecoration: 'none',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
              onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="print-page" style={{ 
      transform: 'scale(0.8)', 
      transformOrigin: 'center 5%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      minHeight: '100vh'
    }}>
      {/* 배경 이미지 */}
      <div style={{ 
        position: 'relative', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%'
      }}>
        <img
          src="/print_background.svg"
          alt="Background"
          style={{
            display: 'block',
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            zIndex: 1
          }}
        />
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 10, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h2>Four Cut Complete</h2>
        </div>

        {/* bar 이미지 (독립적으로 배치) */}
        <img 
          src={barSvg} 
          alt="Bar"
          style={{
            position: 'absolute',
            bottom: '243px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '262px',
            height: '280px',
            zIndex: 15,
            pointerEvents: 'none'
          }}
        />

        {/* 화면에 표시되는 프레임과 사진 (저장용 프레임을 복사해서 크기만 축소) */}
        <div
          style={{
            position: 'absolute',
            bottom: '243px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            width: '195px',
            height: '335px',
            overflow: 'hidden',
          }}
        >
          {/* 종이 div가 슬라이드되는 컨테이너 */}
          <div
            style={{
              position: 'relative',
              width: '837px',
              height: '2639px',
              transformOrigin: 'top center',
              display: 'inline-block',
              marginLeft: '50%',
              left: '-418.5px',
              transition: isFixed ? 'none' : (isAnimated ? 'transform 3.0s ease-out' : 'none'),
              transform: isAnimated 
                ? 'scale(0.1165) translateY(365px)' 
                : 'scale(0.1165) translateY(-100%)'
            }}
          >
            {/* 사진들을 프레임 아래에 배치 */}
            <div style={{
              position: 'absolute',
              top: '122px',
              left: '21px',
              width: '795px',
              height: '2450px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              zIndex: 1,
              overflow: 'hidden'
            }}>
              {photos.slice(0, 4).map((photo, index) => (
                <div
                  key={index}
                  style={{
                    width: '795px',
                    height: '597px',
                    overflow: 'hidden',
                    borderRadius: '4px',
                    display: 'block',
                    position: 'relative'
                  }}
                >
                  <img 
                    src={photo} 
                    alt={`Photo ${index + 1}`}
                    loading="eager"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                      ...getFilterStyle(filter)
                    }}
                  />
                </div>
              ))}
            </div>
            
            {/* 프레임 이미지 (사진 위에 배치, 원본 크기) */}
            <img 
              src={frameImages[frame]} 
              alt={`${frame} frame`}
              crossOrigin="anonymous"
              loading="eager"
              style={{ 
                width: '837px',
                height: '2639px',
                objectFit: 'contain',
                display: 'block',
                position: 'relative',
                zIndex: 2
              }}
            />
          </div>
        </div>

        {/* 저장용 프레임과 사진 (원본 크기, 기울어지지 않음, 항상 렌더링되지만 완전히 숨김) */}
        <div
          ref={frameRef}
          style={{
            position: 'fixed',
            left: '-9999px',
            top: '0',
            width: '837px',
            height: '2639px',
            display: 'block',
            opacity: 1,
            visibility: 'visible',
            pointerEvents: 'none',
            zIndex: -1
          }}
        >
          {/* 사진들을 프레임 아래에 배치 */}
          <div style={{
            position: 'absolute',
            top: '122px',
            left: '21px',
            width: '795px',
            height: '2450px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            zIndex: 1,
            overflow: 'hidden'
          }}>
            {photos.slice(0, 4).map((photo, index) => (
              <div
                key={index}
                style={{
                  width: '795px',
                  height: '597px',
                  overflow: 'hidden',
                  borderRadius: '4px',
                  display: 'block',
                  position: 'relative'
                }}
              >
                <img 
                  src={photo} 
                  alt={`Photo ${index + 1}`}
                  loading="eager"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                    ...getFilterStyle(filter)
                  }}
                />
              </div>
            ))}
          </div>
          
          {/* 프레임 이미지 (사진 위에 배치, 원본 크기) */}
          <img 
            src={frameImages[frame]} 
            alt={`${frame} frame`}
            crossOrigin="anonymous"
            loading="eager"
            style={{ 
              width: '837px',
              height: '2639px',
              objectFit: 'contain',
              display: 'block',
              position: 'relative',
              zIndex: 2,
              outline: frame === 'black' ? '0.5px solid rgba(255, 255, 255, 0.8)' : 'none'
            }}
          />
        </div>

        {/* Save 버튼 (독립적으로 배치) */}
        <button
          onClick={handleSave}
          style={{
            position: 'absolute',
            bottom: '125px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            backgroundColor: 'transparent',
            display: 'inline-block',
            opacity: 1,
            zIndex: 10
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateX(-50%) scale(1.05)';
            e.currentTarget.style.filter = 'grayscale(100%)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateX(-50%) scale(1)';
            e.currentTarget.style.filter = 'grayscale(0%)';
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'translateX(-50%) scale(0.95)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'translateX(-50%) scale(1.05)';
          }}
        >
          <img
            src={saveButton}
            alt="Save"
            style={{
              display: 'block',
              width: '200px',
              height: 'auto',
              objectFit: 'contain'
            }}
          />
        </button>
      </div>

      {/* 저작권 문구 (배경 이미지 아래 고정) */}
      <div
        style={{
          marginTop: '60px',
          textAlign: 'center',
          color: 'rgba(245, 245, 245, 0.8)',
          fontSize: '0.9rem'
        }}
      >
        <div style={{ marginBottom: '5px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <img 
            src={logoWhite} 
            alt="Snapshot" 
            style={{ 
              height: '1.1rem',
              width: 'auto'
            }} 
          />
        </div>
        <div style={{ fontSize: '0.8rem' }}>
          © 2025 | All rights reserved
        </div>
        <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center', gap: '15px', fontSize: '0.9rem' }}>
          <a 
            href="#" 
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
            }}
            style={{ 
              color: 'rgba(245, 245, 245, 0.8)', 
              textDecoration: 'none',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
            onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
          >
            HOME
          </a>
          <span style={{ color: 'rgba(245, 245, 245, 0.5)' }}>|</span>
          <a 
            href="https://github.com/leeeeesiyeon/oss-snapshot" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ 
              color: 'rgba(245, 245, 245, 0.8)', 
              textDecoration: 'none',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
            onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
          >
            GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
