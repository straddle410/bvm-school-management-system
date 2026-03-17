import { useEffect } from 'react';

export default function PullToRefreshDisabler() {
  useEffect(() => {
    // Disable pull-to-refresh via CSS only
    document.body.style.overscrollBehavior = 'contain';
    return () => {
      document.body.style.overscrollBehavior = '';
    };
  }, []);

  return null;
}