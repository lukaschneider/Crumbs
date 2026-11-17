import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { TypedJSONRPCServerAndClient } from "json-rpc-2.0";
import type {
  FrameListMethods,
  FrameListWebviewMethods,
} from "../types/frameList";
import type {
  FilterCompletions,
  FilterState,
  FilterValidation,
} from "../types/displayFilter";
import { FilterToolbarIcon } from "./FilterToolbarIcon";

type Rpc = TypedJSONRPCServerAndClient<
  FrameListWebviewMethods,
  FrameListMethods
>;
const styles = `
.filter-bar { position: relative; z-index: 2; flex: none; margin: 0; border: 0; min-width: 0; padding: 8px 12px 0; font-family: var(--vscode-font-family); font-size: var(--vscode-font-size, 13px); color: var(--vscode-foreground); }
.filter-controls { display: flex; gap: 6px; align-items: center; }
.filter-input-wrap { display: flex; flex: 1; min-width: 0; align-items: center; gap: 6px; border: 1px solid var(--vscode-input-border, transparent); background: var(--vscode-input-background); color: var(--vscode-input-foreground); padding: 0 6px; border-radius: 2px; }
.filter-input-wrap:focus-within { border-color: var(--vscode-focusBorder); }
.filter-input-wrap.invalid { --filter-error-color: var(--vscode-errorForeground); border-color: var(--filter-error-color); }
.filter-input { min-width: 0; width: 100%; height: 24px; border: 0; padding: 0; background: transparent; color: inherit; font: var(--vscode-editor-font-size, 13px) var(--vscode-editor-font-family, monospace); }
.filter-input::placeholder { color: var(--vscode-input-placeholderForeground); }
.filter-input:focus { outline: 0; }
.filter-icon { width: 16px; height: 16px; flex: none; }
.filter-input-wrap > .filter-icon { opacity: .7; }
.filter-indicator { display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex: none; color: var(--vscode-testing-iconPassed, var(--vscode-foreground)); }
.filter-input-wrap.invalid .filter-indicator { color: var(--filter-error-color); }
.filter-invalid { color: var(--vscode-errorForeground); }
.filter-bar button { font: inherit; cursor: pointer; }
.filter-bar button:disabled { opacity: .5; cursor: default; }
.filter-bar button:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: 2px; }
.filter-toolbar-button { display: inline-flex; align-items: center; justify-content: center; flex: none; width: 24px; height: 24px; padding: 3px; border: 1px solid transparent; border-radius: 3px; color: var(--vscode-icon-foreground, var(--vscode-foreground)); background: transparent; }
.filter-toolbar-button:hover:not(:disabled), .filter-toolbar-button[aria-expanded=true] { background: var(--vscode-toolbar-hoverBackground); border-color: var(--vscode-toolbar-hoverOutline, transparent); }
.filter-toolbar-button:active:not(:disabled) { background: var(--vscode-toolbar-activeBackground); }
.filter-apply { flex: none; height: 26px; padding: 0 12px; border: 1px solid var(--vscode-button-border, transparent); border-radius: 2px; color: var(--vscode-button-foreground); background: var(--vscode-button-background); }
.filter-apply:hover:not(:disabled) { background: var(--vscode-button-hoverBackground); }
.filter-status { display: flex; padding: 5px 0 7px; font-size: 12px; color: var(--vscode-descriptionForeground); }
.filter-status > span { min-width: 0; overflow-wrap: anywhere; }
.filter-status .warning { color: var(--vscode-editorWarning-foreground); }
.filter-popup { position: absolute; left: 12px; top: 100%; display: flex; flex-direction: column; width: min(540px, calc(100% - 24px)); max-height: min(320px, 60vh); overflow: hidden; box-sizing: border-box; border: 1px solid var(--vscode-editorSuggestWidget-border); border-radius: 3px; background: var(--vscode-editorSuggestWidget-background, var(--vscode-editor-background)); color: var(--vscode-editorSuggestWidget-foreground, var(--vscode-foreground)); box-shadow: 0 4px 12px var(--vscode-widget-shadow); }
.filter-popup-label, .filter-popup-hint { flex: none; padding: 5px 8px; font-size: 11px; color: var(--vscode-descriptionForeground); }
.filter-popup-header { display: flex; flex: none; align-items: center; justify-content: space-between; padding-right: 4px; }
.filter-popup-list { min-height: 0; overflow: auto; padding: 2px; }
.filter-popup-hint { border-top: 1px solid var(--vscode-widget-border, transparent); }
.filter-option { width: 100%; min-width: 0; display: grid; grid-template-columns: minmax(0, 55fr) minmax(0, 45fr); align-items: center; gap: 12px; height: 24px; padding: 0 6px; border: 0; border-radius: 2px; background: transparent; color: inherit; text-align: left; }
.filter-option-label, .filter-option-description { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.filter-option-label { font-family: var(--vscode-editor-font-family, monospace); }
.filter-option-description { font-size: 12px; opacity: .7; }
.filter-option[aria-selected=true] { background: var(--vscode-editorSuggestWidget-selectedBackground); color: var(--vscode-editorSuggestWidget-selectedForeground); }
.filter-history-row { display: flex; align-items: center; border-radius: 2px; }
.filter-history-row:hover { background: var(--vscode-list-hoverBackground); color: var(--vscode-list-hoverForeground, inherit); }
.filter-history-row:focus-within { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
.filter-history-row .filter-option { display: flex; padding-left: 4px; }
.filter-history-row .filter-toolbar-button { color: inherit; }
@media (max-width: 450px) { .filter-bar { padding-left: 8px; padding-right: 8px; } .filter-controls { gap: 4px; } .filter-apply { padding: 0 8px; } .filter-popup { left: 8px; width: calc(100% - 16px); } }
`;

