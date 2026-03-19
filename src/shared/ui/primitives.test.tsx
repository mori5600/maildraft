import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Input, Textarea } from "./primitives";

function ControlledInput({ initialValue }: { initialValue: string }) {
  const [value, setValue] = useState(initialValue);

  return (
    <Input
      enableSelectNextOccurrence
      value={value}
      onChange={(event) => setValue(event.currentTarget.value)}
    />
  );
}

function ControlledTextarea({ initialValue }: { initialValue: string }) {
  const [value, setValue] = useState(initialValue);

  return (
    <Textarea
      enableSelectNextOccurrence
      value={value}
      onChange={(event) => setValue(event.currentTarget.value)}
    />
  );
}

describe("text selection shortcuts", () => {
  it("edits matching input occurrences together after repeated Ctrl/Cmd+D", () => {
    const { container } = render(<ControlledInput initialValue="alpha beta alpha" />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    input.focus();
    input.setSelectionRange(2, 2);

    fireEvent.keyDown(input, { key: "d", ctrlKey: true });
    fireEvent.keyDown(input, { key: "d", ctrlKey: true });
    expect(container.querySelectorAll(".bg-\\(--color-selection\\)").length).toBe(2);
    fireEvent.input(input, { target: { value: "alpha beta z" } });

    expect(input.value).toBe("z beta z");
  });

  it("edits matching textarea occurrences together after repeated Ctrl/Cmd+D", () => {
    render(<ControlledTextarea initialValue={"foo\nbar\nfoo"} />);

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(1, 1);

    fireEvent.keyDown(textarea, { key: "d", ctrlKey: true });
    fireEvent.keyDown(textarea, { key: "d", ctrlKey: true });
    fireEvent.input(textarea, { target: { value: "foo\nbar\nzip" } });

    expect(textarea.value).toBe("zip\nbar\nzip");
  });

  it("undoes the last linked edit with Ctrl/Cmd+Z", () => {
    render(<ControlledInput initialValue="alpha beta alpha" />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    input.focus();
    input.setSelectionRange(2, 2);

    fireEvent.keyDown(input, { key: "d", ctrlKey: true });
    fireEvent.keyDown(input, { key: "d", ctrlKey: true });
    fireEvent.input(input, { target: { value: "alpha beta z" } });
    expect(input.value).toBe("z beta z");

    fireEvent.keyDown(input, { key: "z", ctrlKey: true });

    expect(input.value).toBe("alpha beta alpha");
  });
});
