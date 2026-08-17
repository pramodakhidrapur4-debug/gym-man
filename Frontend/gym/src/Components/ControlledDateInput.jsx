import React, { useRef } from 'react';

const ControlledDateInput = ({ value, onChange, required, name, className }) => {
  const dateInputRef = useRef(null);

  // The internal value is always YYYY-MM-DD (or empty).
  // We want to display it visually as DD-MM-YYYY.
  const displayValue = value ? value.split('-').reverse().join('-') : '';

  const handleContainerClick = () => {
    if (dateInputRef.current) {
      if (typeof dateInputRef.current.showPicker === 'function') {
        try {
          dateInputRef.current.showPicker();
        } catch (e) {
          dateInputRef.current.focus();
          dateInputRef.current.click();
        }
      } else {
        dateInputRef.current.focus();
        dateInputRef.current.click();
      }
    }
  };

  return (
    <div 
      className={`controlled-date-wrapper ${className || ''}`} 
      onClick={handleContainerClick}
      style={{ 
        position: 'relative', 
        display: 'flex', 
        alignItems: 'center', 
        cursor: 'pointer',
        width: '100%' 
      }}
    >
      <input
        type="text"
        value={displayValue}
        readOnly
        placeholder="DD-MM-YYYY"
        required={required}
        style={{
          width: '100%',
          cursor: 'pointer',
          // Prevent the text input from blocking clicks if someone manages to click it
          pointerEvents: 'none'
        }}
      />
      {/* 
        Native date input is positioned absolutely over the text input and made invisible. 
        This captures clicks natively to open the date picker reliably across all mobile/desktop browsers 
        without changing the visible format. 
      */}
      <input
        type="date"
        name={name}
        ref={dateInputRef}
        value={value || ''}
        onChange={onChange}
        required={required}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'pointer',
          zIndex: 2,
          padding: 0,
          margin: 0,
          boxSizing: 'border-box'
        }}
      />
      <span style={{ 
        position: 'absolute', 
        right: '12px', 
        zIndex: 1, 
        pointerEvents: 'none',
        color: '#8d97a5',
        fontSize: '1rem'
      }}>
        📅
      </span>
    </div>
  );
};

export default ControlledDateInput;
