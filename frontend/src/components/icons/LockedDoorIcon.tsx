import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const LockedDoorIcon: React.FC<IconProps> = ({ size = 22, className, ...props }) => (
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
    <rect x="6" y="3" width="12" height="18" rx="1.2" />
    <rect x="9.5" y="11" width="5" height="4.6" rx="0.8" />
    <path d="M10.5 11V9.6a1.5 1.5 0 0 1 3 0V11" />
  </svg>
);
export default LockedDoorIcon;
