export class AuthAPI {
  // Verify a signature with the backend
  static async verifySignature(address: string, signature: string, message: string) {
    const response = await fetch('/api/wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address,
        signature,
        message
      })
    });

    return await response.json();
  }

  // Verify token validity
  static async verifyToken(token: string) {
    const response = await fetch('/api/wallet/verify', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      cache: 'no-store'
    });

    return await response.json();
  }

  // Refresh auth token
  static async refreshToken(token: string) {
    const response = await fetch('/api/wallet/refresh', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    return await response.json();
  }

  // Logout from API
  static async logout(token: string) {
    try {
      await fetch('/api/wallet/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}
