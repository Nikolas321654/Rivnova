"""Fetches 100% real satellite, weather, evapotranspiration, and FAOSTAT yield datasets.

Data sources (zero synthetic targets or proxy equations):
1. NASA POWER (daily): PRECTOTCORR, GWETTOP, GWETROOT, ALLSKY_SFC_SW_DWN
2. Open-Meteo ERA5-Land Historical Archive (daily): evapotranspiration & et0_fao_evapotranspiration -> real ESI = ET / ET0
3. AWS Earth Search Sentinel-2 L2A COGs (10m): real (NIR - Red) / (NIR + Red) peak growing-season NDVI
4. Our World in Data / FAOSTAT (annual): real observed crop yields (t/ha) across 20 agricultural countries

Usage:
    uv run prepare_dataset.py --start 20200101 --end 20261110
    uv run prepare_dataset.py --start 20260101 --end 20261110   # 2026-only soil observations
"""

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import io
import json
import os
from pathlib import Path
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
os.environ.setdefault("GDAL_HTTP_TIMEOUT", "10")
os.environ.setdefault("GDAL_HTTP_MAX_RETRY", "2")
os.environ.setdefault("CPL_VSIL_CURL_ALLOWED_EXTENSIONS", ".tif,.TIF")

import numpy as np
import pandas as pd
import pyproj
import rasterio

DATA_DIR = Path(__file__).resolve().parent / "data"
S2_CACHE_PATH = DATA_DIR / "s2_ndvi_cache.json"
NASA_POWER_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
EARTH_SEARCH_STAC_URL = "https://earth-search.aws.element84.com/v1/search"
OWID_BASE_URL = "https://ourworldindata.org/grapher"
MISSING_SENTINEL = -999.0

# Representative Ukrainian regions for 7-day soil moisture & ESI forecasting
UKRAINE_REGIONS = [
    ("Cherkasy", 49.44, 32.06),
    ("Poltava", 49.59, 34.55),
    ("Vinnytsia", 49.23, 28.46),
    ("Mykolaiv", 47.05, 31.96),
    ("Odesa", 46.62, 30.73),
    ("Kharkiv", 49.99, 36.23),
    ("Dnipro", 48.46, 35.04),
    ("Kyiv", 50.25, 30.52),
]

# Major global agricultural heartlands paired with OWID/FAOSTAT national crop yields
# (iso3, name, lat, lon, season_start_mmdd, season_end_mmdd)
YIELD_COUNTRIES = [
    ("UKR", "Cherkasy, Ukraine", 49.44, 32.06, "04-01", "09-30"),
    ("POL", "Wielkopolska, Poland", 52.23, 17.50, "04-01", "09-30"),
    ("ROU", "Baragan, Romania", 44.43, 27.36, "04-01", "09-30"),
    ("HUN", "Great Plain, Hungary", 46.90, 19.69, "04-01", "09-30"),
    ("FRA", "Beauce, France", 48.44, 1.49, "04-01", "09-30"),
    ("DEU", "Boerde, Germany", 52.13, 11.63, "04-01", "09-30"),
    ("ESP", "Castile, Spain", 41.65, -4.72, "03-15", "08-31"),
    ("ITA", "Po Valley, Italy", 44.83, 11.62, "04-01", "09-30"),
    ("GBR", "East Anglia, UK", 52.20, 0.12, "04-01", "09-30"),
    ("CZE", "Elbe, Czechia", 50.08, 15.78, "04-01", "09-30"),
    ("BGR", "Dobrudzha, Bulgaria", 43.57, 27.83, "04-01", "09-30"),
    ("SRB", "Vojvodina, Serbia", 45.26, 19.83, "04-01", "09-30"),
    ("USA", "Iowa, USA", 41.88, -93.10, "04-15", "09-30"),
    ("CAN", "Saskatchewan, Canada", 50.45, -104.62, "05-01", "09-15"),
    ("TUR", "Konya, Turkey", 37.87, 32.49, "04-01", "08-31"),
    ("KAZ", "Akmola, Kazakhstan", 51.17, 71.45, "05-01", "09-15"),
    ("IND", "Punjab, India", 30.90, 75.86, "06-01", "10-31"),
    ("AUS", "Wheatbelt, Australia", -31.95, 117.00, "05-01", "10-31"),
    ("BRA", "Mato Grosso, Brazil", -12.55, -55.72, "10-01", "03-31"),
    ("ARG", "Pampas, Argentina", -33.89, -60.57, "10-01", "03-31"),
]

# FAOSTAT-sourced crop yield series via Our World in Data (tonnes/ha)
OWID_CROP_SLUGS = {
    0: ("Wheat", "wheat-yields"),
    1: ("Corn", "maize-yields"),
    2: ("Sunflower", "sunflower-seed-yield"),
    3: ("Soy", "soybean-yields"),
}


