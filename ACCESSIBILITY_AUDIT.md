# WCAG 2.2 Level A/AA Audit - STI Baliuag CMS (entire frontend)

Scope: `frontend/src` (98 JS/JSX files, 47 CSS files; nurse, doctor, student, parent portals + login).
Method: **static code audit** (pattern scans over all files, targeted reads of `Login.jsx`, `Modal.jsx`, `AlertModal/ConfirmModal`, 4 layouts, `theme.css`) plus **computed contrast ratios** for every `theme.css` token pair (`node` script, WCAG relative-luminance formula). No browser, no screen reader was run. Counts come from grep and are "at least" figures. Items marked *verify* need a manual pass (section 4).

---

## 1. Compliance Summary & Health Score

**Overall grade: FAIL** (Level AA not met).

| Severity | Count | Issues |
|---|---|---|
| Critical | 4 | A-01 focus visibility, A-02 modal semantics/focus, A-03 form labels, A-04 landmarks/skip link |
| High | 5 | A-05 error/status announcement, A-06 dark-theme contrast, A-07 unnamed icon buttons, A-08 click-only rows, A-09 target size |
| Medium | 6 | A-10 table headers, A-11 focus obscured, A-12 reflow, A-13 page titles/route focus, A-14 autocomplete, A-15 toggle state |
| Low | 3 | A-16 hardcoded colors/px fonts, A-17 emoji icons, A-18 motion |
| **Total** | **18** | |

Worst areas: `Login.jsx`, every nurse page with a custom modal, student/parent message modals, `Login.css`/per-page CSS (no focus style).
Best areas: doctor portal (`doctorLayout`, `DoctorLayout.css`, scheduling modals): `role="alert"` errors, 2.75rem targets in `.mda`, real `:focus-visible`, `prefers-reduced-motion` on the pulsing dot, `aria-label` on status dot.

Passes worth keeping: viewport allows zoom (no `user-scalable=no`), `<html lang="en">`, `<nav>` landmarks, React Router `NavLink` sets `aria-current="page"` itself, no paste blocking anywhere (3.3.8 paste OK), no positive `tabindex`, all 5 `<img>` have alt text, no native `alert()/confirm()` (replaced by `AlertContext`), shared `Modal` closes on `Esc` and has `role="dialog" aria-modal`.

---

## 2. Audit Matrix

