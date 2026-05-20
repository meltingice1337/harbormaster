export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startWorkers } = await import("@/lib/workers");
  await startWorkers();
}
