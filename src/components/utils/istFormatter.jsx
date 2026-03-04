/**
 * Format date to IST (Asia/Kolkata) timezone
 * @param {string|Date} timestamp - ISO string or Date object
 * @param {string} format - 'short' (dd MMM HH:mm) or 'long' (dd MMM yyyy, HH:mm)
 * @returns {string} Formatted date in IST
 */
export const formatIST = (timestamp, format = 'short') => {
  if (!timestamp) return 'Unknown date';

  try {
    const timestampStr = typeof timestamp === 'string' ? timestamp : timestamp.toString();
    
    // Parse timestamp as-is (already in local time, not UTC)
    const parts = timestampStr.split('T');
    const [year, month, day] = parts[0].split('-');
    const timeParts = parts[1].split(':');
    const hour = parseInt(timeParts[0]);
    const minute = parseInt(timeParts[1]);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = monthNames[parseInt(month) - 1];
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;

    if (format === 'short') {
      return `${day} ${monthName}, ${String(displayHour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${ampm} IST`;
    }

    // 'long' format
    return `${day} ${monthName} ${year}, ${String(displayHour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${ampm} IST`;
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