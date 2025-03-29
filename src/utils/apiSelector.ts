/**
 * Utility for making API calls to local or remote devices
 */
export async function callApi<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: any;
    deviceId?: string;
    token: string;
  }
): Promise<T> {
  const { method = 'GET', body, deviceId, token } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // Determine the URL based on whether we're calling a remote device
  let url = path.startsWith('/api/') ? path : `/api/${path}`;

  // If deviceId is provided, proxy to that device
  if (deviceId) {
    // Get the path without /api prefix if it exists
    const apiPath = path.startsWith('/api/') ? path.substring(5) : path;
    url = `/api/proxy/${apiPath}?deviceId=${deviceId}`;
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API request failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API call failed to ${url}:`, error);
    throw error;
  }
}
