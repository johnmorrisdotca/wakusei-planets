<script lang="ts">
  import { onMount } from "svelte";

  let { star = { name: "Betelgeuse", temperatureK: 3600, radiusSun: 764, luminosityClass: "Iab" }, look = "line" }: { star?: object; look?: "line" | "realistic" } = $props();

  // The element needs a browser: onMount never runs on the server.
  onMount(() => {
    void import("@johnmorrisdotca/wakusei-planets/element");
  });
</script>

<wakusei-body star={JSON.stringify(star)} {look}></wakusei-body>
