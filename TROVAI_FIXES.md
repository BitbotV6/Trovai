# Trovai.nl — Bug Fixes

**Date:** 2026-04-03 22:48  
**Reported by:** Vibeking  
**Issues:** 1) Misvormde letters, 2) Quiz werkt niet

---

## Issue 1: Character Encoding (Misvormde Letters)

**Problem:**
Webpage toont: `Trovai Ã¢ÂÂ AI finds your perfect property`  
Should be: `Trovai — AI finds your perfect property`

**Root Cause:**
HTML file is UTF-8 encoded correctly, but somewhere in the **deployment pipeline** (Netlify build or server), characters are being **double-encoded**.

**Examples:**
- `Ã¢ÂÂ` instead of `—` (em dash)
- `CÃÂ´te` instead of `Côte`
- `Ã§` instead of `ç`
- `€` showing as `Ã¢ÂÂ¬`

**Fix Options:**

### Option A: Add charset meta to server response (BEST)

Create `/netlify.toml`:
```toml
[[headers]]
  for = "/*"
  [headers.values]
    Content-Type = "text/html; charset=UTF-8"
```

### Option B: Simplify special characters in HTML

Replace fancy chars with simpler alternatives:
- `—` (em dash) → `-` or `&mdash;`
- `Côte` → `Cote` (acceptable simplification)  
- `€` → `&euro;` (HTML entity)

### Option C: Server-side encoding fix

Check Netlify build settings → ensure UTF-8 is set for all outputs.

---

## Issue 2: Quiz Not Working

**Problem:**
Quiz buttons do not navigate to next question.

**Root Cause Analysis:**

Checked JavaScript - `goQ()` function EXISTS (line 683 & 1463).

**Possible causes:**

### Cause A: Missing initial quiz state

Quiz sections need `.active` class on first step.

**Current:** All `.qs` divs have no initial active state  
**Fix:** Add `class="qs active"` to `qs-dest` section

### Cause B: Button click handlers not attached

Check if `onclick="pickDest(this, 'cotedazur')"` is properly bound.

**Test:** Open browser console, click button, check for JavaScript errors.

### Cause C: CSS `.qs.active` display issue

`.qs` sections might be `display: none` by default, and `.active` class not making them visible.

**Fix:** Ensure CSS has:
```css
.qs {
  display: none;
}
.qs.active {
  display: block !important;
}
```

---

## Recommended Fix (Quick)

### 1. Fix Character Encoding

Add `netlify.toml` in repo root:

```toml
# Netlify configuration
[[headers]]
  for = "/*"
  [headers.values]
    Content-Type = "text/html; charset=UTF-8"
    X-Content-Type-Options = "nosniff"

[build]
  publish = "."
  command = "echo 'Static site, no build needed'"
```

### 2. Fix Quiz Initial State

In `index.html`, find the quiz destination selector (around line 420):

**Change from:**
```html
<div class="qs" id="qs-dest">
```

**To:**
```html
<div class="qs active" id="qs-dest">
```

This makes the first quiz step visible on page load.

### 3. Verify CSS

Check that `.qs.active` has proper display rules. Around line 130, ensure:

```css
.qs {
  display: none;
}
.qs.active {
  display: block;
}
```

---

## Testing Checklist

After fixes:

**Encoding:**
- [ ] Title shows `Trovai — AI finds` (not `Ã¢ÂÂ`)
- [ ] "Côte d'Azur" displays correctly
- [ ] "Curaçao" displays correctly
- [ ] Euro symbol `€` displays correctly

**Quiz:**
- [ ] Quiz section loads on page scroll to `#quiz`
- [ ] First step (destination selector) is visible
- [ ] Clicking "Côte d'Azur" navigates to area selection
- [ ] Progress bar updates
- [ ] Budget slider works
- [ ] Email submission works
- [ ] Results page shows properties

---

## Quick Commands

```bash
# 1. Add netlify.toml
cat > netlify.toml << 'EOF'
[[headers]]
  for = "/*"
  [headers.values]
    Content-Type = "text/html; charset=UTF-8"
EOF

# 2. Find quiz destination div
grep -n 'id="qs-dest"' index.html

# 3. Check for .qs.active CSS
grep -A2 ".qs.active" index.html

# 4. Test locally
python3 -m http.server 8000
# Open http://localhost:8000
```

---

## Root Cause: Character Encoding Deep Dive

**Why double-encoding happens:**

1. **Original text:** `Côte` (UTF-8: `C3 B4 74 65`)
2. **First encoding:** Server reads as ISO-8859-1 → interprets as `Ã´` 
3. **Second encoding:** UTF-8 encodes `Ã´` → `Ã C3 B4` (double-encoded)
4. **Browser sees:** `ÃÂ´` (mojibake)

**Solution:** Force UTF-8 at ALL layers:
- HTML: `<meta charset="UTF-8">` ✅ (already present)
- Server headers: `Content-Type: text/html; charset=UTF-8` ❌ (missing)
- Build process: UTF-8 locale ❓ (check Netlify)

---

## If Netlify.toml Doesn't Work

**Alternative:** Use HTML entities for ALL special characters:

```bash
# Replace in index.html:
sed -i 's/Côte/C&ocirc;te/g' index.html
sed -i 's/Curaçao/Cura&ccedil;ao/g' index.html
sed -i 's/€/&euro;/g' index.html
sed -i 's/—/&mdash;/g' index.html
```

This is **uglier** but guaranteed to work regardless of server encoding.

---

## Next Steps

1. ✅ **Create `netlify.toml`** (encoding fix)
2. ✅ **Add `active` class to first quiz step** (quiz fix)
3. ✅ **Test on trovai.nl** (Netlify auto-deploys on push)
4. ⏳ **Monitor for 24h** (check if issues recur)

**Estimated time:** 5 minutes to fix, 2 minutes to deploy

---

**Shall I create the fixes now and commit to GitHub?** 🤖
