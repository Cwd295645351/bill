const concurrently = require("concurrently")

concurrently(["pnpm install --prefix frontend", "pnpm install --prefix server"])
