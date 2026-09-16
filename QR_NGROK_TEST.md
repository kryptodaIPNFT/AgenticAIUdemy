# QR login test with ngrok (mobile + desktop)

Use this flow to scan the desktop QR code on your phone and sign in through **/qr-reader** only (dev bypass is hidden on ngrok).

---

## 1. Install ngrok (one time)

1. Download from [https://ngrok.com/download](https://ngrok.com/download)
2. Sign up (free) and copy your authtoken
3. In PowerShell:

```powershell
ngrok config add-authtoken YOUR_TOKEN_HERE
```

Or install via winget:

```powershell
winget install ngrok.ngrok
```

---

## 2. Start the portal

**Terminal A** — Node server:

```powershell
cd c:\GenAI\AI_WEB_SEMINAR\Demo_projects\Udemy_demo
npm start
```

---

## 3. Start ngrok tunnel

**Terminal B**:

```powershell
ngrok http 3000
```

Copy the **Forwarding** HTTPS URL, e.g.:

```
https://abc123.ngrok-free.app
```

---

## 4. Restart server with PUBLIC_URL

Stop the Node server (Ctrl+C in Terminal A), then:

```powershell
cd c:\GenAI\AI_WEB_SEMINAR\Demo_projects\Udemy_demo
$env:PUBLIC_URL = "https://abc123.ngrok-free.app"   # ← your ngrok URL
npm start
```

You should see:

```
PUBLIC_URL (QR codes) -> https://abc123.ngrok-free.app
```

**Important:** QR codes embed this URL so your phone can open `/qr-reader`.

---

## 5. Test on desktop + phone

### Desktop
1. Open **`https://abc123.ngrok-free.app`** in your browser (use the ngrok URL, not localhost)
2. Click **Show QR code**
3. Leave the page open — it polls until your phone verifies

### Phone
1. Scan the QR with your camera **or** tap the link ngrok shows if you opened manually
2. You land on **`/qr-reader?code=XXXXXX`**
3. Select your **student profile**
4. Tap **Verify & sign in**

### Desktop (again)
- Within ~2 seconds the desktop shows **Signed in as …** and redirects to **/dashboard**

---

## Automated helper (optional)

If ngrok is installed and already running on port 3000:

```powershell
cd c:\GenAI\AI_WEB_SEMINAR\Demo_projects\Udemy_demo
powershell -ExecutionPolicy Bypass -File .\scripts\ngrok-test.ps1
```

This script reads the ngrok URL from the local API and starts the server with `PUBLIC_URL` set.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Phone opens `localhost` link | Set `PUBLIC_URL` and open **desktop via ngrok URL** |
| QR expired | Click **Refresh QR code** on desktop (2 min limit) |
| ngrok warning page | Tap **Visit Site** on the free-tier interstitial |
| Desktop never redirects | Same Wi‑Fi not required; both must reach ngrok. Keep desktop tab open. |
| 401 on verify | Code expired — refresh QR and scan again within 2 minutes |

---

## Security note

- **Dev bypass** is hidden automatically when you use the ngrok hostname (not localhost).
- Only a valid scan → `/qr-reader` → verify flow completes login on the desktop session.
