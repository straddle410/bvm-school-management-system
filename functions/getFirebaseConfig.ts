Deno.serve(async (req) => {
  try {
    const firebaseConfig = {
      apiKey: Deno.env.get("VITE_FIREBASE_API_KEY"),
      authDomain: Deno.env.get("VITE_FIREBASE_AUTH_DOMAIN"),
      projectId: Deno.env.get("FCM_PROJECT_ID"),
      messagingSenderId: Deno.env.get("VITE_FIREBASE_MESSAGING_SENDER_ID"),
      appId: Deno.env.get("VITE_FIREBASE_APP_ID")
    };

    console.log('[getFirebaseConfig] Config ready:', {
      apiKey: firebaseConfig.apiKey ? 'SET' : 'MISSING',
      authDomain: firebaseConfig.authDomain ? 'SET' : 'MISSING',
      projectId: firebaseConfig.projectId ? 'SET' : 'MISSING',
      messagingSenderId: firebaseConfig.messagingSenderId ? 'SET' : 'MISSING',
      appId: firebaseConfig.appId ? 'SET' : 'MISSING'
    });

    return Response.json(firebaseConfig);
  } catch (error) {
    console.error('[getFirebaseConfig] Failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});