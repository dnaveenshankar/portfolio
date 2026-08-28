import sanaWorker from "./sana-worker.js";

export default {
  async fetch(request, env, ctx) {
    return sanaWorker.fetch(request, env, ctx);
  },
};
