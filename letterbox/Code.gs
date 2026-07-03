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
 * The site POSTs JSON: { t, name, reply, img } where img is a JPEG data URL.
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

    if (letter.img && letter.img.indexOf('data:image/') === 0) {
      var base64 = letter.img.split(',')[1];
      var blob = Utilities.newBlob(
        Utilities.base64Decode(base64),
        'image/jpeg',
        'letter-' + new Date().toISOString().slice(0, 10) + '.jpg'
      );
      options.attachments = [blob];
    }

    MailApp.sendEmail(
      TO,
      '✉ a letter from the site' + (letter.name ? ' — ' + letter.name : ''),
      'from:  ' + name + '\nreply: ' + reply + '\n\nThe drawing is attached.',
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
