import React, { createContext, useContext, useState, useCallback } from 'react';

const AsyncOperationContext = createContext(null);

export function AsyncOperationProvider({ children }) {
  const [operations, setOperations] = useState({});

  const startOperation = useCallback((operationId) => {
    setOperations(prev => ({ ...prev, [operationId]: true }));
  }, []);

  const endOperation = useCallback((operationId) => {
    setOperations(prev => {
      const newOps = { ...prev };
      delete newOps[operationId];
      return newOps;
    });
  }, []);

  const isOperationInProgress = useCallback((operationId) => {
    return operations[operationId] || false;
  }, [operations]);

  const isAnyOperationInProgress = useCallback(() => {
    return Object.keys(operations).length > 0;
  }, [operations]);

  return (
    <AsyncOperationContext.Provider value={{
      startOperation,
      endOperation,
      isOperationInProgress,
      isAnyOperationInProgress,
      operations
    }}>
      {children}
    </AsyncOperationContext.Provider>
  );
}

export function useAsyncOperation() {
  const ctx = useContext(AsyncOperationContext);
  if (!ctx) {
    return {
      startOperation: () => {},
      endOperation: () => {},
      isOperationInProgress: () => false,
      isAnyOperationInProgress: () => false
    };
  }
  return ctx;
}