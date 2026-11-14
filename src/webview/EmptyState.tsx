import { type ReactNode, useId } from "react";
import { EmptyStateIcon, type EmptyStateIconKind } from "./EmptyStateIcon";

const styles = `
.empty-state { box-sizing: border-box; min-height: 100%; display: flex; align-items: center; justify-content: center; padding: 32px 24px; text-align: center; font-family: var(--vscode-font-family, sans-serif); font-size: var(--vscode-font-size, 13px); color: var(--vscode-foreground, inherit); }
.empty-state-content { width: 100%; max-width: 420px; }
.empty-state-mark { display: block; width: 96px; height: 96px; margin: 0 auto 24px; color: var(--vscode-foreground, currentColor); opacity: .16; }
.empty-state h2 { margin: 0; font-size: 18px; font-weight: 400; line-height: 1.4; }
.empty-state p { margin: 10px auto 0; max-width: 380px; color: var(--vscode-descriptionForeground, #999); line-height: 1.6; }
.empty-state .empty-state-hint { margin-top: 12px; }
.empty-state-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px 18px; margin-top: 22px; }
.empty-state button { font: inherit; cursor: pointer; }
.empty-state .state-button { border: 1px solid var(--vscode-button-border, transparent); border-radius: 3px; padding: 6px 14px; color: var(--vscode-button-secondaryForeground, #ddd); background: var(--vscode-button-secondaryBackground, #333); }
.empty-state .state-button:hover { background: var(--vscode-button-secondaryHoverBackground, #444); }
.empty-state .state-link { border: 0; padding: 5px 0; background: transparent; color: var(--vscode-textLink-foreground, #8ab4f8); }
.empty-state .state-link:hover { color: var(--vscode-textLink-activeForeground, #a9c7fa); text-decoration: underline; }
.empty-state button:focus-visible, .empty-state summary:focus-visible { outline: 1px solid var(--vscode-focusBorder, #007fd4); outline-offset: 3px; }
.empty-state button:disabled { opacity: .5; cursor: default; }
.empty-state details { margin-top: 24px; color: var(--vscode-descriptionForeground, #999); font-size: 12px; text-align: left; }
.empty-state summary { width: fit-content; margin: 0 auto; cursor: pointer; }
.empty-state pre { white-space: pre-wrap; overflow-wrap: anywhere; font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; line-height: 1.5; padding: 12px; border: 1px solid var(--vscode-widget-border, #444); border-radius: 3px; }
.empty-state.compact { padding: 18px 24px; }
.empty-state.compact .empty-state-content { max-width: 340px; }
.empty-state.compact .empty-state-mark { width: 44px; height: 44px; margin-bottom: 12px; }
.empty-state.compact h2 { font-size: 14px; }
.empty-state.compact p { margin-top: 6px; }
body.vscode-high-contrast .empty-state-mark, body.vscode-high-contrast-light .empty-state-mark { opacity: .6; }
`;

interface Props {
  icon?: EmptyStateIconKind;
  title: string;
  description: string;
  hint?: string;
  details?: string;
  compact?: boolean;
  busy?: boolean;
  alert?: boolean;
  children?: ReactNode;
}

export function EmptyState({
  icon = "capture",
  title,
  description,
  hint,
  details,
  compact,
  busy,
  alert,
  children,
}: Props) {
  const titleId = useId();
  return (
    <>
      <style>{styles}</style>
      <section
        className={`empty-state${compact ? " compact" : ""}`}
        aria-labelledby={titleId}
        aria-busy={busy || undefined}
        role={alert ? "alert" : undefined}
      >
        <div className="empty-state-content">
          <EmptyStateIcon kind={icon} />
          <h2 id={titleId}>{title}</h2>
          <p>{description}</p>
          {hint && <p className="empty-state-hint">{hint}</p>}
          {children && <div className="empty-state-actions">{children}</div>}
          {details && (
            <details>
              <summary>Technical details</summary>
              <pre>{details}</pre>
            </details>
          )}
        </div>
      </section>
    </>
  );
}
