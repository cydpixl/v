# TikTok sharing

Vela can now open share links (`?share=<encoded TikTok URL>`) and offer a conversation picker. Sent TikTok URLs use Vela's existing messaging/outbox. Canonical TikTok video links display TikTok's embedded player. Short `vm.tiktok.com`/`vt.tiktok.com` links remain clickable, but cannot automatically become an iframe without a server-side resolver.

## Add to iPhone Share Sheet
1. Open Apple Shortcuts; create **Send to Vela**.
2. In Details, enable **Show in Share Sheet**, receiving URLs and Text.
3. Add **Get URLs from Shortcut Input**.
4. Add **URL Encode** of the URL.
5. Add a **Text** action with `https://cydpixl.github.io/v/?share=` followed by the encoded URL.
6. Add **Open URLs** using Text.
7. In TikTok: Share → More → Send to Vela.

If no input URL is provided by TikTok, use Copy Link and Get Clipboard in the shortcut. Video content stays on TikTok.