| Issue ID | Success Criterion | Violation Description | User Impact | Severity |
|---|---|---|---|---|
| A-01 | 2.4.7 Focus Visible, 1.4.11 | Only 17 `:focus-visible` rules in 47 stylesheets (all in `NurseDashboard.css`, `DoctorLayout.css`, `RecordFolders.css`). 25 files set `outline: none` on `:focus` (e.g. `Login.css:64,416`, `MyProfile.css:207`, `NurseMessages.css:33,282`). Login replacement ring is `rgba(0,77,153,.1)` = 1.18:1. `theme.css` has no global focus rule. | Keyboard users cannot see where they are on most pages. | Critical |
| A-02 | 4.1.2, 2.1.2, 2.4.3, 2.1.1 | ~26 files render custom overlays (`modal-overlay-*`, `*-backdrop`, `pmm-overlay`, `student-msg-overlay`) with no `role="dialog"`, no `aria-modal`, no label, no `Esc` handler, no focus trap, no focus return. Shared `Modal.jsx` has role + Esc but no trap, no focus restore, no initial focus (`aria-label` only when title is a string). | Focus escapes behind the dialog; SR users are not told a dialog opened; `Esc` does nothing; focus is lost to `<body>` on close. | Critical |
| A-03 | 1.3.1, 3.3.2, 4.1.2 | `Login.jsx`: 11 inputs use `placeholder` only, 1 `<label>`. App-wide: 614 `<label>` vs 86 `htmlFor` across 700 form controls. Labels that neither wrap nor use `htmlFor` have no programmatic name (*verify* per file). | SR announces "edit text" with no name; placeholder vanishes when typing; voice-control users cannot target fields. | Critical |
| A-04 | 2.4.1 Bypass Blocks, 1.3.1 | No skip link anywhere. `<main>` exists only in `doctorLayout.jsx` and 5 individual pages; `nurseLayout`, `studentLayout`, `parentLayout` have none. | Keyboard users tab through the whole sidebar on every page; SR users have no "main" landmark jump. | Critical |
| A-05 | 3.3.1, 4.1.3 | `Login.jsx:402-403,615,691` error/success `div`s have no `role="alert"/"status"`; `medicineInventory.jsx:713` banner no live role. `aria-describedby`/`aria-invalid` appear once in the whole app. Doctor/scheduling forms already use `role="alert"` (good). | Login failure is silent to SR users; field-level errors are not tied to the field. | High |
| A-06 | 1.4.3, 1.4.11 | Computed (dark theme): `--sti-blue-primary` text on `--bg-card` **3.61:1**, on `--bg-page` **4.40:1**, white on `#3b82c4` **4.06:1**, `.status-banner.info` (blue-primary on blue-light) **3.33:1**. Light: `--text-secondary` on `--sti-blue-light` **4.31:1**. Login input border `#d1d5db` on `#f9fafb` **1.41:1**. `nurseLayout.jsx` `.profile-error` `#ff4d4f` on sidebar `#004b87` **2.73:1**. | Low-vision users cannot read links/info banners/errors in dark mode; input boundaries invisible. | High |
| A-07 | 4.1.2, 1.1.1 | Controls with no accessible name: `nurseLayout.jsx:284` `☰`; `HealthTips.jsx:274`, `healthHistoryForm.jsx:276` `&times;`; `✕` clear-attachment in `StudentMessageModal:444`, `NurseMessageModal:535`, `ParentMessageModal:630`, `nurseMessages.jsx:485`; 3x `XCircle` dismiss in `visitLogConsultation.jsx:1244,1262,1310`; 3 refresh buttons named by `title` only. | SR says "button" or "multiplication sign". | High |
| A-08 | 2.1.1, 4.1.2 | `visitLogConsultation.jsx:1226` search results are `<div onClick>` (no role/tabindex/key handler): unreachable by keyboard. 39 `onClick` on non-interactive elements app-wide, 0 with role/tabIndex/onKeyDown. Most are backdrops (need Esc, see A-02); `sti-action-card` has an inner `<button>` so it works. | Nurse cannot pick a student from search results without a mouse. | High |
| A-09 | 2.5.8 (24px), project 2.75rem | `Login.css .password-toggle-btn`: 18px icon, `padding:0` (~18x18, **fails 24px**). 101 fixed `width/height` 20-39px declarations; collapse toggle ~30px; many `icon-btn-ds`/row action buttons < 2.75rem. | Motor-impaired and touch users mis-tap; password toggle is the smallest. | High |
| A-10 | 1.3.1 | 384 `<th>`, 0 `scope`; 56 `<table>`, 0 `<caption>`/`aria-label`. | SR users cannot navigate cell-to-header relationships or identify a table. | Medium |
| A-11 | 2.4.11 Focus Not Obscured | 54 `position: fixed/sticky` rules, 0 `scroll-padding-top`. Fixed top bars (`student-top-bar`, `parent-top-bar`) and fixed `mobile-toggle-btn` (top-left, z-index 998) can cover the focused element when tabbing/scrolling. | Focused control hidden behind a bar. | Medium |
| A-12 | 1.4.10 Reflow | `BookCheckup.css:251` `width: 520px`; wide tables `min-width` 650-1000px (`ManageStudentAccounts.css:232,622`, `MedicineInventory.css:222`, `VisitLogConsultation.css:912`, ...) are acceptable only if every one sits in an `overflow-x:auto` wrapper (30 wrappers exist; *verify* each). | Two-direction scrolling at 320px/400% zoom. | Medium |
| A-13 | 2.4.2 Page Titled, 2.4.3, 4.1.3 | One static `<title>STI Baliuag CMS</title>`; `document.title` never set; no focus move or announcement on SPA route change. | SR/tab users cannot tell pages apart; focus stays on the clicked link after navigation. | Medium |
| A-14 | 1.3.5 Identify Input Purpose, 3.3.8 | Login username/password lack `autocomplete` (`username`, `current-password`, `new-password`). Paste is not blocked (3.3.8 OK). OTP/verification fields in `Login.jsx` need `autocomplete="one-time-code"` (*verify*). | Password managers/autofill and cognitive-load aids fail. | Medium |
| A-15 | 4.1.2 | Toggle controls expose no state: `password-toggle-btn` has fixed label "Toggle password visibility" and no `aria-pressed`; sidebar collapse/hamburger have no `aria-expanded`/`aria-controls`. | SR user cannot tell if password is shown / menu open. | Medium |
| A-16 | 1.4.3 (dark), 1.4.4, project rules | 1739 raw hex values in non-theme CSS + 134 in inline `style={{}}`; 263 `font-size: Npx`; 357 `font-size` below `0.875rem`; 48 inline `font-family`. Hardcoded colors do not follow the dark theme, so contrast is unchecked there. | Unreadable pairs in dark mode; text does not follow the user's default size. | Low |
| A-17 | 1.1.1, 1.4.1 | 24 emoji used as icons (`📋🏥...`) without `aria-hidden`; `doc-warning-dot-vlc` / `badge-dot-nd` are color dots, one conveyed by `title` only. | Redundant SR chatter; tooltip-only meaning is not keyboard reachable. | Low |
| A-18 | 2.2.2, 2.3.3 (AAA, project rule) | 40 stylesheets declare transitions/animations; only `DoctorLayout.css:148` honors `prefers-reduced-motion`. | Vestibular users get motion they asked to remove. | Low |

