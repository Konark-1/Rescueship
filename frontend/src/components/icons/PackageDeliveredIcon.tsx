import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const PackageDeliveredIcon: React.FC<IconProps> = ({ size = 22, className, ...props }) => (
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
    <rect x="4" y="9.5" width="16" height="10.5" rx="1.2" />
    <path d="M4 9.5 6 5h12l2 4.5" />
    <path d="M9 14.5l2 2 4-4" />
  </svg>
);
export default PackageDeliveredIcon;
