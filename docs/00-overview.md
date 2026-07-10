# Overview · What / Why / How

One-page summary of the Surface TA Analysis Agent (V1).

## What

An AI agent that automates Tolerance Analysis (TA) for Surface and ODM / supplier teams — replacing manual Excel-based analysis with an automated workflow that cleanses data, runs template-consistent calculations, and delivers expert interpretation.

## Why

As product complexity grows, manual TA is slow, error-prone, and hard to trace. Excel, drawing, and spec data drift apart; existing tools compute numbers but can't interpret them, and real measurement data never flows back. This solution frees engineers to focus on judgment, not filling cells.

## How

Built on a knowledge base (capability / rules / ontology) plus a calculation engine kept strictly consistent with the TA template.

- Auto-triggered when a TA `.xlsx` is attached to an Azure ADO work item — runs the full flow end to end with no manual steps
- Auto-detects TA worksheets and extracts the dimension-chain loop image
- Cleanses data and validates against per-category spec libraries
- Recommends method by factor count (Worst Case / RSS)
- Anchors each factor to a drawing dimension via DIM ID (metadata only, no OCR)
- Delivers fixed, objective interpretation with cited evidence — final call left to the user
- Server-side reminders drive DIM IDs onto drawings before EV1
- Closes the loop by feeding real measured Cpk back by DIM ID

## Business Value

- ✅ **Speed**: TA from hours to minutes — upload and go
- ✅ **Automation**: ADO-triggered, end-to-end flow with server-side reminders — no manual orchestration
- ✅ **Consistency**: Standardized method and calculation eliminate manual variation
- ✅ **Quality**: Auto cross-checks Excel ↔ drawing ↔ spec, reducing errors
- ✅ **Traceability**: DIM ID links design, analysis, and real data — auditable end to end
- ✅ **Cost**: Data-driven spec optimization (target Cpk 1.33) safely relaxes tolerances