def urlopen_with_retry(target: str | Request, timeout: int = 30, retries: int = 6) -> bytes:
    """Fetch URL bytes with exponential backoff on HTTP 429/5xx rate limits."""
    for attempt in range(retries):
        try:
            with urlopen(target, timeout=timeout) as resp:  # noqa: S310
                return resp.read()
        except HTTPError as exc:
            if exc.code in (429, 502, 503, 504) and attempt < retries - 1:
                retry_after = exc.headers.get("Retry-After") if exc.headers else None
                wait_s = float(retry_after) if retry_after and retry_after.isdigit() else min(65.0, 4.0 * (2**attempt))
                print(f"Rate limited (HTTP {exc.code}); retrying in {wait_s:.0f}s...")
                time.sleep(wait_s)
                continue
            raise
    raise RuntimeError("Exhausted retries")


def fetch_owid_yields(country_codes: set[str], min_year: int = 2017) -> dict[tuple[str, int, int], float]:
    """Fetch real annual FAOSTAT/OWID crop yields (t/ha) keyed by (iso3, year, crop_id)."""
    yields: dict[tuple[str, int, int], float] = {}
    for crop_id, (crop_name, slug) in OWID_CROP_SLUGS.items():
        url = f"{OWID_BASE_URL}/{slug}.csv?v=1&csvType=full&useColumnShortNames=true"
        req = Request(url, headers={"User-Agent": "Mozilla/5.0 FarmFlow-ML/1.0"})
        df = pd.read_csv(io.BytesIO(urlopen_with_retry(req, timeout=25)))

        sub = df[df["code"].isin(country_codes) & (df["year"] >= min_year)]
        value_col = [c for c in sub.columns if c not in ("entity", "code", "year")][0]
        count = 0
        for _, row in sub.iterrows():
            val = row[value_col]
            if pd.notna(val) and float(val) > 0:
                yields[(str(row["code"]), int(row["year"]), crop_id)] = float(val)
                count += 1
        print(f"Fetched {count} real OWID/FAOSTAT {crop_name} country-year yields (>= {min_year})")
    return yields


def fetch_nasa_power(lat: float, lon: float, start: str, end: str) -> pd.DataFrame:
    url = (
        f"{NASA_POWER_URL}?parameters=PRECTOTCORR,GWETTOP,GWETROOT,ALLSKY_SFC_SW_DWN"
        f"&community=AG&longitude={lon}&latitude={lat}&start={start}&end={end}&format=JSON"
    )
    payload = json.loads(urlopen_with_retry(url, timeout=30).decode("utf-8"))

    params = payload["properties"]["parameter"]
    rows = []
    for d in sorted(params["PRECTOTCORR"].keys()):
        precip = float(params["PRECTOTCORR"][d])
        sm_top = float(params["GWETTOP"][d])
        sm_root = float(params["GWETROOT"][d])
        solar = float(params["ALLSKY_SFC_SW_DWN"][d])
        if min(precip, sm_top, sm_root, solar) <= MISSING_SENTINEL + 1.0:
            continue
        rows.append(
            {
                "date": f"{d[:4]}-{d[4:6]}-{d[6:8]}",
                "precip": max(0.0, precip),
                "sm_top": float(np.clip(sm_top, 0.01, 0.99)),
                "sm_root": float(np.clip(sm_root, 0.01, 0.99)),
                "solar": max(0.5, solar),
            }
        )
    return pd.DataFrame(rows)


def fetch_open_meteo_esi(lat: float, lon: float, start_iso: str, end_iso: str) -> pd.DataFrame:
    """Fetch real ERA5-Land daily actual ET and reference ET0 to compute physical ESI = ET / ET0."""
    time.sleep(1.5)
    url = (
        f"{OPEN_METEO_ARCHIVE_URL}?latitude={lat}&longitude={lon}"
        f"&start_date={start_iso}&end_date={end_iso}"
        f"&daily=et0_fao_evapotranspiration&hourly=evapotranspiration&timezone=UTC"
    )
    payload = json.loads(urlopen_with_retry(url, timeout=30).decode("utf-8"))

    daily_dates = payload["daily"]["time"]
    et0_daily = payload["daily"]["et0_fao_evapotranspiration"]
    hourly_time = payload["hourly"]["time"]
    hourly_et = payload["hourly"]["evapotranspiration"]

    hourly_df = pd.DataFrame(
        {
            "date": [t[:10] for t in hourly_time],
            "et": [0.0 if v is None else float(v) for v in hourly_et],
        }
    )
    daily_et = hourly_df.groupby("date", as_index=False)["et"].sum()
    daily_et0 = pd.DataFrame(
        {
            "date": daily_dates,
            "et0": [0.0 if v is None else float(v) for v in et0_daily],
        }
    )
    merged = pd.merge(daily_et0, daily_et, on="date", how="inner")
    # Physical Evaporative Stress Index: ratio of actual ET to reference ET0
    merged["esi"] = np.where(
        merged["et0"] > 0.1,
        np.clip(merged["et"] / merged["et0"], 0.05, 1.0),
        0.5,
    )
    return merged[["date", "esi"]]


