import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CodeEditor } from "./CodeEditor";

function getEditorView(label: string): EditorView {
  const textbox = screen.getByRole("textbox", { name: label });
  const editorRoot = textbox.closest(".cm-editor");

  if (!editorRoot) {
    throw new Error("CodeMirror root not found");
  }

  const view = EditorView.findFromDOM(editorRoot as HTMLElement);
  if (!view) {
    throw new Error("CodeMirror view not found");
  }

  return view;
}

describe("CodeEditor", () => {
  it("renders a controlled editor and applies external value updates", async () => {
    const handleChange = vi.fn();
    const { rerender } = render(
      <CodeEditor ariaLabel="本文" placeholder="本文" value="alpha" onChange={handleChange} />,
    );

    const view = getEditorView("本文");
    expect(view.state.doc.toString()).toBe("alpha");

    view.dispatch({
      changes: { from: 5, insert: " beta" },
    });

    expect(handleChange).toHaveBeenCalledWith("alpha beta");

    rerender(
      <CodeEditor
        ariaLabel="本文"
        placeholder="本文"
        value="server-side replacement"
        onChange={handleChange}
      />,
    );

    const updatedView = getEditorView("本文");
    await waitFor(() => {
      expect(updatedView.state.doc.toString()).toBe("server-side replacement");
    });
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it("adds the next occurrence to the selection with Ctrl/Cmd+D", () => {
    render(<CodeEditor ariaLabel="本文" value="foo bar foo" onChange={vi.fn()} />);

    const view = getEditorView("本文");
    view.focus();
    view.dispatch({
      selection: EditorSelection.single(0, 3),
    });

    fireEvent.keyDown(view.contentDOM, { key: "d", ctrlKey: true });

    expect(view.state.selection.ranges).toHaveLength(2);
    expect(
      view.state.selection.ranges.map((range) => view.state.sliceDoc(range.from, range.to)),
    ).toEqual(["foo", "foo"]);
  });

  it("opens the search panel with Ctrl/Cmd+F", () => {
    render(<CodeEditor ariaLabel="本文" value="alpha beta" onChange={vi.fn()} />);

    const view = getEditorView("本文");
    view.focus();

    fireEvent.keyDown(view.contentDOM, { key: "f", ctrlKey: true });

    expect(screen.getByRole("textbox", { name: /find/i })).toBeInTheDocument();
  });
});
