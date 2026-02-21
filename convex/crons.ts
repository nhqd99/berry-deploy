import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "health-check",
  { seconds: 30 },
  internal.docker.healthCheck,
);

export default crons;
