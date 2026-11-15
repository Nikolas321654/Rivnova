# FarmFlow NASA — REST API Specification

> **Base URL (Local Development):** `http://localhost:5000`
> **Interactive OpenAPI UI (Scalar):** `http://localhost:5000/scalar/v1`
> **Content-Type:** `application/json` (UTF-8)
> **Spatial Coordinates Standard:** GeoJSON (`RFC 7946`, WGS 84 / SRID `4326`). Note that GeoJSON coordinate tuples follow `[longitude, latitude]` order, while explicit scalar fields (`centroidLat`, `centroidLon`) are labeled explicitly for frontend convenience.

---

## 1. Enumerations & Shared Conventions

### `CropType`
`"Wheat"` | `"Corn"` | `"Sunflower"` | `"Soy"`

### `WorkabilityStatus`
- `"Optimal"` (🟢 Safe for machinery and spraying)
- `"Marginal"` (🟡 Elevated surface moisture; machinery traction caution)
- `"Blocked"` (🔴 High soil compaction or agrochemical washout risk)

Future periods in `forecast48h` can also be `"Unknown"`: the rain forecast was unavailable, so the period is neither safe nor blocked.

### `AlertSeverity`
`"Critical"` | `"Warning"` | `"Info"`

### `AlertType`
`"SmartIrrigation"` | `"Predictive72hStress"` | `"BiomassAnomaly"` | `"SprayingBlocked"` | `"WorkabilityBlocked"` | `"WorkabilityMarginal"`

---

## Authentication, Session Cookies, CSRF & User Profile (`Features/Auth`, `Features/Users`)

> **Frontend Integration Model:** Prefer a same-origin proxy (e.g., `/api/*` forwarded to the backend) so `HttpOnly` session cookies and CSRF tokens work reliably across browsers without third-party cookie restrictions. If cross-origin requests are used during development or split hosting, send `credentials: "include"`, add the exact frontend origin to `Cors:AllowedOrigins` (wildcard `*` is disallowed with credentials), and include the anti-forgery header on every state-changing request (`POST`, `PATCH`, `DELETE`).
>
> **Auth Error Semantics:**
> - `401 Unauthorized` — Guest / expired session on an endpoint requiring sign-in (`POST /api/fields`, `DELETE /api/fields/{id}`, `PATCH /api/users/me`, `POST /api/alerts/{id}/feedback`).
> - `403 Forbidden` — Authenticated user attempting a prohibited action (e.g., deleting a shared demo field) or missing/invalid CSRF token.
> - `404 Not Found` — Missing resource **or** private field owned by another user / ownerless non-demo row (prevents ID enumeration).

### `GET /api/auth/google`
Starts the server-side Google OAuth 2.0 login flow and redirects to Google.
- **Query Params:** `returnUrl` *(optional)* — validated against relative local paths or configured `Auth:AllowedRedirectOrigins`; unsafe/external URLs fall back to the default frontend URL (open-redirect protection).
- **Response:** `302 Found` redirect to Google OAuth consent screen.

### `GET /api/auth/google/callback`
Server-side OAuth callback configured in Google Cloud Console (`Authorized redirect URIs`). Exchanges the authorization code server-side, looks up or creates the `User` by Google **`sub`** (`GoogleSubjectId`), sets the persistent `HttpOnly` session cookie, and redirects back to the validated `returnUrl`.
- **Profile Sync Rules:** First login initializes `GoogleDisplayName`, `Email`, and `AvatarUrl` (`CustomDisplayName = null`). Repeat logins refresh `Email`, `GoogleDisplayName`, and `AvatarUrl` without ever overwriting `CustomDisplayName`.

### `GET /api/auth/csrf`
Issues a fresh CSRF token pair (sets the anti-forgery cookie and returns the request token for SPA clients).

#### Response `200 OK`
```json
{
  "headerName": "X-CSRF-TOKEN",
  "token": "CfDJ8..."
}
```

### `GET /api/auth/me`
Returns the current session and effective profile without failing for guests.

#### Response `200 OK` (Guest)
```json
{
  "authenticated": false,
  "user": null
}
```

#### Response `200 OK` (Signed-In User)
```json
{
  "authenticated": true,
  "user": {
    "id": "9f8c1d7e-3b45-4c2e-9a12-7e6f5d4c3b2a",
    "displayName": "Olena Kovalenko",
    "email": "olena.kovalenko@gmail.com",
    "avatarUrl": "https://lh3.googleusercontent.com/...",
  "isDemoAccount": false,
    "isDemoAccount": false
  }
}
```
*(Note: `displayName` resolves to `CustomDisplayName ?? GoogleDisplayName`.)*

