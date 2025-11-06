import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import * as Human from '@vladmandic/human';
import logoWhite from '../assets/images/logo_white.png';
import axios from 'axios';

const API_URL = "http://127.0.0.1:8000";
const videoWidth = 640;
const videoHeight = 480;
const videoConstraints = { width: videoWidth, height: videoHeight, facingMode: "user" };

const AVAILABLE_POSES = ["Wink", "V sign", "Close up", "Surprise", "배경"];

export default function TrainAiPage() {
  const navigate = useNavigate();
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [detector, setDetector] = useState(null);
  const [statusText, setStatusText] = useState("AI 모델 로딩 중...");
  const [poseName, setPoseName] = useState("브이");
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
        setStatusText("AI 준비 완료!");
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
          setStatusText("AI 준비 완료!(CPU)");
        } catch (err2) {
          console.error('CPU 백엔드에서도 생성 실패', err2);
          setStatusText('AI 초기화 실패: 브라우저 WebGL/WebGPU 설정을 확인하세요.');
        }
      }
    };
    load();
  }, []);

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
    
    ctx.strokeStyle = "rgba(0, 255, 0, 0.6)";
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
        ctx.fillStyle = "rgba(0, 255, 0, 0.7)";
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
      alert("AI가 로드되지 않았거나 포즈 이름이 비었습니다.");
      return;
    }
    
    try {
      setStatusText(`'${poseName}' 포즈 50번 학습 시작... 움직이지 마세요!`);
      
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
          setStatusText("백엔드 서버(Terminal 2)가 켜져있는지 확인하세요.");
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const response = await axios.get(`${API_URL}/api/pose-counts`);
      setPoseCounts(response.data);
      
      setStatusText(`'${poseName}' 포즈 50번 학습 완료!`);
      
    } catch (err) {
      console.error('학습 실패:', err);
      setStatusText('학습 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
  };

  const handleTrainModel = async () => {
    setStatusText("AI 뇌(Python)가 학습을 시작합니다... (몇 초 걸림)");
    try {
      const response = await axios.post(`${API_URL}/api/train-model`);
      setStatusText(response.data.message);
      alert("AI 뇌(모델)가 성공적으로 학습되었습니다!");
    } catch (err) {
      console.error(err);
      setStatusText(err.response?.data?.detail || "모델 학습 실패");
    }
  };

  const handleResetAll = async () => {
    const confirmed = window.confirm(
      "⚠️ 경고: 모든 학습 데이터와 모델이 삭제됩니다!\n\n" +
      "이 작업은 되돌릴 수 없습니다. 정말 삭제하시겠습니까?"
    );
    
    if (!confirmed) return;
    
    try {
      setStatusText("전체 데이터 삭제 중...");
      const response = await axios.delete(`${API_URL}/api/reset-all`);
      setPoseCounts({}); // UI 상태 초기화
      setStatusText(response.data.message || "전체 데이터 삭제 완료!");
      alert("✅ " + (response.data.message || "전체 데이터가 삭제되었습니다."));
    } catch (err) {
      console.error(err);
      setStatusText(err.response?.data?.detail || "데이터 삭제 실패");
      alert("❌ 삭제 중 오류가 발생했습니다: " + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div style={{ display: "flex", gap: "40px", justifyContent: "center", padding: "20px", flexWrap: "wrap" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: videoWidth }}>
        <h1>AI 포즈 챌린지 - 학습 페이지</h1>
        <p>{statusText}</p>

        <div style={{ position: "relative", width: videoWidth, height: videoHeight, borderRadius: "10px", overflow: "hidden" }}>
          <Webcam
            ref={webcamRef}
            mirrored={true}
            style={{ 
              position: "absolute", 
              top: 0,
              left: 0,
              zIndex: 9, 
              width: "100%", 
              height: "100%",
              objectFit: "cover"
            }}
            videoConstraints={videoConstraints}
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
        
        <button onClick={() => navigate('/')} style={{ width: videoWidth, marginTop: "20px", backgroundColor: "#555", color: "#f5f5f5", borderRadius: "5px", padding: "10px" }}>
          홈으로 돌아가기
        </button>
      </div>
      
      <div style={{ width: "300px", paddingTop: "60px" }}>
        <div style={{ backgroundColor: "#f0f0f0", padding: "20px", borderRadius: "10px" }}>
          <h3>1. 학습할 포즈 선택</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px" }}>
            {AVAILABLE_POSES.map((pose) => (
              <button
                key={pose}
                onClick={() => setPoseName(pose)}
                style={{
                  width: '100%',
                  padding: "12px 24px",
                  fontSize: "1.1rem",
                  color: poseName === pose ? "#f5f5f5" : "#333",
                  backgroundColor: poseName === pose ? "#007AFF" : "#e0e0e0",
                  border: poseName === pose ? "2px solid #007AFF" : "2px solid #ccc",
                  borderRadius: "10px",
                  cursor: 'pointer',
                  transition: "all 0.2s",
                  fontWeight: poseName === pose ? "bold" : "normal"
                }}
              >
                {pose}
              </button>
            ))}
          </div>
          
          <button 
            onClick={handleLearnPose}
            style={{ width: '100%', padding: "12px 24px", fontSize: "1.1rem", color: "#f5f5f5", backgroundColor: "#007AFF", border: "none", borderRadius: "10px", cursor: 'pointer', marginTop: '20px' }}
          >
            " {poseName} " 포즈 50번 학습
          </button>
          
          <h3 style={{marginTop: '30px'}}>2. (필수) 모델 학습시키기</h3>
          <button 
            onClick={handleTrainModel}
            style={{ width: '100%', padding: "12px 24px", fontSize: "1.1rem", color: "#f5f5f5", backgroundColor: "#34C759", border: "none", borderRadius: "10px", cursor: 'pointer' }}
          >
            AI 뇌(Python) 학습 시작!
          </button>
        </div>
        
        <div style={{ backgroundColor: "#f0f0f0", padding: "20px", borderRadius: "10px", marginTop: '20px' }}>
            <h3>현재 학습된 포즈 횟수:</h3>
            <ul style={{ listStyleType: 'none', padding: 0 }}>
                {Object.entries(poseCounts).length > 0 ? (
                  Object.entries(poseCounts).map(([label, count]) => (
                    <li key={label} style={{ fontSize: '1.1rem' }}>
                        {label}: <strong>{count}</strong> 장
                    </li>
                  ))
                ) : (
                  <li style={{ fontSize: '1rem', color: '#666' }}>학습된 데이터가 없습니다.</li>
                )}
            </ul>
        </div>

        <div style={{ backgroundColor: "#fff3cd", padding: "20px", borderRadius: "10px", marginTop: '20px', border: "2px solid #ffc107" }}>
          <h3 style={{ color: '#856404', marginTop: 0 }}>⚠️ 위험한 작업</h3>
          <button 
            onClick={handleResetAll}
            style={{ 
              width: '100%', 
              padding: "12px 24px", 
              fontSize: "1rem", 
              color: "#fff", 
              backgroundColor: "#dc3545", 
              border: "none", 
              borderRadius: "10px", 
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            전체 데이터 삭제
          </button>
          <p style={{ fontSize: '0.9rem', color: '#856404', marginTop: '10px', marginBottom: 0 }}>
            모든 학습 데이터와 모델을 삭제합니다. 되돌릴 수 없습니다!
          </p>
        </div>
      </div>

      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          color: 'rgba(245, 245, 245, 0.8)',
          fontSize: '0.9rem',
          zIndex: 1000
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

