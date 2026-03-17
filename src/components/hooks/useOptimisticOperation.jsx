import { useState } from 'react';
import { useLoading } from '@/components/LoadingProvider';

export function useOptimisticOperation(operationKey) {
  const { setLoading } = useLoading();
  const [isLoading, setIsLoadingLocal] = useState(false);
  const [error, setError] = useState(null);

  const execute = async (asyncFn) => {
    setIsLoadingLocal(true);
    setLoading(operationKey, true);
    setError(null);

    try {
      const result = await asyncFn();
      setIsLoadingLocal(false);
      setLoading(operationKey, false);
      return result;
    } catch (err) {
      setError(err.message);
      setIsLoadingLocal(false);
      setLoading(operationKey, false);
      throw err;
    }
  };

  return { isLoading, error, execute };
}