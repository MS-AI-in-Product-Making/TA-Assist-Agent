import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SourceText } from "./SourceText.js";

describe("SourceText", () => {
  it("shows projected text while exposing the exact source text on focus and via title", () => {
    render(<SourceText value={{ displayText: "Bracket", sourceText: "支架", translated: true }} onActivate={() => undefined} />);

    const text = screen.getByRole("button", { name: "Bracket" });
    expect(text).toBeVisible();
    expect(text).toHaveAttribute("title", "支架");

    text.focus();
    expect(text).toHaveFocus();
    expect(text).toHaveAccessibleDescription("支架");
  });

  it("marks untranslated fallback text as original text", () => {
    const rendered = render(<SourceText value={{ displayText: "支架", sourceText: "支架", translated: false }} />);

    expect(rendered.container.querySelector(".source-text > span")?.textContent).toBe("支架 Original text");
    expect(screen.getByText("Original text")).toBeVisible();
  });
});