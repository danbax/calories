export function SegmentedTabs({ tabs, value, onChange }) {
  return (
    <div className="segmented-tabs" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`segmented-tab ${value === tab.id ? 'is-active' : ''}`}
          onClick={() => onChange(tab.id)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
