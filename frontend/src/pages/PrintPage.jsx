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
  const frameRef = useRef(null);
  const [isAnimated, setIsAnimated] = useState(false);
  const [isFixed, setIsFixed] = useState(false);

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

  const handleSave = () => {
    if (!frameRef.current) {
      alert('저장할 수 없습니다. 페이지를 새로고침해주세요.');
      return;
    }

    const images = frameRef.current.querySelectorAll('img');
    const imagePromises = Array.from(images).map((img) => {
      if (img.complete && img.naturalWidth > 0) {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve();
        }, 5000);
        
        img.onload = () => {
          clearTimeout(timeout);
          resolve();
        };
        img.onerror = () => {
          clearTimeout(timeout);
          resolve();
        };
      });
    });

    Promise.all(imagePromises).then(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          html2canvas(frameRef.current, {
            useCORS: true,
            backgroundColor: null,
            allowTaint: true,
            scale: 2, // 고해상도를 위해 scale 증가
            logging: false,
            width: frameRef.current.offsetWidth,
            height: frameRef.current.offsetHeight,
            windowWidth: frameRef.current.offsetWidth,
            windowHeight: frameRef.current.offsetHeight,
            x: 0,
            y: 0,
            scrollX: 0,
            scrollY: 0
          }).then((canvas) => {
            try {
              canvas.toBlob((blob) => {
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
            }
          }).catch((error) => {
            alert('이미지 생성에 실패했습니다: ' + error.message);
          });
        });
      });
    }).catch(() => {
      alert('이미지 로드 중 오류가 발생했습니다.');
    });
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
                    display: 'block'
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
                      display: 'block'
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
                  display: 'block'
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
                    display: 'block'
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
