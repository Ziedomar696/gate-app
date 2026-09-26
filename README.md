# Gate Log: Website + App Setup

This folder has two parts:

| Folder | What it is |
|---|---|
| `apps-script/` | The backend and the screen (`Code.gs`, `Index.html`, `appsscript.json`). This runs on Google and is the **website**. |
| `web/` | A small installable wrapper around that website. It's the **app** guards add to their phone's home screen. It opens full screen with its own icon. |

All the data still goes to your Google Sheet. The app is just a nicer way to open the website.

---

## Part 1: Run it as a website (about 10 minutes)

1. Go to **script.google.com** → **New project**. Rename it to `سجل بوابة الأفراد`.
2. Replace the contents of `Code.gs` with `apps-script/Code.gs`.
3. **+ → HTML** → name it exactly `Index` → paste `apps-script/Index.html`.
4. **Project Settings (⚙️)** → turn on **"Show appsscript.json manifest file"**. Then open `appsscript.json` in the editor and paste `apps-script/appsscript.json`.
   *(This turns on the Drive service that reads the ID card.)*
5. **Change the PIN** on line 7 of `Code.gs` (`const GATE_PIN = '2468';`).
6. In the function menu at the top, pick **`setup`** → **Run** → approve the permissions.
   It creates a Google Sheet called **سجل بوابة الأفراد** in your Drive. The link to it is in the execution log.
7. **Deploy → New deployment** → type **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   → **Deploy**. Copy the **Web app URL** (it ends in `/exec`).

That URL is the website. Open it on any phone or PC, enter the PIN, and you're in.

> **Updating the code later:** use **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. That keeps the same URL. A *New deployment* creates a new URL, and the app would need the new one.

---

## Part 2: Run it as an app (about 5 minutes)

Google won't let an Apps Script page be installed as an app directly, so the `web/` folder has to be hosted somewhere once. It's free.

### 1. Put your URL in the app (recommended)
Open `web/index.html` and paste your `/exec` URL here:
```js
var APP_URL = "https://script.google.com/macros/s/XXXXXXXX/exec";
```
If you skip this, the app asks for the URL the first time on each phone.

### 2. Host the `web/` folder (pick one)
- **Netlify Drop, the easiest.** Go to **app.netlify.com/drop** and drag the `web` folder onto the page. You get a link like `https://gate-log-123.netlify.app`. Make a free account so the link stays.
- **GitHub Pages.** New repository → upload the *contents* of `web/` → **Settings → Pages → Deploy from branch → main**. You get `https://<user>.github.io/<repo>/`.

It has to be served over **https**. Both options do that.

### 3. Install on each guard's phone
Send the guards the hosted link (not the script.google.com one).

- **Android (Chrome):** open the link → **⋮ menu → Add to Home screen / Install app**.
- **iPhone (Safari):** open the link → **Share ⬆ → Add to Home Screen**.
- **Windows / Mac (Chrome or Edge):** open the link → the install icon in the address bar.

The app opens full screen with the striped icon. The camera button still opens the camera for the ID card.

### Optional: a real Android APK / Play Store app
Go to **pwabuilder.com** → paste your hosted link → **Package for stores → Android**. It builds an APK/AAB from the same app, with no coding.

---

## Notes
- **Internet is required.** Every entry is saved straight to the Sheet. With no connection, the app shows "مفيش إنترنت" and reconnects on its own.
- **Changing the URL on a phone:** open the app link with `?reset=1` at the end, e.g. `https://gate-log-123.netlify.app/?reset=1`.
- **iPhone PIN:** Safari sometimes forgets the saved PIN inside installed apps. If it does, the guard just types it again.
- **Keep "Who has access: Anyone".** If it's set to require a Google login, the page can't open inside the app.
- **Anyone with the link can see the PIN screen**, so the PIN is your protection. Pick one that isn't easy to guess and change it if a guard leaves.
