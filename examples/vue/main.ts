import { createApp } from "vue";
import PlanetView from "./PlanetView.vue";

const app = createApp(PlanetView);
app.config.compilerOptions.isCustomElement = (tag) => tag === "wakusei-body";
app.mount("#app");
