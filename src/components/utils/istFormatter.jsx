/**
 * Format date to IST (Asia/Kolkata) timezone
 * Converts UTC timestamps to IST using toLocaleString
 * @param {string|Date} timestamp - ISO string or Date object
 * @param {string} format - 'short' (dd MMM HH:mm) or 'long' (dd MMM yyyy, HH:mm)
 * @returns {string} Formatted date in IST
 */
export const formatIST = (timestamp, format = 'short') => {
  if (!timestamp) return 'Unknown date';

  try {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    
    if (format === 'short') {
      return date.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).replace(',', '') + ' IST';
    }

    // 'long' format
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).replace(',', ',') + ' IST';
  } catch (e) {
    return 'Invalid date';
  }
};

/**
 * Format date to ISO date string in IST (for display in backup filenames)
 * @param {string|Date} timestamp - ISO string or Date object
 * @returns {string} YYYY-MM-DD format
 */
export const formatISTDate = (timestamp) => {
  if (!timestamp) return 'unknown';

  try {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    const istDate = date.toLocaleString('en-CA', { timeZone: 'Asia/Kolkata' }).split(',')[0];
    return istDate;
  } catch (e) {
    return 'unknown';
  }
};