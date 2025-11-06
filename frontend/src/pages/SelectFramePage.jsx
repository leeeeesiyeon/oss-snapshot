import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import frameBlack from '../assets/images/frames/frame_black.png';
import frameRed from '../assets/images/frames/frame_red.png';
import frameWhite from '../assets/images/frames/frame_white.png';
import logoWhite from '../assets/images/logo_white.png';
import whiteButton from '../assets/images/selectframe_white_button.svg';
import blackButton from '../assets/images/selectframe_black_button.svg';
import redButton from '../assets/images/selectframe_red_button.svg';
import printButton from '../assets/images/print_button.svg';

// 프레임 선택 페이지
export default function SelectFramePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const photos = location.state?.photos || [];
  const [selectedFrame, setSelectedFrame] = useState('white');

  // 프레임 이미지
  const frameImages = {
    black: frameBlack,
    red: frameRed,
    white: frameWhite,
  };

  const handleFrameSelect = (frameType) => {
    setSelectedFrame(frameType);
  };

  const handleConfirm = () => {
    if (photos.length === 0) {
      alert('No photos available');
      return;
    }
    // 프레임과 사진 정보를 함께 전달
    navigate('/print', { 
      state: { 
        photos: photos,
        frame: selectedFrame 
      } 
    });
  };

  if (photos.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <h2>No photos available</h2>
        <button 
          onClick={() => navigate('/')}
          style={{ 
            padding: '10px 20px', 
            fontSize: '1rem', 
            cursor: 'pointer',
            marginTop: '20px'
          }}
        >
          Home
        </button>
      </div>
    );
  }

  return (
    <div 
      className="select-frame-page" 
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
          justifyContent: 'flex-start',
          alignItems: 'center',
          width: '1200px',
          height: '1500px'
        }}
      >
        <img
          src="/selectframe_background.svg"
          alt="Background"
          style={{
            position: 'absolute',
            width: '1200px',
            height: '1500px',
            objectFit: 'contain',
            zIndex: 1
          }}
        />
        {/* 프레임 선택 버튼들 */}
        <div style={{ 
          position: 'absolute',
          top: '230px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          gap: '60px', 
          flexWrap: 'wrap'
        }}>
        {/* White 버튼 */}
        <button 
          onClick={() => handleFrameSelect('white')}
          style={{
            border: 'none',
            cursor: 'pointer',
            backgroundColor: 'transparent',
            padding: 0,
            display: 'inline-block',
            opacity: selectedFrame !== 'white' ? 0.5 : 1
          }}
        >
          <img 
            src={whiteButton} 
            alt="White Frame" 
            style={{ 
              display: 'block',
              width: '50.2125px',
              height: 'auto',
              objectFit: 'contain',
              maxWidth: 'none',
              minWidth: '50.2125px'
            }} 
          />
        </button>
        
        {/* Black 버튼 */}
        <button 
          onClick={() => handleFrameSelect('black')}
          style={{
            border: 'none',
            cursor: 'pointer',
            backgroundColor: 'transparent',
            padding: 0,
            display: 'inline-block',
            opacity: selectedFrame !== 'black' ? 0.5 : 1
          }}
        >
          <img 
            src={blackButton} 
            alt="Black Frame" 
            style={{ 
              display: 'block',
              width: '50.2125px',
              height: 'auto',
              objectFit: 'contain',
              maxWidth: 'none',
              minWidth: '50.2125px'
            }} 
          />
        </button>
        
        {/* Red 버튼 */}
        <button 
          onClick={() => handleFrameSelect('red')}
          style={{
            border: 'none',
            cursor: 'pointer',
            backgroundColor: 'transparent',
            padding: 0,
            display: 'inline-block',
            opacity: selectedFrame !== 'red' ? 0.5 : 1
          }}
        >
          <img 
            src={redButton} 
            alt="Red Frame" 
            style={{ 
              display: 'block',
              width: '50.2125px',
              height: 'auto',
              objectFit: 'contain',
              maxWidth: 'none',
              minWidth: '50.2125px'
            }} 
          />
        </button>
        </div>

      {/* 선택된 프레임 미리보기 */}
      {selectedFrame && (
        <div style={{ 
          position: 'absolute',
          top: '305px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          display: 'inline-block',
          width: '714px',
          height: '1071px'
        }}>
        {/* 사진들을 프레임 아래에 배치 */}
        <div style={{
          position: 'absolute',
          top: '34px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '320px',
          height: '1024px',
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '0px',
          zIndex: 1
        }}>
          {photos.slice(0, 4).map((photo, index) => (
            <img 
              key={index}
              src={photo} 
              alt={`Photo ${index + 1}`}
              style={{
                width: '320px',
                height: '256px',
                objectFit: 'cover',
                borderRadius: '4px'
              }}
            />
          ))}
        </div>
          {/* 프레임 이미지 (사진 위에 배치) */}
          <img 
            src={frameImages[selectedFrame]} 
            alt={`${selectedFrame} frame`}
            style={{ 
              width: '714px',
              height: '1071px',
              objectFit: 'contain',
              position: 'relative',
              zIndex: 2,
              filter: 'drop-shadow(0 0 10px rgba(128, 128, 128, 0.8))'
            }}
          />
        </div>
      )}

      {/* Confirm 버튼 */}
      <div style={{ 
        position: 'absolute',
        top: '1400px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10
      }}>
        <button
          onClick={handleConfirm}
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
            src={printButton}
            alt="Print"
            style={{
              display: 'block',
              width: '200px',
              height: 'auto',
              objectFit: 'contain'
            }}
          />
        </button>
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
      </div>
    </div>
  );
}

