import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { AnimatePresence } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import UserCard from "@/components/nearme/UserCard";
import AgreementCard, { type Agreement } from "@/components/nearme/AgreementCard";
import MeetupRequestModal from "@/components/nearme/MeetupRequestModal";
import PaymentQRDialog from "@/components/nearme/PaymentQRDialog";
import LiveSection from "@/components/nearme/LiveSection";
import AreaAutocomplete from "@/components/AreaAutocomplete";
import { MapPin, Search, Users, DollarSign, Handshake, X, FileText, ScrollText, Radio, Navigation } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { encodeMeetupLocation, getBrowserLocation, haversineKm, parseMeetupLocation, type GeoPoint } from "@/lib/geo";
import { reverseGeocode } from "@/lib/geocoding";

type AvailabilityType = "public" | "private";
type HangoutType = "free" | "paid";

type NearbyUser = {
  id: string;
  username: string;
  avatar: string;
  distance: number | null;
  bio: string;
  availability: AvailabilityType;
  hangoutType: HangoutType;
  rate?: number;
  purpose?: string;
  location?: string;
};

type MeetupRow = {
  id: string;
  host_id: string;
  guest_id: string;
  status: string;
  location: string | null;
  notes: string | null;
  created_at: string;
  scheduled_at: string | null;
};

const filterOptions = ["All", "Free", "Paid", "Public", "Private"] as const;

const fromNow = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const parseNotes = (raw: string | null) => {
  if (!raw) return { purpose: "Meetup request", bidAmount: undefined as string | undefined };
  try {
    const parsed = JSON.parse(raw) as { purpose?: string; bidAmount?: string };
    return {
      purpose: parsed.purpose?.trim() || "Meetup request",
      bidAmount: parsed.bidAmount?.trim() || undefined,
    };
  } catch {
    return { purpose: raw, bidAmount: undefined as string | undefined };
  }
};

