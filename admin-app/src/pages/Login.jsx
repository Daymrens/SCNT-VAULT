import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const styles = {
  wrapper: {
    display: 'flex',
    minHeight: '100vh',
    width: '100%',
    background: '#f6f7f9',
  },
  leftPanel: {
    flex: '1 1 50%',
    background: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 40px',
    position: 'relative',
    overflow: 'hidden',
    borderRight: '1px solid #e6e8ec',
  },
  leftPanelOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(ellipse at 30% 20%, rgba(13,148,136,0.07) 0%, transparent 60%)',
    pointerEvents: 'none',
  },
  brandContent: {
    position: 'relative',
    zIndex: 1,
    textAlign: 'center',
  },
  brandMark: {
    width: 56,
    height: 56,
    borderRadius: 14,
    background: '#0d9488',
    display: 'grid',
    placeItems: 'center',
    color: '#fff',
    fontWeight: 800,
    fontSize: 20,
    letterSpacing: 1,
    margin: '0 auto 20px',
  },
  brandName: {
    fontSize: 30,
    fontWeight: 800,
    color: '#14181f',
    letterSpacing: 5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  brandSubtitle: {
    fontSize: 12,
    color: '#9aa3af',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: 600,
  },
  brandDivider: {
    width: 48,
    height: 2,
    background: '#e6e8ec',
    margin: '26px auto',
    borderRadius: 1,
  },
  brandTagline: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 1.6,
    maxWidth: 280,
    margin: '0 auto',
  },
  rightPanel: {
    flex: '1 1 50%',
    background: '#f6f7f9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 24px',
  },
  formCard: {
    width: '100%',
    maxWidth: 380,
    background: '#ffffff',
    borderRadius: 14,
    padding: '36px 32px',
    boxShadow: '0 1px 2px rgba(16,24,40,0.05)',
    border: '1px solid #e6e8ec',
  },
  formTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: '#14181f',
    marginBottom: 4,
    letterSpacing: '-.3px',
  },
  formSubtitle: {
    fontSize: 13.5,
    color: '#6b7280',
    marginBottom: 28,
  },
  inputGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    display: 'block',
    fontSize: 11.5,
    fontWeight: 700,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: 7,
  },
  input: {
    width: '100%',
    padding: '11px 13px',
    border: '1.5px solid #e6e8ec',
    borderRadius: 9,
    fontSize: 14,
    fontFamily: 'inherit',
    color: '#14181f',
    background: '#ffffff',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    outline: 'none',
  },
  submitButton: {
    width: '100%',
    padding: '12px 20px',
    background: '#0d9488',
    color: '#ffffff',
    border: 'none',
    borderRadius: 9,
    fontSize: 14,
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
    transition: 'background 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  submitButtonDisabled: {
    opacity: 0.65,
    cursor: 'not-allowed',
  },
  spinner: {
    width: 16,
    height: 16,
    border: '2px solid rgba(255,255,255,0.35)',
    borderTop: '2px solid #ffffff',
    borderRadius: '50%',
    animation: 'adminSpin 0.7s linear infinite',
  },
  error: {
    background: '#fdf2f2',
    color: '#dc2626',
    padding: '11px 14px',
    borderRadius: 9,
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 18,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    border: '1px solid #f5d5d5',
  },
  footer: {
    marginTop: 28,
    textAlign: 'center',
    fontSize: 11.5,
    color: '#9aa3af',
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
    .admin-login-card { padding: 28px 22px !important; }
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
            <div style={styles.brandMark}>SC</div>
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
            <div style={styles.formTitle}>Welcome back</div>
            <div style={styles.formSubtitle}>Sign in to the admin panel</div>

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
                  onFocus={(e) => { e.target.style.borderColor = '#0d9488'; e.target.style.boxShadow = '0 0 0 3px rgba(13,148,136,0.12)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#e6e8ec'; e.target.style.boxShadow = 'none'; }}
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
                  onFocus={(e) => { e.target.style.borderColor = '#0d9488'; e.target.style.boxShadow = '0 0 0 3px rgba(13,148,136,0.12)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#e6e8ec'; e.target.style.boxShadow = 'none'; }}
                />
              </div>

              <div style={{ textAlign: 'right', marginTop: -10, marginBottom: 18 }}>
                <button
                  onClick={handleForgotPassword}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    color: resetSent ? '#0f766e' : '#6b7280',
                  }}
                  disabled={resetSent}
                >
                  {resetSent ? 'Reset email sent ✓' : 'Forgot password?'}
                </button>
              </div>

              <button
                type="submit"
                style={{
                  ...styles.submitButton,
                  ...(loading ? styles.submitButtonDisabled : {}),
                }}
                disabled={loading}
                onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#0f766e'; }}
                onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = '#0d9488'; }}
              >
                {loading ? (
                  <>
                    <div style={styles.spinner} />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
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
