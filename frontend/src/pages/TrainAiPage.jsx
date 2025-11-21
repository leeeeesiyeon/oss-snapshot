import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import * as Human from '@vladmandic/human';
import logoWhite from '../assets/images/logo_white.png';
import cameraBox from '../assets/images/takepicture_camera_box.svg';
import winkButton from '../assets/images/wink_button.svg';
import vButton from '../assets/images/v_button.svg';
import closeupButton from '../assets/images/closeup_button.svg';
import surpriseButton from '../assets/images/surprise_button.svg';
import backgroundButton from '../assets/images/background_button.svg';
import trainButton from '../assets/images/train_button.svg';
import startAitrainButton from '../assets/images/start_aitrain_button.svg';
import traincountBox from '../assets/images/traincount_box.svg';
import deleteButton from '../assets/images/delete_button.svg';
import gotoHomeButton from '../assets/images/gotohome_button.svg';
import axios from 'axios';

const API_URL = "http://127.0.0.1:8000";
const videoWidth = 640;
const videoHeight = 480;
const videoConstraints = { width: videoWidth, height: videoHeight, facingMode: "user" };

const AVAILABLE_POSES = ["Wink", "V sign", "Close up", "Surprise", "Background"];

const POSE_BUTTON_MAP = {
  "Wink": winkButton,
  "V sign": vButton,
  "Close up": closeupButton,
  "Surprise": surpriseButton,
  "Background": backgroundButton
};

