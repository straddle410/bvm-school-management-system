import React from 'react';

/**
 * WhatsApp-style message tick indicator
 * - Single grey tick: sent (no delivered_at)
 * - Double grey tick: delivered (delivered_at set, no read_at)
 * - Double blue tick: read (read_at set)
 */
export default function MessageTick({ message, size = 14 }) {
  const { delivered_at, read_at } = message;

  const isRead = !!read_at;
  const isDelivered = !!delivered_at;

  const color = isRead ? '#4fc3f7' : '#aaa'; // blue if read, grey otherwise

  if (!isDelivered) {
    // Single tick — sent only
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
        <polyline points="2,9 6,13 14,4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    );
  }

  // Double tick — delivered or read
  return (
    <svg width={size + 6} height={size} viewBox="0 0 22 16" fill="none" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      {/* First tick */}
      <polyline points="1,9 5,13 13,4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Second tick (offset right) */}
      <polyline points="7,9 11,13 19,4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}