# React Pages Data & Supabase Integration Analysis Report

**Generated:** June 16, 2026  
**Scope:** 12 core pages for mock data and Supabase integration issues

---

## Executive Summary

| Category | Count | Severity |
|----------|-------|----------|
| **Pages with REAL Supabase** | 10 | ✅ Good |
| **Pages with MOCK Data** | 2 | ⚠️ Critical |
| **Pages Missing Empty States** | 1 | ⚠️ Warning |
| **Pages with Loading Issues** | 2 | ⚠️ Warning |

---

## Detailed Analysis by Page

### 1. 📄 [Index.tsx](src/pages/Index.tsx) — Home Feed

| Category | Status | Details |
|----------|--------|---------|
| **Data Displayed** | Posts/Stories | Feed items from ForYouFeed component |
| **Data Source** | ✅ Supabase | Delegates to ForYouFeed component (real queries) |
| **Empty State** | ✅ Yes | Handled by ForYouFeed component |
| **Loading State** | ✅ Yes | Handled by ForYouFeed component |
| **Issues** | ✅ None | Clean, delegates to components |

**Notes:**
- Simple tab-based switcher between "For You" and "Following" feeds
- All heavy lifting delegated to ForYouFeed component
- Consider checking ForYouFeed for any hardcoded data

---

### 2. 🔍 [Discover.tsx](src/pages/Discover.tsx) — Discover Users/Content

| Category | Status | Details |
|----------|--------|---------|
| **Data Displayed** | User profiles, ratings, location data | Trending, Top Rated, Nearby, Live tabs |
| **Data Source** | ⚠️ **Mixed** | Real Supabase + **Derived Mock Data** |
| **Empty State** | ✅ Yes | Dynamic message: "Sign in", "Loading", or "No users found" |
| **Loading State** | ✅ Yes | `loading` state with skeleton/spinner handling |
| **Issues** | ⚠️ **Hardcoded Data Generation** | See below |

**Critical Issues Found:**

```typescript
// Line ~110: FAKE FOLLOWER CALCULATION
followers: Math.max(0, Math.round((p.ratings_count ?? 0) * 7))
```
- ❌ Followers are **derived from ratings_count** via fake Math.round()
- ❌ Not from actual follower data in Supabase
- **Fix:** Query actual `followers` count from profiles table or followers table

**Other Issues:**
- GPS-based location tracking may not work without user permission
- Hardcoded `limit(600)` on meetups query could timeout

---

### 3. 💬 [Messages.tsx](src/pages/Messages.tsx) — Group Conversations

| Category | Status | Details |
|----------|--------|---------|
| **Data Displayed** | Group conversations, last message, timestamps | List of user's group chats |
| **Data Source** | ✅ Real Supabase | Queries group_members → groups → group_messages |
| **Empty State** | ✅ Yes | Dynamic: "Sign in", "Loading", or "No groups yet" |
| **Loading State** | ✅ Yes | Loading spinner with proper state management |
| **Issues** | ✅ None | Well-implemented |

**Notes:**
- Clean realtime-ready structure
- Properly handles no-data scenarios
- Good time formatting (timeAgo function)

---

### 4. 📍 [NearMe.tsx](src/pages/NearMe.tsx) — Nearby Meetups

| Category | Status | Details |
|----------|--------|---------|
| **Data Displayed** | Nearby users, agreements, live/paid status, payment confirmations | Multi-tab discovery and agreements |
| **Data Source** | ⚠️ **Mixed** | Real Supabase + **Heavy Mock Data** |
| **Empty State** | ⚠️ Partial | Loading state shown, but empty state not clearly visible |
| **Loading State** | ✅ Yes | `loading` state managed |
| **Issues** | 🚨 **Critical Mock Data** | See below |

**Critical Issues Found:**

```typescript
// Line ~140: FAKE PAID STATUS BASED ON INDEX
const paid = index % 2 === 0;
const availability: (index + (p.ratings_count ?? 0)) % 3 === 0 ? "private" : "public"
```
- ❌ **Paid/Free status determined by loop index** — Not from actual data!
- ❌ **Availability is fake** — Based on modulo math, not user preferences
- ❌ User rates are also generated: `Math.max(40, Math.round((p.average_rating ?? 3.5) * 25))`

```typescript
// Line ~180+: Fake rate calculation
rate: paid ? Math.max(40, Math.round((p.average_rating ?? 3.5) * 25)) : undefined
```

