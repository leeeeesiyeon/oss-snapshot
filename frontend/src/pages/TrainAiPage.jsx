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
  useEffect(() => {
    const load = async () => {
      try {
        const human = new Human.Human({
          modelBasePath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models/',
          backend: 'webgl',
          modelPath: 'https://cdn.jsdelivr.net/npm/@vladmandic/human/models/',
          face: { enabled: false },
          hand: { enabled: false },
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
            face: { enabled: false },
            hand: { enabled: false },
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
    
    if (!result || !result.body || result.body.length === 0) {
      return;
    }
    
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
    
    if (keypoints.length === 0) {
      return;
    }
    
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
          ctx.beginPath();
          ctx.moveTo(flipX(coords1.x), coords1.y);
          ctx.lineTo(flipX(coords2.x), coords2.y);
          ctx.stroke();
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
        const flippedX = flipX(x);
        ctx.beginPath();
        ctx.arc(flippedX, y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(189, 30, 20, 0.7)";
        ctx.fill();
      }
    }
  };

  useEffect(() => {
    if (!detector) return;
    const interval = setInterval(async () => {
      if (!detector || !webcamRef.current || webcamRef.current.video.readyState !== 4) return;
      const video = webcamRef.current.video;
      const result = await detector.detect(video);
      drawKeypoints(result);
    }, 100);
    return () => clearInterval(interval);
  }, [detector]);

  const handleLearnPose = async () => {
    if (!detector || !webcamRef.current || !poseName) {
      alert("AI is not loaded or pose name is empty.");
      return;
    }
    
    try {
      setStatusText(`Starting 50 training samples for '${poseName}' pose... Don't move!`);
      
      for (let i = 0; i < 50; i++) {
        const video = webcamRef.current.video;
        const result = await detector.detect(video);
        if (!result.body || result.body.length === 0) {
          continue;
        }

        const keypoints = result.body[0].keypoints || [];
        const features = keypoints.flatMap(kp => [kp.x, kp.y]);

        try {
          const response = await axios.post(`${API_URL}/api/train`, {
            label: poseName,
            features: features
          });
          
          setPoseCounts(prevCounts => ({
            ...prevCounts,
            [poseName]: response.data.count 
          }));

        } catch (err) {
          console.error(err);
          setStatusText("Please check if the backend server (Terminal 2) is running.");
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const response = await axios.get(`${API_URL}/api/pose-counts`);
      setPoseCounts(response.data);
      
      setStatusText(`Completed 50 training samples for '${poseName}' pose!`);
      
    } catch (err) {
      console.error('학습 실패:', err);
      setStatusText('An error occurred during training. Please try again.');
    }
  };

  const handleTrainModel = async () => {
    setStatusText("AI model (Python) is starting training... (takes a few seconds)");
    try {
      const response = await axios.post(`${API_URL}/api/train-model`);
      setStatusText(response.data.message);
      setPoseCounts({}); // 포즈별 학습 횟수 초기화
      alert("AI model has been successfully trained!");
    } catch (err) {
      console.error(err);
      setStatusText(err.response?.data?.detail || "Model training failed");
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
          top: 'calc(50% + 400px)',
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
          top: 'calc(50% + 460px)',
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
          top: 'calc(50% + 540px)',
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

