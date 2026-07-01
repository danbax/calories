import { FaPen, FaPlus, FaTrash } from 'react-icons/fa6'

export function DateNavigatorCard({ selectedDate, dateKey, formatDisplayDate, onDateChange, onPrevDate, onNextDate }) {
  return (
    <div className="card flex items-center justify-between">
      <button className="btn-muted" onClick={onPrevDate}>
        Previous
      </button>
      <div className="text-center">
        <p className="font-['Sora'] text-base font-semibold text-[#184034]">{formatDisplayDate(selectedDate)}</p>
        <input
          type="date"
          className="input mt-1 !w-[150px]"
          value={dateKey}
          onChange={(event) => onDateChange(new Date(`${event.target.value}T12:00:00`))}
        />
      </div>
      <button className="btn-muted" onClick={onNextDate}>
        Next
      </button>
    </div>
  )
}

export function DashboardOverview({ settings, totals, bmi, restingCalories, totalBurn, calorieBalance, macroColors, logs, onLogFood, ring }) {
  return (
    <>
      <div className="card flex items-center justify-between">
        <div>
          <p className="text-sm text-[#4a6658]">Goal</p>
          <p className="font-['Sora'] text-xl font-bold text-[#163d31]">{settings.calorieGoal} kcal</p>
          <p className="text-xs text-[#4a6658]">Swipe left or right to move between days</p>
        </div>
        {ring}
      </div>

      <div className="card grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-[#f4faf6] p-3">
          <p className="text-xs uppercase tracking-wide text-[#5a7769]">BMI</p>
          <p className="font-['Sora'] text-xl font-bold text-[#194436]">{bmi || '-'}</p>
        </div>
        <div className="rounded-2xl bg-[#f4faf6] p-3">
          <p className="text-xs uppercase tracking-wide text-[#5a7769]">Rest Burn</p>
          <p className="font-['Sora'] text-xl font-bold text-[#194436]">{restingCalories ? `${restingCalories} kcal` : '-'}</p>
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-['Sora'] text-base font-semibold text-[#1c4437]">Daily Energy Balance</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-2xl bg-[#f4faf6] p-3">
            <p className="text-[#5a7769]">Consumed</p>
            <p className="font-semibold text-[#22493d]">{Math.round(totals.calories)} kcal</p>
          </div>
          <div className="rounded-2xl bg-[#f4faf6] p-3">
            <p className="text-[#5a7769]">Burned (Rest + Exercise)</p>
            <p className="font-semibold text-[#22493d]">{Math.round(totalBurn)} kcal</p>
          </div>
        </div>
        <div
          className={`rounded-2xl border p-3 text-sm font-semibold ${
            calorieBalance >= 0 ? 'border-[#bde7ce] bg-[#ecfbf2] text-[#1f6f4b]' : 'border-[#f3d0cd] bg-[#fff1ef] text-[#9f3c33]'
          }`}
        >
          {calorieBalance >= 0
            ? `Deficit ${Math.round(calorieBalance)} kcal (burned more than consumed)`
            : `Surplus ${Math.abs(Math.round(calorieBalance))} kcal (consumed more than burned)`}
        </div>
      </div>

      <div className="card space-y-3">
        {[
          { key: 'protein', label: 'Protein', total: totals.protein, goal: settings.proteinGoal },
          { key: 'carbs', label: 'Carbs', total: totals.carbs, goal: settings.carbsGoal },
          { key: 'fat', label: 'Fat', total: totals.fat, goal: settings.fatGoal },
        ].map((macro) => {
          const progress = Math.min((macro.total || 0) / (macro.goal || 1), 1)
          return (
            <div key={macro.key}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <p className="font-semibold text-[#224a3d]">{macro.label}</p>
                <p className="text-[#446253]">
                  {macro.total.toFixed(1)}g / {macro.goal}g
                </p>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[#dce8dd]">
                <div className={`h-full rounded-full ${macroColors[macro.key]}`} style={{ width: `${progress * 100}%` }}></div>
              </div>
            </div>
          )
        })}
      </div>

      {logs && logs.length > 0 && (() => {
        const seen = new Set()
        const unique = []
        for (const entry of logs) {
          const key = entry.foodId != null ? `food:${entry.foodId}` : `desc:${entry.description || entry.foodName || ''}`
          if (!seen.has(key)) {
            seen.add(key)
            unique.push(entry)
            if (unique.length === 20) break
          }
        }
        return (
          <details className="expandable-card" open>
            <summary>Food Breakdown</summary>
            <div className="expandable-content space-y-2">
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-x-2 gap-y-0 px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-[#5a7769]">
                <span>Food</span>
                <span className="text-right">kcal</span>
                <span className="text-right">P</span>
                <span className="text-right">C</span>
                <span className="text-right">F</span>
                <span />
              </div>
              {unique.map((entry) => (
                <div
                  key={entry.id}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-x-2 rounded-2xl bg-[#f4faf6] px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#21453a]">{entry.foodName || entry.description || 'Entry'}</p>
                    {entry.amount != null && entry.unit && (
                      <p className="text-xs text-[#5b7569]">{entry.amount} {entry.unit}</p>
                    )}
                  </div>
                  <span className="text-right font-semibold text-[#22493d]">{Math.round(entry.calories)}</span>
                  <span className="text-right text-[#2f7cf6]">{Number(entry.protein || 0).toFixed(1)}g</span>
                  <span className="text-right text-[#f6b41f]">{Number(entry.carbs || 0).toFixed(1)}g</span>
                  <span className="text-right text-[#e45454]">{Number(entry.fat || 0).toFixed(1)}g</span>
                  {entry.foodId != null ? (
                    <button
                      className="btn-muted !rounded-full !p-1.5"
                      onClick={() => onLogFood(entry)}
                      aria-label={`Add ${entry.foodName || 'food'} again`}
                    >
                      <FaPlus className="text-xs" />
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
            </div>
          </details>
        )
      })()}
    </>
  )
}

export function DashboardTrends({ projectionScenarios, dailyHistory }) {
  return (
    <>
      <div className="card space-y-3">
        <h2 className="font-['Sora'] text-base font-semibold text-[#1c4437]">Weight Trajectory</h2>
        {projectionScenarios.length === 0 && (
          <p className="text-sm text-[#577064]">Add weight, height and age in settings to calculate projections.</p>
        )}
        {projectionScenarios.map((scenario) => (
          <div key={scenario.intake} className="rounded-2xl border border-[#dde6dc] bg-[#fbfdf9] p-3 text-sm text-[#36584a]">
            <p className="font-semibold text-[#1f4739]">At {scenario.intake} kcal/day</p>
            <p className="text-xs text-[#5b7569]">Daily balance: {scenario.deltaPerDay >= 0 ? '+' : ''}{Math.round(scenario.deltaPerDay)} kcal</p>
            <p>30 days: {scenario.in30} kg</p>
            <p>90 days: {scenario.in90} kg</p>
          </div>
        ))}
      </div>

      <details className="expandable-card" open>
        <summary>Last 10 Days</summary>
        <div className="expandable-content space-y-2">
          {dailyHistory.map((day) => (
            <div key={day.dateKey} className="flex items-center justify-between rounded-2xl bg-[#f7fbf6] p-2 text-sm">
              <span className="font-semibold text-[#2b5444]">{day.dateKey}</span>
              <span className="text-[#45685a]">{Math.round(day.consumed)} / {Math.round(day.burned)} kcal</span>
              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${day.balance >= 0 ? 'bg-[#dcf6e7] text-[#1e6d49]' : 'bg-[#ffe1dd] text-[#994238]'}`}>
                {day.balance >= 0 ? `-${Math.round(day.balance)}` : `+${Math.abs(Math.round(day.balance))}`}
              </span>
            </div>
          ))}
        </div>
      </details>
    </>
  )
}

export function DashboardActivity({ exercises, logs, onAddExercise, onEditExercise, onDeleteExercise, onEditLog, onDeleteLog }) {
  return (
    <>
      <details className="expandable-card" open>
        <summary>Exercise</summary>
        <div className="expandable-content">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-['Sora'] text-base font-semibold text-[#1c4437]">Daily Exercise</h2>
            <button className="btn-primary" onClick={onAddExercise}>
              <FaPlus className="mr-2" /> Add Exercise
            </button>
          </div>
          {exercises.length === 0 && <p className="text-sm text-[#577064]">No exercise entries for this day.</p>}
          <div className="space-y-2">
            {exercises.map((entry) => (
              <article key={entry.id} className="rounded-2xl border border-[#dde6dc] bg-[#fbfdf9] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[#21453a]">{entry.description || entry.type}</p>
                    <p className="text-xs text-[#5b7569]">{entry.minutes} min • {Math.round(entry.caloriesBurned)} kcal burned</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="btn-muted !rounded-full !p-2" onClick={() => onEditExercise(entry)} aria-label="Edit exercise">
                      <FaPen />
                    </button>
                    <button className="btn-muted !rounded-full !p-2" onClick={() => onDeleteExercise(entry.id)} aria-label="Delete exercise">
                      <FaTrash />
                    </button>
                  </div>
                </div>
                {entry.notes && <p className="mt-2 text-sm text-[#355648]">{entry.notes}</p>}
              </article>
            ))}
          </div>
        </div>
      </details>

      <details className="expandable-card" open>
        <summary>Daily Timeline</summary>
        <div className="expandable-content space-y-2">
          {logs.length === 0 && <p className="text-sm text-[#577064]">No entries for this day yet.</p>}
          {logs.map((entry) => (
            <article key={entry.id} className="rounded-2xl border border-[#dde6dc] bg-[#fbfdf9] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-left">
                  <p className="font-semibold text-[#21453a]">{entry.description || 'Entry'}</p>
                  <p className="text-xs text-[#5b7569]">{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="btn-muted !rounded-full !p-2" onClick={() => onEditLog(entry)} aria-label="Edit entry">
                    <FaPen />
                  </button>
                  <button className="btn-muted !rounded-full !p-2" onClick={() => onDeleteLog(entry.id)} aria-label="Delete entry">
                    <FaTrash />
                  </button>
                </div>
              </div>
              <p className="mt-2 text-sm text-[#355648]">
                {Math.round(entry.calories)} kcal | P {entry.protein} | C {entry.carbs} | F {entry.fat}
              </p>
            </article>
          ))}
        </div>
      </details>
    </>
  )
}
