// components/CircleReveal.js
import { useEffect, useState } from "react"

export default function CircleReveal({ onFinish }) {
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    const start = setTimeout(() => setAnimate(true), 50)
    const finish = setTimeout(() => {
      onFinish?.()
    }, 1000) // sync with last animation

    return () => {
      clearTimeout(start)
      clearTimeout(finish)
    }
  }, [onFinish])

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-hidden flex items-center justify-center">
      {/* Black circle layer */}
      <div className={`circle bg-black ${animate ? "expand-black" : ""}`} />
      
      {/* White circle on top, delayed animation */}
      <div className={`circle absolute bg-white ${animate ? "expand-white" : ""}`} />

      <style jsx>{`
        .circle {
          width: 120px;
          height: 120px;
          border-radius: 9999px;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) scale(1);
          opacity: 1;
        }

        .expand-black {
          transition: transform 0.4s ease-in-out, opacity 0.3s ease-in 0.3s;
          transform: translate(-50%, -50%) scale(20);
          opacity: 0;
        }

        .expand-white {
          transition: transform 0.6s ease-in-out 0.15s, opacity 0.4s ease-in-out 0.5s;
          transform: translate(-50%, -50%) scale(20);
          opacity: 0;
        }
      `}</style>
    </div>
  )
}
