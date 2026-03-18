Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const { url: imageUrl } = body;
    
    if (!imageUrl) {
      return Response.json({ error: 'Missing url' }, { status: 400 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    const imageRes = await fetch(imageUrl, { 
      method: 'GET',
      credentials: 'omit',
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Referer': 'https://base44.app/'
      },
      signal: controller.signal,
      redirect: 'follow'
    });
    
    clearTimeout(timeoutId);
    
    if (!imageRes.ok) {
      return Response.json({ error: `Failed to fetch: ${imageRes.statusText}` }, { status: imageRes.status });
    }

    const buffer = await imageRes.arrayBuffer();
    const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
    
    // Convert to base64 for reliable mobile support
    const uint8Array = new Uint8Array(buffer);
    const base64 = globalThis.btoa(String.fromCharCode(...uint8Array));
    const dataUrl = `data:${contentType};base64,${base64}`;

    // Detailed logging
    const first100 = dataUrl.substring(0, 100);
    const isValidDataUrl = dataUrl.startsWith('data:') && dataUrl.includes(';base64,');
    console.error('[imageProxy] ✓ Success. URL:', imageUrl);
    console.error('[imageProxy] Base64 length:', base64.length);
    console.error('[imageProxy] DataUrl first 100 chars:', first100);
    console.error('[imageProxy] DataUrl total length:', dataUrl.length);
    console.error('[imageProxy] MIME type:', contentType);
    console.error('[imageProxy] Is valid dataUrl format:', isValidDataUrl);
    console.error('[imageProxy] Buffer size (bytes):', buffer.byteLength);
    
    return Response.json({ dataUrl }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      }
    });
  } catch (error) {
    console.error('[imageProxy] Error fetching image:', error.message);
    console.error('[imageProxy] URL attempted:', imageUrl);
    console.error('[imageProxy] Error type:', error.name);
    return Response.json({ error: error.message, url: imageUrl }, { status: 500 });
  }
});