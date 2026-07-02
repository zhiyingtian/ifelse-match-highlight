const vscode = require("vscode");

const PP_REGEX = /^\s*#\s*(if\b|ifdef\b|ifndef\b|elif\b|else\b|endif\b)/;

function activate(context) {
  console.log("[ifelse-match-highlight] activated");

  const config = vscode.workspace.getConfiguration("ifelseMatchHighlight");
  const bgColor = config.get("decorationColor");
  const bdColor = config.get("borderColor");

  const decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: bgColor,
    borderColor: bdColor,
    borderWidth: "1px",
    borderStyle: "solid",
    isWholeLine: true,
    overviewRulerColor: bdColor,
    overviewRulerLane: vscode.OverviewRulerLane.Right,
  });

  let activeEditor = vscode.window.activeTextEditor;

  function clearDecorations() {
    if (activeEditor) {
      activeEditor.setDecorations(decorationType, []);
    }
  }

  function updateHighlight() {
    if (!activeEditor) return;

    if (!config.get("enabled")) {
      clearDecorations();
      return;
    }

    const doc = activeEditor.document;
    const cursorLine = activeEditor.selection.active.line;
    const cursorText = doc.lineAt(cursorLine).text;

    if (!PP_REGEX.test(cursorText)) {
      clearDecorations();
      return;
    }

    const ppLines = [];
    for (let i = 0; i < doc.lineCount; i++) {
      const text = doc.lineAt(i).text;
      if (PP_REGEX.test(text)) {
        ppLines.push({ num: i, text });
      }
    }

    const stack = [];
    const groups = [];

    for (const line of ppLines) {
      const trimmed = line.text.trim();

      if (/^#\s*if\b/.test(trimmed) || /^#\s*ifdef\b/.test(trimmed) || /^#\s*ifndef\b/.test(trimmed)) {
        const group = { start: line, elifElse: [], end: null };
        stack.push(group);
        groups.push(group);
      } else if (/^#\s*elif\b/.test(trimmed) || /^#\s*else\b/.test(trimmed)) {
        if (stack.length > 0) {
          stack[stack.length - 1].elifElse.push(line);
        }
      } else if (/^#\s*endif\b/.test(trimmed)) {
        if (stack.length > 0) {
          stack[stack.length - 1].end = line;
          stack.pop();
        }
      }
    }

    let targetGroup = null;
    for (const group of groups) {
      if (group.start.num === cursorLine) {
        targetGroup = group;
        break;
      }
      if (group.end && group.end.num === cursorLine) {
        targetGroup = group;
        break;
      }
      for (const ee of group.elifElse) {
        if (ee.num === cursorLine) {
          targetGroup = group;
          break;
        }
      }
      if (targetGroup) break;
    }

    if (!targetGroup) {
      clearDecorations();
      return;
    }

    const ranges = [new vscode.Range(targetGroup.start.num, 0, targetGroup.start.num, 0)];
    if (targetGroup.end) {
      ranges.push(new vscode.Range(targetGroup.end.num, 0, targetGroup.end.num, 0));
    }
    for (const ee of targetGroup.elifElse) {
      ranges.push(new vscode.Range(ee.num, 0, ee.num, 0));
    }

    activeEditor.setDecorations(decorationType, ranges);
  }

  vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      activeEditor = editor;
      updateHighlight();
    },
    null,
    context.subscriptions
  );

  vscode.window.onDidChangeTextEditorSelection(
    (e) => {
      if (e.textEditor === activeEditor) {
        updateHighlight();
      }
    },
    null,
    context.subscriptions
  );

  vscode.workspace.onDidChangeConfiguration(
    (e) => {
      if (e.affectsConfiguration("ifelseMatchHighlight")) {
        const newBg = config.get("decorationColor");
        const newBd = config.get("borderColor");
        decorationType.dispose();
        const newType = vscode.window.createTextEditorDecorationType({
          backgroundColor: newBg,
          borderColor: newBd,
          borderWidth: "1px",
          borderStyle: "solid",
          isWholeLine: true,
          overviewRulerColor: newBd,
          overviewRulerLane: vscode.OverviewRulerLane.Right,
        });
        updateHighlight();
      }
    },
    null,
    context.subscriptions
  );

  if (activeEditor) {
    updateHighlight();
  }
}

function deactivate() {}

module.exports = { activate, deactivate };