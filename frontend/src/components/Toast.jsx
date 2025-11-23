import React, { useEffect } from 'react';

export default function Toast({ message, type = 'info', onClose, duration = 3000 }) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const bgColor = {
    success: '#4CAF50',
    error: '#bd1414',
    info: '#0066cc',
    warning: '#FF9800'
  }[type] || '#0066cc';

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: bgColor,
        color: '#ffffff',
        padding: '12px 24px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        zIndex: 10000,
        fontSize: '14px',
        fontWeight: '500',
        fontFamily: 'Pretendard, sans-serif',
        animation: 'toastSlideIn 0.3s ease-out',
        maxWidth: '90%',
        textAlign: 'center'
      }}
    >
      {message}
    </div>
  );
}

