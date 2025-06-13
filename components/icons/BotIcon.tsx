
import React from 'react';

const BotIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    stroke="currentColor" 
    strokeWidth="0.5" // Thinner stroke for a more refined look
    strokeLinecap="round" 
    strokeLinejoin="round" 
    {...props}
  >
    <path d="M12 2a2 2 0 00-2 2v2H8a2 2 0 00-2 2v2a2 2 0 002 2h4a2 2 0 002-2V8a2 2 0 00-2-2h-2V4a2 2 0 00-2-2zM8 14H6a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2zm8 0h-2a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2z" />
    <path d="M12 12c-3.31 0-6 2.69-6 6v2a2 2 0 002 2h8a2 2 0 002-2v-2c0-3.31-2.69-6-6-6z" />
  </svg>
);

export default BotIcon;
    