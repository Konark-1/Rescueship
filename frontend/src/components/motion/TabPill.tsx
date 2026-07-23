import React from 'react';
import { motion } from 'motion/react';
import { springSnappy } from '../../lib/motion';

interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabPillProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  layoutId?: string;
  className?: string;
}

export const TabPill: React.FC<TabPillProps> = ({
  tabs,
  activeTab,
  onChange,
  layoutId = 'active-tab-pill',
  className = '',
}) => {
  return (
    <div
      className={`tab-pill-container ${className}`}
      style={{
        display: 'inline-flex',
        background: 'rgba(15, 23, 42, 0.7)',
        padding: '4px',
        borderRadius: '12px',
        border: '1px solid rgba(99, 102, 241, 0.18)',
        gap: '4px',
        position: 'relative',
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            style={{
              position: 'relative',
              padding: '8px 16px',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: isActive ? '#ffffff' : '#94a3b8',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderRadius: '8px',
              transition: 'color 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              zIndex: 2,
            }}
          >
            {tab.icon && <span>{tab.icon}</span>}
            {tab.label}
            {isActive && (
              <motion.div
                layoutId={layoutId}
                transition={springSnappy}
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.35) 0%, rgba(168, 85, 247, 0.35) 100%)',
                  border: '1px solid rgba(99, 102, 241, 0.5)',
                  borderRadius: '8px',
                  boxShadow: '0 0 15px rgba(99, 102, 241, 0.25)',
                  zIndex: -1,
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
};
