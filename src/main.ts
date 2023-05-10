import "vuetify/styles";
import { createApp } from "vue";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import "@mdi/font/css/materialdesignicons.css";

import MainView from "@/MainView.vue";

import "./userWorker";

import "./assets/main.css";
import router from "./router";

const app = createApp(MainView);
const vuetify = createVuetify({
  components,
  directives,
});

app.use(router).use(vuetify).mount("#app");
