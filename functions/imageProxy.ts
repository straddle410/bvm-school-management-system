Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const imageUrl = url.searchParams.get('url');
    
    if (!imageUrl) {
      return Response.json({ error: 'Missing url parameter' }, { status: 400 });
    }

    const decodedUrl = decodeURIComponent(imageUrl);
    const imageRes = await fetch(decodedUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    
    if (!imageRes.ok) {
      return Response.json({ error: 'Failed to fetch image' }, { status: imageRes.status });
    }

    const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
    const buffer = await imageRes.arrayBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('[imageProxy] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});