**Fix:** Query actual `availability`, `hangout_type`, and `rate` from profiles table

**Additional Issues:**
- Missing empty state for zero agreements
- Agreement payment logic may not persist properly

---

### 5. 👥 [Groups.tsx](src/pages/Groups.tsx) — Groups List

| Category | Status | Details |
|----------|--------|---------|
| **Data Displayed** | User's groups and discoverable groups | My Groups / Discover tabs |
| **Data Source** | ✅ Real Supabase | Queries group_members and groups table |
| **Empty State** | ✅ Yes | "No groups yet" + icon for each tab state |
| **Loading State** | ✅ Yes | Loader2 spinner during `loading` state |
| **Issues** | ✅ None | Well-implemented |

**Notes:**
- Proper join flow with toast feedback
- Handles subscription logic
- Good error messaging

---

### 6. 💬 [GroupChat.tsx](src/pages/GroupChat.tsx) — Group Messages

| Category | Status | Details |
|----------|--------|---------|
| **Data Displayed** | Group messages, members, reactions, media URLs | Full message thread with features |
| **Data Source** | ✅ Real Supabase | Queries groups, group_messages, reactions + realtime |
| **Empty State** | ⚠️ Implicit | Not explicitly handled for empty message threads |
| **Loading State** | ✅ Yes | `loading` state with proper handling |
| **Issues** | ⚠️ Minor | See below |

**Issues Found:**
- ⚠️ No explicit empty state message when group has 0 messages
- Realtime subscriptions are sophisticated but not fully visible in excerpt
- Consider adding "No messages yet — be the first to chat!" message

---

### 7. 👤 [Profile.tsx](src/pages/Profile.tsx) — User Profile

| Category | Status | Details |
|----------|--------|---------|
| **Data Displayed** | User profile, stats (posts, followers, following), bio | Profile card with tabs |
| **Data Source** | ⚠️ **MIXED - MAJOR ISSUES** | Real profile query + **Hardcoded stats** |
| **Empty State** | ✅ Partial | Fallback values shown |
| **Loading State** | ⚠️ No loading indicator | Implicit fetch, no spinner |
| **Issues** | 🚨 **CRITICAL Hardcoded Data** | See below |

**Critical Issues Found:**

```typescript
// Line ~200+: HARDCODED STATS - Not from database!
<p className="text-lg font-bold">128</p>  <!-- Posts: HARDCODED -->
<p className="text-lg font-bold">14.2K</p>  <!-- Followers: HARDCODED -->
<p className="text-lg font-bold">892</p>  <!-- Following: HARDCODED -->
```

- ❌ **Posts count is hardcoded to 128**
- ❌ **Followers hardcoded to 14.2K**
- ❌ **Following hardcoded to 892**
- These should be queried from profiles/counts tables

```typescript
// Line ~80+: HARDCODED PROFILE IMAGES
const profileImages = [
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=300&h=300&fit=crop",
  // ... 5 more hardcoded URLs
];
```

- ❌ Profile grid shows **fake Unsplash images** — not actual user posts
- Should query `posts` table with user_id filter

**Fixes Needed:**
1. Query post count from `posts` table: `SELECT COUNT(*) FROM posts WHERE author_id = ?`
2. Query follower count from `followers` table or similar
3. Query following count from same source
4. Display real user posts in grid instead of hardcoded images
5. Add loading spinner during profile fetch

---

### 8. 💰 [RedBusket.tsx](src/pages/RedBusket.tsx) — Wallet

| Category | Status | Details |
|----------|--------|---------|
| **Data Displayed** | Wallet balance, transactions, content unlocks | Tabs for balance, history, unlocks |
| **Data Source** | ✅ Real Supabase | Queries wallets, wallet_transactions, content_unlocks |
| **Empty State** | ✅ Yes | Sign-in message + "No transactions" fallback |
| **Loading State** | ✅ Yes | Spinner on refresh button, reload state management |
| **Issues** | ✅ None | Well-implemented |

**Notes:**
- Realtime subscriptions for live wallet updates
- Proper transaction filtering and date range selection
- Good error handling for payment integration

---

### 9. ✍️ [Create.tsx](src/pages/Create.tsx) — Create Post

| Category | Status | Details |
|----------|--------|---------|
| **Data Displayed** | Form fields only (no data display) | Text/Media post form |
| **Data Source** | N/A | UI form - no data queries yet |
| **Empty State** | N/A | Not applicable |
| **Loading State** | N/A | Not yet implemented |
| **Issues** | ⚠️ Backend integration missing | See below |

