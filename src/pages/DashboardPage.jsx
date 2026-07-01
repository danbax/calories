import { SectionLoader } from '../components/SectionLoader'
import { SegmentedTabs } from '../components/SegmentedTabs'
import { DashboardOverview, DashboardTrends, DashboardActivity, DateNavigatorCard } from '../components/dashboard-sections'

export function DashboardPage({
  selectedDate,
  dateKey,
  dashboardView,
  setDashboardView,
  totals,
  bmi,
  restingCalories,
  totalBurn,
  calorieBalance,
  projectionScenarios,
  dailyHistory,
  logs,
  exercises,
  isDayLoading,
  settings,
  macroColors,
  onDateChange,
  onEditLog,
  onDeleteLog,
  onAddExercise,
  onEditExercise,
  onDeleteExercise,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  swipeOffsetX,
  isSwipeDragging,
  swipeTransition,
  renderDashboardPanel,
}) {
  return (
    <section
      className="px-4"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      style={{ touchAction: 'pan-y', userSelect: isSwipeDragging ? 'none' : 'auto' }}
    >
      <div className="dashboard-swipe-stage">
        {!swipeTransition && (
          <div
            className={`dashboard-swipe-frame ${isSwipeDragging ? 'is-dragging' : ''}`}
            style={{
              transform: `translate3d(${swipeOffsetX}px, 0, 0)`,
              opacity: 1 - Math.min(Math.abs(swipeOffsetX) / 480, 0.08),
            }}
          >
            {renderDashboardPanel({
              panelSelectedDate: selectedDate,
              panelDateKey: dateKey,
              panelTotals: totals,
              panelBmi: bmi,
              panelRestingCalories: restingCalories,
              panelTotalBurn: totalBurn,
              panelCalorieBalance: calorieBalance,
              panelProjectionScenarios: projectionScenarios,
              panelDailyHistory: dailyHistory,
              panelLogs: logs,
              panelExercises: exercises,
              panelIsDayLoading: isDayLoading,
            })}
          </div>
        )}

        {swipeTransition && (
          <div className="dashboard-transition-stack">
            <div
              className={`dashboard-transition-layer ${swipeTransition.stage === 'animate' ? 'is-animating' : ''}`}
              style={{
                transform:
                  swipeTransition.stage === 'animate'
                    ? `translateX(${swipeTransition.direction * 100}%)`
                    : `translateX(${swipeTransition.dragOffset}px)`,
                opacity: swipeTransition.stage === 'animate' ? 0.88 : 1,
              }}
            >
              {renderDashboardPanel({
                panelSelectedDate: swipeTransition.outgoing.selectedDate,
                panelDateKey: swipeTransition.outgoing.dateKey,
                panelTotals: swipeTransition.outgoing.totals,
                panelBmi: swipeTransition.outgoing.bmi,
                panelRestingCalories: swipeTransition.outgoing.restingCalories,
                panelTotalBurn: swipeTransition.outgoing.totalBurn,
                panelCalorieBalance: swipeTransition.outgoing.calorieBalance,
                panelProjectionScenarios: swipeTransition.outgoing.projectionScenarios,
                panelDailyHistory: swipeTransition.outgoing.dailyHistory,
                panelLogs: swipeTransition.outgoing.logs,
                panelExercises: swipeTransition.outgoing.exercises,
                panelIsDayLoading: swipeTransition.outgoing.isDayLoading,
              })}
            </div>

            <div
              className={`dashboard-transition-layer ${swipeTransition.stage === 'animate' ? 'is-animating' : ''}`}
              style={{
                transform:
                  swipeTransition.stage === 'animate'
                    ? 'translateX(0)'
                    : `translateX(calc(${swipeTransition.direction * -100}% + ${swipeTransition.dragOffset}px))`,
                opacity: 1,
              }}
            >
              {renderDashboardPanel({
                panelSelectedDate: selectedDate,
                panelDateKey: dateKey,
                panelTotals: totals,
                panelBmi: bmi,
                panelRestingCalories: restingCalories,
                panelTotalBurn: totalBurn,
                panelCalorieBalance: calorieBalance,
                panelProjectionScenarios: projectionScenarios,
                panelDailyHistory: dailyHistory,
                panelLogs: logs,
                panelExercises: exercises,
                panelIsDayLoading: isDayLoading,
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
