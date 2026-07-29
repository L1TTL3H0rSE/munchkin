import {readBody} from "h3";
import {studioCompileRequestSchema} from "@munchkin/contracts";
import {defineStudioHandler} from "~~/server/utils/cardStudio/handler";

export default defineStudioHandler(async (event, service) => {
  const request = studioCompileRequestSchema.parse(await readBody(event));
  return service.compile(request);
});
