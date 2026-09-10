import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ReportLink } from "./ReportLink.js";

afterEach(cleanup);

describe("ReportLink", () => {
  it("offers Markdown and derived PDF downloads for the canonical report", () => {
    render(<ReportLink sessionId="session/1" report={{ artifactId: "f6/report", label: "Design Optimization Report" }} />);

    expect(screen.getByRole("link", { name: "Design Optimization Report" })).toHaveAttribute(
      "href",
      "/api/sessions/session%2F1/artifacts/f6%2Freport",
    );
    expect(screen.getByRole("link", { name: "Download PDF" })).toHaveAttribute(
      "href",
      "/api/sessions/session%2F1/reports/f6.pdf",
    );
  });

  it("does not offer either download without a canonical report", () => {
    render(<ReportLink sessionId="session-1" />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("No validated report link is available yet.")).toBeVisible();
  });
});