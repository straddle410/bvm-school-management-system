import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			refetchOnReconnect: false,
			retry: 1,
			// Cache data for 3 minutes — drastically reduces API calls on Android
			staleTime: 3 * 60 * 1000,
			// Keep unused cache for 10 minutes
			gcTime: 10 * 60 * 1000,
		},
	},
});