import sanaWorker from "./sana-worker.js";
import sanaLive from "./sana-live.js";

export default {
  async fetch(request, env, ctx) {
    const liveResponse = await sanaLive.fetch(request, env, ctx);
    if (liveResponse) return liveResponse;
    return sanaWorker.fetch(request, env, ctx);
  },
};
