import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { base44 } from '@/api/base44Client';

const STATUS = {
  SCANNING: 'scanning',
  SUCCESS: 'success',
  ALREADY: 'already',
  ERROR: 'error',
};

export default function KioskCheckin() {
  const [status, setStatus] = useState(STATUS.SCANNING);
  const [staffName, setStaffName] = useState('');
  const [message, setMessage] = useState('');
  const [schoolName, setSchoolName] = useState('BVM School');
  const scannerRef = useRef(null);
  const processingRef = useRef(false);
  const resetTimerRef = useRef(null);

  useEffect(() => {
    base44.entities.SchoolProfile.list().then(p => {
      if (p?.[0]?.school_name) setSchoolName(p[0].school_name);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const qr = new Html5Qrcode('qr-reader');
    scannerRef.current = qr;

    qr.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 280, height: 280 } },
      (decodedText) => {
        if (processingRef.current) return;
        processingRef.current = true;
        handleScan(decodedText);
      },
      () => {}
    ).catch(() => {
      setStatus(STATUS.ERROR);
      setMessage('Camera access denied. Please allow camera permission.');
    });

    return () => {
      qr.stop().catch(() => {});
    };
  }, []);

  const handleScan = async (staffCode) => {
    try {
      const res = await base44.functions.invoke('kioskCheckin', { staff_code: staffCode.trim() });
      const data = res.data;
      setStaffName(data.staff_name || '');
      if (data.status === 'success') {
        setStatus(STATUS.SUCCESS);
      } else if (data.status === 'already_checked_in') {
        setStatus(STATUS.ALREADY);
      } else {
        setStatus(STATUS.ERROR);
        setMessage(data.message || 'Staff not found. Please contact admin.');
      }
    } catch (err) {
      setStatus(STATUS.ERROR);
      setMessage('Staff not found. Please contact admin.');
    }

    resetTimerRef.current = setTimeout(() => {
      setStatus(STATUS.SCANNING);
      setStaffName('');
      setMessage('');
      processingRef.current = false;
    }, 4000);
  };

  useEffect(() => {
    return () => clearTimeout(resetTimerRef.current);
  }, []);

  const [showExitModal, setShowExitModal] = useState(false);
  const [exitPassword, setExitPassword] = useState('');
  const [exitError, setExitError] = useState('');
  const navigate = useNavigate();

  const handleExitAttempt = () => {
    if (exitPassword === '9265') {
      navigate('/Dashboard');
    } else {
      setExitError('Incorrect password. Try again.');
      setExitPassword('');
    }
  };

  const overlayVisible = status !== STATUS.SCANNING;

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-900 overflow-hidden">
      {/* Header */}
      <div className="bg-[#1a237e] text-white py-4 px-4 flex-shrink-0 flex items-center justify-between">
        <button
          onClick={() => setShowExitModal(true)}
          className="text-white/50 hover:text-white text-xs border border-white/20 rounded-lg px-2 py-1"
        >
          🔒 Exit
        </button>
        <div className="text-center flex-1">
          <h1 className="text-xl font-bold">{schoolName}</h1>
          <p className="text-sm text-white/70 mt-0.5">Staff Attendance Kiosk</p>
        </div>
        <div className="w-16" />
      </div>

      {/* Scanner Area */}
      <div className="flex-1 flex flex-col items-center justify-center relative">
        <div id="qr-reader" className="w-full max-w-sm" style={{ opacity: overlayVisible ? 0 : 1 }} />

        {status === STATUS.SCANNING && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="border-4 border-white/60 rounded-2xl w-72 h-72" />
            <p className="text-white text-lg font-semibold mt-6">Hold ID card in front of camera</p>
            <p className="text-white/60 text-sm mt-2">Scanner is active and ready</p>
          </div>
        )}

        {/* Feedback Overlay */}
        {overlayVisible && (
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center px-8 text-white transition-all
              ${status === STATUS.SUCCESS ? 'bg-green-600' : ''}
              ${status === STATUS.ALREADY ? 'bg-blue-600' : ''}
              ${status === STATUS.ERROR ? 'bg-red-600' : ''}
            `}
          >
            {status === STATUS.SUCCESS && (
              <>
                <div className="text-8xl mb-4">✅</div>
                <h2 className="text-3xl font-bold text-center">Welcome!</h2>
                <p className="text-2xl font-semibold mt-2 text-center">{staffName}</p>
                <p className="text-lg mt-4 text-white/90 text-center">You are now checked in.</p>
                <p className="text-base mt-1 text-white/70 text-center">Have a great day! 😊</p>
              </>
            )}
            {status === STATUS.ALREADY && (
              <>
                <div className="text-8xl mb-4">👋</div>
                <h2 className="text-3xl font-bold text-center">Hello!</h2>
                <p className="text-2xl font-semibold mt-2 text-center">{staffName}</p>
                <p className="text-lg mt-4 text-white/90 text-center">You are already checked in today.</p>
              </>
            )}
            {status === STATUS.ERROR && (
              <>
                <div className="text-8xl mb-4">❌</div>
                <h2 className="text-3xl font-bold text-center">Not Recognized</h2>
                <p className="text-lg mt-4 text-white/90 text-center">{message}</p>
              </>
            )}
            <p className="text-sm text-white/60 mt-8">Returning to scanner in a moment...</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-800 text-center py-3 flex-shrink-0 flex items-center justify-between px-4">
        <p className="text-gray-400 text-sm">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <span className="text-green-400 text-xs font-semibold bg-green-900/40 px-2 py-1 rounded-full">🟢 Kiosk Active</span>
      </div>

      {/* Prevent accidental navigation via back gesture — intercept popstate */}
      <BackLockEffect />

      {/* Admin Exit Modal */}
      {showExitModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-6">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Admin Exit</h2>
            <p className="text-sm text-gray-500 mb-4">Enter admin password to leave the kiosk.</p>
            <input
              type="password"
              value={exitPassword}
              onChange={e => { setExitPassword(e.target.value); setExitError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleExitAttempt()}
              placeholder="Password"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg mb-3 focus:outline-none focus:ring-2 focus:ring-[#1a237e]"
              autoFocus
            />
            {exitError && <p className="text-red-500 text-sm mb-3">{exitError}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowExitModal(false); setExitPassword(''); setExitError(''); }}
                className="flex-1 border border-gray-300 rounded-xl py-3 text-gray-700 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleExitAttempt}
                className="flex-1 bg-[#1a237e] text-white rounded-xl py-3 font-semibold"
              >
                Exit Kiosk
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BackLockEffect() {
  useEffect(() => {
    // Push a state so back button doesn't leave the kiosk page
    window.history.pushState(null, '', window.location.href);
    const handlePop = () => {
      window.history.pushState(null, '', window.location.href);
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);
  return null;
}