### `POST /api/auth/logout`
Clears the persistent session cookie (`HttpOnly`). Requires a valid `X-CSRF-TOKEN` header.
- **Response:** `204 No Content` (idempotent when already signed out).

### `POST /api/auth/demo`
Starts an isolated **Demo Farmer** session without Google OAuth. Requires a valid `X-CSRF-TOKEN` header and is enabled by `Auth:EnableDemoLogin`.

- Each call from a browser without a session creates a new user (`displayName` `"Demo Farmer"`, `email` `"demo@farmflow.local"`, `isDemoAccount: true`) and signs it in with the same persistent `HttpOnly` cookie as a Google session. Fields created in this session are private to that demo user; other users, including other demo sessions, never see them.
- If the browser already has a valid session, that session is returned unchanged.
- Logout works the same as for Google sessions (`POST /api/auth/logout`).

#### Responses
- `200 OK` with the same body as the signed-in `GET /api/auth/me` response.
- `403 Forbidden` when the CSRF token is missing or invalid.
- `404 Not Found` when demo login is disabled on the server.

### `PATCH /api/users/me`
Updates the authenticated user's `CustomDisplayName`. Requires authentication (`401 Unauthorized` if guest) and valid `X-CSRF-TOKEN`. Email, `AvatarUrl`, and `GoogleSubjectId` are read-only and cannot be mutated by clients.

#### Request Body
```json
{
  "displayName": "Olena (Cherkasy Farm)"
}
```
- **Validation:** Trims leading/trailing whitespace; must be non-empty and within `1..100` characters (`400 Bad Request` `ProblemDetails` on invalid input).

#### Response `200 OK`
```json
{
  "id": "9f8c1d7e-3b45-4c2e-9a12-7e6f5d4c3b2a",
  "displayName": "Olena (Cherkasy Farm)",
  "email": "olena.kovalenko@gmail.com",
  "avatarUrl": "https://lh3.googleusercontent.com/..."
}
```

---

## 2. Field Management Endpoints (`Features/Fields`)

### 2.1 `GET /api/fields`
Returns the visible catalog of fields with summary status badges so the map sidebar and polygon borders can render immediately (`P0-1`, `P0-2`, `P0-10`).
- **Visibility Filtering (enforced in SQL before NASA/summary lookups):**
  - **Guest:** Returns only public demo fields (`IsDemo = true`).
  - **Signed-In User:** Returns public demo fields plus the user's own private fields (`IsDemo = true || OwnerId == currentUserId`).
  - Ownerless non-demo records (`IsDemo = false && OwnerId == null`) and other users' private fields are never returned.

#### Response `200 OK`
```json
[
  {
    "id": "11111111-1111-1111-1111-111111111111",
    "name": "Field #1 — Central Wheat",
    "cropType": "Wheat",
    "plantedAt": "2026-09-05",
    "areaHectares": 142.8,
    "centroidLat": 48.4512,
    "centroidLon": 31.1824,
    "workabilityStatus": "Optimal",
    "hasActiveStressAlert": false,
    "hasBiomassAnomaly": false,
    "boundary": {
      "type": "Polygon",
      "coordinates": [
        [
          [31.175, 48.448],
          [31.190, 48.448],
          [31.190, 48.455],
          [31.175, 48.455],
          [31.175, 48.448]
        ]
      ]
    }
  }
]
```

---

### 2.2 `POST /api/fields`
Creates a new private field from an interactive map polygon or uploaded GeoJSON (`P0-1`, `P0-10`). The backend automatically computes `areaHectares` and the geographic centroid (`centroidLat`, `centroidLon`).
- **Auth & CSRF Required:** Requires signed-in Google session cookie (`401 Unauthorized` if guest) and valid `X-CSRF-TOKEN` header.
- **Server-Enforced Ownership:** The backend unconditionally assigns `OwnerId = currentUserId` and `IsDemo = false`, ignoring any client-supplied ownership or demo flags.

