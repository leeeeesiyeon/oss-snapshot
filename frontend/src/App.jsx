import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './styles/App.css';

// 페이지 컴포넌트 임포트
import HomePage from './pages/HomePage';
import SelectModePage from './pages/SelectModePage';
import NormalModePage from './pages/NormalModePage';
import AiModePage from './pages/AiModePage';
import SelectPictureModePage from './pages/SelectPictureModePage';
import SelectFramePage from './pages/SelectFramePage';
import PrintPage from './pages/PrintPage';
import TrainAiPage from './pages/TrainAiPage';

export default function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          {/* 각 페이지에 대한 라우트 정의 */}
          <Route path="/" element={<HomePage />} />
          <Route path="/select-mode" element={<SelectModePage />} />
          <Route path="/normal-mode" element={<NormalModePage />} />
          <Route path="/ai-mode" element={<AiModePage />} />
          <Route path="/select-picture" element={<SelectPictureModePage />} />
          <Route path="/select-frame" element={<SelectFramePage />} />
          <Route path="/print" element={<PrintPage />} />
          <Route path="/train" element={<TrainAiPage />} />
        </Routes>
      </div>
    </Router>
  );
}