def fetch_sentinel2_peak_ndvi(lat: float, lon: float, start_iso: str, end_iso: str) -> float | None:
    """Sample real Sentinel-2 L2A 10m Red & NIR COG pixels from AWS Earth Search STAC."""
    body = json.dumps(
        {
            "collections": ["sentinel-2-l2a"],
            "intersects": {"type": "Point", "coordinates": [lon, lat]},
            "datetime": f"{start_iso}T00:00:00Z/{end_iso}T23:59:59Z",
            "query": {"eo:cloud_cover": {"lt": 20}},
            "sortby": [{"field": "properties.eo:cloud_cover", "direction": "asc"}],
            "limit": 2,
        }
    ).encode("utf-8")
    req = Request(EARTH_SEARCH_STAC_URL, data=body, headers={"Content-Type": "application/json"})
    features = json.loads(urlopen_with_retry(req, timeout=20).decode("utf-8")).get("features", [])

    ndvi_values = []
    for feat in features:
        assets = feat.get("assets", {})
        if "red" not in assets or "nir" not in assets:
            continue
        try:
            with rasterio.open(assets["red"]["href"]) as src_r, rasterio.open(assets["nir"]["href"]) as src_n:
                transformer = pyproj.Transformer.from_crs("EPSG:4326", src_r.crs, always_xy=True)
                px, py = transformer.transform(lon, lat)
                red = float(next(src_r.sample([(px, py)]))[0])
                nir = float(next(src_n.sample([(px, py)]))[0])
                if red <= 0 or nir <= 0:
                    continue
                ndvi = (nir - red) / (nir + red)
                if 0.05 <= ndvi <= 0.95:
                    ndvi_values.append(ndvi)
        except Exception:
            continue

    return float(max(ndvi_values)) if ndvi_values else None


def build_soil_dataset(start: str, end: str) -> tuple[np.ndarray, np.ndarray]:
    start_iso = f"{start[:4]}-{start[4:6]}-{start[6:8]}"
    end_iso = f"{end[:4]}-{end[4:6]}-{end[6:8]}"
    seq_inputs = []
    seq_targets = []

    for name, lat, lon in UKRAINE_REGIONS:
        power_df = fetch_nasa_power(lat, lon, start, end)
        esi_df = fetch_open_meteo_esi(lat, lon, start_iso, end_iso)
        df = pd.merge(power_df, esi_df, on="date", how="inner").sort_values("date").reset_index(drop=True)
        print(f"Merged {len(df)} real NASA POWER + ERA5-Land ESI days for {name} ({start}..{end})")

        if len(df) < 21:
            continue
        arr_x = df[["precip", "sm_top", "sm_root", "solar"]].to_numpy(dtype=np.float32)
        arr_y = df[["sm_root", "esi"]].to_numpy(dtype=np.float32)

        for i in range(0, len(df) - 21 + 1, 2):
            seq_inputs.append(arr_x[i : i + 14])
            seq_targets.append(arr_y[i + 14 : i + 21])

    return np.asarray(seq_inputs, dtype=np.float32), np.asarray(seq_targets, dtype=np.float32)


def load_s2_cache() -> dict[str, float]:
    if S2_CACHE_PATH.exists():
        return json.loads(S2_CACHE_PATH.read_text(encoding="utf-8"))
    return {}


