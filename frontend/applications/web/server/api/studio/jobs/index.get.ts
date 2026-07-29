import {getQuery} from "h3";
import {StudioError} from "~~/server/utils/cardStudio/errors";
import {defineStudioHandler} from "~~/server/utils/cardStudio/handler";

export default defineStudioHandler(async (event, service) => {
  const query = getQuery(event);
  if (
    query.card_id !== undefined &&
    typeof query.card_id !== "string"
  ) {
    throw new StudioError("INVALID_REQUEST", "Invalid card ID.", 400);
  }
  return service.listJobs(query.card_id);
});
