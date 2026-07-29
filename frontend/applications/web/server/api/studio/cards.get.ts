import {defineStudioHandler} from "~~/server/utils/cardStudio/handler";

export default defineStudioHandler(async (_event, service) => {
  return service.listCards();
});
