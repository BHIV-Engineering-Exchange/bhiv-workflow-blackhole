# Samachar Processing Manifest V0.1

**Owner:** Pritesh (Samachar Processing / Normalisation Lead)
**Group:** 2 — SAMACHAR / SCIENTIFIC DATA FOUNDATION
**Sprint Objective:** Transform scientifically sourced Thane Creek mangrove data into structured, explainable, and VANA MasterDB-ready records.

---

## 1. Processing Pipeline Definition
This defines the strictly deterministic path transitioning data from an external "Source" to an actionable record in "MasterDB".

1. **Source Identification**: Intake source artifacts from the Scientific, Government, or GIS registries with an exact `source_id`.
2. **Samachar Acquisition**: Initial parsing and staging of the source information.
3. **Structured Extraction**: Mapping unstructured text/tables into deterministic fields without altering scientific meaning.
4. **Normalisation**:
   - **Unit Normalisation**: Converting specific measurements to standard MasterDB/VANA accepted units (e.g., metric SI).
   - **Date Normalisation**: Transitioning textual or localized dates into ISO 8601 standard (`YYYY-MM-DD`).
   - **Location Normalisation**: Translating coordinates to standard WGS84 GeoJSON / Decimal degrees.
5. **Contextualisation**: Linking findings to specific environmental entities (e.g., *Avicennia marina* mapping to a specific grid in Thane Creek).
6. **Validation & Provenance Logging**: Injecting a unique `processing_run_id` and documenting every transformation rule applied.

---

## 2. Transformation Rules & Mappings
**Critical Rule:** Every transformation must be explainable. If a source value changes format, the rule governing the change must be explicitly recorded below.

### 2.1 Unit Normalisation
| Source Entity | Potential Source Unit | Target MasterDB Unit | Transformation Rule / Notes |
| :--- | :--- | :--- | :--- |
| **Area coverage** | Hectares (ha), Acres | Square Kilometers (sq km) | 1 ha = 0.01 sq km |
| **Carbon Stock** | Mg C ha⁻¹ | Tons per Hectare (t/ha) | 1 Mg = 1 Metric Ton. Semantic consistency checked. |
| **Coordinates** | DMS (Degrees Minutes Seconds) | Decimal Degrees (DD) | Converted into standard WGS84. |

### 2.2 Date Normalisation
- **Rule Book**: All dates captured textually ("August 2023", "2023", "23/08/2023") MUST be deterministically mapped to `YYYY-MM-DD` or `YYYY-MM` without inventing precision (e.g., "August 2023" becomes "2023-08", not "2023-08-01").

### 2.3 Duplicate Detection & Conflict Rules
- **Rule Book**: If two conflicting data points exist for the exact same metric, location, and time sequence, DO NOT resolve by picking the average. Preserve **BOTH** records and label them as `CONFLICT` for QA (Vijay) to evaluate.
- Uncertainty must be preserved. Avoid synthetically creating data out of inferences.

---

## 3. Practical Test: Structured Record Template (Example)
**Scenario Blueprint:** Converting a single source artifact into structured records while retaining exact provenance.

### 3.1 Source Reference Input
- **Source ID:** (To be provided by Sheetalji or Kaushal)
- **Original Claim:** *(Waiting for real data: e.g., "Above-ground biomass measured at 24.5 Mg ha-1 in Aug 2021")*
- **Raw Location:** *(Waiting for real data: e.g., "Thane Creek mudflats")*

### 3.2 Processing Run Metrics
- **Samachar Run ID:** `RUN_20260812_01`
- **Operator:** Pritesh
- **Date/Time execution:** `2026-08-12`

### 3.3 Target Output Structure (MasterDB payload blueprint)
```json
{
  "record_id": "OBS_[UNIQUE_ID]_SAMACHAR_RUN_20260812_01",
  "source_id": "PROVIDED_SOURCE_ID",
  "provenance": {
    "processing_run_id": "RUN_20260812_01",
    "transformations_applied": [
      "DATE_ISO8601_NORMALISATION",
      "UNIT_MAPPING_MG_TO_TON_HA"
    ],
    "extraction_operator": "Pritesh"
  },
  "observation": {
    "indicator_name": "scientific_metric_name",
    "indicator_value": 0.0,
    "indicator_unit": "standardised_unit",
    "observation_date": "YYYY-MM-DD",
    "location_precision": "regional",
    "location_name": "Thane Creek specific area"
  },
  "validation_status": "PENDING_QA_VIJAY"
}
```

---

## 4. Pritesh's Today Execution Checklist 
- [ ] **1. Align with Sourcing Leads:** Receive the FIRST definitive verified source from Sheetalji (Literature) OR Kaushal (Government/GIS).
- [ ] **2. Extract & Map:** Process exactly 1 source artifact through the Samachar structured extraction.
- [ ] **3. Apply Documentation:** Document any normalisation paths (Units, Dates, Locations). 
- [ ] **4. Build the Output JSON:** Format the structured observation data preserving semantic meaning and no inferred data.
- [ ] **5. Route to QA Final Gate:** Submit generated structured observation JSON to **Vijay (Observation Lead)** for `ACCEPTED/REJECTED/UNCERTAIN/CONFLICT` classification.
- [ ] **6. Coordinate Schema:** Work closely with **Ansh (Convergence)** if there are any specific field naming restrictions mandated by MasterDB Group 1.

**FINAL CHECK:** The data must represent evidence ("Source was located and metric extracted precisely"), not inferences ("This implies excellent mangrove health").
