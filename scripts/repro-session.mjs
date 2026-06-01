import { chromium } from "playwright";

const URL = "http://localhost:3000/";

const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--autoplay-policy=no-user-gesture-required",
  ],
});

const context = await browser.newContext({ permissions: ["microphone"] });
const page = await context.newPage();

page.on("console", (msg) => console.log(`[c:${msg.type()}]`, msg.text()));
page.on("pageerror", (err) => console.log("[pageerror]", err.message));
page.on("request", (req) => {
  if (req.url().includes("/api/session")) console.log("[req →]", req.method());
});
page.on("response", async (res) => {
  if (res.url().includes("/api/session")) {
    console.log("[res ←]", res.status(), (await res.text().catch(() => "")).slice(0, 160));
  }
});

await page.goto(URL, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Start interview" }).click();
await page.waitForTimeout(1500);
console.log("== clicking Start session ==");
await page.getByRole("button", { name: "Start session" }).click();
await page.waitForTimeout(9000);
console.log("== done waiting ==");
await browser.close();
