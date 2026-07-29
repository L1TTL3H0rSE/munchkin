import {getRouterParam, setHeader} from "h3";
import {StudioError} from "~~/server/utils/cardStudio/errors";
import {defineStudioHandler} from "~~/server/utils/cardStudio/handler";

export default defineStudioHandler(async (event, service) => {
  const jobID = getRouterParam(event, "id");
  if (!jobID) {
    throw new StudioError("NOT_FOUND", "Candidate не найден.", 404);
  }
  const image = await service.candidate(jobID);
  setHeader(event, "Content-Type", "image/webp");
  setHeader(event, "Cache-Control", "private, no-store");
  setHeader(event, "X-Content-Type-Options", "nosniff");
  return image;
});
