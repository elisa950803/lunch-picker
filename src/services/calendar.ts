/**
 * Calendarific API service
 * Provides holiday information to help adjust restaurant recommendations
 * API Documentation: https://calendarific.com/api-documentation
 */

export interface Holiday {
  name: string;
  description: string;
  date: {
    datetime: {
      year: string;
      month: string;
      day: string;
    };
  };
  type: string;
  locations: string[];
}

export interface HolidaysResponse {
  holidays: Holiday[];
  isHoliday: boolean;
  holidayNames: string[];
}

interface CalendarificApiResponse {
  meta: {
    code: number;
    error_detail?: string;
  };
  response: {
    holidays: Array<{
      name: string;
      description?: string;
      date: {
        datetime: {
          year: string;
          month: string;
          day: string;
        };
      };
      type?: string[];
      locations?: string;
    }>;
  };
}

/**
 * Gets holidays for a specific country and date/year
 * @param apiKey - Calendarific API key from environment variable
 * @param countryCode - ISO 3166-1 alpha-2 country code (e.g., 'US', 'GB', 'CA')
 * @param year - Year to get holidays for
 * @param month - Optional month (1-12)
 * @param day - Optional day (1-31)
 * @returns Holidays data for the specified date/year
 * @throws Error if API request fails or API key is missing
 */
export async function getHolidays(
  apiKey: string,
  countryCode: string,
  year: number,
  month?: number,
  day?: number
): Promise<HolidaysResponse> {
  if (!apiKey) {
    throw new Error('Calendarific API key is required. Set CALENDARIFIC_API_KEY environment variable.');
  }

  if (!countryCode || !year) {
    throw new Error('Country code and year are required.');
  }

  const url = new URL('https://calendarific.com/api/v2/holidays');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('country', countryCode);
  url.searchParams.set('year', year.toString());

  if (month) {
    url.searchParams.set('month', month.toString());
  }
  if (day) {
    url.searchParams.set('day', day.toString());
  }

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(
        `Calendarific API error: ${response.status} ${response.statusText}`
      );
    }

    const data: CalendarificApiResponse = await response.json();

    if (data.meta?.code !== 200) {
      throw new Error(
        `Calendarific API error: ${data.meta?.code || 'Unknown'} - ${data.meta?.error_detail || 'Unknown error'}`
      );
    }

    return normalizeHolidaysData(data);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch holidays data: ${error.message}`);
    }
    throw new Error('Failed to fetch holidays data: Unknown error');
  }
}

/**
 * Gets holidays for today's date
 * @param apiKey - Calendarific API key
 * @param countryCode - ISO 3166-1 alpha-2 country code
 * @returns Holidays data for today
 */
export async function getTodayHolidays(
  apiKey: string,
  countryCode: string
): Promise<HolidaysResponse> {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1; // getMonth() returns 0-11
  const day = today.getDate();

  return getHolidays(apiKey, countryCode, year, month, day);
}

/**
 * Checks if a specific date is a holiday
 * @param apiKey - Calendarific API key
 * @param countryCode - ISO 3166-1 alpha-2 country code
 * @param year - Year
 * @param month - Month (1-12)
 * @param day - Day (1-31)
 * @returns True if the date is a holiday
 */
export async function isHoliday(
  apiKey: string,
  countryCode: string,
  year: number,
  month: number,
  day: number
): Promise<boolean> {
  const result = await getHolidays(apiKey, countryCode, year, month, day);
  return result.isHoliday;
}

/**
 * Normalizes Calendarific API response to our standard format
 * @param data - Raw response from Calendarific API
 * @returns Normalized holidays response
 */
function normalizeHolidaysData(data: CalendarificApiResponse): HolidaysResponse {
  const holidays = data.response?.holidays || [];
  const holidayNames = holidays.map(h => h.name || 'Unknown Holiday');

  return {
    holidays: holidays.map(holiday => ({
      name: holiday.name || 'Unknown Holiday',
      description: holiday.description || '',
      date: holiday.date || {
        datetime: { year: '', month: '', day: '' }
      },
      type: holiday.type?.[0] || 'unknown',
      locations: holiday.locations?.split(', ') || []
    })),
    isHoliday: holidays.length > 0,
    holidayNames
  };
}
