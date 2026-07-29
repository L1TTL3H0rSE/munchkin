import {getRouterParam, readBody} from "h3";
import {studioApproveRequestSchema} from "@munchkin/contracts";
import {StudioError} from "~~/server/utils/cardStudio/errors";
import {defineStudioHandler} from "~~/server/utils/cardStudio/handler";

export default defineStudioHandler(async (event, service) => {
  const jobID = getRouterParam(event, "id");
  if (!jobID) {
    throw new StudioError("NOT_FOUND", "Job не найдена.", 404);
  }
  const request = studioApproveRequestSchema.parse(await readBody(event));
  return service.approve(jobID, request);
});
