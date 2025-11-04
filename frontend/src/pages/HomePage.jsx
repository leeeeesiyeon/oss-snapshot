import React from 'react';

// 1. 시작 페이지 (수정됨)
// 'onGoToTrain' prop을 받도록 수정
export default function HomePage({ onStart, onGoToTrain }) { 
  return (
    <div className="home-page" style={{ textAlign: 'center', paddingTop: '100px' }}>
      <h1>SNAPSHOT</h1>
      <p style={{ marginBottom: '50px', fontSize: '1.2rem' }}>AI 포즈 챌린지 네컷사진</p>
      <button 
        className="btn btn-primary" 
        onClick={onStart}
        style={{ padding: '20px 40px', fontSize: '2rem', cursor: 'pointer' }}
      >
        ENTER
      </button>

      {/* AI 학습 페이지로 가는 버튼 */}
      <button 
        onClick={onGoToTrain} 
        style={{ 
          display: 'block',
          margin: '50px auto 0 auto', 
          background: 'none', 
          border: '1px solid #555', 
          color: '#888',
          padding: '5px 10px',
          fontSize: '0.8rem',
          cursor: 'pointer'
        }}>
        (관리자) AI 포즈 학습시키기
      </button>
   </div>
  );
}

