"""Fear & Greed Index from Alternative.me (Crypto). Free API, no auth required."""

import urllib.request
import json


FNG_URL = "https://api.alternative.me/fng/?limit=2"


def fetch_fear_greed() -> dict:
    """
    Fetch current Fear & Greed Index from Alternative.me.
    Returns dict with value (0-100), classification, timestamp,
    previous_value, previous_classification (last trading day), or error.
    """
    try:
        req = urllib.request.Request(FNG_URL, headers={"User-Agent": "NewsMarketSentiment/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
    except Exception as e:
        return {"error": str(e), "value": None, "classification": None}

    if not data.get("data"):
        return {"error": "no_data", "value": None, "classification": None}

    items = data["data"]
    item = items[0]
    try:
        value = int(item.get("value", 0))
    except (TypeError, ValueError):
        value = 0

    previous_value = None
    previous_classification = None
    if len(items) >= 2:
        prev = items[1]
        try:
            previous_value = int(prev.get("value", 0))
            previous_classification = prev.get("value_classification", "Unknown")
        except (TypeError, ValueError):
            pass

    result = {
        "value": value,
        "classification": item.get("value_classification", "Unknown"),
        "timestamp": item.get("timestamp"),
    }
    if previous_value is not None:
        result["previous_value"] = previous_value
        result["previous_classification"] = previous_classification
    return result
