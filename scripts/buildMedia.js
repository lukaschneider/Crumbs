// Rasterize the editable icon and optionally encode a captioned screenshot tour.
// Usage: node scripts/buildMedia.js [path/to/frames/manifest.json]
const fs = require("node:fs/promises");
const path = require("node:path");
const { existsSync } = require("node:fs");
const { chromium } = require("playwright");
const { GIFEncoder, quantize, applyPalette } = require("gifenc");

async function main() {
  const root = path.join(__dirname, "..");
  const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CRUMBS_BROWSER
      ? { channel: process.env.CRUMBS_BROWSER }
      : existsSync(edge) ? { executablePath: edge } : {}),
  });
  try {
    const page = await browser.newPage();
    const svg = await fs.readFile(path.join(root, "media/icon.svg"));
    const icon = await page.evaluate(async (base64) => {
      const image = new Image();
      image.src = `data:image/svg+xml;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      canvas.getContext("2d").drawImage(image, 0, 0, 256, 256);
      return canvas.toDataURL("image/png").split(",")[1];
    }, svg.toString("base64"));
    await fs.writeFile(path.join(root, "media/icon.png"), Buffer.from(icon, "base64"));
    console.log("Rendered media/icon.png (256 × 256, transparent)");

    if (!process.argv[2]) return;
    const manifestPath = path.resolve(process.argv[2]);
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    if (!Array.isArray(manifest) || !manifest.length) throw new Error("The manifest must list at least one frame.");
    const frames = [];
    const width = 1200;
    const height = 800;
    for (const [index, frame] of manifest.entries()) {
      if (!Number.isFinite(frame.delay) || frame.delay < 20 || frame.delay > 60000 || typeof frame.caption !== "string") {
        throw new Error(`Invalid caption or duration for frame ${index}.`);
      }
      const file = path.resolve(path.dirname(manifestPath), frame.file);
      const png = await fs.readFile(file);
      const rgba = await page.evaluate(async ({ base64, caption, index, total, width, height }) => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        if (image.width !== width || image.height !== 742) throw new Error("Expected a 1200 × 742 screenshot.");
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#181b1e";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0);
        ctx.fillStyle = "#343a40";
        ctx.fillRect(0, 742, width, 1);
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#9ac3ae";
        ctx.font = '600 16px "Segoe UI", sans-serif';
        ctx.fillText("CRUMBS", 24, 771);
        ctx.fillStyle = "#e0e3e6";
        ctx.font = '18px "Segoe UI", sans-serif';
        ctx.fillText(caption, 130, 771);
        ctx.fillStyle = "#89949f";
        ctx.font = '14px "Segoe UI", sans-serif';
        ctx.textAlign = "right";
        ctx.fillText(`${String(index + 1).padStart(2, "0")} / ${total}`, width - 24, 771);
        const bytes = ctx.getImageData(0, 0, width, height).data;
        const chunks = [];
        for (let i = 0; i < bytes.length; i += 16384) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 16384)));
        return btoa(chunks.join(""));
      }, { base64: png.toString("base64"), caption: frame.caption, index, total: manifest.length, width, height });
      frames.push({ rgba: Buffer.from(rgba, "base64"), delay: frame.delay });
    }
    // One palette for the whole animation avoids color flicker between scenes.
    const sample = Buffer.alloc(frames.length * width * height);
    let offset = 0;
    for (const frame of frames) {
      for (let pixel = 0; pixel < frame.rgba.length; pixel += 16) {
        frame.rgba.copy(sample, offset, pixel, pixel + 4);
        offset += 4;
      }
    }
    const palette = quantize(sample, 256);
    const gif = GIFEncoder();
    frames.forEach((frame, index) => {
      gif.writeFrame(applyPalette(frame.rgba, palette), width, height, {
        ...(index === 0 ? { palette, repeat: 0 } : {}),
        delay: frame.delay,
      });
    });
    gif.finish();
    await fs.writeFile(path.join(root, "media/showcase.gif"), gif.bytes());
    const still = manifest.find((frame) => frame.still) ?? manifest[0];
    await fs.copyFile(path.resolve(path.dirname(manifestPath), still.file), path.join(root, "media/showcase.png"));
    console.log(`Encoded ${frames.length} scenes, ${frames.reduce((sum, f) => sum + f.delay, 0) / 1000}s, ${Math.round(gif.bytes().length / 1024)} KiB`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
