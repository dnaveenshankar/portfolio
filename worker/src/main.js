import apiWorker from "./index.js";
import sanaBookingWorker from "./sana-booking-worker.js";
import sanaLive from "./sana-live.js";
import sanaLiveBridge from "./sana-live-bridge.js";

const LIVE_ROUTES = new Set([
  "/public/sana/connect",
  "/public/sana/live",
  "/public/sana/message",
  "/admin/sana/heartbeat",
  "/admin/sana/requests",
  "/admin/sana/messages",
]);

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;

    // The public chat bridge handles the legacy "tell me your name" flow.
    if (path === "/public/chat") {
      return sanaLiveBridge.fetch(request, env, ctx);
    }

    // Route live connection endpoints directly to the live worker.
    // This avoids the booking worker wrapper swallowing or bypassing a
    // connection request before it reaches sana-live.js.
    if (LIVE_ROUTES.has(path) || path.startsWith("/admin/sana/requests/")) {
      return sanaLive.fetch(request, env, ctx);
    }

    // Booking endpoints remain owned by the booking worker.
    if (path === "/admin/sana/bookings") {
      return sanaBookingWorker.fetch(request, env, ctx);
    }

    return apiWorker.fetch(request, env, ctx);
  },
};
