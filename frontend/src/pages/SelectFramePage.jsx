import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Toast from '../components/Toast';

// 고정 캔버스 크기 (background 이미지 크기에 맞춤)
const CANVAS_WIDTH = 1440;
const CANVAS_HEIGHT = 1080;
import frameBlack from '../assets/images/frames/frame_black.png';
import frameRed from '../assets/images/frames/frame_red.png';
import frameWhite from '../assets/images/frames/frame_white.png';
import whiteButton from '../assets/images/selectframe_white_button.svg';
import blackButton from '../assets/images/selectframe_black_button.svg';
import redButton from '../assets/images/selectframe_red_button.svg';
import printButton from '../assets/images/print_button.svg';
import noneFilterButton from '../assets/images/none_filter_button.svg';
import mutedButton from '../assets/images/muted_button.svg';
import brightButton from '../assets/images/bright_button.svg';
import grayscaleButton from '../assets/images/grayscale_button.svg';
import retouchButton from '../assets/images/retouch_button.svg';
import retouchOnButton from '../assets/images/retouch_on_button.svg';

// 프레임 선택 페이지
export default function SelectFramePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const photos = location.state?.photos || [];
  const [selectedFrame, setSelectedFrame] = useState('white');
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [aiRetouch, setAiRetouch] = useState(false); // AI 보정 On/Off
  const [retouchedPhotos, setRetouchedPhotos] = useState([]); // 보정된 사진들
  const [isProcessing, setIsProcessing] = useState(false); // 처리 중 상태
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 }); // 진행률
  const [toast, setToast] = useState(null);

  // 프레임 이미지
  const frameImages = {
    black: frameBlack,
    red: frameRed,
    white: frameWhite,
  };

  const handleFrameSelect = (frameType) => {
    setSelectedFrame(frameType);
  };

  const handleFilterSelect = (filterType) => {
    setSelectedFilter(filterType);
  };

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

  // AI 보정 적용 함수
  const handleRetouch = async () => {
    if (!aiRetouch) {
      // 보정 시작
      setIsProcessing(true);
      setProcessingProgress({ current: 0, total: photos.length });
      
      try {
        const enhancedPhotos = [];
        
        // 각 사진에 대해 보정 적용
        for (let i = 0; i < photos.length; i++) {
          const photo = photos[i];
          setProcessingProgress({ current: i + 1, total: photos.length });
          
          try {
            let blob;
            
            // Blob URL인지 Base64 데이터 URL인지 확인
            if (photo.startsWith('blob:')) {
              // Blob URL인 경우: Canvas를 통해 Blob으로 변환
              const img = new Image();
              img.crossOrigin = 'anonymous';
              
              blob = await new Promise((resolve, reject) => {
                img.onload = () => {
                  try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    
                    canvas.toBlob((blob) => {
                      if (blob) {
                        resolve(blob);
                      } else {
                        reject(new Error('Canvas to Blob 변환 실패'));
                      }
                    }, 'image/png');
                  } catch (error) {
                    reject(error);
                  }
                };
                
                img.onerror = () => {
                  reject(new Error('이미지 로드 실패'));
                };
                
                img.src = photo;
              });
            } else if (photo.startsWith('data:')) {
              // Base64 데이터 URL인 경우: Base64를 Blob으로 변환
              const response = await fetch(photo);
              if (!response.ok) {
                throw new Error(`이미지 로드 실패: ${response.statusText}`);
              }
              blob = await response.blob();
            } else {
              // 일반 URL인 경우
              const response = await fetch(photo);
              if (!response.ok) {
                throw new Error(`이미지 로드 실패: ${response.statusText}`);
              }
              blob = await response.blob();
            }
            
            // FormData 생성
            const formData = new FormData();
            formData.append('file', blob, `photo_${i}.png`);
            
            // 타임아웃 설정 (60초)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000);
            
            // 백엔드 API 호출
            const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
            const retouchResponse = await fetch(`${apiUrl}/api/retouch-upload`, {
              method: 'POST',
              body: formData,
              signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            if (!retouchResponse.ok) {
              const errorData = await retouchResponse.json().catch(() => ({ detail: 'Unknown error' }));
              throw new Error(errorData.detail || `서버 오류: ${retouchResponse.status}`);
            }
            
            const data = await retouchResponse.json();
            
            if (!data.enhanced_image_url) {
              throw new Error('보정된 이미지 URL을 받지 못했습니다.');
            }
            
            enhancedPhotos.push(data.enhanced_image_url);
          } catch (error) {
            if (error.name === 'AbortError') {
              throw new Error(`사진 ${i + 1} 처리 시간 초과 (60초)`);
            }
            console.error(`사진 ${i + 1} 보정 오류:`, error);
            
            const errorMessage = error.message || '';
            if (errorMessage.includes('429') || errorMessage.includes('throttled') || errorMessage.includes('rate limit')) {
              await new Promise(resolve => setTimeout(resolve, 15000));
              
              try {
                // 재시도
                const retryBlob = await new Promise((resolve, reject) => {
                  if (photo.startsWith('blob:')) {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => {
                      const canvas = document.createElement('canvas');
                      canvas.width = img.width;
                      canvas.height = img.height;
                      const ctx = canvas.getContext('2d');
                      ctx.drawImage(img, 0, 0);
                      canvas.toBlob((blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error('Canvas to Blob 변환 실패'));
                      }, 'image/png');
                    };
                    img.onerror = () => reject(new Error('이미지 로드 실패'));
                    img.src = photo;
                  } else if (photo.startsWith('data:')) {
                    fetch(photo).then(r => r.blob()).then(resolve).catch(reject);
                  } else {
                    fetch(photo).then(r => r.blob()).then(resolve).catch(reject);
                  }
                });
                
                const retryFormData = new FormData();
                retryFormData.append('file', retryBlob, `photo_${i}.png`);
                
                const retryController = new AbortController();
                const retryTimeoutId = setTimeout(() => retryController.abort(), 60000);
                
                const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
                const retryResponse = await fetch(`${apiUrl}/api/retouch-upload`, {
                  method: 'POST',
                  body: retryFormData,
                  signal: retryController.signal,
                });
                
                clearTimeout(retryTimeoutId);
                
                if (retryResponse.ok) {
                  const retryData = await retryResponse.json();
                  if (retryData.enhanced_image_url) {
                    enhancedPhotos.push(retryData.enhanced_image_url);
                    continue;
                  }
                }
              } catch (retryError) {
                console.error(`사진 ${i + 1} 재시도 실패:`, retryError);
              }
            }
            
            // 재시도 실패 또는 다른 오류인 경우 원본 사용
            enhancedPhotos.push(photo);
            setToast({ message: `Photo ${i + 1} retouch failed. Using original.`, type: 'warning' });
          }
        }
        
        setRetouchedPhotos(enhancedPhotos);
        setAiRetouch(true);
        setProcessingProgress({ current: 0, total: 0 });
      } catch (error) {
        console.error('Retouch error:', error);
        setToast({ message: `Retouch error: ${error.message}`, type: 'error' });
        setAiRetouch(false);
        setRetouchedPhotos([]);
        setProcessingProgress({ current: 0, total: 0 });
      } finally {
        setIsProcessing(false);
      }
    } else {
      // 보정 해제
      setAiRetouch(false);
      setRetouchedPhotos([]);
      setProcessingProgress({ current: 0, total: 0 });
    }
  };

  // 표시할 사진 선택 (보정된 사진이 있으면 보정된 것, 없으면 원본)
  const displayPhotos = aiRetouch && retouchedPhotos.length > 0 
    ? retouchedPhotos 
    : photos;

  const handleConfirm = () => {
    if (photos.length === 0) {
      setToast({ message: 'No photos available', type: 'error' });
      return;
    }
    // 프레임, 필터, 사진 정보를 함께 전달 (보정된 사진 또는 원본)
    navigate('/print', { 
      state: { 
        photos: displayPhotos, // 보정된 사진 또는 원본
        frame: selectedFrame,
        filter: selectedFilter,
        retouched: aiRetouch // 보정 여부 전달
      } 
    });
  };

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Enter: 확인 (Print 페이지로 이동)
      if (e.key === 'Enter' && photos.length > 0) {
        handleConfirm();
      }
      // ESC: 뒤로가기
      if (e.key === 'Escape') {
        navigate(-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photos.length, navigate]);

  if (photos.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <h2>No photos available</h2>
        <button 
          onClick={() => navigate('/')}
          style={{ 
            padding: '10px 20px', 
            fontSize: '1rem', 
            cursor: 'pointer',
            marginTop: '20px'
          }}
        >
          Home
        </button>
      </div>
    );
  }

  return (
    <div 
      className="select-frame-page page-fade" 
      style={{ 
        width: '100%',
        height: '100%',
        position: 'relative',
        overflowX: 'hidden',
        overflowY: 'auto',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: '40px',
        paddingBottom: '40px'
      }}
    >
      {/* 캔버스 컨테이너 - 실제 크기 */}
      <div
        style={{
          width: `${CANVAS_WIDTH}px`,
          height: `${CANVAS_HEIGHT}px`,
          position: 'relative',
          flexShrink: 0,
          margin: '0 auto'
        }}
      >
        {/* Wrapper - 고정 크기 캔버스 */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            backgroundImage: 'url(/selectframe_background.svg)',
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center'
          }}
        >
          {/* FrameButtonRow - 절대 위치 */}
          <div style={{ 
            position: 'absolute',
            top: '162px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            gap: '34px', 
            zIndex: 10
          }}>
            {/* White 버튼 */}
        <button 
          onClick={() => handleFrameSelect('white')}
          style={{
            border: 'none',
            cursor: 'pointer',
            backgroundColor: 'transparent',
            padding: 0,
            display: 'inline-block',
            opacity: selectedFrame !== 'white' ? 0.5 : 1
          }}
        >
          <img 
            src={whiteButton} 
            alt="White Frame" 
            style={{ 
              display: 'block',
              width: '32px',
              height: 'auto',
              objectFit: 'contain'
            }} 
          />
        </button>
        
        {/* Black 버튼 */}
        <button 
          onClick={() => handleFrameSelect('black')}
          style={{
            border: 'none',
            cursor: 'pointer',
            backgroundColor: 'transparent',
            padding: 0,
            display: 'inline-block',
            opacity: selectedFrame !== 'black' ? 0.5 : 1
          }}
        >
          <img 
            src={blackButton} 
            alt="Black Frame" 
            style={{ 
              display: 'block',
              width: '32px',
              height: 'auto',
              objectFit: 'contain'
            }} 
          />
        </button>
        
        {/* Red 버튼 */}
        <button 
          onClick={() => handleFrameSelect('red')}
          style={{
            border: 'none',
            cursor: 'pointer',
            backgroundColor: 'transparent',
            padding: 0,
            display: 'inline-block',
            opacity: selectedFrame !== 'red' ? 0.5 : 1
          }}
        >
          <img 
            src={redButton} 
            alt="Red Frame" 
            style={{ 
              display: 'block',
              width: '32px',
              height: 'auto',
              objectFit: 'contain'
            }} 
          />
        </button>
          </div>

          {/* FilterButtonRow - 절대 위치 */}
          <div style={{ 
            position: 'absolute',
            top: '212.4px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '15px',
            zIndex: 10
          }}>
        <button 
          onClick={() => handleFilterSelect('none')}
          style={{
            border: 'none',
            cursor: 'pointer',
            backgroundColor: 'transparent',
            padding: 0,
            display: 'inline-block',
            opacity: selectedFilter !== 'none' ? 0.5 : 1
          }}
        >
          <img 
            src={noneFilterButton} 
            alt="None Filter" 
            style={{ 
              display: 'block',
              width: '120px',
              height: 'auto',
              objectFit: 'contain'
            }} 
          />
        </button>
        
        <button 
          onClick={() => handleFilterSelect('grayscale')}
          style={{
            border: 'none',
            cursor: 'pointer',
            backgroundColor: 'transparent',
            padding: 0,
            display: 'inline-block',
            opacity: selectedFilter !== 'grayscale' ? 0.5 : 1
          }}
        >
          <img 
            src={grayscaleButton} 
            alt="Grayscale Filter" 
            style={{ 
              display: 'block',
              width: '120px',
              height: 'auto',
              objectFit: 'contain'
            }} 
          />
        </button>
        
        <button 
          onClick={() => handleFilterSelect('6s')}
          style={{
            border: 'none',
            cursor: 'pointer',
            backgroundColor: 'transparent',
            padding: 0,
            display: 'inline-block',
            opacity: selectedFilter !== '6s' ? 0.5 : 1
          }}
        >
          <img 
            src={mutedButton} 
            alt="Muted Filter" 
            style={{ 
              display: 'block',
              width: '120px',
              height: 'auto',
              objectFit: 'contain'
            }} 
          />
        </button>
        
        <button 
          onClick={() => handleFilterSelect('bright')}
          style={{
            border: 'none',
            cursor: 'pointer',
            backgroundColor: 'transparent',
            padding: 0,
            display: 'inline-block',
            opacity: selectedFilter !== 'bright' ? 0.5 : 1
          }}
        >
          <img 
            src={brightButton} 
            alt="Bright Filter" 
            style={{ 
              display: 'block',
              width: '120px',
              height: 'auto',
              objectFit: 'contain'
            }} 
          />
        </button>
      </div>

          {/* RetouchButton - 절대 위치 */}
          <div style={{ 
            position: 'absolute',
            top: '258px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            zIndex: 10
          }}>
        <button 
          onClick={handleRetouch}
          disabled={isProcessing}
          style={{
            border: 'none',
            cursor: isProcessing ? 'wait' : 'pointer',
            backgroundColor: 'transparent',
            padding: 0,
            display: 'inline-block',
            opacity: isProcessing ? 0.6 : (aiRetouch ? 1 : 0.8),
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (!isProcessing) {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.filter = 'grayscale(100%)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isProcessing) {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.filter = 'grayscale(0%)';
            }
          }}
          onMouseDown={(e) => {
            if (!isProcessing) {
              e.currentTarget.style.transform = 'scale(0.95)';
            }
          }}
          onMouseUp={(e) => {
            if (!isProcessing) {
              e.currentTarget.style.transform = 'scale(1.05)';
            }
          }}
        >
          <img
            src={aiRetouch ? retouchOnButton : retouchButton}
            alt="AI Retouch"
            style={{
              display: 'block',
              width: 'auto',
              height: '45px',
              objectFit: 'contain'
            }}
          />
        </button>
        {/* 처리 중 표시 - 진행률 바 포함 */}
        {isProcessing && processingProgress.total > 0 && (
          <div style={{ 
            marginTop: '8px',
            width: '120px',
            textAlign: 'center'
          }}>
            <div style={{ 
              fontSize: '8px',
              color: '#666',
              marginBottom: '4px'
            }}>
              Processing {processingProgress.current}/{processingProgress.total}
            </div>
            {/* 진행률 바 */}
            <div style={{
              width: '100%',
              height: '6px',
              backgroundColor: '#e0e0e0',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${(processingProgress.current / processingProgress.total) * 100}%`,
                height: '100%',
                backgroundColor: '#4CAF50',
                borderRadius: '3px',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>
        )}
        {/* 보정 완료 표시 - 성공 애니메이션 */}
        {!isProcessing && aiRetouch && retouchedPhotos.length > 0 && (
          <div style={{ 
            marginTop: '8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px'
          }}>
            {/* 체크마크 애니메이션 */}
            <div style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: '#4CAF50',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'scaleIn 0.3s ease-out'
            }}>
              <svg 
                width="12" 
                height="12" 
                viewBox="0 0 12 12" 
                fill="none"
                style={{
                  animation: 'checkmark 0.4s ease-out 0.2s both'
                }}
              >
                <path
                  d="M2 6L5 9L10 2"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    strokeDasharray: '12',
                    strokeDashoffset: '12',
                    animation: 'drawCheck 0.4s ease-out 0.2s forwards'
                  }}
                />
              </svg>
            </div>
            <div style={{ 
              fontSize: '8px',
              color: '#4CAF50',
              textAlign: 'center',
              fontWeight: '500'
            }}>
              Retouch completed!
            </div>
          </div>
        )}
      </div>

          {/* FramePreview - 절대 위치 */}
          {selectedFrame && (
            <div style={{ 
              position: 'absolute',
              top: '350px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10,
              width: '432px',
              height: '648px'
            }}>
        {/* 사진들을 프레임 아래에 배치 */}
        <div style={{
          position: 'absolute',
          top: '19.2px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '192px',
          height: '618px',
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '0px',
          zIndex: 1
        }}>
          {displayPhotos.slice(0, 4).map((photo, index) => (
            <img 
              key={index}
              src={photo} 
              alt={`Photo ${index + 1}`}
              style={{
                width: '192px',
                height: '156px',
                objectFit: 'cover',
                borderRadius: '1px',
                ...getFilterStyle(selectedFilter)
              }}
            />
          ))}
        </div>
        
          {/* 프레임 경계 조명 효과 */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '450px',
              height: '666px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.05) 100%)',
              boxShadow: '0 0 30px rgba(255, 255, 255, 0.3), inset 0 0 20px rgba(255, 255, 255, 0.1)',
              animation: 'frameGlow 2s ease-in-out infinite',
              zIndex: 1,
              pointerEvents: 'none'
            }}
          />
          
          {/* 프레임 이미지 (사진 위에 배치) */}
          <img 
            src={frameImages[selectedFrame]} 
            alt={`${selectedFrame} frame`}
            style={{ 
              width: '432px',
              height: '648px',
              objectFit: 'contain',
              position: 'relative',
              zIndex: 2,
              filter: 'drop-shadow(0 0 10px rgba(128, 128, 128, 0.8))'
            }}
          />
          </div>
        )}

          {/* PrintButton - 절대 위치 */}
          <button
            onClick={handleConfirm}
            style={{
              position: 'absolute',
              top: '1008px',
              left: '50%',
              transform: 'translateX(-50%)',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              padding: 0,
              display: 'inline-block',
              opacity: 1,
              zIndex: 10,
              width: '192px',
              height: 'auto'
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
            src={printButton}
            alt="Print"
            style={{
              display: 'block',
              width: '192px',
              height: 'auto',
              objectFit: 'contain'
            }}
          />
        </button>
        </div>
      </div>

      {/* 토스트 알림 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

