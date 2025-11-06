import React, { useState, useRef, useEffect, useCallback } from 'react';
import Webcam from 'react-webcam';
import * as poseDetection from '@tensorflow-models/pose-detection';
import '@tensorflow/tfjs-backend-webgl';

const videoConstraints = {
  width: 640,
  height: 480,
  facingMode: "user",
};

// -------------------------------
// 사진 촬영 / 업로드 페이지 (수정 완료본)
// -------------------------------
export default function TakePicturePage({ mode, onComplete }) {
  const webcamRef = useRef(null);
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [countdown, setCountdown] = useState(0);
  const [statusText, setStatusText] = useState("준비하세요!");
  const [isShooting, setIsShooting] = useState(false);
  const [currentPhotoNumber, setCurrentPhotoNumber] = useState(1);
  
  // 최신 상태를 참조하기 위한 ref
  const capturedPhotosRef = useRef([]);
  const isShootingRef = useRef(false);
  const currentPhotoNumberRef = useRef(1);
  const takeShotRef = useRef();
  const countdownTimerRef = useRef(null);
  const nextShotTimeoutRef = useRef(null);

  // AI 관련 refs/state
  const detectorRef = useRef(null);
  const aiLoopRafRef = useRef(null);
  const poseStableCountRef = useRef(0);
  const [aiTargetIndex, setAiTargetIndex] = useState(0); // 0..3
  const aiTargetIndexRef = useRef(0);
  const AI_REQUIRED_STABLE = 5; // 연속 프레임 수
  const AI_CONF_THRESHOLD = 0.7;
  const AI_POSES = ["차렷!", "브이", "꽃받침", "볼하트"];

  // ref와 state 동기화
  useEffect(() => {
    capturedPhotosRef.current = capturedPhotos;
  }, [capturedPhotos]);
  
  useEffect(() => {
    isShootingRef.current = isShooting;
  }, [isShooting]);
  
  useEffect(() => {
    currentPhotoNumberRef.current = currentPhotoNumber;
  }, [currentPhotoNumber]);

  useEffect(() => {
    aiTargetIndexRef.current = aiTargetIndex;
  }, [aiTargetIndex]);

  // ---------------------------------
  // 일반 모드 로직 (기존 takeShot)
  // ---------------------------------
  const takeShot = useCallback(() => {
    const currentPhotoCount = capturedPhotosRef.current.length;
    const currentNumber = currentPhotoNumberRef.current;
    
    console.log(`takeShot 호출: 사진 수=${currentPhotoCount}, 번호=${currentNumber}, 촬영중=${isShootingRef.current}`);
    
    // 이미 촬영 중이거나 4장을 넘은 경우 중지
    if (isShootingRef.current || currentNumber > 4 || currentPhotoCount >= 4) {
      console.log(`takeShot 중지: 촬영중=${isShootingRef.current}, 번호=${currentNumber}, 사진수=${currentPhotoCount}`);
      return;
    }
    
    // 사진 수와 번호가 일치해야 함 (번호 = 사진 수 + 1)
    if (currentNumber !== currentPhotoCount + 1) {
      console.log(`takeShot 중지: 번호와 사진 수 불일치 (번호=${currentNumber}, 사진수=${currentPhotoCount})`);
      return;
    }
    
    setIsShooting(true);
    isShootingRef.current = true;
    let count = 3;
    setCountdown(count);
    setStatusText("준비하세요!");

    countdownTimerRef.current = setInterval(() => {
      if (count <= 1) {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
        setCountdown(0);
        setStatusText("찰칵!");
        
        // 실제 촬영
        setTimeout(() => {
          const imageSrc = webcamRef.current.getScreenshot();
          setCapturedPhotos(prevPhotos => {
            const newPhotos = [...prevPhotos, imageSrc];
            const newLength = newPhotos.length;
            
            console.log(`촬영 완료: ${newLength}장`);
            
            // 촬영된 사진이 4장이면 완료
            if (newLength === 4) {
              setStatusText("촬영 완료!");
              setIsShooting(false);
              isShootingRef.current = false;
              setCurrentPhotoNumber(5);
              currentPhotoNumberRef.current = 5;
              setTimeout(() => onComplete(newPhotos), 1000);
            } else {
              // 4장 미만이면 다음 촬영 준비
              // 다음 사진 번호 = 현재 사진 수 + 1
              const nextNumber = newLength + 1;
              setIsShooting(false);
              isShootingRef.current = false;
              setCurrentPhotoNumber(nextNumber);
              currentPhotoNumberRef.current = nextNumber;
              
              console.log(`다음 촬영 준비: ${nextNumber}번째`);
              
              // 다음 번호가 4 이하일 때만 다음 촬영 시작
              if (nextNumber <= 4) {
                setStatusText("다음 컷을 준비하세요...");
                // 이전 timeout 정리
                if (nextShotTimeoutRef.current) {
                  clearTimeout(nextShotTimeoutRef.current);
                }
                // ref를 업데이트한 후 다음 촬영 시작
                nextShotTimeoutRef.current = setTimeout(() => {
                  // 최신 상태 확인
                  const currentPhotoCount = capturedPhotosRef.current.length;
                  const currentNum = currentPhotoNumberRef.current;
                  console.log(`다음 촬영 시작 시도: ${currentNum}번째, 현재사진수=${currentPhotoCount}`);
                  // 조건 확인 후 촬영 시작 - 사진 수와 번호가 일치해야 함
                  if (takeShotRef.current && currentNum === currentPhotoCount + 1 && currentPhotoCount < 4 && !isShootingRef.current) {
                    takeShotRef.current();
                  } else {
                    console.log(`촬영 시작 취소: 번호=${currentNum}, 사진수=${currentPhotoCount}, 촬영중=${isShootingRef.current}`);
                  }
                  nextShotTimeoutRef.current = null;
                }, 2000);
              } else {
                setStatusText("촬영 완료!");
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
  }, [onComplete]);
  
  // takeShot ref 업데이트
  takeShotRef.current = takeShot;

  // ✅ 첫 번째 샷 자동 시작 (일반 모드)
  useEffect(() => {
    if (mode === 'normal' && capturedPhotos.length === 0 && currentPhotoNumber === 1 && !isShooting) {
      const timer = setTimeout(() => {
        console.log('첫 번째 촬영 시작');
        takeShot();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [mode, capturedPhotos.length, currentPhotoNumber, isShooting, takeShot]);

  // ---------------------------------
  // AI 모드: MoveNet 로드 + 연속 추정 루프
  // ---------------------------------
  useEffect(() => {
    let isMounted = true;

    const createDetector = async () => {
      try {
        // 모델 옵션: 환경에 따라 변경 가능
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
          // features: normalized x,y 순서로 flat 배열
          const keypoints = poses[0].keypoints;
          const features = [];
          for (let kp of keypoints) {
            features.push((kp.x ?? 0) / videoConstraints.width);
            features.push((kp.y ?? 0) / videoConstraints.height);
          }

          // 서버에 예측 요청
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
            // 상태 업데이트
            setStatusText(`${targetPose} 을(를) 보여주세요. -> 인식: ${predicted} (${(confidence*100).toFixed(0)}%)`);

            if (predicted === targetPose && confidence >= AI_CONF_THRESHOLD) {
              poseStableCountRef.current += 1;
            } else {
              poseStableCountRef.current = 0;
            }

            // 안정적으로 연속 감지되면 촬영 트리거
            if (poseStableCountRef.current >= AI_REQUIRED_STABLE && !isShootingRef.current) {
              console.log('AI가 포즈 안정적이라 판단하여 촬영 시작');
              poseStableCountRef.current = 0;
              // 촬영용 카운트다운과 실제 캡쳐 로직 재사용
              // set currentPhotoNumber based on aiTargetIndex
              const nextNumber = capturedPhotosRef.current.length + 1;
              setCurrentPhotoNumber(nextNumber);
              currentPhotoNumberRef.current = nextNumber;
              // 촬영 시작: 재사용 가능한 내부 로직(카운트다운 후 캡쳐)
              // 간단히 takeShot 스타일로 3초 카운트 후 캡쳐
              setIsShooting(true);
              isShootingRef.current = true;
              let cnt = 3;
              setCountdown(cnt);
              setStatusText("포즈 확인 완료! 3초 후 촬영합니다");
              countdownTimerRef.current = setInterval(() => {
                if (cnt <= 1) {
                  clearInterval(countdownTimerRef.current);
                  countdownTimerRef.current = null;
                  setCountdown(0);
                  setStatusText("찰칵!");
                  setTimeout(() => {
                    const imageSrc = webcamRef.current.getScreenshot();
                    setCapturedPhotos(prev => {
                      const newPhotos = [...prev, imageSrc];
                      const newLen = newPhotos.length;
                      // AI 시퀀스 진행
                      if (newLen >= 4 || aiTargetIndexRef.current >= AI_POSES.length - 1) {
                        setStatusText("촬영 완료!");
                        setIsShooting(false);
                        isShootingRef.current = false;
                        setAiTargetIndex(AI_POSES.length); // 끝으로 설정
                        aiTargetIndexRef.current = AI_POSES.length;
                        setTimeout(() => onComplete(newPhotos), 800);
                      } else {
                        // 다음 타켓으로
                        const nextIdx = aiTargetIndexRef.current + 1;
                        setAiTargetIndex(nextIdx);
                        aiTargetIndexRef.current = nextIdx;
                        setStatusText("다음 포즈로 준비하세요...");
                        setIsShooting(false);
                        isShootingRef.current = false;
                        // 잠시 후 AI 루프가 계속 탐지하여 다음 포즈 촬영
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
            console.warn('predict API 실패', res.status);
          }
        }
      } catch (e) {
        console.error('AI 루프 에러', e);
      }

      aiLoopRafRef.current = requestAnimationFrame(runAiLoop);
    };

    if (mode === 'ai') {
      // 초기화: detector 생성 후 루프 시작
      createDetector().then(() => {
        if (isMounted) {
          aiLoopRafRef.current = requestAnimationFrame(runAiLoop);
          // 초기 상태 세팅
          setAiTargetIndex(0);
          aiTargetIndexRef.current = 0;
          poseStableCountRef.current = 0;
          setCapturedPhotos([]); // AI 모드 시작 시 초기화(원하면 제거)
          capturedPhotosRef.current = [];
          setStatusText(`${AI_POSES[0]} 을(를) 보여주세요.`);
          setCurrentPhotoNumber(1);
          currentPhotoNumberRef.current = 1;
        }
      });
    }

    return () => {
      isMounted = false;
      if (aiLoopRafRef.current) {
        cancelAnimationFrame(aiLoopRafRef.current);
        aiLoopRafRef.current = null;
      }
      if (detectorRef.current) {
        // detector는 dispose 메소드가 있으면 호출
        if (detectorRef.current.dispose) detectorRef.current.dispose();
        detectorRef.current = null;
      }
    };
  }, [mode, onComplete]);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
      if (nextShotTimeoutRef.current) {
        clearTimeout(nextShotTimeoutRef.current);
      }
      if (aiLoopRafRef.current) {
        cancelAnimationFrame(aiLoopRafRef.current);
      }
      if (detectorRef.current && detectorRef.current.dispose) {
        detectorRef.current.dispose();
      }
    };
  }, []);

  // ---------------------------------
  // 📤 업로드 모드 로직
  // ---------------------------------
  const handleFileUpload = (event) => {
    const files = event.target.files;
    if (files.length !== 4) {
      alert("사진 4장을 정확히 선택해야 합니다!");
      return;
    }

    const fileUrls = [];
    for (let i = 0; i < files.length; i++) {
      fileUrls.push(URL.createObjectURL(files[i]));
    }

    onComplete(fileUrls);
  };

  // ---------------------------------
  // 렌더링
  // ---------------------------------

  // 1. 일반 모드
  if (mode === 'normal') {
    // 촬영 완료 상태인지 확인
    const isCompleted = currentPhotoNumber > 4 || capturedPhotos.length === 4;
    
    return (
      <div className="take-picture-page" style={{ textAlign: 'center' }}>
        <p className="webcam-status">
          {isCompleted
            ? "촬영 완료!"
            : `(${currentPhotoNumber} / 4) 번째 컷`}
        </p>

        <div
          className="webcam-container"
          style={{
            position: 'relative',
            width: '640px',
            height: '480px',
            margin: '0 auto',
          }}
        >
          <Webcam
            ref={webcamRef}
            audio={false}
            videoConstraints={videoConstraints}
            screenshotFormat="image/jpeg"
            mirrored={true}
            width="100%"
            height="100%"
          />

          {/* 카운트다운 오버레이 */}
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

          {/* 상태 텍스트 */}
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

          {/* 촬영 완료 오버레이 */}
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
                촬영 완료!
              </h2>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. AI 모드
  if (mode === 'ai') {
    const isCompleted = aiTargetIndex >= AI_POSES.length || capturedPhotos.length === 4;
    const nextTarget = AI_POSES[Math.min(aiTargetIndex, AI_POSES.length - 1)];

    return (
      <div className="take-picture-page" style={{ textAlign: 'center' }}>
        <p className="webcam-status">
          {isCompleted
            ? "촬영 완료!"
            : `AI 모드: 다음 포즈 - ${nextTarget} (${capturedPhotos.length} / 4)`}
        </p>

        <div
          className="webcam-container"
          style={{
            position: 'relative',
            width: '640px',
            height: '480px',
            margin: '0 auto',
          }}
        >
          <Webcam
            ref={webcamRef}
            audio={false}
            videoConstraints={videoConstraints}
            screenshotFormat="image/jpeg"
            mirrored={true}
            width="100%"
            height="100%"
          />

          {/* 카운트다운 오버레이 */}
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

          {/* 상태 텍스트 */}
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

          {/* 촬영 완료 오버레이 */}
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
                촬영 완료!
              </h2>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. 업로드 모드
  if (mode === 'upload') {
    return (
      <div className="take-picture-page" style={{ textAlign: 'center' }}>
        <p>프레임에 넣을 사진 4장을 선택하세요.</p>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileUpload}
        />
      </div>
    );
  }

  // mode가 잘못된 경우
  return (
    <div className="take-picture-page" style={{ textAlign: 'center' }}>
      <h2>Mode error: Invalid mode was passed.</h2>
    </div>
  );
}
