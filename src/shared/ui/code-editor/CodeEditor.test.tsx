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
    render(<CodeEditor ariaLabel="本文" showWhitespace value={"A B\u3000C"} onChange={vi.fn()} />);

    const view = getEditorView("本文");

    expect(view.state.doc.toString()).toBe("A B\u3000C");
    expect(view.dom.querySelector('[data-marker="·"]')).not.toBeNull();
    expect(view.dom.querySelector('[data-marker="□"]')).not.toBeNull();
  });

  it("renders line numbers when requested", () => {
    render(<CodeEditor ariaLabel="本文" showLineNumbers value={"a\nb"} onChange={vi.fn()} />);

    const view = getEditorView("本文");

    expect(view.dom.querySelector(".cm-lineNumbers")).not.toBeNull();
    expect(view.dom.querySelectorAll(".cm-gutterElement").length).toBeGreaterThan(0);
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

    await waitFor(() => {
      expect(getEditorView("件名").state.doc.toString()).toBe("件名 追記");
    });
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

  it("inserts soft tabs in multiline editors", async () => {
    const user = userEvent.setup();

    function ControlledEditor() {
      const [value, setValue] = useState("alpha");

      return <CodeEditor ariaLabel="本文" value={value} onChange={setValue} />;
    }

    render(
      <div>
        <ControlledEditor />
        <button type="button">次へ</button>
      </div>,
    );

    const textbox = screen.getByRole("textbox", { name: "本文" });
    await user.click(textbox);
    await user.keyboard("{End}{Tab}");

    await waitFor(() => {
      expect(getEditorView("本文").state.doc.toString()).toBe("alpha  ");
    });
    expect(textbox).toHaveFocus();
    expect(screen.getByRole("button", { name: "次へ" })).not.toHaveFocus();
    expect(getEditorView("本文").state.doc.toString()).not.toContain("\t");
  });

  it("inserts the configured number of spaces in multiline editors", async () => {
    const user = userEvent.setup();

    function ControlledEditor() {
      const [value, setValue] = useState("alpha");

      return (
        <CodeEditor
          ariaLabel="本文"
          editorSettings={{ indentStyle: "spaces", tabSize: 4 }}
          value={value}
          onChange={setValue}
        />
      );
    }

    render(<ControlledEditor />);

    const textbox = screen.getByRole("textbox", { name: "本文" });
    await user.click(textbox);
    await user.keyboard("{End}{Tab}");

    await waitFor(() => {
      expect(getEditorView("本文").state.doc.toString()).toBe("alpha    ");
    });
    expect(getEditorView("本文").state.tabSize).toBe(4);
  });

  it("inserts tab characters when configured for tab indentation", async () => {
    const user = userEvent.setup();

    function ControlledEditor() {
      const [value, setValue] = useState("alpha");

      return (
        <CodeEditor
          ariaLabel="本文"
          editorSettings={{ indentStyle: "tabs", tabSize: 4 }}
          value={value}
          onChange={setValue}
        />
      );
    }

    render(<ControlledEditor />);

    const textbox = screen.getByRole("textbox", { name: "本文" });
    await user.click(textbox);
    await user.keyboard("{End}{Tab}");

    await waitFor(() => {
      expect(getEditorView("本文").state.doc.toString()).toBe("alpha\t");
    });
    expect(getEditorView("本文").state.tabSize).toBe(4);
  });

  it("moves focus out of multiline editors after Ctrl+M toggle and Tab", async () => {
    const user = userEvent.setup();

    function ControlledEditor() {
      const [value, setValue] = useState("alpha");

      return <CodeEditor ariaLabel="本文" value={value} onChange={setValue} />;
    }

    render(
      <div>
        <ControlledEditor />
        <button type="button">次へ</button>
      </div>,
    );

    const textbox = screen.getByRole("textbox", { name: "本文" });
    await user.click(textbox);
    fireEvent.keyDown(textbox, { key: "m", ctrlKey: true });
    await user.tab();

    expect(screen.getByRole("button", { name: "次へ" })).toHaveFocus();
    expect(getEditorView("本文").state.doc.toString()).toBe("alpha");
  });

  it("moves focus backward from multiline editors after Ctrl+M toggle and Shift+Tab", async () => {
    const user = userEvent.setup();

    function ControlledEditor() {
      const [value, setValue] = useState("alpha");

      return <CodeEditor ariaLabel="本文" value={value} onChange={setValue} />;
    }

    render(
      <div>
        <button type="button">前へ</button>
        <ControlledEditor />
      </div>,
    );

    const textbox = screen.getByRole("textbox", { name: "本文" });
    await user.click(textbox);
    fireEvent.keyDown(textbox, { key: "m", ctrlKey: true });
    await user.tab({ shift: true });

    expect(screen.getByRole("button", { name: "前へ" })).toHaveFocus();
    expect(getEditorView("本文").state.doc.toString()).toBe("alpha");
  });

  it("moves focus out of multiline editors when tab focus mode is enabled through view.setTabFocusMode(true)", async () => {
    const user = userEvent.setup();

    function ControlledEditor() {
      const [value, setValue] = useState("alpha");

      return <CodeEditor ariaLabel="本文" value={value} onChange={setValue} />;
    }

    render(
      <div>
        <ControlledEditor />
        <button type="button">次へ</button>
      </div>,
    );

    const textbox = screen.getByRole("textbox", { name: "本文" });
    await user.click(textbox);
    getEditorView("本文").setTabFocusMode(true);
    await user.tab();

    expect(screen.getByRole("button", { name: "次へ" })).toHaveFocus();
    expect(getEditorView("本文").state.doc.toString()).toBe("alpha");
  });

  it("moves focus backward when tab focus mode is temporarily enabled through view.setTabFocusMode(2000)", async () => {
    const user = userEvent.setup();

    function ControlledEditor() {
      const [value, setValue] = useState("alpha");

      return <CodeEditor ariaLabel="本文" value={value} onChange={setValue} />;
    }

    render(
      <div>
        <button type="button">前へ</button>
        <ControlledEditor />
      </div>,
    );

    const textbox = screen.getByRole("textbox", { name: "本文" });
    await user.click(textbox);
    getEditorView("本文").setTabFocusMode(2000);
    await user.tab({ shift: true });

    expect(screen.getByRole("button", { name: "前へ" })).toHaveFocus();
    expect(getEditorView("本文").state.doc.toString()).toBe("alpha");
  });

  it("moves focus out of multiline editors after Escape temporarily enables tab focus mode", async () => {
    const user = userEvent.setup();

    function ControlledEditor() {
      const [value, setValue] = useState("alpha");

      return <CodeEditor ariaLabel="本文" value={value} onChange={setValue} />;
    }

    render(
      <div>
        <ControlledEditor />
        <button type="button">次へ</button>
      </div>,
    );

    const textbox = screen.getByRole("textbox", { name: "本文" });
    await user.click(textbox);
    fireEvent.keyDown(textbox, { key: "Escape" });
    await user.tab();

    expect(screen.getByRole("button", { name: "次へ" })).toHaveFocus();
    expect(getEditorView("本文").state.doc.toString()).toBe("alpha");
  });

  it("does not indent selection while tab focus mode is enabled", () => {
    render(
      <div>
        <CodeEditor ariaLabel="本文" value={"alpha\nbeta"} onChange={vi.fn()} />
        <button type="button">次へ</button>
      </div>,
    );

    const textbox = screen.getByRole("textbox", { name: "本文" });
    const view = getEditorView("本文");
    view.focus();
    view.dispatch({
      selection: EditorSelection.single(0, view.state.doc.length),
    });

    fireEvent.keyDown(textbox, { key: "m", ctrlKey: true });
    fireEvent.keyDown(view.contentDOM, { key: "Tab" });

    expect(view.state.doc.toString()).toBe("alpha\nbeta");
  });

  it("restores soft tab insertion after view.setTabFocusMode(false)", () => {
    render(<CodeEditor ariaLabel="本文" value="alpha" onChange={vi.fn()} />);

    const view = getEditorView("本文");
    view.focus();
    view.dispatch({
      selection: EditorSelection.cursor(view.state.doc.length),
    });

    view.setTabFocusMode(true);
    view.setTabFocusMode(false);
    fireEvent.keyDown(view.contentDOM, { key: "Tab" });

    expect(view.state.doc.toString()).toBe("alpha  ");
  });

  it("cancels temporary tab focus mode after another key is pressed", () => {
    render(<CodeEditor ariaLabel="本文" value="alpha" onChange={vi.fn()} />);

    const view = getEditorView("本文");
    view.focus();
    view.dispatch({
      selection: EditorSelection.cursor(view.state.doc.length),
    });

    view.setTabFocusMode(2000);
    fireEvent.keyDown(view.contentDOM, { key: "a" });
    fireEvent.keyDown(view.contentDOM, { key: "Tab" });

    expect(view.state.doc.toString()).toBe("alpha  ");
  });

  it("restores soft tab insertion after temporary tab focus mode expires", () => {
    vi.useFakeTimers();

    try {
      render(<CodeEditor ariaLabel="本文" value="alpha" onChange={vi.fn()} />);

      const view = getEditorView("本文");
      view.focus();
      view.dispatch({
        selection: EditorSelection.cursor(view.state.doc.length),
      });

      view.setTabFocusMode(2000);
      vi.advanceTimersByTime(2001);
      fireEvent.keyDown(view.contentDOM, { key: "Tab" });

      expect(view.state.doc.toString()).toBe("alpha  ");
    } finally {
      vi.useRealTimers();
    }
  });

  it("restores soft tab insertion after toggling tab focus mode off", async () => {
    const user = userEvent.setup();

    function ControlledEditor() {
      const [value, setValue] = useState("alpha");

      return <CodeEditor ariaLabel="本文" value={value} onChange={setValue} />;
    }

    render(
      <div>
        <ControlledEditor />
        <button type="button">次へ</button>
      </div>,
    );

    const textbox = screen.getByRole("textbox", { name: "本文" });
    await user.click(textbox);
    fireEvent.keyDown(textbox, { key: "m", ctrlKey: true });
    fireEvent.keyDown(textbox, { key: "m", ctrlKey: true });
    await user.keyboard("{End}{Tab}");

    await waitFor(() => {
      expect(getEditorView("本文").state.doc.toString()).toBe("alpha  ");
    });
    expect(textbox).toHaveFocus();
  });

  it("restores shift-tab outdent after toggling tab focus mode off", () => {
    render(<CodeEditor ariaLabel="本文" value={"  alpha\n  beta"} onChange={vi.fn()} />);

    const textbox = screen.getByRole("textbox", { name: "本文" });
    const view = getEditorView("本文");
    view.focus();
    view.dispatch({
      selection: EditorSelection.single(0, view.state.doc.length),
    });

    fireEvent.keyDown(textbox, { key: "m", ctrlKey: true });
    fireEvent.keyDown(textbox, { key: "m", ctrlKey: true });
    fireEvent.keyDown(view.contentDOM, { key: "Tab", shiftKey: true });

    expect(view.state.doc.toString()).toBe("alpha\nbeta");
  });

  it("indents and outdents selected lines in multiline editors", async () => {
    render(<CodeEditor ariaLabel="本文" value={"alpha\nbeta"} onChange={vi.fn()} />);

    const view = getEditorView("本文");
    view.focus();
    view.dispatch({
      selection: EditorSelection.single(0, view.state.doc.length),
    });

    fireEvent.keyDown(view.contentDOM, { key: "Tab" });

    expect(view.state.doc.toString()).toBe("  alpha\n  beta");

    fireEvent.keyDown(view.contentDOM, { key: "Tab", shiftKey: true });

    expect(view.state.doc.toString()).toBe("alpha\nbeta");
  });

  it("indents and outdents selected lines with the configured space width", () => {
    render(
      <CodeEditor
        ariaLabel="本文"
        editorSettings={{ indentStyle: "spaces", tabSize: 4 }}
        value={"alpha\nbeta"}
        onChange={vi.fn()}
      />,
    );

    const view = getEditorView("本文");
    view.focus();
    view.dispatch({
      selection: EditorSelection.single(0, view.state.doc.length),
    });

    fireEvent.keyDown(view.contentDOM, { key: "Tab" });
    expect(view.state.doc.toString()).toBe("    alpha\n    beta");

    fireEvent.keyDown(view.contentDOM, { key: "Tab", shiftKey: true });
    expect(view.state.doc.toString()).toBe("alpha\nbeta");
  });

  it("outdents tab-indented lines when configured for tab indentation", () => {
    render(
      <CodeEditor
        ariaLabel="本文"
        editorSettings={{ indentStyle: "tabs", tabSize: 4 }}
        value={"\talpha\n\tbeta"}
        onChange={vi.fn()}
      />,
    );

    const view = getEditorView("本文");
    view.focus();
    view.dispatch({
      selection: EditorSelection.single(0, view.state.doc.length),
    });

    fireEvent.keyDown(view.contentDOM, { key: "Tab", shiftKey: true });
    expect(view.state.doc.toString()).toBe("alpha\nbeta");
  });

  it("reconfigures indentation behavior when editor settings props change", async () => {
    const user = userEvent.setup();

    function ControlledEditor({
      indentStyle,
      tabSize,
    }: {
      indentStyle: "spaces" | "tabs";
      tabSize: number;
    }) {
      const [value, setValue] = useState("alpha");

      return (
        <CodeEditor
          ariaLabel="本文"
          editorSettings={{ indentStyle, tabSize }}
          value={value}
          onChange={setValue}
        />
      );
    }

    const { rerender } = render(<ControlledEditor indentStyle="spaces" tabSize={2} />);

    const textbox = screen.getByRole("textbox", { name: "本文" });
    await user.click(textbox);
    await user.keyboard("{End}{Tab}");

    await waitFor(() => {
      expect(getEditorView("本文").state.doc.toString()).toBe("alpha  ");
    });

    rerender(<ControlledEditor indentStyle="tabs" tabSize={6} />);
    const view = getEditorView("本文");
    view.focus();
    view.dispatch({
      selection: EditorSelection.cursor(view.state.doc.length),
    });

    fireEvent.keyDown(view.contentDOM, { key: "Tab" });

    await waitFor(() => {
      expect(view.state.doc.toString()).toBe("alpha  \t");
    });
    expect(view.state.tabSize).toBe(6);
  });

  it("keeps single-line editors on focus navigation when Tab is pressed", async () => {
    const user = userEvent.setup();

    function ControlledEditor() {
      const [value, setValue] = useState("件名");

      return <CodeEditor ariaLabel="件名" singleLine value={value} onChange={setValue} />;
    }

    render(
      <div>
        <ControlledEditor />
        <button type="button">次へ</button>
      </div>,
    );

    const textbox = screen.getByRole("textbox", { name: "件名" });
    await user.click(textbox);
    await user.tab();

    expect(screen.getByRole("button", { name: "次へ" })).toHaveFocus();
    expect(getEditorView("件名").state.doc.toString()).toBe("件名");
  });

  it("focuses and selects the requested range", async () => {
    render(
      <CodeEditor
        ariaLabel="本文"
        selectionRequest={{ from: 6, key: 1, to: 10 }}
        value="alpha beta gamma"
        onChange={vi.fn()}
      />,
    );

    const view = getEditorView("本文");

    await waitFor(() => {
      expect(view.hasFocus).toBe(true);
      expect(view.state.selection.main.from).toBe(6);
      expect(view.state.selection.main.to).toBe(10);
    });
  });
});
