# Rivnova

Rivnova helps farmers monitor their fields and make informed day-to-day decisions. It combines satellite observations and weather forecasts with field analytics, alerts, and machine-learning predictions for irrigation, crop stress, and yield.

## Table of Contents

- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Demo](#demo)
- [Getting Started](#getting-started)

## Key Features

- Manage fields and view field-specific conditions and history.
- Monitor satellite observations and weather forecasts.
- Get actionable irrigation, crop stress, and field-work alerts.
- Explore soil moisture and crop yield predictions.
- Try public demo fields without signing in; Google sign-in is available for personal fields.

## Technology Stack

- **Frontend:** React, TypeScript, Vite, Leaflet
- **Backend:** .NET 10, ASP.NET Core Minimal APIs
- **Data:** PostgreSQL, PostGIS, Entity Framework Core
- **Forecasting:** ONNX Runtime, NASA data, Open-Meteo

## Demo

Start the app locally to explore the seeded demo fields and features. The frontend is available at `http://localhost:5173` after startup.

## Getting Started

### Requirements

- .NET 10 SDK
- Node.js and npm
- Docker

### Run locally

1. Start PostgreSQL with PostGIS:

   ```bash
   cd backend
   docker compose up -d
   ```

2. In a separate terminal, start the API. It applies database migrations and seeds demo fields on startup.

   ```bash
   cd backend
   dotnet run --project src/FarmFlow.Api --launch-profile http
   ```

   The API runs at `http://localhost:5000`. In Development, API documentation is available at `http://localhost:5000/scalar/v1`.

3. In another terminal, start the frontend:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   Open the URL printed by Vite (usually `http://localhost:5173`). The frontend proxies API requests to the local backend.

Google sign-in requires OAuth credentials. Configure them using the settings in `backend/.env.example`; demo mode can be used without Google OAuth. OpenStreetMap tiles are used by default, and a MapTiler key is optional.
