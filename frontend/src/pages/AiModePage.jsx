import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import * as poseDetection from '@tensorflow-models/pose-detection';
import '@tensorflow/tfjs-backend-webgl';
import logoWhite from '../assets/images/logo_white.png';
import cameraBox from '../assets/images/takepicture_camera_box.svg';

const videoConstraints = {
  width: 640,
  height: 480,
  facingMode: "user",
};

const AI_REQUIRED_STABLE = 5;
const AI_CONF_THRESHOLD = 0.7;
const AI_POSES = ["차렷!", "브이", "꽃받침", "볼하트"];

// AI 모드 페이지
export default function AiModePage() {
  const navigate = useNavigate();
  const webcamRef = useRef(null);
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [countdown, setCountdown] = useState(0);
  const [statusText, setStatusText] = useState("Get ready");
  const [isShooting, setIsShooting] = useState(false);
  const [aiTargetIndex, setAiTargetIndex] = useState(0);
  
  const detectorRef = useRef(null);
  const aiLoopRafRef = useRef(null);
  const poseStableCountRef = useRef(0);
  const aiTargetIndexRef = useRef(0);
  const capturedPhotosRef = useRef([]);
  const isShootingRef = useRef(false);
  const countdownTimerRef = useRef(null);

  useEffect(() => {
    aiTargetIndexRef.current = aiTargetIndex;
  }, [aiTargetIndex]);

  useEffect(() => {
    capturedPhotosRef.current = capturedPhotos;
  }, [capturedPhotos]);

  useEffect(() => {
    isShootingRef.current = isShooting;
  }, [isShooting]);

  useEffect(() => {
    let isMounted = true;

    const createDetector = async () => {
      try {
        const detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
        });
        detectorRef.current = detector;
        console.log('AI detector 생성됨');
      } catch (e) {
        console.error('detector 생성 실패', e);
      }
    };

    const runAiLoop = async () => {
      if (!detectorRef.current || !webcamRef.current) {
        aiLoopRafRef.current = requestAnimationFrame(runAiLoop);
        return;
      }
      const video = webcamRef.current.video;
      if (!video || video.readyState < 2) {
        aiLoopRafRef.current = requestAnimationFrame(runAiLoop);
        return;
      }

      try {
        const poses = await detectorRef.current.estimatePoses(video);
        if (poses && poses.length > 0) {
          const keypoints = poses[0].keypoints;
          const features = [];
          for (let kp of keypoints) {
            features.push((kp.x ?? 0) / videoConstraints.width);
            features.push((kp.y ?? 0) / videoConstraints.height);
          }

          const res = await fetch("http://127.0.0.1:8000/api/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ features })
          });

          if (res.ok) {
            const json = await res.json();
            const predicted = json.pose;
            const confidence = json.confidence ?? 0;
            const targetPose = AI_POSES[aiTargetIndexRef.current];
            setStatusText(`Show ${targetPose}\nDetected: ${predicted} (${(confidence*100).toFixed(0)}%)`);

            if (predicted === targetPose && confidence >= AI_CONF_THRESHOLD) {
              poseStableCountRef.current += 1;
            } else {
              poseStableCountRef.current = 0;
            }

            if (poseStableCountRef.current >= AI_REQUIRED_STABLE && !isShootingRef.current) {
              console.log('AI가 포즈 안정적이라 판단하여 촬영 시작');
              poseStableCountRef.current = 0;
              setIsShooting(true);
              isShootingRef.current = true;
              let cnt = 3;
              setCountdown(cnt);
              setStatusText("Pose confirmed!\nTaking photo in 3 seconds");
              countdownTimerRef.current = setInterval(() => {
                if (cnt <= 1) {
                  clearInterval(countdownTimerRef.current);
                  countdownTimerRef.current = null;
                  setCountdown(0);
                  setStatusText("Click");
                  setTimeout(() => {
                    const imageSrc = webcamRef.current.getScreenshot();
                    setCapturedPhotos(prev => {
                      const newPhotos = [...prev, imageSrc];
                      const newLen = newPhotos.length;
                      if (newLen >= 4 || aiTargetIndexRef.current >= AI_POSES.length - 1) {
                        setStatusText("Capture Complete");
                        setIsShooting(false);
                        isShootingRef.current = false;
                        setAiTargetIndex(AI_POSES.length);
                        aiTargetIndexRef.current = AI_POSES.length;
                        setTimeout(() => {
                          navigate('/select-frame', { state: { photos: newPhotos } });
                        }, 800);
                      } else {
                        const nextIdx = aiTargetIndexRef.current + 1;
                        setAiTargetIndex(nextIdx);
                        aiTargetIndexRef.current = nextIdx;
                        setStatusText("Get ready for the next pose");
                        setIsShooting(false);
                        isShootingRef.current = false;
                      }
                      return newPhotos;
                    });
                  }, 400);
                } else {
                  cnt--;
                  setCountdown(cnt);
                }
              }, 1000);
            }
          } else {
            const errorData = await res.json().catch(() => ({ detail: 'Unknown error' }));
            console.error('predict API 실패', res.status, errorData);
            setStatusText(`Error: ${errorData.detail || 'Server connection failed'}\nPlease check if the backend is running`);
          }
        }
      } catch (e) {
        console.error('AI 루프 에러', e);
      }

      aiLoopRafRef.current = requestAnimationFrame(runAiLoop);
    };

    createDetector().then(() => {
      if (isMounted) {
        aiLoopRafRef.current = requestAnimationFrame(runAiLoop);
        setAiTargetIndex(0);
        aiTargetIndexRef.current = 0;
        poseStableCountRef.current = 0;
        setCapturedPhotos([]);
        capturedPhotosRef.current = [];
        setStatusText(`Show ${AI_POSES[0]}`);
      }
    });

    return () => {
      isMounted = false;
      if (aiLoopRafRef.current) {
        cancelAnimationFrame(aiLoopRafRef.current);
        aiLoopRafRef.current = null;
      }
      if (detectorRef.current) {
        if (detectorRef.current.dispose) detectorRef.current.dispose();
        detectorRef.current = null;
      }
    };
  }, [navigate]);

  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
      if (aiLoopRafRef.current) {
        cancelAnimationFrame(aiLoopRafRef.current);
      }
      if (detectorRef.current && detectorRef.current.dispose) {
        detectorRef.current.dispose();
      }
    };
  }, []);

  const isCompleted = aiTargetIndex >= AI_POSES.length || capturedPhotos.length === 4;
  const nextTarget = AI_POSES[Math.min(aiTargetIndex, AI_POSES.length - 1)];

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
                  style={{ fontSize: '4rem', color: '#f5f5f5' }}
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
                    fontSize: '2rem',
                    color: '#f5f5f5',
                    textShadow: '0 0 10px black',
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
                    fontSize: '2rem',
                    color: '#f5f5f5',
                    textShadow: '0 0 10px black',
                  }}
                >
                  Capture Complete
                </h2>
              </div>
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
        <p className="webcam-status" style={{ position: 'absolute', top: 'calc(50% + 20px)', left: '50%', transform: 'translateX(-50%)', zIndex: 10, fontSize: '2rem', color: 'black' }}>
          {isCompleted
            ? "Capture Complete"
            : `${capturedPhotos.length} / 4`}
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
      </div>
    </div>
  );
}