#### Request Body
```json
{
  "name": "Field #5 — South Valley",
  "cropType": "Corn",
  "plantedAt": "2026-05-10",
  "boundary": {
    "type": "Polygon",
    "coordinates": [
      [
        [30.512, 49.210],
        [30.528, 49.210],
        [30.528, 49.222],
        [30.512, 49.222],
        [30.512, 49.210]
      ]
    ]
  }
}
```

#### Response `201 Created`
Returns the created field object (same schema as `GET /api/fields/{id}`).

---

### 2.3 `GET /api/fields/{id}`
Returns metadata and geometry for a single accessible field (`IsDemo == true` or `OwnerId == currentUserId`).

#### Response `200 OK`
Same object structure as an item in `GET /api/fields`. Returns `404 Not Found` if `id` does not exist, is an ownerless non-demo field, or belongs to another user.

---

### 2.4 `DELETE /api/fields/{id}`
Deletes a private user-owned field from the catalog. Requires signed-in Google session cookie and valid `X-CSRF-TOKEN`.

#### Responses
- `204 No Content` — Private field deleted successfully.
- `401 Unauthorized` — Unauthenticated guest request.
- `403 Forbidden` — Attempted deletion of a shared public demo field (`IsDemo == true`).
- `404 Not Found` — Field does not exist or belongs to another user.

### 2.5 `PATCH /api/fields/{id}`
Updates a private user-owned field. Requires a signed-in session and a valid `X-CSRF-TOKEN`. Every property is optional, but at least one must be present; omitted properties keep their value.

#### Request Body
```json
{
  "name": "River Plot",
  "cropType": "Wheat",
  "plantedAt": "2026-04-01",
  "boundary": { "type": "Polygon", "coordinates": [[[30.60, 49.30], [30.6135, 49.30], [30.6135, 49.309], [30.60, 49.309], [30.60, 49.30]]] }
}
```

A new `boundary` goes through the same validation as `POST /api/fields`; the backend recalculates the centroid and area.

#### Responses
- `200 OK` with the updated field summary (same shape as `GET /api/fields/{id}`).
- `400 Bad Request` with validation problems (empty request, empty name, unknown crop, invalid boundary).
- `401 Unauthorized` for guests.
- `403 Forbidden` for shared demo fields (`"Demo fields cannot be modified."`) or a missing CSRF token.
- `404 Not Found` when the field does not exist or belongs to another user.

---

## 3. Agro Analytics & Satellite Monitoring (`Features/AgroAnalytics`)

> **Field Access Control (Applies to `/dashboard`, `/workability`, `/stress`, `/biomass`, and future `/predictions/*`):** Every field analytics endpoint validates field visibility (`IsDemo == true || OwnerId == currentUserId`) in PostgreSQL **before** calling `INasaClient` or computing formulas. Requests targeting inaccessible private fields (as a guest or another user) return `404 Not Found`.

### 3.1 `GET /api/fields/{id}/dashboard`
Unified endpoint returning the 14–30 day NASA satellite time-series (`P0-3`), all 4 deterministic agronomic evaluations (`P0-5` to `P0-8`), and sustainability impact KPIs (`P2-2`) in a single request.

#### Query Parameters
- `days` (optional, `int`, default `14`, max `30`): Number of historical days to include in `timeSeries`.

