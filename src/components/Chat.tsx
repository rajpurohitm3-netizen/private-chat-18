"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Send, Plus, Camera, Image as ImageIcon, MapPin, 
    Video, Mic, X, Download, Shield, AlertTriangle,
    Eye, EyeOff, Save, Trash2, ShieldCheck, Lock,
    Sparkles, Zap, ChevronLeft, Phone, Check, CheckCheck, ArrowLeft,
    MoreVertical, Trash, Star, Heart, ThumbsUp, Smile, Frown, Meh,
    Volume2, VolumeX, Minimize2, Maximize2, CameraOff, SwitchCamera
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AvatarDisplay } from "./AvatarDisplay";
import { sendPushNotification } from "@/hooks/usePushNotifications";

interface ChatProps {
  session: any;
  privateKey?: CryptoKey;
  initialContact: any;
  isPartnerOnline?: boolean;
  onBack?: () => void;
  onInitiateCall: (contact: any, mode: "video" | "voice") => void;
  isFriend?: boolean;
  onSendFriendRequest?: (userId: string) => void;
}

function formatLastSeen(lastSeen: string | null): string {
  if (!lastSeen) return "Offline";
  const date = new Date(lastSeen);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  
  if (diffMins < 1) return "Last seen just now";
  if (diffMins < 60) return `Last seen ${diffMins}m ago`;
  if (diffHours < 24 && date.getDate() === now.getDate()) return `Last seen today at ${timeStr}`;
  if (diffDays === 1 || (diffHours < 48 && date.getDate() === now.getDate() - 1)) return `Last seen yesterday at ${timeStr}`;
  
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `Last seen ${dateStr} at ${timeStr}`;
}

