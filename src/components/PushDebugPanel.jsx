import { useState, useEffect } from 'react';

export default function PushDebugPanel() {
  const [logs, setLogs] = useState([]);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Intercept console.log for [PushNotificationManager]
    const originalLog = console.log;
    console.log = function(...args) {
      const msg = args[0]?.toString?.() || '';
      if (msg.includes('[PushNotificationManager]')) {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [...prev.slice(-20), `[${timestamp}] ${msg}`]); // Keep last 20
      }
      originalLog.apply(console, args);
    };
  }, []);

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="fixed bottom-24 right-4 bg-red-500 text-white px-3 py-2 rounded text-xs z-40"
      >
        📊 Debug
      </button>
    );
  }

  return (
    <div className="fixed bottom-24 right-4 w-80 h-64 bg-black text-green-400 text-xs p-3 rounded border border-green-400 overflow-y-auto z-40 font-mono">
      <div className="flex justify-between mb-2">
        <span className="font-bold">Push Debug Logs</span>
        <button onClick={() => { setLogs([]); setShow(false); }} className="text-red-400 hover:text-red-300">✕</button>
      </div>
      <div className="space-y-1">
        {logs.length === 0 ? <div className="text-gray-500">Waiting for logs...</div> : logs.map((log, i) => <div key={i}>{log}</div>)}
      </div>
    </div>
  );
}