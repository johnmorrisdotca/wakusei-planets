import { createApp } from "vue";
import LineupView from "./LineupView.vue";

const app = createApp(LineupView);
app.config.compilerOptions.isCustomElement = (tag) => tag === "wakusei-lineup";
app.mount("#app");
