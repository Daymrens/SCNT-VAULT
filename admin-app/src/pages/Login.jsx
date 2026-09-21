import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const styles = {
  wrapper: {
    display: 'flex',
    minHeight: '100vh',
    width: '100%',
    background: '#0f172a',
  },
  leftPanel: {
    flex: '1 1 50%',
    background: '#0f172a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 40px',
    position: 'relative',
    overflow: 'hidden',
  },
  leftPanelOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(ellipse at 30% 20%, rgba(45,212,191,0.08) 0%, transparent 60%)',
    pointerEvents: 'none',
  },
  brandContent: {
    position: 'relative',
    zIndex: 1,
    textAlign: 'center',
  },
  brandName: {
    fontSize: 32,
    fontWeight: 800,
    color: '#f1f5f9',
    letterSpacing: 6,
    textTransform: 'uppercase',
    marginBottom: 8,
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  },
  brandSubtitle: {
    fontSize: 13,
    color: 'rgba(148,163,184,0.7)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: 500,
  },
  brandDivider: {
    width: 48,
    height: 2,
    background: 'linear-gradient(90deg, transparent, #2dd4bf, transparent)',
    margin: '28px auto',
    borderRadius: 1,
  },
  brandTagline: {
    fontSize: 14,
    color: 'rgba(148,163,184,0.5)',
    lineHeight: 1.6,
    maxWidth: 260,
    margin: '0 auto',
  },
  rightPanel: {
    flex: '1 1 50%',
    background: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 24px',
  },
  formCard: {
    width: '100%',
    maxWidth: 380,
    background: '#1e293b',
    borderRadius: 16,
    padding: '40px 36px',
    boxShadow: '0 2px 16px rgba(0,0,0,0.3)',
    border: '1px solid #334155',
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 800,
    color: '#f1f5f9',
    marginBottom: 6,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    display: 'block',
    fontSize: 12,
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    border: '1.5px solid #334155',
    borderRadius: 10,
    fontSize: 14,
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    color: '#f1f5f9',
    background: '#0f172a',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    outline: 'none',
  },
  submitButton: {
    width: '100%',
    padding: '13px 20px',
    background: '#2dd4bf',
    color: '#0f172a',
    border: 'none',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    cursor: 'pointer',
    transition: 'background 0.2s, transform 0.1s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  spinner: {
    width: 18,
    height: 18,
    border: '2px solid rgba(15,23,42,0.3)',
    borderTop: '2px solid #0f172a',
    borderRadius: '50%',
    animation: 'adminSpin 0.7s linear infinite',
  },
  error: {
    background: 'rgba(239,68,68,0.1)',
    color: '#ef4444',
    padding: '12px 16px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 20,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    borderLeft: '4px solid #ef4444',
  },
  footer: {
    marginTop: 32,
    textAlign: 'center',
    fontSize: 12,
    color: '#94a3b8',
  },
};

const keyframes = `
  @keyframes adminSpin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @media (max-width: 768px) {
    .admin-login-wrapper { flex-direction: column !important; }
    .admin-login-left { display: none !important; }
    .admin-login-right { flex: 1 1 100% !important; padding: 24px 16px !important; }
    .admin-login-card { padding: 32px 24px !important; }
  }
`;

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { signIn, resetPassword } = useAuth();
  const navigate = useNavigate();

  async function handleForgotPassword(e) {
    e.preventDefault();
    if (!email) {
      setError('Enter your email first');
      return;
    }
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch (err) {
      setError('Failed to send reset email');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      await signIn(email, password);
      navigate('/');
    } catch (err) {
      setError('Failed to sign in. Check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{keyframes}</style>
      <div style={styles.wrapper} className="admin-login-wrapper">
        <div style={styles.leftPanel} className="admin-login-left">
          <div style={styles.leftPanelOverlay} />
          <div style={styles.brandContent}>
            <div style={styles.brandName}>SCNT Vault</div>
            <div style={styles.brandSubtitle}>Admin Panel</div>
            <div style={styles.brandDivider} />
            <div style={styles.brandTagline}>
              Manage your business — products, orders, customers, and settings.
            </div>
          </div>
        </div>

        <div style={styles.rightPanel} className="admin-login-right">
          <div style={styles.formCard} className="admin-login-card">
            <div style={styles.formTitle}>Welcome Back</div>
            <div style={styles.formSubtitle}>Sign in to admin panel</div>

            {error && (
              <div style={styles.error}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Email</label>
                <input
                  type="email"
                  style={styles.input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="your@email.com"
                  autoFocus
                  onFocus={(e) => { e.target.style.borderColor = '#2dd4bf'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#334155'; }}
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Password</label>
                <input
                  type="password"
                  style={styles.input}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter password"
                  onFocus={(e) => { e.target.style.borderColor = '#2dd4bf'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#334155'; }}
                />
              </div>

              <div style={{ textAlign: 'right', marginTop: -12, marginBottom: 20 }}>
                <button
                  onClick={handleForgotPassword}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    color: resetSent ? '#2dd4bf' : '#94a3b8',
                  }}
                  disabled={resetSent}
                >
                  {resetSent ? 'Reset email sent ✓' : 'Forgot Password?'}
                </button>
              </div>

              <button
                type="submit"
                style={{
                  ...styles.submitButton,
                  ...(loading ? styles.submitButtonDisabled : {}),
                }}
                disabled={loading}
                onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#14b8a6'; }}
                onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = '#2dd4bf'; }}
              >
                {loading ? (
                  <>
                    <div style={styles.spinner} />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <div style={styles.footer}>
              SCNT Vault Admin &copy; {new Date().getFullYear()}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
