import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
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

  it("renders visible whitespace markers without changing the document", () => {
    render(
      <CodeEditor ariaLabel="本文" showWhitespace value={"A B\u3000C"} onChange={vi.fn()} />,
    );

    const view = getEditorView("本文");

    expect(view.state.doc.toString()).toBe("A B\u3000C");
    expect(view.dom.querySelector('[data-marker="·"]')).not.toBeNull();
    expect(view.dom.querySelector('[data-marker="□"]')).not.toBeNull();
  });

  it("keeps single-line editors on one line when Enter is pressed", async () => {
    const user = userEvent.setup();

    function ControlledEditor() {
      const [value, setValue] = useState("件名");

      return <CodeEditor ariaLabel="件名" singleLine value={value} onChange={setValue} />;
    }

    render(<ControlledEditor />);

    const textbox = screen.getByRole("textbox", { name: "件名" });
    await user.click(textbox);
    await user.keyboard("{End}{Enter}追記");

    expect(getEditorView("件名").state.doc.toString()).toBe("件名 追記");
    expect(getEditorView("件名").state.doc.toString()).not.toContain("\n");
  });

  it("normalizes pasted newlines in single-line editors", async () => {
    function ControlledEditor() {
      const [value, setValue] = useState("件名");

      return <CodeEditor ariaLabel="件名" singleLine value={value} onChange={setValue} />;
    }

    render(<ControlledEditor />);

    const view = getEditorView("件名");
    view.dispatch({
      changes: {
        from: view.state.doc.length,
        insert: "\n追記",
      },
    });

    await waitFor(() => {
      expect(view.state.doc.toString()).toBe("件名 追記");
    });
  });

  it("keeps focus through controlled Enter input", async () => {
    const user = userEvent.setup();

    function ControlledEditor() {
      const [value, setValue] = useState("alpha");

      return <CodeEditor ariaLabel="本文" value={value} onChange={setValue} />;
    }

    render(<ControlledEditor />);

    const textbox = screen.getByRole("textbox", { name: "本文" });
    await user.click(textbox);
    await user.keyboard("{End}{Enter}beta");

    expect(textbox).toHaveFocus();
    expect(getEditorView("本文").state.doc.toString()).toContain("\n");
  });
});
