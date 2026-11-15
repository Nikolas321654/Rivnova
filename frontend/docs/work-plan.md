# Frontend Work Plan

## Shared Foundation
Owner: TBD
Branch: chore/frontend-scaffold

- React + Vite + TypeScript
- Router and app layout
- API client and shared types
- Theme and reusable UI components
- Consistent mock-data strategy

## Person A. Field Management
Branch: feature/field-management

Owns:
- widgets/field-map
- widgets/field-sidebar
- features/create-field
- features/draw-field
- features/import-geojson

Deliverables:
- Display and select fields on map
- Show synchronized field catalog
- Create fields using polygon or GeoJSON
- Submit name, cropType, plantedAt, boundary

## Person B. Field Analytics
Branch: feature/field-dashboard

Owns:
- widgets/field-dashboard
- entities/agro-analysis
- Dashboard-specific UI components

Deliverables:
- Display field metrics and time series
- Show irrigation recommendations
- Show workability and stress statuses
- Show biomass anomaly information

## Integration Contract

- Field selection uses a shared fieldId.
- Dashboard reads fieldId and loads its own data.
- API types follow docs/api.md.
- Shared files are changed only through agreed PRs.
- Features must work with mock data when API is unavailable.

## Definition of Done

- Feature works end to end
- No TypeScript or lint errors
- Loading/error/empty states handled
- No conflicting API types or duplicate shared components
- PR reviewed before merge

## API Integration Ownership

### Person A. Fields & Map

Responsible for integrating:
- `GET /api/fields`
- `POST /api/fields`
- `GET /api/fields/{id}`
- `DELETE /api/fields/{id}`

### Person B. Field Dashboard & Analytics

Responsible for integrating:
- `GET /api/fields/{id}/dashboard`
- `GET /api/fields/{id}/workability`
- `GET /api/fields/{id}/stress`
- `GET /api/fields/{id}/biomass`

### Shared / Development Only

- `GET /health` — backend health check.
- `GET /api/test/nasa/{scenario}` — diagnostic endpoint for NASA mock scenarios.

These endpoints do not require dedicated UI features.

### Integration Rules

- Person A owns field API integration; Person B may reuse field queries.
- Person B owns analytics API integration.
- Use shared TypeScript types matching backend responses.
- Do not duplicate API hooks or HTTP requests across modules.
- Use `fieldId` to connect field selection with the dashboard.
- Use `docs/api.md` as the planned contract and verify actual responses against the running backend.
- Do not implement P1/P2 endpoints until they are available.
## Integration correction — 2026-11-15

Subsequently approved additions extend the original MVP: Demo Farmer cookie authentication, field create/edit/delete, Action Center with independent machinery and spraying alerts and feedback, seven-day ONNX soil forecast, Yield Prediction and Crop Rotation Advisor are integrated. Original scope sections describe historical decisions, not restrictions on these approved features. Ownership and CSRF checks remain enforced.

Open-Meteo supplies precipitation forecasts; MOCK_FIXTURE forecasts are simulated. Missing forecasts never mean zero rain. Nullable JSON fields may be omitted. `sprayingSafe`, `rainForecast24hMm`, `rainForecast24To48hMm` and `forecastSource` are optional nullable response fields. `rainLast12hMm`, `rainLast24hMm` and dashboard `currentMetrics.precipitationMm24h` are now optional nullable numbers. Live NASA POWER daily observations remain historical, dated by `timeSeries.date`; they do not supply recent rainfall. Machinery status can now be `Unknown`. Missing recent rainfall cannot establish safety. No active alerts does not establish safe conditions.

## Seasonal visual history — implemented

Field Insights uses a dedicated History API independently from decision and ML queries. History options are **14 days**, **30 days**, **This season** (default). URL `days=14` / `days=30` / `days=season` is preserved when switching fields; an absent or invalid value means season.

Season starts at `plantedAt`. Future planting shows an empty state. Seasons older than the 366-calendar-day API range are visibly truncated. Short views select the latest 14/30 actual records from the supported window (fewer when unavailable). History requests use range-, field- and period-specific TanStack Query keys, one-hour stale time and AbortSignal; no previous field or period data is presented as current. The server cache shares identical provider ranges across periods.

Charts retain observation dates, adaptive tick spacing, null gaps and separate dashed ONNX forecasts. History source is disclosed separately from dashboard source. Fixture history is limited to existing fixture dates. No custom date-range picker or changes to agronomic/ONNX windows were introduced.
