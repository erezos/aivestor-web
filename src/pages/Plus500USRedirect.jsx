import { useEffect } from 'react';

const PLUS500_US_URL = 'https://us.plus500.com/en/multisitelandingpage?id=138803&tags=first-link-futures&pl=2';

export default function Plus500USRedirect() {
  useEffect(() => {
    window.location.replace(PLUS500_US_URL);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '12px',
      color: 'white',
      fontFamily: 'sans-serif',
    }}>
      <div style={{
        width: 36,
        height: 36,
        border: '2px solid rgba(139,92,246,0.2)',
        borderTop: '2px solid #8b5cf6',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <span style={{ fontSize: 14, opacity: 0.4 }}>Redirecting to Plus500...</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}