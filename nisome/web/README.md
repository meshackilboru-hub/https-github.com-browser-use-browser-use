# Nisome on the web

`nisome.html` is the browser version of Nisome, published as a claude.ai page:
https://claude.ai/artifact/WgGT48QQJtGxb7M3ae9NLy

It needs no server or API key:

- **Sign-in:** people use their claude.ai account (which offers "Continue with Google").
- **AI:** each person's requests use their own Claude usage.
- **Saving:** each person's profile, library, questions and progress are stored privately for that person. Nobody else can see them, including the page owner. People who open a view-only link can still study, but nothing is saved after they leave.
- **Files:** PDFs are read in the browser with pdf.js, Word files with mammoth, and photos and scanned pages by Claude.
- **Large books:** they're split into parts of about 80 KB, because each AI request is limited to 256 KB of text. Chat finds the most relevant parts by keyword search.

Differences from the mobile app in `../mobile`:

- Videos and learning sites open in a new tab, because claude.ai pages can't embed YouTube.
- Processing happens in the browser tab, so keep it open while a large book is read.
- Files can be up to 100 MB.
- At most 40 scanned pages (pages without selectable text) are read per upload.

To change the page, edit `nisome.html` and republish it from a Claude session.
