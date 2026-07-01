import { FaPlus, FaPen, FaTrash } from 'react-icons/fa6'
import { LoadingButton } from '../components/LoadingButton'

export function MealsPage({
  meals,
  isActionLoading,
  onOpenCreateMeal,
  onOpenEditMeal,
  onDeleteMeal,
  onLogMeal,
}) {
  return (
    <div className="space-y-4">
      <div className="card flex items-center justify-between">
        <h2 className="font-['Sora'] text-lg font-semibold text-[#1f4739]">Saved Meals</h2>
        <button className="btn-primary" onClick={onOpenCreateMeal}>
          <FaPlus className="mr-2" /> New Meal
        </button>
      </div>

      {meals.length === 0 && (
        <div className="card text-sm text-[#5b7569]">No meals yet. Build your first combo.</div>
      )}

      {meals.map((meal) => (
        <div key={meal.id} className="card">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-['Sora'] text-base font-semibold text-[#204638]">{meal.name}</p>
              <p className="text-sm text-[#5d766a]">
                {Math.round(meal.totals?.calories || 0)} kcal | P {Number(meal.totals?.protein || 0).toFixed(1)} | C{' '}
                {Number(meal.totals?.carbs || 0).toFixed(1)} | F {Number(meal.totals?.fat || 0).toFixed(1)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-muted" onClick={() => onOpenEditMeal(meal)}>
                <FaPen className="mr-2" /> Edit
              </button>
              <button className="btn-muted" onClick={() => onDeleteMeal(meal.id)}>
                <FaTrash className="mr-2" /> Delete
              </button>
              <LoadingButton
                className="btn-primary"
                onClick={() => onLogMeal(meal)}
                loading={isActionLoading(`log-meal-${meal.id}`)}
              >
                Log
              </LoadingButton>
            </div>
          </div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#4b6458]">
            {meal.items?.map((item, index) => (
              <li key={`${meal.id}-${index}`}>
                {item.foodName}: {item.amount} {item.unit}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