#### Response `200 OK`
```json
{
  "fieldId": "22222222-2222-2222-2222-222222222222",
  "fieldName": "Field #2 — North Corn",
  "cropType": "Corn",
  "areaHectares": 96.4,
  "dataSource": "NASA_POWER_LIVE",
  "lastUpdatedUtc": "2026-11-09T00:00:00Z",
  "currentMetrics": {
    "precipitationMm24h": 0.4,
    "accumulatedPrecipitationMm30d": 28.5,
    "surfaceSoilMoisture": 0.21,
    "rootzoneSoilMoisture": 0.19,
    "solarRadiation": 16.8,
    "ndvi": 0.74,
    "evaporativeStressIndex": 0.32
  },
  "workability": {
    "status": "Optimal",
    "sprayingSafe": true,
    "rainLast12hMm": 0.0,
    "rainLast24hMm": 0.4,
    "rainForecast24hMm": 1.2,
    "rainForecast24To48hMm": 0.5,
    "forecastSource": "MOCK_FIXTURE",
    "surfaceMoisture": 0.21,
    "recommendation": "Soil bearing capacity is optimal and washout risk is low. Safe for machinery and fertilizer/pesticide application."
  },
  "stressAndIrrigation": {
    "waterDeficitIndex": 0.758,
    "isHiddenStressDetected": true,
    "severity": "Warning",
    "irrigationRecommended": true,
    "recommendedIrrigationMm": 22.0,
    "recommendedWindowHours": 36,
    "recommendation": "Warning: Hidden water stress detected (WDI 0.76 while NDVI remains stable at 0.74). Recommended irrigation of 22 mm within 36 hours to prevent turgor loss."
  },
  "biomass": {
    "currentNdvi": 0.74,
    "ndvi14DayAvg": 0.75,
    "deltaNdvi": -0.01,
    "deltaPercent": -1.3,
    "isAnomalyDetected": false,
    "recommendation": "Biomass growth trajectory is within normal seasonal bounds."
  },
  "impactMetrics": {
    "estimatedWaterSavedM3PerHa": 65.0,
    "preventedRunoffRisk": true,
    "earlyWarningLeadTimeDays": 4
  },
  "timeSeries": [
    {
      "date": "2026-10-27",
      "precipitationMm": 3.2,
      "surfaceMoisture": 0.31,
      "rootzoneMoisture": 0.38,
      "solarRadiation": 14.2,
      "ndvi": 0.76,
      "esi": 0.61
    },
    {
      "date": "2026-10-28",
      "precipitationMm": 0.0,
      "surfaceMoisture": 0.28,
      "rootzoneMoisture": 0.35,
      "solarRadiation": 15.9,
      "ndvi": 0.75,
      "esi": 0.54
    }
  ]
}
```

---

### 3.2 `GET /api/fields/{id}/workability`
Focused endpoint for the **Field Workability Window & Spraying Advisor** (`P0-6`).

#### Observations and weather forecast
- Surface moisture is a **historical NASA POWER observation** (or a sample fixture for demo fields). NASA POWER lags several days, so for live fields `rainLast12hMm` and `rainLast24hMm` are Open-Meteo's modelled precipitation for the 12 and 24 hours before the current UTC hour, with `recentRainSource: "OPEN_METEO_FORECAST"`. They are estimates, not measurements on the field. When those hours are unavailable both values and `recentRainSource` are `null`, and today's status is `"Unknown"`.
- `rainForecast24hMm` (next 24 hours) and `rainForecast24To48hMm` (the following 24 hours) come from a **separate weather forecast**: Open-Meteo hourly precipitation for the field centroid, summed from the current UTC hour (`forecastSource: "OPEN_METEO_FORECAST"`). Demo fields use fixture values (`"MOCK_FIXTURE"`). The forecast is cached for up to 60 minutes per rounded coordinate and hour (`WeatherForecast` settings: `Enabled`, `BaseUrl`, `TimeoutSeconds`, `CacheMinutes`).
- When the forecast provider fails, times out, returns incomplete hours or is disabled, both forecast values and `forecastSource` are `null`. A missing forecast is never reported as `0` mm.
- With a missing forecast, `sprayingSafe` is `null` (safety cannot be confirmed) unless observed heavy rain already makes it `false`, the future periods are `"Unknown"` with reason `"Rain forecast unavailable"`, and the recommendation says spraying safety cannot be confirmed. Today's machinery status uses observations only.
- The same fields appear in the `workability` object of `GET /api/fields/{id}/dashboard`.

#### Response `200 OK`
```json
{
  "fieldId": "33333333-3333-3333-3333-333333333333",
  "status": "Blocked",
  "sprayingSafe": false,
  "rainLast12hMm": 11.4,
  "rainLast24hMm": 14.2,
  "rainForecast24hMm": 6.8,
  "rainForecast24To48hMm": 1.1,
  "forecastSource": "OPEN_METEO_FORECAST",
  "surfaceMoisture": 0.44,
  "forecast48h": [
    { "period": "Today", "status": "Blocked", "reason": "11.4 mm rain in last 12h + surface moisture 0.44" },
    { "period": "Next 24h", "status": "Blocked", "reason": "6.8 mm precipitation forecast (chemical washout risk)" },
    { "period": "24h–48h", "status": "Marginal", "reason": "Surface drying in progress; moderate wheel slip risk" }
  ],
  "recommendation": "Blocked: High risk of nitrogen/fungicide washout and topsoil compaction by heavy machinery."
}
```

---

### 3.3 `GET /api/fields/{id}/stress`
Focused endpoint for **Early Thermal & Stress Detection + Smart Irrigation Calculator** (`P0-5`, `P0-7`).