export function Chat({ session, privateKey, initialContact, isPartnerOnline, onBack, onInitiateCall, isFriend = true, onSendFriendRequest }: ChatProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [showOptions, setShowOptions] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [contactProfile, setContactProfile] = useState<any>(initialContact);
  const [partnerPresence, setPartnerPresence] = useState<{
    isOnline: boolean;
    isInChat: boolean;
    isTyping: boolean;
  }>({ isOnline: false, isInChat: false, isTyping: false });
  const [isFocused, setIsFocused] = useState(true);
  const [showSnapshotView, setShowSnapshotView] = useState<any>(null);
  const [snapshotViewMode, setSnapshotViewMode] = useState<"view" | "save">("view");
  const [showSaveToVault, setShowSaveToVault] = useState<any>(null);
  const [vaultPassword, setVaultPassword] = useState("");
  const [longPressedMessage, setLongPressedMessage] = useState<any>(null);
  const [showMenu, setShowMenu] = useState(false);
  
  // Persistence for auto-delete mode
  const [autoDeleteMode, setAutoDeleteMode] = useState<"none" | "view" | "3h">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`chatify_auto_delete_${session.user.id}`);
      return (saved as any) || "none";
    }
    return "none";
  });

  useEffect(() => {
    localStorage.setItem(`chatify_auto_delete_${session.user.id}`, autoDeleteMode);
  }, [autoDeleteMode, session.user.id]);

  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<"user" | "environment">("user");
  
  // Camera stream handling to prevent black screen
  useEffect(() => {
    let active = true;
    if (showCamera && stream && videoRef.current) {
      const video = videoRef.current;
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      
      const playVideo = async () => {
        try {
          if (video.paused) {
            await video.play();
          }
        } catch (e) {
          console.error("Snapshot camera play failed:", e);
        }
      };

      video.onloadedmetadata = () => {
        if (active) playVideo();
      };

      if (video.readyState >= 2 && active) {
        playVideo();
      }
    }
    return () => { active = false; };
  }, [showCamera, stream]);

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (msg: any) => {
    longPressTimerRef.current = setTimeout(() => {
      setLongPressedMessage(msg);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchMove = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  useEffect(() => {
    const handleBlur = () => setIsFocused(false);
    const handleFocus = () => setIsFocused(true);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  useEffect(() => {
    if (!isFocused && showSnapshotView) {
      toast.error("Security Alert: Unauthorized access attempt detected. Snapshot obscured.");
    }
  }, [isFocused, showSnapshotView]);

  async function saveToVault(message: any) {
    if (!vaultPassword) {
      toast.error("Enter vault password to authorize storage");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("vault_password")
      .eq("id", session.user.id)
      .single();

    if (profile?.vault_password !== vaultPassword) {
      toast.error("Invalid Vault Password");
      return;
    }

    toast.loading("Transferring intelligence to vault...");

    const { error } = await supabase.from("vault_items").insert({
      user_id: session.user.id,
      type: 'photo',
      file_url: message.media_url,
      file_name: `vault-${Date.now()}.jpg`,
      metadata: { source: 'chat', sender_id: message.sender_id }
    });

    toast.dismiss();
    if (error) {
      toast.error("Vault transfer failed");
    } else {
      toast.success("Intelligence secured in vault");
      setShowSaveToVault(null);
      setVaultPassword("");
    }
  }

  async function toggleSaveChat(message: any) {
    const isSaved = message.is_saved;
    const newSavedStatus = !isSaved;
    
    // If we are unsaving, check if the message should be immediately deleted
    let shouldBeDeleted = false;
    if (!newSavedStatus) {
      const now = new Date();
      const expiresAt = message.expires_at ? new Date(message.expires_at) : null;
      const isExpired = expiresAt && expiresAt < now;
      const isViewOnceAndViewed = message.is_view_once && message.is_viewed;
      
      if (isExpired || isViewOnceAndViewed) {
        shouldBeDeleted = true;
      }
    }

    if (shouldBeDeleted) {
      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("id", message.id);
      
      if (error) {
        toast.error("Failed to update status");
      } else {
        setMessages(prev => prev.filter(m => m.id !== message.id));
        toast.success("Message unsaved and purged as per auto-delete protocol");
      }
    } else {
      const { error } = await supabase
        .from("messages")
        .update({ is_saved: newSavedStatus })
        .eq("id", message.id);
      
      if (error) {
        toast.error("Failed to update status");
      } else {
        setMessages(prev => prev.map(m => m.id === message.id ? { ...m, is_saved: newSavedStatus } : m));
        toast.success(newSavedStatus ? "Message saved in chat" : "Message unsaved");
      }
    }
    setLongPressedMessage(null);
  }

  async function reactToMessage(message: any, reaction: string) {
    const reactions = message.reactions || {};
    reactions[session.user.id] = reaction;
    
    const { error } = await supabase
      .from("messages")
      .update({ reactions })
      .eq("id", message.id);
    
    if (error) {
      toast.error("Failed to react");
    } else {
      setMessages(prev => prev.map(m => m.id === message.id ? { ...m, reactions } : m));
    }
    setLongPressedMessage(null);
  }

  useEffect(() => {
    if (!initialContact || !session.user) return;

    const userIds = [session.user.id, initialContact.id].sort();
    const channelName = `presence-chat-${userIds[0]}-${userIds[1]}`;

    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: session.user.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const partnerState: any = state[initialContact.id];
        
        if (partnerState && partnerState.length > 0) {
          const latest = partnerState[partnerState.length - 1];
          setPartnerPresence({
            isOnline: true,
            isInChat: latest.current_chat_id === session.user.id,
            isTyping: latest.is_typing === true,
          });
        } else {
          setPartnerPresence({ isOnline: false, isInChat: false, isTyping: false });
        }
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        if (key === initialContact.id) {
          const latest = newPresences[newPresences.length - 1];
          setPartnerPresence({
            isOnline: true,
            isInChat: latest.current_chat_id === session.user.id,
            isTyping: latest.is_typing === true,
          });
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (key === initialContact.id) {
          setPartnerPresence({ isOnline: false, isInChat: false, isTyping: false });
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            online_at: new Date().toISOString(),
            current_chat_id: initialContact.id,
            is_typing: isTyping
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [initialContact, session.user, isTyping]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isTyping) setIsTyping(false);
    }, 3000);
    return () => clearTimeout(timeout);
  }, [newMessage]);

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (!isTyping) setIsTyping(true);
  };

  useEffect(() => {
    if (initialContact) {
      fetchMessages();
      const subscription = subscribeToMessages();
      
const cleanupInterval = setInterval(async () => {
          try {
            await fetch('/api/messages/cleanup', { method: 'POST' });
          } catch (e) {}
          fetchMessages();
        }, 30000);

      return () => {
        supabase.removeChannel(subscription);
        clearInterval(cleanupInterval);
      };
    }
  }, [initialContact]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  async function deleteMessage(id: string) {
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) {
      toast.error("Failed to purge intelligence packet");
    } else {
      setMessages(prev => prev.filter(m => m.id !== id));
      toast.success("Intelligence purged from node");
    }
  }

async function fetchMessages() {
      setLoading(true);
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(`and(sender_id.eq.${session.user.id},receiver_id.eq.${initialContact.id}),and(sender_id.eq.${initialContact.id},receiver_id.eq.${session.user.id})`)
        .order("created_at", { ascending: true });

      if (error) {
        toast.error("Failed to sync neural link");
      } else {
        setMessages(data || []);
        
        const unviewed = data?.filter(m => m.receiver_id === session.user.id && !m.is_viewed) || [];
        if (unviewed.length > 0) {
          const ids = unviewed.map(m => m.id);
          await supabase.from("messages").update({ 
            is_viewed: true, 
            viewed_at: new Date().toISOString() 
          }).in("id", ids);
          
          try {
            await fetch('/api/messages/cleanup', { method: 'POST' });
          } catch (e) {}
        }
      }
      setLoading(false);
    }

  function subscribeToMessages() {
    return supabase
      .channel(`chat-${initialContact.id}`)
      .on("postgres_changes", { 
        event: "INSERT", 
        schema: "public", 
        table: "messages",
        filter: `receiver_id=eq.${session.user.id}`
      }, async (payload) => {
        if (payload.new.sender_id === initialContact.id) {
          setMessages(prev => [...prev, payload.new]);
          
          await supabase.from("messages").update({ 
            is_delivered: true,
            delivered_at: new Date().toISOString()
          }).eq("id", payload.new.id);

          if (payload.new.media_type === 'snapshot') {
              toast.info("Secure Snapshot Received", {
                description: "A one-time view intelligence packet has arrived.",
                icon: <Camera className="w-4 h-4 text-purple-500" />
              });
              // Auto-open snapshot for receiver
              setShowSnapshotView(payload.new);
              // Increment view count
              const newViews = (payload.new.view_count || 0) + 1;
              await supabase.from("messages").update({ view_count: newViews }).eq("id", payload.new.id);
              setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, view_count: newViews } : m));
            }
        }
      })
    .on("postgres_changes", {
      event: "UPDATE",
      schema: "public",
      table: "messages"
    }, (payload) => {
      setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
    })
    .subscribe();
  }

  useEffect(() => {
    if (partnerPresence.isOnline) {
      const markDelivered = async () => {
        const undelivered = messages.filter(m => m.sender_id === session.user.id && !m.is_delivered);
        if (undelivered.length > 0) {
          const ids = undelivered.map(m => m.id);
          await supabase.from("messages").update({ 
            is_delivered: true, 
            delivered_at: new Date().toISOString() 
          }).in("id", ids);
        }
      };
      markDelivered();
    }
  }, [partnerPresence.isOnline, messages.length]);

  async function sendMessage(mediaType: string = "text", mediaUrl: string | null = null) {
    if (!newMessage.trim() && !mediaUrl) return;

    const messageData: any = {
      sender_id: session.user.id,
      receiver_id: initialContact.id,
      encrypted_content: newMessage.trim() || " ", 
      media_type: mediaType,
      media_url: mediaUrl,
      is_viewed: false,
      is_delivered: partnerPresence.isOnline,
      delivered_at: partnerPresence.isOnline ? new Date().toISOString() : null,
      expires_at: autoDeleteMode === "3h" ? new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString() : null,
      is_view_once: autoDeleteMode === "view"
    };

    if (mediaType === 'snapshot') {
      messageData.view_count = 0;
      messageData.is_view_once = true;
    }

    const { data, error } = await supabase.from("messages").insert(messageData).select();

    if (error) {
      console.error("Transmission error:", error);
      toast.error("Packet transmission failed: " + (error.message || "Protocol Error"));
    } else {
      const sentMsg = data?.[0] || messageData;
      setMessages(prev => [...prev, sentMsg]);
      setNewMessage("");
      setShowOptions(false);
      
      if (!partnerPresence.isOnline) {
        const { data: senderProfile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", session.user.id)
          .single();
        
        const msgPreview = mediaType === "text" 
          ? (newMessage.trim().substring(0, 50) + (newMessage.length > 50 ? "..." : ""))
          : mediaType === "snapshot" ? "Sent a snapshot"
          : mediaType === "location" ? "Shared location"
          : mediaType === "image" ? "Sent an image"
          : mediaType === "video" ? "Sent a video"
          : "Sent a message";

        sendPushNotification(
          initialContact.id,
          `${senderProfile?.username || "Someone"}`,
          msgPreview,
          session.user.id
        );
      }
    }
  }

  const sendLocation = async () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported");
      return;
    }

    toast.loading("Acquiring satellite coordinates...");
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      const url = `https://www.google.com/maps?q=${latitude},${longitude}`;
      toast.dismiss();
      await sendMessage("location", url);
      toast.success("Coordinates deployed");
    }, (err) => {
      toast.dismiss();
      toast.error("Signal lost: Location access denied");
    });
  };

  const startCamera = async (facingMode: "user" | "environment" = "user") => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      setCameraFacingMode(facingMode);
      const s = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }, 
        audio: false 
      });
      setStream(s);
      setShowCamera(true);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(console.error);
        };
      }
    } catch (err) {
      console.error("Camera error:", err);
      toast.error("Camera access denied or failed");
    }
  };

  const flipSnapshotCamera = async () => {
    const newFacingMode = cameraFacingMode === "user" ? "environment" : "user";
    await startCamera(newFacingMode);
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0);
    
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const fileName = `snapshot-${Date.now()}.jpg`;
      const filePath = `chat/${session.user.id}/${fileName}`;
      
      toast.loading("Securing snapshot...");
      const { error } = await supabase.storage.from("chat-media").upload(filePath, blob);
      if (error) {
        toast.dismiss();
        toast.error("Upload failed");
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(filePath);
      toast.dismiss();
      await sendMessage("snapshot", publicUrl);
      toast.success("Snapshot deployed");
      stopCamera();
    }, 'image/jpeg');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isSnapshot: boolean = false, type: "image" | "video" | "audio" = "image") => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.split(".").pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `chat/${session.user.id}/${fileName}`;

    toast.loading(isSnapshot ? "Securing snapshot..." : `Uploading ${type} packet...`);

    const { error: uploadError } = await supabase.storage
      .from("chat-media")
      .upload(filePath, file);

    if (uploadError) {
      toast.dismiss();
      toast.error("Upload failed");
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("chat-media")
      .getPublicUrl(filePath);

    toast.dismiss();
    await sendMessage(isSnapshot ? "snapshot" : type, publicUrl);
    toast.success(isSnapshot ? "Snapshot deployed" : `${type.charAt(0).toUpperCase() + type.slice(1)} transmitted`);
  };

  const openSnapshot = async (message: any) => {
    // Strictly 2 views limit for receiver
    const views = message.view_count || 0;
    
    if (message.receiver_id === session.user.id && views >= 2 && !message.is_saved) {
      toast.error("Snapshot expired: Intelligence purged");
      return;
    }
    
    setShowSnapshotView(message);
    
    if (message.receiver_id === session.user.id) {
      const newViews = views + 1;
      const isNowPurged = newViews >= 2;
      
      const { error } = await supabase.from("messages").update({ 
        is_viewed: isNowPurged,
        view_count: newViews,
        viewed_at: new Date().toISOString()
      }).eq("id", message.id);

      if (!error) {
        setMessages(prev => prev.map(m => m.id === message.id ? { ...m, is_viewed: isNowPurged, view_count: newViews } : m));
      }
    }
  };

  const closeSnapshot = async () => {
    if (showSnapshotView) {
      const message = showSnapshotView;
      // Receiver saving the snapshot
      if (message.receiver_id === session.user.id && !message.is_saved) {
        try {
          const { error } = await supabase.from("messages").update({ 
            is_saved: true,
            is_viewed: true // Mark as viewed but saved
          }).eq("id", message.id);
          
          if (!error) {
            setMessages(prev => prev.map(m => m.id === message.id ? { ...m, is_saved: true, is_viewed: true } : m));
            toast.success("Intelligence secured in chat history");
          }
        } catch (e) {
          console.error("Failed to save snapshot:", e);
        }
      }
    }
    setShowSnapshotView(null);
  };

  const saveToDevice = async (url: string, name: string = "nexus-media") => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${name}-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      toast.success("Intelligence saved to device");
    } catch (err) {
      toast.error("Download failed: Protocol error");
    }
  };

  if (!initialContact) return null;

  return (
    <div className="flex flex-col h-full bg-[#030303] relative overflow-hidden select-none" onContextMenu={(e) => e.preventDefault()}>
      <style jsx global>{`
        @media print { body { display: none; } }
        .no-screenshot {
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          user-select: none;
        }
      `}</style>

      {/* Header */}
      <header className="h-20 border-b border-white/5 bg-black/40 backdrop-blur-3xl flex items-center justify-between px-6 z-20 shrink-0">
          <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onBack} 
                className="text-white/20 hover:text-white mr-1 lg:hidden bg-white/5 rounded-xl border border-white/5"
              >
                <ArrowLeft className="w-6 h-6" />
              </Button>
              {onBack && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={onBack} 
                  className="text-white/20 hover:text-white mr-2 hidden lg:flex"
                >
                  <ArrowLeft className="w-6 h-6" />
                </Button>
              )}
          <div 
            className="cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => router.push(`/profile/${initialContact.id}`)}
          >
            <AvatarDisplay profile={initialContact} className="h-10 w-10 ring-2 ring-indigo-500/20" />
          </div>
