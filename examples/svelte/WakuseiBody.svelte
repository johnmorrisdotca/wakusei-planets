<script lang="ts">
  import { onMount } from "svelte";

  let { body = "saturn", look = "line" }: { body?: string; look?: "line" | "realistic" } = $props();

  // The element needs a browser: onMount never runs on the server.
  onMount(() => {
    void import("@johnmorrisdotca/wakusei-planets/element");
  });
</script>

<wakusei-body {body} {look}></wakusei-body>
