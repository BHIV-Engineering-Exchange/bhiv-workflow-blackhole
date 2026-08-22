# Group 2 -> SANSKAR Runtime Evidence

**Flow ID:** TC-Z03-F02-LIDAR-OBS001
**Evidence Name:** SANSKAR_GAP_ABSTAIN_VERIFICATION_IDEMPOTENT
**Date:** 2026-08-22T06:03:52.340Z

## Runtime Results
* **Deterministic Chain:** GAP -> ABSTAIN -> action_request is null
* **Authoritative Temporal Data Intact:** Yes
* **Source Artifact:** Maharashtra Forest Department & ISRO Mangrove Cell Report (2020)
* **Idempotency Verified:** Yes (Repeated inputs resolved to identical traceId: `ctx_det_TC-Z03-F02-LIDAR-OBS001` and evidence structures).

### Run 1: Raw Payload Response
```json
{
  "ok": true,
  "status": "ABSTAIN",
  "decision": "GAP",
  "message": "Deterministic Group 2 execution path applied. SANSKAR intelligence layer is unavailable.",
  "action_request": null,
  "provenance": {
    "traceId": "ctx_det_TC-Z03-F02-LIDAR-OBS001",
    "sourceCitation": "Maharashtra Forest Department & ISRO Mangrove Cell Report (2020)",
    "group2_capability": "ABSTAIN",
    "validation_status": "PENDING_QA_VIJAY",
    "authoritative_evidence_used": true
  },
  "baseline_evidence": {
    "record_id": "OBS_TCFS_001_SAMACHAR_RUN_20260812_01",
    "source_id": "SRC_GOVT_MFD_001",
    "source_reference": {
      "publication": "Maharashtra Forest Department & ISRO Mangrove Cell Report (2020)",
      "evidence_location": "Executive Summary / Area Statistics Section"
    },
    "provenance": {
      "processing_run_id": "RUN_20260812_01",
      "transformations_applied": [
        "UNIT_NORMALISATION_RETAINED_SQKM",
        "DATE_NORMALISATION_YEAR_ONLY"
      ],
      "extraction_operator": "Pritesh"
    },
    "raw_extracted_evidence": {
      "raw_indicator_value": 8.96,
      "raw_indicator_unit": "sq km",
      "raw_observation_date": "2020",
      "raw_location_name": "Thane Creek Flamingo Sanctuary"
    },
    "observation": {
      "indicator_name": "mangrove_forest_extent",
      "indicator_value": 8.96,
      "indicator_unit": "sq km",
      "observation_date": "2020-01-01",
      "location_precision": "protected_sanctuary",
      "location_name": "Thane Creek Flamingo Sanctuary (TCFS)"
    },
    "validation_status": "PENDING_QA_VIJAY"
  }
}
```

### Run 2: Idempotency Validation Payload
```json
{
  "ok": true,
  "status": "ABSTAIN",
  "decision": "GAP",
  "message": "Deterministic Group 2 execution path applied. SANSKAR intelligence layer is unavailable.",
  "action_request": null,
  "provenance": {
    "traceId": "ctx_det_TC-Z03-F02-LIDAR-OBS001",
    "sourceCitation": "Maharashtra Forest Department & ISRO Mangrove Cell Report (2020)",
    "group2_capability": "ABSTAIN",
    "validation_status": "PENDING_QA_VIJAY",
    "authoritative_evidence_used": true
  },
  "baseline_evidence": {
    "record_id": "OBS_TCFS_001_SAMACHAR_RUN_20260812_01",
    "source_id": "SRC_GOVT_MFD_001",
    "source_reference": {
      "publication": "Maharashtra Forest Department & ISRO Mangrove Cell Report (2020)",
      "evidence_location": "Executive Summary / Area Statistics Section"
    },
    "provenance": {
      "processing_run_id": "RUN_20260812_01",
      "transformations_applied": [
        "UNIT_NORMALISATION_RETAINED_SQKM",
        "DATE_NORMALISATION_YEAR_ONLY"
      ],
      "extraction_operator": "Pritesh"
    },
    "raw_extracted_evidence": {
      "raw_indicator_value": 8.96,
      "raw_indicator_unit": "sq km",
      "raw_observation_date": "2020",
      "raw_location_name": "Thane Creek Flamingo Sanctuary"
    },
    "observation": {
      "indicator_name": "mangrove_forest_extent",
      "indicator_value": 8.96,
      "indicator_unit": "sq km",
      "observation_date": "2020-01-01",
      "location_precision": "protected_sanctuary",
      "location_name": "Thane Creek Flamingo Sanctuary (TCFS)"
    },
    "validation_status": "PENDING_QA_VIJAY"
  }
}
```

## Status: COMPLETE
