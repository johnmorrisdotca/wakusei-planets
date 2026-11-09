<script lang="ts">
  import { onMount } from "svelte";

  let { stars = "bright", planets = true, at = "betelgeuse" }: { stars?: string; planets?: boolean; at?: string } = $props();

  // The element needs a browser: onMount never runs on the server.
  onMount(() => {
    void import("@johnmorrisdotca/wakusei-planets/lineup");
  });
</script>

<wakusei-lineup {stars} planets={planets ? "" : undefined} {at}></wakusei-lineup>
