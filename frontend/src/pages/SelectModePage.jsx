import React from 'react';

// 2. 모드 선택 페이지
export default function SelectModePage({ onSelect }) {
  return (
    <div className="select-mode-page">
      <h2>모드를 선택하세요</h2>
      
      <button className="btn btn-primary" onClick={() => onSelect('normal')}>
        1. 일반 모드
      </button>
      
      <button className="btn btn-danger" onClick={() => onSelect('ai')}>
        2. AI 포즈 챌린지 (개발 중)
      </button>
      
      <button className="btn btn-secondary" onClick={() => onSelect('upload')}>
        3. 사진 업로드
      </button>
    </div>
  );
}
