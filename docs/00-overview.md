# Overview · What / Why / How

A one-page summary for management, focused on business value.

## What

A tool that automates TA (dimension-chain / tolerance analysis) for Surface and ODM/supplier teams.

It turns TA — previously done by hand in spreadsheets — into a managed process, delivering four clear outcomes:

- **Runs automatically**: Attach the TA `.xlsx` to an ADO work item, and analysis starts on its own.
- **Grounded interpretation**: Interpretation is based on Microsoft's and suppliers' own engineering rules and capability data, not the vague output of a general-purpose LLM.
- **Traceable**: DIM ID ties everything together — from TA factor, to drawing dimension, to measured capability.
- **Proactive reminders**: A server-side service periodically checks program milestones and, before a key milestone (e.g. EV1), reminds the owner to complete the DIM IDs and the drawing dimension chain — so missing information isn't discovered too late.

## Why

Manual TA can no longer keep up with growing product complexity. There are four main problems:

- **Slow**: A single report often takes hours.
- **Error-prone**: Data across Excel, drawings, and specs easily drifts apart, and problems surface late.
- **Hard to manage**: The process relies on people to remember and chase; the closer to a key milestone, the easier things slip.
- **Hard to trace**: During review and audit, the source and basis for a given dimension can't be found.

On top of that, a general-purpose LLM isn't enough to support TA decisions: it doesn't know Microsoft's and suppliers' engineering rules, doesn't know the real process capability of each part class, and can't provide a basis you can check.

The point of this tool is to shift TA from "executed by people" to "managed and executed by a system."

## How

The system consists of a controlled knowledge base and a calculation engine that is fully consistent with Excel, driven end to end through ADO and server-side services:

- Triggered automatically by an ADO attachment event, with the owner assigned automatically from ADO fields.
- Runs data cleansing, method selection (WC / RSS), and calculation consistent with the template.
- Produces interpretation grounded in Microsoft's and suppliers' rules and capability libraries, with the basis stated for every conclusion.
- Links every factor by DIM ID for end-to-end traceability and auditability.
- Queries program milestones automatically and, before a key milestone (e.g. EV1), reminds the owner weekly/monthly to complete the DIM IDs and drawing dimension chain.
- Once measured Cpk is available, backfills it by DIM ID, compares "estimated vs. actual," and makes later judgments increasingly accurate.

## Business Value

- ✅ **Faster**: TA drops from hours to minutes.
- ✅ **Cheaper**: Less manual cleansing, rechecking, and repeated chasing.
- ✅ **More reliable**: Problems surface earlier, with fewer surprises before key milestones.
- ✅ **Traceable**: DIM ID ties design, analysis, reminders, and measured results into one auditable chain.
- ✅ **Manageable**: ADO auto-trigger plus server-side reminders reduce process gaps.
- ✅ **Compounding**: Measured data flows back, making capability judgments more accurate over time.
