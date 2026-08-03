import { useState, useRef, useCallback, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, Loader2, AlertCircle, Maximize, Minimize } from "lucide-react";

interface ProductVideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  /** Compact preview mode for upload thumbnails (smaller overlay controls) */
  compact?: boolean;
  /** Start muted and auto-play when hovered (AliExpress card style) */
  hoverAutoplay?: boolean;
  alt?: string;
}

/**
 * Standard, marketplace-grade video player.
 * Always exposes native controls: play/pause, volume, mute toggle, scrubber,
 * fullscreen and (where supported) picture-in-picture. Shows a clear error
 * state instead of a blank white frame when the browser cannot decode the file.
 */
export default function ProductVideoPlayer({
  src,
  poster,
  className = "",
  compact = false,
  hoverAutoplay = false,
  alt = "Product video",
}: ProductVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(hoverAutoplay);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Keep the element in sync with our hover-autoplay mode (used for card previews).
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hoverAutoplay) return;
    if (hovered) {
      video.muted = true;
      video.play().catch(() => setError(true));
    } else {
      video.pause();
    }
  }, [hovered, hoverAutoplay]);

  // Track playback state so the custom overlay (compact mode) stays accurate.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setCurrentTime(video.currentTime);
    const onDuration = () => setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    const onError = () => {
      setLoading(false);
      setError(true);
    };
    const onCanPlay = () => {
      setLoading(false);
      setError(false);
    };
    const onFullscreenChange = () => setFullscreen(!!document.fullscreenElement);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("durationchange", onDuration);
    video.addEventListener("error", onError);
    video.addEventListener("canplay", onCanPlay);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("durationchange", onDuration);
      video.removeEventListener("error", onError);
      video.removeEventListener("canplay", onCanPlay);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      // When the user presses play manually, unmute so they can hear it.
      if (muted) video.muted = false;
      video.play().catch(() => setError(true));
    } else {
      video.pause();
    }
  }, [muted]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const next = !video.muted;
    video.muted = next;
    setMuted(next);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void video.requestFullscreen();
    }
  }, []);

  const seek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const next = Number(e.target.value);
    video.currentTime = next;
    setCurrentTime(next);
  }, []);

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div
      className={`relative overflow-hidden bg-black ${className}`}
      onMouseEnter={hoverAutoplay ? () => setHovered(true) : undefined}
      onMouseLeave={hoverAutoplay ? () => setHovered(false) : undefined}
    >
      {/* Single video element. Native controls are ALWAYS enabled so users can
          play/pause, adjust volume, toggle mute, scrub, and go fullscreen. */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        controls
        muted={muted}
        playsInline
        loop
        preload={hoverAutoplay ? "none" : "metadata"}
        className="h-full w-full object-cover"
        aria-label={alt}
      />

      {/* Loading spinner */}
      {loading && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
          <Loader2 className="h-8 w-8 animate-spin text-white/80" />
        </div>
      )}

      {/* Error fallback — never show a blank white frame */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#1A1A1C] text-center p-4">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-xs font-medium text-white/80">Video unavailable</p>
          <p className="text-[10px] text-white/50 leading-relaxed">
            The file may be in an unsupported format. Try MP4 (H.264) for the best compatibility.
          </p>
        </div>
      )}

      {/* Overlay play button for compact previews (native controls remain usable too) */}
      {compact && !error && !playing && (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors"
          aria-label="Play video"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-lg">
            <Play className="h-5 w-5 text-black pl-0.5" fill="currentColor" />
          </span>
        </button>
      )}

      {/* Compact control bar: play/pause + mute toggle + scrubber */}
      {compact && !error && (
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2 flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            className="text-white hover:text-white/80"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 pl-0.5" fill="currentColor" />}
          </button>
          <button
            type="button"
            onClick={toggleMute}
            className="text-white hover:text-white/80"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <span className="text-[10px] text-white/80 tabular-nums">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step="0.1"
            value={currentTime}
            onChange={seek}
            className="flex-1 h-1 accent-white"
            aria-label="Seek"
          />
          <span className="text-[10px] text-white/60 tabular-nums">{formatTime(duration)}</span>
          {!hoverAutoplay && (
            <button
              type="button"
              onClick={toggleFullscreen}
              className="text-white hover:text-white/80"
              aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}