export function FilterBar({
  rpc,
  state,
  initialHistory,
  onApplied,
}: {
  rpc: Rpc;
  state: FilterState;
  initialHistory: string[];
  onApplied: (state: FilterState) => void;
}) {
  const [draft, setDraft] = useState(state.filter);
  const [cursor, setCursor] = useState(state.filter.length);
  const [history, setHistory] = useState(initialHistory);
  const [validation, setValidation] = useState<FilterValidation | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [popup, setPopup] = useState<"suggestions" | "history" | null>(null);
  const [completions, setCompletions] = useState<FilterCompletions | null>(
    null,
  );
  const [completing, setCompleting] = useState(false);
  const [completionError, setCompletionError] = useState("");
  const [option, setOption] = useState(0);
  const root = useRef<HTMLFieldSetElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const suggestionList = useRef<HTMLDivElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const applying = useRef(0);
  const listId = useId();
  const statusId = useId();
  const changed = draft.trim() !== state.filter;

  useLayoutEffect(() => {
    if (pendingCaret.current !== null) {
      // Restore the caret in the committed value before another key can arrive.
      // Focusing here must not reopen a popup we intentionally dismissed.
      input.current?.focus();
      input.current?.setSelectionRange(
        pendingCaret.current,
        pendingCaret.current,
      );
      pendingCaret.current = null;
    }
  });

  useEffect(() => {
    setDraft(state.filter);
    setCursor(state.filter.length);
    setError("");
    setPopup(null);
  }, [state]);
  useEffect(() => {
    rpc.addMethod("history", setHistory);
    rpc.addMethod("prepareFilter", ({ filter }) => {
      applying.current++;
      setBusy(false);
      setDraft(filter);
      setCursor(filter.length);
      setError("");
      input.current?.focus();
      setPopup(null);
    });
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setPopup(null);
      }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => {
      applying.current++;
      rpc.removeMethod("history");
      rpc.removeMethod("prepareFilter");
      document.removeEventListener("pointerdown", dismiss);
    };
  }, [rpc]);
  useEffect(() => {
    let active = true;
    setError("");
    if (!draft.trim()) {
      setValidation({ valid: true });
      return;
    }
    setValidation(null);
    const timer = setTimeout(() => {
      void Promise.resolve(
        rpc.request("validateFilter", { filter: draft }),
      ).then(
        (result) => {
          if (active) {
            setValidation(result);
          }
        },
        (reason) => {
          if (active) {
            setValidation({
              valid: false,
              message: `Couldn’t validate filter: ${String(reason)}`,
            });
          }
        },
      );
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [draft, rpc]);
  useEffect(() => {
    if (popup !== "suggestions") {
      return;
    }
    let active = true;
    setCompletions(null);
    setCompleting(true);
    setCompletionError("");
    setOption(0);
    const timer = setTimeout(() => {
      void Promise.resolve(
        rpc.request("completeFilter", { text: draft, cursor }),
      ).then(
        (result) => {
          if (active) {
            setCompletions(result);
            setCompleting(false);
          }
        },
        (reason) => {
          if (active) {
            setCompleting(false);
            setCompletionError(`Suggestions unavailable: ${String(reason)}`);
          }
        },
      );
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [draft, cursor, popup, rpc]);

  const apply = async (text = draft) => {
    const attempt = ++applying.current;
    const restoreFocus = document.activeElement === input.current;
    setBusy(true);
    setError("");
    setPopup(null);
    try {
      const next = await rpc.request("applyFilter", { filter: text });
      if (attempt === applying.current) {
        setDraft(next.filter);
        onApplied(next);
      }
    } catch (reason) {
      if (attempt === applying.current) {
        setError(String(reason));
      }
    } finally {
      if (attempt === applying.current) {
        setBusy(false);
        if (restoreFocus) {
          requestAnimationFrame(() => {
            if (
              document.activeElement === document.body ||
              document.activeElement === input.current
            ) {
              input.current?.focus();
              setPopup(null);
            }
          });
        }
      }
    }
  };
  const insert = (index: number) => {
    const item = completions?.items[index];
    if (!item || !completions) {
      return;
    }
    const next =
      draft.slice(0, completions.from) +
      item.text +
      draft.slice(completions.to);
    const caret = completions.from + item.text.length;
    pendingCaret.current = caret;
    setDraft(next);
    setCursor(caret);
    // Operators already include their separator. Immediately offer the next
    // operand instead of waiting for the user to type an extra space.
    setPopup(item.kind === "operator" ? "suggestions" : null);
  };
  const editHistory = async (remove?: string) => {
    try {
      setHistory(await rpc.request("filterHistory", { remove }));
    } catch (reason) {
      setError(`Couldn’t update history: ${String(reason)}`);
    }
  };
  const invalid = validation?.valid === false;
  const message =
    error ||
    validation?.message ||
    (validation === null
      ? "Checking filter…"
      : validation.warning ||
        (busy
          ? "Applying filter…"
          : changed
            ? "Valid filter · Not applied"
            : state.filter
              ? "Filter applied"
              : "No display filter"));
  return (
    <fieldset
      className="filter-bar"
      aria-label="Display filter controls"
      ref={root}
      onBlur={(event) => {
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          setPopup(null);
        }
      }}
    >
      <style>{styles}</style>
      <div className="filter-controls">
        <div className={`filter-input-wrap${invalid ? " invalid" : ""}`}>
          <svg
            className="filter-icon"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path d="M2 2h12v2L9 9v4l-2 1V9L2 4Z" />
          </svg>
          <input
            ref={input}
            className="filter-input"
            data-vscode-context='{"preventDefaultContextMenuItems":false}'
            aria-label="Display filter"
            role="combobox"
            aria-autocomplete="list"
            aria-controls={listId}
            aria-expanded={popup === "suggestions"}
            aria-activedescendant={
              popup === "suggestions" && completions?.items[option]
                ? `${listId}-${option}`
                : undefined
            }
            aria-invalid={invalid}
            aria-describedby={statusId}
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
            value={draft}
            placeholder="Apply a display filter…"
            onChange={(event) => {
              setDraft(event.target.value);
              setCursor(
                event.target.selectionStart ?? event.target.value.length,
              );
              setPopup("suggestions");
            }}
            onSelect={(event) =>
              setCursor(event.currentTarget.selectionStart ?? draft.length)
            }
            onFocus={() => {
              if (pendingCaret.current === null) {
                setPopup("suggestions");
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setPopup(null);
                return;
              }
              if (event.key === "Enter") {
                event.preventDefault();
                if (!busy && !invalid) {
                  void apply();
                }
                return;
              }
              if (
                event.key === "Tab" &&
                !event.shiftKey &&
                popup === "suggestions" &&
                completions?.items[option]
              ) {
                event.preventDefault();
                insert(option);
                return;
              }
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setPopup("suggestions");
                const next = Math.max(
                  0,
                  Math.min(
                    (completions?.items.length ?? 1) - 1,
                    option + (event.key === "ArrowDown" ? 1 : -1),
                  ),
                );
                setOption(next);
                suggestionList.current?.children[next]?.scrollIntoView({
                  block: "nearest",
                });
              }
            }}
          />
          <span className="filter-indicator" aria-hidden="true">
            {(invalid || (validation?.valid && draft)) && (
              <svg
                className="filter-icon"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                {invalid ? (
                  <>
                    <path d="M8 3.5V9" />
                    <circle
                      cx="8"
                      cy="12.5"
                      r=".75"
                      fill="currentColor"
                      stroke="none"
                    />
                  </>
                ) : (
                  <path d="m3 8 3 3 7-7" />
                )}
              </svg>
            )}
          </span>
        </div>
        <button
          className="filter-toolbar-button"
          type="button"
          disabled={busy}
          aria-label="Recent filters"
          title="Recent filters"
          aria-expanded={popup === "history"}
          onClick={() =>
            setPopup((previous) => (previous === "history" ? null : "history"))
          }
        >
          <FilterToolbarIcon name="history" />
        </button>
        <button
          className="filter-apply"
          type="button"
          disabled={busy || invalid || !changed}
          onClick={() => {
            void apply();
          }}
        >
          {busy ? "Applying…" : "Apply"}
        </button>
      </div>
      <div className="filter-status" id={statusId} aria-live="polite">
        <span
          className={
            invalid || error
              ? "filter-invalid"
              : validation?.warning
                ? "warning"
                : ""
          }
        >
          {message}
        </span>
      </div>
      {popup === "suggestions" && (
        <div className="filter-popup">
          <div className="filter-popup-label">
            {completions?.sampled
              ? "Captured values (sampled packets)"
              : completions?.items[0]?.kind === "operator"
                ? "Operators"
                : "Protocols and fields"}
          </div>
          <div
            className="filter-popup-list"
            ref={suggestionList}
            id={listId}
            role="listbox"
            aria-label="Filter suggestions"
          >
            {completions?.items.map((item, index) => (
              <button
                key={`${item.kind}:${item.text}`}
                className="filter-option"
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === option}
                type="button"
                tabIndex={-1}
                title={`${item.text.trim()} — ${item.description}`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseMove={() => setOption(index)}
                onClick={() => insert(index)}
              >
                <span className="filter-option-label">{item.text}</span>
                <span className="filter-option-description">
                  {item.description}
                </span>
              </button>
            ))}
          </div>
          {(completing || completionError || !completions?.items.length) && (
            <div className="filter-popup-label">
              {completing
                ? "Loading suggestions…"
                : completionError || "No suggestions"}
            </div>
          )}
          <div className="filter-popup-hint">
            ↑ ↓ to choose · Tab to insert · Enter to apply · Esc to dismiss
          </div>
        </div>
      )}
      {popup === "history" && (
        <section className="filter-popup" aria-label="Recent display filters">
          <div className="filter-popup-header">
            <span className="filter-popup-label">Recent filters</span>
            <button
              className="filter-toolbar-button"
              type="button"
              aria-label="Clear history"
              title="Clear history"
              disabled={!history.length}
              onClick={() => {
                void editHistory();
              }}
            >
              <FilterToolbarIcon name="close-all" />
            </button>
          </div>
          <div className="filter-popup-list">
            {history.map((filter) => (
              <div className="filter-history-row" key={filter}>
                <button
                  className="filter-toolbar-button"
                  type="button"
                  aria-label={`Remove ${filter} from history`}
                  title="Remove from history"
                  onClick={() => {
                    void editHistory(filter);
                  }}
                >
                  <FilterToolbarIcon name="close" />
                </button>
                <button
                  type="button"
                  className="filter-option"
                  title={filter}
                  onClick={() => {
                    setDraft(filter);
                    setCursor(filter.length);
                    input.current?.focus();
                    setPopup(null);
                  }}
                >
                  <span className="filter-option-label">{filter}</span>
                </button>
              </div>
            ))}
            {!history.length && (
              <div className="filter-popup-label">
                No recently applied filters
              </div>
            )}
          </div>
          <div className="filter-popup-hint">
            Choose a filter to edit it, then press Enter to apply.
          </div>
        </section>
      )}
    </fieldset>
  );
}
