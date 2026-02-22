"""Extract breaking financial news from multiple sources."""

import feedparser
import requests
from datetime import datetime, timezone, timedelta

import pandas as pd


def _utcnow():
    return datetime.now(timezone.utc)


# Financial and political news RSS feeds (no API key required)
RSS_FEEDS = [
    ("Bloomberg Markets", "https://feeds.bloomberg.com/markets/news.rss"),
    ("CNBC Top News", "https://www.cnbc.com/id/100003114/device/rss/rss.html"),
    ("CNBC Business", "https://www.cnbc.com/id/10001147/device/rss/rss.html"),
    ("Dow Jones", "https://feeds.content.dowjones.io/public/rss/mw_topstories"),
    ("Yahoo Finance", "https://feeds.finance.yahoo.com/rss/2.0/headline"),
    ("Reuters Business", "https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best"),
    ("CNN Top Stories", "http://rss.cnn.com/rss/cnn_topstories.rss"),
    ("CNN Politics", "http://rss.cnn.com/rss/cnn_allpolitics.rss"),
    ("CNN Business", "http://rss.cnn.com/rss/money_news_international.rss"),
    ("BBC News", "http://feeds.bbci.co.uk/news/rss.xml"),
    ("BBC Business", "http://feeds.bbci.co.uk/news/business/rss.xml"),
    ("ABC News", "https://abcnews.go.com/abcnews/topstories"),
    ("ABC Politics", "https://abcnews.go.com/abcnews/politicsheadlines"),
]

# Trump Truth Social RSS feeds (multiple sources for reliability)
TRUMP_RSS_FEEDS = [
    ("Trump (Truth Social)", "https://trumpstruth.org/feed"),
    ("Trump (Truth Social)", "https://rss.app/feeds/v1.1/tsLBMEFKpRdTuPFi.json"),
    ("Trump (Truth Social)", "https://truthsocial.com/@realDonaldTrump.rss"),
]

RSS_TIMEOUT = 15


def _fetch_rss_raw(url: str) -> feedparser.FeedParserDict:
    """Fetch RSS with a proper HTTP timeout."""
    try:
        resp = requests.get(url, timeout=RSS_TIMEOUT, headers={"User-Agent": "NewsMarketSentiment/1.0"})
        resp.raise_for_status()
        return feedparser.parse(resp.content)
    except Exception:
        return feedparser.parse(url)


def _parse_published(entry) -> datetime:
    """Extract published datetime from feed entry, always UTC-aware."""
    for attr in ("published_parsed", "updated_parsed"):
        parsed = getattr(entry, attr, None)
        if parsed:
            try:
                dt = datetime(*parsed[:6], tzinfo=timezone.utc)
                return dt
            except (TypeError, ValueError):
                continue
    return _utcnow()


def fetch_rss_feed(source_name: str, url: str) -> list[dict]:
    """Fetch and parse a single RSS feed."""
    articles = []
    try:
        feed = _fetch_rss_raw(url)
        for entry in feed.entries[:25]:
            published = _parse_published(entry)

            articles.append({
                "source": source_name,
                "title": entry.get("title", ""),
                "summary": entry.get("summary", entry.get("description", ""))[:500],
                "url": entry.get("link", ""),
                "published_at": published,
                "fetched_at": _utcnow(),
            })
    except Exception as e:
        print(f"Warning: Failed to fetch {source_name}: {e}")
    return articles


def fetch_trump_truth_social() -> list[dict]:
    """Fetch Trump Truth Social posts from multiple RSS sources for reliability."""
    articles = []
    for source_name, url in TRUMP_RSS_FEEDS:
        try:
            feed = _fetch_rss_raw(url)
            if not feed.entries:
                continue

            for entry in feed.entries[:20]:
                title = entry.get("title", "")
                if not title or len(title.strip()) < 10:
                    title = entry.get("summary", entry.get("description", ""))[:200]
                if not title or len(title.strip()) < 10:
                    continue

                published = _parse_published(entry)
                articles.append({
                    "source": "Trump (Truth Social)",
                    "title": title.strip()[:200],
                    "summary": entry.get("summary", entry.get("description", ""))[:500],
                    "url": entry.get("link", ""),
                    "published_at": published,
                    "fetched_at": _utcnow(),
                })

            if articles:
                print(f"[Trump RSS] Got {len(articles)} posts from {url}")
                break
        except Exception as e:
            print(f"[Trump RSS] Failed {url}: {e}")
            continue

    return articles


def fetch_all_news() -> pd.DataFrame:
    """Fetch news from all configured RSS feeds + Trump Truth Social."""
    all_articles = []
    for source_name, url in RSS_FEEDS:
        articles = fetch_rss_feed(source_name, url)
        all_articles.extend(articles)

    # Always fetch Trump Truth Social
    trump_posts = fetch_trump_truth_social()
    all_articles.extend(trump_posts)

    # Optional: Add Trump X tweets if TWITTER_BEARER_TOKEN is set (X API is paid)
    try:
        from src.trump_tweets import fetch_trump_x_tweets
        tweets_df = fetch_trump_x_tweets()
        if not tweets_df.empty:
            tweet_articles = tweets_df.to_dict(orient="records")
            all_articles.extend(tweet_articles)
    except Exception:
        pass

    if not all_articles:
        return pd.DataFrame()

    df = pd.DataFrame(all_articles)
    df = df.drop_duplicates(subset=["title", "source"], keep="first")

    # Drop articles older than 48 hours to keep the feed fresh
    cutoff = _utcnow() - timedelta(hours=48)
    df["published_at"] = pd.to_datetime(df["published_at"], utc=True, errors="coerce")
    df = df[df["published_at"] >= cutoff]

    df = df.sort_values("published_at", ascending=False).reset_index(drop=True)
    print(f"[News] Fetched {len(df)} articles ({len(trump_posts)} Trump posts)")
    return df


def fetch_news_api(api_key: str, query: str = "stock market OR economy OR Federal Reserve") -> pd.DataFrame:
    """Fetch news from NewsAPI.org (requires API key)."""
    url = "https://newsapi.org/v2/everything"
    params = {
        "q": query,
        "apiKey": api_key,
        "language": "en",
        "sortBy": "publishedAt",
        "pageSize": 50,
    }
    try:
        resp = requests.get(url, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"NewsAPI error: {e}")
        return pd.DataFrame()

    articles = []
    for a in data.get("articles", []):
        if not a.get("title") or a.get("title") == "[Removed]":
            continue
        pub = a.get("publishedAt")
        published = datetime.fromisoformat(pub.replace("Z", "+00:00")) if pub else _utcnow()
        articles.append({
            "source": a.get("source", {}).get("name", "NewsAPI"),
            "title": a.get("title", ""),
            "summary": (a.get("description") or "")[:500],
            "url": a.get("url", ""),
            "published_at": published,
            "fetched_at": _utcnow(),
        })
    return pd.DataFrame(articles)