<div 
  className="cursor-pointer"
  onClick={() => router.push(`/profile/${initialContact.id}`)}
>
                  <h3 className="text-sm font-black italic tracking-tighter uppercase text-white hover:text-indigo-400 transition-colors">{initialContact.username}</h3>
                  <p className={`text-[8px] font-bold uppercase tracking-widest ${partnerPresence.isOnline ? 'text-emerald-500' : 'text-white/20'}`}>
                    {partnerPresence.isOnline ? 'Online' : formatLastSeen(initialContact.last_seen)}
                  </p>
                </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => onInitiateCall(initialContact, "voice")} className="text-white/20 hover:text-white hover:bg-white/5 rounded-xl"><Phone className="w-4 h-4" /></Button>
        <Button variant="ghost" size="icon" onClick={() => onInitiateCall(initialContact, "video")} className="text-white/20 hover:text-white hover:bg-white/5 rounded-xl"><Video className="w-4 h-4" /></Button>
        <div className="relative">
          <Button variant="ghost" size="icon" onClick={() => setShowMenu(!showMenu)} className="text-white/20 hover:text-white hover:bg-white/5 rounded-xl"><MoreVertical className="w-4 h-4" /></Button>
          <AnimatePresence>
            {showMenu && (
              <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute right-0 top-12 w-48 bg-zinc-900 border border-white/10 rounded-2xl p-2 shadow-2xl z-50">
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/30 px-3 py-2">Auto-Delete Protocol</p>
                {[
                  { id: "none", label: "No Auto-Delete" },
                  { id: "view", label: "Delete After View" },
                  { id: "3h", label: "Delete After 3 Hours" }
                ].map(opt => (
                  <button key={opt.id} onClick={() => { setAutoDeleteMode(opt.id as any); setShowMenu(false); }} className={`w-full text-left px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${autoDeleteMode === opt.id ? 'bg-indigo-600 text-white' : 'text-white/60 hover:bg-white/5'}`}>
                    {opt.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>

      {/* Friend Request Banner - Show when not a friend */}
      {!isFriend && (
        <div className="px-6 py-4 bg-amber-500/10 border-b border-amber-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-xl">
                <Lock className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-400">Send Friend Request</p>
                <p className="text-[10px] text-white/40">You need to be friends to chat with {initialContact.username}</p>
              </div>
            </div>
            <Button
              onClick={() => onSendFriendRequest?.(initialContact.id)}
              className="h-10 px-4 bg-amber-600 hover:bg-amber-700 rounded-xl font-bold uppercase text-[10px]"
            >
              Send Request
            </Button>
          </div>
        </div>
      )}

      {/* Messages */}
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 no-screenshot">
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full opacity-20">
          <ShieldCheck className="w-12 h-12 mb-4" />
          <p className="text-[10px] font-black uppercase tracking-[0.4em]">End-to-End Encrypted</p>
        </div>
      ) : (
        messages.map((msg, i) => {
          const isMe = msg.sender_id === session.user.id;
          const reactions = msg.reactions || {};
          const reactionCounts = Object.values(reactions).reduce((acc: any, curr: any) => {
            acc[curr] = (acc[curr] || 0) + 1;
            return acc;
          }, {});

            return (
              <motion.div 
                key={msg.id}
                initial={{ opacity: 0, x: isMe ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex ${isMe ? "justify-end" : "justify-start"} touch-none`}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setLongPressedMessage(msg);
                }}
                onTouchStart={() => handleTouchStart(msg)}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchMove}
                onMouseDown={() => handleTouchStart(msg)}
                onMouseUp={handleTouchEnd}
                onMouseLeave={handleTouchEnd}
              >
              <div className={`max-w-[80%] flex flex-col ${isMe ? "items-end" : "items-start"} relative`}>
                {msg.media_type === 'snapshot' ? (
                  <button 
                    onClick={() => openSnapshot(msg)}
                    className={`group relative p-4 rounded-[2rem] border transition-all ${
                      msg.view_count >= 2 && !isMe 
                        ? "bg-zinc-900/50 border-white/5 opacity-50 cursor-not-allowed" 
                        : "bg-purple-600/10 border-purple-500/30 hover:bg-purple-600/20"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-purple-500/20 flex items-center justify-center">
                        {msg.view_count >= 2 && !isMe ? <EyeOff className="w-5 h-5 text-purple-400" /> : <Camera className="w-5 h-5 text-purple-400" />}
                      </div>
                      <div className="text-left">
                          <p className="text-[10px] font-black uppercase tracking-widest text-white">Snapshot</p>
                          <p className="text-[8px] font-bold text-purple-400 uppercase tracking-tighter">
                            {msg.view_count >= 2 && !isMe ? "Purged" : `${msg.is_saved ? 'Saved' : 'Viewable'}`}
                          </p>
                        </div>
                      </div>
                    </button>
                ) : msg.media_type === 'image' ? (
                    <div className="group relative rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl">
                      <img src={msg.media_url} alt="" className="max-w-full max-h-80 object-cover" />
                    </div>
                  ) : msg.media_type === 'location' ? (
                    <div className={`p-5 rounded-[2rem] border transition-all ${
                      isMe ? "bg-emerald-600 border-emerald-500 shadow-lg shadow-emerald-600/20" : "bg-white/[0.03] border-white/5"
                    }`}>
                      <div className="flex items-center gap-4">
                        <MapPin className="w-6 h-6 text-white animate-pulse" />
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-white">Live Satellite Link</p>
                          <Button variant="link" onClick={() => window.open(msg.media_url, '_blank')} className="text-white font-bold p-0 h-auto underline text-[10px] uppercase tracking-tighter">Open Satellite View</Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                        <div className={`group/msg relative p-5 rounded-[2rem] text-sm font-medium leading-relaxed transition-all ${
                        msg.is_saved 
                          ? "bg-[#FCFCFA]/80 backdrop-blur-md text-amber-900 border border-amber-400/50 shadow-[0_10px_20px_rgba(251,191,36,0.1)]" 
                          : isMe 
                          ? "bg-indigo-600 text-white shadow-xl shadow-indigo-600/10" 
                          : "bg-white/[0.03] border border-white/5 text-white/90"
                      }`}>
                        {msg.encrypted_content}
                        {msg.is_saved && <Star className="absolute -top-2 -right-2 w-5 h-5 text-amber-500 fill-amber-500" />}
                      </div>
                  )}

                  {/* Reactions Display */}
                    {Object.keys(reactionCounts as Record<string, number>).length > 0 && (
                      <div className={`flex gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {Object.entries(reactionCounts as Record<string, number>).map(([reaction, count]) => (
                          <div key={reaction} className="bg-white/10 border border-white/5 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <span className="text-xs">{reaction}</span>
                            <span className="text-[8px] font-black text-white/40">{count}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-2 px-2">
                      <span className="text-[7px] font-black uppercase tracking-widest text-white/10">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                          {isMe && (
                            <div className="flex items-center">
                              {msg.is_viewed ? (
                                <CheckCheck className="w-2.5 h-2.5 text-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                              ) : msg.is_delivered ? (
                                <CheckCheck className="w-2.5 h-2.5 text-white/90" />
                              ) : (
                                <Check className="w-2.5 h-2.5 text-zinc-600" />
                              )}
                            </div>
                          )}
                    </div>
                </div>
              </motion.div>
            );
          })
        )}

          <div ref={messagesEndRef} />
        </div>

        {/* Status Indicators (Bottom Left) */}
        <div className="absolute bottom-28 left-6 z-40 pointer-events-none flex flex-col gap-2">
          <AnimatePresence>
            {partnerPresence.isTyping && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center gap-2 bg-indigo-600/20 backdrop-blur-md border border-indigo-500/30 px-3 py-1.5 rounded-full"
              >
                <div className="flex gap-1">
                  <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="w-1 h-1 bg-indigo-400 rounded-full" />
                  <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1 h-1 bg-indigo-400 rounded-full" />
                  <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1 h-1 bg-indigo-400 rounded-full" />
                </div>
                <span className="text-[8px] font-black uppercase tracking-widest text-indigo-400">{initialContact.username} is typing...</span>
              </motion.div>
            )}
            {partnerPresence.isInChat && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center gap-2 bg-emerald-600/20 backdrop-blur-md border border-emerald-500/30 px-3 py-1.5 rounded-full"
              >
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400">{initialContact.username} is in chat</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

          {/* Input Area */}
        <footer className="p-6 bg-black/40 backdrop-blur-3xl border-t border-white/5 relative z-30 shrink-0">
          {!isFriend ? (
            <div className="flex flex-col items-center justify-center py-4 gap-4">
              <div className="flex items-center gap-2 text-white/40">
                <Lock className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Friend request required to message</span>
              </div>
              <Button 
                onClick={() => onSendFriendRequest?.(initialContact.id)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-xs px-8 py-3 rounded-2xl"
              >
                <Plus className="w-4 h-4 mr-2" /> Send Friend Request
              </Button>
            </div>
          ) : (
          <div className="flex items-center gap-3 relative">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShowOptions(!showOptions)}
              className={`h-12 w-12 rounded-2xl transition-all ${showOptions ? 'bg-indigo-600 text-white rotate-45' : 'bg-white/5 text-white/20'}`}
            >
              <Plus className="w-6 h-6" />
            </Button>
            
              <input 
                value={newMessage}
                onChange={handleTyping}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="Type intelligence packet..."
                className="flex-1 bg-white/[0.03] border border-white/10 rounded-[2rem] h-12 px-6 text-sm font-medium outline-none focus:border-indigo-500/50 transition-all placeholder:text-white/10"
              />

            <Button 
              onClick={() => sendMessage()}
              disabled={!newMessage.trim()}
              className="h-12 w-12 rounded-2xl bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/20 disabled:opacity-20"
            >
              <Send className="w-5 h-5" />
            </Button>

            <AnimatePresence>
              {showOptions && (
                <motion.div initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.9 }} className="absolute bottom-20 left-0 w-64 bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] p-4 shadow-2xl z-50 overflow-hidden">
                  <div className="grid grid-cols-2 gap-2">
                      <label className="flex flex-col items-center justify-center p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-indigo-600/10 hover:border-indigo-500/30 transition-all cursor-pointer group">
                        <ImageIcon className="w-6 h-6 text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-white/40">Photo</span>
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, false, "image")} />
                      </label>
                      
                        <button onClick={() => startCamera()} className="flex flex-col items-center justify-center p-4 bg-purple-600/5 border border-purple-500/20 rounded-2xl hover:bg-purple-600/20 hover:border-purple-500/40 transition-all group">
                          <Camera className="w-6 h-6 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                          <span className="text-[8px] font-black uppercase tracking-widest text-white/40">Snapshot</span>
                        </button>

                        <button onClick={sendLocation} className="flex flex-col items-center justify-center p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-emerald-600/10 hover:border-emerald-500/30 transition-all group">
                          <MapPin className="w-6 h-6 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
                          <span className="text-[8px] font-black uppercase tracking-widest text-white/40">Location</span>
                        </button>

                      <label className="flex flex-col items-center justify-center p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-indigo-600/10 hover:border-indigo-500/30 transition-all cursor-pointer group">
                        <Video className="w-6 h-6 text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-white/40">Video</span>
                        <input type="file" className="hidden" accept="video/*" onChange={(e) => handleFileUpload(e, false, "video")} />
                      </label>

                      <label className="flex flex-col items-center justify-center p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-indigo-600/10 hover:border-indigo-500/30 transition-all cursor-pointer group">
                        <Mic className="w-6 h-6 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-white/40">Audio</span>
                        <input type="file" className="hidden" accept="audio/*" onChange={(e) => handleFileUpload(e, false, "audio")} />
                      </label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          )}
        </footer>

        {/* Long Press Menu */}
        <AnimatePresence>
          {longPressedMessage && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-6" 
              onClick={() => setLongPressedMessage(null)}
            >
                <motion.div 
                  initial={{ scale: 0.9, y: 20 }} 
                  animate={{ scale: 1, y: 0 }} 
                  className="bg-[#0a0a0a]/90 backdrop-blur-2xl border border-white/10 rounded-[3rem] p-8 w-full max-w-sm space-y-8 shadow-[0_50px_100px_rgba(0,0,0,0.8)]" 
                  onClick={e => e.stopPropagation()}
                >
                  <div className="space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-500/50 text-center">Neural Reactions</p>
                    <div className="flex justify-between gap-2 overflow-x-auto pb-4 no-scrollbar">
                      {['❤️', '👍', '😂', '😮', '😢', '🔥', '✨', '💯'].map(emoji => (
                        <button 
                          key={emoji} 
                          onClick={() => reactToMessage(longPressedMessage, emoji)} 
                          className="text-4xl hover:scale-125 transition-transform p-2 active:scale-90 grayscale-[0.5] hover:grayscale-0"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Button 
                      onClick={() => toggleSaveChat(longPressedMessage)} 
                      className={`w-full h-16 rounded-[1.5rem] border font-black uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-3 ${
                        longPressedMessage.is_saved 
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.1)]' 
                          : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:border-amber-500/20 hover:text-amber-500'
                      }`}
                    >
                      <Star className={`w-5 h-5 ${longPressedMessage.is_saved ? 'fill-amber-500' : ''}`} />
                      {longPressedMessage.is_saved ? 'Unsave from Chat' : 'Save to Chat'}
                    </Button>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <Button 
                        onClick={() => setShowSaveToVault(longPressedMessage)} 
                        className="h-16 rounded-[1.5rem] bg-indigo-500/5 border border-indigo-500/20 text-indigo-400 font-black uppercase tracking-widest text-[9px] hover:bg-indigo-500/10 transition-all flex items-center justify-center gap-2"
                      >
                        <Shield className="w-4 h-4" /> Vault
                      </Button>
                      <Button 
                        onClick={() => deleteMessage(longPressedMessage.id)} 
                        className="h-16 rounded-[1.5rem] bg-red-500/5 border border-red-500/20 text-red-500 font-black uppercase tracking-widest text-[9px] hover:bg-red-500/10 transition-all flex items-center justify-center gap-2"
                      >
                        <Trash className="w-4 h-4" /> Purge
                      </Button>
                    </div>
                  </div>
                </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      {/* Camera Modal */}
      <AnimatePresence>
        {showCamera && (
            <div className="fixed inset-0 z-[150] bg-black flex flex-col items-center justify-center">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: cameraFacingMode === "user" ? 'scaleX(-1)' : 'none' }} />
              <div className="absolute bottom-10 flex gap-6 items-center">
              <Button onClick={stopCamera} variant="ghost" className="bg-white/10 hover:bg-white/20 rounded-full h-14 w-14"><X className="w-6 h-6 text-white" /></Button>
              <button onClick={capturePhoto} className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center"><div className="w-14 h-14 rounded-full bg-white" /></button>
              <Button onClick={flipSnapshotCamera} variant="ghost" className="bg-white/10 hover:bg-white/20 rounded-full h-14 w-14"><SwitchCamera className="w-6 h-6 text-white" /></Button>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Snapshot Modal */}
        <AnimatePresence>
          {showSnapshotView && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.9 }} 
              className="fixed inset-0 z-[100] bg-black backdrop-blur-3xl flex items-center justify-center p-3 sm:p-6"
            >
              <div className={`relative w-full max-w-2xl h-full sm:h-auto sm:aspect-[3/4] max-h-[90vh] bg-black rounded-[2rem] sm:rounded-[3rem] overflow-hidden border border-white/10 flex flex-col transition-all duration-500 ${!isFocused ? 'blur-3xl opacity-50' : 'blur-0 opacity-100'}`}>
                <div className="flex-1 relative min-h-0">
                  <img src={showSnapshotView.media_url} alt="" className="w-full h-full object-contain pointer-events-none select-none" />
                  {!isFocused && (
                    <div className="absolute inset-0 flex items-center justify-center z-50">
                      <div className="bg-black/80 backdrop-blur-md p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] border border-white/10 text-center">
                        <Lock className="w-10 h-10 sm:w-12 sm:h-12 text-red-500 mx-auto mb-4 animate-pulse" />
                        <p className="text-lg sm:text-xl font-black italic text-white uppercase tracking-tighter">Privacy Lock Active</p>
                      </div>
                    </div>
                  )}
                  {/* Close button on image */}
                  <button 
                    onClick={closeSnapshot}
                    className="absolute top-4 right-4 w-12 h-12 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 hover:bg-red-500/30 transition-all"
                  >
                    <X className="w-6 h-6 text-white" />
                  </button>
                  {/* Sender info */}
                  <div className="absolute top-4 left-4 flex items-center gap-3 bg-black/50 backdrop-blur-md rounded-full px-4 py-2 border border-white/10">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white">
                      {showSnapshotView.sender_id === session.user.id ? 'You sent this' : 'Received'}
                    </span>
                  </div>
                </div>
                <div className="p-4 sm:p-6 md:p-10 bg-black/80 backdrop-blur-xl border-t border-white/5 shrink-0">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="text-lg sm:text-xl font-black italic text-white uppercase tracking-tighter">Temporal Snapshot</h4>
                      <p className="text-[9px] sm:text-[10px] text-purple-400 font-bold uppercase tracking-widest mt-1">
                        {showSnapshotView.is_saved ? 'Saved to Chat' : 'Will save on close'}
                      </p>
                    </div>
                    <div className="flex gap-2 sm:gap-4 w-full sm:w-auto">
                      <Button 
                        onClick={() => saveToDevice(showSnapshotView.media_url, "snapshot-intel")} 
                        variant="ghost" 
                        className="flex-1 sm:flex-none h-12 sm:h-16 px-4 sm:px-8 bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 border border-amber-500/30 rounded-xl sm:rounded-2xl font-black tracking-widest text-[9px] sm:text-[10px] uppercase"
                      >
                        <Download className="w-4 h-4 sm:mr-3" />
                        <span className="hidden sm:inline">Download</span>
                      </Button>
                      <Button 
                        onClick={closeSnapshot} 
                        variant="ghost" 
                        className="flex-1 sm:flex-none h-12 sm:h-16 px-4 sm:px-8 bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-xl sm:rounded-2xl font-black tracking-widest text-[9px] sm:text-[10px] uppercase"
                      >
                        <Check className="w-4 h-4 sm:mr-3" />
                        <span className="hidden sm:inline">Close & Save</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      {/* Vault Password Modal */}
      <AnimatePresence>
        {showSaveToVault && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-10 rounded-[3rem] space-y-8">
              <div className="text-center space-y-2">
                <Shield className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
                <h3 className="text-2xl font-black uppercase italic">Vault Authorization</h3>
              </div>
              <Input type="password" placeholder="Enter Vault Password" value={vaultPassword} onChange={(e) => setVaultPassword(e.target.value)} className="h-14 bg-zinc-800 border-zinc-700 rounded-2xl px-6 text-center tracking-widest" />
              <div className="flex gap-4">
                <Button variant="ghost" onClick={() => setShowSaveToVault(null)} className="flex-1 h-14 rounded-2xl uppercase font-bold text-[10px]">Cancel</Button>
                <Button onClick={() => saveToVault(showSaveToVault)} className="flex-1 h-14 rounded-2xl bg-indigo-600 uppercase font-bold text-[10px]">Secure Intel</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
