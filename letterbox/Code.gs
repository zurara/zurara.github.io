/**
 * Letterbox — receives ripped letters from zurara.github.io and emails
 * them to you with the drawing as a real JPEG attachment.
 *
 * Setup (once, ~5 minutes):
 *   1. Go to https://script.google.com while logged in as zurara.design@gmail.com
 *   2. New project → name it "letterbox" → paste this whole file into Code.gs
 *   3. Deploy → New deployment → type: Web app
 *        - Execute as: Me
 *        - Who has access: Anyone
 *   4. Authorize when prompted, then copy the Web app URL (ends in /exec)
 *   5. Paste that URL into LETTERBOX_URL in src/components/Conveyor.astro
 *
 * The site POSTs JSON: { t, name, reply, img, paper } — img is a JPEG data
 * URL of the visitor's viewport (cards + strokes, exactly as they saw it),
 * paper is the full pencil roll on its own. Both arrive as attachments.
 */

var TO = 'zurara.design@gmail.com';

function doPost(e) {
  try {
    var letter = JSON.parse(e.postData.contents);
    var name = letter.name || 'anonymous visitor';
    var reply = letter.reply || '—';

    var options = {
      name: 'wangtsaiti letterbox',
      replyTo: letter.reply || undefined,
    };

    var stamp = new Date().toISOString().slice(0, 10);
    var attachments = [];
    var attach = function (dataUrl, label) {
      if (dataUrl && dataUrl.indexOf('data:image/') === 0) {
        attachments.push(
          Utilities.newBlob(
            Utilities.base64Decode(dataUrl.split(',')[1]),
            'image/jpeg',
            'letter-' + label + '-' + stamp + '.jpg'
          )
        );
      }
    };
    attach(letter.img, 'view'); // the viewport: cards + strokes as the visitor saw them
    attach(letter.paper, 'strokes'); // the full pencil roll on its own
    if (attachments.length) options.attachments = attachments;

    MailApp.sendEmail(
      TO,
      'A letter from the site' + (letter.name ? ' - ' + letter.name : ''),
      'from:  ' + name + '\nreply: ' + reply +
        '\n\nAttached: the page as they saw it (view), and the strokes alone.',
      options
    );

    return ContentService.createTextOutput(
      JSON.stringify({ ok: true })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: String(err) })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
