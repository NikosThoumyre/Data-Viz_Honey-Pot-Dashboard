const SUPABASE_URL = "https://sndokqwlvftbtiwvrlos.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNuZG9rcXdsdmZ0YnRpd3ZybG9zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMzU5MDUsImV4cCI6MjA5MjcxMTkwNX0.XmpohnwRzSh143aI6jLqA-B5EssBszRXQe4VUwOsHyU";
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Fonction universelle pour récupérer les données
async function fetchAllData() {
  const { data, error } = await supabaseClient
    .from("cyber_security")
    .select("*")
    .limit(20000)
    .order("datetime", { ascending: true });

  if (error) {
    console.error("Erreur Supabase:", error);
    return [];
  }
  return data;
}
