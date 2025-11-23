import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import Toast from '../components/Toast';
import normalModeButton from '../assets/images/selectmode_normal_mode_button.svg';
import aiModeButton from '../assets/images/selectmode_ai_mode_button.svg';
import select4PhotoButton from '../assets/images/selectmode_select4photo_button.svg';
import startButton from '../assets/images/start_button.svg';
import cameraBox from '../assets/images/selectmode_camera_box.svg';
import devtoolButton from '../assets/images/selectmode_devtool_button.svg';

// 고정 캔버스 크기 (background 이미지 크기에 맞춤)
const CANVAS_WIDTH = 1440;
const CANVAS_HEIGHT = 1080;

const videoConstraints = {
  width: 640,
  height: 480,
  facingMode: "user",
};

// Train AI Page 접근 비밀번호 (환경 변수에서 가져오기)
const TRAIN_PASSWORD = import.meta.env.VITE_DELETE_PASSWORD || "DELETE";

// 2. 모드 선택 페이지
export default function SelectModePage() {
  const navigate = useNavigate();
  const [selectedMode, setSelectedMode] = useState(null);
  const [showHelpTooltip, setShowHelpTooltip] = useState(false);
  const [toast, setToast] = useState(null);

  const handleDevToolClick = () => {
    // 비밀번호 입력
    const password = window.prompt(
      "⚠️ DevTool Access Required\n\n" +
      "Please enter the password to access the AI Training page:"
    );
    
    if (password === null) return; // 취소 버튼을 누른 경우
    
    if (password !== TRAIN_PASSWORD) {
      setToast({ message: 'Incorrect password. Access denied.', type: 'error' });
      return;
    }
    
    // 비밀번호가 맞으면 Train AI 페이지로 이동
    navigate('/train');
  };

  const handleStart = () => {
    if (!selectedMode) {
      setToast({ message: 'Please select a mode!', type: 'warning' });
      return;
    }
    navigate(selectedMode);
  };

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Enter: 시작
      if (e.key === 'Enter' && selectedMode) {
        handleStart();
      }
      // ESC: 뒤로가기
      if (e.key === 'Escape') {
        navigate('/');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMode, navigate]);

  return (
    <div 
      className="select-mode-page page-fade" 
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
        {/* 배경 이미지 - 고정 크기 캔버스 */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            backgroundImage: 'url(/selectmode_background.svg)',
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center'
          }}
        >
          {/* 버튼들을 일렬로 배치 - 절대 위치 */}
          <div
            style={{
              position: 'absolute',
              top: '162px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '25.2px',
              zIndex: 10
            }}
          >
            {/* 일반 모드 버튼 */}
            <button 
              onClick={() => setSelectedMode(selectedMode === '/normal-mode' ? null : '/normal-mode')}
              style={{
                border: 'none',
                cursor: 'pointer',
                backgroundColor: selectedMode === '/normal-mode' ? 'rgba(168, 168, 168, 0.5)' : 'transparent',
                padding: 0,
                display: 'inline-block',
                opacity: selectedMode && selectedMode !== '/normal-mode' ? 0.5 : 1,
                boxShadow: selectedMode === '/normal-mode' ? 'inset 0 2px 4px rgba(0,0,0,0.2)' : 'none',
                borderRadius: '7px',
                width: '221.76px',
                height: 'auto'
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(136, 136, 136, 0.5)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.backgroundColor = selectedMode === '/normal-mode' ? 'rgba(168, 168, 168, 0.5)' : 'transparent';
              }}
            >
              <img 
                src={normalModeButton} 
                alt="일반 모드" 
                style={{ 
                  display: 'block',
                  width: '100%',
                  height: 'auto',
                  objectFit: 'contain'
                }} 
              />
            </button>
            
            {/* AI 모드 버튼 */}
            <button 
              onClick={() => setSelectedMode(selectedMode === '/ai-mode' ? null : '/ai-mode')}
              style={{
                border: 'none',
                cursor: 'pointer',
                backgroundColor: selectedMode === '/ai-mode' ? 'rgba(168, 168, 168, 0.5)' : 'transparent',
                padding: 0,
                display: 'inline-block',
                opacity: selectedMode && selectedMode !== '/ai-mode' ? 0.5 : 1,
                boxShadow: selectedMode === '/ai-mode' ? 'inset 0 2px 4px rgba(0,0,0,0.2)' : 'none',
                borderRadius: '7px',
                width: '221.76px',
                height: 'auto'
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(136, 136, 136, 0.5)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.backgroundColor = selectedMode === '/ai-mode' ? 'rgba(168, 168, 168, 0.5)' : 'transparent';
              }}
            >
              <img 
                src={aiModeButton} 
                alt="AI 모드" 
                style={{ 
                  display: 'block',
                  width: '100%',
                  height: 'auto',
                  objectFit: 'contain'
                }} 
              />
            </button>
            
            {/* 사진 업로드 버튼 */}
            <button 
              onClick={() => setSelectedMode(selectedMode === '/select-picture' ? null : '/select-picture')}
              style={{
                border: 'none',
                cursor: 'pointer',
                backgroundColor: selectedMode === '/select-picture' ? 'rgba(168, 168, 168, 0.5)' : 'transparent',
                padding: 0,
                display: 'inline-block',
                opacity: selectedMode && selectedMode !== '/select-picture' ? 0.5 : 1,
                boxShadow: selectedMode === '/select-picture' ? 'inset 0 2px 4px rgba(0,0,0,0.2)' : 'none',
                borderRadius: '7px',
                width: '221.76px',
                height: 'auto'
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(136, 136, 136, 0.5)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.backgroundColor = selectedMode === '/select-picture' ? 'rgba(168, 168, 168, 0.5)' : 'transparent';
              }}
            >
              <img 
                src={select4PhotoButton} 
                alt="사진 업로드" 
                style={{ 
                  display: 'block',
                  width: '100%',
                  height: 'auto',
                  objectFit: 'contain'
                }} 
              />
            </button>
          </div>

          {/* START 버튼 - 절대 위치 */}
          <div
            style={{
              position: 'absolute',
              top: '399.6px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <button
              onClick={handleStart}
              style={{
                border: 'none',
                cursor: selectedMode ? 'pointer' : 'not-allowed',
                backgroundColor: 'transparent',
                padding: 0,
                display: 'inline-block',
                opacity: 1,
                width: '144.48px',
                height: 'auto'
              }}
              onMouseEnter={(e) => {
                if (selectedMode) {
                  e.currentTarget.style.filter = 'grayscale(100%)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = 'grayscale(0%)';
              }}
            >
              <img
                src={startButton}
                alt="시작"
                style={{
                  display: 'block',
                  width: '100%',
                  height: 'auto',
                  objectFit: 'contain'
                }}
              />
            </button>

            {/* 도움말 버튼 */}
            <div
              style={{
                position: 'relative',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                marginTop: '-13px',
                marginLeft: '-300px'
              }}
              onMouseEnter={() => setShowHelpTooltip(true)}
              onMouseLeave={() => setShowHelpTooltip(false)}
            >
              <button
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: '#1a1a1a',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: 0,
                  fontSize: '14px',
                  color: '#ffffff',
                  fontWeight: 'bold',
                  transition: 'transform 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                ?
              </button>

              {/* 툴팁 */}
              {showHelpTooltip && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginBottom: '10px',
                    width: '400px',
                    padding: '20px',
                    backgroundColor: 'rgba(255, 255, 255, 0.90)',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    zIndex: 1000,
                    fontSize: '13px',
                    lineHeight: '1.7',
                    color: '#1a1a1a',
                    fontFamily: 'Pretendard, sans-serif'
                  }}
                >
                  <div style={{ marginBottom: '8px' }}>
                    If the camera is not working, please check the following items one by one.
                    <br />
                    1. Check if the camera permission is set to <span style={{ color: '#bd1414', fontWeight: 'bold' }}>"Allow"</span> in your browser settings.
                    <br />
                    2. Check if the camera is <span style={{ color: '#bd1414', fontWeight: 'bold' }}>turned on</span> in your computer settings.
                  </div>
                  <div style={{ 
                    borderTop: '1px solid #eee', 
                    paddingTop: '8px',
                    marginTop: '8px'
                  }}>
                    카메라가 작동되지 않는다면, 아래의 사항을 하나씩 확인해주세요.
                    <br />
                    1. 브라우저의 설정을 열어 카메라 권한이 <span style={{ color: '#bd1414', fontWeight: 'bold' }}>"허용"</span>으로 되어있는지 확인
                    <br />
                    2. 컴퓨터 자체 설정의 카메라가 <span style={{ color: '#bd1414', fontWeight: 'bold' }}>켜져 있는지</span> 확인
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 카메라 박스 - 절대 위치 */}
          <div
            style={{
              position: 'absolute',
              top: '745.2px',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 10,
              width: '688.8px',
              height: '517.2px'
            }}
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
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
                  width: '688.8px',
                  height: '517.2px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  overflow: 'hidden',
                  borderRadius: '1px'
                }}
              >
                <Webcam
                  audio={false}
                  videoConstraints={videoConstraints}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '1px',
                    transform: 'scaleX(-1)'
                  }}
                />
              </div>
            </div>
          </div>

          {/* DevTool 버튼 - 절대 위치 */}
          <div
            style={{
              position: 'absolute',
              top: '1020px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10
            }}
          >
            <button
              onClick={handleDevToolClick}
              style={{
                border: 'none',
                cursor: 'pointer',
                backgroundColor: 'transparent',
                padding: 0,
                display: 'inline-block',
                opacity: 1
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.filter = 'grayscale(100%)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = 'grayscale(0%)';
              }}
            >
              <img
                src={devtoolButton}
                alt="DevTool"
                style={{
                  display: 'block',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain'
                }}
              />
            </button>
          </div>
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
