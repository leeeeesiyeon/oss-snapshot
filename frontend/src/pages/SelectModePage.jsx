import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import logoWhite from '../assets/images/logo_white.png';
import normalModeButton from '../assets/images/selectmode_normal_mode_button.svg';
import aiModeButton from '../assets/images/selectmode_ai_mode_button.svg';
import select4PhotoButton from '../assets/images/selectmode_select4photo_button.svg';
import startButton from '../assets/images/start_button.svg';
import cameraBox from '../assets/images/selectmode_camera_box.svg';
import devtoolButton from '../assets/images/selectmode_devtool_button.svg';

const videoConstraints = {
  width: 640,
  height: 480,
  facingMode: "user",
};

// 2. 모드 선택 페이지
export default function SelectModePage() {
  const navigate = useNavigate();
  const [selectedMode, setSelectedMode] = useState(null);

  const handleStart = () => {
    if (!selectedMode) {
      alert('Please select a mode!');
      return;
    }
    navigate(selectedMode);
  };

  return (
    <div 
      className="select-mode-page" 
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
          backgroundImage: 'url(/selectmode_background.svg)',
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          width: '1200px',
          height: '1500px',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        {/* 버튼들을 일렬로 배치 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '35px',
            position: 'absolute',
            top: '210px',
            left: '50%',
            transform: 'translateX(-50%)',
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
              borderRadius: '15px'
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(0.95)';
              e.currentTarget.style.backgroundColor = 'rgba(136, 136, 136, 0.5)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.backgroundColor = selectedMode === '/normal-mode' ? 'rgba(168, 168, 168, 0.5)' : 'transparent';
            }}
          >
            <img 
              src={normalModeButton} 
              alt="일반 모드" 
              style={{ 
                display: 'block',
                width: '309px',
                height: 'auto',
                objectFit: 'contain',
                maxWidth: 'none',
                minWidth: '309px'
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
              borderRadius: '15px'
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(0.95)';
              e.currentTarget.style.backgroundColor = 'rgba(136, 136, 136, 0.5)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.backgroundColor = selectedMode === '/ai-mode' ? 'rgba(168, 168, 168, 0.5)' : 'transparent';
            }}
          >
            <img 
              src={aiModeButton} 
              alt="AI 모드" 
              style={{ 
                display: 'block',
                width: '309px',
                height: 'auto',
                objectFit: 'contain',
                maxWidth: 'none',
                minWidth: '309px'
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
              borderRadius: '15px'
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(0.95)';
              e.currentTarget.style.backgroundColor = 'rgba(136, 136, 136, 0.5)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.backgroundColor = selectedMode === '/select-picture' ? 'rgba(168, 168, 168, 0.5)' : 'transparent';
            }}
          >
            <img 
              src={select4PhotoButton} 
              alt="사진 업로드" 
              style={{ 
                display: 'block',
                width: '309px',
                height: 'auto',
                objectFit: 'contain',
                maxWidth: 'none',
                minWidth: '309px'
              }} 
            />
          </button>
        </div>

        {/* START 버튼 (모드 선택 버튼 아래) */}
        <div
          style={{
            position: 'absolute',
            top: '545px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10
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
              opacity: 1
            }}
            onMouseEnter={(e) => {
              if (selectedMode) {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.filter = 'grayscale(100%)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.filter = 'grayscale(0%)';
            }}
            onMouseDown={(e) => {
              if (selectedMode) {
                e.currentTarget.style.transform = 'scale(0.95)';
              }
            }}
            onMouseUp={(e) => {
              if (selectedMode) {
                e.currentTarget.style.transform = 'scale(1.05)';
              }
            }}
          >
            <img
              src={startButton}
              alt="시작"
              style={{
                display: 'block',
                width: '200px',
                height: 'auto',
                objectFit: 'contain'
              }}
            />
          </button>
        </div>

        {/* 카메라 박스 (START 버튼 아래) */}
        <div
          style={{
            position: 'absolute',
            top: '925px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <div
            style={{
              position: 'relative',
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
                width: '300px',
                height: 'auto',
                objectFit: 'contain',
                transform: 'scale(3.332)',
                zIndex: 1
              }}
            />
            {/* 웹캠 */}
            <div
              style={{
                position: 'relative',
                zIndex: 2,
                width: '300px',
                height: '225px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
                transform: 'scale(3.332)',
                transformOrigin: 'center center',
                borderRadius: '3px'
              }}
            >
              <Webcam
                audio={false}
                videoConstraints={videoConstraints}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: '3px',
                  transform: 'scaleX(-1)'
                }}
              />
            </div>
          </div>
        </div>

        {/* DevTool 버튼 (카메라 박스 아래) */}
        <div
          style={{
            position: 'absolute',
            top: '1435px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10
          }}
        >
          <button
            onClick={() => navigate('/train')}
            style={{
              border: 'none',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              padding: 0,
              display: 'inline-block',
              opacity: 1
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

      {/* 저작권 문구 (배경 이미지 아래 고정) */}
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