**Issues Found:**
- ⚠️ **Submit button has no onClick handler** — Form doesn't post to database
- ⚠️ **No media upload implementation** — Camera/Gallery buttons are placeholders
- ⚠️ **No location/tags functionality** — Buttons present but no-ops
- ⚠️ **No loading state during submission**
- ⚠️ **No error handling**

**Recommended Implementation:**
- Add Supabase storage for media uploads
- Add posts table insert on submit
- Add loading state during submission
- Add error toast notifications

---

### 10. 📊 [AdminRevenue.tsx](src/pages/AdminRevenue.tsx) — Admin Dashboard

| Category | Status | Details |
|----------|--------|---------|
| **Data Displayed** | Daily revenue, commissions, creator breakdown | Aggregate statistics |
| **Data Source** | ✅ Real Supabase | Invokes `admin-revenue` edge function |
| **Empty State** | ✅ Yes | "No revenue for this date" message |
| **Loading State** | ✅ Yes | Skeleton loaders for async data |
| **Issues** | ✅ None | Well-implemented |

**Notes:**
- Protected route with admin check
- Proper error state display
- Good data aggregation and formatting

---

### 11. 🔧 [AdminPayfast.tsx](src/pages/AdminPayfast.tsx) — Admin PayFast Dashboard

| Category | Status | Details |
|----------|--------|---------|
| **Data Displayed** | PayFast webhooks, stuck payments, stuck boosts | 3 data tables |
| **Data Source** | ✅ Real Supabase | Invokes `admin-payfast-dashboard` edge function |
| **Empty State** | ⚠️ Implicit | Not explicitly shown for zero events |
| **Loading State** | ✅ Yes | Skeleton loaders, RefreshCw button |
| **Issues** | ⚠️ Minor | See below |

**Issues Found:**
- ⚠️ No explicit empty state when events/payments/boosts are empty
- Consider adding: "No events yet" / "All payments resolved" messages

---

### 12. 🔴 [LiveRoom.tsx](src/pages/LiveRoom.tsx) — Live Streams

| Category | Status | Details |
|----------|--------|---------|
| **Data Displayed** | Stream metadata, chat messages, viewer count, tips | Full live stream interface |
| **Data Source** | 🚨 **HEAVILY MOCKED** | Real checks only; rest is fake data |
| **Empty State** | ⚠️ None | Just shows locked screen for paid content |
| **Loading State** | ✅ Partial | Has `checking` state for access control |
| **Issues** | 🚨 **EXTENSIVE MOCK DATA** | See below |

**Critical Issues Found:**

```typescript
// Line ~40-55: MOCK STREAM METADATA - Not from DB!
const mockStreamMeta: Record<string, {...}> = {
  l1: { username: "sarah_j", avatar: "...", title: "Live Q&A...", isPaid: false },
  l2: { username: "mike.r", ... isPaid: true, fee: 25 },
  l3: { username: "devking", ... isPaid: true, fee: 50 },
};
```
- ❌ **All stream metadata hardcoded** — Should query `live_streams` table
- ❌ **No actual streams queried from database**

```typescript
// Line ~60-75: MOCK CHAT SEED DATA
const seedChat: ChatMessage[] = [
  { id: "s1", user: "system", text: "Welcome to the stream 🔥", isSystem: true },
  { id: "c1", user: "thabo_m", text: "Yooo this is fire 🔥" },
  // ... more hardcoded messages
];
```
- ❌ **Chat initialized with hardcoded messages**
- Should be empty or query actual messages from `live_chat` table

```typescript
// Line ~75+: MOCK AUTO-CHAT POOL
const autoChatPool = [
  "🔥🔥🔥",
  "Sending love from Cape Town",
  "How long you been doing this?",
  // ... more fake messages
];
```
- ❌ **Auto-generated fake chat messages** every 4.5 seconds
- Users will see fake viewers and fake chat spam
- **This is confusing and misleading to users**

```typescript
// Line ~130: FAKE VIEWER COUNT
const [viewers, setViewers] = useState(() => Math.floor(Math.random() * 800) + 120);

// Line ~155: VIEWER DRIFT WITH RANDOM
const t = setInterval(() => {
  setViewers((v) => Math.max(50, v + Math.floor(Math.random() * 11) - 4));
}, 3500);
```
- ❌ Viewers start at random 120-920 count (fake!)
- ❌ Viewers randomly drift up/down every 3.5s
- **Users will see fake viewer counts**

