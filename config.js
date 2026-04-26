const SUPABASE_URL = "https://sndokqwlvftbtiwvrlos.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuZG9rcXdsdmZ0YnRpd3ZybG9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMzU5MDUsImV4cCI6MjA5MjcxMTkwNX0.XmpohnwRzSh143aI6jLqA-B5EssBszRXQe4VUwOsHyU";
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fetchMapData() {
  const { data } = await supabaseClient.from("view_map_stats").select("*");
  return data || [];
}

async function fetchTimelineData() {
  const { data } = await supabaseClient.from("view_timeline_stats").select("*");
  return data || [];
}

async function fetchHeatmapData() {
  const { data } = await supabaseClient.from("view_heatmap_stats").select("*");
  return data || [];
}

async function fetchSankeyData() {
  const { data } = await supabaseClient
    .from("view_sankey_stats")
    .select("*")
    .limit(50000);
  return data || [];
}

async function fetchRawData() {
  const { data } = await supabaseClient
    .from("cyber_security")
    .select("*")
    .limit(150000);
  return data || [];
}
