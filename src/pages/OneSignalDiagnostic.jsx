import { useState } from 'react';
import { base44 } from '@/api/base44Client';

async function loadOneSignalSDK() {
  return new Promise((resolve) => {
    if (window.OneSignal) return resolve(true);
    if (document.querySelector('script[src*="OneSignalSDK"]')) {
      const wait = setInterval(() => {
        if (window.OneSignal) { clearInterval(wait); resolve(true); }
      }, 200);
      setTimeout(() => { clearInterval(wait); resolve(!!window.OneSignal); }, 5000);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    script.defer = true;
    script.onload = () => {
      const wait = setInterval(() => {
        if (window.OneSignal) { clearInterval(wait); resolve(true); }
      }, 200);
      setTimeout(() => { clearInterval(wait); resolve(false); }, 5000);
    };
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

async function runDiagnostic() {
  const result = {
    sdkLoaded: false,
    initSuccess: false,
    permissionFlow: { default: 'not_tested', granted: 'not_tested', denied: 'not_tested' },
    serviceWorker: { registered: false, scope: null, conflictDetected: false },
    subscription: { playerIdGenerated: false, optedIn: false },
    login: { success: false, conflict: false },
    event: { changeFired: false },
    tokenSave: { called: false, success: false },
    delivery: { targetDevices: 0 }
  };

  // STEP 1 — SDK LOAD
  result.sdkLoaded = await loadOneSignalSDK();
  if (!result.sdkLoaded) return result;

  // Fetch App ID
  let appId = null;
  try {
    const res = await fetch('/api/functions/getOneSignalAppId');
    const data = await res.json();
    appId = data?.appId || data?.app_id;
  } catch {}
  if (!appId) return result;

  // STEP 2 — INIT
  try {
    await new Promise((resolve, reject) => {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async (OneSignal) => {
        try {
          await OneSignal.init({
            appId,
            serviceWorkerPath: '/api/functions/oneSignalServiceWorker',
            serviceWorkerUpdaterPath: '/api/functions/oneSignalServiceWorker',
            serviceWorkerParam: { scope: '/' },
            autoRegister: true,
            autoResubscribe: true,
            allowLocalhostAsSecureOrigin: true,
            promptOptions: { slidedown: { enabled: false } },
            notifyButton: { enable: false },
          });
          result.initSuccess = true;
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });
  } catch { return result; }

  const OS = window.OneSignal;

  // STEP 3 — PERMISSION FLOW
  const currentPerm = Notification.permission;
  result.permissionFlow.default = currentPerm === 'default' ? 'will_prompt' : 'skipped_not_default';
  result.permissionFlow.granted = currentPerm === 'granted' ? 'already_granted' : 'not_currently_granted';
  result.permissionFlow.denied  = currentPerm === 'denied'  ? 'blocked_by_user' : 'not_blocked';

  if (currentPerm === 'default') {
    try {
      const r = await OS.Notifications.requestPermission();
      result.permissionFlow.default = `requested_result:${Notification.permission}`;
    } catch (e) {
      result.permissionFlow.default = `request_error:${e.message}`;
    }
  }

  // STEP 4 — SERVICE WORKER
  if ('serviceWorker' in navigator) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      const osWorker = regs.find(r => r.active?.scriptURL?.includes('oneSignal') || r.scope?.includes('/'));
      const conflicts = regs.filter(r => r.active?.scriptURL && !r.active.scriptURL.includes('oneSignal') && !r.active.scriptURL.includes('OneSignal'));
      result.serviceWorker.registered = !!osWorker;
      result.serviceWorker.scope = osWorker?.scope || null;
      result.serviceWorker.conflictDetected = conflicts.length > 0;
      if (conflicts.length > 0) {
        result.serviceWorker.conflictUrls = conflicts.map(r => r.active?.scriptURL);
      }
    } catch {}
  }

  // STEP 5 — SUBSCRIPTION STATE
  if (Notification.permission === 'granted') {
    const subId = OS.User?.PushSubscription?.id;
    const optedIn = OS.User?.PushSubscription?.optedIn;
    result.subscription.playerIdGenerated = !!subId;
    result.subscription.optedIn = !!optedIn;
    result.subscription.playerId = subId || null;
  }

  // STEP 6 — LOGIN
  const studentRaw = localStorage.getItem('student_session');
  const staffRaw = localStorage.getItem('staff_session');
  let externalUserId = null;
  let tokenSaveFn = null;
  let tokenSavePayload = null;

  if (staffRaw) {
    const s = JSON.parse(staffRaw);
    externalUserId = `staff_${s.staff_id}`;
    tokenSaveFn = 'saveStaffPushToken';
    tokenSavePayload = (id) => ({ staff_id: s.staff_id, player_id: id });
  } else if (studentRaw) {
    const s = JSON.parse(studentRaw);
    externalUserId = `student_${s.student_id}`;
    tokenSaveFn = 'saveStudentPushToken';
    tokenSavePayload = (id) => ({ student_id: s.student_id, player_id: id });
  }

  if (externalUserId && Notification.permission === 'granted') {
    try {
      await OS.login(externalUserId);
      result.login.success = true;
    } catch (e) {
      result.login.success = false;
      result.login.conflict = e?.message?.includes('409') || e?.status === 409;
      result.login.error = e?.message;
    }
  }

  // STEP 7 — CHANGE EVENT (attach listener, check if it fires within 3s)
  await new Promise((resolve) => {
    let fired = false;
    const handler = (event) => {
      fired = true;
      result.event.changeFired = true;
      result.event.eventPlayerId = event.current?.id;
      result.event.eventOptedIn = OS.User?.PushSubscription?.optedIn;
      OS.User.PushSubscription.removeEventListener('change', handler);
      resolve();
    };
    OS.User?.PushSubscription?.addEventListener('change', handler);
    setTimeout(() => {
      if (!fired) OS.User?.PushSubscription?.removeEventListener('change', handler);
      resolve();
    }, 3000);
  });

  // STEP 8 — RE-CHECK SUBSCRIPTION after login
  const finalId = OS.User?.PushSubscription?.id;
  if (finalId) {
    result.subscription.playerIdGenerated = true;
    result.subscription.playerId = finalId;
    result.subscription.optedIn = !!OS.User?.PushSubscription?.optedIn;
  }

  // STEP 9 — TOKEN SAVE
  const playerIdToSave = result.subscription.playerId || 'mock_test_id_diagnostic_only';
  if (tokenSaveFn) {
    result.tokenSave.called = true;
    try {
      await base44.functions.invoke(tokenSaveFn, tokenSavePayload(playerIdToSave));
      result.tokenSave.success = true;
    } catch (e) {
      result.tokenSave.success = false;
      result.tokenSave.error = e?.message;
    }
  }

  // STEP 10 — DELIVERY TEST
  try {
    const deliveryRes = await base44.functions.invoke('testOneSignalDelivery', { external_user_id: externalUserId });
    result.delivery.targetDevices = deliveryRes?.data?.recipients ?? deliveryRes?.data?.errors?.length === 0 ? 1 : 0;
    result.delivery.raw = deliveryRes?.data;
  } catch (e) {
    result.delivery.error = e?.message;
  }

  return result;
}

export default function OneSignalDiagnostic() {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState(null);

  const run = async () => {
    setRunning(true);
    setReport(null);
    const r = await runDiagnostic();
    setReport(r);
    setRunning(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-green-400 font-mono p-6">
      <h1 className="text-xl font-bold mb-4 text-white">OneSignal Push Diagnostic</h1>
      <button
        onClick={run}
        disabled={running}
        className="bg-green-700 hover:bg-green-600 text-white px-6 py-2 rounded mb-6 disabled:opacity-50"
      >
        {running ? 'Running Tests...' : 'Run Full Diagnostic'}
      </button>
      {report && (
        <pre className="bg-gray-900 rounded-xl p-4 overflow-auto text-sm text-green-300 whitespace-pre-wrap">
          {JSON.stringify(report, null, 2)}
        </pre>
      )}
    </div>
  );
}