```typescript
// Line ~160: AUTO-CHAT WITH RANDOM
const t = setInterval(() => {
  const text = autoChatPool[Math.floor(Math.random() * autoChatPool.length)];
  const idx = Math.floor(Math.random() * 30) + 1;
  setMessages((m) => [...m, { id: `auto-${Date.now()}-${Math.random()}`, 
    user: `user_${idx}`, avatar: `https://i.pravatar.cc/40?img=${idx}`, text }]);
}, 4500);
```
- ❌ **Fake bot messages every 4.5 seconds**
- Users thinking real people are chatting = **Trust issue**

**Empty State Issues:**
- No "Stream offline" message if no access
- No "No messages yet" for empty chats
- Just shows lock/unlock UI

**Fixes Needed (Priority: 🚨 CRITICAL):**
1. Remove `mockStreamMeta` — query from `live_streams` table
2. Remove `seedChat` — fetch real messages or start empty
3. Remove `autoChatPool` and auto-chat interval — let real users chat
4. Remove viewer count randomization — query actual viewer count from realtime
5. Add proper empty states
6. Add loading spinner while checking access
7. Document that this is live stream view only (no creation UI)

---

## Summary Table

| File | Data Type | Source | Empty State | Loading | Issues |
|------|-----------|--------|-------------|---------|--------|
| Index.tsx | Posts/Feed | ✅ Supabase | ✅ Delegated | ✅ Delegated | ✅ None |
| Discover.tsx | Users/Ratings | ⚠️ Derived | ✅ Yes | ✅ Yes | ⚠️ Fake followers calc |
| Messages.tsx | Conversations | ✅ Supabase | ✅ Yes | ✅ Yes | ✅ None |
| NearMe.tsx | Users/Meetups | ⚠️ Heavy mock | ⚠️ Partial | ✅ Yes | 🚨 Fake paid/rate/availability |
| Groups.tsx | Groups | ✅ Supabase | ✅ Yes | ✅ Yes | ✅ None |
| GroupChat.tsx | Messages | ✅ Supabase | ⚠️ Implicit | ✅ Yes | ⚠️ No explicit empty state |
| Profile.tsx | User/Stats | 🚨 Mixed | ✅ Partial | ❌ No | 🚨 Hardcoded: 128 posts, 14.2K followers, 892 following + fake grid images |
| RedBusket.tsx | Wallet/Txs | ✅ Supabase | ✅ Yes | ✅ Yes | ✅ None |
| Create.tsx | Form | N/A | N/A | N/A | ⚠️ No submit handler |
| AdminRevenue.tsx | Revenue | ✅ Function | ✅ Yes | ✅ Yes | ✅ None |
| AdminPayfast.tsx | Webhooks | ✅ Function | ⚠️ Implicit | ✅ Yes | ⚠️ Missing empty states |
| LiveRoom.tsx | Stream/Chat | 🚨 Heavily mocked | ❌ No | ⚠️ Partial | 🚨 Fake metadata, chat, viewers, auto-bot messages |

---

## Priority Fixes

### 🚨 CRITICAL (Do Immediately)

1. **Profile.tsx** — Replace hardcoded stats (128, 14.2K, 892) with real queries
2. **Profile.tsx** — Replace hardcoded grid images with actual user posts
3. **LiveRoom.tsx** — Remove mock stream metadata and fake chat
4. **LiveRoom.tsx** — Remove auto-generated bot messages and fake viewer counts
5. **NearMe.tsx** — Replace hardcoded paid/rate/availability logic with real data

### ⚠️ HIGH (Next Sprint)

6. **Discover.tsx** — Replace fake follower calculation with actual follower count
7. **Create.tsx** — Implement post submission to Supabase
8. **GroupChat.tsx** — Add explicit empty state for no messages
9. **AdminPayfast.tsx** — Add explicit empty states for each table

### 📋 MEDIUM (Future)

10. Add loading spinners to pages missing them
11. Add comprehensive error boundary handling
12. Implement optimistic UI updates for better UX

---

## Testing Recommendations

1. **Profile.tsx** — Verify stats update when posts/followers change
2. **NearMe.tsx** — Verify users with actual paid/free status display correctly
3. **LiveRoom.tsx** — Verify no fake messages in production
4. **Discover.tsx** — Verify followers count matches actual follower records
5. Create automated tests for empty state rendering
6. Add monitoring for pages still showing hardcoded data
