// Two lists: the setlist in the order you will play it, and everything else
// underneath to add from.
export default function SetlistView({ songs, setlist, onChange, onBack, onPlay }) {
  const inSetlist = setlist
    .map((title) => songs.find((s) => s.title === title))
    .filter(Boolean);
  const rest = songs.filter((s) => !setlist.includes(s.title));

  const move = (from, to) => {
    if (to < 0 || to >= setlist.length) return;
    const next = [...setlist];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div className="screen">
      <div className="topbar">
        <button className="btn" onClick={onBack}>
          ‹ Songs
        </button>
        <span className="topbar-title">Setlist</span>
        {inSetlist.length > 0 && (
          <button className="btn btn-on" onClick={() => onPlay(inSetlist[0])}>
            Start ›
          </button>
        )}
      </div>

      <div className="list">
        {inSetlist.length === 0 && (
          <p className="notice">
            Nothing in the setlist yet. Tap a song below to add it.
          </p>
        )}

        {inSetlist.map((song, i) => (
          <div className="row" key={song.id}>
            <span className="row-number">{i + 1}</span>
            <button className="row-title" onClick={() => onPlay(song)}>
              {song.title}
            </button>
            <button className="btn" onClick={() => move(i, i - 1)} aria-label="Move up">
              ▲
            </button>
            <button className="btn" onClick={() => move(i, i + 1)} aria-label="Move down">
              ▼
            </button>
            <button
              className="btn"
              onClick={() => onChange(setlist.filter((t) => t !== song.title))}
              aria-label="Remove from setlist"
            >
              ✕
            </button>
          </div>
        ))}

        {rest.length > 0 && <h2 className="list-heading">Add a song</h2>}
        {rest.map((song) => (
          <div className="row" key={song.id}>
            <button
              className="row-title"
              onClick={() => onChange([...setlist, song.title])}
            >
              {song.title}
            </button>
            <button
              className="btn"
              onClick={() => onChange([...setlist, song.title])}
              aria-label="Add to setlist"
            >
              +
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
