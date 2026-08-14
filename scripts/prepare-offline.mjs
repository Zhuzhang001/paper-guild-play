import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const out = path.join(root, "out");

await mkdir(out, { recursive: true });
try {
  await readFile(path.join(out, "index.html"));
} catch {
  throw new Error(
    "Offline build is missing. Run `npm run build:static:offline` first.",
  );
}
await writeFile(
  path.join(out, "start-local.mjs"),
  `import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
const root=path.resolve(process.cwd());
const types={".html":"text/html; charset=utf-8",".js":"text/javascript",".css":"text/css",".json":"application/json",".webmanifest":"application/manifest+json",".png":"image/png",".webp":"image/webp",".woff2":"font/woff2",".m4a":"audio/mp4",".wav":"audio/wav"};
http.createServer(async(req,res)=>{try{if(req.method!=="GET"&&req.method!=="HEAD"){res.writeHead(405);res.end();return;}const pathname=decodeURIComponent(new URL(req.url??"/","http://local").pathname);const relative=pathname.replace(/^\\/+/,"");let file=path.resolve(root,relative);if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end("Forbidden");return;}try{if((await stat(file)).isDirectory())file=path.join(file,"index.html");}catch{if(path.extname(relative)){res.writeHead(404);res.end("Not found");return;}file=path.join(root,"index.html");}const body=await readFile(file);res.writeHead(200,{"content-type":types[path.extname(file)]||"application/octet-stream","cache-control":"no-store","x-content-type-options":"nosniff"});res.end(req.method==="HEAD"?undefined:body);}catch{res.writeHead(404);res.end("Not found");}}).listen(4173,"127.0.0.1",()=>console.log("纸上百工：http://127.0.0.1:4173"));
`,
  "utf8",
);
await writeFile(
  path.join(out, "离线测试说明.txt"),
  "纸上百工 v6.4 测试版 · 电脑端备用包\r\n\r\n请在本目录安装有 Node.js 的电脑上运行：node start-local.mjs\r\n然后打开 http://127.0.0.1:4173 。\r\n手机端首次成功进入后会逐步缓存已使用资源，可在弱网下再次打开。\r\n",
  "utf8",
);

// Keep a copy of the build identity beside the launcher for support checks.
const version = await readFile(path.join(root, "public", "version.json"));
await copyFile(path.join(root, "public", "version.json"), path.join(out, "version.json"));
if (!version.includes(Buffer.from('"6.4.1"'))) {
  throw new Error("Unexpected build version while preparing offline package.");
}
