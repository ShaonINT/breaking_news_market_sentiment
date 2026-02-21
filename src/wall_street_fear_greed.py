"""Wall Street (CNN) Fear & Greed Index via RapidAPI. Requires RAPIDAPI_KEY."""

import json
import os
import urllib.request


FGI_URL = "https://fear-and-greed-index.p.rapidapi.com/v1/fgi"
FGI_HOST = "fear-and-greed-index.p.rapidapi.com"


def fetch_wall_street_fear_greed() -> dict:
    """
    Fetch CNN/Wall Street Fear & Greed Index from RapidAPI.
    Returns dict with value (0-100), classification, previous_value,
    previous_classification, or error.
    Requires RAPIDAPI_KEY environment variable.
    """
    api_key = os.getenv("RAPIDAPI_KEY") or os.getenv("RAPIDAPI_KEY_FEAR_GREED")
    if not api_key:
        return {"error": "no_api_key", "message": "Set RAPIDAPI_KEY for Wall Street Fear & Greed"}

    try:
        req = urllib.request.Request(
            FGI_URL,
            headers={
                "X-RapidAPI-Key": api_key,
                "X-RapidAPI-Host": FGI_HOST,
                "User-Agent": "NewsMarketSentiment/1.0",
            },
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 401:
            return {"error": "invalid_api_key", "message": "RAPIDAPI_KEY invalid or expired"}
        return {"error": str(e), "value": None, "classification": None}
    except Exception as e:
        return {"error": str(e), "value": None, "classification": None}

    fgi = data.get("fgi") if isinstance(data, dict) else None
    if not fgi:
        return {"error": "no_data", "value": None, "classification": None}

    now = fgi.get("now") or {}
    prev = fgi.get("previousClose") or {}
    try:
        value = int(now.get("value", 0))
    except (TypeError, ValueError):
        value = 0

    previous_value = None
    previous_classification = None
    try:
        pv = prev.get("value")
        if pv is not None:
            previous_value = int(pv)
            previous_classification = prev.get("valueText") or "Unknown"
    except (TypeError, ValueError):
        pass

    result = {
        "value": value,
        "classification": now.get("valueText") or "Unknown",
    }
    if previous_value is not None:
        result["previous_value"] = previous_value
        result["previous_classification"] = previous_classification
    return result
