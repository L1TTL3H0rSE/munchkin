import {readBody} from "h3";
import {studioGenerateRequestSchema} from "@munchkin/contracts";
import {defineStudioHandler} from "~~/server/utils/cardStudio/handler";

export default defineStudioHandler(async (event, service) => {
  const request = studioGenerateRequestSchema.parse(await readBody(event));
  const queued = await service.queueGeneration(request);
  if (queued.job.status === "queued") {
    setImmediate(() => {
      void service.runJob(queued.job.id).catch(() => undefined);
    });
  }
  return queued.job;
});