#### Response `200 OK`
```json
{
  "fieldId": "22222222-2222-2222-2222-222222222222",
  "waterDeficitIndex": 0.758,
  "threshold": 0.65,
  "rootzoneMoisture": 0.19,
  "cropTargetMoisture": 0.55,
  "evaporativeStressIndex": 0.32,
  "ndviCurrent": 0.74,
  "isHiddenStressDetected": true,
  "irrigationRecommended": true,
  "recommendedIrrigationMm": 22.0,
  "recommendedWindowHours": 36,
  "recommendation": "Field #2: Recommended irrigation dose of 22 mm within 36 hours to prevent turgor loss."
}
```

---

### 3.4 `GET /api/fields/{id}/biomass`
Focused endpoint for the **Vegetation Anomaly Scout** (`P0-8`).

#### Response `200 OK`
```json
{
  "fieldId": "44444444-4444-4444-4444-444444444444",
  "currentNdvi": 0.58,
  "ndvi14DayAvg": 0.71,
  "deltaNdvi": -0.13,
  "deltaPercent": -18.3,
  "rootzoneMoisture": 0.46,
  "isDroughtPresent": false,
  "isAnomalyDetected": true,
  "recommendation": "Field #4: Biomass index dropped by 18.3% while soil moisture is optimal (0.46). Potential localized pest, disease, or weed outbreak — scout inspection required."
}
```

---

## 4. AI/ML & Deep Learning Predictions (`Features/Predictions`)

### 4.1 `GET /api/fields/{id}/predictions/soil-forecast`
Runs in-process inference on the **PyTorch LSTM / 1D-CNN ONNX model** (`soil_forecast.onnx`) using the past 14 days of NASA observations to forecast the next 7 days of rootzone moisture and evapotranspiration (`P1-1`), and computes the **72-hour proactive stress warning** (`P1-2`).

#### Response `200 OK`
```json
{
  "fieldId": "11111111-1111-1111-1111-111111111111",
  "modelName": "soil_forecast.onnx",
  "proactive72hStressWarning": true,
  "forecastedDay3WaterDeficitIndex": 0.69,
  "proactiveRecommendation": "AI Forecast Warning: Rootzone moisture is projected to drop to 0.22 in 72 hours (WDI 0.69). Schedule preventive irrigation within 48 hours.",
  "forecastSeries": [
    {
      "date": "2026-11-10",
      "dayOffset": 1,
      "predictedRootzoneMoisture": 0.27,
      "predictedEsi": 0.44,
      "predictedWaterDeficitIndex": 0.662
    },
    {
      "date": "2026-11-11",
      "dayOffset": 2,
      "predictedRootzoneMoisture": 0.24,
      "predictedEsi": 0.40,
      "predictedWaterDeficitIndex": 0.696
    },
    {
      "date": "2026-11-12",
      "dayOffset": 3,
      "predictedRootzoneMoisture": 0.22,
      "predictedEsi": 0.38,
      "predictedWaterDeficitIndex": 0.716
    }
  ]
}
```

---

### 4.2 `GET /api/fields/{id}/predictions/yield`
Runs in-process inference on the **Tabular ML ONNX Regressor** (`yield_model.onnx`) to estimate end-of-season harvest yield based on seasonal precipitation, soil moisture, peak NDVI, and stress day count (`P1-3`).

#### Response `200 OK`
```json
{
  "fieldId": "11111111-1111-1111-1111-111111111111",
  "cropType": "Wheat",
  "modelName": "yield_model.onnx",
  "predictedYieldTonsPerHa": 5.84,
  "estimatedTotalHarvestTons": 833.95,
  "regionalBaselineTonsPerHa": 5.20,
  "deltaVsBaselinePercent": 12.3,
  "featuresUsed": {
    "accumulatedPrecipMm30d": 42.0,
    "avgRootzoneMoisture30d": 0.41,
    "peakNdvi30d": 0.79,
    "stressDaysCount30d": 1
  }
}
```

---

### 4.3 `GET /api/fields/{id}/rotation-advisor`
Ranks next-season crops for the field. Each candidate gets an ONNX yield prediction from the last 30 days of field signals, a water-fit score against its target rootzone moisture and a soil-health score for rotating from the current crop. Results are model-based planning estimates, not guarantees.

#### Query Parameters
- `priority` (optional): `Balanced` (default), `WaterConservation`, `MaxYield` or `SoilHealth`. It changes the weights of the yield, water and soil scores.

