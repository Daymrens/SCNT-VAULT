import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FaLock, FaEnvelope } from 'react-icons/fa';
import { useToast } from '../components/shared/Toast';

const styles = {
  wrapper: {
    display: 'flex',
    minHeight: '100vh',
    width: '100%',
  },
  leftPanel: {
    flex: '1 1 50%',
    background: 'var(--bg-base)',
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
    background: 'radial-gradient(ellipse at 30% 20%, rgba(139,115,85,0.15) 0%, transparent 60%)',
    pointerEvents: 'none',
  },
  brandContent: {
    position: 'relative',
    zIndex: 1,
    textAlign: 'center',
  },
  logoContainer: {
    width: 80,
    height: 80,
    margin: '0 auto 32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 32,
    fontWeight: 800,
    color: '#e8e4dc',
    letterSpacing: 6,
    textTransform: 'uppercase',
    marginBottom: 8,
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  },
  brandSubtitle: {
    fontSize: 13,
    color: 'rgba(232,228,220,0.4)',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: 500,
  },
  brandDivider: {
    width: 48,
    height: 2,
    background: 'linear-gradient(90deg, transparent, #8b7355, transparent)',
    margin: '28px auto',
    borderRadius: 1,
  },
  brandTagline: {
    fontSize: 14,
    color: 'rgba(232,228,220,0.35)',
    lineHeight: 1.6,
    maxWidth: 260,
    margin: '0 auto',
  },
  rightPanel: {
    flex: '1 1 50%',
    background: 'var(--bg-base)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 24px',
  },
  formCard: {
    width: '100%',
    maxWidth: 380,
    background: 'var(--bg-card)',
    borderRadius: 16,
    padding: '40px 36px',
    boxShadow: '0 2px 16px rgba(0,0,0,0.3)',
    border: '1px solid var(--border)',
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 800,
    color: 'var(--text-primary)',
    marginBottom: 6,
  },
  formSubtitle: {
    fontSize: 14,
    color: 'var(--text-muted)',
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    display: 'block',
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: 8,
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: 14,
    color: 'var(--text-muted)',
    fontSize: 14,
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    padding: '12px 14px 12px 42px',
    border: '1.5px solid var(--border)',
    borderRadius: 10,
    fontSize: 14,
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    color: 'var(--text-primary)',
    background: 'var(--bg-input)',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    outline: 'none',
  },
  submitButton: {
    width: '100%',
    padding: '13px 20px',
    background: 'var(--accent)',
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
    animation: 'loginSpin 0.7s linear infinite',
  },
  error: {
    background: 'var(--danger-bg)',
    color: 'var(--danger)',
    padding: '12px 16px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 20,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    borderLeft: '4px solid var(--danger)',
  },
  footer: {
    marginTop: 32,
    textAlign: 'center',
    fontSize: 12,
    color: 'var(--text-muted)',
  },
};

const keyframes = `
  @keyframes loginSpin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @media (max-width: 768px) {
    .login-wrapper { flex-direction: column !important; }
    .login-left { display: none !important; }
    .login-right { flex: 1 1 100% !important; padding: 24px 16px !important; }
    .login-card { padding: 32px 24px !important; }
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
  const { showToast } = useToast();

  async function handleForgotPassword(e) {
    e.preventDefault();
    if (!email) {
      showToast('Enter your email first', 'error');
      return;
    }
    try {
      await resetPassword(email);
      setResetSent(true);
      showToast('Password reset email sent — check your inbox', 'success');
    } catch (err) {
      showToast('Failed to send reset email', 'error');
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
      <div style={styles.wrapper} className="login-wrapper">

        {/* Left Panel — Branding */}
        <div style={styles.leftPanel} className="login-left">
          <div style={styles.leftPanelOverlay} />
          <div style={styles.brandContent}>
            <div style={styles.logoContainer}>
              <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" width="80" height="80">
                {/* Outer ring */}
                <circle cx="40" cy="40" r="38" stroke="rgba(232,228,220,0.15)" strokeWidth="1.5" />
                <circle cx="40" cy="40" r="32" stroke="rgba(139,115,85,0.3)" strokeWidth="1" />
                {/* Bottle body */}
                <rect x="28" y="28" width="24" height="30" rx="4" fill="rgba(232,228,220,0.12)" stroke="#e8e4dc" strokeWidth="1.5" />
                {/* Bottle neck */}
                <rect x="35" y="20" width="10" height="10" rx="2" fill="rgba(232,228,220,0.08)" stroke="#e8e4dc" strokeWidth="1.5" />
                {/* Cap */}
                <rect x="33" y="16" width="14" height="6" rx="3" fill="rgba(139,115,85,0.3)" stroke="#8b7355" strokeWidth="1.5" />
                {/* Liquid level */}
                <rect x="30" y="40" width="20" height="16" rx="2" fill="rgba(139,115,85,0.2)" />
                {/* Spray line */}
                <line x1="40" y1="14" x2="40" y2="8" stroke="rgba(232,228,220,0.2)" strokeWidth="1" strokeLinecap="round" />
              </svg>
            </div>

            <div style={styles.brandName}>SCNT Vault</div>
            <div style={styles.brandSubtitle}>Inventory Management</div>

            <div style={styles.brandDivider} />

            <div style={styles.brandTagline}>
              Manage your perfumes, track stock, and handle orders — all in one place.
            </div>
          </div>
        </div>

        {/* Right Panel — Login Form */}
        <div style={styles.rightPanel} className="login-right">
          <div style={styles.formCard} className="login-card">
            <div style={styles.formTitle}>Welcome Back</div>
            <div style={styles.formSubtitle}>Sign in to your account</div>

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
                <div style={styles.inputWrapper}>
                  <FaEnvelope style={styles.inputIcon} />
                  <input
                    type="email"
                    style={styles.input}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="your@email.com"
                    autoFocus
                    onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; }}
                  />
                </div>
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Password</label>
                <div style={styles.inputWrapper}>
                  <FaLock style={styles.inputIcon} />
                  <input
                    type="password"
                    style={styles.input}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter password"
                    onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; }}
                  />
                </div>
              </div>

              <div style={{ textAlign:'right', marginTop:-12, marginBottom:20 }}>
                <button
                  onClick={handleForgotPassword}
                  style={{
                    background:'none', border:'none', cursor:'pointer',
                    fontSize:12, fontWeight:600,
                    color: resetSent ? 'var(--accent)' : 'var(--text-muted)',
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
                onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = 'var(--accent)'; }}
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
              SCNT Vault &copy; {new Date().getFullYear()}
            </div>
          </div>
        </div>

      </div>
    </>
  );
}