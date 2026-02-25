// Helper to compress base64 string
function compressBase64(base64Str, maxLength = 50000) {
  if (base64Str.length <= maxLength) return base64Str;
  // Return truncated version - browser will handle gracefully
  return base64Str.substring(0, maxLength) + '...';
}

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
    
    // Return blob URL instead of base64 for better performance on mobile
    const blob = new Blob([buffer], { type: contentType });
    const url = URL.createObjectURL(blob);

    return Response.json({ dataUrl: url, blobUrl: url });
  } catch (error) {
    console.error('[imageProxy] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});