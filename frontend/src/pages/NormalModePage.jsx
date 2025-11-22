import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import logoWhite from '../assets/images/logo_white.png';
import cameraBox from '../assets/images/takepicture_camera_box.svg';

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
          const imageSrc = webcamRef.current.getScreenshot();
          setTimeout(() => setIsFlashing(false), 150);
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

  const isCompleted = currentPhotoNumber > 4 || capturedPhotos.length === 4;
  
  return (
    <div 
      className="take-picture-page" 
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
          justifyContent: 'center',
          alignItems: 'center',
          width: '1200px',
          height: '1500px'
        }}
      >
        <img
          src="/takepicture_1_2_background.svg"
          alt="Background"
          style={{
            position: 'absolute',
            width: '1200px',
            height: '1500px',
            objectFit: 'contain',
            zIndex: 1
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: '640px',
            height: '480px',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) translateY(-230px)',
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
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 2,
              width: '640px',
              height: '480px',
              overflow: 'hidden',
              borderRadius: '10px'
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
                borderRadius: '5px'
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
                <h2
                  className="countdown-text"
                  style={{ fontSize: '4rem', color: '#f5f5f5', fontWeight: 'bold' }}
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
            {isFlashing && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: `
                    radial-gradient(ellipse 60% 80% at 30% 40%, rgba(245, 245, 245, 0.15) 0%, transparent 50%),
                    radial-gradient(ellipse 80% 50% at 70% 60%, rgba(245, 245, 245, 0.25) 0%, transparent 60%),
                    radial-gradient(ellipse 50% 70% at 50% 50%, rgba(245, 245, 245, 0.1) 0%, transparent 45%),
                    radial-gradient(ellipse 70% 60% at 20% 70%, rgba(245, 245, 245, 0.2) 0%, transparent 55%),
                    radial-gradient(ellipse 55% 75% at 80% 30%, rgba(245, 245, 245, 0.18) 0%, transparent 50%),
                    radial-gradient(circle, transparent 0%, transparent 25%, rgba(245, 245, 245, 0.3) 50%, rgba(245, 245, 245, 0.6) 75%, rgba(245, 245, 245, 0.85) 90%, rgba(245, 245, 245, 0.95) 100%)
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
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
        <p className="webcam-status" style={{ position: 'absolute', top: 'calc(50% + 20px)', left: '50%', transform: 'translateX(-50%)', zIndex: 10, fontSize: '1rem', color: '#1a1a1a', fontWeight: 'bold' }}>
          {isCompleted
            ? "Capture Complete"
            : `${currentPhotoNumber} / 4`}
        </p>

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