#### Response `200 OK`
```json
{
  "fieldId": "22222222-2222-2222-2222-222222222222",
  "fieldName": "Field #2 — North Corn",
  "currentCropType": "Corn",
  "priority": "Balanced",
  "observedRootzoneMoisture30d": 0.304,
  "recommendedNextCrop": "Soy",
  "rankedOptions": [
    {
      "cropType": "Soy",
      "overallScore": 81.4,
      "predictedYieldTonsPerHa": 2.61,
      "regionalBaselineTonsPerHa": 2.40,
      "waterFitScore": 50.0,
      "soilHealthScore": 95.0,
      "yieldScore": 63.1,
      "isRecommendedNext": true,
      "rationale": "Legume fixes atmospheric nitrogen and restores soil fertility. Moisture deficit of 0.20 below Soy target (0.50). Estimated yield: 2.61 t/ha (baseline 2.40 t/ha)."
    }
  ]
}
```

`rankedOptions` lists every crop, best first; exactly one has `isRecommendedNext: true`. Returns `404 Not Found` for inaccessible fields.

---

## 5. Prioritized Alerts & Feedback Loop (`Features/Alerts`)

### 5.1 `GET /api/alerts`
Returns all active task cards and warnings across all fields, sorted by severity (`Critical` $\rightarrow$ `Warning` $\rightarrow$ `Info`) for the main Action Center (`P1-4`).

- **Visibility:** Uses the same access rules as `GET /api/fields`. Guests receive alerts for public demo fields only; signed-in users receive alerts for demo fields and their own fields. An empty array is returned when no fields are accessible.
- **Ordering:** Severity first, then `fieldName`, then `alertType` (ordinal).
- **Identifiers:** `id` is deterministic, derived from a SHA-256 hash of `fieldId` and `alertType`, so the same alert keeps its id between requests.
- **Feedback:** `userFeedbackAccurate` is the current user's latest answer for the same `fieldId` and `alertType`, or `null`. Feedback is private: guests always get `null`, and on shared demo fields each user only sees their own answer.
- **Data source:** `dataSource` is the `DataSource` of the satellite series the alert was evaluated from: `NASA_POWER_LIVE` for live NASA POWER data, `MOCK_FIXTURE` for demo scenarios or the mock fallback.
- **Number formatting:** Numbers in `title` and `message` always use a dot as the decimal separator (invariant culture), and percentages show one decimal place.

#### Alert generation rules (actual backend behavior)

| `alertType` | Raised when | `severity` |
| :--- | :--- | :--- |
| `SmartIrrigation` | Irrigation is recommended or hidden water stress is detected | Stress severity; `Info` is promoted to `Warning` |
| `Predictive72hStress` | The ONNX soil forecast projects a Day +3 WDI above `0.65` | `Critical` above `0.78`, otherwise `Warning` |
| `BiomassAnomaly` | The vegetation anomaly scout detects an unusual NDVI drop | `Warning` |
| `SprayingBlocked` | Spraying is not safe (`sprayingSafe` is `false`): heavy rain in the last 12h or at least 5 mm forecast in the next 24h | `Warning` if workability is also `Blocked`, otherwise `Info` |
| `WorkabilityBlocked` | Machinery workability is `Blocked` | `Warning` |
| `WorkabilityMarginal` | Machinery workability is `Marginal` | `Info` |

Spraying and machinery are independent: a blocked field with unsafe spraying gets both `SprayingBlocked` and `WorkabilityBlocked`, each with its own id. An unknown spraying safety (`sprayingSafe: null`) raises no spraying alert. Until 2026-11-15 a single `SprayingBlocked` alert covered both cases; stored feedback for that type now maps to the spraying alert only.

#### Response `200 OK`
```json
[
  {
    "id": "a1111111-1111-1111-1111-111111111111",
    "fieldId": "22222222-2222-2222-2222-222222222222",
    "fieldName": "Field #2 — North Corn",
    "alertType": "SmartIrrigation",
    "severity": "Critical",
    "title": "Hidden Water Stress — Preventive Irrigation Needed",
    "message": "Field #2: Recommended irrigation dose of 22 mm within 36 hours to prevent turgor loss.",
    "createdAtUtc": "2026-11-09T01:00:00Z",
    "dataSource": "NASA_POWER_LIVE",
    "userFeedbackAccurate": null
  },
  {
    "id": "a2222222-2222-2222-2222-222222222222",
    "fieldId": "44444444-4444-4444-4444-444444444444",
    "fieldName": "Field #4 — East Sunflower",
    "alertType": "BiomassAnomaly",
    "severity": "Warning",
    "title": "Localized Biomass Drop (-18.3%)",
    "message": "Field #4: NDVI dropped by 18.3% while soil moisture is optimal. Dispatch field scout to check for pests or disease.",
    "createdAtUtc": "2026-11-09T01:00:00Z",
    "dataSource": "NASA_POWER_LIVE",
    "userFeedbackAccurate": null
  }
]
```

