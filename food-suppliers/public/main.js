import { auth, initAuth, isLoggedIn } from "./auth.js";
import { initAudience } from "./audience.js";
import { initSellerApp } from "./seller.js";

async function start() {
  await initAuth("#auth-bar");

  const mode = await initAudience();
  const readOnly = isLoggedIn() && auth.user?.audience === "viewer";

  if (mode === "seller") {
    initSellerApp();
  } else {
    const { initBuyerApp } = await import("./app.js");
    await initBuyerApp({ readOnly });
  }
}

start();
