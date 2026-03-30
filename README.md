# Global CEO Turnover Index

Static interactive dashboard built directly in this folder using the extracted CSV package from `CEO Turnover 2026/package`.

## Files
- `index.html`: app shell and layout
- `manual-analysis.html`: all-charts analyst page
- `styles.css`: dark design system and responsive styling
- `app.js`: main single-view dashboard entry
- `manual-analysis.js`: manual analysis page entry
- `shared/`: shared data, chart, and analysis modules
- `api/analyze.js`: optional Vercel serverless route for OpenAI-backed analysis
- `data/`: local CSV data layer used by the dashboard
- `vercel.json`: static deployment configuration

## Local preview
Run a simple local server from this folder:

```bash
python3 -m http.server 4173
```

Then open:

```text
http://localhost:4173
```

## Data used
- `data/index_quarterly_metrics.csv`
- `data/index_quarterly_splits.csv`
- `data/industry_quarterly_metrics.csv`
- `data/industry_quarterly_splits.csv`
- `data/denominators_companies.csv`

## Optional OpenAI mode
If deployed on Vercel, add an `OPENAI_API_KEY` environment variable to enable the serverless analysis route in `api/analyze.js`. Without it, the dashboard uses the built-in local analysis fallback.
