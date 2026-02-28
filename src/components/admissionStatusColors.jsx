// Centralized status-to-color mapping for admission applications
export const ADMISSION_STATUS_COLORS = {
  'Pending': {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-800',
    badge: 'bg-yellow-100',
    dot: 'bg-yellow-400'
  },
  'Verified': {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    badge: 'bg-blue-100',
    dot: 'bg-blue-400'
  },
  'Approved': {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-800',
    badge: 'bg-green-100',
    dot: 'bg-green-400'
  },
  'Converted': {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-800',
    badge: 'bg-purple-100',
    dot: 'bg-purple-400'
  },
  'Rejected': {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    badge: 'bg-red-100',
    dot: 'bg-red-400'
  }
};

export const getStatusColor = (status) => {
  return ADMISSION_STATUS_COLORS[status] || ADMISSION_STATUS_COLORS['Pending'];
};

export const getStatusLabel = (status) => {
  const labels = {
    'Pending': 'Pending',
    'Verified': 'Verified',
    'Approved': 'Approved',
    'Converted': 'Converted',
    'Rejected': 'Rejected'
  };
  return labels[status] || status;
};

export const SLA_THRESHOLDS = {
  'Pending': 3, // days before highlight
  'Verified': 2, // days before highlight
};

export const calculateDaysInStatus = (statusUpdatedAt) => {
  if (!statusUpdatedAt) return 0;
  const now = new Date();
  const updated = new Date(statusUpdatedAt);
  const diffMs = now - updated;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

export const isSLABreach = (status, daysInStatus) => {
  const threshold = SLA_THRESHOLDS[status];
  return threshold ? daysInStatus > threshold : false;
};