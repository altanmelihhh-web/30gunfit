import React from 'react';
import './Button.css';

/**
 * Paylaşılan buton primitive'i - yeni özelliklerde component'e özel .btn-save
 * benzeri class'lar icat etmek yerine bunu kullan.
 * variant: 'primary' | 'secondary' | 'danger'
 */
const Button = ({ variant = 'primary', className = '', children, ...rest }) => (
  <button className={`ui-btn ui-btn-${variant} ${className}`.trim()} {...rest}>
    {children}
  </button>
);

export default Button;
