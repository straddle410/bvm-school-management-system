Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { url: imageUrl } = body;
    
    if (!imageUrl) {
      return Response.json({ error: 'Missing url' }, { status: 400 });
    }

    const imageRes = await fetch(imageUrl, { 
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    if (!imageRes.ok) {
      return Response.json({ error: `Failed to fetch: ${imageRes.statusText}` }, { status: imageRes.status });
    }

    const buffer = await imageRes.arrayBuffer();
    const contentType = imageRes.headers.get('content-type') || 'image/jpeg';

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (error) {
    console.error('[imageProxy] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});