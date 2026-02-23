"""Wall Street (CNN) Fear & Greed Index.

Primary: free CNN endpoint (no key needed).
Fallback: RapidAPI (requires RAPIDAPI_KEY).
"""

import json
import os
import re
import urllib.request


FGI_URL = "https://fear-and-greed-index.p.rapidapi.com/v1/fgi"
FGI_HOST = "fear-and-greed-index.p.rapidapi.com"
CNN_FGI_URL = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata"


def _classify(value: int) -> str:
    if value <= 25:
        return "Extreme Fear"
    if value <= 45:
        return "Fear"
    if value <= 55:
        return "Neutral"
    if value <= 75:
        return "Greed"
    return "Extreme Greed"


def _fetch_cnn_direct() -> dict | None:
    """Free CNN Fear & Greed endpoint — no API key needed."""
    try:
        req = urllib.request.Request(
            CNN_FGI_URL,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                              "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
                "Accept": "application/json, text/plain, */*",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": "https://edition.cnn.com/markets/fear-and-greed",
                "Origin": "https://edition.cnn.com",
            },
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())

        score = data.get("fear_and_greed", {}).get("score")
        prev_close = data.get("fear_and_greed", {}).get("previous_close")

        if score is None:
            return None

        value = int(round(float(score)))
        result = {"value": value, "classification": _classify(value)}

        if prev_close is not None:
            pv = int(round(float(prev_close)))
            result["previous_value"] = pv
            result["previous_classification"] = _classify(pv)

        week_ago = data.get("fear_and_greed", {}).get("previous_1_week")
        if week_ago is not None:
            result["week_ago_value"] = int(round(float(week_ago)))

        return result
    except Exception as e:
        print(f"[Wall Street F&G] CNN direct failed: {e}")
        return None


def _fetch_rapidapi() -> dict | None:
    """RapidAPI Fear & Greed — requires RAPIDAPI_KEY."""
    api_key = (
        os.getenv("RAPIDAPI_KEY")
        or os.getenv("RAPIDAPI_KEY_FEAR_GREED")
        or os.getenv("APIDAPI_KEY")  # common typo fallback
    )
    if not api_key:
        return None

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
    except Exception as e:
        print(f"[Wall Street F&G] RapidAPI failed: {e}")
        return None

    fgi = data.get("fgi") if isinstance(data, dict) else None
    if not fgi:
        return None

    now = fgi.get("now") or {}
    prev = fgi.get("previousClose") or {}
    try:
        value = int(now.get("value", 0))
    except (TypeError, ValueError):
        value = 0

    result = {"value": value, "classification": now.get("valueText") or _classify(value)}

    try:
        pv = prev.get("value")
        if pv is not None:
            result["previous_value"] = int(pv)
            result["previous_classification"] = prev.get("valueText") or _classify(int(pv))
    except (TypeError, ValueError):
        pass

    return result


def fetch_wall_street_fear_greed() -> dict:
    """Fetch CNN/Wall Street Fear & Greed Index.

    Tries free CNN endpoint first, falls back to RapidAPI.
    """
    result = _fetch_cnn_direct()
    if result:
        return result

    result = _fetch_rapidapi()
    if result:
        return result

    return {"error": "all_sources_failed", "value": None, "classification": None}
