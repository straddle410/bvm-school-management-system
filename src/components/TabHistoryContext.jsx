import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const TabHistoryContext = createContext(null);

export function TabHistoryProvider({ children }) {
  const location = useLocation();
  const [tabStacks, setTabStacks] = useState({});

  useEffect(() => {
    // Infer current tab from page name
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

  const getTabForPage = (pageName) => {
    const tabMap = {
      'Attendance': 'attendance',
      'Marks': 'marks',
      'Fees': 'fees',
      'Notices': 'notices',
      'Gallery': 'gallery',
      'Approvals': 'approvals',
      'Dashboard': 'dashboard',
      'More': 'more'
    };
    return tabMap[pageName] || 'dashboard';
  };

  const getStackForTab = (tabName) => {
    return tabStacks[tabName] || [];
  };

  return (
    <TabHistoryContext.Provider value={{ tabStacks, getStackForTab, getTabForPage }}>
      {children}
    </TabHistoryContext.Provider>
  );
}

export function useTabHistory() {
  const ctx = useContext(TabHistoryContext);
  if (!ctx) {
    return { tabStacks: {}, getStackForTab: () => [], getTabForPage: () => 'dashboard' };
  }
  return ctx;
}