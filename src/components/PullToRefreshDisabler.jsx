import { useEffect } from 'react';

export default function PullToRefreshDisabler() {
  useEffect(() => {
    // Prevent pull-to-refresh on all scrollable containers
    const handleTouchMove = (e) => {
      // Allow scrolling inside inputs, textareas
      const target = e.target;
      const isInput = target.tagName === 'INPUT' || 
                      target.tagName === 'TEXTAREA' ||
                      target.closest('input') ||
                      target.closest('textarea') ||
                      target.contentEditable === 'true';
      
      if (!isInput) {
        // Prevent default only if at top of page (pulling down from top)
        if (window.scrollY === 0) {
          e.preventDefault();
        }
      }
    };

    // Passive: false to allow preventDefault
    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    // Set CSS overscroll behavior
    document.documentElement.style.overscrollBehavior = 'contain';
    document.body.style.overscrollBehavior = 'contain';

    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.documentElement.style.overscrollBehavior = '';
      document.body.style.overscrollBehavior = '';
    };
  }, []);

  return null;
}