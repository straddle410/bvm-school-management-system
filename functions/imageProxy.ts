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
    const base64 = btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)));
    const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
    const dataUrl = `data:${contentType};base64,${base64}`;

    return Response.json({ url: dataUrl });
  } catch (error) {
    console.error('[imageProxy] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});