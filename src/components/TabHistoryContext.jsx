import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const TabHistoryContext = createContext(null);

const TAB_MAP = {
  'Attendance': 'attendance',
  'Marks': 'marks',
  'Fees': 'fees',
  'Notices': 'notices',
  'Gallery': 'gallery',
  'Approvals': 'approvals',
  'Dashboard': 'dashboard',
  'More': 'more',
  'ArchivedUsers': 'archived'
};

export function TabHistoryProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [tabStacks, setTabStacks] = useState({});

  const getTabForPage = (pageName) => TAB_MAP[pageName] || 'dashboard';

  useEffect(() => {
    const pageFromPath = location.pathname.split('/').filter(Boolean)[0] || 'Dashboard';
    const currentTab = getTabForPage(pageFromPath);

    setTabStacks(prev => {
      const stack = prev[currentTab] || [];
      const isDuplicate = stack.length > 0 && stack[stack.length - 1] === location.pathname;
      if (isDuplicate) return prev;

      return {
        ...prev,
        [currentTab]: [...stack, location.pathname]
      };
    });
  }, [location.pathname]);

  const switchTab = (tabName) => {
    const stack = tabStacks[tabName] || [];
    if (stack.length > 0) {
      // Restore last navigation in this tab
      navigate(stack[stack.length - 1]);
    } else {
      // First visit to tab — navigate to default page
      const defaultPages = {
        'attendance': '/Attendance',
        'marks': '/Marks',
        'fees': '/Fees',
        'notices': '/Notices',
        'gallery': '/Gallery',
        'approvals': '/Approvals',
        'dashboard': '/Dashboard',
        'more': '/More'
      };
      navigate(defaultPages[tabName] || '/Dashboard');
    }
  };

  const getStackForTab = (tabName) => tabStacks[tabName] || [];

  return (
    <TabHistoryContext.Provider value={{ tabStacks, getStackForTab, getTabForPage, switchTab }}>
      {children}
    </TabHistoryContext.Provider>
  );
}

export function useTabHistory() {
  const ctx = useContext(TabHistoryContext);
  if (!ctx) {
    return { tabStacks: {}, getStackForTab: () => [], getTabForPage: () => 'dashboard', switchTab: () => {} };
  }
  return ctx;
}