INDIGOMX WORDPRESS V2 — CLICK-TO-EDIT GUTENBERG THEME
====================================================
Version: 2.0.0. Independent theme folder: indigomx-native-v2.

INSTALL
1. Back up WordPress files and database before any theme switch.
2. Appearance > Themes > Add New > Upload Theme, upload the v2 ZIP.
3. Activate "IndigoMx Native Editor V2". This does not delete the v1 theme.
4. v2 creates missing Home/About/Services/Our Work/Contact pages automatically.
   Existing v1 IndigoMx pages use the SAME block identifier in v2. NO database
   conversion is performed, and existing content is left exactly as it was.
   This means you can switch back to v1 without reverting the block format.
   Existing non-IndigoMx pages are not overwritten.
5. Clear SpeedyCache and hard-refresh the WordPress page editor.
6. Pages > Home > Edit: click ANY visible heading, paragraph or caption and TYPE.
   Click an image to open the Media Library. Click a link, then its URL can be
   changed under Block sidebar > Selected link. (Do not test navigation by
   clicking a link inside the editor; it is deliberately disabled there.)
7. Move whole page sections with native Gutenberg drag handles/arrows or List View.
   Click + to add a preset IndigoMx section or native Heading/Paragraph/Image/etc.
   Click Save and check the public page.

HOW EDITING WORKS
- IndigoMx layouts remain custom Gutenberg SECTION blocks to preserve the
  original hand-coded styling and nested structural/graphic markup.
- Text uses WordPress' real RichText contenteditable (inline, NOT sidebar fields).
- Pictures use WordPress MediaUpload/Media Library; link URLs are in Block settings.
- Whole sections can be dragged, cloned, deleted and inserted in native Gutenberg.
- Normal Gutenberg core blocks can also be inserted; they won't automatically
  have the elaborate original IndigoMx section layouts.
- The navigation and footer are accurately PREVIEWED in the editor, but are
  shared theme templates, not inline-editable page content.
- Complex forms and map embeds are kept functional on the published page, but
  form inputs are disabled / map shows a placeholder in the editor.
- Original CSS, responsive rules, icons, images, layout and public JS are retained.
- Dynamic frontend markup comes from saved section HTML, not a theme-wide SVG image.

NOT YET COVERED
- This is NOT a wholly native full-site-editing (FSE) theme. Original section
  blocks use native RichText and media controls but aren't collections of core
  Paragraph/Heading/Image blocks. Every element is not freely repositionable.
- Shared header and footer are still template-controlled. Contact form is the
  original static frontend form with a mailto fallback until a server/form service
  endpoint is configured. Site-wide editing and robust contact delivery require
  additional work.
- 100% pixel fidelity in YOUR WordPress environment still needs browser QA.
- Some non-text design elements (SVG decoration, animation, select choices) are
  intentionally fixed to protect visual consistency.

SECURITY
- Original SVG/form/iframe section markup is trusted HTML. Give edit access to
  trusted admins and editors only; do not enable unfiltered HTML for untrusted users.
- If reusing this theme beyond this controlled site, review HTML sanitization
  and permissions per your editorial access model.
