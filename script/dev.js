const concurrently = require("concurrently")

concurrently(["npm run dev --prefix frontend", "npm run dev --prefix server"])
