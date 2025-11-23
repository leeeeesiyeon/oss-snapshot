import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import photoUploadBox from '../assets/images/photo_upload_box.svg';
import selectPhotoBox from '../assets/images/select_photo_box.svg';
import startButton from '../assets/images/start_button.svg';
import Toast from '../components/Toast';

// 고정 캔버스 크기 (background 이미지 크기에 맞춤)
const CANVAS_WIDTH = 1440;
const CANVAS_HEIGHT = 1080;

// 사진 업로드 모드 페이지
export default function SelectPictureModePage() {
  const navigate = useNavigate();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const draggedIndexRef = useRef(null);
  const [toast, setToast] = useState(null);

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    
    // 실제 사진 개수만 체크 (undefined 제외)
    const currentPhotoCount = selectedFiles.filter(photo => photo !== undefined).length;
    
    if (currentPhotoCount + files.length > 4) {
      setToast({ message: 'You can only select up to 4 photos total', type: 'warning' });
      event.target.value = ''; // Reset input
      return;
    }

    const newFileUrls = files.map(file => URL.createObjectURL(file));
    
    // 빈 슬롯(undefined)을 찾아서 채우거나, 배열 끝에 추가
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      let urlIndex = 0;
      
      // 먼저 빈 슬롯을 채움
      for (let i = 0; i < newFiles.length && urlIndex < newFileUrls.length; i++) {
        if (newFiles[i] === undefined) {
          newFiles[i] = newFileUrls[urlIndex];
          urlIndex++;
        }
      }
      
      // 남은 사진들을 배열 끝에 추가
      while (urlIndex < newFileUrls.length) {
        newFiles.push(newFileUrls[urlIndex]);
        urlIndex++;
      }
      
      return newFiles;
    });
    
    // Reset input to allow selecting the same file again
    event.target.value = '';
  };

  const handleDeleteFile = (index) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      if (newFiles[index]) {
        URL.revokeObjectURL(newFiles[index]); // 메모리 정리
        newFiles[index] = undefined; // 삭제 대신 undefined로 설정하여 순서 유지
      }
      return newFiles;
    });
  };

  const handleConfirm = () => {
    // 박스 순서대로 사진이 있는 것만 필터링 (undefined 제거)
    const photosInOrder = selectedFiles.filter(photo => photo !== undefined);
    if (photosInOrder.length === 4) {
      // 드래그로 변경된 순서대로 photos 배열을 전달 (1, 2, 3, 4번 박스 순서)
      navigate('/select-frame', { state: { photos: photosInOrder } });
    } else {
      setToast({ message: 'Please select 4 photos before proceeding.', type: 'warning' });
    }
  };

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Enter: 확인
      if (e.key === 'Enter') {
        const photosInOrder = selectedFiles.filter(photo => photo !== undefined);
        if (photosInOrder.length === 4) {
          handleConfirm();
        }
      }
      // ESC: 뒤로가기
      if (e.key === 'Escape') {
        navigate('/select-mode');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFiles, navigate]);

  const handleDragStart = (e, index) => {
    e.stopPropagation();
    setDraggedIndex(index);
    draggedIndexRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.setData('application/json', JSON.stringify({ index }));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    e.stopPropagation();
    
    // dataTransfer에서 가져오거나 ref에서 가져오기
    let dragIndex = draggedIndexRef.current;
    
    // dataTransfer에서도 시도
    try {
      const dragIndexStr = e.dataTransfer.getData('text/plain');
      if (dragIndexStr) {
        dragIndex = parseInt(dragIndexStr, 10);
      }
    } catch (err) {
      // dataTransfer가 작동하지 않는 경우 ref 사용
    }
    
    if (dragIndex === null || dragIndex === undefined || isNaN(dragIndex) || dragIndex === dropIndex) {
      setDraggedIndex(null);
      draggedIndexRef.current = null;
      return;
    }

    setSelectedFiles(prev => {
      // 배열을 4개 슬롯으로 확장 (빈 슬롯은 undefined)
      const newFiles = [...prev];
      while (newFiles.length < 4) {
        newFiles.push(undefined);
      }
      
      const draggedItem = newFiles[dragIndex];
      
      if (!draggedItem) {
        setDraggedIndex(null);
        draggedIndexRef.current = null;
        return prev;
      }
      
      // 드롭 위치에 사진이 있는 경우: 두 사진의 위치를 바꿈
      if (newFiles[dropIndex]) {
        const temp = newFiles[dropIndex];
        newFiles[dropIndex] = draggedItem;
        newFiles[dragIndex] = temp;
      } else {
        // 빈 박스에 드롭하는 경우: 원래 위치를 비우고 새 위치에 사진을 넣음
        newFiles[dragIndex] = undefined;
        newFiles[dropIndex] = draggedItem;
      }
      
      // undefined를 제거하지 않고 그대로 유지 (빈 박스 표시를 위해)
      return newFiles;
    });
    
    setDraggedIndex(null);
    draggedIndexRef.current = null;
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    draggedIndexRef.current = null;
  };

  return (
    <div 
      className="take-picture-page page-fade" 
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
            backgroundImage: 'url(/selectpicture_background.svg)',
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center'
          }}
        >
        {/* Upload Box */}
        <div
          style={{
            position: 'absolute',
            top: '237.6px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            width: '722.4px',
            height: 'auto'
          }}
        >
          <img
            src={photoUploadBox}
            alt="Photo Upload Box"
            style={{
              display: 'block',
              width: '100%',
              height: 'auto'
            }}
          />
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileUpload}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              cursor: 'pointer',
              zIndex: 11
            }}
          />
          {selectedFiles.filter(photo => photo !== undefined).length > 0 && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 12,
              width: '90%',
              maxHeight: '70%',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: '3px',
              justifyContent: 'center'
            }}>
              {selectedFiles.map((fileUrl, boxIndex) => {
                if (fileUrl === undefined) return null;
                const boxNumber = boxIndex + 1;
                return (
                  <div
                    key={`${boxIndex}-${fileUrl}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '3px 4px',
                      backgroundColor: '#D9D9D9',
                      borderRadius: '1px',
                      fontSize: '0.39rem',
                      width: 'calc(50% - 1.5px)',
                      minWidth: '86px'
                    }}
                  >
                    <span style={{ flex: 1, color: '#1a1a1a' }}>Photo {boxNumber}</span>
                    <button
                      onClick={() => handleDeleteFile(boxIndex)}
                      style={{
                        padding: '1px 4px',
                        fontSize: '0.34rem',
                        cursor: 'pointer',
                        backgroundColor: '#A8A8A8',
                        color: '#f5f5f5',
                        border: 'none',
                        borderRadius: '1px',
                        fontWeight: 'bold'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

          {/* Grid (4 photo boxes) - 절대 위치 */}
          <div
            style={{
              position: 'absolute',
              top: '480px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 207.6px)',
              gridTemplateRows: 'repeat(2, 157.2px)',
              gap: '40px',
              justifyContent: 'center',
              zIndex: 11
            }}
          >
          {[0, 1, 2, 3].map((index) => {
            const hasPhoto = selectedFiles[index];
            return (
              <div
                key={index}
                style={{
                  position: 'relative',
                  width: '249.12px',
                  height: '188.64px',
                  cursor: 'default'
                }}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                draggable={false}
              >
                <img
                  src={selectPhotoBox}
                  alt={`Select Photo Box ${index + 1}`}
                  draggable={false}
                  style={{
                    width: '100%',
                    height: 'auto',
                    objectFit: 'contain',
                    display: 'block',
                    pointerEvents: 'none'
                  }}
                />
                {hasPhoto && (
                  <div
                    draggable={true}
                    onDragStart={(e) => {
                      e.stopPropagation();
                      handleDragStart(e, index);
                    }}
                    onDragEnd={(e) => {
                      e.stopPropagation();
                      handleDragEnd();
                    }}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '235.92px',
                      height: '176.94px',
                      cursor: 'grab',
                      zIndex: 12,
                      opacity: draggedIndex === index ? 0.5 : 1,
                      pointerEvents: 'auto',
                      userSelect: 'none'
                    }}
                  >
                    <img
                      src={hasPhoto}
                      alt={`Photo ${index + 1}`}
                      draggable={false}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        borderRadius: '1px',
                        pointerEvents: 'none'
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
          </div>

          {/* Start Button - 절대 위치 */}
          <button
            onClick={handleConfirm}
            style={{
              position: 'absolute',
              top: '1008px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '144.48px',
              height: 'auto',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              transition: 'transform 0.1s, filter 0.1s',
              opacity: 1,
              zIndex: 11
            }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateX(-50%) scale(1.05)';
            e.currentTarget.style.filter = 'grayscale(100%)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateX(-50%) scale(1)';
            e.currentTarget.style.filter = 'grayscale(0%)';
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'translateX(-50%) scale(0.95)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'translateX(-50%) scale(1.05)';
          }}
        >
          <img
            src={startButton}
            alt="Start Button"
            style={{
              display: 'block',
              width: '144.48px',
              height: 'auto',
              objectFit: 'contain'
            }}
          />
          </button>
        </div>
      </div>

      {/* 토스트 알림 */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

