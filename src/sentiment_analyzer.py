"""Financial market sentiment analysis from news text."""

from typing import Literal

import pandas as pd
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer


SentimentLabel = Literal["positive", "negative", "neutral"]


def _get_vader_scores(text: str, analyzer: SentimentIntensityAnalyzer) -> dict:
    """Get VADER compound score and components."""
    if not text or not str(text).strip():
        return {"compound": 0.0, "pos": 0.0, "neg": 0.0, "neu": 1.0}
    return analyzer.polarity_scores(str(text))


def _compound_to_label(compound: float) -> SentimentLabel:
    """Map VADER compound score (-1 to 1) to sentiment label."""
    if compound >= 0.05:
        return "positive"
    if compound <= -0.05:
        return "negative"
    return "neutral"


def analyze_sentiment_vader(df: pd.DataFrame, text_col: str = "title") -> pd.DataFrame:
    """
    Add sentiment scores using VADER (fast, no GPU required).
    Best for headlines and short text.
    """
    analyzer = SentimentIntensityAnalyzer()
    out = df.copy()

    def _analyze(row):
        text = str(row.get(text_col, "")) + " " + str(row.get("summary", ""))
        scores = _get_vader_scores(text, analyzer)
        return {
            "sentiment_compound": scores["compound"],
            "sentiment_positive": scores["pos"],
            "sentiment_negative": scores["neg"],
            "sentiment_neutral": scores["neu"],
            "sentiment_label": _compound_to_label(scores["compound"]),
        }

    results = out.apply(_analyze, axis=1)
    for key in results.iloc[0].keys():
        out[key] = [r[key] for r in results]
    return out


def get_market_sentiment_summary(df: pd.DataFrame) -> dict:
    """
    Aggregate sentiment across all news into a market-level summary.
    """
    if df.empty or "sentiment_compound" not in df.columns:
        return {
            "overall_score": 0.0,
            "sentiment_label": "neutral",
            "positive_pct": 0.0,
            "negative_pct": 0.0,
            "neutral_pct": 0.0,
            "article_count": 0,
        }

    compounds = df["sentiment_compound"].dropna()
    labels = df["sentiment_label"].dropna()

    overall = float(compounds.mean()) if len(compounds) > 0 else 0.0
    total = len(labels)
    pos_pct = (labels == "positive").sum() / total * 100 if total > 0 else 0
    neg_pct = (labels == "negative").sum() / total * 100 if total > 0 else 0
    neu_pct = (labels == "neutral").sum() / total * 100 if total > 0 else 0

    return {
        "overall_score": round(overall, 4),
        "sentiment_label": _compound_to_label(overall),
        "positive_pct": round(pos_pct, 1),
        "negative_pct": round(neg_pct, 1),
        "neutral_pct": round(neu_pct, 1),
        "article_count": int(total),
    }
