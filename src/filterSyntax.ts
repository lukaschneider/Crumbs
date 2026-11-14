import type { FilterOperation } from "./types/displayFilter";

export const filterOperations: FilterOperation[] = [
  "selected",
  "not",
  "and",
  "or",
  "and-not",
  "or-not",
];
export function combineFilter(
  current: string,
  selected: string,
  operation: FilterOperation,
) {
  const expression = selected.trim();
  if (!expression || !filterOperations.includes(operation)) {
    throw new Error("Invalid filter operation");
  }
  if (operation === "selected") {
    return expression;
  }
  if (operation === "not") {
    return `!(${expression})`;
  }
  const operand = operation.endsWith("-not")
    ? `!(${expression})`
    : `(${expression})`;
  return current.trim()
    ? `(${current.trim()}) ${operation.startsWith("and") ? "&&" : "||"} ${operand}`
    : operation.endsWith("-not")
      ? operand
      : expression;
}

interface Token {
  text: string;
  start: number;
  end: number;
}
function tokens(text: string): Token[] {
  const result: Token[] = [];
  const pattern =
    /"(?:\\.|[^"\\])*"?|(?:===|!==|==|!=|>=|<=|&&|\|\||[(){}!<>])|[^\s(){}!<>=&|]+/g;
  for (const match of text.matchAll(pattern)) {
    result.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return result;
}
const comparisons = new Set([
  "==",
  "!=",
  "===",
  "!==",
  ">",
  "<",
  ">=",
  "<=",
  "eq",
  "ne",
  "gt",
  "lt",
  "ge",
  "le",
  "contains",
  "matches",
]);
const logical = new Set(["&&", "||", "!", "and", "or", "not", "("]);
export function completionContext(text: string, cursor: number) {
  const position = Math.max(0, Math.min(text.length, cursor));
  const before = tokens(text.slice(0, position));
  const last = before.at(-1);
  const editing =
    last &&
    last.end === position &&
    !comparisons.has(last.text) &&
    !logical.has(last.text) &&
    !["(", ")", "{", "}"].includes(last.text)
      ? before.pop()
      : undefined;
  const full = editing
    ? tokens(text).find((t) => t.start === editing.start)
    : undefined;
  const range = {
    from: editing?.start ?? position,
    to: full?.end ?? position,
    prefix: editing?.text ?? "",
  };
  const previous = before.at(-1);
  if (previous && comparisons.has(previous.text)) {
    const field = before.at(-2)?.text;
    if (field && /^[a-zA-Z_][\w.-]*$/.test(field)) {
      return {
        ...range,
        kind: "value" as const,
        field,
        operator: previous.text,
      };
    }
  }
  if (editing?.text.startsWith('"')) {
    return { ...range, kind: "none" as const };
  }
  if (!editing && previous && !logical.has(previous.text)) {
    const field =
      /^[a-zA-Z_][\w.-]*$/.test(previous.text) &&
      !comparisons.has(before.at(-2)?.text ?? "")
        ? previous.text
        : undefined;
    return { ...range, kind: "operator" as const, field };
  }
  return { ...range, kind: "field" as const };
}
