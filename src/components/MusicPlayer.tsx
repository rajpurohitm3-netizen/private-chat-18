"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Shuffle,
  Upload,
  Music,
  Trash2,
  Search,
  X,
  Youtube,
  Folder,
  ListMusic,
  Heart,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  Minimize2,
  Maximize2,
  Radio
} from "lucide-react";

interface Track {
  id: string;
  name: string;
  artist?: string;
  url: string;
  type: "local" | "youtube";
  duration?: number;
  thumbnail?: string;
}

interface MusicPlayerProps {
  onClose?: () => void;
}

export function MusicPlayer({ onClose }: MusicPlayerProps) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [showYoutubeInput, setShowYoutubeInput] = useState(false);
  const [activeTab, setActiveTab] = useState<"library" | "youtube">("library");
  const [isMinimized, setIsMinimized] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);

  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const youtubePlayerRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const savedTracks = localStorage.getItem("music_tracks");
    const savedFavorites = localStorage.getItem("music_favorites");
    if (savedTracks) setTracks(JSON.parse(savedTracks));
    if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
  }, []);

  useEffect(() => {
    if (tracks.length > 0) {
      localStorage.setItem("music_tracks", JSON.stringify(tracks));
    }
  }, [tracks]);

  useEffect(() => {
    localStorage.setItem("music_favorites", JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.name,
        artist: currentTrack.artist || 'Unknown Artist',
        artwork: currentTrack.thumbnail ? [{ src: currentTrack.thumbnail, sizes: '512x512', type: 'image/jpeg' }] : []
      });

      navigator.mediaSession.setActionHandler('play', () => handlePlayPause());
      navigator.mediaSession.setActionHandler('pause', () => handlePlayPause());
      navigator.mediaSession.setActionHandler('previoustrack', () => playPrevious());
      navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
    }
  }, [currentTrack, isPlaying]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newTracks: Track[] = [];
      Array.from(files).forEach((file) => {
        const url = URL.createObjectURL(file);
        const name = file.name.replace(/\.[^/.]+$/, "");
        newTracks.push({
          id: `local-${Date.now()}-${Math.random()}`,
          name,
          url,
          type: "local"
        });
      });
      setTracks((prev) => [...prev, ...newTracks]);
      toast.success(`Added ${newTracks.length} track(s)`);
    }
  };

  const extractYouTubeId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/shorts\/([^&\n?#]+)/
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const addYoutubeTrack = () => {
    const videoId = extractYouTubeId(youtubeUrl);
    if (!videoId) {
      toast.error("Invalid YouTube URL");
      return;
    }

    const newTrack: Track = {
      id: `youtube-${videoId}`,
      name: "YouTube Video",
      url: youtubeUrl,
      type: "youtube",
      thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
    };

    setTracks((prev) => [...prev, newTrack]);
    setYoutubeUrl("");
    setShowYoutubeInput(false);
    toast.success("YouTube track added");
  };

  const playTrack = (track: Track) => {
    if (currentTrack?.id === track.id) {
      handlePlayPause();
      return;
    }

    setCurrentTrack(track);
    setIsPlaying(true);

    if (track.type === "local" && audioRef.current) {
      audioRef.current.src = track.url;
      audioRef.current.play().catch((e) => console.error("Play failed:", e));
    }
  };

  const handlePlayPause = () => {
    if (!currentTrack) {
      if (tracks.length > 0) {
        playTrack(tracks[0]);
      }
      return;
    }

    if (currentTrack.type === "local" && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
    setIsPlaying(!isPlaying);
  };

  const playNext = () => {
    if (!currentTrack || tracks.length === 0) return;
    const currentIndex = tracks.findIndex((t) => t.id === currentTrack.id);
    let nextIndex;
    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * tracks.length);
    } else {
      nextIndex = (currentIndex + 1) % tracks.length;
    }
    playTrack(tracks[nextIndex]);
  };

  const playPrevious = () => {
    if (!currentTrack || tracks.length === 0) return;
    const currentIndex = tracks.findIndex((t) => t.id === currentTrack.id);
    const prevIndex = currentIndex === 0 ? tracks.length - 1 : currentIndex - 1;
    playTrack(tracks[prevIndex]);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    if (isRepeat) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else {
      playNext();
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    setIsMuted(value[0] === 0);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const removeTrack = (trackId: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
    if (currentTrack?.id === trackId) {
      setCurrentTrack(null);
      setIsPlaying(false);
    }
  };

  const toggleFavorite = (trackId: string) => {
    setFavorites((prev) =>
      prev.includes(trackId)
        ? prev.filter((id) => id !== trackId)
        : [...prev, trackId]
    );
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const filteredTracks = tracks.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getYouTubeVideoId = (track: Track) => {
    if (track.type !== "youtube") return null;
    return extractYouTubeId(track.url);
  };

  if (isMinimized && currentTrack) {
    return (
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed bottom-24 lg:bottom-6 left-4 right-4 lg:left-auto lg:right-6 lg:w-96 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 z-50 shadow-2xl"
      >
        <audio
          ref={audioRef}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
        />
        <div className="flex items-center gap-4">
          {currentTrack.thumbnail && (
            <img
              src={currentTrack.thumbnail}
              alt={currentTrack.name}
              className="w-12 h-12 rounded-xl object-cover"
            />
          )}
          {!currentTrack.thumbnail && (
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
              <Music className="w-6 h-6 text-white" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">{currentTrack.name}</p>
            <p className="text-xs text-white/40">{formatTime(currentTime)} / {formatTime(duration)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={playPrevious} size="icon" variant="ghost" className="h-8 w-8">
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button onClick={handlePlayPause} size="icon" className="h-10 w-10 rounded-full bg-indigo-600">
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </Button>
            <Button onClick={playNext} size="icon" variant="ghost" className="h-8 w-8">
              <SkipForward className="w-4 h-4" />
            </Button>
            <Button onClick={() => setIsMinimized(false)} size="icon" variant="ghost" className="h-8 w-8">
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <Slider value={[currentTime]} max={duration || 100} step={1} onValueChange={handleSeek} className="mt-3" />
      </motion.div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-zinc-950 to-[#030303] overflow-hidden">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      <input
        type="file"
        ref={fileInputRef}
        accept="audio/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="p-6 border-b border-white/5">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl">
              <Music className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter">Music</h2>
              <p className="text-sm text-white/40">Your personal playlist</p>
            </div>
          </div>
          {currentTrack && (
            <Button onClick={() => setIsMinimized(true)} size="icon" variant="ghost" className="h-10 w-10">
              <Minimize2 className="w-5 h-5" />
            </Button>
          )}
        </div>

        <div className="flex gap-2 mb-4">
          <Button
            onClick={() => setActiveTab("library")}
            className={`flex-1 h-12 rounded-xl font-bold uppercase text-xs ${activeTab === "library" ? "bg-white/10" : "bg-white/5 text-white/40"}`}
          >
            <Folder className="w-4 h-4 mr-2" /> Library
          </Button>
          <Button
            onClick={() => setActiveTab("youtube")}
            className={`flex-1 h-12 rounded-xl font-bold uppercase text-xs ${activeTab === "youtube" ? "bg-red-500/20 text-red-400" : "bg-white/5 text-white/40"}`}
          >
            <Youtube className="w-4 h-4 mr-2" /> YouTube
          </Button>
        </div>

        {activeTab === "library" && (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input
                placeholder="Search tracks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 bg-white/5 border-white/10 rounded-xl"
              />
            </div>
            <Button onClick={() => fileInputRef.current?.click()} className="h-12 px-4 bg-indigo-600 hover:bg-indigo-700 rounded-xl">
              <Upload className="w-4 h-4 mr-2" /> Add
            </Button>
          </div>
        )}

        {activeTab === "youtube" && (
          <div className="flex gap-2">
            <Input
              placeholder="Paste YouTube URL..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              className="flex-1 h-12 bg-white/5 border-white/10 rounded-xl"
            />
            <Button onClick={addYoutubeTrack} disabled={!youtubeUrl.trim()} className="h-12 px-4 bg-red-600 hover:bg-red-700 rounded-xl">
              <Youtube className="w-4 h-4 mr-2" /> Add
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        {filteredTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
            <ListMusic className="w-16 h-16 mb-4" />
            <p className="text-lg font-bold">No tracks yet</p>
            <p className="text-sm">Add local files or YouTube videos</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTracks.map((track) => {
              const isActive = currentTrack?.id === track.id;
              const isFav = favorites.includes(track.id);
              return (
                <motion.div
                  key={track.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => playTrack(track)}
                  className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all ${
                    isActive ? "bg-indigo-600/20 border border-indigo-500/30" : "bg-white/[0.02] hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <div className="relative">
                    {track.thumbnail ? (
                      <img src={track.thumbnail} alt={track.name} className="w-14 h-14 rounded-xl object-cover" />
                    ) : (
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${isActive ? "bg-indigo-600" : "bg-white/10"}`}>
                        <Music className="w-6 h-6" />
                      </div>
                    )}
                    {isActive && isPlaying && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
                        <div className="flex items-end gap-0.5 h-4">
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              animate={{ height: ["40%", "100%", "40%"] }}
                              transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                              className="w-1 bg-white rounded-full"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {track.type === "youtube" && (
                      <div className="absolute -bottom-1 -right-1 p-1 bg-red-600 rounded-full">
                        <Youtube className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold truncate ${isActive ? "text-indigo-400" : ""}`}>{track.name}</p>
                    <p className="text-xs text-white/40 uppercase">{track.type === "youtube" ? "YouTube" : "Local"}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(track.id); }}
                      size="icon"
                      variant="ghost"
                      className={`h-8 w-8 ${isFav ? "text-pink-500" : "text-white/20"}`}
                    >
                      <Heart className={`w-4 h-4 ${isFav ? "fill-current" : ""}`} />
                    </Button>
                    <Button
                      onClick={(e) => { e.stopPropagation(); removeTrack(track.id); }}
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-white/20 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {currentTrack && currentTrack.type === "youtube" && (
        <div className="px-6 pb-4">
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black">
            <iframe
              ref={iframeRef}
              src={`https://www.youtube.com/embed/${getYouTubeVideoId(currentTrack)}?autoplay=1&enablejsapi=1`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {currentTrack && currentTrack.type === "local" && (
        <div className="p-6 border-t border-white/5 bg-zinc-900/50 backdrop-blur-xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center flex-shrink-0">
              <Music className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-lg truncate">{currentTrack.name}</p>
              <p className="text-sm text-white/40">Now Playing</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-white/40 w-10">{formatTime(currentTime)}</span>
              <Slider value={[currentTime]} max={duration || 100} step={1} onValueChange={handleSeek} className="flex-1" />
              <span className="text-xs font-mono text-white/40 w-10 text-right">{formatTime(duration)}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button onClick={() => setIsShuffle(!isShuffle)} size="icon" variant="ghost" className={`h-10 w-10 rounded-xl ${isShuffle ? "text-indigo-400 bg-indigo-500/20" : "text-white/40"}`}>
                  <Shuffle className="w-4 h-4" />
                </Button>
                <Button onClick={() => setIsRepeat(!isRepeat)} size="icon" variant="ghost" className={`h-10 w-10 rounded-xl ${isRepeat ? "text-indigo-400 bg-indigo-500/20" : "text-white/40"}`}>
                  <Repeat className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button onClick={playPrevious} size="icon" variant="ghost" className="h-12 w-12 rounded-xl text-white/60 hover:text-white">
                  <SkipBack className="w-5 h-5" />
                </Button>
                <Button onClick={handlePlayPause} size="icon" className="h-16 w-16 rounded-2xl bg-indigo-600 hover:bg-indigo-700">
                  {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
                </Button>
                <Button onClick={playNext} size="icon" variant="ghost" className="h-12 w-12 rounded-xl text-white/60 hover:text-white">
                  <SkipForward className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button onClick={toggleMute} size="icon" variant="ghost" className="h-10 w-10 rounded-xl text-white/40">
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
                <Slider value={[isMuted ? 0 : volume]} max={1} step={0.1} onValueChange={handleVolumeChange} className="w-20" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
