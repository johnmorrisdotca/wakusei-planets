<script setup lang="ts">
import { onMounted } from "vue";

withDefaults(defineProps<{ stars?: string; planets?: boolean; at?: string }>(), { stars: "bright", planets: true, at: "betelgeuse" });

// The element needs a browser: import it once the component is on the page, never while a server renders it.
onMounted(() => {
  void import("@johnmorrisdotca/wakusei-planets/lineup");
});
</script>

<template>
  <wakusei-lineup :stars="stars" :planets="planets ? '' : undefined" :at="at"></wakusei-lineup>
</template>
