import React from 'react';
import { useNavigate } from 'react-router-dom';
import homeEnterButton from '../assets/images/home_enter_button.svg';

// 고정 캔버스 크기 (background 이미지 크기에 맞춤)
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 900;

// 1. 시작 페이지
export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div 
      className="home-page page-fade" 
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
          {/* Wrapper - 고정 크기 캔버스 */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              backgroundImage: 'url(/home_background.svg)',
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center'
            }}
          >
            {/* EnterButton - 절대 위치 */}
            <div
              style={{
                position: 'absolute',
                top: '315px',
                left: '480px',
                transform: 'translate(-50%, -50%)',
                zIndex: 10
              }}
            >
              {/* 펄스 효과 링들 */}
              <div
                className="pulse-ring"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '183px',
                  height: '57px',
                  borderRadius: '8px',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  animation: 'pulse 2s ease-out infinite',
                  pointerEvents: 'none'
                }}
              />
              <div
                className="pulse-ring"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '183px',
                  height: '57px',
                  borderRadius: '8px',
                  border: '2px solid rgba(255, 255, 255, 0.2)',
                  animation: 'pulse 2s ease-out infinite 0.5s',
                  pointerEvents: 'none'
                }}
              />
              <div
                className="pulse-ring"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '183px',
                  height: '57px',
                  borderRadius: '8px',
                  border: '2px solid rgba(255, 255, 255, 0.1)',
                  animation: 'pulse 2s ease-out infinite 1s',
                  pointerEvents: 'none'
                }}
              />
              
              <button
                onClick={() => navigate('/select-mode')}
                style={{
                  position: 'relative',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                  padding: 0,
                  zIndex: 1
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
                  src={homeEnterButton}
                  alt="ENTER"
                  style={{
                    display: 'block',
                    width: '183px',
                    height: '57px',
                    objectFit: 'contain'
                  }}
                />
              </button>
            </div>

          {/* GitHub 정보 및 저작권 - Enter 버튼 옆 */}
          <div
            style={{
              position: 'absolute',
              top: '300px',
              left: '790px',
              transform: 'translateY(-50%)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              zIndex: 10,
              fontSize: '12px',
              color: '#1a1a1a',
              fontFamily: 'Pretendard, sans-serif'
            }}
          >
            <div style={{ fontWeight: 'bold' }}>
              @leeeeesiyeon
            </div>
            <div style={{ fontSize: '10px', color: '#666', lineHeight: '1.4' }}>
              Copyright © 2025<br />
              All rights reserved
            </div>
            <a
              href="https://github.com/leeeeesiyeon/oss-snapshot"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '10px',
                color: '#0066cc',
                textDecoration: 'none',
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#004499';
                e.currentTarget.style.textDecoration = 'underline';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#0066cc';
                e.currentTarget.style.textDecoration = 'none';
              }}
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
