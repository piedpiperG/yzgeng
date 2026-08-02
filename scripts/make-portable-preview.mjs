import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const projectDir = process.cwd();
const exportDir = path.join(projectDir, 'out');
const previewDir = path.join(projectDir, 'local-preview');
const routeNames = ['publications', 'experience', 'awards'];
const publicPaths = ['avatar.jpg', 'favicon.svg', 'papers/'];

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(directory, extension, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(target, extension, files);
    } else if (entry.name.endsWith(extension)) {
      files.push(target);
    }
  }
  return files;
}

function rewritePage(html, filename) {
  const pageDir = path.dirname(filename);
  const relativeDir = path.relative(previewDir, pageDir);
  const depth = relativeDir ? relativeDir.split(path.sep).length : 0;
  const prefix = depth === 0 ? './' : '../'.repeat(depth);

  let rewritten = html
    .replaceAll('"/_next/', `"${prefix}_next/`)
    .replaceAll("'/_next/", `'${prefix}_next/`)
    .replaceAll('="/_next/', `="${prefix}_next/`);

  for (const publicPath of publicPaths) {
    rewritten = rewritten.replaceAll(`/${publicPath}`, `${prefix}${publicPath}`);
  }

  for (const route of routeNames) {
    rewritten = rewritten
      .replaceAll(`href="/${route}/"`, `href="${prefix}${route}/index.html"`)
      .replaceAll(`href="/${route}"`, `href="${prefix}${route}/index.html"`)
      .replaceAll(`\\"/${route}\\"`, `\\"${prefix}${route}/index.html\\"`)
      .replaceAll(`\\"/${route}/\\"`, `\\"${prefix}${route}/index.html\\"`);
  }

  rewritten = rewritten
    .replaceAll('href="/"', `href="${prefix}index.html"`)
    .replaceAll('\\"/\\"', `\\"${prefix}index.html\\"`);

  const portableNavigation = `<script>(function(){var p=${JSON.stringify(prefix)};window.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a");if(!a)return;var h=a.getAttribute("href");var r=h==="/"?"index.html":h&&h.match(/^\\/(publications|experience|awards)\\/?$/)?RegExp.$1+"/index.html":null;if(!r&&h&&h.endsWith(".html"))r=h;if(!r)return;e.preventDefault();e.stopImmediatePropagation();location.href=new URL(r.startsWith(".")?r:p+r,location.href).href},true)})()</script>`;

  return rewritten.replace('<head>', `<head>${portableNavigation}`);
}

if (!(await exists(path.join(exportDir, 'index.html')))) {
  throw new Error('Missing out/index.html. Run npm run build first.');
}

await rm(previewDir, { recursive: true, force: true });
await mkdir(previewDir, { recursive: true });
await cp(exportDir, previewDir, { recursive: true });

for (const htmlFile of await collectFiles(previewDir, '.html')) {
  const html = await readFile(htmlFile, 'utf8');
  await writeFile(htmlFile, rewritePage(html, htmlFile), 'utf8');
}

for (const runtimeFile of await collectFiles(path.join(previewDir, '_next', 'static', 'chunks'), '.js')) {
  const runtime = await readFile(runtimeFile, 'utf8');
  if (!runtime.includes('r.p="/_next/"')) {
    continue;
  }
  const portableRuntime = runtime.replace(
    'r.p="/_next/"',
    'r.p=new URL("../../",document.currentScript.src).href'
  );
  await writeFile(runtimeFile, portableRuntime, 'utf8');
}

console.log(`Portable preview created at ${path.join(previewDir, 'index.html')}`);
