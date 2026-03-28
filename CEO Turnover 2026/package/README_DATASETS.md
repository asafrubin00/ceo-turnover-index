# Q4 2025 CEO Turnover - Dataset Package

This package contains Tableau-ready CSV extracts and build instructions.

## Files
- `index_quarterly_metrics.csv`: quarterly incoming/outgoing counts, rates, average outgoing tenure, and company counts by index segment.
- `index_quarterly_splits.csv`: quarterly split distributions (gender, appointment, first_timer) for incoming/outgoing index segments.
- `industry_quarterly_metrics.csv`: quarterly incoming/outgoing counts, rates, average outgoing tenure, and company counts by industry segment.
- `industry_quarterly_splits.csv`: quarterly split distributions (gender, appointment, first_timer) for incoming/outgoing industry segments.
- `denominators_companies.csv`: quarterly company-count denominators by scope (`index`/`industry`) and segment.
- `tableau_build_guide.md`: step-by-step Tableau build guidance.
- `final_completion_report.md`: field-level completeness, row counts, and blank-row audit.

## Notes
- Denominators are complete for all segments.
- Global rows are populated for all quarters (2019 Q1–2025 Q4).
- 2025 Q4 non-global metrics are populated.
- Additional non-global values are partially backfilled for 2019–2023 from legacy row-level datasets.


## Extraction status
- This package is the current best extraction snapshot.
- Review `final_completion_report.md` for remaining blanks before moving into dashboard design.
