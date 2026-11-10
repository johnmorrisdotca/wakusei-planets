<script setup lang="ts">
import { onMounted } from "vue";

withDefaults(defineProps<{ star?: object; look?: "line" | "realistic" }>(), {
  star: () => ({ name: "Betelgeuse", temperatureK: 3650, radiusSun: 1057, luminosityClass: "Iab" }),
  look: "line",
});

// The element needs a browser: import it once the component is on the page, never while a server renders it.
onMounted(() => {
  void import("@johnmorrisdotca/wakusei-planets/element");
});
</script>

<template>
  <wakusei-body :star="JSON.stringify(star)" :look="look"></wakusei-body>
</template>
