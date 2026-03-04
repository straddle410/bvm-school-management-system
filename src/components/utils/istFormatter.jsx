/**
 * Format date to IST (Asia/Kolkata) timezone
 * @param {string|Date} timestamp - ISO string or Date object
 * @param {string} format - 'short' (dd MMM HH:mm) or 'long' (dd MMM yyyy, HH:mm)
 * @returns {string} Formatted date in IST
 */
export const formatIST = (timestamp, format = 'short') => {
  if (!timestamp) return 'Unknown date';

  try {
    let date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;

    // Detect if timestamp is already in IST format (not UTC)
    // UTC timestamps end with 'Z' or have milliseconds after T
    // IST timestamps from DB are already local (e.g., 2026-03-04T12:22:51.850000)
    const timestampStr = typeof timestamp === 'string' ? timestamp : '';
    const isAlreadyIST = timestampStr && !timestampStr.endsWith('Z') && timestampStr.includes('T');

    if (isAlreadyIST) {
      // Already in local time, parse as IST and just format it
      const parts = timestampStr.split('T');
      const [year, month, day] = parts[0].split('-');
      const timeParts = parts[1].split(':');
      const hour = parseInt(timeParts[0]);
      const minute = parseInt(timeParts[1]);
      const second = parseInt(timeParts[2]);

      if (format === 'short') {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthName = monthNames[parseInt(month) - 1];
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${day} ${monthName} ${String(displayHour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${ampm} IST`;
      }

      // 'long' format
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthName = monthNames[parseInt(month) - 1];
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${day} ${monthName} ${year}, ${String(displayHour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${ampm} IST`;
    }

    // Standard UTC to IST conversion
    if (format === 'short') {
      const formatted = date.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      return `${formatted} IST`;
    }

    const formatted = date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    return `${formatted} IST`;
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