import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PaneHeader } from "./PaneHeader";
import { PreviewOverlay } from "./PreviewOverlay";
import { Button, Field, Input, Panel, Pill, Select, Textarea } from "./primitives";

describe("shared UI components", () => {
  it("renders pane header and action", () => {
    render(<PaneHeader action={<button type="button">操作</button>} description="補足" title="見出し" />);

    expect(screen.getByText("見出し")).toBeInTheDocument();
    expect(screen.getByText("補足")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "操作" })).toBeInTheDocument();
  });

  it("renders primitive inputs and whitespace overlay", () => {
    const handleChange = vi.fn();
    render(
      <Panel>
        <Field hint="補足" label="件名">
          <Input showWhitespace value={"A B"} onChange={handleChange} />
        </Field>
        <Textarea showWhitespace value={"1 2"} onChange={handleChange} />
        <Select aria-label="選択" defaultValue="a">
          <option value="a">A</option>
          <option value="b">B</option>
        </Select>
        <Button>保存</Button>
        <Pill tone="accent">注目</Pill>
      </Panel>,
    );

    expect(screen.getByText("件名")).toBeInTheDocument();
    expect(screen.getByText("補足")).toBeInTheDocument();
    expect(screen.getByDisplayValue("A B")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存" })).toBeInTheDocument();
    expect(screen.getByText("注目")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "選択" }), {
      target: { value: "b" },
    });
    expect(screen.getByRole("combobox", { name: "選択" })).toHaveValue("b");
  });

  it("closes preview overlay by backdrop, button, and escape", () => {
    const handleClose = vi.fn();
    const { rerender } = render(
      <PreviewOverlay isOpen title="プレビュー" onClose={handleClose}>
        <div>中身</div>
      </PreviewOverlay>,
    );

    expect(screen.getByText("中身")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.mouseDown(screen.getByText("中身").closest(".fixed") ?? document.body);
    expect(handleClose).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(handleClose).toHaveBeenCalledTimes(3);

    rerender(
      <PreviewOverlay isOpen={false} title="プレビュー" onClose={handleClose}>
        <div>中身</div>
      </PreviewOverlay>,
    );
    expect(screen.queryByText("中身")).not.toBeInTheDocument();
  });
});
