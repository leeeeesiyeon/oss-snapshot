import React, { useState, useCallback } from 'react';
import HomePage from './pages/HomePage';
import SelectModePage from './pages/SelectModePage';
import TakePicturePage from './pages/TakePicturePage';
import PrintPage from './pages/PrintPage';
import TrainAiPage from './pages/TrainAiPage'; // AI 학습 페이지 임포트
import './App.css'; // 디자인 스타일

export default function App() {
  // 페이지 관리
  const [page, setPage] = useState('home'); // 'home', 'select', 'take', 'print', 'train'
  const [mode, setMode] = useState('normal'); // 선택된 모드
  const [photos, setPhotos] = useState([]); // 촬영된 4컷

  // -------------------------------
  // 페이지 렌더링 (useCallback으로 핸들러 최적화)
  // -------------------------------

  const handleStart = useCallback(() => {
    setPage('select');
  }, []);

  const handleSelectMode = useCallback((selectedMode) => {
    setMode(selectedMode);
    setPhotos([]); // 사진 초기화
    setPage('take');
  }, []);

  const handleComplete = useCallback((capturedPhotos) => {
    if (Array.isArray(capturedPhotos)) {
      setPhotos(capturedPhotos);
      setPage('print');
    } else {
      console.error('onComplete: 배열 아님', capturedPhotos);
    }
  }, []);

  const handleRestart = useCallback(() => {
    setPhotos([]);
    setMode('normal');
    setPage('home');
  }, []);
  
  // 'train' 페이지 이동용 핸들러
  const handleGoToTrain = useCallback(() => {
    setPage('train');
  }, []);
  
  const goHome = useCallback(() => {
    setPage('home');
  }, []);


  if (page === 'home') {
    return <HomePage onStart={handleStart} onGoToTrain={handleGoToTrain} />;
  }

  if (page === 'select') {
    return (
      <SelectModePage
        onSelect={handleSelectMode}
      />
    );
  }

  if (page === 'take') {
    return (
      <TakePicturePage
        mode={mode}
        onComplete={handleComplete}
      />
    );
  }

  if (page === 'print') {
    return (
      <PrintPage
        photos={photos}
        onRestart={handleRestart}
      />
    );
  }
  
  // 'train' 페이지 렌더링
  if (page === 'train') {
    return <TrainAiPage onBackToHome={goHome} />;
  }

  return <div>⚠️ 페이지 오류</div>;
}

