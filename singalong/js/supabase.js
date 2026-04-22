// Minimal Supabase REST client — no library needed
const db = {
  headers() {
    return {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };
  },

  async getAllSongs() {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/songs?select=id,artist,title&order=id`,
      { headers: this.headers() }
    );
    if (!res.ok) throw new Error("Failed to load songs");
    return res.json();
  },

  async getSong(id) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/songs?id=eq.${id}&select=*`,
      { headers: this.headers() }
    );
    if (!res.ok) throw new Error("Failed to load song");
    const rows = await res.json();
    return rows[0] || null;
  },

  async updateSong(id, data) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/songs?id=eq.${id}`,
      {
        method: "PATCH",
        headers: this.headers(),
        body: JSON.stringify(data),
      }
    );
    if (!res.ok) throw new Error("Failed to save");
    const rows = await res.json();
    return rows[0];
  },
};
