import { FaPlus, FaCamera } from 'react-icons/fa6'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { LoadingButton } from '../components/LoadingButton'

export function LogPage({
  logView,
  setLogView,
  recentLogEntries,
  isActionLoading,
  onSetFoodSheetOpen,
  onSetCustomFoodSheetOpen,
  onSetAiSheetOpen,
  onOpenExerciseCreate,
  quickAddRecent,
  onPreSelectEntry,
}) {
  return (
    <div className="space-y-4">
      <SegmentedTabs
        tabs={[
          { id: 'quick', label: 'Quick' },
          { id: 'tools', label: 'Food Tools' },
          { id: 'exercise', label: 'Exercise' },
        ]}
        value={logView}
        onChange={setLogView}
      />

      {logView === 'quick' && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-['Sora'] text-lg font-semibold text-[#1f4739]">Latest Added</h2>
            <button
              className="btn-primary !rounded-full !px-3 !py-2 text-xs"
              onClick={() => onSetFoodSheetOpen(true)}
            >
              <FaPlus className="mr-1" /> Log Food
            </button>
          </div>
          {recentLogEntries.length === 0 && (
            <p className="text-sm text-[#5b7569]">Your recent foods and meals will appear here.</p>
          )}
          <div className="grid grid-cols-1 gap-2">
            {recentLogEntries.map((entry) => (
              <button
                key={entry.key}
                className="flex items-center justify-between rounded-2xl border border-[#d7e4d8] bg-[#f7fbf6] px-3 py-2 text-left"
                onClick={() => onPreSelectEntry(entry)}
              >
                <span className="text-sm text-[#2a5042]">
                  {entry.type === 'meal' ? 'Meal: ' : ''}
                  {entry.label}
                  {entry.type === 'food' ? ` (${entry.amount} ${entry.unit})` : ''}
                </span>
                <span className="text-xs font-semibold text-[#2f6f53]">Add</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {logView === 'tools' && (
        <div className="space-y-3">
          <div className="card space-y-3">
            <h2 className="font-['Sora'] text-lg font-semibold text-[#1f4739]">Food Logging</h2>
            <p className="text-sm text-[#5b7569]">Use quick search or add your own custom food database item.</p>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-primary w-full" onClick={() => onSetFoodSheetOpen(true)}>
                Search & log
              </button>
              <button className="btn-muted w-full" onClick={() => onSetCustomFoodSheetOpen(true)}>
                Add custom food
              </button>
            </div>
          </div>

          <div className="card space-y-3">
            <h2 className="font-['Sora'] text-lg font-semibold text-[#1f4739]">Calculate from Picture</h2>
            <p className="text-sm text-[#5b7569]">Take or upload a food photo, estimate macros, then edit before logging.</p>
            <button className="btn-primary w-full" onClick={() => onSetAiSheetOpen(true)}>
              <FaCamera className="mr-2" /> Open AI Estimator
            </button>
          </div>
        </div>
      )}

      {logView === 'exercise' && (
        <div className="card space-y-3">
          <h2 className="font-['Sora'] text-lg font-semibold text-[#1f4739]">Log Exercise</h2>
          <p className="text-sm text-[#5b7569]">Track activity minutes and add calories burned to your day.</p>
          <button className="btn-primary w-full" onClick={onOpenExerciseCreate}>
            <FaPlus className="mr-2" /> Add Exercise
          </button>
        </div>
      )}
    </div>
  )
}
