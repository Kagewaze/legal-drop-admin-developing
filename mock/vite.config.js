/* eslint-env node */
// The portal's dev server, pointed at the local mock API instead of the real backend:
//
//   npm run mock:api      (terminal 1)  → http://127.0.0.1:4010/api/   synthetic data
//   npm run dev:mock      (terminal 2)  → http://127.0.0.1:5179
//
// ⚠️ DEV SERVER ONLY. The one thing this changes is what the browser receives for /env.js while
// this dev server runs. public/env.js, `npm run dev` and `npm run build` are untouched, so nothing
// here can reach a deployed build.
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

const api = process.env.MOCK_API_URL ?? "http://127.0.0.1:4010/api/";

export default defineConfig({
  root: fileURLToPath(new URL("..", import.meta.url)),
  plugins: [
    react(),
    {
      name: "mock-api-env",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if ((req.url ?? "").split("?")[0] !== "/env.js") return next();
          res.setHeader("Content-Type", "application/javascript");
          res.setHeader("Cache-Control", "no-store");
          res.end(`window.env = { REACT_APP_BASE_URL: ${JSON.stringify(api)} };`);
        });
      },
    },
  ],
  server: { host: "127.0.0.1", port: 5179, strictPort: true },
});