export default function TrainAiPage() {
  const navigate = useNavigate();
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [detector, setDetector] = useState(null);
  const [statusText, setStatusText] = useState("Loading AI model...");
  const [poseName, setPoseName] = useState("Wink");
  const [poseCounts, setPoseCounts] = useState({});
  const [leftEyeOpen, setLeftEyeOpen] = useState(true);
  const [rightEyeOpen, setRightEyeOpen] = useState(true);
  const [leftEyePos, setLeftEyePos] = useState({ x: 0, y: 0 });
  const [rightEyePos, setRightEyePos] = useState({ x: 0, y: 0 });
  
  // 이전 프레임의 눈 상태를 유지하기 위한 ref 추가
  const prevEyeStateRef = useRef({
    left: { isOpen: true, center: { x: 0, y: 0 } },
    right: { isOpen: true, center: { x: 0, y: 0 } }
  });
  
  useEffect(() => {
    const load = async () => {
      try {
        const human = new Human.Human({
          modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models/',
          backend: 'webgl',
          modelPath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models/',
          face: { enabled: true },
          hand: { enabled: true },
          object: { enabled: false },
          segmentation: { enabled: false },
          body: { enabled: true },
        });
        await human.warmup();
        setDetector(human);
        setStatusText("AI Ready!");
      } catch (err) {
        console.error('detector 생성 실패', err);
        // CPU로 다시 시도
        try {
          const human = new Human.Human({
            modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models/',
            backend: 'cpu',
            modelPath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models/',
            face: { enabled: true },
            hand: { enabled: true },
            object: { enabled: false },
            segmentation: { enabled: false },
            body: { enabled: true },
          });
          await human.warmup();
          setDetector(human);
          setStatusText("AI Ready! (CPU)");
        } catch (err2) {
          console.error('CPU 백엔드에서도 생성 실패', err2);
          setStatusText('AI initialization failed: Please check your browser WebGL/WebGPU settings.');
        }
      }
    };
    load();
  }, []);

  // 페이지 로드 시 poseCounts 가져오기
  useEffect(() => {
    const fetchPoseCounts = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/pose-counts`);
        setPoseCounts(response.data);
      } catch (err) {
        console.error('Failed to fetch pose counts:', err);
      }
    };
    fetchPoseCounts();
  }, []);

  // 포즈 선택 시 상태 텍스트 업데이트
  useEffect(() => {
    if (detector) {
      // 학습 중이 아닐 때만 상태 텍스트 업데이트
      const isTraining = statusText.includes("Starting") || 
                        statusText.includes("Completed") || 
                        statusText.includes("training") ||
                        statusText.includes("Deleting") ||
                        statusText.includes("Loading");
      
      if (!isTraining && (statusText === "AI Ready!" || statusText === "AI Ready! (CPU)" || statusText.includes("pose training ready"))) {
        setStatusText(`"${poseName}" pose training ready`);
      }
    }
  }, [poseName, detector]);

  const drawKeypoints = (result) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!result) return;
    
    const flipX = (x) => videoWidth - x;
    const getKeypointCoords = (kp) => {
      if (!kp) return null;
      if (kp.position && Array.isArray(kp.position) && kp.position.length >= 2) {
        return { x: kp.position[0], y: kp.position[1], score: kp.score || 1 };
      } else if (kp.positionRaw && Array.isArray(kp.positionRaw) && kp.positionRaw.length >= 2) {
        return { x: kp.positionRaw[0], y: kp.positionRaw[1], score: kp.score || 1 };
      } else if (kp.x !== undefined && kp.y !== undefined) {
        return { x: kp.x, y: kp.y, score: kp.score || kp.confidence || 1 };
      } else if (Array.isArray(kp) && kp.length >= 2) {
        return { x: kp[0], y: kp[1], score: kp[2] || 1 };
      }
      return null;
    };
    
    const drawKeypoint = (x, y, color, size = 5) => {
      if (x !== null && y !== null && x > 0 && y > 0) {
        const flippedX = flipX(x);
        ctx.beginPath();
        ctx.arc(flippedX, y, size, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
      }
    };
    
    const drawLine = (x1, y1, x2, y2, color, lineWidth = 2) => {
      if (x1 !== null && y1 !== null && x2 !== null && y2 !== null) {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(flipX(x1), y1);
        ctx.lineTo(flipX(x2), y2);
        ctx.stroke();
    }
    };
    
    // Body keypoints 그리기 (빨간색)
    if (result.body && result.body.length > 0) {
    const body = result.body[0];
    let keypoints = [];
    
    if (Array.isArray(body.keypoints) && body.keypoints.length > 0) {
      keypoints = body.keypoints;
    } else if (Array.isArray(body.pose) && body.pose.length > 0) {
      keypoints = body.pose;
    } else if (body.keypoints && typeof body.keypoints === 'object') {
      keypoints = Object.values(body.keypoints);
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
    
      ctx.strokeStyle = "rgba(189, 30, 20, 0.6)";
    ctx.lineWidth = 2;
    
    const keypointsByPart = {};
    for (let i = 0; i < keypoints.length; i++) {
      if (keypoints[i].part) {
        keypointsByPart[keypoints[i].part] = keypoints[i];
      }
    }
    const partConnections = [
      ['nose', 'leftEye'], ['nose', 'rightEye'],
      ['leftEye', 'leftEar'], ['rightEye', 'rightEar'],
      ['leftShoulder', 'rightShoulder'],
      ['leftShoulder', 'leftElbow'], ['leftElbow', 'leftWrist'],
      ['rightShoulder', 'rightElbow'], ['rightElbow', 'rightWrist'],
      ['leftShoulder', 'leftHip'], ['rightShoulder', 'rightHip'],
      ['leftHip', 'rightHip'],
      ['leftHip', 'leftKnee'], ['leftKnee', 'leftAnkle'],
      ['rightHip', 'rightKnee'], ['rightKnee', 'rightAnkle'],
    ];
    
    for (const [part1, part2] of partConnections) {
      const kp1 = keypointsByPart[part1];
      const kp2 = keypointsByPart[part2];
      if (kp1 && kp2) {
        const coords1 = getKeypointCoords(kp1);
        const coords2 = getKeypointCoords(kp2);
        if (coords1 && coords2 && coords1.score > 0.1 && coords2.score > 0.1) {
            drawLine(coords1.x, coords1.y, coords2.x, coords2.y, "rgba(189, 30, 20, 0.6)", 2);
        }
      }
    }
    
    for (let i = 0; i < keypoints.length; i++) {
      const kp = keypoints[i];
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
      
      const score = kp.score || kp.confidence || 1;
      
      if (x !== null && y !== null && x > 0 && y > 0 && score > 0.1) {
          drawKeypoint(x, y, "rgba(189, 30, 20, 0.7)", 5);
        }
      }
    }
    
    // Face keypoints 그리기 (파란색)
    if (result.face && result.face.length > 0) {
      const face = result.face[0];
      let faceKeypoints = [];
      
      // Human.js의 다양한 얼굴 랜드마크 형식 지원
      if (face.keypoints && Array.isArray(face.keypoints)) {
        faceKeypoints = face.keypoints;
      } else if (face.landmarks && Array.isArray(face.landmarks)) {
        faceKeypoints = face.landmarks;
      } else if (face.mesh && Array.isArray(face.mesh)) {
        faceKeypoints = face.mesh;
      }
      
      // 얼굴 keypoints 점 그리기
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
          drawKeypoint(x, y, "rgba(0, 100, 255, 0.7)", 4); // 파란색
        }
      }
      
      // 얼굴 윤곽선 그리기 (눈, 입 등)
      if (faceKeypoints.length > 0) {
        // 눈 연결선
        const leftEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
        const rightEyeIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
        const mouthIndices = [61, 146, 91, 181, 84, 17, 314, 405, 320, 307, 375, 321, 308, 324, 318];
        
        const drawFaceContour = (indices, color) => {
          for (let i = 0; i < indices.length - 1; i++) {
            const kp1 = faceKeypoints[indices[i]];
            const kp2 = faceKeypoints[indices[i + 1]];
            if (kp1 && kp2) {
              const coords1 = getKeypointCoords(kp1);
              const coords2 = getKeypointCoords(kp2);
              if (coords1 && coords2) {
                drawLine(coords1.x, coords1.y, coords2.x, coords2.y, color, 1);
              }
            }
          }
        };
        
        // 눈 깜빡임 감지 함수 (MediaPipe 얼굴 랜드마크 인덱스 사용)
        const detectEyeState = (eyeIndices) => {
          // 눈 영역의 모든 keypoints 가져오기
          const eyePoints = [];
          
          for (const idx of eyeIndices) {
            // 인덱스가 배열 범위 내에 있는지 확인
            if (idx >= 0 && idx < faceKeypoints.length && faceKeypoints[idx] !== undefined && faceKeypoints[idx] !== null) {
              const coords = getKeypointCoords(faceKeypoints[idx]);
              if (coords && coords.x > 0 && coords.y > 0 && coords.x < videoWidth && coords.y < videoHeight) {
                eyePoints.push(coords);
              }
            }
          }
          
          // keypoints가 부족하면 null 반환
          // 단, 이전에 눈이 떴던 상태였다면 눈을 감았을 가능성이 높음
          if (eyePoints.length < 4) {
            return null;
          }
          
          // 눈의 최상단, 최하단, 최좌측, 최우측 좌표 찾기
          let minY = Infinity, maxY = -Infinity;
          let minX = Infinity, maxX = -Infinity;
          
          for (const point of eyePoints) {
            if (point.y < minY) minY = point.y;
            if (point.y > maxY) maxY = point.y;
            if (point.x < minX) minX = point.x;
            if (point.x > maxX) maxX = point.x;
          }
          
          // 눈의 세로 길이와 가로 길이
          const eyeHeight = maxY - minY;
          const eyeWidth = maxX - minX;
          
          // 눈의 중심 좌표
          const eyeCenterX = (minX + maxX) / 2;
          const eyeCenterY = (minY + maxY) / 2;
          
          // 눈의 세로/가로 비율 계산 (EAR: Eye Aspect Ratio)
          // 비율이 0.20 이하이면 눈이 감긴 것으로 판단 (더 민감하게)
          // 눈이 떴을 때는 보통 0.25~0.35 정도, 조금 감으면 0.15~0.20 정도
          const eyeAspectRatio = eyeWidth > 0 ? eyeHeight / eyeWidth : 1;
          
          // 눈이 너무 작으면(세로 길이가 가로 길이의 12% 미만) 눈을 감은 것으로 판단
          // 또는 EAR이 0.20 이하면 눈을 감은 것으로 판단 (조금만 감아도 감은 것으로 판단)
          const isOpen = eyeAspectRatio > 0.20 && eyeHeight >= eyeWidth * 0.12;
          
          return { isOpen, center: { x: eyeCenterX, y: eyeCenterY } };
        };
        
        // Human.js의 face 객체에서 직접 눈 정보 가져오기 시도
        let leftEyeState = null;
        let rightEyeState = null;
        
        // 왼쪽 눈 감지
        // 방법 1: face 객체에 직접 눈 정보가 있는지 확인
        if (face.leftEye && Array.isArray(face.leftEye) && face.leftEye.length > 0) {
          // Human.js가 직접 눈 정보를 제공하는 경우
          const leftEyePoints = face.leftEye.map(kp => getKeypointCoords(kp)).filter(c => c);
          if (leftEyePoints.length >= 4) {
            let minY = Math.min(...leftEyePoints.map(p => p.y));
            let maxY = Math.max(...leftEyePoints.map(p => p.y));
            let minX = Math.min(...leftEyePoints.map(p => p.x));
            let maxX = Math.max(...leftEyePoints.map(p => p.x));
            const eyeHeight = maxY - minY;
            const eyeWidth = maxX - minX;
            const eyeAspectRatio = eyeWidth > 0 ? eyeHeight / eyeWidth : 1;
            // 눈이 너무 작으면(세로 길이가 가로 길이의 12% 미만) 눈을 감은 것으로 판단
            // 또는 EAR이 0.20 이하면 눈을 감은 것으로 판단 (조금만 감아도 감은 것으로 판단)
            const isOpen = eyeAspectRatio > 0.20 && eyeHeight >= eyeWidth * 0.12;
            leftEyeState = {
              isOpen: isOpen,
              center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
            };
          }
        }
        
        // 방법 2: MediaPipe 얼굴 랜드마크 인덱스 사용 (방법 1이 실패했거나 없을 때)
        if (leftEyeState === null) {
          const leftEyeIndices = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
          leftEyeState = detectEyeState(leftEyeIndices);
        }
        
        // 오른쪽 눈 감지 - 왼쪽 눈과 완전히 동일한 방식으로 처리
        // 방법 1: face 객체에 직접 눈 정보가 있는지 확인
        if (face.rightEye && Array.isArray(face.rightEye) && face.rightEye.length > 0) {
          // Human.js가 직접 눈 정보를 제공하는 경우
          const rightEyePoints = face.rightEye.map(kp => getKeypointCoords(kp)).filter(c => c);
          if (rightEyePoints.length >= 4) {
            let minY = Math.min(...rightEyePoints.map(p => p.y));
            let maxY = Math.max(...rightEyePoints.map(p => p.y));
            let minX = Math.min(...rightEyePoints.map(p => p.x));
            let maxX = Math.max(...rightEyePoints.map(p => p.x));
            const eyeHeight = maxY - minY;
            const eyeWidth = maxX - minX;
            const eyeAspectRatio = eyeWidth > 0 ? eyeHeight / eyeWidth : 1;
            // 왼쪽 눈과 동일한 임계값 사용
            const isOpen = eyeAspectRatio > 0.12 && eyeHeight >= eyeWidth * 0.08;
            rightEyeState = {
              isOpen: isOpen,
              center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
            };
          }
        }
        
        // 방법 2: MediaPipe 얼굴 랜드마크 인덱스 사용 (방법 1이 실패했거나 없을 때)
        if (rightEyeState === null) {
          const rightEyeIndices = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
          rightEyeState = detectEyeState(rightEyeIndices);
        }
        
        // 이전 상태와 병합: 감지 실패 시 이전 상태 유지
        if (leftEyeState === null) {
          // 감지 실패 시: 이전에 눈이 떴던 상태였다면 눈을 감았을 가능성이 높음
          // 하지만 확실하지 않으므로 이전 상태 유지
          leftEyeState = prevEyeStateRef.current.left;
          
          // 이전에 눈이 떴던 상태였는데 갑자기 감지가 안 되면 눈을 감은 것으로 판단
          if (prevEyeStateRef.current.left.isOpen && prevEyeStateRef.current.left.center.x > 0) {
            // 눈을 감았을 가능성이 높지만, 확실하지 않으므로 이전 상태 유지
            // 대신 임시로 눈을 감은 것으로 표시하지 않음 (너무 민감할 수 있음)
          }
        } else {
          // 위치가 유효하면 업데이트
          if (leftEyeState.center.x > 0 && leftEyeState.center.y > 0) {
            prevEyeStateRef.current.left = leftEyeState;
          } else {
            // 위치가 유효하지 않으면 이전 위치는 유지하되, 상태는 업데이트
            leftEyeState = {
              isOpen: leftEyeState.isOpen,
              center: prevEyeStateRef.current.left.center
            };
            prevEyeStateRef.current.left = leftEyeState;
          }
        }
        
        // 왼쪽 눈과 동일한 방식으로 이전 상태 병합
        if (rightEyeState === null) {
          rightEyeState = prevEyeStateRef.current.right;
        } else {
          // 위치가 유효하면 업데이트, 아니면 이전 위치 유지
          if (rightEyeState.center.x > 0 && rightEyeState.center.y > 0) {
            prevEyeStateRef.current.right = rightEyeState;
          } else {
            rightEyeState = prevEyeStateRef.current.right;
          }
        }
        
        // 눈 상태를 state에 업데이트
        setLeftEyeOpen(leftEyeState.isOpen);
        setRightEyeOpen(rightEyeState.isOpen);
        if (leftEyeState.center.x > 0 && leftEyeState.center.y > 0) {
          setLeftEyePos(leftEyeState.center);
        }
        if (rightEyeState.center.x > 0 && rightEyeState.center.y > 0) {
          setRightEyePos(rightEyeState.center);
        }
        
        // 눈 상태 즉시 표시 (빨간색: 눈 뜸, 흰색: 눈 감음)
        // 이전 위치가 있으면 항상 표시
        let leftEyeDisplayPos = (leftEyeState && leftEyeState.center.x > 0 && leftEyeState.center.y > 0)
          ? leftEyeState.center 
          : prevEyeStateRef.current.left.center;
        let rightEyeDisplayPos = (rightEyeState && rightEyeState.center.x > 0 && rightEyeState.center.y > 0)
          ? rightEyeState.center 
          : prevEyeStateRef.current.right.center;
        
        // 왼쪽 눈이 감지되었는데 오른쪽 눈 위치가 없으면 대칭 위치 계산
        if (leftEyeDisplayPos.x > 0 && leftEyeDisplayPos.y > 0 && 
            (rightEyeDisplayPos.x === 0 || rightEyeDisplayPos.y === 0)) {
          const faceCenterX = videoWidth / 2;
          const leftEyeX = leftEyeDisplayPos.x;
          const rightEyeX = faceCenterX + (faceCenterX - leftEyeX);
          rightEyeDisplayPos = { x: rightEyeX, y: leftEyeDisplayPos.y };
          // 오른쪽 눈 상태도 왼쪽 눈과 동일하게 설정 (임시)
          if (!rightEyeState) {
            rightEyeState = {
              isOpen: leftEyeState ? leftEyeState.isOpen : true,
              center: rightEyeDisplayPos
            };
          }
        }
        
        // 왼쪽 눈 표시
        if (leftEyeDisplayPos.x > 0 && leftEyeDisplayPos.y > 0) {
          const isLeftEyeOpen = leftEyeState ? leftEyeState.isOpen : prevEyeStateRef.current.left.isOpen;
          const eyeColor = isLeftEyeOpen ? "rgba(255, 0, 0, 1)" : "rgba(255, 255, 255, 1)";
          drawKeypoint(leftEyeDisplayPos.x, leftEyeDisplayPos.y, eyeColor, 12);
        }
        
        // 오른쪽 눈 표시 (항상 표시)
        if (rightEyeDisplayPos.x > 0 && rightEyeDisplayPos.y > 0) {
          // 오른쪽 눈 상태 확인: 현재 상태가 있으면 사용, 없으면 이전 상태 사용
          let isRightEyeOpen = true;
          if (rightEyeState) {
            isRightEyeOpen = rightEyeState.isOpen;
          } else if (prevEyeStateRef.current.right) {
            isRightEyeOpen = prevEyeStateRef.current.right.isOpen;
          }
          const eyeColor = isRightEyeOpen ? "rgba(255, 0, 0, 1)" : "rgba(255, 255, 255, 1)";
          drawKeypoint(rightEyeDisplayPos.x, rightEyeDisplayPos.y, eyeColor, 12);
        }
        
        // 간단하게 모든 얼굴 keypoints를 점으로 표시
        // Human.js의 얼굴 keypoints는 보통 468개이므로 모두 점으로 표시
      }
    }
    
    // Hand keypoints 그리기 (초록색)
    if (result.hand && result.hand.length > 0) {
      for (const hand of result.hand) {
        let handKeypoints = [];
        
        if (hand.keypoints && Array.isArray(hand.keypoints)) {
          handKeypoints = hand.keypoints;
        } else if (hand.landmarks && Array.isArray(hand.landmarks)) {
          handKeypoints = hand.landmarks;
        } else if (hand.points && Array.isArray(hand.points)) {
          handKeypoints = hand.points;
        }
        
        // 손가락 관절 점 그리기
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
            drawKeypoint(x, y, "rgba(0, 255, 0, 0.7)", 4); // 초록색
          }
        }
        
        // 손가락 연결선 그리기 (21개 keypoints: 손목 0, 각 손가락당 4개)
        // 손목(0) -> 엄지(1-4) -> 검지(5-8) -> 중지(9-12) -> 약지(13-16) -> 소지(17-20)
        const handConnections = [
          [0, 1], [1, 2], [2, 3], [3, 4], // 엄지
          [0, 5], [5, 6], [6, 7], [7, 8], // 검지
          [0, 9], [9, 10], [10, 11], [11, 12], // 중지
          [0, 13], [13, 14], [14, 15], [15, 16], // 약지
          [0, 17], [17, 18], [18, 19], [19, 20], // 소지
        ];
        
        for (const [idx1, idx2] of handConnections) {
          if (handKeypoints[idx1] && handKeypoints[idx2]) {
            const coords1 = getKeypointCoords(handKeypoints[idx1]);
            const coords2 = getKeypointCoords(handKeypoints[idx2]);
            if (coords1 && coords2) {
              drawLine(coords1.x, coords1.y, coords2.x, coords2.y, "rgba(0, 255, 0, 0.5)", 2);
            }
          }
        }
      }
    }
  };

  useEffect(() => {
    if (!detector) return;
    
    let animationFrameId = null;
    let isRunning = true;
    
    const detectAndDraw = async () => {
      if (!isRunning || !detector || !webcamRef.current || webcamRef.current.video.readyState !== 4) {
        if (isRunning) {
          animationFrameId = requestAnimationFrame(detectAndDraw);
        }
        return;
      }
      
      try {
      const video = webcamRef.current.video;
      const result = await detector.detect(video);
      drawKeypoints(result);
      } catch (err) {
        console.error('Detection error:', err);
      }
      
      if (isRunning) {
        animationFrameId = requestAnimationFrame(detectAndDraw);
      }
    };
    
    animationFrameId = requestAnimationFrame(detectAndDraw);
    
    return () => {
      isRunning = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [detector]);

  const handleLearnPose = async () => {
    if (!detector || !webcamRef.current || !poseName) {
      alert("AI is not loaded or pose name is empty.");
      return;
    }
    
    try {
      setStatusText(`Starting 50 training samples for '${poseName}' pose... Don't move!`);
      
      let successCount = 0;
      let skippedCount = 0;
      
      for (let i = 0; i < 50; i++) {
        const video = webcamRef.current.video;
        const result = await detector.detect(video);
        
        let features = [];
        
        // 각 포즈별로 필요한 keypoints만 사용 (예측 시와 동일)
        // Wink: Face만 (눈 감았는지 확인)
        // Close up: Face만 (얼굴만 있는지 확인)
        // V sign: Hand만 (손만 확인)
        // Surprise: Body (팔/손목이 얼굴쪽) + Face (입 벌림 정도 확인)
        const useBody = poseName === "Surprise";
        const useFace = poseName === "Wink" || poseName === "Close up" || poseName === "Surprise";
        const useHand = poseName === "V sign";
        
        // Body keypoints 추출 (모든 포즈에서 제외)
        if (useBody && result.body && result.body.length > 0) {
          const body = result.body[0];
          let keypoints = [];
          
          // 키포인트 추출 로직 (drawKeypoints와 동일)
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
          
          // Body 키포인트를 features 배열로 변환
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
            }
          }
        }
        
        // Face keypoints 추출 (Wink, Close up, Surprise에서만 사용)
        if (useFace && result.face && result.face.length > 0) {
          const face = result.face[0];
          if (face.keypoints && Array.isArray(face.keypoints)) {
            // 얼굴 keypoints 추가 (눈, 입 등 모든 얼굴 특징점)
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
              }
            }
          }
        }
        
        // Hand keypoints 추출 (V sign에서만 사용)
        if (useHand && result.hand && result.hand.length > 0) {
          // 양손 모두 처리
          for (const hand of result.hand) {
            // Human.js는 keypoints 또는 landmarks를 제공할 수 있음
            let handKeypoints = [];
            
            if (hand.keypoints && Array.isArray(hand.keypoints)) {
              handKeypoints = hand.keypoints;
            } else if (hand.landmarks && Array.isArray(hand.landmarks)) {
              handKeypoints = hand.landmarks;
            } else if (hand.points && Array.isArray(hand.points)) {
              handKeypoints = hand.points;
            }
            
            // 손 keypoints 추가 (손가락 위치 등 - 각 손가락의 관절까지 포함)
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
              }
            }
          }
        }
        
        if (features.length === 0) {
          // 포즈가 감지되지 않은 경우 (배경 포즈 등)
          // 빈 배열이나 기본값을 보내거나 스킵
          skippedCount++;
          setStatusText(`Training '${poseName}' pose... (${i + 1}/50) - Pose not detected`);
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }

        // features가 비어있으면 스킵
        if (features.length === 0) {
          skippedCount++;
          setStatusText(`Training '${poseName}' pose... (${i + 1}/50) - No features extracted`);
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }

        try {
          // 진행 상황 표시
          setStatusText(`Training '${poseName}' pose... (${i + 1}/50)`);
          
          const response = await axios.post(`${API_URL}/api/train`, {
            label: poseName,
            features: features
          }, {
            timeout: 5000 // 5초 타임아웃 설정
          });
          
          successCount++;
          
          // traincount 즉시 업데이트
          setPoseCounts(prevCounts => ({
            ...prevCounts,
            [poseName]: response.data.count 
          }));

        } catch (err) {
          console.error('Training error:', err);
          console.error('Error details:', {
            code: err.code,
            message: err.message,
            response: err.response?.data,
            status: err.response?.status
          });
          
          if (err.code === 'ECONNREFUSED' || err.message?.includes('Network Error') || err.code === 'ERR_NETWORK') {
            setStatusText("Please check if the backend server (Terminal 2) is running.");
          } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
            setStatusText("Request timeout. Please check the backend server.");
          } else if (err.response) {
            setStatusText(`Error: ${err.response.data?.detail || err.response.statusText || 'Unknown error'}`);
          } else {
            setStatusText(`Error: ${err.message || 'Failed to connect to backend server'}`);
          }
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (successCount === 0) {
        setStatusText(`Failed: No pose detected. Please ensure you are visible in the camera.`);
        return;
      }
      
      // 최종적으로 서버에서 전체 카운트 가져오기
      try {
      const response = await axios.get(`${API_URL}/api/pose-counts`);
      setPoseCounts(response.data);
      } catch (err) {
        console.error('Failed to fetch pose counts:', err);
      }
      
      setStatusText(`Completed ${successCount} training samples for '${poseName}' pose! (${skippedCount} skipped)`);
      
    } catch (err) {
      console.error('학습 실패:', err);
      setStatusText('An error occurred during training. Please try again.');
    }
  };

  const handleTrainModel = async () => {
    setStatusText("AI model (Python) is starting training... (takes a few seconds)");
    try {
      const response = await axios.post(`${API_URL}/api/train-model`, {}, {
        timeout: 30000 // 30초 타임아웃
      });
      setStatusText(response.data.message);
      setPoseCounts({}); // 포즈별 학습 횟수 초기화
      alert("AI model has been successfully trained!");
    } catch (err) {
      console.error('Model training error:', err);
      console.error('Error details:', {
        code: err.code,
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      
      let errorMessage = "Model training failed";
      if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (err.code === 'ECONNREFUSED' || err.message?.includes('Network Error') || err.code === 'ERR_NETWORK') {
        errorMessage = "Please check if the backend server (Terminal 2) is running.";
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        errorMessage = "Request timeout. Please check the backend server.";
      } else if (err.message) {
        errorMessage = `Error: ${err.message}`;
      }
      
      setStatusText(errorMessage);
      alert(`❌ Model training failed: ${errorMessage}`);
    }
  };

  const handleResetAll = async () => {
    // 첫 번째 경고창
    const firstConfirm = window.confirm(
      "⚠️ Warning: All training data and models will be deleted!"
    );
    
    if (!firstConfirm) return;
    
    // 두 번째 확인창
    const secondConfirm = window.confirm(
      "Are you sure you want to delete all data?\n\n" +
      "This action cannot be undone. All training data and models will be permanently deleted."
    );
    
    if (!secondConfirm) return;
    
    try {
      setStatusText("Deleting all data...");
      const response = await axios.delete(`${API_URL}/api/reset-all`);
      setPoseCounts({}); // UI 상태 초기화
      setStatusText(response.data.message || "All data deleted!");
      alert("✅ " + (response.data.message || "All data has been deleted."));
    } catch (err) {
      console.error(err);
      setStatusText(err.response?.data?.detail || "Data deletion failed");
      alert("❌ An error occurred during deletion: " + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div 
      className="train-ai-page" 
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
        {/* 카메라 컨테이너 */}
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
          <canvas
            ref={canvasRef}
            style={{ 
              position: "absolute", 
              top: 0,
              left: 0,
              zIndex: 10, 
              width: "100%", 
              height: "100%" 
            }}
          />
          </div>
        </div>
        
        {/* 상태 텍스트 (NormalModePage의 1/4 위치와 동일) */}
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
            {statusText}
          </p>
      </div>
      
        {/* 박스 2개 (카메라와 상태 텍스트 아래) */}
        <div
          style={{
            position: 'absolute',
            top: 'calc(50% + 70px)',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '30px',
            zIndex: 10
          }}
        >
          {/* 왼쪽 박스 - 포즈 버튼들 */}
          <div
            style={{
              width: '310px',
              height: '150px',
              border: '0px solid #A8A8A8',
              backgroundColor: 'transparent',
              borderRadius: '10px',
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              columnGap: '2px',
              rowGap: '0px',
              padding: '5px 10px',
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
            {AVAILABLE_POSES.map((pose) => (
              <button
                key={pose}
                onClick={() => {
                  setPoseName(pose);
                  if (detector) {
                    setStatusText(`"${pose}" pose training ready`);
                  }
                }}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  padding: 0,
                  cursor: 'pointer',
                  opacity: poseName === pose ? 1 : 0.6,
                  transition: 'opacity 0.2s',
                  flex: '0 0 calc(50% - 1px)'
                }}
              >
                <img
                  src={POSE_BUTTON_MAP[pose]}
                  alt={pose}
                  style={{
                    display: 'block',
                    height: '50px',
                    width: 'auto'
                  }}
                />
              </button>
            ))}
          </div>
          {/* 오른쪽 박스 - Train, Start Training 버튼 */}
          <div
            style={{
              width: '310px',
              height: '150px',
              border: '0px solid #A8A8A8',
              backgroundColor: 'transparent',
              borderRadius: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              padding: '10px',
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
          <button 
            onClick={handleLearnPose}
              style={{
                border: 'none',
                backgroundColor: 'transparent',
                padding: 0,
                cursor: 'pointer'
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
                src={trainButton}
                alt="Train"
                style={{
                  display: 'block',
                  height: '50px',
                  width: 'auto'
                }}
              />
          </button>
          
          <button 
            onClick={handleTrainModel}
              style={{
                border: 'none',
                backgroundColor: 'transparent',
                padding: 0,
                cursor: 'pointer'
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
                src={startAitrainButton}
                alt="Start AI Model Training"
                style={{
                  display: 'block',
                  height: '50px',
                  width: 'auto'
                }}
              />
          </button>
        </div>
        </div>
        </div>

      {/* traincount_box (독립 개체) */}
      <div
        style={{
          position: 'absolute',
          top: 'calc(50% + 170px)',
          left: '50%',
          transform: 'translateX(-50%) scale(1.1)',
          transformOrigin: 'center center',
          zIndex: 10
        }}
      >
        <div style={{ position: 'relative' }}>
          <img
            src={traincountBox}
            alt="Train Count Box"
            style={{
              display: 'block',
              width: '700px',
              height: 'auto'
            }}
          />
          <div
            style={{ 
              position: 'absolute',
              top: '10px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '100%', 
              padding: '10px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start'
            }}
          >
            <div style={{ fontSize: '1rem', color: '#1a1a1a', fontWeight: 'bold', marginBottom: '10px' }}>
              Current Training Count:
            </div>
            <div style={{ fontSize: '1rem', color: '#1a1a1a', textAlign: 'center' }}>
              {Object.keys(poseCounts).length === 0 ? (
                <div>No poses trained yet</div>
              ) : (
                Object.entries(poseCounts).map(([pose, count]) => (
                  <div key={pose} style={{ marginBottom: '5px' }}>
                    {pose}: {count} times
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete All Data 버튼 (traincount_box 아래) */}
      <div
        style={{
          position: 'absolute',
          top: 'calc(50% + 430px)',
          left: '50%',
          transform: 'translateX(-50%) scale(1.1)',
          transformOrigin: 'center center',
          zIndex: 10
        }}
      >
        <button
          onClick={handleResetAll}
          style={{
            border: 'none',
            backgroundColor: 'transparent',
            padding: 0,
            cursor: 'pointer'
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
            src={deleteButton}
            alt="Delete All Data"
            style={{
              display: 'block',
              width: 'auto',
              height: '50px'
            }}
          />
        </button>
      </div>

      {/* 경고 문구 (delete all data 버튼 아래) */}
      <div
        style={{
          position: 'absolute',
          top: 'calc(50% + 480px)',
          left: '50%',
          transform: 'translateX(-50%) scale(1.1)',
          transformOrigin: 'center center',
          zIndex: 10,
          textAlign: 'center',
          fontSize: '0.9rem',
          color: '#1a1a1a',
          fontWeight: 100,
          fontFamily: 'Pretendard, sans-serif'
        }}
      >
        ⚠️ Warning: All training data and models will be deleted!
      </div>

      {/* Go to Home 버튼 (delete all data 버튼 아래) */}
      <div
        style={{
          position: 'absolute',
          top: 'calc(50% + 550px)',
          left: '50%',
          transform: 'translateX(-50%) scale(1.1)',
          transformOrigin: 'center center',
          zIndex: 10
        }}
      >
        <button
          onClick={() => navigate('/')}
          style={{
            border: 'none',
            backgroundColor: 'transparent',
            padding: 0,
            cursor: 'pointer'
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
            src={gotoHomeButton}
            alt="Go to Home"
            style={{
              display: 'block',
              width: 'auto',
              height: '50px'
            }}
          />
        </button>
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

