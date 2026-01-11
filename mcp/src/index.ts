#!/usr/bin/env node
/**
 * MCP Server for Food Around Work Recommendations
 * Exposes tools for weather forecasts, holidays, and restaurant search
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { config } from 'dotenv';
import { getForecast } from './services/weatherForecast.js';
import { getHoliday } from './services/holidayService.js';
import { searchRestaurants, getPlaceDetails } from './services/placesService.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../../.env') }); // Load from project root

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const CALENDARIFIC_API_KEY = process.env.CALENDARIFIC_API_KEY;

class FoodRecommendationServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'food-recommendation-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'weather.getForecast',
          description: 'Get weather forecast for a specific location and time. Returns temperature, feels-like temperature, precipitation probability, weather condition, and flags for cold/hot/rainy weather.',
          inputSchema: {
            type: 'object',
            properties: {
              lat: {
                type: 'number',
                description: 'Latitude coordinate',
              },
              lng: {
                type: 'number',
                description: 'Longitude coordinate',
              },
              whenISO: {
                type: 'string',
                description: 'ISO 8601 date-time string (e.g., "2024-01-15T12:00:00Z" or "2024-01-15")',
              },
            },
            required: ['lat', 'lng', 'whenISO'],
          },
        },
        {
          name: 'holiday.getHoliday',
          description: 'Check if a specific date is a holiday in a given country. Returns holiday name if it is a holiday, otherwise returns isHoliday: false.',
          inputSchema: {
            type: 'object',
            properties: {
              dateISO: {
                type: 'string',
                description: 'ISO 8601 date string (e.g., "2024-01-15" or "2024-01-15T12:00:00Z")',
              },
              countryCode: {
                type: 'string',
                description: 'ISO country code (e.g., "US", "GB", "CA")',
              },
            },
            required: ['dateISO', 'countryCode'],
          },
        },
        {
          name: 'places.searchRestaurants',
          description: 'Search for restaurants near a location. Filters by meal type (lunch/dinner) and optionally by whether they are open now.',
          inputSchema: {
            type: 'object',
            properties: {
              lat: {
                type: 'number',
                description: 'Latitude coordinate',
              },
              lng: {
                type: 'number',
                description: 'Longitude coordinate',
              },
              meal: {
                type: 'string',
                enum: ['lunch', 'dinner'],
                description: 'Meal type: "lunch" or "dinner"',
              },
              radiusMeters: {
                type: 'number',
                description: 'Search radius in meters (max 50000, default 5000)',
                default: 5000,
              },
              maxResults: {
                type: 'number',
                description: 'Maximum number of results (default 20, max 20)',
                default: 20,
              },
              openNow: {
                type: 'boolean',
                description: 'Optional filter for places open now',
              },
            },
            required: ['lat', 'lng', 'meal'],
          },
        },
        {
          name: 'places.getPlaceDetails',
          description: 'Get detailed information about a place by its place ID, including website, phone, opening hours, photos, and whether reservations are available.',
          inputSchema: {
            type: 'object',
            properties: {
              placeId: {
                type: 'string',
                description: 'Google Places place ID',
              },
            },
            required: ['placeId'],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'weather.getForecast': {
            if (!args || typeof args.lat !== 'number' || typeof args.lng !== 'number' || typeof args.whenISO !== 'string') {
              throw new Error('Invalid arguments: lat, lng, and whenISO are required');
            }
            const forecast = await getForecast(args.lat, args.lng, args.whenISO);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(forecast, null, 2),
                },
              ],
            };
          }

          case 'holiday.getHoliday': {
            if (!args || typeof args.dateISO !== 'string' || typeof args.countryCode !== 'string') {
              throw new Error('Invalid arguments: dateISO and countryCode are required');
            }
            const holiday = await getHoliday(args.dateISO, args.countryCode, CALENDARIFIC_API_KEY);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(holiday, null, 2),
                },
              ],
            };
          }

          case 'places.searchRestaurants': {
            if (!args || typeof args.lat !== 'number' || typeof args.lng !== 'number' || args.meal !== 'lunch' && args.meal !== 'dinner') {
              throw new Error('Invalid arguments: lat, lng, and meal (lunch|dinner) are required');
            }
            const restaurants = await searchRestaurants(
              GOOGLE_MAPS_API_KEY,
              args.lat,
              args.lng,
              args.meal,
              typeof args.radiusMeters === 'number' ? args.radiusMeters : 5000,
              typeof args.maxResults === 'number' ? args.maxResults : 20,
              typeof args.openNow === 'boolean' ? args.openNow : undefined
            );
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(restaurants, null, 2),
                },
              ],
            };
          }

          case 'places.getPlaceDetails': {
            if (!args || typeof args.placeId !== 'string') {
              throw new Error('Invalid arguments: placeId is required');
            }
            const details = await getPlaceDetails(GOOGLE_MAPS_API_KEY, args.placeId);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(details, null, 2),
                },
              ],
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: errorMessage }, null, 2),
            },
          ],
          isError: true,
        };
      }
    });
  }

  private setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Food Recommendation MCP server running on stdio');
  }
}

// Start the server
const server = new FoodRecommendationServer();
server.run().catch(console.error);
