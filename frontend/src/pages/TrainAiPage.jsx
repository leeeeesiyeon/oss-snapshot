import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import logoWhite from '../assets/images/logo_white.png';
import '@tensorflow/tfjs-backend-cpu';
import * as poseDetection from '@tensorflow-models/pose-detection';
import axios from 'axios';
import * as knnClassifier from '@tensorflow-models/knn-classifier';


const API_URL = "http://127.0.0.1:8000";
const videoWidth = 640;
const videoHeight = 480;
const videoConstraints = { width: videoWidth, height: videoHeight, facingMode: "user" };
const model = poseDetection.SupportedModels.MoveNet;

// 2. KNN 분류기(AI 학습기) 생성
const classifier = knnClassifier.create();

// 학습 가능한 포즈 목록 (고정)
const AVAILABLE_POSES = ["차렷!", "브이", "꽃받침", "볼하트", "배경"];

export default function TrainAiPage() {
  const navigate = useNavigate();
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const [detector, setDetector] = useState(null);
  const [statusText, setStatusText] = useState("AI 모델 로딩 중...");

  // 3. 학습시킬 포즈 이름 상태
  const [poseName, setPoseName] = useState("브이");
  
  // 4. 학습된 포즈 목록 (백엔드에서 알려준 횟수)
  const [poseCounts, setPoseCounts] = useState({}); // { '브이': 100, '볼하트': 100 }

  // AI 모델 로드
  useEffect(() => {
    const load = async () => {
      try {
        // 백엔드 강제 설정 (webgl 우선, 실패 시 cpu)
        try {
          if (tf.getBackend() !== 'webgl') {
            await tf.setBackend('webgl');
          }
        } catch (_) {
          await tf.setBackend('cpu');
        }

        await tf.ready();

        const d = await poseDetection.createDetector(model, {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        });
        setDetector(d);
        setStatusText("AI 준비 완료!");
      } catch (err) {
        console.error('detector 생성 실패', err);
        // 최후의 수단: cpu로 다시 시도
        try {
          await tf.setBackend('cpu');
          await tf.ready();
          const d = await poseDetection.createDetector(model, {
            modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
          });
          setDetector(d);
          setStatusText("AI 준비 완료!(CPU)");
        } catch (err2) {
          console.error('CPU 백엔드에서도 생성 실패', err2);
          setStatusText('AI 초기화 실패: 브라우저 WebGL/WebGPU 설정을 확인하세요.');
        }
      }
    };
    load();
  }, []);
  
  // 관절 그리기
  const drawKeypoints = (poses) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    ctx.scale(-1, 1);
    ctx.translate(-videoWidth, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (poses.length > 0) {
      for (const p of poses[0].keypoints) {
        if (p.score > 0.3) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI);
          ctx.fillStyle = "lime";
          ctx.fill();
        }
      }
    }
  };

  // 실시간 자세 감지
  useEffect(() => {
    if (!detector) return;
    const interval = setInterval(async () => {
      if (!detector || !webcamRef.current || webcamRef.current.video.readyState !== 4) return;
      const video = webcamRef.current.video;
      const poses = await detector.estimatePoses(video);
      drawKeypoints(poses);
    }, 100); // 0.1초마다
    return () => clearInterval(interval);
  }, [detector]);

  // 5. "이 포즈 50번 학습" 버튼 핸들러
  const handleLearnPose = async () => {
    if (!detector || !webcamRef.current || !poseName) {
      alert("AI가 로드되지 않았거나 포즈 이름이 비었습니다.");
      return;
    }
    
    try {
      setStatusText(`'${poseName}' 포즈 50번 학습 시작... 움직이지 마세요!`);
      
      for (let i = 0; i < 50; i++) {
        // 1. 현재 웹캠에서 관절 좌표 추출
        const video = webcamRef.current.video;
        const poses = await detector.estimatePoses(video);
        if (poses.length === 0) {
          console.log("사람이 감지되지 않아 중단");
          continue; // 다음 루프
        }

        // 2. 17개 관절 좌표를 1차원 배열(34개 숫자)로 변환
        const features = poses[0].keypoints.flatMap(kp => [kp.x, kp.y]);

        // 3. 백엔드 API 1번(/api/train) 호출
        try {
          const response = await axios.post(`${API_URL}/api/train`, {
            label: poseName,
            features: features
          });
          
          // (UI) 백엔드가 알려준 횟수로 업데이트
          setPoseCounts(prevCounts => ({
            ...prevCounts,
            [poseName]: response.data.count 
          }));

        } catch (err) {
          console.error(err);
          setStatusText("백엔드 서버(Terminal 2)가 켜져있는지 확인하세요.");
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 100)); // 0.1초 대기
      }
      
      // 학습 완료 후 전체 횟수 다시 가져오기
      const response = await axios.get(`${API_URL}/api/pose-counts`);
      setPoseCounts(response.data);
      
      setStatusText(`'${poseName}' 포즈 50번 학습 완료!`);
      
    } catch (err) {
      console.error('학습 실패:', err);
      setStatusText('학습 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
  };

  // 6. "AI 모델 학습" 핸들러
  const handleTrainModel = async () => {
    setStatusText("AI 뇌(Python)가 학습을 시작합니다... (몇 초 걸림)");
    try {
      // 백엔드 API 2번(/api/train-model) 호출
      const response = await axios.post(`${API_URL}/api/train-model`);
      setStatusText(response.data.message); // "모델 학습 완료!"
      alert("AI 뇌(모델)가 성공적으로 학습되었습니다!");
    } catch (err) {
      console.error(err);
      setStatusText(err.response?.data?.detail || "모델 학습 실패");
    }
  };

  return (
    // NEW: flexWrap: "wrap" 추가 (화면이 좁으면 줄바꿈)
    <div style={{ display: "flex", gap: "40px", justifyContent: "center", padding: "20px", flexWrap: "wrap" }}>
      
      {/* 왼쪽: AI 학습 화면 */}
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
      
      {/* 오른쪽: 학습 컨트롤러 */}
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
                {Object.entries(poseCounts).map(([label, count]) => (
                    <li key={label} style={{ fontSize: '1.1rem' }}>
                        {label}: <strong>{count}</strong> 장
                    </li>
                ))}
            </ul>
        </div>
      </div>

      {/* 저작권 문구 */}
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
      </div>
    </div>
  );
}

