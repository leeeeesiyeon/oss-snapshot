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
  const isPausedRef = useRef(false); // 일시정지 상태 (다음 포즈 준비 시간)
  const countdownTimerRef = useRef(null);
  const waitTimerRef = useRef(null); // 대기 시간 타이머

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
      // 일시정지 상태면 AI 루프 건너뛰기 (카메라 화면은 유지)
      if (isPausedRef.current) {
        aiLoopRafRef.current = requestAnimationFrame(runAiLoop);
        return;
      }

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
        // Background: Body + Face + Hand 모두 (일반적인 상태)
        const useBody = targetPose === "Surprise" || targetPose === "Background";
        const useFace = targetPose === "Wink" || targetPose === "Close up" || targetPose === "Surprise" || targetPose === "Background";
        const useHand = targetPose === "V sign" || targetPose === "Background";
        
        // Body keypoints 추출
        // useBody가 true면 features에 추가, false여도 Close up의 경우 개수만 계산
        let bodyKeypointsCount = 0;
        if (result.body && result.body.length > 0) {
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
          
          // Body keypoints 개수 계산 (Close up을 위해 항상 계산)
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
              bodyKeypointsCount++;
              // useBody가 true일 때만 features에 추가
              if (useBody) {
                features.push(x);
                features.push(y);
              }
            }
          }
        }
        
        // Face keypoints 추출 (Wink, Close up, Surprise에서만 사용)
        // drawKeypoints와 동일한 방식으로 landmarks, mesh도 확인
        let faceKeypointsCount = 0;
        let leftEyeEAR = 0;
        let rightEyeEAR = 0;
        let leftEyeClosed = 0; // 0: 열림, 1: 감음
        let rightEyeClosed = 0; // 0: 열림, 1: 감음
        
        if (useFace && result.face && result.face.length > 0) {
          const face = result.face[0];
          let faceKeypoints = [];
          
          // Human.js의 다양한 얼굴 랜드마크 형식 지원 (drawKeypoints와 동일)
          if (face.keypoints && Array.isArray(face.keypoints)) {
            faceKeypoints = face.keypoints;
          } else if (face.landmarks && Array.isArray(face.landmarks)) {
            faceKeypoints = face.landmarks;
          } else if (face.mesh && Array.isArray(face.mesh)) {
            faceKeypoints = face.mesh;
          }
          
          // Wink 포즈의 경우 눈 감음 상태 계산
          if (targetPose === "Wink" && faceKeypoints.length > 0) {
            const getKeypointCoords = (kp) => {
              if (!kp) return null;
              if (kp.position && Array.isArray(kp.position) && kp.position.length >= 2) {
                return { x: kp.position[0], y: kp.position[1] };
              } else if (kp.positionRaw && Array.isArray(kp.positionRaw) && kp.positionRaw.length >= 2) {
                return { x: kp.positionRaw[0], y: kp.positionRaw[1] };
              } else if (kp.x !== undefined && kp.y !== undefined) {
                return { x: kp.x, y: kp.y };
              } else if (Array.isArray(kp) && kp.length >= 2) {
                return { x: kp[0], y: kp[1] };
              }
              return null;
            };
            
            // 왼쪽 눈 EAR 계산
            const leftEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
            const leftEyePoints = leftEyeIndices
              .map(idx => idx < faceKeypoints.length ? getKeypointCoords(faceKeypoints[idx]) : null)
              .filter(p => p);
            
            if (leftEyePoints.length >= 4) {
              const minY = Math.min(...leftEyePoints.map(p => p.y));
              const maxY = Math.max(...leftEyePoints.map(p => p.y));
              const minX = Math.min(...leftEyePoints.map(p => p.x));
              const maxX = Math.max(...leftEyePoints.map(p => p.x));
              const eyeHeight = maxY - minY;
              const eyeWidth = maxX - minX;
              leftEyeEAR = eyeWidth > 0 ? eyeHeight / eyeWidth : 0;
              leftEyeClosed = (leftEyeEAR <= 0.20 || eyeHeight < eyeWidth * 0.12) ? 1 : 0;
            }
            
            // 오른쪽 눈 EAR 계산
            const rightEyeIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
            const rightEyePoints = rightEyeIndices
              .map(idx => idx < faceKeypoints.length ? getKeypointCoords(faceKeypoints[idx]) : null)
              .filter(p => p);
            
            if (rightEyePoints.length >= 4) {
              const minY = Math.min(...rightEyePoints.map(p => p.y));
              const maxY = Math.max(...rightEyePoints.map(p => p.y));
              const minX = Math.min(...rightEyePoints.map(p => p.x));
              const maxX = Math.max(...rightEyePoints.map(p => p.x));
              const eyeHeight = maxY - minY;
              const eyeWidth = maxX - minX;
              rightEyeEAR = eyeWidth > 0 ? eyeHeight / eyeWidth : 0;
              rightEyeClosed = (rightEyeEAR <= 0.20 || eyeHeight < eyeWidth * 0.12) ? 1 : 0;
            }
          }
          
          for (const kp of faceKeypoints) {
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
        
        // Wink 포즈: 눈 감음 상태를 feature에 추가 (Wink와 Close up 구분을 위해)
        if (targetPose === "Wink") {
          features.push(leftEyeEAR);
          features.push(rightEyeEAR);
          features.push(leftEyeClosed);
          features.push(rightEyeClosed);
        }
        
        // Close up 포즈: Body keypoints 개수를 feature에 추가 (얼굴만 보이는 상태 구분을 위해)
        if (targetPose === "Close up") {
          features.push(bodyKeypointsCount); // Body keypoints가 없거나 적다는 것을 명시
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
        
        // features가 있으면 예측 요청
        if (features.length > 0) {
          try {
            let predicted = null;
            let confidence = 0;
            let requestSuccess = false;

            // 1. Wink 포즈: 점수제 (실시간 70점 + AI 30점)
            // AI 신뢰도(0~1.0)를 30점 만점으로 환산 + 윙크 감지되면 70점 = 총점 100점
            // 합격 기준: 80점 이상
            if (targetPose === "Wink") {
              // 1차: AI 모델 예측 시도
              const res = await fetch("http://127.0.0.1:8000/api/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ features })
              });

              if (res.ok) {
                const json = await res.json();
                predicted = json.pose; // AI가 예측한 포즈 이름
                const aiRawConfidence = json.confidence ?? 0; // AI 원본 신뢰도 (0.0 ~ 1.0)
                
                // 점수 계산 시작
                let totalScore = 0;

                // [점수 1] 실시간 규칙 점수 (70점 만점)
                const isEyeWinking = leftEyeClosed !== rightEyeClosed;
                if (isEyeWinking) {
                  totalScore += 70;
                }

                // [점수 2] AI 모델 점수 (30점 만점)
                // AI가 "Wink"라고 했을 때만 점수 부여
                if (predicted === "Wink") {
                  // 원본 신뢰도(0.0~1.0)를 30점 만점으로 변환
                  totalScore += aiRawConfidence * 30;
                } else if (predicted === "Close up") {
                  // [추가] AI가 "Close up"으로 오인식하는 경우 부분 점수 (20점 만점)
                  // 윙크를 하려고 얼굴을 가까이 대면 AI가 Close up으로 착각하기 쉬움
                  // 이 경우 AI 신뢰도가 50%만 넘어도 10점을 획득하여, 눈 감음(70점)과 합쳐 80점 통과 가능
                  totalScore += aiRawConfidence * 20;
                }

                // 최종 판단: 80점 넘으면 합격
                if (totalScore >= 80) {
                  predicted = "Wink";
                  // AI_CONF_THRESHOLD(0.67)를 넘기기 위해 신뢰도를 높게 설정
                  // 점수가 높을수록 1.0에 가깝게, 80점이면 0.8 정도로 매핑
                  confidence = 0.8 + ((totalScore - 80) / 20) * 0.2; 
                } else {
                  // 불합격이면 신뢰도를 0으로
                  confidence = 0;
                }
                
                requestSuccess = true;
              }
            } else {
              // 2. 그 외 포즈는 AI 모델 예측
              const res = await fetch("http://127.0.0.1:8000/api/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ features })
              });

              if (res.ok) {
                const json = await res.json();
                predicted = json.pose;
                confidence = json.confidence ?? 0;
                requestSuccess = true;
                
                // ---------------------------------------------------------
                // 3. 포즈별 추가 검증 (Hard Rules) - AI 오인식 방지
                // ---------------------------------------------------------
                
                // [Close up] 얼굴 외의 신체 부위(어깨 등)가 감지되면 절대 안 됨
                // BlazePose 기준 11번(왼쪽 어깨), 12번(오른쪽 어깨)부터 몸통임
                // 어깨가 조금이라도 확실히 보이면 Close up 실패로 처리
                if (targetPose === "Close up") {
                   // body keypoints 다시 확인
                   let hasBodyPart = false;
                   if (result.body && result.body.length > 0) {
                     const body = result.body[0];
                     const keypoints = body.keypoints || body.pose;
                     
                     if (keypoints) {
                       for (let i = 0; i < keypoints.length; i++) {
                         const kp = keypoints[i];
                         // score가 0.5 이상인 유효한 키포인트에 대해서만 검사
                         const score = kp.score || kp.confidence || 0;
                         if (score > 0.5) {
                           // 이름으로 확인 (part 속성이 있는 경우)
                           if (kp.part) {
                             const name = kp.part.toLowerCase();
                             // 얼굴 부위가 아닌 것이 감지되면
                             if (!name.includes('nose') && !name.includes('eye') && !name.includes('ear') && !name.includes('face')) {
                               hasBodyPart = true;
                               // console.log(`[Close up Rejected] Detected body part: ${name} (score: ${score.toFixed(2)})`);
                               break;
                             }
                           } 
                           // 인덱스로 확인 (0~10: 얼굴, 11~: 몸통)
                           else if (i >= 11) {
                             hasBodyPart = true;
                             // console.log(`[Close up Rejected] Detected body index: ${i} (score: ${score.toFixed(2)})`);
                             break;
                           }
                         }
                       }
                     }
                   }
                   
                   if (hasBodyPart) {
                      confidence = 0; // 신뢰도 0으로 강제 설정
                   }
                }

                // [V sign] 손이 V 모양인지 기하학적으로 검증
                // 검지/중지는 펴져 있고, 약지/소지는 접혀 있어야 함
                if (targetPose === "V sign") {
                  let isVShape = false;
                  
                  if (result.hand && result.hand.length > 0) {
                    for (const hand of result.hand) {
                      const kp = hand.keypoints || hand.landmarks;
                      if (!kp || kp.length < 21) continue;
                      
                      // 0: 손목
                      // 8: 검지 끝, 12: 중지 끝 (펴져야 함)
                      // 16: 약지 끝, 20: 소지 끝 (접혀야 함)
                      
                      const getDist = (idx1, idx2) => {
                        const p1 = kp[idx1];
                        const p2 = kp[idx2];
                        const x1 = p1.x || p1[0] || 0;
                        const y1 = p1.y || p1[1] || 0;
                        const x2 = p2.x || p2[0] || 0;
                        const y2 = p2.y || p2[1] || 0;
                        return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
                      };
                      
                      const wrist = 0;
                      // 손목에서 손가락 끝까지의 거리 계산
                      const distIndex = getDist(wrist, 8);
                      const distMiddle = getDist(wrist, 12);
                      const distRing = getDist(wrist, 16);
                      const distPinky = getDist(wrist, 20);
                      
                      // V sign 조건:
                      // 1. 검지와 중지가 길게 펴져 있어야 함 (약지/소지보다 현저히 길어야 함)
                      // 2. 보통 V sign은 검지/중지 길이가 약지/소지 길이의 1.3배 이상
                      
                      const avgOpen = (distIndex + distMiddle) / 2;
                      const avgClosed = (distRing + distPinky) / 2;
                      
                      // 비율이 1.2 이상이면 V sign으로 인정 (약간의 오차 허용)
                      if (avgClosed > 0 && avgOpen > avgClosed * 1.2) {
                        isVShape = true;
                        // console.log(`[V sign Verified] Ratio: ${(avgOpen/avgClosed).toFixed(2)}`);
                        break; 
                      }
                    }
                  }
                  
                  if (!isVShape) {
                     confidence = 0; // V 모양 아니면 탈락
                     // console.log("[V sign Rejected] Hand shape is not V");
                  }
                }

                // [Surprise] 나홀로 집에 표정 검증 (점수제: 실시간 50점 + AI 50점)
                // 실시간: 입 벌림 확인 (50점)
                // AI: "Surprise"라고 하면 50점
                // 합격 기준: 80점 이상 (즉, 둘 다 만족해야 함. 하나라도 아니면 50점으로 탈락)
                if (targetPose === "Surprise") {
                  let isMouthOpen = false;
                  
                  // 1. 입 벌림 확인 (Face Mesh 기준)
                  if (result.face && result.face.length > 0) {
                    const face = result.face[0];
                    const kp = face.keypoints || face.landmarks || face.mesh;
                    if (kp && kp.length > 0) {
                       const getKeypoint = (idx) => {
                         if (kp[idx]) {
                           const p = kp[idx];
                           const x = p.x || p[0] || 0;
                           const y = p.y || p[1] || 0;
                           return {x, y};
                         }
                         return null;
                       };

                       const upperLip = getKeypoint(13);
                       const lowerLip = getKeypoint(14);
                       
                       const nose = getKeypoint(1);
                       const chin = getKeypoint(152);
                       
                       if (upperLip && lowerLip && nose && chin) {
                         const mouthHeight = Math.abs(lowerLip.y - upperLip.y);
                         const faceHeight = Math.abs(chin.y - nose.y);
                         
                         // 입 높이가 얼굴 높이의 일정 비율 이상이면 입 벌림으로 간주
                         // 0.03 -> 0.015 (아주 조금만 벌려도 인정, 입술이 살짝만 떨어져도 OK)
                         if (faceHeight > 0 && (mouthHeight / faceHeight) > 0.015) { 
                           isMouthOpen = true;
                         }
                       }
                    }
                  }
                  
                  // 점수 계산
                  let totalScore = 0;
                  
                  // [점수 1] 실시간 입 벌림 점수 (50점)
                  if (isMouthOpen) {
                    totalScore += 50;
                  }
                  
                  // [점수 2] AI 모델 점수 (50점)
                  if (predicted === "Surprise") {
                    totalScore += 50;
                  }
                  
                  // 합격 기준: 80점 이상 (즉, 입도 벌리고 AI도 Surprise라고 해야 함)
                  // 하나라도 불만족하면 50점이므로 탈락
                  if (totalScore >= 80) {
                    // 합격 시 신뢰도 보정 (0.8 이상으로)
                    confidence = 0.8 + ((totalScore - 80) / 20) * 0.2;
                  } else {
                    confidence = 0; // 탈락
                  }
                }
              }
            }

            if (requestSuccess) {
              
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
                      
                      // 사진 저장 및 다음 단계 진행 (부수 효과 분리)
                      setCapturedPhotos(prev => {
                        const newPhotos = [...prev, imageSrc];
                        return newPhotos;
                      });

                      // 상태 업데이트를 별도로 수행 (ref 사용)
                      const currentLen = capturedPhotosRef.current.length + 1;
                      if (currentLen >= 4 || aiTargetIndexRef.current >= AI_POSES.length - 1) {
                        setStatusText("Capture Complete");
                        setIsShooting(false);
                        isShootingRef.current = false;
                        setAiTargetIndex(AI_POSES.length);
                        aiTargetIndexRef.current = AI_POSES.length;
                        setTimeout(() => {
                          navigate('/select-frame', { state: { photos: [...capturedPhotosRef.current, imageSrc] } });
                        }, 800);
                      } else {
                        const nextIdx = aiTargetIndexRef.current + 1;
                        setAiTargetIndex(nextIdx);
                        // ref 업데이트는 useEffect에서 처리되지만, 즉시 반영을 위해 여기서도 업데이트
                        aiTargetIndexRef.current = nextIdx; 
                        
                        // 3초 대기 시간 추가 (포즈 준비 시간)
                        isPausedRef.current = true;
                        let waitSeconds = 3;
                        const nextPoseName = AI_POSES[nextIdx];
                        setStatusText(`Next pose: ${nextPoseName}\nStarting in ${waitSeconds}...`);
                        
                        if (waitTimerRef.current) clearInterval(waitTimerRef.current);
                        
                        waitTimerRef.current = setInterval(() => {
                          waitSeconds--;
                          if (waitSeconds <= 0) {
                            clearInterval(waitTimerRef.current);
                            waitTimerRef.current = null;
                            isPausedRef.current = false;
                            // AI 루프가 다시 돌면서 "Show ..." 텍스트로 업데이트됨
                          } else {
                            setStatusText(`Next pose: ${nextPoseName}\nStarting in ${waitSeconds}...`);
                          }
                        }, 1000);

                        setIsShooting(false);
                        isShootingRef.current = false;
                      }
                    }, 400);
                  } else {
                    cnt--;
                    setCountdown(cnt);
                  }
                }, 1000);
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
      if (waitTimerRef.current) {
        clearInterval(waitTimerRef.current);
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


