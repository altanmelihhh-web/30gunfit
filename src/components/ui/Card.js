import React from 'react';
import './Card.css';

/**
 * Paylaşılan kart primitive'i - yeni özelliklerde her component'in kendi
 * .xyz-card CSS'ini yazması yerine bunu kullan.
 */
const Card = ({ className = '', children, ...rest }) => (
  <div className={`ui-card ${className}`.trim()} {...rest}>
    {children}
  </div>
);

export default Card;
