import { completionContext } from "./filterSyntax";
import type {
  FilterCompletions,
  FilterValidation,
} from "./types/displayFilter";
import type {
  AnalyseResponse,
  CompleteResponse,
  FrameResponse,
  InfoResponse,
  SharkdClient,
  TreeNode,
} from "./types/sharkd";

type Session = {
  client: SharkdClient;
  analyse: AnalyseResponse;
  info: InfoResponse;
};
const maxValues = 40;
const maxFields = 64;
const fieldPattern = /^[a-zA-Z_][\w.-]*$/;
/** Only split column output for types whose literals cannot contain commas. */
export function columnLiterals(value: string, type: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => {
      if (/^FT_(?:U?INT\d+|FRAMENUM|FLOAT|DOUBLE|RELATIVE_TIME)$/.test(type)) {
        return /^(?:-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|0x[\da-fA-F]+)$/.test(
          item,
        );
      }
      if (type === "FT_BOOLEAN") {
        return /^(?:True|False|0|1)$/i.test(item);
      }
      if (type === "FT_IPv4") {
        return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(item);
      }
      if (type === "FT_IPv6") {
        return /^[\da-fA-F:.]+$/.test(item) && item.includes(":");
      }
      if (["FT_ETHER", "FT_EUI64"].includes(type)) {
        return /^(?:[\da-fA-F]{2}:){5,7}[\da-fA-F]{2}$/.test(item);
      }
      return false;
    });
}
export class CaptureFilters {
  #session?: SharkdClient;
  #completions = new Map<string, Promise<CompleteResponse>>();
  #values = new Map<string, Set<string>>();
  #samples = new Map<string, Promise<void>>();
  #trees = new Map<number, Promise<FrameResponse>>();
  constructor(private readonly load: () => Promise<Session>) {}
  async #load() {
    const session = await this.load();
    if (this.#session && this.#session !== session.client) {
      this.#completions.clear();
      this.#values.clear();
      this.#samples.clear();
      this.#trees.clear();
    }
    this.#session = session.client;
    return session;
  }
  async validate(filter: string): Promise<FilterValidation> {
    if (!filter.trim()) {
      return { valid: true };
    }
    const { client } = await this.#load();
    try {
      const result = await client.request("check", { filter });
      return { valid: true, warning: result.warning };
    } catch (error) {
      if ((error as { code?: number }).code === -5001) {
        return {
          valid: false,
          message:
            error instanceof Error
              ? error.message.replace(/^Filter invalid\s*-\s*/, "")
              : String(error),
        };
      }
      throw error;
    }
  }
  async count(filter: string) {
    const { client, analyse } = await this.#load();
    if (!filter) {
      return analyse.frames;
    }
    const result = await client.request("intervals", {
      filter,
      interval: 4294967295,
    });
    return result.frames;
  }
  observe(frame: FrameResponse) {
    const walk = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        const match = node.f?.match(/^([a-zA-Z_][\w.-]*)\s*==\s*([\s\S]+)$/);
        if (match) {
          const [, field, value] = match;
          let values = this.#values.get(field);
          if (!values) {
            if (this.#values.size >= 256) {
              this.#values.delete(this.#values.keys().next().value as string);
            }
            values = new Set();
            this.#values.set(field, values);
          }
          if (values.size < maxValues && value.length <= 512) {
            values.add(value);
          }
        }
        if (node.n) {
          walk(node.n);
        }
      }
    };
    walk(frame.tree ?? []);
  }
  #fields(client: SharkdClient, prefix: string) {
    let request = this.#completions.get(prefix);
    if (!request) {
      request = Promise.resolve(client.request("complete", { field: prefix }));
      if (this.#completions.size >= maxFields) {
        this.#completions.delete(
          this.#completions.keys().next().value as string,
        );
      }
      this.#completions.set(prefix, request);
      void request.catch(() => {
        if (this.#completions.get(prefix) === request) {
          this.#completions.delete(prefix);
        }
      });
    }
    return request;
  }
  async #sample(client: SharkdClient, field: string, type: string) {
    let sampling = this.#samples.get(field);
    if (!sampling) {
      sampling = (async () => {
        // Bound dissection work; never build a capture-wide value index on a keystroke.
        const rows = await client.request("frames", {
          limit: 256,
          column0: `${field}:0`,
        });
        if (this.#session !== client) {
          return;
        }
        const values = this.#values.get(field) ?? new Set<string>();
        let hasColumnValues = false;
        for (const row of rows) {
          for (const value of columnLiterals(row.c[0] ?? "", type)) {
            hasColumnValues = true;
            if (values.size < maxValues) {
              values.add(value);
            }
          }
        }
        if (hasColumnValues) {
          if (this.#values.size >= 256) {
            this.#values.delete(this.#values.keys().next().value as string);
          }
          this.#values.set(field, values);
          return;
        }
        const candidates = rows.filter((row) => row.c[0]).slice(0, 24);
        for (const row of candidates) {
          if (this.#session !== client) {
            return;
          }
          let tree = this.#trees.get(row.num);
          if (!tree) {
            tree = Promise.resolve(
              client.request("frame", {
                frame: row.num,
                proto: true,
                hidden: true,
              }),
            );
            if (this.#trees.size >= 32) {
              this.#trees.delete(this.#trees.keys().next().value as number);
            }
            this.#trees.set(row.num, tree);
            void tree.catch(() => {
              if (this.#trees.get(row.num) === tree) {
                this.#trees.delete(row.num);
              }
            });
          }
          const frame = await tree;
          if (this.#session === client) {
            this.observe(frame);
          }
          if ((this.#values.get(field)?.size ?? 0) >= maxValues) {
            break;
          }
        }
      })();
      if (this.#samples.size >= maxFields) {
        this.#samples.delete(this.#samples.keys().next().value as string);
      }
      this.#samples.set(field, sampling);
      void sampling.catch(() => {
        if (this.#samples.get(field) === sampling) {
          this.#samples.delete(field);
        }
      });
    }
    await sampling;
  }
  async complete(text: string, cursor: number): Promise<FilterCompletions> {
    const context = completionContext(text, cursor);
    const result: FilterCompletions = {
      from: context.from,
      to: context.to,
      items: [],
    };
    if (context.kind === "none") {
      return result;
    }
    const { client, analyse, info } = await this.#load();
    if (context.kind === "field") {
      if (!context.prefix) {
        result.items = analyse.protocols.slice(0, 30).map((text) => ({
          text,
          description: "Protocol in this capture",
          kind: "field",
        }));
        return result;
      }
      const response = await this.#fields(client, context.prefix);
      result.items = (response.field ?? []).slice(0, 30).map((field) => ({
        text: field.f,
        description: field.n ?? "Protocol",
        kind: "field",
      }));
    } else if (context.kind === "value") {
      if (!fieldPattern.test(context.field)) {
        return result;
      }
      const metadata = (await this.#fields(client, context.field)).field?.find(
        (item) => item.f === context.field,
      );
      if (!metadata) {
        return result;
      }
      await this.#sample(client, context.field, info.ftypes[metadata.t] ?? "");
      result.sampled = true;
      result.items = [...(this.#values.get(context.field) ?? [])]
        .filter((value) => {
          const prefix = context.prefix.toLowerCase();
          return (
            value.toLowerCase().startsWith(prefix) ||
            (!prefix.startsWith('"') &&
              value.startsWith('"') &&
              value.slice(1).toLowerCase().startsWith(prefix))
          );
        })
        .sort()
        .slice(0, 30)
        .map((text) => ({
          text,
          description: "Captured value",
          kind: "value",
        }));
    } else {
      let type: string | undefined;
      if (context.field) {
        const metadata = (
          await this.#fields(client, context.field)
        ).field?.find((item) => item.f === context.field);
        if (metadata) {
          type = info.ftypes[metadata.t];
        }
      }
      const operators: [string, string][] = [
        ["&&", "And"],
        ["||", "Or"],
      ];
      if (type && !["FT_PROTOCOL", "FT_NONE"].includes(type)) {
        operators.unshift(["==", "Equals"], ["!=", "Not equal"]);
        if (/INT|FLOAT|DOUBLE|TIME|FRAMENUM/.test(type)) {
          operators.push(
            [">", "Greater than"],
            [">=", "At least"],
            ["<", "Less than"],
            ["<=", "At most"],
          );
        }
        if (/STRING|BYTES/.test(type)) {
          operators.push(["contains", "Contains"]);
        }
        if (/STRING/.test(type)) {
          operators.push(["matches", "Matches regular expression"]);
        }
      }
      result.items = operators.map(([text, description]) => ({
        text: `${text} `,
        description,
        kind: "operator",
      }));
    }
    return result;
  }
}
