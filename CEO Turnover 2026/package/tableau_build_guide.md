# Tableau Build Guide (Modern Executive Layout)

## 1) Data model
Connect these CSVs:
- `index_quarterly_metrics.csv`
- `index_quarterly_splits.csv`
- `industry_quarterly_metrics.csv`
- `industry_quarterly_splits.csv`
- `denominators_companies.csv`

Use relationships (not physical joins):
- `year`, `quarter`, `segment`
- `scope` when joining denominator file

## 2) Core calculated fields
- `Quarter Date`:
  ```tableau
  MAKEDATE(INT([year]), ([quarter]-1)*3+1, 1)
  ```
- `Incoming Rate` = `SUM([incoming_count]) / SUM([company_count])`
- `Outgoing Rate` = `SUM([outgoing_count]) / SUM([company_count])`
- `Net Churn` = `SUM([incoming_count]) - SUM([outgoing_count])`

## 3) Dashboard pages
1. **Executive Overview**
   - KPI tiles: latest incoming, outgoing, incoming %, outgoing %, avg outgoing tenure.
   - Dual-line trend chart: incoming vs outgoing counts over time.
   - Heat strip by segment for latest quarter delta vs prior quarter.
2. **Composition View**
   - 100% stacked bars for Gender / Appointment / First-Timer.
   - Toggle flow (incoming vs outgoing) with parameter.
3. **Segment Deep Dive**
   - Ranked bars by index or industry for selected quarter.
   - Small multiple trends for selected split.

## 4) Design system
- Typeface: Tableau Book / Tableau Semibold only.
- Palette:
  - Incoming: `#1F77B4`
  - Outgoing: `#D62728`
  - Neutral grid: `#E6E6E6`
  - Background: `#F8F9FB`
- Spacing: 16px gutters, 24px section spacing.
- Labels: direct labels for endpoints only; avoid dense in-chart text.

## 5) Filters (global)
- Scope (Index / Industry)
- Segment
- Year range
- Quarter
- Flow

## 6) QA in Tableau
- Validate each split sums to 100% (Gender, Appointment, First-Timer).
- Validate split counts sum to the corresponding top-level count.
- Validate rates match provided percentage tables.
