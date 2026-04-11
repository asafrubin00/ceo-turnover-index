# CEO Turnover Index

**Global CEO turnover analytics. Interactive, filterable, AI-assisted.**

📊 [View dashboard →](https://ceo-turnover-index.vercel.app)

The decisions made by the CEOs of large public companies ripple far beyond the boardroom - shaping industries, economies, and investor confidence. The rate at which CEOs turn over tells a story: about market stability, sector appeal, and the pressures bearing down on executive leadership at any given moment.

This dashboard tracks those patterns.

---

## What It Does

An interactive analytics platform for exploring global CEO turnover across major market indices and industries. Built on data from the **Russell Reynolds Associates Global CEO Turnover Index** - a project I concieved and built while working at Russell Reynolds, and which is one of the most comprehensive longitudinal datasets on executive succession available publicly.

**Filter and explore by:**
- Index (flagship, regional, segment)
- Industry
- Year and quarter
- Tenure, gender, internal vs. external appointments

**Features:**
- Quarterly turnover trajectory charts
- Trend analysis across indices and industries
- AI-powered contextual analysis that updates with each chart view
- Manual analysis page for deeper cross-cuts

---

## Background

This is a rebuilt and expanded version of a [legacy project](https://github.com/AsafRubin00/CEO-Turnover-Index) I first built in 2023 during the LSE Data Analytics Career Accelerator. The original was a static Python/Jupyter analysis. This version is a fully interactive web dashboard with live filtering, dynamic charting, and an optional AI analysis layer.

CEO turnover sits at the heart of corporate governance - it's where board accountability, succession planning, and shareholder pressure all converge. Building this dashboard was as much about understanding that landscape as it was about the engineering.

---

## Tech Stack

![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![HTML](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)

Vanilla JS, HTML, CSS - deployed on Vercel. Optional OpenAI-backed analysis route via Vercel serverless function (requires `OPENAI_API_KEY` environment variable).

---

## Running Locally

```bash
git clone https://github.com/asafrubin00/ceo-turnover-index.git
cd ceo-turnover-index
python3 -m http.server 4173
```

Open [http://localhost:4173](http://localhost:4173)

---

## Data

All underlying data is sourced from the **Russell Reynolds Associates Global CEO Turnover Index**. Full attribution at [russellreynolds.com](https://www.russellreynolds.com/en/insights/reports-surveys/global-ceo-turnover-index).
