// Google Calendar API の型定義
export interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  end?: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email?: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  created?: string;
  updated?: string;
  status?: string;
}

export interface CalendarListResponse {
  items?: CalendarEvent[];
  nextPageToken?: string;
}
