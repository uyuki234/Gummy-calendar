const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

let tokenClient: ReturnType<typeof window.google.accounts.oauth2.initTokenClient> | null = null;
let accessToken: string | null = null;
let pendingTokenRequest: {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
} | null = null;

export function initTokenClient() {
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (resp) => {
      if (resp.error) {
        console.error('認証エラー:', resp);
        if (pendingTokenRequest) {
          pendingTokenRequest.reject(new Error(resp.error_description || resp.error));
          pendingTokenRequest = null;
        }
      } else if (resp.access_token) {
        accessToken = resp.access_token;
        if (pendingTokenRequest) {
          pendingTokenRequest.resolve(resp.access_token);
          pendingTokenRequest = null;
        }
      }
    },
  });
}

export async function ensureAccessToken(): Promise<string> {
  if (accessToken) return accessToken;

  if (!tokenClient) {
    initTokenClient();
  }

  if (!tokenClient) {
    throw new Error('Token client が初期化されていません');
  }

  return new Promise((resolve, reject) => {
    pendingTokenRequest = { resolve, reject };

    // prompt: "" means it will use the existing token if available, otherwise show consent
    if (accessToken) {
      tokenClient!.requestAccessToken({ prompt: '' });
    } else {
      tokenClient!.requestAccessToken({ prompt: 'consent' });
    }

    // Timeout after 60 seconds
    setTimeout(() => {
      if (pendingTokenRequest) {
        pendingTokenRequest.reject(new Error('認証がタイムアウトしました（60秒）'));
        pendingTokenRequest = null;
      }
    }, 60000);
  });
}
