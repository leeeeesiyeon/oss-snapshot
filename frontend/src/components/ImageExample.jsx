import React from 'react';

// 방법 1: 이미지를 import로 가져오기 (권장)
import backgroundImage from '../assets/images/background.png';
import buttonImage from '../assets/images/button.png';
import photoFrameImage from '../assets/images/photo-frame.png';

// 방법 2: public 폴더의 이미지 사용 (절대 경로)
// public 폴더의 이미지는 /로 시작하는 경로로 접근
// 예: <img src="/images/background.png" />

export default function ImageExample() {
  return (
    <div>
      {/* ============================================
          방법 1: 배경 이미지 적용 (CSS background-image)
          ============================================ */}
      
      {/* 방법 1-1: 인라인 스타일 사용 */}
      <div 
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: 'cover',        // 이미지를 컨테이너에 맞춤
          backgroundPosition: 'center',   // 이미지 위치 중앙
          backgroundRepeat: 'no-repeat',  // 반복 없음
          width: '100%',
          height: '400px'
        }}
      >
        배경 이미지가 적용된 영역
      </div>

      {/* 방법 1-2: CSS 클래스 사용 (App.css에 정의) */}
      <div className="background-image-container">
        배경 이미지가 적용된 영역 (CSS 클래스)
      </div>

      {/* 방법 1-3: Tailwind CSS 사용 */}
      <div 
        className="w-full h-96 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      >
        Tailwind CSS로 배경 이미지 적용
      </div>

      {/* ============================================
          방법 2: 버튼에 이미지 적용
          ============================================ */}
      
      {/* 방법 2-1: img 태그로 버튼 배경처럼 사용 */}
      <button 
        style={{
          position: 'relative',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          padding: 0
        }}
      >
        <img 
          src={buttonImage} 
          alt="버튼 배경" 
          style={{ 
            width: '200px',
            height: '60px',
            objectFit: 'contain'
          }}
        />
        <span 
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: 'white',
            fontWeight: 'bold'
          }}
        >
          클릭하세요
        </span>
      </button>

      {/* 방법 2-2: CSS background-image로 버튼 스타일링 */}
      <button
        className="custom-button"
        style={{
          backgroundImage: `url(${buttonImage})`,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          width: '200px',
          height: '60px',
          border: 'none',
          cursor: 'pointer',
          color: 'white',
          fontWeight: 'bold'
        }}
      >
        버튼 텍스트
      </button>

      {/* ============================================
          방법 3: 사진 박스/프레임에 이미지 적용
          ============================================ */}
      
      {/* 방법 3-1: 프레임 이미지와 사진을 겹쳐서 표시 */}
      <div style={{ position: 'relative', display: 'inline-block' }}>
        {/* 프레임 이미지 */}
        <img 
          src={photoFrameImage} 
          alt="사진 프레임" 
          style={{ 
            width: '300px',
            height: '300px',
            objectFit: 'contain'
          }}
        />
        {/* 실제 사진 (프레임 안에 배치) */}
        <img 
          src="https://via.placeholder.com/250" 
          alt="사진" 
          style={{ 
            position: 'absolute',
            top: '25px',
            left: '25px',
            width: '250px',
            height: '250px',
            objectFit: 'cover',
            zIndex: -1
          }}
        />
      </div>

      {/* 방법 3-2: CSS로 프레임과 사진을 레이어링 */}
      <div className="photo-frame-container">
        <img 
          src="https://via.placeholder.com/250" 
          alt="사진" 
          className="photo-frame-content"
        />
      </div>

      {/* 방법 3-3: 간단한 박스에 이미지 배경 */}
      <div
        style={{
          width: '300px',
          height: '300px',
          backgroundImage: `url(${photoFrameImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          border: '2px solid #ccc',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white'
        }}
      >
        사진을 여기에 표시
      </div>
    </div>
  );
}

