<script setup lang="ts">
import { onMounted } from "vue";

withDefaults(defineProps<{ body?: string; look?: "line" | "realistic" }>(), { body: "saturn", look: "line" });

// The element needs a browser: import it once the component is on the page, never while a server renders it.
onMounted(() => {
  void import("@johnmorrisdotca/wakusei-planets/element");
});
</script>

<template>
  <wakusei-body :body="body" :look="look"></wakusei-body>
</template>
