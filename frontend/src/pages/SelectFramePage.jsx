import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import frameBlack from '../assets/images/frames/frame_black.png';
import frameRed from '../assets/images/frames/frame_red.png';
import frameWhite from '../assets/images/frames/frame_white.png';
import logoWhite from '../assets/images/logo_white.png';
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
            const retouchResponse = await fetch('http://127.0.0.1:8000/api/retouch-upload', {
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
            console.log(`사진 ${i + 1}/${photos.length} 보정 완료`);
          } catch (error) {
            if (error.name === 'AbortError') {
              throw new Error(`사진 ${i + 1} 처리 시간 초과 (60초)`);
            }
            console.error(`사진 ${i + 1} 보정 오류:`, error);
            
            // Rate limit 오류(429)인 경우 재시도 로직
            const errorMessage = error.message || '';
            if (errorMessage.includes('429') || errorMessage.includes('throttled') || errorMessage.includes('rate limit')) {
              console.log(`사진 ${i + 1} Rate limit 오류 감지. 15초 후 재시도...`);
              await new Promise(resolve => setTimeout(resolve, 15000)); // 15초 대기
              
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
                
                const retryResponse = await fetch('http://127.0.0.1:8000/api/retouch-upload', {
                  method: 'POST',
                  body: retryFormData,
                  signal: retryController.signal,
                });
                
                clearTimeout(retryTimeoutId);
                
                if (retryResponse.ok) {
                  const retryData = await retryResponse.json();
                  if (retryData.enhanced_image_url) {
                    enhancedPhotos.push(retryData.enhanced_image_url);
                    console.log(`사진 ${i + 1} 재시도 성공`);
                    continue; // 다음 사진으로
                  }
                }
              } catch (retryError) {
                console.error(`사진 ${i + 1} 재시도 실패:`, retryError);
              }
            }
            
            // 재시도 실패 또는 다른 오류인 경우 원본 사용
            enhancedPhotos.push(photo);
            alert(`사진 ${i + 1} 보정 실패: ${error.message}\n원본 이미지를 사용합니다.`);
          }
        }
        
        setRetouchedPhotos(enhancedPhotos);
        setAiRetouch(true);
        setProcessingProgress({ current: 0, total: 0 });
      } catch (error) {
        console.error('Retouch error:', error);
        alert('보정 처리 중 오류가 발생했습니다: ' + error.message);
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
      alert('No photos available');
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
      className="select-frame-page" 
      style={{ 
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        position: 'relative',
        paddingBottom: '40px',
        transform: 'scale(0.8)',
        transformOrigin: 'center 5%'
      }}
    >
      {/* 배경 이미지 (중앙 배치) */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'center',
          width: '1200px',
          height: '1500px'
        }}
      >
        <img
          src="/selectframe_background.svg"
          alt="Background"
          style={{
            position: 'absolute',
            width: '1200px',
            height: '1500px',
            objectFit: 'contain',
            zIndex: 1
          }}
        />
        {/* 프레임 선택 버튼들 */}
        <div style={{ 
          position: 'absolute',
          top: '230px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          gap: '60px', 
          flexWrap: 'wrap'
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
              width: '50.2125px',
              height: 'auto',
              objectFit: 'contain',
              maxWidth: 'none',
              minWidth: '50.2125px'
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
              width: '50.2125px',
              height: 'auto',
              objectFit: 'contain',
              maxWidth: 'none',
              minWidth: '50.2125px'
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
              width: '50.2125px',
              height: 'auto',
              objectFit: 'contain',
              maxWidth: 'none',
              minWidth: '50.2125px'
            }} 
          />
        </button>
        </div>

      {/* 필터 선택 버튼들 - 프레임 선택 버튼과 프레임 사이에 가로 배치 (독립 개체) */}
      {/* None 버튼 */}
      <div style={{ 
        position: 'absolute',
        top: '320px',
        left: 'calc(50% - 247.5px)',
        transform: 'translateX(-50%)',
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
              width: '150px',
              height: 'auto',
              objectFit: 'contain',
              maxWidth: 'none',
              minWidth: '150px'
            }} 
          />
        </button>
      </div>
      
      {/* Grayscale 버튼 */}
      <div style={{ 
        position: 'absolute',
        top: '320px',
        left: 'calc(50% - 82.5px)',
        transform: 'translateX(-50%)',
        zIndex: 10
      }}>
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
              width: '150px',
              height: 'auto',
              objectFit: 'contain',
              maxWidth: 'none',
              minWidth: '150px'
            }} 
          />
        </button>
      </div>
      
      {/* 흐리게 버튼 */}
      <div style={{ 
        position: 'absolute',
        top: '320px',
        left: 'calc(50% + 82.5px)',
        transform: 'translateX(-50%)',
        zIndex: 10
      }}>
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
              width: '150px',
              height: 'auto',
              objectFit: 'contain',
              maxWidth: 'none',
              minWidth: '150px'
            }} 
          />
        </button>
      </div>
      
      {/* Bright 버튼 */}
      <div style={{ 
        position: 'absolute',
        top: '320px',
        left: 'calc(50% + 247.5px)',
        transform: 'translateX(-50%)',
        zIndex: 10
      }}>
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
              width: '150px',
              height: 'auto',
              objectFit: 'contain',
              maxWidth: 'none',
              minWidth: '150px'
            }} 
          />
        </button>
      </div>

      {/* AI 보정 버튼 - 필터 버튼 밑에 배치, 필터 버튼과 동일한 스타일 */}
      <div style={{ 
        position: 'absolute',
        top: '390px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
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
              height: '57.75px', // print 버튼과 동일한 높이 (200/142 * 41)
              objectFit: 'contain'
            }}
          />
        </button>
        {/* 처리 중 표시 - 버튼 밑에 영어로 표시 */}
        {isProcessing && processingProgress.total > 0 && (
          <div style={{ 
            marginTop: '8px',
            fontSize: '14px',
            color: '#666',
            textAlign: 'center'
          }}>
            Processing {processingProgress.current}/{processingProgress.total}
          </div>
        )}
        {/* 보정 완료 표시 */}
        {!isProcessing && aiRetouch && retouchedPhotos.length > 0 && (
          <div style={{ 
            marginTop: '8px',
            fontSize: '14px',
            color: '#4CAF50',
            textAlign: 'center',
            fontWeight: '500'
          }}>
            Retouch completed!
          </div>
        )}
      </div>

      {/* 선택된 프레임 미리보기 */}
      {selectedFrame && (
        <div style={{ 
          position: 'absolute',
          top: '515px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          display: 'inline-block',
          width: '571.2px',  // 714px * 0.8
          height: '856.8px'  // 1071px * 0.8
        }}>
        {/* 사진들을 프레임 아래에 배치 */}
        <div style={{
          position: 'absolute',
          top: '25.6px',  // 32px * 0.8
          left: '50%',
          transform: 'translateX(-50%)',
          width: '256px',  // 320px * 0.8
          height: '819.2px',  // 1024px * 0.8
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
                width: '256px',  // 320px * 0.8
                height: '204.8px',  // 256px * 0.8
                objectFit: 'cover',
                borderRadius: '4px',
                ...getFilterStyle(selectedFilter)
              }}
            />
          ))}
        </div>
        
          {/* 프레임 이미지 (사진 위에 배치) */}
          <img 
            src={frameImages[selectedFrame]} 
            alt={`${selectedFrame} frame`}
            style={{ 
              width: '571.2px',  // 714px * 0.8
              height: '856.8px',  // 1071px * 0.8
              objectFit: 'contain',
              position: 'relative',
              zIndex: 2,
              filter: 'drop-shadow(0 0 10px rgba(128, 128, 128, 0.8))'
            }}
          />
        </div>
      )}

      {/* Confirm 버튼 */}
      <div style={{ 
        position: 'absolute',
        top: '1400px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10
      }}>
        <button
          onClick={handleConfirm}
          style={{
            border: 'none',
            cursor: 'pointer',
            backgroundColor: 'transparent',
            padding: 0,
            display: 'inline-block',
            opacity: 1
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
            e.currentTarget.style.filter = 'grayscale(100%)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.filter = 'grayscale(0%)';
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'scale(0.95)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
        >
          <img
            src={printButton}
            alt="Print"
            style={{
              display: 'block',
              width: '200px',
              height: 'auto',
              objectFit: 'contain'
            }}
          />
        </button>
      </div>
      </div>

      {/* 저작권 문구 */}
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

