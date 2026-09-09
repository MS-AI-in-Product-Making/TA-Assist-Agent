## What


This is TA assistant agent enables Microsoft ME and ODM partner PD teams to deliver high-quality tolerance analysis.


It does this by automatically reviewing the rationality of TA inputs against identified tolerance loops, generating evidence-based insights from TA results, and driving proposed-and-connected dimensional requirements with iterative TA cycles to support effective risk mitigation and OK2Ramp decisions.


1. **Data interpretation**: Objective, evidence-backed interpretation of TA outputs, with each RULE traceable to a knowledge-base entry; final judgment remains with the engineer.
2. **Interactive TA**: Engineer-in-the-loop iteration to adjust assumptions, rerun analyses, compare options, and converge on mitigation actions.


It upgrades TA from a spreadsheet-heavy manual activity into a quality-driven engineering workflow with auditable evidence.

## Why


As products move toward an RDM model, traditional TA workflows that rely on limited ODM engineering bandwidth for manual data entry and analysis can no longer support high-frequency stacked and iterative analysis needs.
The challenge is no longer just speed—TA quality and engineering decision confidence are increasingly at risk under milestone pressure.:


- **Broken links**: Dimension chains, drawing associations, and real measurement data can drift apart, weakening confidence in TA conclusions.
- **Late issue discovery**: Missing DIM associations and chain breakpoints are often discovered too close to key milestones (for example, EV1).
- **Insufficient decision support**: Static reports cannot effectively support rapid what-if simulation and evidence-based engineering judgment.


In addition, general-purpose LLMs are not sufficient to directly support TA decisions: they do not natively enforce Microsoft's and suppliers' engineering rules or part-class capability libraries, and they cannot reliably provide line-by-line checkable evidence.

The goal of this tool is to shift TA from ad hoc execution to a quality-assured, engineer-led decision workflow.

## How


The system combines a controlled knowledge base with an Excel-consistent calculation engine, orchestrated end to end through ADO and server-side capabilities:


- **Dimension quality gate**: Before analysis and before key milestone reviews, validate the quality of "proposed-and-connected" dimensions.
- **Interactive TA loop**: Run WC/RSS calculations, provide interpretation based on rule and capability evidence, and support engineer adjustments with rerun comparison.
- **Traceable evidence chain**: Use DIM ID to connect TA factors, drawing dimensions, rule basis, and real measurement results.
- **Operational integration**: The engineer uploads the TA `.xlsx` and creates the ADO work item; the tool runs on the uploaded file, assigns ownership from ADO fields, and sends pre-milestone reminders. (Auto-parsing a `.xlsx` directly from an ADO attachment is a later goal; today the file is uploaded manually.)
- **Measured-data feedback calibration**: Backfill measured Cpk by DIM ID, compare "estimated vs. actual," and continuously improve later judgment accuracy.

![image.png](https://1es4devices.visualstudio.com/aebd79c6-1ac7-4b58-9449-ba7cae584772/_apis/wit/attachments/178f3419-e834-4fa5-86e1-4fda5f748fb6?fileName=image.png)

## Business Value


- ✅ **Faster**: TA cycle time drops from hours to minutes.
- ✅ **Lower cost**: Reduced manual cleansing, rechecking, and repeated follow-up.
- ✅ **More robust**: Earlier risk exposure and fewer surprises before key milestones.
- ✅ **Traceable**: DIM ID ties design, analysis, reminders, and measured results into one traceable chain.
- ✅ **Easier to manage**: ADO work items and server-side reminders reduce process gaps.
- ✅ **Continuous gain**: Measured data continuously feeds back, improving capability judgment accuracy over time.
