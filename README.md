# Breaking News & Financial Sentiment Analysis

Extract breaking financial news from multiple sources and track market sentiment over time.

## Features

- **News extraction** from RSS feeds (Bloomberg, CNBC, Dow Jones, Yahoo Finance, Reuters) — no API key required
- **Optional NewsAPI** integration for more sources (add `NEWSAPI_KEY` to `.env`)
- **Sentiment analysis** using VADER (fast, works on CPU)
- **Historical tracking** — sentiment scores and trends saved to `data/`
- **Trend detection** — improving, declining, or stable market sentiment

## Setup

```bash
# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Optional: Copy .env.example to .env and add API keys
cp .env.example .env
```

## Usage

### Run the full pipeline

```bash
python main.py
```

This will:
1. Fetch breaking news from RSS feeds (and NewsAPI if configured)
2. Analyze sentiment of each article
3. Save news to `data/news_archive.csv`
4. Append sentiment summary to `data/sentiment_history.json`
5. Print a market sentiment report

### Use as a module

```python
from src.news_extractor import fetch_all_news
from src.sentiment_analyzer import analyze_sentiment_vader, get_market_sentiment_summary
from src.sentiment_tracker import save_news, append_sentiment_summary, load_sentiment_history

# Fetch and analyze
df = fetch_all_news()
df = analyze_sentiment_vader(df)
summary = get_market_sentiment_summary(df)
print(summary)  # {'overall_score': 0.12, 'sentiment_label': 'positive', ...}
```

## Project structure

```
├── main.py              # Entry point - run full pipeline
├── requirements.txt
├── .env.example
├── data/                 # Created on first run
│   ├── news_archive.csv
│   └── sentiment_history.json
└── src/
    ├── news_extractor.py    # RSS + optional NewsAPI
    ├── sentiment_analyzer.py # VADER sentiment
    └── sentiment_tracker.py # Storage & trend tracking
```

## Customization

- **Add RSS feeds**: Edit `RSS_FEEDS` in `src/news_extractor.py`
- **Use NewsAPI**: Get a free key at [newsapi.org](https://newsapi.org) and add to `.env`
- **FinBERT** (financial-specific): Add `finbert` to requirements and implement in `sentiment_analyzer.py` for domain-tuned sentiment

## Data outputs

| File | Description |
|------|-------------|
| `news_archive.csv` | All fetched articles with sentiment scores |
| `sentiment_history.json` | Timestamped sentiment snapshots for trend analysis |
