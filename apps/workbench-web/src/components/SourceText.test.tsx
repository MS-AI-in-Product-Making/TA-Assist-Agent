import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SourceText } from "./SourceText.js";

afterEach(cleanup);

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

  it("renders plain text without activation semantics when onActivate is missing", () => {
    const rendered = render(<SourceText value={{ displayText: "Bracket", sourceText: "支架", translated: true }} />);

    expect(rendered.container.querySelector("button")).toBeNull();
    expect(screen.getByText("Bracket")).toBeVisible();
  });

  it("does not append visible original-text suffix for untranslated values", () => {
    const rendered = render(<SourceText value={{ displayText: "支架", sourceText: "支架", translated: false }} />);

    expect(rendered.container.querySelector(".source-text > span")?.textContent).toBe("支架");
    expect(screen.queryByText("Original text")).toBeNull();
  });
});