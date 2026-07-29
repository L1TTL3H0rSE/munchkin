import {getRouterParam} from "h3";
import {StudioError} from "~~/server/utils/cardStudio/errors";
import {defineStudioHandler} from "~~/server/utils/cardStudio/handler";

export default defineStudioHandler(async (event, service) => {
  const jobID = getRouterParam(event, "id");
  if (!jobID) {
    throw new StudioError("NOT_FOUND", "Job не найдена.", 404);
  }
  return service.getJob(jobID);
});
