import { expect, test, type Locator } from "@playwright/test";

declare global {
  interface Window {
    crumbsMessages: {
      method: string;
      params?: {
        frameId?: number;
        reveal?: boolean;
        setting?: string;
        filter?: string;
        text?: string;
        revision?: number;
      };
    }[];
    acquireVsCodeApi: () => {
      postMessage: (message: {
        id: number;
        method: string;
        params?: {
          filter?: string;
          text?: string;
          cursor?: number;
          remove?: string;
          startIndex?: number;
          endIndex?: number;
        };
      }) => void;
    };
    mutationCount: number;
    observer: MutationObserver;
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.crumbsMessages = [];
    let retried = false;
    let applied = "";
    let revision = 0;
    let history = ["dns", "tcp.port == 80"];
    const scenario = new URLSearchParams(location.search).get("scenario");
    const numRows =
      scenario === "empty"
        ? 0
        : scenario === "colors"
          ? 3
          : scenario === "selection-scroll"
            ? 300
            : 2;
    window.acquireVsCodeApi = () => ({
      postMessage(message) {
        window.crumbsMessages.push(message);
        if (message.method === "retry") {
          retried = true;
        }
        const failure =
          !retried &&
          (message.method === "init" && scenario === "missing"
            ? "Failed to start sharkd: spawn sharkd ENOENT"
            : message.method === "init" && scenario === "profile"
              ? 'Sharkd exited (1): Configuration profile "Test" does not exist'
              : message.method === "frames" && scenario === "paging"
                ? "The value for skip must be a positive integer"
                : "");
        if (failure) {
          setTimeout(
            () =>
              window.postMessage(
                {
                  jsonrpc: "2.0",
                  id: message.id,
                  error: { code: -32000, message: failure },
                },
                "*",
              ),
            0,
          );
          return;
        }
        let result: unknown = null;
        if (message.method === "init") {
          result =
            location.pathname === "/tree"
              ? { revision: 0, hasFrame: scenario === "no-fields" }
              : location.pathname === "/hex"
                ? {
                    revision: 0,
                    rowLength: 16,
                    setLength: 8,
                    enableRowWrap: true,
                    frame:
                      scenario === "empty"
                        ? null
                        : {
                            bytes: btoa("A".repeat(1_000_000)),
                            byteRanges: [
                              [0, 2],
                              [2, 2],
                            ],
                          },
                  }
                : {
                    numRows,
                    filterState: {
                      filter: applied,
                      revision,
                      numRows,
                    },
                    history,
                    columnHeaders: ["Number", "tcp.port", "Time"],
                    colorCoding: !new URLSearchParams(location.search).has(
                      "no-colors",
                    ),
                  };
        } else if (message.method === "frames") {
          result = {
            revision,
            frames: (scenario === "selection-scroll"
              ? Array.from(
                  {
                    length:
                      Math.min(message.params?.endIndex ?? 100, numRows) -
                      (message.params?.startIndex ?? 0),
                  },
                  (_, index) => {
                    const num = (message.params?.startIndex ?? 0) + index + 1;
                    return {
                      num,
                      c: [String(num), "TCP", "0.000001"],
                      bg: "123456",
                      fg: "ffffff",
                    };
                  },
                )
              : [
                  {
                    num: 10,
                    c: ["10", "001", "0.000000"],
                    bg: "f0f0f0",
                    fg: "101010",
                  },
                  { num: 11, c: ["11", "002", "0.000001"] },
                  ...(scenario === "colors"
                    ? [
                        {
                          num: 12,
                          c: ["12", "003", "0.000002"],
                          bg: "123456",
                          fg: "ffffff",
                        },
                      ]
                    : []),
                ]
            ).filter(
              (row) => !applied || (applied.includes("443") && row.num === 10),
            ),
          };
        } else if (message.method === "validateFilter") {
          const filter = message.params?.filter ?? "";
          result =
            filter.includes("invalid") || /==\s*$/.test(filter)
              ? { valid: false, message: "Expected a value after ==." }
              : { valid: true };
        } else if (message.method === "completeFilter") {
          const text = message.params?.text ?? "";
          const value = /==\s*$/.test(text);
          const field =
            !text || /(?:&&|\|\|)\s*$/.test(text) || /tcp\.$/.test(text);
          const operator = !value && !field && /\s$/.test(text);
          result = {
            from:
              value || operator || /(?:&&|\|\|)\s*$/.test(text)
                ? text.length
                : text.lastIndexOf(" ") + 1,
            to: text.length,
            sampled: value,
            items: value
              ? [
                  { text: "443", description: "Captured value", kind: "value" },
                  { text: "80", description: "Captured value", kind: "value" },
                ]
              : operator
                ? [
                    { text: "== ", description: "Equals", kind: "operator" },
                    { text: "&& ", description: "And", kind: "operator" },
                    { text: "|| ", description: "Or", kind: "operator" },
                  ]
                : [
                    {
                      text: "tcp.port",
                      description: "Source or destination port",
                      kind: "field",
                    },
                    {
                      text: "tcp.srcport",
                      description: "Source port",
                      kind: "field",
                    },
                  ],
          };
        } else if (message.method === "applyFilter") {
          applied = message.params?.filter?.trim() ?? "";
          revision++;
          if (applied) {
            history = [applied, ...history.filter((item) => item !== applied)];
          }
          window.postMessage(
            { jsonrpc: "2.0", method: "history", params: history },
            "*",
          );
          result = {
            filter: applied,
            revision,
            numRows: applied ? (applied.includes("443") ? 1 : 0) : 2,
          };
        } else if (message.method === "filterHistory") {
          history = message.params?.remove
            ? history.filter((item) => item !== message.params?.remove)
            : [];
          result = history;
        }
        setTimeout(
          () =>
            window.postMessage({ jsonrpc: "2.0", id: message.id, result }, "*"),
          0,
        );
      },
    });
  });
});

