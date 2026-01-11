/**
 * Holiday Service using date-holidays library (no API key required)
 * Falls back to Calendarific API if configured
 */

// date-holidays is a CommonJS module, so we need to use require or dynamic import
// Using dynamic import for ES modules compatibility

export interface HolidayResponse {
  name?: string;
  isHoliday: boolean;
}

const COUNTRY_CODE_MAP: Record<string, string> = {
  'US': 'US',
  'USA': 'US',
  'GB': 'GB',
  'UK': 'GB',
  'CA': 'CA',
  'CAN': 'CA',
  'AU': 'AU',
  'AUS': 'AU',
  'DE': 'DE',
  'GER': 'DE',
  'FR': 'FR',
  'FRA': 'FR',
  'IT': 'IT',
  'ITA': 'IT',
  'ES': 'ES',
  'ESP': 'ES',
  'JP': 'JP',
  'JPN': 'JP',
  'CN': 'CN',
  'CHN': 'CN',
  'KR': 'KR',
  'KOR': 'KR',
  'IN': 'IN',
  'IND': 'IN',
  'BR': 'BR',
  'BRA': 'BR',
  'MX': 'MX',
  'MEX': 'MX',
};

/**
 * Gets holiday information for a specific date and country using date-holidays library
 * @param dateISO - ISO 8601 date string (e.g., "2024-01-15" or "2024-01-15T12:00:00Z")
 * @param countryCode - ISO country code (e.g., "US", "GB", "CA")
 * @param apiKey - Optional Calendarific API key (if provided, will use Calendarific instead)
 * @returns Holiday information
 */
export async function getHoliday(
  dateISO: string,
  countryCode: string,
  apiKey?: string
): Promise<HolidayResponse> {
  // Parse date from ISO string
  const date = new Date(dateISO);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateISO}. Use ISO 8601 format (e.g., "2024-01-15").`);
  }

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  // Try Calendarific API if API key is provided
  if (apiKey) {
    try {
      return await getHolidayFromCalendarific(apiKey, countryCode, year, month, day);
    } catch (error) {
      console.warn('Calendarific API failed, falling back to date-holidays:', error);
      // Fall through to date-holidays
    }
  }

  // Use date-holidays library (no API key required)
  try {
    // Dynamic import for CommonJS module compatibility
    const HolidaysModule = await import('date-holidays');
    const Holidays = (HolidaysModule as any).default || HolidaysModule;
    const normalizedCountryCode = COUNTRY_CODE_MAP[countryCode.toUpperCase()] || countryCode.toUpperCase();
    const hd = new Holidays(normalizedCountryCode);

    if (!hd || hd.getCountries().indexOf(normalizedCountryCode) === -1) {
      throw new Error(`Unsupported country code: ${countryCode}. Supported codes: ${Object.keys(COUNTRY_CODE_MAP).join(', ')}`);
    }

    const holidays = hd.getHolidays(year) as Array<{
      date: string | Date;
      name: string;
    }>;
    
    // Find holidays matching the specific date
    const matchingHolidays = holidays.filter((holiday: { date: string | Date; name: string }) => {
      const holidayDate = new Date(holiday.date);
      return (
        holidayDate.getFullYear() === year &&
        holidayDate.getMonth() + 1 === month &&
        holidayDate.getDate() === day
      );
    });

    if (matchingHolidays.length > 0) {
      return {
        name: matchingHolidays[0].name,
        isHoliday: true,
      };
    }

    return {
      isHoliday: false,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get holiday information: ${error.message}`);
    }
    throw new Error('Failed to get holiday information: Unknown error');
  }
}

/**
 * Gets holiday from Calendarific API (fallback option)
 */
async function getHolidayFromCalendarific(
  apiKey: string,
  countryCode: string,
  year: number,
  month: number,
  day: number
): Promise<HolidayResponse> {
  const url = new URL('https://calendarific.com/api/v2/holidays');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('country', countryCode);
  url.searchParams.set('year', year.toString());
  url.searchParams.set('month', month.toString());
  url.searchParams.set('day', day.toString());

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Calendarific API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as {
    meta?: {
      code?: number;
      error_detail?: string;
    };
    response?: {
      holidays?: Array<{
        name: string;
      }>;
    };
  };

  if (data.meta?.code !== 200) {
    throw new Error(
      `Calendarific API error: ${data.meta?.code || 'Unknown'} - ${data.meta?.error_detail || 'Unknown error'}`
    );
  }

  const holidays = data.response?.holidays || [];
  
  if (holidays.length > 0) {
    return {
      name: holidays[0].name,
      isHoliday: true,
    };
  }

  return {
    isHoliday: false,
  };
}
