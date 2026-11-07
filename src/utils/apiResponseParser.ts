export interface SafeApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  url: string;
}

export async function safeParseApiResponse<T = any>(res: Response): Promise<SafeApiResponse<T>> {
  const url = res.url || 'unknown endpoint';
  const status = res.status;
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!res.ok) {
    if (isJson) {
      try {
        const errJson = await res.json();
        return {
          ok: false,
          status,
          url,
          error: errJson.error || errJson.message || `HTTP ${status}`,
        };
      } catch {
        // Fallthrough
      }
    }
    const text = await res.text();
    const preview = text.substring(0, 150).replace(/\s+/g, ' ');
    console.warn(`[API Non-JSON Error Response] ${status} ${url} (${contentType}): ${preview}`);
    return { ok: false, status, url, error: `HTTP ${status}: ${url}` };
  }

  if (!isJson) {
    const text = await res.text();
    const preview = text.substring(0, 150).replace(/\s+/g, ' ');
    console.warn(`[API Non-JSON Response] ${status} ${url} returned ${contentType} instead of JSON: ${preview}`);
    return { ok: false, status, url, error: `Endpoint ${url} returned non-JSON response (${contentType})` };
  }

  try {
    const data = await res.json();
    return { ok: true, status, url, data };
  } catch (err: any) {
    console.error(`[API JSON Parse Failure] ${url}:`, err);
    return { ok: false, status, url, error: `Invalid JSON from ${url}` };
  }
}