test("packet grid preserves values and focuses actual frame IDs under the webview CSP", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  await page.goto("/list");
  await expect(page.getByText("001", { exact: true })).toBeVisible();
  await expect(page.getByText("0.000000", { exact: true })).toBeVisible();
  const cell = page.locator('[row-index="0"] [role="gridcell"]').first();
  await cell.click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.crumbsMessages.find((message) => message.method === "focus")
            ?.params?.frameId,
      ),
    )
    .toBe(10);
  await cell.dblclick();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.crumbsMessages.filter((message) => message.method === "focus")
            .length,
      ),
    )
    .toBeGreaterThan(1);
  expect(errors).toEqual([]);
});

test("packet grid supports hjkl navigation and Enter reveals the focused packet", async ({
  page,
}) => {
  await page.goto("/list");
  const cell = (row: number, column: number) =>
    page.locator(`[row-index="${row}"] [role="gridcell"][col-id="${column}"]`);
  await cell(0, 0).click();
  await page.keyboard.press("j");
  await expect(cell(1, 0)).toBeFocused();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.crumbsMessages
            .filter((message) => message.method === "focus")
            .at(-1)?.params,
      ),
    )
    .toMatchObject({ frameId: 11, reveal: false });
  await page.keyboard.press("j");
  await expect(cell(1, 0)).toBeFocused();
  await page.keyboard.press("l");
  await expect(cell(1, 1)).toBeFocused();
  await page.keyboard.press("h");
  await expect(cell(1, 0)).toBeFocused();
  await page.keyboard.press("h");
  await expect(cell(1, 0)).toBeFocused();
  await page.keyboard.press("k");
  await expect(cell(0, 0)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(cell(1, 0)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.crumbsMessages
            .filter((message) => message.method === "focus")
            .at(-1)?.params,
      ),
    )
    .toMatchObject({ frameId: 11, reveal: true });
  const enterFocus = await page.evaluate(
    () =>
      window.crumbsMessages
        .filter((message) => message.method === "focus")
        .at(-1)?.params,
  );
  await cell(1, 0).dblclick();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.crumbsMessages
            .filter((message) => message.method === "focus")
            .at(-1)?.params,
      ),
    )
    .toEqual(enterFocus);
});

