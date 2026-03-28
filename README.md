# Global CEO Turnover Index

Static interactive dashboard built directly in this folder using the extracted CSV package from `CEO Turnover 2026/package`.

## Files
- `index.html`: app shell and layout
- `styles.css`: visual system and responsive styling
- `app.js`: CSV loading, filtering, and chart rendering
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
