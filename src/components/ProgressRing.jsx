export function ProgressRing({ consumed, goal }) {
  const safeGoal = goal || 1
  const progress = Math.min(consumed / safeGoal, 1)
  const radius = 52
  const circumference = 2 * Math.PI * radius

  return (
    <div className="relative grid h-36 w-36 place-items-center">
      <svg className="h-36 w-36 -rotate-90" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} stroke="#deebdf" strokeWidth="14" fill="none" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          stroke="#1ea96d"
          strokeWidth="14"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-xs uppercase tracking-wide text-[#4a6658]">Calories</p>
        <p className="font-['Sora'] text-2xl font-bold text-[#163d31]">{Math.round(consumed)}</p>
      </div>
    </div>
  )
}
