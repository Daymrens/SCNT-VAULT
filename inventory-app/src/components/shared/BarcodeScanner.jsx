import React, { useState, useEffect, useRef } from 'react';
import { FaCamera, FaTimes, FaKeyboard } from 'react-icons/fa';

export default function BarcodeScanner({ isOpen, onClose, onScan }) {
  const [error, setError] = useState('');
  const [mode, setMode] = useState('camera');
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      cleanup();
      return;
    }

    if (mode === 'camera') {
      startCamera();
    }

    return () => cleanup();
  }, [isOpen, mode]);

  const cleanup = () => {
    if (html5QrCodeRef.current) {
      try {
        html5QrCodeRef.current.stop().catch(() => {});
        html5QrCodeRef.current.clear().catch(() => {});
      } catch (e) {}
      html5QrCodeRef.current = null;
    }
  };

  const startCamera = async () => {
    setError('');
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      cleanup();

      const scannerId = 'barcode-scanner-region';
      if (!document.getElementById(scannerId)) return;

      const html5QrCode = new Html5Qrcode(scannerId);
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          onScan(decodedText);
          cleanup();
          onClose();
        },
        () => {}
      );
    } catch (err) {
      console.error('Camera start error:', err);
      if (err.toString().includes('Permission')) {
        setError('Camera permission denied. Use keyboard-wedge mode instead.');
      } else {
        setError('Camera unavailable. Use keyboard-wedge mode instead.');
      }
      setMode('keyboard');
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 16,
        border: '1px solid var(--border)',
        width: '90%',
        maxWidth: 400,
        overflow: 'hidden',
        boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            Scan Barcode
          </span>
          <button onClick={() => { cleanup(); onClose(); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}>
            <FaTimes />
          </button>
        </div>

        <div style={{ padding: 18 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button onClick={() => setMode('camera')} style={{
              flex: 1, padding: '8px 0',
              background: mode === 'camera' ? 'var(--accent)' : 'var(--bg-secondary)',
              color: mode === 'camera' ? '#0f172a' : 'var(--text-muted)',
              border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <FaCamera /> Camera
            </button>
            <button onClick={() => { cleanup(); setMode('keyboard'); }}
              style={{
                flex: 1, padding: '8px 0',
                background: mode === 'keyboard' ? 'var(--accent)' : 'var(--bg-secondary)',
                color: mode === 'keyboard' ? '#0f172a' : 'var(--text-muted)',
                border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
              <FaKeyboard /> Keyboard
            </button>
          </div>

          {mode === 'camera' && (
            <div style={{ position: 'relative' }}>
              <div id="barcode-scanner-region" ref={scannerRef}
                style={{ width: '100%', minHeight: 250, borderRadius: 8, overflow: 'hidden', background: '#000' }} />
              {error && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(0,0,0,0.8)', borderRadius: 8, padding: 20, gap: 12,
                }}>
                  <FaCamera style={{ fontSize: 32, color: 'var(--text-muted)' }} />
                  <div style={{ fontSize: 13, color: 'var(--danger)', textAlign: 'center', fontWeight: 600 }}>
                    {error}
                  </div>
                  <button onClick={() => { setMode('keyboard'); setError(''); }}
                    style={{
                      padding: '8px 16px', background: 'var(--accent)', color: '#0f172a',
                      border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}>
                    Switch to Keyboard Mode
                  </button>
                </div>
              )}
            </div>
          )}

          {mode === 'keyboard' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <FaKeyboard style={{ fontSize: 40, color: 'var(--text-muted)', marginBottom: 12 }} />
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.6 }}>
                Connect a USB barcode scanner (HID mode) and scan directly.
                <br />The scanner will type the barcode and press Enter automatically.
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Or type the barcode manually in the search field and press Enter.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
