Deno.serve((req) => {
  const vapidKey = Deno.env.get('VAPID_PUBLIC_KEY');
  
  if (!vapidKey) {
    return Response.json({ error: 'VAPID_PUBLIC_KEY not configured' }, { status: 500 });
  }
  
  return Response.json({ vapidKey });
});