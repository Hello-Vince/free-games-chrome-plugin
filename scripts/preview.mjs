import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const port = 4173;
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png"
};

createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
    const relativePath = pathname === "/" ? "popup.html" : decodeURIComponent(pathname.slice(1));
    const filePath = resolve(root, relativePath);
    if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) throw new Error("Invalid path");
    if (!(await stat(filePath)).isFile()) throw new Error("Not a file");

    let content = await readFile(filePath);
    if (relativePath === "popup.html") {
      content = Buffer.from(
        content.toString("utf8").replace(
          '<script type="module" src="src/popup.js"></script>',
          '<script type="module" src="test/browser-mock.js"></script>\n    <script type="module" src="src/popup.js"></script>'
        )
      );
    }
    response.writeHead(200, { "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream" });
    response.end(content);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Preview running at http://127.0.0.1:${port}/`);
});