---

## 3. Technical Recommendations & Code Fixes

### A-01 Focus visible (SC 2.4.7, 1.4.11) - fix once, globally
**Flawed:** `Login.css:63`
```css
.auth-input:focus { outline: none; border-color: #004d99; box-shadow: 0 0 0 3px rgba(0,77,153,.1); }
```
**Fix:** add to `styles/theme.css` (imported before every page), then delete the `outline: none` rules listed by `grep -rn "outline:\s*none" frontend/src/styles`.
```css
:where(a, button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"]), [role="button"], [role="tab"]):focus-visible {
  outline: 0.1875rem solid var(--sti-blue-primary);
  outline-offset: 0.125rem;
}
:where(.student-sidebar, .parent-sidebar, .dl-sidebar, .sidebar-nav, .shared-modal-footer .shared-btn-primary):focus-visible,
:where(.student-sidebar, .parent-sidebar, .dl-sidebar) :focus-visible {
  outline-color: var(--sti-yellow);
}
```
(`--sti-blue-primary` as a focus ring is 8.9:1 on light and 3.6-4.4:1 on dark surfaces with today's tokens, 4.6-6.1:1 after the A-06 token change: passes the 3:1 UI-part rule in both themes.)
**After:** Tab shows a 3px blue ring on every control in both themes; ring turns yellow on the blue sidebar.

### A-02 Modals (SC 4.1.2, 2.1.2, 2.4.3)
**Flawed:** `nurseDashboard.jsx:2531`
```jsx
<div className="modal-overlay-nd" onClick={() => setIsModalOpen(false)}>
  <div className="modal-container-nd" onClick={(e) => e.stopPropagation()}>
```
**Fix 1 - harden shared `components/common/Modal.jsx`:**
```jsx
const panelRef = useRef(null);
const openerRef = useRef(null);
const titleId = useId();

useEffect(() => {
  if (!isOpen) return;
  openerRef.current = document.activeElement;
  const panel = panelRef.current;
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  (panel.querySelector('[autofocus],[data-autofocus]') || panel.querySelector(FOCUSABLE) || panel).focus();
  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); return; }
    if (e.key !== 'Tab') return;
    const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!items.length) { e.preventDefault(); return; }
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', onKeyDown);
  return () => { document.removeEventListener('keydown', onKeyDown); openerRef.current?.focus?.(); };
}, [isOpen, onClose]);

<div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} ...>
  ... {title && <h2 id={titleId}>{title}</h2>}
```
**Fix 2:** migrate the ~26 custom overlays to `<Modal>` (list: `grep -L 'role="dialog"'` on files with `overlay|backdrop`: `HealthTips`, `NurseMessageModal`, `ParentMessageModal`, `StudentMessageModal`, `RecordFolders`, `manageStudentAccounts`, `manageParentAccounts`, `nurseDashboard`, `healthRecordProfile`, `healthScreening`, `insuranceVault`, `myRequirements`, `requestModule`, `parentDashboard`, `visitLogConsultation`, ...). Backdrop click-to-close stays a mouse convenience; `Esc` + Close button are the keyboard path.
**After:** NVDA/VoiceOver says "<title>, dialog"; Tab cycles inside; `Esc` closes; focus returns to the button that opened it.

### A-03 Form labels (SC 1.3.1, 3.3.2)
**Flawed:** `Login.jsx:410`
```jsx
<input type="text" required value={username} placeholder="Username (@baliuag.sti.edu.ph)" className="auth-input" />
```
**Fix:**
```jsx
<label htmlFor="login-username" className="auth-label">Username</label>
<input id="login-username" name="username" type="text" required autoComplete="username"
       aria-describedby="login-username-hint" value={username} onChange={...} className="auth-input" />
<small id="login-username-hint" className="auth-hint">Ends with @baliuag.sti.edu.ph</small>
```
Same for password (`id="login-password"`, `autoComplete="current-password"`), the reset-password and parent-verification fields. App-wide: `grep -rn "<label" ` and ensure each has `htmlFor`+`id` or wraps its control; add a lint rule `jsx-a11y/label-has-associated-control` (CRA ships `eslint-plugin-jsx-a11y`, so `npm start` already warns if enabled).
**After:** "Username, edit text, Ends with ..." is announced; clicking the label focuses the field.

### A-04 Landmarks + skip link (SC 2.4.1, 1.3.1)
**Fix:** in each layout (`nurseLayout`, `studentLayout`, `parentLayout`, `doctorLayout`):
```jsx
<a href="#main-content" className="skip-link">Skip to main content</a>
...
<main id="main-content" tabIndex={-1} className="main-content">{children ?? <Outlet />}</main>
```
```css
.skip-link { position: absolute; left: 0.5rem; top: -4rem; z-index: 3000; padding: 0.75rem 1rem;
  background: var(--sti-yellow); color: var(--sti-blue-dark); font-weight: 600; }
.skip-link:focus { top: 0.5rem; }
```
Replace nested `<main>` inside pages (`documentIssuance.jsx:1219`, `manageStudentAccounts.jsx:1055`, `childClinicRecords.jsx:269`, `clinicLogs&Records.jsx:188`, `studentDashboard.jsx:253`) with `<section>`/`<div>` to keep one `<main>`.
**After:** first Tab on any page reveals "Skip to main content"; Enter jumps past the sidebar.

### A-05 Errors and status (SC 3.3.1, 4.1.3)
**Flawed:** `Login.jsx:402`
```jsx
{errorMsg && <div className="error-message">{errorMsg}</div>}
{successMsg && <div className="success-message">{successMsg}</div>}
```
**Fix:**
```jsx
<div role="alert" id="login-error">{errorMsg && <><AlertCircle aria-hidden="true" size={18}/> {errorMsg}</>}</div>
<div role="status" aria-live="polite">{successMsg}</div>
...
<input aria-invalid={!!errorMsg} aria-describedby={errorMsg ? 'login-error' : undefined} ... />
```
Keep the region mounted (empty) so inserts are announced. Do the same for `passModalError`, `parentModalError`, and give `medicineInventory.jsx:713` banner `role="status"` (`role="alert"` for `.error`). Error text must say what to fix ("Password is wrong. Check Caps Lock and try again").
**After:** SR reads the error immediately on failed submit and again on field focus.

### A-06 Contrast (SC 1.4.3, 1.4.11)
Change tokens in `theme.css` (`:root[data-theme="dark"]`):
```css
--sti-blue-primary: #5c9bd6;   /* 4.96:1 on --bg-card, 6.05:1 on --bg-page, 4.57:1 on --sti-blue-light; was #3b82c4 (3.61) */
--sti-blue-hover:   #7db0e0;
```
Then buttons that use white on `--sti-blue-primary` in dark must use `--sti-blue-dark` (10.8:1) per project rule: `.btn-primary, .shared-btn-primary, .sti-btn-primary, .dp-btn-primary { background: var(--sti-blue-dark); }` under `[data-theme="dark"]`.
Light mode: `.status-banner.info` OK (7.7:1); change `--text-secondary` use on `--sti-blue-light` surfaces to `--text-primary`, or darken `--text-secondary` to `#5a6478` (5.16:1 on `--sti-blue-light`, 5.69:1 on `--bg-page`, 5.95:1 on white).
Borders of inputs/selects/checkboxes (UI parts): `--input-border: #8a94a6` light (3.1:1 on white), `#64748b` dark. Decorative card borders may stay `--card-border`.
`nurseLayout.jsx` `.profile-error`: replace inline `#ff4d4f` with `color: #ffd2d0` (light sidebar) via a class using `--sidebar-text-strong`, plus an icon.
**After:** every pair >= 4.5:1 text / 3:1 UI in both themes (re-run `scratchpad/contrast.js`).

### A-07 Accessible names (SC 4.1.2)
```jsx
// nurseLayout.jsx:284
<button type="button" className="mobile-toggle-btn" onClick={toggleSidebar}
        aria-label="Open menu" aria-expanded={isOpen} aria-controls="app-sidebar">
  <Menu aria-hidden="true" size={22} />
</button>
// HealthTips.jsx:274, healthHistoryForm.jsx:276
<button type="button" className="close-btn" onClick={onClose} aria-label="Close"><X aria-hidden="true" size={20}/></button>
// clear attachment x4
<button type="button" onClick={clearAttachment} aria-label="Remove attachment"><X aria-hidden="true" size={16}/></button>
// visitLogConsultation.jsx:1244,1262,1310
<button type="button" className="modal-dismiss-btn-vlc" onClick={stopCameraScan} aria-label="Close camera scan"><XCircle aria-hidden="true" size={22}/></button>
// refresh x3: title -> aria-label
<button type="button" className="icon-btn-ds" aria-label="Refresh" title="Refresh" onClick={load}><RefreshCw aria-hidden="true" size={15}/></button>
```
Set `aria-hidden="true"` on all lucide icons that sit next to text.
**After:** SR announces "Close, button", "Open menu, button, collapsed".

### A-08 Click-only rows (SC 2.1.1)
**Flawed:** `visitLogConsultation.jsx:1226`
```jsx
<div key={st.student_id} className="search-result-row-vlc" onClick={() => handleSelectStudent(st)}>
```
**Fix:**
```jsx
<li key={st.student_id}>
  <button type="button" className="search-result-row-vlc" onClick={() => handleSelectStudent(st)}>
    ...same content...
  </button>
</li>
```
(and wrap the list in `<ul role="listbox"-free>`; CSS: `.search-result-row-vlc { width:100%; text-align:left; background:none; border:0; min-height:2.75rem }`.)
Backdrop `<div onClick>` elements (`menu-backdrop-rf`, `row-menu-backdrop-hs`, `sidebar-overlay`) get `aria-hidden="true"`; the dismiss path for keyboard users must be `Esc` (add handler) and the trigger button's `aria-expanded`.
**After:** Tab reaches each result; Enter/Space selects.

### A-09 Target size (SC 2.5.8; project 2.75rem)
```css
.password-toggle-btn { min-width: 2.75rem; min-height: 2.75rem; padding: 0.625rem;
  right: 0; margin-left: 0; top: 50%; transform: translateY(-50%); }
.sidebar-collapse-toggle, .icon-btn-ds, .shared-modal-close, .close-sidebar-btn,
[class*="icon-btn"], [class*="row-action"] { min-width: 2.75rem; min-height: 2.75rem; }
```
Audit the 101 fixed 20-39px `width/height` rules (`grep -rEn "^\s*(width|height):\s*(1[0-9]|2[0-9]|3[0-9])px" styles`) and keep only non-interactive ones (avatars, dots).
**After:** every button/link measures >= 44x44 px in DevTools; password toggle no longer overlaps the text.

### A-10 Tables (SC 1.3.1)
```jsx
<table aria-labelledby="inventory-heading">   {/* or <caption className="sr-only">Medicine inventory</caption> */}
  <thead><tr><th scope="col">Name</th>...</tr></thead>
  <tbody><tr><th scope="row">{item.name}</th><td>...</td></tr></tbody>
```
Fast route: one codemod to add `scope="col"` to every `<th>` in `<thead>` (384 spots) and an `aria-labelledby`/`<caption>` on the 56 tables.
**After:** SR reads "Name, column 1 of 6" when moving across cells.

### A-11 Focus not obscured (SC 2.4.11)
```css
html { scroll-padding-top: 5rem; scroll-padding-bottom: 2rem; }
:target, [id] { scroll-margin-top: 5rem; }
```
Match 5rem to the fixed top-bar height; for the fixed `mobile-toggle-btn` also pad `.main-content` top on mobile (`padding-top: 4rem`).
**After:** tabbing to a control near the page top keeps it fully visible below the bar.

### A-12 Reflow (SC 1.4.10)
```css
/* BookCheckup.css:251 */ width: min(32.5rem, 100%);
```
Ensure each table with `min-width` is inside `.table-responsive-*{overflow-x:auto}`; add `max-width:100%` to wrappers; test at 320px.
**After:** no page-level horizontal scrollbar at 320 CSS px / 400% zoom; only tables scroll inside their own box.

### A-13 Page title and route focus (SC 2.4.2, 2.4.3)
```jsx
// hooks/usePageTitle.js
export default function usePageTitle(title) {
  useEffect(() => { document.title = `${title} - STI Baliuag CMS`; }, [title]);
}
// in layout, on location change:
const mainRef = useRef(null);
useEffect(() => { mainRef.current?.focus(); }, [location.pathname]);
```
Call `usePageTitle('Medicine Inventory')` in each page. `<main ref={mainRef} tabIndex={-1}>` already planned in A-04.
**After:** tab bar/SR reads a distinct title per page; after clicking a nav link the SR starts reading the new page.

### A-14 Autocomplete (SC 1.3.5, 3.3.8)
```jsx
<input type="text" name="username" autoComplete="username" ... />
<input type={showPassword ? 'text' : 'password'} name="password" autoComplete="current-password" ... />
<input inputMode="numeric" autoComplete="one-time-code" ... />   {/* verification code */}
```
Keep paste enabled (already true). For phone/names in profile forms use `tel`, `given-name`, `family-name`, `email`.
**After:** browser/password manager fills the login in one step.

### A-15 Toggle state (SC 4.1.2)
```jsx
<button type="button" className="password-toggle-btn" onClick={() => setShowPassword(v => !v)}
        aria-label="Show password" aria-pressed={showPassword}>
```
(keep the label constant when using `aria-pressed`.) Sidebar collapse: `aria-expanded={!collapsed}`, `aria-controls="app-sidebar"`; give the sidebar `id="app-sidebar"`.
**After:** "Show password, toggle button, pressed".

### A-16 Hardcoded values (project rules, 1.4.3 in dark)
Route colors through tokens: replace hex in `Login.css`, `NurseDashboard.css`, ... with `var(--...)`; `font-size: Npx` -> `rem` (`14px` -> `0.875rem`, `12px` -> keep >= `0.875rem` per project rule). Do this incrementally per file when touched; prioritize inline `style={{color:'#...'}}` (134) because they cannot be themed.

### A-17 Emoji / color-only dots
```jsx
<div className="sti-card-icon" aria-hidden="true">📋</div>   // or lucide <ClipboardList aria-hidden />
<span className="doc-warning-dot-vlc" aria-hidden="true" /><span className="sr-only">Not documented</span>
```
Show the same text visibly (or in an `aria-label`) instead of relying on `title`.

### A-18 Motion
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important;
    transition-duration: .01ms !important; scroll-behavior: auto !important; }
}
```
Put this once in `theme.css`.

---

## 4. Manual Verification Steps

1. **Keyboard only (no mouse), every portal:** `Tab` through Login, Nurse Dashboard, Manage Student Accounts, Student Check-up, Parent Dashboard, Doctor Check-up. Every stop shows a visible ring (A-01); order matches reading order; first `Tab` offers the skip link (A-04).
2. **Modals:** open each modal type, press `Tab`/`Shift+Tab` repeatedly (stays inside), `Esc` (closes), confirm focus returns to the opener (A-02). Repeat for message modals and the camera-scan modal.
3. **Screen reader:** NVDA+Firefox/Chrome (`Insert+F7` elements list: landmarks, headings, form fields) and VoiceOver (`Ctrl+Option+U` rotor). Check: dialog announced on open, Login fields named, Login error spoken after bad password, icon buttons named, table headers read per cell (`Ctrl+Alt+Arrow` in NVDA).
4. **Contrast:** DevTools > element > Contrast row, or axe DevTools; toggle `data-theme="dark"` on `<html>` and recheck links, info banners, primary buttons, input borders, disabled text. Re-run `node scratchpad/contrast.js` after editing tokens.
5. **Zoom/reflow:** browser at 400% zoom (or 320px wide in responsive mode): no horizontal page scroll on `/BookCheckup`, tables scroll inside wrappers; text-only zoom 200% via Firefox "Zoom text only".
6. **Target size:** DevTools "Inspect", check computed box of the password toggle, collapse toggle, row action icons >= 24px (AA) and 44px (project).
7. **Focus obscured:** on mobile width scroll, `Tab` to controls under the fixed top bar / hamburger; the focused element must be fully visible.
8. **Automated sweep (does not replace the above):** `npx @axe-core/cli http://localhost:3000/Login` per route (log in first for portal pages) or Lighthouse accessibility; enable `jsx-a11y` rules in CRA ESLint config (`label-has-associated-control`, `click-events-have-key-events`, `no-static-element-interactions`, `control-has-associated-label`).
9. **Reduced motion:** OS "Reduce motion" on; pulsing dot, sidebar slide, theme fade must stop or shorten.
10. **Titles:** open 5 different pages, confirm browser tab/`document.title` differs and SR announces the new page after route change.

---
Limits: static analysis only. Findings in A-03, A-12, A-14 (OTP field) include *verify* items that depend on markup not read line by line. Fixing A-01, A-02 and A-04 first removes the three biggest barriers with the least code (one CSS block, one component, four layouts).