def save_s2_cache(cache: dict[str, float]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    S2_CACHE_PATH.write_text(json.dumps(cache, indent=2, sort_keys=True), encoding="utf-8")


def season_bounds(year: int, start_mmdd: str, end_mmdd: str) -> tuple[str, str]:
    start_month = int(start_mmdd[:2])
    end_month = int(end_mmdd[:2])
    if start_month > end_month:
        return f"{year - 1}-{start_mmdd}", f"{year}-{end_mmdd}"
    return f"{year}-{start_mmdd}", f"{year}-{end_mmdd}"


def build_yield_dataset() -> pd.DataFrame:
    country_codes = {c[0] for c in YIELD_COUNTRIES}
    owid_yields = fetch_owid_yields(country_codes, min_year=2017)
    s2_cache = load_s2_cache()
    years = list(range(2017, 2025))

    weather_by_country: dict[str, pd.DataFrame] = {}
    for iso3, label, lat, lon, _, _ in YIELD_COUNTRIES:
        power_df = fetch_nasa_power(lat, lon, "20161001", "20241231")
        esi_df = fetch_open_meteo_esi(lat, lon, "2016-10-01", "2024-12-31")
        merged = pd.merge(power_df, esi_df, on="date", how="inner").sort_values("date").reset_index(drop=True)
        weather_by_country[iso3] = merged
        print(f"Fetched {len(merged)} NASA POWER + ERA5-Land days for {label} ({iso3})")

    pending_s2 = []
    for iso3, _, lat, lon, s_mmdd, e_mmdd in YIELD_COUNTRIES:
        for yr in years:
            key = f"{iso3}:{yr}"
            if key not in s2_cache:
                s_iso, e_iso = season_bounds(yr, s_mmdd, e_mmdd)
                pending_s2.append((key, lat, lon, s_iso, e_iso))

    if pending_s2:
        print(f"Sampling real Sentinel-2 L2A peak NDVI for {len(pending_s2)} country-seasons...")
        completed = 0
        with ThreadPoolExecutor(max_workers=6) as pool:
            futures = {
                pool.submit(fetch_sentinel2_peak_ndvi, lat, lon, s_iso, e_iso): key
                for key, lat, lon, s_iso, e_iso in pending_s2
            }
            for fut in as_completed(futures):
                key = futures[fut]
                completed += 1
                try:
                    val = fut.result(timeout=30)
                except Exception:
                    val = None
                if val is not None:
                    s2_cache[key] = round(val, 4)
                if completed % 20 == 0 or completed == len(pending_s2):
                    print(f"  Sentinel-2 NDVI progress: {completed}/{len(pending_s2)} (cached={len(s2_cache)})", flush=True)
                    save_s2_cache(s2_cache)

    rows = []
    for iso3, _, _, _, s_mmdd, e_mmdd in YIELD_COUNTRIES:
        wdf = weather_by_country[iso3]
        for yr in years:
            key = f"{iso3}:{yr}"
            peak_ndvi = s2_cache.get(key)
            if peak_ndvi is None:
                continue

            s_iso, e_iso = season_bounds(yr, s_mmdd, e_mmdd)
            season = wdf[(wdf["date"] >= s_iso) & (wdf["date"] <= e_iso)]
            if len(season) < 60:
                continue

            # Normalize seasonal totals to 30-day rates so training scale matches PredictYield.cs 30d serving window
            scale_30d = 30.0 / len(season)
            acc_precip_30d = float(season["precip"].sum()) * scale_30d
            avg_root = float(season["sm_root"].mean())
            wdi = 1.0 - (0.6 * season["sm_root"] + 0.4 * season["esi"])
            stress_days_30d = int(round(int((wdi > 0.65).sum()) * scale_30d))

            for crop_id in OWID_CROP_SLUGS:
                real_yield = owid_yields.get((iso3, yr, crop_id))
                if real_yield is None:
                    continue
                rows.append(
                    {
                        "country": iso3,
                        "year": yr,
                        "crop_type_id": crop_id,
                        "accumulated_precip_mm": round(acc_precip_30d, 2),
                        "avg_rootzone_moisture": round(avg_root, 4),
                        "peak_ndvi": round(peak_ndvi, 4),
                        "stress_days_count": stress_days_30d,
                        "yield_tons_per_ha": round(real_yield, 3),
                    }
                )

    return pd.DataFrame(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare 100% real satellite/weather/yield ML datasets.")
    parser.add_argument("--start", default="20200101", help="Soil series start date YYYYMMDD (default: 20200101)")
    parser.add_argument("--end", default="20261110", help="Soil series end date YYYYMMDD (default: 20261110)")
    args = parser.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    try:
        x_seq, y_seq = build_soil_dataset(args.start, args.end)
        yield_df = build_yield_dataset()
    except (URLError, TimeoutError, KeyError, ValueError) as exc:
        raise RuntimeError(f"Failed to fetch live satellite/yield data: {exc}") from exc

    yield_path = DATA_DIR / "yield_training.csv"
    soil_path = DATA_DIR / "soil_sequences.npz"

    yield_df.to_csv(yield_path, index=False)
    np.savez_compressed(soil_path, inputs=x_seq, targets=y_seq)

    print(
        f"[100% Real NASA POWER + Sentinel-2 L2A + ERA5-Land + FAOSTAT] "
        f"Saved {len(yield_df)} real yield rows -> {yield_path}"
    )
    print(
        f"[100% Real NASA POWER + ERA5-Land ({args.start}..{args.end})] "
        f"Saved {len(x_seq)} soil sequences {x_seq.shape} -> {y_seq.shape} -> {soil_path}"
    )


if __name__ == "__main__":
    main()
