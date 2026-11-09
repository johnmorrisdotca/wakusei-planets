import { createApp } from "vue";
import StarView from "./StarView.vue";

const app = createApp(StarView);
app.config.compilerOptions.isCustomElement = (tag) => tag === "wakusei-body";
app.mount("#app");
