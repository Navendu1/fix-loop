import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'

const MIN_SIZE = 26
const MAX_SIZE = 110
const REPLACEMENT_DELAY_MS = 260
const DEFAULT_DURATION = 60

const randomBetween = (min, max) => min + Math.random() * (max - min)

const buildSpot = () => ({
  id: `spot-${Math.random().toString(36).slice(2, 10)}`,
  x: randomBetween(0.08, 0.92),
  y: randomBetween(0.12, 0.88),
  size: Math.round(randomBetween(MIN_SIZE, MAX_SIZE)),
  rotation: Math.round(randomBetween(-35, 35)),
  stretch: randomBetween(0.7, 1.35),
  squash: randomBetween(0.7, 1.2),
})

function App() {
  const [spots, setSpots] = useState(() => [buildSpot()])
  const [clickCount, setClickCount] = useState(0)
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_DURATION)
  const [remainingSeconds, setRemainingSeconds] = useState(DEFAULT_DURATION)
  const [hasStarted, setHasStarted] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const audioRef = useRef(null)
  const timeoutRef = useRef(null)
  const lastClickRef = useRef(null)

  useEffect(() => {
    if (isPaused || remainingSeconds <= 0 || !hasStarted) {
      return undefined
    }

    const timerId = window.setInterval(() => {
      setRemainingSeconds((value) => Math.max(value - 1, 0))
    }, 1000)

    return () => {
      window.clearInterval(timerId)
    }
  }, [hasStarted, isPaused, remainingSeconds])

  useEffect(() => {
    if (remainingSeconds === 0) {
      setIsPaused(true)
    }
  }, [remainingSeconds])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const playPop = useCallback((speed = 0.5) => {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) {
      return
    }

    if (!audioRef.current) {
      audioRef.current = new AudioContext()
    }

    const context = audioRef.current
    if (context.state === 'suspended') {
      context.resume()
    }

    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const now = context.currentTime

    const clampedSpeed = Math.min(Math.max(speed, 0), 1)
    const baseFreq = 160 + clampedSpeed * 240
    const sparkle = clampedSpeed > 0.7

    oscillator.type = clampedSpeed > 0.65 ? 'square' : 'triangle'
    oscillator.frequency.value = baseFreq + Math.random() * 40

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.07 + clampedSpeed * 0.08, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14 + clampedSpeed * 0.12)

    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(now)
    oscillator.stop(now + 0.22)

    if (sparkle) {
      const ping = context.createOscillator()
      const pingGain = context.createGain()
      ping.type = 'sine'
      ping.frequency.value = baseFreq * 2.2 + Math.random() * 120

      pingGain.gain.setValueAtTime(0.0001, now)
      pingGain.gain.exponentialRampToValueAtTime(0.05, now + 0.01)
      pingGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08)

      ping.connect(pingGain)
      pingGain.connect(context.destination)
      ping.start(now + 0.01)
      ping.stop(now + 0.1)
    }
  }, [])

  const handleFix = useCallback(
    (id) => {
      if (isPaused || remainingSeconds <= 0) {
        return
      }

      if (!hasStarted) {
        setHasStarted(true)
        setIsPaused(false)
      }

      const now = window.performance.now()
      const lastClick = lastClickRef.current
      lastClickRef.current = now
      const delta = lastClick ? now - lastClick : 700
      const speed = 1 - Math.min(Math.max((delta - 220) / 1000, 0), 1)

      setSpots((prev) =>
        prev.map((spot) =>
          spot.id === id ? { ...spot, fixed: true } : spot,
        ),
      )
      setClickCount((value) => value + 1)
      playPop(speed)

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }

      timeoutRef.current = window.setTimeout(() => {
        setSpots([buildSpot()])
      }, REPLACEMENT_DELAY_MS)
    },
    [hasStarted, isPaused, playPop, remainingSeconds],
  )

  const clearReplacement = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const handlePauseToggle = useCallback(() => {
    if (remainingSeconds === 0 || !hasStarted) {
      return
    }
    setIsPaused((value) => !value)
  }, [hasStarted, remainingSeconds])

  const handleRestart = useCallback(() => {
    clearReplacement()
    lastClickRef.current = null
    setIsPaused(false)
    setHasStarted(false)
    setClickCount(0)
    setRemainingSeconds(durationSeconds)
    setSpots([buildSpot()])
  }, [clearReplacement, durationSeconds])

  const handleReset = useCallback(() => {
    clearReplacement()
    lastClickRef.current = null
    setIsPaused(false)
    setHasStarted(false)
    setClickCount(0)
    setDurationSeconds(DEFAULT_DURATION)
    setRemainingSeconds(DEFAULT_DURATION)
    setSpots([buildSpot()])
  }, [clearReplacement])

  const handleDurationChange = useCallback((event) => {
    const nextValue = Number(event.target.value)
    const clamped = Number.isFinite(nextValue)
      ? Math.min(Math.max(nextValue, 10), 600)
      : DEFAULT_DURATION

    lastClickRef.current = null
    setDurationSeconds(clamped)
    setRemainingSeconds(clamped)
    setClickCount(0)
    setIsPaused(false)
    setHasStarted(false)
  }, [])

  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60
  const timeLabel = `${minutes}:${seconds.toString().padStart(2, '0')}`
  const isStopped = isPaused || remainingSeconds === 0

  return (
    <div className="page">
      <div className={`stage ${isStopped ? 'is-paused' : ''}`}>
        <div className="top-bar">
          <div className="hud" aria-live="polite">
            <span className="hud-item">
              <span className="hud-label">Clicks</span>
              <span className="hud-value">{clickCount}</span>
            </span>
            <span className="hud-dot" aria-hidden="true"></span>
            <span className="hud-item">
              <span className="hud-label">Time</span>
              <span className="hud-value">{timeLabel}</span>
            </span>
          </div>
          <div className="controls" role="group" aria-label="Game controls">
            <label className="timer-set">
              <span className="timer-label">Timer</span>
              <input
                className="timer-input"
                type="number"
                min="10"
                max="600"
                step="10"
                inputMode="numeric"
                value={durationSeconds}
                onChange={handleDurationChange}
                aria-label="Set timer in seconds"
              />
              <span className="timer-unit">s</span>
            </label>
            <button
              type="button"
              className="control-button"
              onClick={handlePauseToggle}
              disabled={!hasStarted || remainingSeconds === 0}
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              type="button"
              className="control-button"
              onClick={handleRestart}
            >
              Restart
            </button>
            <button
              type="button"
              className="control-button"
              onClick={handleReset}
            >
              Reset
            </button>
          </div>
        </div>
        <div className="canvas">
          {spots.map((spot) => (
            <button
              key={spot.id}
              type="button"
              className={`spot ${spot.fixed ? 'is-fixed' : ''}`}
              style={{
                left: `${spot.x * 100}%`,
                top: `${spot.y * 100}%`,
                width: `${spot.size}px`,
                height: `${spot.size}px`,
                transform: `translate(-50%, -50%) rotate(${spot.rotation}deg) scaleX(${spot.stretch}) scaleY(${spot.squash})`,
              }}
              onClick={() => handleFix(spot.id)}
              aria-label="Fix this problem"
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default App
