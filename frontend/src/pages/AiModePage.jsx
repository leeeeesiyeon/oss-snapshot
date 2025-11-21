import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import * as Human from '@vladmandic/human';
import logoWhite from '../assets/images/logo_white.png';
import cameraBox from '../assets/images/takepicture_camera_box.svg';

const videoConstraints = {
  width: 640,
  height: 480,
  facingMode: "user",
};

const AI_REQUIRED_STABLE = 5;
const AI_CONF_THRESHOLD = 0.67;
const AI_POSES = ["Wink", "V sign", "Close up", "Surprise"];

// AI 모드 페이지
export default function AiModePage() {
  const navigate = useNavigate();
  const webcamRef = useRef(null);
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [countdown, setCountdown] = useState(0);
  const [statusText, setStatusText] = useState("Get ready");
  const [isShooting, setIsShooting] = useState(false);
  const [aiTargetIndex, setAiTargetIndex] = useState(0);
  const [isFlashing, setIsFlashing] = useState(false);
  
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
        const human = new Human.Human({
          modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models/',
          backend: 'webgl',
          modelPath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models/',
          face: { enabled: true },  // 학습 시와 동일하게 활성화
          hand: { enabled: true },  // 학습 시와 동일하게 활성화
          object: { enabled: false },
          segmentation: { enabled: false },
          body: { enabled: true },
        });
        await human.warmup();
        detectorRef.current = human;
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
        const result = await detectorRef.current.detect(video);
        
        // 학습할 때와 동일한 방식으로 features 추출
        let features = [];
        const targetPose = AI_POSES[aiTargetIndexRef.current];
        
        // 각 포즈별로 필요한 keypoints만 사용
        // Wink: Face만 (눈 감았는지 확인)
        // Close up: Face만 (얼굴만 있는지 확인)
        // V sign: Hand만 (손만 확인)
        // Surprise: Body (팔/손목이 얼굴쪽) + Face (입 벌림 정도 확인)
        const useBody = targetPose === "Surprise";
        const useFace = targetPose === "Wink" || targetPose === "Close up" || targetPose === "Surprise";
        const useHand = targetPose === "V sign";
        
        // Body keypoints 추출 (모든 포즈에서 제외)
        let bodyKeypointsCount = 0;
        if (useBody && result.body && result.body.length > 0) {
          const body = result.body[0];
          let keypoints = [];
          
          if (Array.isArray(body.keypoints) && body.keypoints.length > 0) {
            keypoints = body.keypoints;
          } else if (Array.isArray(body.pose) && body.pose.length > 0) {
            keypoints = body.pose;
          } else {
            for (const key in body) {
              if (Array.isArray(body[key]) && body[key].length > 0) {
                const firstItem = body[key][0];
                if (firstItem && (firstItem.x !== undefined || firstItem[0] !== undefined)) {
                  keypoints = body[key];
                  break;
                }
              }
            }
          }
          
          // Body 키포인트를 features 배열로 변환 (정규화 없이 원본 좌표 사용)
          for (const kp of keypoints) {
            if (!kp) continue;
            
            let x = null, y = null;
            if (kp.position && Array.isArray(kp.position) && kp.position.length >= 2) {
              x = kp.position[0];
              y = kp.position[1];
            } else if (kp.positionRaw && Array.isArray(kp.positionRaw) && kp.positionRaw.length >= 2) {
              x = kp.positionRaw[0];
              y = kp.positionRaw[1];
            } else if (kp.x !== undefined && kp.y !== undefined) {
              x = kp.x;
              y = kp.y;
            } else if (Array.isArray(kp) && kp.length >= 2) {
              x = kp[0];
              y = kp[1];
            }
            
            if (x !== null && y !== null) {
              features.push(x);
              features.push(y);
              bodyKeypointsCount++;
            }
          }
        }
        
        // Face keypoints 추출 (Wink, Close up, Surprise에서만 사용)
        let faceKeypointsCount = 0;
        if (useFace && result.face && result.face.length > 0) {
          const face = result.face[0];
          if (face.keypoints && Array.isArray(face.keypoints)) {
            for (const kp of face.keypoints) {
              if (!kp) continue;
              
              let x = null, y = null;
              if (kp.position && Array.isArray(kp.position) && kp.position.length >= 2) {
                x = kp.position[0];
                y = kp.position[1];
              } else if (kp.positionRaw && Array.isArray(kp.positionRaw) && kp.positionRaw.length >= 2) {
                x = kp.positionRaw[0];
                y = kp.positionRaw[1];
              } else if (kp.x !== undefined && kp.y !== undefined) {
                x = kp.x;
                y = kp.y;
              } else if (Array.isArray(kp) && kp.length >= 2) {
                x = kp[0];
                y = kp[1];
              }
              
              if (x !== null && y !== null) {
                features.push(x);
                features.push(y);
                faceKeypointsCount++;
              }
            }
          }
        }
        
        // Hand keypoints 추출 (V sign에서만 사용)
        let handKeypointsCount = 0;
        if (useHand && result.hand && result.hand.length > 0) {
          for (const hand of result.hand) {
            let handKeypoints = [];
            
            if (hand.keypoints && Array.isArray(hand.keypoints)) {
              handKeypoints = hand.keypoints;
            } else if (hand.landmarks && Array.isArray(hand.landmarks)) {
              handKeypoints = hand.landmarks;
            } else if (hand.points && Array.isArray(hand.points)) {
              handKeypoints = hand.points;
            }
            
            for (const kp of handKeypoints) {
              if (!kp) continue;
              
              let x = null, y = null;
              if (kp.position && Array.isArray(kp.position) && kp.position.length >= 2) {
                x = kp.position[0];
                y = kp.position[1];
              } else if (kp.positionRaw && Array.isArray(kp.positionRaw) && kp.positionRaw.length >= 2) {
                x = kp.positionRaw[0];
                y = kp.positionRaw[1];
              } else if (kp.x !== undefined && kp.y !== undefined) {
                x = kp.x;
                y = kp.y;
              } else if (Array.isArray(kp) && kp.length >= 2) {
                x = kp[0];
                y = kp[1];
              }
              
              if (x !== null && y !== null) {
                features.push(x);
                features.push(y);
                handKeypointsCount++;
              }
            }
          }
        }
        
        // 디버깅 정보
        console.log(`[${targetPose} Feature] Body: ${bodyKeypointsCount}, Face: ${faceKeypointsCount}, Hand: ${handKeypointsCount}, Total: ${features.length}`);
        
        const targetPose = AI_POSES[aiTargetIndexRef.current];
        
        // features가 있으면 예측 요청
        if (features.length > 0) {
          try {
            const res = await fetch("http://127.0.0.1:8000/api/predict", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ features })
            });

            if (res.ok) {
              const json = await res.json();
              const predicted = json.pose;
              const confidence = json.confidence ?? 0;
              
              // 디버깅: feature 개수와 예측 결과 로그
              if (targetPose === "Close up") {
                console.log(`[Close up] Features: ${features.length}, Predicted: ${predicted}, Confidence: ${(confidence*100).toFixed(1)}%`);
              }
              
              // 화면에 목표 포즈와 감지된 포즈, 신뢰도 표시
              setStatusText(`Show ${targetPose}\nDetected: ${predicted} (${(confidence*100).toFixed(0)}%)`);

              if (predicted === targetPose && confidence >= AI_CONF_THRESHOLD) {
                poseStableCountRef.current += 1;
              } else {
                poseStableCountRef.current = 0;
              }
            } else {
              // 예측 요청 실패 시 기본 메시지 표시
              setStatusText(`Show ${targetPose}\nDetected: - (-%)`);
              poseStableCountRef.current = 0;
            }
          } catch (error) {
            // 예측 요청 에러 시 기본 메시지 표시
            console.error("Prediction error:", error);
            setStatusText(`Show ${targetPose}\nDetected: - (-%)`);
            poseStableCountRef.current = 0;
          }
        } else {
          // features가 없을 때 기본 메시지 표시
          setStatusText(`Show ${targetPose}\nDetected: - (-%)`);
          poseStableCountRef.current = 0;
        }

            if (poseStableCountRef.current >= AI_REQUIRED_STABLE && !isShootingRef.current) {
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
                    setIsFlashing(true);
                    const imageSrc = webcamRef.current.getScreenshot();
                    setTimeout(() => setIsFlashing(false), 150);
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
                    fontWeight: 'bold',
                    whiteSpace: 'pre-line',
                    textAlign: 'center'
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


