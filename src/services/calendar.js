/**
 * Calendarific API service
 * Provides holiday information to help adjust restaurant recommendations
 * API Documentation: https://calendarific.com/api-documentation
 */

/**
 * @typedef {Object} Holiday
 * @property {string} name - Name of the holiday
 * @property {string} description - Description of the holiday
 * @property {Object} date - Date information
 * @property {string} date.datetime.year - Year
 * @property {string} date.datetime.month - Month
 * @property {string} date.datetime.day - Day
 * @property {string} type - Type of holiday (national, religious, etc.)
 * @property {string[]} locations - Locations where this holiday is observed
 */

/**
 * @typedef {Object} HolidaysResponse
 * @property {Holiday[]} holidays - Array of holidays
 * @property {boolean} isHoliday - Whether the date has any holidays
 * @property {string[]} holidayNames - Names of all holidays on this date
 */

/**
 * Gets holidays for a specific country and date/year
 * @param {string} apiKey - Calendarific API key from environment variable
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code (e.g., 'US', 'GB', 'CA')
 * @param {number} year - Year to get holidays for
 * @param {number} [month] - Optional month (1-12)
 * @param {number} [day] - Optional day (1-31)
 * @returns {Promise<HolidaysResponse>} Holidays data for the specified date/year
 * @throws {Error} If API request fails or API key is missing
 */
async function getHolidays(apiKey, countryCode, year, month = null, day = null) {
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

    const data = await response.json();

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
 * @param {string} apiKey - Calendarific API key
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code
 * @returns {Promise<HolidaysResponse>} Holidays data for today
 */
async function getTodayHolidays(apiKey, countryCode) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1; // getMonth() returns 0-11
  const day = today.getDate();

  return getHolidays(apiKey, countryCode, year, month, day);
}

/**
 * Checks if a specific date is a holiday
 * @param {string} apiKey - Calendarific API key
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code
 * @param {number} year - Year
 * @param {number} month - Month (1-12)
 * @param {number} day - Day (1-31)
 * @returns {Promise<boolean>} True if the date is a holiday
 */
async function isHoliday(apiKey, countryCode, year, month, day) {
  const result = await getHolidays(apiKey, countryCode, year, month, day);
  return result.isHoliday;
}

/**
 * Normalizes Calendarific API response to our standard format
 * @param {Object} data - Raw response from Calendarific API
 * @returns {HolidaysResponse} Normalized holidays response
 */
function normalizeHolidaysData(data) {
  const holidays = data.response?.holidays || [];
  const holidayNames = holidays.map(h => h.name || 'Unknown Holiday');

  return {
    holidays: holidays.map(holiday => ({
      name: holiday.name || 'Unknown Holiday',
      description: holiday.description || '',
      date: holiday.date || {},
      type: holiday.type?.[0] || 'unknown',
      locations: holiday.locations?.split(', ') || []
    })),
    isHoliday: holidays.length > 0,
    holidayNames
  };
}

module.exports = {
  getHolidays,
  getTodayHolidays,
  isHoliday,
  normalizeHolidaysData
};
