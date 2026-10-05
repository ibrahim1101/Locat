// Set production mode without shell-specific environment assignment (Windows too).
process.env.NODE_ENV = "production";
await import("../dist/boot.js");
