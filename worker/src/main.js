import apiWorker from "./index.js";
import sanaBookingWorker from "./sana-booking-worker.js";

function isSanaRoute(path) {
  return (
    path === "/public/chat" ||
    path === "/public/sana/connect" ||
    path === "/public/sana/live" ||
    path === "/public/sana/message" ||
    path === "/admin/sana/heartbeat" ||
    path === "/admin/sana/requests" ||
    path.startsWith("/admin/sana/requests/") ||
    path === "/admin/sana/messages" ||
    path === "/admin/sana/bookings"
  );
}

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;

    // Sana's booking/live worker owns all Sana-specific routes.
    // The existing API worker continues to own admin auth, CMS, profile,
    // password reset, availability, and the other non-Sana API routes.
    if (isSanaRoute(path)) {
      return sanaBookingWorker.fetch(request, env, ctx);
    }

    return apiWorker.fetch(request, env, ctx);
  },
};
