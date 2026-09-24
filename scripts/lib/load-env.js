// Import first in scripts: ES imports run in order, so env is set before server modules read it.
import dotenv from "dotenv";
dotenv.config({ path: [".env.local", ".env"], quiet: true });
