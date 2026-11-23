import React from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';

export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '143490522495-d9iev2jh0fkbgb65cfi1vi72rgc1dgdn.apps.googleusercontent.com';

export const GoogleOAuthBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (!GOOGLE_CLIENT_ID) {
    return <>{children}</>;
  }
  return <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{children}</GoogleOAuthProvider>;
};

export default GoogleOAuthBoundary;
