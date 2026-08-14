# TASK: Implement Bright Connection Sovereign Gateway & Tenant Connector

Project: SETU Enterprise Operating System
Assignee: Rudra Parmeshwar
Priority: High
Department: Web Development

## Overview
Implement the tenant-level API connector for Bright Connection to route live logistics and CRM data through the SETU capability fabric.

## Requirements
1. Ingest real CRM & dealer order payloads without mocked success.
2. Pass canonical MDU data through SETU 11-stage pipeline.
3. Validate trace ID continuity and compute SHA-256 evidence hashing.
