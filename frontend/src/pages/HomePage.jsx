import React from 'react';
import { useNavigate } from 'react-router-dom';
import homeEnterButton from '../assets/images/home_enter_button.svg';
import logoWhite from '../assets/images/logo_white.png';

// 1. 시작 페이지
export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div 
      className="home-page" 
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
      {/* 포토 부스 배경 이미지 (중앙 배치) */}
      <div
        style={{
          backgroundImage: 'url(/home_background.svg)',
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          width: '800px',
          height: '1000px',
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        {/* ENTER 버튼 (배경 이미지 위에 배치) */}
        <button
          onClick={() => navigate('/select-mode')}
          style={{
            border: 'none',
            cursor: 'pointer',
            backgroundColor: 'transparent',
            padding: 0,
            position: 'absolute',
            // 버튼 위치 조정 (이미지 내에서 ENTER 버튼 위치에 맞춤)
            top: '30%',
            left: '33%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.05)';
            e.currentTarget.style.filter = 'grayscale(100%)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)';
            e.currentTarget.style.filter = 'grayscale(0%)';
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'translate(-50%, -50%) scale(0.95)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.05)';
          }}
        >
          <img
            src={homeEnterButton}
            alt="ENTER"
            style={{
              display: 'block',
              width: '200px',
              height: 'auto',
              objectFit: 'contain'
            }}
          />
        </button>
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
      </div>
    </div>
  );
}
