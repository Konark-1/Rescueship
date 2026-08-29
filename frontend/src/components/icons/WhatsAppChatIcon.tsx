import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const WhatsAppChatIcon: React.FC<IconProps> = ({ size = 22, className, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    {...props}
  >
    <path d="M5 4h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-4 3v-3H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
    <path d="M8 8.5h8" />
    <path d="M8 11.5h5" />
  </svg>
);
export default WhatsAppChatIcon;
