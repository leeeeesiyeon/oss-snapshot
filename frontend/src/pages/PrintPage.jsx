import React, { useRef } from 'react';
import html2canvas from 'html2canvas';

// 📸 네컷 출력/저장 페이지
export default function PrintPage({ photos, onRestart }) {
  const frameRef = useRef(null);

  const handleSave = () => {
    if (!frameRef.current) return;

    html2canvas(frameRef.current, {
      useCORS: true,
      backgroundColor: '#1a1a1a',
    }).then((canvas) => {
      const imageSrc = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = imageSrc;
      link.download = 'fourcut_snapshot.png';
      link.click();
    });
  };

  if (!photos || photos.length === 0) {
    return (
      <div className="print-page">
        <h2>⚠️ 사진이 없습니다.</h2>
        <button className="btn btn-danger" onClick={onRestart}>
          🏠 처음으로
        </button>
      </div>
    );
  }

  return (
    <div className="print-page">
      <h2>📸 네컷 완성!</h2>

      {/* 프레임 전체 캡처 대상 */}
      <div ref={frameRef} className="photobooth-frame">
        <div className="photobooth-strip">
          {photos.map((photoSrc, index) => (
            <img key={index} src={photoSrc} alt={`Photo ${index + 1}`} />
          ))}
        </div>
      </div>

      <div className="button-group">
        <button className="btn btn-secondary" onClick={handleSave}>
          💾 이미지 저장
        </button>
        <button className="btn btn-danger" onClick={onRestart}>
          🏠 처음으로
        </button>
      </div>
    </div>
  );
}
