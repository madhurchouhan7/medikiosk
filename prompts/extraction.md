# Document Entity Extraction Instructions

Extract medical entities from raw OCR prescription text into structured JSON:
- `medication`: Name of medicine
- `dosage`: e.g. 5mg, 500mg
- `frequency`: e.g. once daily, twice daily after meals
- `duration`: e.g. 5 days, ongoing
- `diagnosis`: Extracted condition or past diagnosis
- `investigation`: Test name and result
- `confidence`: Calculated confidence score (0.0 to 1.0)
- `source_snippet`: Exact matching raw text line

If text is unreadable or uncertain, set `confidence` < 0.65 to flag for human verification.
