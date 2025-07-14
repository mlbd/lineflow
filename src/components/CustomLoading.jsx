import { useEffect, useState } from "react"

export default function CustomLoading() {
  const [showBoxes, setShowBoxes] = useState(false)

  // After 1.5 seconds, show the boxes
  useEffect(() => {
    const timer = setTimeout(() => setShowBoxes(true), 1500)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white bg-opacity-95 p-4">
      <p className="mb-8 text-xl font-semibold text-gray-700">
        Your site is being built, please wait...
      </p>

      {showBoxes && (
        <div className="relative w-40 h-40">
          {/* Box 1 */}
          <AnimatedBox
            size={40}
            color="bg-purple-600"
            style={{ top: 0, left: 0 }}
            delay={0}
          />
          {/* Box 2 */}
          <AnimatedBox
            size={40}
            color="bg-pink-500"
            style={{ bottom: 0, right: 0 }}
            delay={500}
          />
        </div>
      )}
    </div>
  )
}

function AnimatedBox({ size, color, style, delay }) {
  return (
    <div
      className={`${color} absolute rounded-md`}
      style={{
        width: size,
        height: size,
        ...style,
        animation: `spinMove 4000ms ease-in-out infinite`,
        animationDelay: `${delay}ms`,
      }}
    />
  )
}
