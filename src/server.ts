import { serve } from "./app";
import { error } from "./logger";

const PORT = 2091;

process.on("uncaughtException", err => {
  error("Uncaught exception occurred. Mock server will stop", err);
  setTimeout(() => process.exit(1), 500);
});

serve(PORT);