---

### 5.2 `POST /api/alerts/{id}/feedback`
Records the signed-in user's confirmation or dismissal of an alert (*"Was this warning accurate? Yes / No"*, `P2-1`). Requires a session and a valid `X-CSRF-TOKEN`.

- `id` must be the alert id from `GET /api/alerts`; it is checked against `fieldId` and `alertType`, so feedback can only be attached to the alert the user answered.
- `alertType` must be one of the `AlertType` values; `comment` is optional (up to 500 characters).
- The feedback is stored with the user's id and is only returned to that user. Submitting again records a newer answer, which then wins.

#### Responses
- `200 OK` with the body below.
- `400 Bad Request` for an empty or unknown `alertType` or a too long comment.
- `401 Unauthorized` for guests.
- `404 Not Found` when the field is not accessible or `id` does not match `fieldId` and `alertType`.

#### Request Body
```json
{
  "fieldId": "22222222-2222-2222-2222-222222222222",
  "alertType": "SmartIrrigation",
  "isAccurate": true,
  "comment": "Confirmed dry rootzone at 30cm depth."
}
```

#### Response `200 OK`
```json
{
  "feedbackId": "f9999999-9999-9999-9999-999999999999",
  "recordedAtUtc": "2026-11-09T02:20:00Z"
}
```

## Integration correction — 2026-11-15

Subsequently approved additions extend the original MVP: Demo Farmer cookie authentication, field create/edit/delete, Action Center with independent machinery and spraying alerts and feedback, seven-day ONNX soil forecast, Yield Prediction and Crop Rotation Advisor are integrated. Original scope sections describe historical decisions, not restrictions on these approved features. Ownership and CSRF checks remain enforced.

Open-Meteo supplies precipitation forecasts; MOCK_FIXTURE forecasts are simulated. Missing forecasts never mean zero rain. Nullable JSON fields may be omitted. `sprayingSafe`, `rainForecast24hMm`, `rainForecast24To48hMm` and `forecastSource` are optional nullable response fields. `rainLast12hMm`, `rainLast24hMm` and dashboard `currentMetrics.precipitationMm24h` are now optional nullable numbers. Live NASA POWER daily observations remain historical, dated by `timeSeries.date`; they do not supply recent rainfall. Machinery status can now be `Unknown`. Missing recent rainfall cannot establish safety. No active alerts does not establish safe conditions.

## Seasonal history

`GET /api/fields/{id}/history?from=YYYY-MM-DD&to=YYYY-MM-DD`

Public demo fields are readable by guests. Private fields require their owner; inaccessible fields return 404 before provider access. Both dates are required, inclusive, and must be within UTC today minus 365 days through today (maximum 366 calendar dates). Invalid, reversed, future or older ranges return 400. Provider failure returns 503, never an unlabelled fixture fallback.

Response: `fieldId` (UUID), `from`/`to` (ISO dates requested), `dataSource` (`NASA_POWER_LIVE` or `MOCK_FIXTURE`), optional `latestObservationDate` (ISO date; omitted when empty), and `timeSeries` (daily metric array using the dashboard metric contract). Empty ranges return an empty array. NASA precipitation, soil moisture and solar radiation are daily inputs; NDVI and ESI remain derived estimates. Incomplete days and unpublished trailing dates are omitted. Historical precipitation is never recent 12/24-hour rainfall.

Demo fields and explicitly configured ForceMock use only existing fixture dates, up to 30 records; no synthetic seasonal extension is generated. Live fields do not fall back to fixtures on failure.

Historical NASA cache keys include rounded coordinates and both dates. Completed ranges ending more than seven days ago are cached for seven days; recent ranges for six hours. Requests have cancellation and a timeout. Dashboard, alerts and ML calculation windows remain unchanged.
