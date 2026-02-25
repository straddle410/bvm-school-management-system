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
    
    // Convert to base64 for reliable mobile support
    const uint8Array = new Uint8Array(buffer);
    const base64 = globalThis.btoa(String.fromCharCode(...uint8Array));
    const dataUrl = `data:${contentType};base64,${base64}`;

    console.error('[imageProxy] Success. URL:', imageUrl, 'Base64 length:', base64.length);
    return Response.json({ dataUrl }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      }
    });
  } catch (error) {
    console.error('[imageProxy] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});