const NearMe = () => {
  const { user } = useAuth();
  const [range, setRange] = useState([10]);
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [myLocation, setMyLocation] = useState("Current location");
  const [activeFilter, setActiveFilter] = useState<(typeof filterOptions)[number]>("All");
  const [bidAmount, setBidAmount] = useState("");
  const [showBid, setShowBid] = useState(false);
  const [myPurpose, setMyPurpose] = useState("");
  const [showPurpose, setShowPurpose] = useState(false);
  const [sentBids, setSentBids] = useState<Set<string>>(new Set());
  const [requestUser, setRequestUser] = useState<NearbyUser | null>(null);
  const [users, setUsers] = useState<NearbyUser[]>([]);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [activeTab, setActiveTab] = useState<"discover" | "agreements" | "live">("discover");
  const [qrAgreement, setQrAgreement] = useState<Agreement | null>(null);
  const [qrMode, setQrMode] = useState<"show" | "scan" | null>(null);
  const [myCoords, setMyCoords] = useState<GeoPoint | null>(null);
  const [currentUsername, setCurrentUsername] = useState("");
  const [loading, setLoading] = useState(true);

  const openQR = (id: string, mode: "show" | "scan") => {
    const a = agreements.find((x) => x.id === id);
    if (!a) return;
    setQrAgreement(a);
    setQrMode(mode);
  };

  const closeQR = () => {
    setQrAgreement(null);
    setQrMode(null);
  };

  const loadData = async (coordsOverride?: GeoPoint | null) => {
    if (!user) {
      setUsers([]);
      setAgreements([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const coords = coordsOverride ?? myCoords;

    const [{ data: myProfile }, { data: profileRows }, { data: knownMeetups }, { data: myMeetups }] = await Promise.all([
      supabase
        .from("profiles")
        .select("username, display_name")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url, bio, average_rating, ratings_count, availability")
        .neq("user_id", user.id),
      supabase
        .from("meetups")
        .select("host_id, guest_id, location, created_at")
        .not("location", "is", null)
        .order("created_at", { ascending: false })
        .limit(600),
      supabase
        .from("meetups")
        .select("id, host_id, guest_id, status, location, notes, created_at, scheduled_at")
        .or(`host_id.eq.${user.id},guest_id.eq.${user.id}`)
        .order("created_at", { ascending: false }),
    ]);

    const locationByUser = new Map<string, { coords: GeoPoint; label: string }>();
    (knownMeetups ?? []).forEach((row) => {
      const parsed = parseMeetupLocation(row.location);
      if (!parsed.coords) return;
      if (!locationByUser.has(row.host_id)) {
        locationByUser.set(row.host_id, { coords: parsed.coords, label: parsed.label });
      }
      if (!locationByUser.has(row.guest_id)) {
        locationByUser.set(row.guest_id, { coords: parsed.coords, label: parsed.label });
      }
    });

    const nextUsers: NearbyUser[] = (profileRows ?? []).map((p) => {
      const loc = locationByUser.get(p.user_id);
      const distance = coords && loc ? haversineKm(coords, loc.coords) : null;

      return {
        id: p.user_id,
        username: p.username ?? p.display_name ?? "unknown",
        avatar: p.avatar_url ?? "https://i.pravatar.cc/100",
        distance,
        availability: (p.availability as AvailabilityType) ?? "public",
        hangoutType: (p.price_rands && p.price_rands > 0) ? "paid" : "free",
        rate: p.price_rands ?? undefined,
        purpose: undefined,
        location: loc?.label,
      };
    });

    nextUsers.sort((a, b) => {
      if (a.distance === null && b.distance === null) return 0;
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });

    const profileMap = new Map<string, { username: string; avatar: string }>();
    nextUsers.forEach((p) => profileMap.set(p.id, { username: p.username, avatar: p.avatar }));

    const meName = myProfile?.username ?? myProfile?.display_name ?? user.email?.split("@")[0] ?? "you";
    setCurrentUsername(meName);

    const rows = (myMeetups ?? []) as MeetupRow[];
    const ids = rows.map((r) => r.id);
    const { data: confirmations } = ids.length
      ? await supabase.from("agreement_payment_confirmations").select("agreement_id").in("agreement_id", ids)
      : { data: [] as { agreement_id: string }[] };

    const paidSet = new Set((confirmations ?? []).map((c) => c.agreement_id));

    const nextAgreements: Agreement[] = rows.map((m) => {
      const requesterId = m.host_id;
      const targetId = m.guest_id;
      const parsed = parseNotes(m.notes);
      const requester = profileMap.get(requesterId) ?? { username: requesterId.slice(0, 8), avatar: "https://i.pravatar.cc/100" };
      const target = profileMap.get(targetId) ?? { username: targetId.slice(0, 8), avatar: "https://i.pravatar.cc/101" };

      return {
        id: m.id,
        requester,
        target,
        purpose: parsed.purpose,
        bidAmount: parsed.bidAmount,
        requesterConfirmed: true,
        targetConfirmed: m.status.toLowerCase() === "confirmed",
        sessionDate: m.scheduled_at ?? undefined,
        createdAt: fromNow(m.created_at),
        paymentConfirmed: paidSet.has(m.id),
      };
    });

    setUsers(nextUsers);
    setAgreements(nextAgreements);
    setLoading(false);
  };

  useEffect(() => {
    let active = true;

    (async () => {
      const coords = await getBrowserLocation().catch(() => null);
      if (!active) return;
      setMyCoords(coords);
      if (coords) {
        // Raw coordinates as a location label are unreadable and get stored on every
        // meetup. Turn them into a real place name when geocoding is configured.
        const placeName = await reverseGeocode(coords).catch(() => null);
        if (!active) return;
        setMyLocation(
          placeName ?? `GPS ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`,
        );
      }
      await loadData(coords);
    })();

    return () => {
      active = false;
    };
  }, [user]);

  const filteredUsers = useMemo(() => {
    const area = areaFilter.trim().toLowerCase();

    return users
      .filter((u) => (u.distance === null ? true : u.distance <= range[0]))
      .filter((u) => (area ? (u.location ?? "").toLowerCase().includes(area) : true))
      .filter(
        (u) =>
          u.username.toLowerCase().includes(search.toLowerCase()) ||
          u.bio.toLowerCase().includes(search.toLowerCase()),
      )
      .filter((u) => {
        if (activeFilter === "Free") return u.hangoutType === "free";
        if (activeFilter === "Paid") return u.hangoutType === "paid";
        if (activeFilter === "Public") return u.availability === "public";
        if (activeFilter === "Private") return u.availability === "private";
        return true;
      });
  }, [activeFilter, areaFilter, range, search, users]);

  const areaSuggestions = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      if (u.location) set.add(u.location);
    });
    return Array.from(set);
  }, [users]);

  const handleSendBid = (userId: string) => {
    if (!bidAmount) return;
    setSentBids((prev) => new Set(prev).add(userId));
  };

  const handleSendRequest = async (purpose: string, bid: string) => {
    if (!requestUser || !user) return;

    const location = encodeMeetupLocation(myLocation, myCoords);

    await supabase.from("meetups").insert({
      host_id: user.id,
      guest_id: requestUser.id,
      status: "pending",
      location,
      notes: JSON.stringify({
        purpose,
        bidAmount: bid || null,
        myPurpose: myPurpose || null,
      }),
    });

    setRequestUser(null);
    setActiveTab("agreements");
    await loadData();
  };

  const handleConfirm = async (id: string) => {
    await supabase
      .from("meetups")
      .update({ status: "confirmed", scheduled_at: new Date().toISOString() })
      .eq("id", id);
    await loadData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("meetups").delete().eq("id", id);
    await loadData();
  };

  const handlePaymentConfirmed = async (id: string) => {
    if (!user) return;

    await supabase.from("agreement_payment_confirmations").insert({
      agreement_id: id,
      confirmed_by: user.id,
      confirmed_at: new Date().toISOString(),
    });

    await loadData();
  };

  return (
    <>
      <div className="py-3 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Users Near Me</h1>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-[10px] text-muted-foreground">
            <Navigation className="h-3 w-3" /> {myCoords ? "GPS on" : "GPS off"}
          </span>
        </div>

        <div className="flex rounded-xl bg-secondary p-1 gap-1">
          <button
            onClick={() => setActiveTab("discover")}
            className={cn(
              "flex-1 rounded-lg py-2 text-xs font-semibold transition-all",
              activeTab === "discover"
                ? "bg-gradient-red text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Users className="h-3.5 w-3.5 inline mr-1.5" />
            Discover
          </button>
          <button
            onClick={() => setActiveTab("live")}
            className={cn(
              "flex-1 rounded-lg py-2 text-xs font-semibold transition-all",
              activeTab === "live"
                ? "bg-gradient-red text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Radio className="h-3.5 w-3.5 inline mr-1.5" />
            Live
          </button>
          <button
            onClick={() => setActiveTab("agreements")}
            className={cn(
              "flex-1 rounded-lg py-2 text-xs font-semibold transition-all relative",
              activeTab === "agreements"
                ? "bg-gradient-red text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ScrollText className="h-3.5 w-3.5 inline mr-1.5" />
            Agreements
            {agreements.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {agreements.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === "discover" ? (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search people nearby..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-secondary border-none h-10 rounded-xl"
              />
            </div>

            <div className="rounded-xl bg-card border border-border p-4 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Your Location</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Used in requests</span>
                </div>
                <Input
                  value={myLocation}
                  onChange={(e) => setMyLocation(e.target.value)}
                  placeholder="e.g. Sea Point, Cape Town"
                  className="bg-secondary border-none h-9 rounded-lg text-sm"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Search Range</span>
                  </div>
                  <span className="text-sm font-bold text-primary">{range[0]} km</span>
                </div>
                <Slider value={range} onValueChange={setRange} max={50} min={1} step={1} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Filter by Area</span>
                  </div>
                  {areaFilter && (
                    <button onClick={() => setAreaFilter("")} className="text-[10px] text-primary font-semibold">
                      Clear
                    </button>
                  )}
                </div>
                <AreaAutocomplete
                  value={areaFilter}
                  onChange={setAreaFilter}
                  suggestions={areaSuggestions}
                  proximity={myCoords}
                  placeholder="Type area, suburb, or city"
                />
              </div>
            </div>

            <div className="rounded-xl bg-card border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Your Purpose</span>
                </div>
                <button onClick={() => setShowPurpose(!showPurpose)} className="text-xs text-primary font-semibold">
                  {showPurpose ? "Hide" : "Set Purpose"}
                </button>
              </div>
              {showPurpose && (
                <Textarea
                  placeholder="What kind of meetup are you looking for?"
                  value={myPurpose}
                  onChange={(e) => setMyPurpose(e.target.value)}
                  className="bg-secondary border-none rounded-xl resize-none min-h-[80px] text-sm"
                  maxLength={300}
                />
              )}
            </div>

            <div className="rounded-xl bg-card border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Handshake className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Your Bid Offer</span>
                </div>
                <button onClick={() => setShowBid(!showBid)} className="text-xs text-primary font-semibold">
                  {showBid ? "Hide" : "Set Bid"}
                </button>
              </div>
              {showBid && (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-primary">R</span>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      className="pl-8 bg-secondary border-none h-9 rounded-lg text-sm"
                    />
                  </div>
                  {bidAmount && (
                    <button
                      onClick={() => setBidAmount("")}
                      className="p-2 rounded-lg bg-secondary hover:bg-destructive/20 transition-colors"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
              {filterOptions.map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={cn(
                    "flex-shrink-0 rounded-full px-4 py-2 min-h-[40px] text-xs font-semibold transition-all",
                    activeFilter === f
                      ? "bg-gradient-red text-primary-foreground glow"
                      : "bg-secondary text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>

            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{filteredUsers.length}</span> people available nearby
            </p>

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading nearby users...</p>
            ) : (
              <AnimatePresence mode="popLayout">
                {/* grid rather than space-y: one very wide column of cards on desktop
                    reads badly, and space-y margins fight grid gap. */}
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredUsers.map((nearbyUser, i) => (
                    <UserCard
                      key={nearbyUser.id}
                      user={nearbyUser}
                      index={i}
                      bidAmount={bidAmount}
                      hasSentBid={sentBids.has(nearbyUser.id)}
                      onSendBid={() => handleSendBid(nearbyUser.id)}
                      onConnect={() => setRequestUser(nearbyUser)}
                    />
                  ))}
                </div>
              </AnimatePresence>
            )}
          </>
        ) : activeTab === "live" ? (
          <LiveSection />
        ) : (
          <div className={cn(agreements.length === 0 ? "space-y-3" : "grid gap-3 sm:grid-cols-2 xl:grid-cols-3")}>
            {agreements.length === 0 ? (
              <div className="py-16 text-center">
                <ScrollText className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">No agreements yet</p>
                <p className="text-xs text-muted-foreground mt-1">Request a meetup to create one.</p>
              </div>
            ) : (
              agreements.map((agr) => (
                <AgreementCard
                  key={agr.id}
                  agreement={agr}
                  currentUser={currentUsername}
                  onConfirm={handleConfirm}
                  onDelete={handleDelete}
                  onShowPaymentQR={(id) => openQR(id, "show")}
                  onScanPaymentQR={(id) => openQR(id, "scan")}
                />
              ))
            )}
          </div>
        )}
      </div>

      {requestUser && (
        <MeetupRequestModal
          user={requestUser}
          bidAmount={bidAmount}
          onClose={() => setRequestUser(null)}
          onSend={handleSendRequest}
        />
      )}

      <PaymentQRDialog
        agreement={qrAgreement}
        mode={qrMode}
        onClose={closeQR}
        onPaymentConfirmed={handlePaymentConfirmed}
      />
    </>
  );
};

export default NearMe;
