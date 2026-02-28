const esbuild = require("esbuild");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const esbuildProblemMatcherPlugin = {
    name: 'esbuild-problem-matcher',
    setup(build) {
        build.onStart(() => console.log(`[watch] build started`));
        build.onEnd((result) => {
            result.errors.forEach(({ text, location }) => {
                console.error(`✘ [ERROR] ${text} (${location.file}:${location.line})`);
            });
            console.log(`[watch] build finished`);
        });
    },
};

async function main() {
    const extensionCtx = await esbuild.context({
        entryPoints: ['src/extension.ts'],
        bundle: true,
        format: 'cjs',
        minify: production,
        sourcemap: !production,
        platform: 'node',
        outfile: 'dist/extension.js',
        external: ['vscode'],
        plugins: [esbuildProblemMatcherPlugin],
        tsconfig: './tsconfig.json',
    });

    const frameListCtx = await esbuild.context({
        entryPoints: ['src/webview/frameList.tsx'],
        bundle: true,
        format: 'esm',
        minify: production,
        sourcemap: !production,
        platform: 'browser',
        outfile: 'dist/framelist.js',
        define: { 'process.env.NODE_ENV': production ? '"production"' : '"development"' },
        loader: { '.tsx': 'tsx', '.ts': 'ts' },
        plugins: [esbuildProblemMatcherPlugin],
        tsconfig: './src/webview/tsconfig.json',
    });

    const frameHexCtx = await esbuild.context({
        entryPoints: ['src/webview/frameHex.tsx'],
        bundle: true,
        format: 'esm',
        minify: production,
        sourcemap: !production,
        platform: 'browser',
        outfile: 'dist/framehex.js',
        define: { 'process.env.NODE_ENV': production ? '"production"' : '"development"' },
        loader: { '.tsx': 'tsx', '.ts': 'ts' },
        plugins: [esbuildProblemMatcherPlugin],
        tsconfig: './src/webview/tsconfig.json',
    });

    if (watch) {
        await Promise.all([extensionCtx.watch(), frameListCtx.watch(), frameHexCtx.watch()]);
    } else {
        await Promise.all([extensionCtx.rebuild(), frameListCtx.rebuild(), frameHexCtx.rebuild()]);
        await extensionCtx.dispose();
        await frameListCtx.dispose();
        await frameHexCtx.dispose();
    }
}

main().catch(e => { console.error(e); process.exit(1); });
