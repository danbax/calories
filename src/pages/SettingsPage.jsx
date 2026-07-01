import { useRef, useCallback, useEffect } from 'react'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { LoadingButton } from '../components/LoadingButton'

export function SettingsPage({
  settingsView,
  setSettingsView,
  settings,
  setSettings,
  bmi,
  restingCalories,
  seedStatus,
  isUpdateAvailable,
  isActionLoading,
  formatDateTime,
  seedPreview,
  onPreviewSeedUpdate,
  onApplySeedUpdate,
  onUpdateAppNow,
  onSaveSettings,
  onDownloadBackup,
  onRestoreBackup,
}) {
  // Debounced auto-save: saves 1.5s after the last change
  const autoSaveTimerRef = useRef(null)

  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }
    autoSaveTimerRef.current = setTimeout(() => {
      onSaveSettings()
    }, 1500)
  }, [onSaveSettings])

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [])

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    scheduleAutoSave()
  }

  return (
    <div className="space-y-4">
      <SegmentedTabs
        tabs={[
          { id: 'targets', label: 'Goals' },
          { id: 'profile', label: 'Profile' },
          { id: 'ai', label: 'AI' },
          { id: 'data', label: 'Data' },
        ]}
        value={settingsView}
        onChange={setSettingsView}
      />

      {settingsView === 'targets' && (
        <div className="card space-y-3">
          <h2 className="font-['Sora'] text-lg font-semibold text-[#1f4739]">Daily Goals</h2>
          <p className="text-xs text-[#6a8f7c]">Changes are saved automatically.</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['calorieGoal', 'Calories (kcal)'],
              ['proteinGoal', 'Protein (g)'],
              ['carbsGoal', 'Carbs (g)'],
              ['fatGoal', 'Fat (g)'],
            ].map(([key, label]) => (
              <label key={key} className="text-sm text-[#3d5f51]">
                {label}
                <input
                  type="number"
                  className="input mt-1"
                  value={settings[key]}
                  onChange={(event) => handleChange(key, Number(event.target.value) || 0)}
                />
              </label>
            ))}
          </div>
          <LoadingButton className="btn-primary w-full" onClick={onSaveSettings} loading={isActionLoading('save-settings')}>
            Save goals now
          </LoadingButton>
        </div>
      )}

      {settingsView === 'profile' && (
        <div className="card space-y-3">
          <h2 className="font-['Sora'] text-lg font-semibold text-[#1f4739]">Body Metrics (Optional)</h2>
          <p className="text-xs text-[#6a8f7c]">Changes are saved automatically.</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm text-[#3d5f51]">
              Weight (kg)
              <input
                type="number"
                step="0.1"
                className="input mt-1"
                value={settings.weightKg}
                onChange={(event) => handleChange('weightKg', Number(event.target.value) || 0)}
              />
            </label>
            <label className="text-sm text-[#3d5f51]">
              Height (cm)
              <input
                type="number"
                className="input mt-1"
                value={settings.heightCm}
                onChange={(event) => handleChange('heightCm', Number(event.target.value) || 0)}
              />
            </label>
            <label className="text-sm text-[#3d5f51]">
              Age
              <input
                type="number"
                className="input mt-1"
                value={settings.ageYears}
                onChange={(event) => handleChange('ageYears', Number(event.target.value) || 0)}
              />
            </label>
            <label className="text-sm text-[#3d5f51]">
              Sex
              <select
                className="input mt-1"
                value={settings.sex}
                onChange={(event) => handleChange('sex', event.target.value)}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </label>
          </div>
          <div className="rounded-2xl bg-[#f4faf6] p-3 text-sm text-[#36584a]">
            <p>BMI: {bmi || '-'}</p>
            <p>Resting calories/day: {restingCalories || '-'}</p>
          </div>
          <label className="text-sm text-[#3d5f51]">
            Projection intake (kcal/day)
            <input
              type="number"
              className="input mt-1"
              value={settings.projectionIntakeCalories}
              onChange={(event) => handleChange('projectionIntakeCalories', Number(event.target.value) || 0)}
            />
          </label>
          <LoadingButton className="btn-primary w-full" onClick={onSaveSettings} loading={isActionLoading('save-settings')}>
            Save profile now
          </LoadingButton>
        </div>
      )}

      {settingsView === 'ai' && (
        <div className="card space-y-3">
          <h2 className="font-['Sora'] text-lg font-semibold text-[#1f4739]">AI Provider</h2>
          <p className="text-xs text-[#6a8f7c]">API keys are stored in your private data and never shared.</p>
          <select
            className="input"
            value={settings.aiProvider}
            onChange={(event) => handleChange('aiProvider', event.target.value)}
          >
            <option value="openai">OpenAI</option>
            <option value="gemini">Google Gemini</option>
          </select>

          <label className="text-sm text-[#3d5f51]">
            OpenAI API key
            <input
              type="password"
              className="input mt-1"
              value={settings.openAiApiKey}
              onChange={(event) => handleChange('openAiApiKey', event.target.value.trim())}
            />
          </label>

          <label className="text-sm text-[#3d5f51]">
            OpenAI model
            <input
              className="input mt-1"
              value={settings.openAiModel}
              onChange={(event) => handleChange('openAiModel', event.target.value.trim())}
            />
          </label>

          <label className="text-sm text-[#3d5f51]">
            Gemini API key
            <input
              type="password"
              className="input mt-1"
              value={settings.geminiApiKey}
              onChange={(event) => handleChange('geminiApiKey', event.target.value.trim())}
            />
          </label>

          <label className="text-sm text-[#3d5f51]">
            Gemini model
            <input
              className="input mt-1"
              value={settings.geminiModel}
              onChange={(event) => handleChange('geminiModel', event.target.value.trim())}
            />
          </label>

          <LoadingButton className="btn-primary w-full" onClick={onSaveSettings} loading={isActionLoading('save-settings')}>
            Save AI settings
          </LoadingButton>
        </div>
      )}

      {settingsView === 'data' && (
        <div className="card space-y-3">
          <h2 className="font-['Sora'] text-lg font-semibold text-[#1f4739]">Backup & Restore</h2>
          <div className="rounded-2xl bg-[#f4faf6] p-3 text-sm text-[#36584a]">
            <p>Food DB version: {seedStatus.currentVersion || '-'}/{seedStatus.latestVersion || '-'}</p>
            <p>Last seed sync: {formatDateTime(seedStatus.lastSyncedAt)}</p>
            <p>App update status: {isUpdateAvailable ? 'Update available' : 'Up to date'}</p>
          </div>

          <LoadingButton className="btn-muted w-full" onClick={onPreviewSeedUpdate} loading={isActionLoading('preview-seed-update')}>
            Preview food database update
          </LoadingButton>

          {seedPreview && (
            <div className="rounded-2xl border border-[#dce7dc] bg-[#f8fcf9] p-3 text-sm text-[#36584a]">
              <p>Incoming foods: {seedPreview.incoming}</p>
              <p>Will add: {seedPreview.adds} | will update: {seedPreview.updates}</p>
              <p>Unchanged: {seedPreview.unchanged} | id conflicts handled: {seedPreview.idConflicts}</p>
            </div>
          )}

          <LoadingButton className="btn-primary w-full" onClick={onApplySeedUpdate} loading={isActionLoading('apply-seed-update')}>
            Apply food database update
          </LoadingButton>

          <LoadingButton className="btn-muted w-full" onClick={onUpdateAppNow} loading={isActionLoading('update-app-now')}>
            {isUpdateAvailable ? 'Update ready - apply now' : 'Check for app update'}
          </LoadingButton>
          <LoadingButton className="btn-primary w-full" onClick={onDownloadBackup} loading={isActionLoading('export-backup')}>
            Export data JSON
          </LoadingButton>
          <label className="btn-muted w-full cursor-pointer text-center">
            Import backup JSON
            <input type="file" accept="application/json" className="hidden" onChange={onRestoreBackup} />
          </label>
        </div>
      )}
    </div>
  )
}