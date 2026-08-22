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
        onClick={handleContainerClick}
        style={{
          width: '100%',
          cursor: 'pointer',
          backgroundColor: 'transparent'
        }}
      />
      {/* 
        Native date input is pushed far off-screen. 
        It is triggered programmatically via .showPicker().
        This ensures Android Chrome never displays its own DD/MM/YYYY format over our text.
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
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'pointer'
        }}
      />
      <span 
        onClick={handleContainerClick}
        style={{ 
        position: 'absolute', 
        right: '12px', 
        zIndex: 1, 
        cursor: 'pointer',
        color: '#8d97a5',
        fontSize: '1rem'
      }}>
        📅
      </span>
    </div>
  );
};

export default ControlledDateInput;