// Read rendered pixels, not just background-color: gradients and AG Grid's
// pseudo-elements can change the final result, especially with translucent themes.
async function rowAppearance(row: Locator) {
  const png = (await row.screenshot()).toString("base64");
  return row.evaluate(async (element, png) => {
    const image = new Image();
    image.src = `data:image/png;base64,${png}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Cannot sample the row screenshot");
    }
    context.drawImage(image, 0, 0);
    const cell = element.querySelector('[role="gridcell"]');
    if (!cell) {
      throw new Error("Missing packet cell");
    }
    const border = getComputedStyle(element, "::before");
    const pixel = (x: number, y: number) =>
      [...context.getImageData(x, y, 1, 1).data].slice(0, 3);
    return {
      background: [
        ...context.getImageData(8, Math.floor(image.height / 2), 1, 1).data,
      ].slice(0, 3),
      trailingBackground: [
        ...context.getImageData(
          image.width - 8,
          Math.floor(image.height / 2),
          1,
          1,
        ).data,
      ].slice(0, 3),
      foreground:
        getComputedStyle(cell)
          .color.match(/[\d.]+/g)
          ?.slice(0, 3)
          .map(Number) ?? [],
      topEdge: pixel(image.width - 8, 0),
      bottomEdge: pixel(image.width - 8, image.height - 1),
      outline: border.borderLeftColor,
      outlineStyle: border.borderLeftStyle,
      outlineWidth: border.borderLeftWidth,
    };
  }, png);
}

function contrast(a: number[], b: number[]) {
  const luminance = (rgb: number[]) =>
    rgb
      .map((channel) => {
        const value = channel / 255;
        return value <= 0.04045
          ? value / 12.92
          : ((value + 0.055) / 1.055) ** 2.4;
      })
      .reduce(
        (sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index],
        0,
      );
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function expectSameColor(actual: number[], expected: number[]) {
  // Alpha compositing and gradient dithering can round a channel by one level.
  expect(actual).toHaveLength(3);
  actual.forEach((channel, index) => {
    expect(Math.abs(channel - expected[index])).toBeLessThanOrEqual(1);
  });
}

const packetThemes = [
  {
    name: "matching-packet",
    background: "#1e1e1e",
    foreground: "#d4d4d4",
    hover: "#2a2d2e",
    selected: "#123456",
    selectedText: "#ffffff",
    inactive: "#37373d",
    outline: "#123456",
  },
  {
    name: "dark",
    background: "#1e1e1e",
    foreground: "#d4d4d4",
    hover: "#2a2d2e",
    selected: "#094771",
    selectedText: "#ffffff",
    inactive: "#37373d",
    outline: "#007fd4",
  },
  {
    name: "light",
    background: "#ffffff",
    foreground: "#333333",
    hover: "#e8e8e8",
    selected: "#0060c0",
    selectedText: "#ffffff",
    inactive: "#e4e6f1",
    outline: "#0060c0",
  },
  {
    name: "translucent",
    background: "#002b36",
    foreground: "#eee8d5",
    hover: "#ffffff18",
    selected: "#268bd255",
    selectedText: "#ffffff",
    inactive: "#93a1a130",
    outline: "#2aa198",
  },
  {
    name: "high-contrast-dark",
    background: "#000000",
    foreground: "#ffffff",
    hover: "transparent",
    selected: "transparent",
    selectedText: "#ffffff",
    inactive: "transparent",
    outline: "#f38518",
  },
  {
    name: "high-contrast-light",
    background: "#ffffff",
    foreground: "#000000",
    hover: "transparent",
    selected: "transparent",
    selectedText: "#000000",
    inactive: "transparent",
    outline: "#0f4a85",
  },
  {
    name: "minimal",
    background: "#202020",
    foreground: "#dddddd",
    hover: "initial",
    selected: "initial",
    selectedText: "initial",
    inactive: "initial",
    outline: "#dddddd",
  },
];

for (const theme of packetThemes) {
  test(`packet colors remain readable through hover, selection, and blur in ${theme.name} themes`, async ({
    page,
  }, testInfo) => {
    await page.goto("/list?scenario=colors");
    await page.addStyleTag({
      content: `:root {
      --vscode-editor-background: ${theme.background};
      --vscode-editor-foreground: ${theme.foreground};
      --vscode-editorPane-background: ${theme.background};
      --vscode-foreground: ${theme.foreground};
      --vscode-input-background: ${theme.background};
      --vscode-input-foreground: ${theme.foreground};
      --vscode-icon-foreground: ${theme.foreground};
      --vscode-tree-tableOddRowsBackground: ${theme.background};
      --vscode-list-hoverBackground: ${theme.hover};
      --vscode-list-hoverForeground: initial;
      --vscode-list-activeSelectionBackground: ${theme.selected};
      --vscode-list-activeSelectionForeground: ${theme.selectedText};
      --vscode-list-inactiveSelectionBackground: ${theme.inactive};
      --vscode-list-inactiveSelectionForeground: initial;
      --vscode-list-inactiveFocusOutline: initial;
      --vscode-list-focusOutline: ${theme.outline};
      --vscode-focusBorder: ${theme.outline};
      --vscode-contrastActiveBorder: ${theme.name.startsWith("high-contrast") ? theme.outline : "initial"};
      --vscode-editorActionList-background: #ffff00;
      --vscode-editorActionList-foreground: #00ffff;
    }`,
    });
    const light = page.locator('[row-index="0"]');
    const uncolored = page.locator('[row-index="1"]');
    const dark = page.locator('[row-index="2"]');
    await expect(dark.getByText("003", { exact: true })).toBeVisible();
    const checkReadable = async (row: Locator) => {
      const appearance = await rowAppearance(row);
      expect(
        contrast(appearance.foreground, appearance.background),
        JSON.stringify(appearance),
      ).toBeGreaterThanOrEqual(4.5);
      return appearance;
    };
    expect((await checkReadable(light)).background).toEqual([240, 240, 240]);
    expect((await checkReadable(dark)).background).toEqual([18, 52, 86]);
    await checkReadable(uncolored);
    await light.hover();
    const hoveredLight = await checkReadable(light);
    await dark.hover();
    const hoveredDark = await checkReadable(dark);
    expect(hoveredDark.background).toEqual(hoveredLight.background);
    expect(hoveredDark.foreground).toEqual(hoveredLight.foreground);
    await dark.getByRole("gridcell").first().click();
    await expect(dark).toHaveAttribute("aria-selected", "true");
    const selectedHovered = await checkReadable(dark);
    expectSameColor(
      selectedHovered.trailingBackground,
      selectedHovered.background,
    );
    expect(selectedHovered.outlineWidth).toBe("1px");
    expect(selectedHovered.outlineStyle).toBe("solid");
    expect(selectedHovered.outline).not.toBe("rgba(0, 0, 0, 0)");
    expect(
      contrast(
        selectedHovered.outline
          .match(/[\d.]+/g)
          ?.slice(0, 3)
          .map(Number) ?? [],
        selectedHovered.background,
      ),
    ).toBeGreaterThanOrEqual(3);
    await page.mouse.move(0, 0);
    const selected = await checkReadable(dark);
    expectSameColor(selected.background, selectedHovered.background);
    expect(selected.foreground).toEqual(selectedHovered.foreground);
    await light
      .getByRole("gridcell")
      .first()
      .click({ modifiers: ["Control"] });
    await expect(light).toHaveAttribute("aria-selected", "true");
    await expect(dark).toHaveAttribute("aria-selected", "true");
    await checkReadable(light);
    await checkReadable(dark);
    await uncolored.hover();
    await checkReadable(uncolored);
    await page.screenshot({
      path: testInfo.outputPath(`packet-selection-${theme.name}.png`),
    });
    // Joining separated selections must remove BOTH sides of each internal
    // boundary; deselecting the middle row restores two complete outlines.
    await uncolored
      .getByRole("gridcell")
      .first()
      .click({ modifiers: ["Control"] });
    await expect(uncolored).toHaveAttribute("aria-selected", "true");
    const firstInBlock = await checkReadable(light);
    const middleInBlock = await checkReadable(uncolored);
    const lastInBlock = await checkReadable(dark);
    expectSameColor(firstInBlock.bottomEdge, firstInBlock.background);
    expectSameColor(middleInBlock.topEdge, middleInBlock.background);
    expectSameColor(middleInBlock.bottomEdge, middleInBlock.background);
    expectSameColor(lastInBlock.topEdge, lastInBlock.background);
    expect(
      contrast(firstInBlock.topEdge, firstInBlock.background),
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrast(lastInBlock.bottomEdge, lastInBlock.background),
    ).toBeGreaterThanOrEqual(3);
    await page.screenshot({
      path: testInfo.outputPath(`packet-selection-block-${theme.name}.png`),
    });
    await page.getByRole("combobox", { name: "Display filter" }).focus();
    await page.keyboard.press("Escape");
    const inactive = await checkReadable(dark);
    expect(inactive.outlineStyle).toBe("solid");
    await dark.hover();
    expectSameColor(
      (await checkReadable(dark)).background,
      inactive.background,
    );
    await page.screenshot({
      path: testInfo.outputPath(`packet-selection-inactive-${theme.name}.png`),
    });
    const inactiveMiddle = await checkReadable(uncolored);
    expectSameColor(inactiveMiddle.topEdge, inactiveMiddle.background);
    expectSameColor(inactiveMiddle.bottomEdge, inactiveMiddle.background);
    await uncolored.getByRole("gridcell").first().focus();
    await page.keyboard.press("Space");
    await expect(uncolored).toHaveAttribute("aria-selected", "false");
    const firstSeparate = await checkReadable(light);
    const lastSeparate = await checkReadable(dark);
    expect(
      contrast(firstSeparate.bottomEdge, firstSeparate.background),
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrast(lastSeparate.topEdge, lastSeparate.background),
    ).toBeGreaterThanOrEqual(3);
  });
}

test("joined selection outlines survive scrolling across packet pages", async ({
  page,
}) => {
  await page.goto("/list?scenario=selection-scroll");
  const viewport = page.locator(".ag-grid-viewport");
  await expect(page.locator('[row-index="0"]')).toBeVisible();
  await viewport.evaluate((element) => {
    element.scrollTop = 95 * 30;
  });
  const first = page.locator('[row-index="99"]');
  const second = page.locator('[row-index="100"]');
  await expect(first.getByText("100", { exact: true })).toBeVisible();
  await expect(second.getByText("101", { exact: true })).toBeVisible();
  await first.getByRole("gridcell").first().click();
  await second
    .getByRole("gridcell")
    .first()
    .click({ modifiers: ["Control"] });
  await expect(second).toHaveAttribute("aria-selected", "true");
  const selected = await rowAppearance(first);
  expectSameColor(selected.bottomEdge, selected.background);
  await viewport.evaluate((element) => {
    element.scrollTop = 250 * 30;
  });
  await expect(
    page.locator('[row-index="250"]').getByText("251", { exact: true }),
  ).toBeVisible();
  await expect(first).toHaveCount(0);
  await viewport.evaluate((element) => {
    element.scrollTop = 95 * 30;
  });
  await expect(first).toHaveAttribute("aria-selected", "true");
  await expect(second).toHaveAttribute("aria-selected", "true");
  const restoredFirst = await rowAppearance(first);
  const restoredSecond = await rowAppearance(second);
  expectSameColor(restoredFirst.bottomEdge, restoredFirst.background);
  expectSameColor(restoredSecond.topEdge, restoredSecond.background);
  expect(await page.locator(".ag-row[row-index]").count()).toBeLessThan(60);
});

test("disabling packet colors keeps themed hover and selection readable", async ({
  page,
}) => {
  await page.goto("/list?scenario=colors&no-colors");
  const first = page.locator('[row-index="0"]');
  const last = page.locator('[row-index="2"]');
  await expect(last.getByText("003", { exact: true })).toBeVisible();
  expect((await rowAppearance(first)).background).toEqual(
    (await rowAppearance(last)).background,
  );
  await first.getByRole("gridcell").first().click();
  const selected = await rowAppearance(first);
  expect(
    contrast(selected.foreground, selected.background),
  ).toBeGreaterThanOrEqual(4.5);
  await last.hover();
  const hovered = await rowAppearance(last);
  expect(
    contrast(hovered.foreground, hovered.background),
  ).toBeGreaterThanOrEqual(4.5);
});

test("large hex packets stay virtualized, avoid same-field DOM changes, wrap, and reveal distant bytes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/hex");
  const first = page.getByRole("button", {
    name: "Hex byte 0: 41",
    exact: true,
  });
  await expect(first).toBeVisible();
  expect(await page.locator("[data-row]").count()).toBeLessThan(40);
  await first.hover();
  await page.evaluate(() => {
    window.mutationCount = 0;
    window.observer = new MutationObserver((records) => {
      window.mutationCount += records.length;
    });
    window.observer.observe(document.body, {
      attributes: true,
      subtree: true,
      childList: true,
    });
  });
  await page
    .getByRole("button", { name: "Hex byte 1: 41", exact: true })
    .hover();
  expect(await page.evaluate(() => window.mutationCount)).toBe(0);
  await page.evaluate(() => window.observer.disconnect());
  await page.setViewportSize({ width: 600, height: 400 });
  await expect(page.locator("[data-row]").first()).toHaveCSS("height", "48px");
  await page.evaluate(() =>
    window.postMessage(
      { jsonrpc: "2.0", method: "focus", params: { byteRange: [800000, 1] } },
      "*",
    ),
  );
  await expect(
    page.getByRole("button", { name: "Hex byte 800000: 41", exact: true }),
  ).toBeVisible();
  expect(await page.locator("[data-row]").count()).toBeLessThan(40);
  expect(errors).toEqual([]);
});

test("missing Wireshark offers settings, diagnostics, and a working retry without raw error banners", async ({
  page,
}, testInfo) => {
  await page.goto("/list?scenario=missing");
  await expect(
    page.getByRole("heading", { name: "Wireshark couldn’t be found" }),
  ).toBeVisible();
  await expect(page.getByRole("grid")).toHaveCount(0);
  await expect(page.locator("pre")).not.toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("capture-error.png") });
  await page.getByRole("button", { name: "Open settings" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.crumbsMessages.find(
            (message) => message.method === "openSettings",
          )?.params?.setting,
      ),
    )
    .toBe("sharkd");
  await page.getByRole("button", { name: "Show log" }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.crumbsMessages.some((message) => message.method === "showLog"),
      ),
    )
    .toBe(true);
  await page.getByText("Technical details", { exact: true }).click();
  await expect(page.locator("pre")).toContainText("ENOENT");
  await page.setViewportSize({ width: 360, height: 400 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("001", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("profile errors link to profile settings", async ({ page }) => {
  await page.goto("/list?scenario=profile");
  await expect(
    page.getByRole("heading", { name: "Wireshark profile unavailable" }),
  ).toBeVisible();
  await expect(page.getByText(/switch back to Default/)).toBeVisible();
  await page.getByRole("button", { name: "Open settings" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.crumbsMessages.find(
            (message) => message.method === "openSettings",
          )?.params?.setting,
      ),
    )
    .toBe("profile");
});

test("paging failures replace the grid with recovery guidance", async ({
  page,
}) => {
  await page.goto("/list?scenario=paging");
  await expect(
    page.getByRole("heading", { name: "Couldn’t load this capture" }),
  ).toBeVisible();
  await expect(page.getByRole("grid")).toHaveCount(0);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("001", { exact: true })).toBeVisible();
});

test("empty captures and unselected bytes have quiet placeholders", async ({
  page,
}, testInfo) => {
  await page.goto("/list?scenario=empty");
  await expect(
    page.getByRole("heading", { name: "This capture is empty" }),
  ).toBeVisible();
  await expect(page.getByRole("grid")).not.toBeVisible();
  await page.setViewportSize({ width: 600, height: 200 });
  await page.goto("/hex?scenario=empty");
  await expect(
    page.getByRole("heading", { name: "No packet selected" }),
  ).toBeVisible();
  await expect(
    page.getByText("Select a packet in the capture to inspect its bytes."),
  ).toBeVisible();
  expect(await page.locator("[data-row]").count()).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("hex-empty.png") });
});

test("Tree and Hex share the centered illustrated welcome state in light themes", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 600, height: 300 });
  const lightTheme =
    ":root { --vscode-foreground: #333; --vscode-editor-foreground: #333; --vscode-editor-background: #fafaff; --vscode-descriptionForeground: #616161; }";
  await page.goto("/tree");
  await page.addStyleTag({ content: lightTheme });
  await expect(
    page.getByRole("heading", { name: "No packet selected" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Select a packet in the capture to explore its protocol fields.",
    ),
  ).toBeVisible();
  const treeMark = await page.locator(".empty-state-mark").boundingBox();
  expect(treeMark).not.toBeNull();
  expect((treeMark?.x ?? 0) + (treeMark?.width ?? 0) / 2).toBeCloseTo(300, 0);
  await page.screenshot({
    path: testInfo.outputPath("tree-welcome-light.png"),
  });
  await page.evaluate(() =>
    window.postMessage(
      {
        jsonrpc: "2.0",
        method: "selection",
        params: { revision: 1, hasFrame: true },
      },
      "*",
    ),
  );
  await expect(
    page.getByRole("heading", { name: "No protocol fields to show" }),
  ).toBeVisible();
  await page.goto("/hex?scenario=empty");
  await page.addStyleTag({ content: lightTheme });
  await expect(
    page.getByRole("heading", { name: "No packet selected" }),
  ).toBeVisible();
  const hexMark = await page.locator(".empty-state-mark").boundingBox();
  expect(hexMark?.width).toBe(treeMark?.width);
  expect(hexMark?.x).toBe(treeMark?.x);
});

test("hex rows keep padding when wrapped, scrolling, and revealing the last byte", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 860, height: 320 });
  await page.goto("/hex");
  await expect(
    page.getByRole("button", { name: "Hex byte 0: 41", exact: true }),
  ).toBeVisible();
  // Both representations would fit at this width without the side gutters.
  await expect(page.locator("[data-row]").first()).toHaveCSS("height", "48px");
  const offset = await page.locator(".hex-offset").first().boundingBox();
  expect(offset?.x).toBe(16);
  expect(offset?.y).toBe(0);
  const gaps = await page
    .locator("[data-row]")
    .first()
    .evaluate((row) => {
      const offset = row.querySelector(".hex-offset")?.getBoundingClientRect();
      const bytes = row.querySelectorAll(".hex-bytes .hex-field");
      const first = bytes[0].getBoundingClientRect();
      const groupEnd = bytes[7].getBoundingClientRect();
      const nextGroup = bytes[8].getBoundingClientRect();
      return {
        address: first.left - (offset?.right ?? 0),
        group: nextGroup.left - groupEnd.right,
        trailingMargin: getComputedStyle(
          row.querySelector(".hex-bytes") as HTMLElement,
        ).marginRight,
      };
    });
  expect(gaps.address).toBeCloseTo(gaps.group, 1);
  expect(gaps.trailingMargin).toBe("0px");
  await page.setViewportSize({ width: 600, height: 320 });
  await page.addStyleTag({
    content:
      ":root { --vscode-editor-foreground: #333; --vscode-editor-background: #fafaff; --vscode-editorLineNumber-foreground: #666; }",
  });
  await page.screenshot({ path: testInfo.outputPath("hex-padding-light.png") });
  await page.evaluate(() =>
    window.postMessage(
      { jsonrpc: "2.0", method: "focus", params: { byteRange: [999999, 1] } },
      "*",
    ),
  );
  const last = page.getByRole("button", {
    name: "Hex byte 999999: 41",
    exact: true,
  });
  await expect(last).toBeVisible();
  const lastRect = await last.boundingBox();
  expect((lastRect?.y ?? 0) + (lastRect?.height ?? 0)).toBeLessThanOrEqual(
    320 - 12,
  );
  expect((await page.locator(".hex-offset").last().boundingBox())?.x).toBe(16);
  expect(await page.locator("[data-row]").count()).toBeLessThan(40);
});

test("display filters autocomplete, validate, apply, preserve invalid drafts, and recover from no matches", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  await page.goto("/list");
  const input = page.getByRole("combobox", { name: "Display filter" });
  await expect(page.getByText("001", { exact: true })).toBeVisible();
  await input.fill("tcp.");
  await expect(page.getByRole("option").first()).toContainText("tcp.port");
  await input.press("Tab");
  await expect(input).toHaveValue("tcp.port");
  await input.fill("tcp.port == ");
  await expect(page.getByRole("option").first()).toContainText("443");
  await page.screenshot({
    path: testInfo.outputPath("filter-value-suggestions.png"),
  });
  await input.press("Tab");
  await input.press("Enter");
  await expect(
    page.getByText("1 of 2 packets · Filter active", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("002", { exact: true })).toHaveCount(0);
  await page.locator('[row-index="0"] [role="gridcell"]').first().click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.crumbsMessages.filter((m) => m.method === "focus").at(-1)
            ?.params,
      ),
    )
    .toMatchObject({ frameId: 10, revision: 1 });
  await input.fill("tcp.port ==");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByRole("button", { name: "Apply", exact: true }),
  ).toBeDisabled();
  await input.press("Escape");
  await expect(page.getByText("001", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("filter-invalid.png") });
  await input.fill("dns");
  await expect(
    page.getByRole("button", { name: "Apply", exact: true }),
  ).toBeEnabled();
  await input.press("Enter");
  await expect(
    page.getByRole("heading", { name: "No packets match this filter" }),
  ).toBeVisible();
  await input.fill("");
  await input.press("Enter");
  await expect(page.getByText("002", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Clear display filter" }),
  ).toHaveCount(0);
  await expect(page.getByText(/^Applied:/)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Apply", exact: true }),
  ).toBeDisabled();
  expect(errors).toEqual([]);
});

test("filter history is editable and Prepare keeps the current results until Apply", async ({
  page,
}, testInfo) => {
  await page.goto("/list");
  const input = page.getByRole("combobox", { name: "Display filter" });
  await expect(page.getByText("001", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Recent filters", exact: true })
    .click();
  await page
    .getByRole("button", { name: "tcp.port == 80", exact: true })
    .click();
  await expect(input).toHaveValue("tcp.port == 80");
  await expect(page.getByText("2 of 2 packets", { exact: true })).toBeVisible();
  await page.evaluate(() =>
    window.postMessage(
      {
        jsonrpc: "2.0",
        method: "prepareFilter",
        params: { filter: "tcp.port == 443" },
      },
      "*",
    ),
  );
  await expect(input).toHaveValue("tcp.port == 443");
  await expect(page.getByText("2 of 2 packets", { exact: true })).toBeVisible();
  await input.press("Enter");
  await expect(
    page.getByText("1 of 2 packets · Filter active", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Recent filters", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Recent display filters" })
      .getByRole("button", { name: "tcp.port == 443", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("filter-history.png") });
  const historyRow = page.locator(".filter-history-row").first();
  await expect(historyRow.getByRole("button").first()).toHaveAccessibleName(
    "Remove tcp.port == 443 from history",
  );
  await expect(page.getByText(/This VS Code profile/)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Clear history", exact: true }),
  ).toHaveText("");
  await page
    .getByRole("button", {
      name: "Remove tcp.port == 443 from history",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Remove tcp.port == 443 from history",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Clear history", exact: true })
    .click();
  await expect(
    page.getByText("No recently applied filters", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 360, height: 400 });
  await page.addStyleTag({
    content:
      ":root { --vscode-foreground: #333; --vscode-icon-foreground: #424242; --vscode-descriptionForeground: #616161; --vscode-editor-foreground: #333; --vscode-editor-background: #fafaff; --vscode-input-background: #fff; --vscode-input-foreground: #333; --vscode-input-border: #bbb; --vscode-editorSuggestWidget-background: #fff; --vscode-editorSuggestWidget-foreground: #333; --vscode-editorSuggestWidget-selectedBackground: #dbeaff; --vscode-editorSuggestWidget-selectedForeground: #222; --vscode-button-background: #0078d4; --vscode-button-foreground: #fff; --vscode-editorSuggestWidget-border: #ccc; }",
  });
  await input.fill("tcp.");
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("filter-light-narrow.png"),
  });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
});

test("autocomplete chains after logical and comparison operators and keeps suggestion columns aligned", async ({
  page,
}, testInfo) => {
  await page.goto("/list");
  await page.addStyleTag({
    content:
      ":root { --vscode-editor-background: #0b2c36; --vscode-editor-foreground: #b7c4c8; --vscode-foreground: #b7c4c8; --vscode-icon-foreground: #b7c4c8; --vscode-input-background: #123d4b; --vscode-input-border: transparent; --vscode-editorSuggestWidget-background: #08232d; --vscode-editorSuggestWidget-selectedBackground: #235b6e; --vscode-button-background: #0e639c; --vscode-list-hoverBackground: #123d4b; }",
  });
  const input = page.getByRole("combobox", { name: "Display filter" });
  await input.fill("tcp ");
  await page.getByRole("option", { name: "&& And", exact: true }).click();
  await expect(input).toHaveValue("tcp && ");
  await expect(page.getByRole("option").first()).toContainText("tcp.port");
  await input.press("Tab");
  await expect(input).toHaveValue("tcp && tcp.port");
  await input.press("Space");
  await expect(page.getByRole("option").first()).toContainText("Equals");
  await input.press("Tab");
  await expect(input).toHaveValue("tcp && tcp.port == ");
  await expect(page.getByRole("option").first()).toContainText("443");
  await input.press("Tab");
  await expect(input).toHaveValue("tcp && tcp.port == 443");
  await input.press("Space");
  await expect(page.getByRole("option").first()).toContainText("Equals");
  await input.press("ArrowDown");
  await input.press("ArrowDown");
  await input.press("Tab");
  await expect(input).toHaveValue("tcp && tcp.port == 443 || ");
  await expect(page.getByRole("option").first()).toContainText("tcp.port");
  await expect(input).toBeFocused();
  const descriptions = await page
    .locator(".filter-option-description")
    .evaluateAll((elements) =>
      elements.map((el) => el.getBoundingClientRect().x),
    );
  expect(descriptions).toHaveLength(2);
  expect(descriptions[0]).toBe(descriptions[1]);
  await expect(page.locator(".filter-option-label").first()).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  await expect(page.locator(".filter-option-label").first()).toHaveCSS(
    "white-space",
    "nowrap",
  );
  await page.screenshot({
    path: testInfo.outputPath("filter-suggestions-teal.png"),
  });
  await input.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Recent filters", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "dns", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("filter-history-teal.png"),
  });
});
