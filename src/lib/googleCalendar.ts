/// <reference types="vite/client" />
// Google Calendar API (gapi + Google Identity Services)
// env: VITE_GOOGLE_CLIENT_ID, VITE_GOOGLE_API_KEY

const DISCOVERY_DOC =
  "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest";
const SCOPES = "https://www.googleapis.com/auth/calendar.readonly";

// Allow global symbols from loaded Google scripts
declare const gapi: any;
declare const google: any;

declare global {
  interface Window {
    gapiLoaded?: () => void;
    gisLoaded?: () => void;
  }
}

let gapiInited = false;
let gisInited = false;

interface TokenClient {
  callback: (resp: any) => void;
  requestAccessToken: (options: { prompt: string }) => void;
}
let tokenClient: TokenClient;

export function initGoogle(): Promise<void> {
  return new Promise((resolve, reject) => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY as string;
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
    if (!apiKey || !clientId) {
      reject(
        new Error("Missing Google Client ID or API Key environment variables")
      );
      return;
    }

    window.gapiLoaded = () => {
      // Load gapi client
      // @ts-ignore
      gapi.load("client", async () => {
        try {
          // @ts-ignore
          await gapi.client.init({ apiKey, discoveryDocs: [DISCOVERY_DOC] });
          gapiInited = true;
          maybeResolve();
        } catch (e) {
          reject(e);
        }
      });
    };

    window.gisLoaded = () => {
      try {
        // @ts-ignore
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPES,
          // default callback will be replaced in ensureAuthorized
          callback: (_resp: any) => {},
        });
        gisInited = true;
        maybeResolve();
      } catch (e) {
        reject(e);
      }
    };

    function maybeResolve() {
      if (gapiInited && gisInited) resolve();
    }

    // Handle scripts that may have already loaded before handlers were set
    try {
      // @ts-ignore
      if (typeof gapi !== "undefined" && gapi?.client) {
        // If gapi is present, initialize immediately
        // @ts-ignore
        gapi.load("client", async () => {
          try {
            // @ts-ignore
            await gapi.client.init({ apiKey, discoveryDocs: [DISCOVERY_DOC] });
            gapiInited = true;
            maybeResolve();
          } catch (e) {
            reject(e);
          }
        });
      }
    } catch {}

    try {
      // @ts-ignore
      if (typeof google !== "undefined" && google?.accounts?.oauth2) {
        // Initialize GIS immediately if available
        // @ts-ignore
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPES,
          callback: (_resp: any) => {},
        });
        gisInited = true;
        maybeResolve();
      }
    } catch {}
  });
}

export async function ensureAuthorized(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // @ts-ignore
      tokenClient.callback = async (resp: any) => {
        if (resp.error !== undefined) {
          reject(resp);
          return;
        }
        // Ensure the gapi client has the access token so gapi.client requests work
        try {
          // @ts-ignore
          if (resp.access_token) {
            // @ts-ignore
            gapi.client.setToken({ access_token: resp.access_token });
          }
        } catch (e) {
          // ignore setToken errors here; we'll still check the token below
        }

        // @ts-ignore
        const token = gapi.client.getToken();
        if (!token || !token.access_token) {
          reject(new Error("No token"));
          return;
        }
        resolve();
      };
      // @ts-ignore
      const token =
        typeof gapi !== "undefined" && gapi.client
          ? gapi.client.getToken()
          : null;
      if (!token || !token.access_token) {
        tokenClient.requestAccessToken({ prompt: "consent" });
      } else {
        tokenClient.requestAccessToken({ prompt: "" });
      }
    } catch (e) {
      reject(e);
    }
  });
}

export type EventListParams = {
  year: number;
};

export async function fetchYearEvents({ year }: EventListParams) {
  // Construct RFC3339 timeMin/timeMax in UTC for the whole year
  const timeMin = new Date(Date.UTC(year, 0, 1, 0, 0, 0)).toISOString();
  const timeMax = new Date(Date.UTC(year, 11, 31, 23, 59, 59)).toISOString();

  let items: any[] = [];
  let pageToken: string | undefined = undefined;
  // @ts-ignore
  do {
    // @ts-ignore
    const response = await gapi.client.calendar.events.list({
      calendarId: "primary",
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
      showDeleted: false,
      maxResults: 2500,
      pageToken,
    });
    const res: any = response.result;
    items = items.concat(res.items || []);
    pageToken = res.nextPageToken;
  } while (pageToken);

  return items.map((ev) => ({
    id: ev.id as string,
    title: (ev.summary || "") as string,
    start: new Date(ev.start?.dateTime || ev.start?.date),
    end: ev.end ? new Date(ev.end?.dateTime || ev.end?.date) : undefined,
    description: ev.description || undefined,
  }));
}

export function signOut() {
  // @ts-ignore
  const token = gapi.client.getToken();
  if (token) {
    try {
      // @ts-ignore
      google.accounts.oauth2.revoke(token.access_token, () => {});
    } catch (e) {
      // Log revoke errors for debugging
      console.error("Error revoking Google OAuth token:", e);
    }
    try {
      // clear gapi client token
      // @ts-ignore
      gapi.client.setToken({});
    } catch (e) {
      // Log errors clearing gapi client token for debugging
      console.error("Error clearing gapi client token:", e);
    }
  }
}
