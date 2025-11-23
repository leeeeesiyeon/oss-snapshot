import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import cameraBox from '../assets/images/takepicture_camera_box.svg';
import Toast from '../components/Toast';

// 고정 캔버스 크기 (background 이미지 크기에 맞춤)
const CANVAS_WIDTH = 1440;
const CANVAS_HEIGHT = 1080;

const videoConstraints = {
  width: 640,
  height: 480,
  facingMode: "user",
};

// 일반 모드 페이지
export default function NormalModePage() {
  const navigate = useNavigate();
  const webcamRef = useRef(null);
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [countdown, setCountdown] = useState(0);
  const [statusText, setStatusText] = useState("Get ready");
  const [isShooting, setIsShooting] = useState(false);
  const [currentPhotoNumber, setCurrentPhotoNumber] = useState(1);
  const [isFlashing, setIsFlashing] = useState(false);
  const [toast, setToast] = useState(null);
  
  const capturedPhotosRef = useRef([]);
  const isShootingRef = useRef(false);
  const currentPhotoNumberRef = useRef(1);
  const takeShotRef = useRef();
  const countdownTimerRef = useRef(null);
  const nextShotTimeoutRef = useRef(null);

  useEffect(() => {
    capturedPhotosRef.current = capturedPhotos;
  }, [capturedPhotos]);
  
  useEffect(() => {
    isShootingRef.current = isShooting;
  }, [isShooting]);
  
  useEffect(() => {
    currentPhotoNumberRef.current = currentPhotoNumber;
  }, [currentPhotoNumber]);

  const takeShot = useCallback(() => {
    const currentPhotoCount = capturedPhotosRef.current.length;
    const currentNumber = currentPhotoNumberRef.current;
    
    if (isShootingRef.current || currentNumber > 4 || currentPhotoCount >= 4) {
      return;
    }
    
    if (currentNumber !== currentPhotoCount + 1) {
      return;
    }
    
    setIsShooting(true);
    isShootingRef.current = true;
    let count = 3;
    setCountdown(count);
    setStatusText("Get ready");

    countdownTimerRef.current = setInterval(() => {
      if (count <= 1) {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        setCountdown(0);
        setStatusText("Click");
        
        setTimeout(() => {
          setIsFlashing(true);
          setTimeout(() => {
            const imageSrc = webcamRef.current.getScreenshot();
            setTimeout(() => {
              setIsFlashing(false);
              
              // 플래시 효과가 끝난 후 상태 업데이트
              setTimeout(() => {
                setCapturedPhotos(prevPhotos => {
                  const newPhotos = [...prevPhotos, imageSrc];
                  const newLength = newPhotos.length;
                  
                  if (newLength === 4) {
                    setStatusText("Capture Complete");
                    setIsShooting(false);
                    isShootingRef.current = false;
                    setCurrentPhotoNumber(5);
                    currentPhotoNumberRef.current = 5;
                    // 촬영 완료 후 프레임 선택 페이지로 이동
                    setTimeout(() => {
                      navigate('/select-frame', { state: { photos: newPhotos } });
                    }, 1000);
                  } else {
                    const nextNumber = newLength + 1;
                    setIsShooting(false);
                    isShootingRef.current = false;
                    setCurrentPhotoNumber(nextNumber);
                    currentPhotoNumberRef.current = nextNumber;
                    
                    if (nextNumber <= 4) {
                      setStatusText("Get ready for the next shot...");
                      if (nextShotTimeoutRef.current) {
                        clearTimeout(nextShotTimeoutRef.current);
                      }
                      nextShotTimeoutRef.current = setTimeout(() => {
                        const currentPhotoCount = capturedPhotosRef.current.length;
                        const currentNum = currentPhotoNumberRef.current;
                        if (takeShotRef.current && currentNum === currentPhotoCount + 1 && currentPhotoCount < 4 && !isShootingRef.current) {
                          takeShotRef.current();
                        }
                        nextShotTimeoutRef.current = null;
                      }, 2000);
                    } else {
                      setStatusText("Capture Complete");
                    }
                  }
                  
                  return newPhotos;
                });
              }, 300); // 플래시 효과가 끝난 후 300ms 지연
            }, 200);
          }, 50);
        }, 500);
      } else {
        count--;
        setCountdown(count);
      }
    }, 1000);
  }, [navigate]);
  
  takeShotRef.current = takeShot;

  useEffect(() => {
    if (capturedPhotos.length === 0 && currentPhotoNumber === 1 && !isShooting) {
      const timer = setTimeout(() => {
        takeShot();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [capturedPhotos.length, currentPhotoNumber, isShooting, takeShot]);

  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
      if (nextShotTimeoutRef.current) {
        clearTimeout(nextShotTimeoutRef.current);
      }
    };
  }, []);

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Space: 촬영
      if (e.key === ' ' && !isShooting && currentPhotoNumber <= 4) {
        e.preventDefault();
        takeShot();
      }
      // ESC: 뒤로가기
      if (e.key === 'Escape') {
        navigate('/select-mode');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isShooting, currentPhotoNumber, takeShot, navigate]);

  const isCompleted = currentPhotoNumber > 4 || capturedPhotos.length === 4;
  
  return (
    <div 
      className="take-picture-page page-fade" 
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
            backgroundImage: 'url(/takepicture_1_2_background.svg)',
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center'
          }}
        >
          {/* CameraBox - 절대 위치 */}
          <div
            style={{
              position: 'absolute',
              top: '420px',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '515.52px',
              height: '387.36px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 5
            }}
          >
          {/* 카메라 박스 배경 */}
          <img
            src={cameraBox}
            alt="Camera Box"
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              zIndex: 1
            }}
          />
          {/* 웹캠 */}
          <div
            style={{
              position: 'relative',
              zIndex: 2,
              width: '515.52px',
              height: '387.36px',
              overflow: 'hidden',
              borderRadius: '2px'
            }}
          >
            <Webcam
              ref={webcamRef}
              audio={false}
              videoConstraints={videoConstraints}
              screenshotFormat="image/jpeg"
              mirrored={true}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: '2px'
              }}
            />
            {countdown > 0 && (
              <div
                className="webcam-overlay"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(0,0,0,0.4)',
                }}
              >
                {/* 카운트다운 빛 효과 */}
                <div
                  style={{
                    position: 'absolute',
                    width: '120px',
                    height: '120px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(255, 255, 255, 0.4) 0%, transparent 70%)',
                    animation: 'countdownGlow 1s ease-in-out infinite',
                    pointerEvents: 'none'
                  }}
                />
                <h2
                  className="countdown-text"
                  style={{ 
                    fontSize: '4rem', 
                    color: '#f5f5f5', 
                    fontWeight: 'bold',
                    textShadow: '0 0 30px rgba(255, 255, 255, 0.8), 0 0 60px rgba(255, 255, 255, 0.6)',
                    position: 'relative',
                    zIndex: 1
                  }}
                >
                  {countdown}
                </h2>
              </div>
            )}
            {countdown === 0 && !isCompleted && (
              <div
                className="webcam-overlay"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <h2
                  className="webcam-status"
                  style={{
                    fontSize: '1rem',
                    color: '#f5f5f5',
                    textShadow: '0 0 10px #1a1a1a',
                    fontWeight: 'bold'
                  }}
                >
                  {statusText}
                </h2>
              </div>
            )}
            {isCompleted && (
              <div
                className="webcam-overlay"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(0,0,0,0.6)',
                }}
              >
                <h2
                  className="webcam-status"
                  style={{
                    fontSize: '1rem',
                    color: '#f5f5f5',
                    textShadow: '0 0 10px #1a1a1a',
                    fontWeight: 'bold'
                  }}
                >
                  Capture Complete
                </h2>
              </div>
            )}
            {/* 스포트라이트 효과 (촬영 시) */}
            {(isFlashing || (countdown === 0 && !isCompleted)) && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'radial-gradient(ellipse 60% 80% at 50% 50%, rgba(255, 255, 255, 0.3) 0%, rgba(0, 0, 0, 0.6) 70%)',
                  animation: 'spotlight 0.3s ease-out',
                  zIndex: 99,
                  pointerEvents: 'none'
                }}
              />
            )}
            {isFlashing && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: `
                    radial-gradient(ellipse 60% 80% at 30% 40%, rgba(255, 255, 255, 0.4) 0%, transparent 50%),
                    radial-gradient(ellipse 80% 50% at 70% 60%, rgba(255, 255, 255, 0.5) 0%, transparent 60%),
                    radial-gradient(ellipse 50% 70% at 50% 50%, rgba(255, 255, 255, 0.3) 0%, transparent 45%),
                    radial-gradient(ellipse 70% 60% at 20% 70%, rgba(255, 255, 255, 0.4) 0%, transparent 55%),
                    radial-gradient(ellipse 55% 75% at 80% 30%, rgba(255, 255, 255, 0.35) 0%, transparent 50%),
                    radial-gradient(circle, transparent 0%, transparent 25%, rgba(255, 255, 255, 0.5) 50%, rgba(255, 255, 255, 0.7) 75%, rgba(255, 255, 255, 0.9) 90%, rgba(255, 255, 255, 0.95) 100%)
                  `,
                  filter: 'blur(40px)',
                  transition: 'opacity 0.15s ease-out',
                  zIndex: 100,
                  pointerEvents: 'none'
                }}
              />
            )}
          </div>
        </div>

          {/* StatusText - 절대 위치 */}
          <p 
            className="webcam-status" 
            style={{ 
              position: 'absolute',
              top: '636px',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '1.2rem', 
              color: '#1a1a1a', 
              fontWeight: 'bold',
              zIndex: 10
            }}
          >
            {isCompleted
              ? "Capture Complete"
              : `${currentPhotoNumber} / 4`}
          </p>

          {/* 촬영 완료 사진 슬라이드 효과 */}
          {capturedPhotos.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '680px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '8px',
                zIndex: 10
              }}
            >
              {capturedPhotos.map((photo, index) => (
                <img
                  key={index}
                  src={photo}
                  alt={`Photo ${index + 1}`}
                  style={{
                    width: '60px',
                    height: '45px',
                    objectFit: 'cover',
                    borderRadius: '4px',
                    border: '2px solid rgba(255, 255, 255, 0.5)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                    animation: 'slideIn 0.5s ease-out',
                    animationDelay: `${index * 0.1}s`,
                    animationFillMode: 'both'
                  }}
                />
              ))}
            </div>
          )}
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

