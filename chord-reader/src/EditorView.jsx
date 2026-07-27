import { useState } from 'react';
import { BUILT_IN_LIBRARY, USING_DEMO } from './library.js';

// A plain text box holding the whole song file, so any song can be fixed by
// hand on any device. Saving keeps it on this device only.
export default function EditorView({ text, edited, onSave, onRevert, onBack }) {
  const [draft, setDraft] = useState(text);
  const [confirmRevert, setConfirmRevert] = useState(false);
  const dirty = draft !== text;

  return (
    <div className="screen">
      <div className="topbar">
        <button className="btn" onClick={onBack}>
          ‹ Songs
        </button>
        <span className="topbar-title">Edit text</span>
        <button
          className={dirty ? 'btn btn-on' : 'btn'}
          onClick={() => onSave(draft)}
          disabled={!dirty}
        >
          Save
        </button>
      </div>

      <p className="notice notice-small">
        This is the whole song file. Chords go in square brackets where the chord
        changes, like <code>[G]Hello</code>. A new song starts after a line
        saying <code>{'{new_song}'}</code>. Saving keeps your changes on this
        device.
        {edited && ' You have saved changes here.'}
      </p>

      <textarea
        className="editor"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
      />

      <div className="editor-actions">
        {!confirmRevert ? (
          <button className="btn btn-wide" onClick={() => setConfirmRevert(true)}>
            Throw away my changes
          </button>
        ) : (
          <>
            <button
              className="btn btn-wide btn-danger"
              onClick={() => {
                setDraft(BUILT_IN_LIBRARY);
                setConfirmRevert(false);
                onRevert();
              }}
            >
              {USING_DEMO
                ? 'Yes, go back to the demo songs'
                : 'Yes, go back to the file from my Mac'}
            </button>
            <button className="btn btn-wide" onClick={() => setConfirmRevert(false)}>
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
