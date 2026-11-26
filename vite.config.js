import { copyFileSync, cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const pages = [
  "index.html",
  "mapeadores.html",
  "metodo-120.html",
  "colaboradores.html",
  "comunidad.html",
  "tryjeanpc.html",
];

export default defineConfig({
  plugins: [{
    name: "copy-static-media",
    apply: "build",
    closeBundle() {
      for (const directory of ["Music", "MODULOS"]) {
        const source = resolve(projectRoot, directory);
        if (existsSync(source)) cpSync(source, resolve(projectRoot, "dist", directory), { recursive: true });
      }
      copyFileSync(resolve(projectRoot, "script.js"), resolve(projectRoot, "dist", "script.js"));
      const musicManifest = resolve(projectRoot, "music.json");
      if (existsSync(musicManifest)) copyFileSync(musicManifest, resolve(projectRoot, "dist", "music.json"));
    },
  }],
  build: {
    rollupOptions: {
      input: Object.fromEntries(
        pages.map((page) => [
          page.replace(/\.html$/, ""),
          fileURLToPath(new URL(page, import.meta.url)),
        ]),
      ),
    },
  },
});
