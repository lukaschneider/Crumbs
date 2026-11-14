export type FilterOperation =
  | "selected"
  | "not"
  | "and"
  | "or"
  | "and-not"
  | "or-not";
export type FilterMode = "apply" | "prepare";
export interface FilterState {
  filter: string;
  revision: number;
  numRows: number;
}
export interface FilterValidation {
  valid: boolean;
  message?: string;
  warning?: string;
}
export interface FilterCompletion {
  text: string;
  description: string;
  kind: "field" | "operator" | "value";
}
export interface FilterCompletions {
  items: FilterCompletion[];
  from: number;
  to: number;
  sampled?: boolean;
}
