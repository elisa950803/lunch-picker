# Quick Start Guide

## ⚠️ Important: Two Different Use Cases

This project has **two separate components** that serve different purposes:

### 1. MCP Server (for MCP protocol clients)
- **Location**: `/mcp/`
- **Purpose**: Exposes tools via MCP protocol for AI assistants/clients
- **When to use**: When integrating with Claude Desktop, Cursor, or other MCP clients
- **How to run**: `cd mcp && npm start` (communicates via stdio)

### 2. Next.js API Route (for HTTP requests)
- **Location**: `/app/api/recommend/route.ts`
- **Purpose**: REST API endpoint for restaurant recommendations
- **When to use**: When making HTTP requests from web apps, mobile apps, or curl
- **How to run**: `npm run dev` (runs on http://localhost:3000)

## 🚨 Current Issue

The errors you're seeing (`Unexpected end of JSON input`) are because:
- The MCP server is running and listening on stdio
- It's receiving terminal input instead of proper MCP protocol messages
- The MCP server and Next.js API route are **completely separate** - you should NOT run both at the same time

## ✅ Solution: Use the Next.js API Route

Since you want to use `curl` to make HTTP requests, you need to:

### Step 1: Stop the MCP Server
Press `Ctrl+C` in the terminal where the MCP server is running.

### Step 2: Install Dependencies (if not done)
```bash
# Install Next.js dependencies
npm install

# Also ensure MCP services are built (for Next.js to import)
cd mcp
npm install
npm run build
cd ..
```

### Step 3: Start Next.js Dev Server
```bash
npm run dev
```

You should see:
```
▲ Next.js 14.x.x
- Local:        http://localhost:3000
```

### Step 4: Make Your Request
In a **new terminal** (not the one running Next.js), run:

```bash
curl -X POST http://localhost:3000/api/recommend \
  -H "Content-Type: application/json" \
  -d '{
    "locationText": "Midtown Manhattan",
    "budget": "mid",
    "dietary": ["no pork"],
    "maxLunchMinutes": 35
  }'
```

### Expected Response
```json
{
  "context": {
    "resolvedLocation": { "lat": 40.7549, "lng": -73.9840, "address": "..." },
    "weatherSummary": { "tempC": 15, "condition": "Clear", "isRainy": false, ... },
    "holiday": { "isHoliday": false }
  },
  "lunch": [
    {
      "name": "Restaurant Name",
      "why": ["Highly rated", "Quick service"],
      "suggestedDishes": ["Dish 1", "Dish 2"],
      "etaMinutes": 10,
      "websiteUrl": "...",
      "mapsUrl": "...",
      "placeId": "ChIJ..."
    }
  ],
  "dinner": [...]
}
```

## Troubleshooting

### Error: "Cannot find module"
- Make sure you've run `npm install` in the root directory
- Make sure you've built the MCP services: `cd mcp && npm run build`

### Error: "GOOGLE_MAPS_API_KEY is required"
- Make sure you have a `.env` file in the root directory
- Copy from `env.example`: `cp env.example .env`
- Add your API key: `GOOGLE_MAPS_API_KEY=your_key_here`

### Error: Port 3000 already in use
- Stop any other Next.js processes: `lsof -ti:3000 | xargs kill`
- Or use a different port: `PORT=3001 npm run dev`

## Remember

- **For HTTP API requests (curl, web apps)**: Use Next.js (`npm run dev`)
- **For MCP protocol (AI assistants)**: Use MCP server (`cd mcp && npm start`)
- **Never run both at the same time** - they serve different purposes!
