// The space page's controls as a person uses them: a click that does not scroll the page (a view scrolled out of sight is rightly not drawn).
import type { Page } from "@playwright/test";

export const setLight = (page: Page, name: "The Sun's" | "Always lit") => page.getByRole("group", { name: "Light" }).getByRole("button", { name, exact: true }).dispatchEvent("click");
