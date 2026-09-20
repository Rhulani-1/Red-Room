# Production Fixes - Detailed Implementation Guide

## Fix #1: Profile.tsx - Display Real Posts Grid ⭐ HIGH PRIORITY

**Status:** User creates posts but can't see them in profile  
**Root Cause:** Profile.tsx queries ratings but not posts from `post_metadata` table  
**Impact:** Users can't see their content creation history

### Changes Required:

1. **Add state for posts:**
   - Import `useState`
   - Add: `const [profilePosts, setProfilePosts] = useState<any[]>([]);`

2. **Update fetch query:**
   - Current: Queries profiles + ratings only
   - Add third query for posts:
     ```
     supabase
       .from("post_metadata")
       .select("id, description, is_sensitive, post_type, created_at")
       .eq("creator_id", targetUserId)
       .order("created_at", { ascending: false })
       .limit(9)
     ```
   - Add `posts` to response destructuring
   - Set state: `setProfilePosts(posts ?? [])`

3. **Update posts grid UI:**
   - Current: Shows "Posts tracking not yet implemented"
   - Replace with:
     - If posts exist: Map and display each post in grid
     - Each post shows `description` text truncated in card
     - If no posts: Show "No posts yet" message

---

## Fix #2: Discover.tsx - Real Followers Count ⭐ ALREADY DONE

**Status:** ✅ DONE  
**What was fixed:** Now queries `followers_relationships` table for real counts  
**Result:** Discover tab shows accurate follower numbers

---

## Fix #3: NearMe.tsx - Paid Meetups Display 🔧 MEDIUM PRIORITY

**Status:** Database field added but UI not using it  
**Root Cause:** Component always shows "free" and 0 rate  
**Impact:** Paid meetup filtering doesn't work

### Changes Required:

1. **Update profile query:**
   - Current: Doesn't select `price_rands` field
   - Add: `price_rands` to SELECT clause

2. **Update user mapping logic:**
   - Current: `hangoutType: "free"` and `rate: undefined` hardcoded
   - Change to:
     ```
     hangoutType: (p.price_rands && p.price_rands > 0) ? "paid" : "free"
     rate: p.price_rands ?? undefined
     ```
   - Remove TODO comment

---

## Fix #4: LiveRoom.tsx - Remove Mock Stream Metadata 🔧 MEDIUM PRIORITY

**Status:** Still has hardcoded fake stream data  
**Root Cause:** `mockStreamMeta` object with 3 hardcoded streams  
**Impact:** Shows fake data even when no real streams exist

### Changes Required:

1. **Replace mockStreamMeta:**
   - Current: Has l1, l2, l3 with fake names, viewers, streamers
   - Change to: Empty object `const mockStreamMeta: Record<string, any> = {};`
   - Add comment: `// Real stream metadata loaded from database`

2. **Update stream fallback:**
   - Current: Fallback uses generic data
   - Update to use actual user info from `useAuth()`:
     ```
     stream = {
       id: streamId,
       name: "Live Stream",
       viewers: 0,
       streamer: user?.user_metadata?.name || "User",
       avatar: user?.user_metadata?.avatar || "https://i.pravatar.cc/100",
     }
     ```

---

## Fix #5: LiveSection.tsx - Remove Mock Live Users 🔧 MEDIUM PRIORITY

**Status:** Still has 3 hardcoded fake live streamers  
**Root Cause:** `mockLiveUsers` array with Sarah, Jake, Emma  
**Impact:** Shows fake viewers and streams

### Changes Required:

1. **Replace mockLiveUsers:**
   - Current: Array with 3 fake users
   - Change to: Empty array `const mockLiveUsers: LiveUser[] = [];`
   - Add comment: `// Real live users loaded from live_streams table`

2. **Update allStreams logic:**
   - Current: `[...myStreams, ...mockLiveUsers]`
   - Change to: `myStreams` only
   - Add comment about future DB integration

---

## Fix #6: SeriesSection.tsx - Remove Mock Series Data 🔧 MEDIUM PRIORITY

**Status:** Shows 3 hardcoded fake content series  
**Root Cause:** `mockSeries` array with fake yoga, tech, cooking series  
**Impact:** Users see fake content they didn't create

### Changes Required:

1. **Replace mockSeries:**
   - Current: Array with 3 fake series with images and follower counts
   - Change to: Empty array `const mockSeries: Series[] = [];`
   - Add comment: `// Real series loaded from database`

2. **Update mapping logic:**
   - Current: Maps `mockSeries` directly
   - Change to:
     - Check if `series && series.length > 0`
     - If yes: Map real data with fields: id, name, description, image_url, category
     - If no: Show "No series yet" message
   - Remove hardcoded field names (followers, postCount)

---

## Fix #7: Manual Dashboard Tasks

### Task 1: Rotate Service Role Key ⚠️ CRITICAL

**Steps:**
1. Go to: https://supabase.com/dashboard/project/nqvpkawrgwqdkyvudmgi/settings/api
2. Find "service_role secret" - Click **Regenerate**
3. Copy new key
4. Run locally:
   ```powershell
   supabase secrets set SERVICE_ROLE_KEY=<paste_new_key_here>
   ```

### Task 2: Create Storage Buckets 📦 CRITICAL

**Steps:**
1. Go to: https://supabase.com/dashboard/project/nqvpkawrgwqdkyvudmgi/storage/buckets
2. Click **"New bucket"** three times:
   - **Bucket 1:** Name = `posts`, Public = Yes
   - **Bucket 2:** Name = `profile-avatars`, Public = Yes
   - **Bucket 3:** Name = `group-media`, Public = Yes
3. RLS policies already exist from migration

### Task 3: Configure Email Service 📧 MEDIUM

**Steps:**
1. Go to: https://supabase.com/dashboard/project/nqvpkawrgwqdkyvudmgi/settings/auth
2. Scroll to "Email" section
3. Choose provider:
   - **Option A (Recommended):** SendGrid
     - Create free account at https://sendgrid.com
     - Get API key
     - Paste in Supabase Email Settings
   - **Option B:** Postmark (same process)

---

## Summary of Changes

| File | Issue | Fix | Priority |
|------|-------|-----|----------|
| Profile.tsx | Posts not displayed | Query post_metadata, show grid | 🔴 HIGH |
| Discover.tsx | - | ✅ Already done | - |
| NearMe.tsx | Paid meetups not shown | Use price_rands field | 🟡 MED |
| LiveRoom.tsx | Mock stream data | Remove mockStreamMeta | 🟡 MED |
| LiveSection.tsx | Mock users | Remove mockLiveUsers | 🟡 MED |
| SeriesSection.tsx | Mock series | Remove mockSeries | 🟡 MED |
| Dashboard | Key not rotated | Manual action | 🔴 CRIT |
| Dashboard | Buckets missing | Manual action | 🔴 CRIT |
| Dashboard | Email unconfigured | Manual action | 🟡 MED |

**Total Code Changes:** 6 files  
**Estimated Time:** ~15 minutes to implement  
**Testing:** Run `npm run build` after changes
